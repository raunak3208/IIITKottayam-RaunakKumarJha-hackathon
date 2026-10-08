"""
app/graph/research_graph.py

LangGraph-based research pipeline for ARIA.
Streaming and non-streaming entry points.
"""

import logging
from typing import AsyncGenerator, TypedDict

from langgraph.graph import END, StateGraph

from app.agents.aria.agents import (
    build_search_agent,
    build_reader_agent,
    writer_chain,
    critic_chain,
)

logger = logging.getLogger(__name__)


class ResearchState(TypedDict, total=False):
    topic: str
    search_results: str
    scraped_content: str
    report: object
    feedback: object
    events: list


def _search_node(state: ResearchState) -> dict:
    topic = state["topic"]
    agent = build_search_agent()
    result = agent.invoke({
        "messages": [("user", f"Find recent, reliable and detailed information about: {topic}")]
    })
    return {
        "search_results": result["messages"][-1].content,
        "events": [*state.get("events", []), {"step": "search", "status": "done"}],
    }


def _reader_node(state: ResearchState) -> dict:
    topic = state["topic"]
    agent = build_reader_agent()
    result = agent.invoke({
        "messages": [("user",
            f"Based on the following search results about '{topic}', "
            f"pick the most relevant URL and scrape it for deeper content.\n\n"
            f"Search Results:\n{state['search_results'][:800]}"
        )]
    })
    return {
        "scraped_content": result["messages"][-1].content,
        "events": [*state.get("events", []), {"step": "read", "status": "done"}],
    }


def _writer_node(state: ResearchState) -> dict:
    combined = (
        f"SEARCH RESULTS:\n{state['search_results']}\n\n"
        f"DETAILED SCRAPED CONTENT:\n{state['scraped_content']}"
    )
    report = writer_chain.invoke({"topic": state["topic"], "research": combined})
    return {
        "report": report,
        "events": [*state.get("events", []), {"step": "write", "status": "done"}],
    }


def _critic_node(state: ResearchState) -> dict:
    r = state["report"]
    report_text = (
        f"Title: {r.title}\n"
        f"Summary: {r.summary}\n"
        f"Findings: {r.findings}\n"
        f"Analysis: {r.analysis}"
    )
    feedback = critic_chain.invoke({"report": report_text})
    return {
        "feedback": feedback,
        "events": [*state.get("events", []), {"step": "critic", "status": "done"}],
    }


def _build_graph():
    g = StateGraph(ResearchState)
    g.add_node("search", _search_node)
    g.add_node("read", _reader_node)
    g.add_node("write", _writer_node)
    g.add_node("critic", _critic_node)
    g.set_entry_point("search")
    g.add_edge("search", "read")
    g.add_edge("read", "write")
    g.add_edge("write", "critic")
    g.add_edge("critic", END)
    return g.compile()


_graph = _build_graph()


async def stream_research_graph(topic: str) -> AsyncGenerator[dict, None]:
    """Yield SSE-style event dicts as the graph progresses."""
    init_state: ResearchState = {"topic": topic, "events": []}
    async for chunk in _graph.astream(init_state):
        for node_name, node_output in chunk.items():
            events = node_output.get("events", [])
            for ev in events:
                yield {**ev, "node": node_name}
            # Yield final result on last node
            if node_name == "critic" and "feedback" in node_output:
                fb = node_output.get("feedback") or {}
                yield {
                    "step": "done",
                    "score": getattr(fb, "score", None),
                    "verdict": getattr(fb, "verdict", None),
                }


async def run_research_graph(topic: str) -> dict:
    """Run the full pipeline and return the final state dict."""
    init_state: ResearchState = {"topic": topic, "events": []}
    final = await _graph.ainvoke(init_state)
    report = final.get("report")
    feedback = final.get("feedback")
    return {
        "topic": topic,
        "search_results": final.get("search_results", ""),
        "scraped_content": final.get("scraped_content", ""),
        "report": {
            "title": report.title if report else "",
            "summary": report.summary if report else "",
            "findings": report.findings if report else [],
            "analysis": report.analysis if report else "",
            "sources": [s.model_dump() for s in (report.sources if report else [])],
        },
        "feedback": {
            "score": feedback.score if feedback else 0,
            "verdict": feedback.verdict if feedback else "",
            "review": feedback.review if feedback else "",
        },
    }
