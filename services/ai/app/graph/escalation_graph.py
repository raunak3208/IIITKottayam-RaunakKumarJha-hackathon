from typing import TypedDict

from langgraph.graph import END, StateGraph

from app.guardrails.output import parse_adjudication, verify_quote
from app.llm.client import LLMError, LLMUnavailable
from app.llm.prompts import SYSTEM, adjudication_prompt

SENTIMENT_TOLERANCE = 0.35


class State(TypedDict, total=False):
    text: str
    tier1: dict
    analogs: list
    first: dict
    quote: dict
    outcome: str
    reason: str
    final: dict


def build_graph(llm, index):
    def ask(state, temperature):
        prompt = adjudication_prompt(state["text"], state["tier1"], state["analogs"])
        return parse_adjudication(llm.complete(SYSTEM, prompt, temperature=temperature))

    def failure(err):
        if isinstance(err, (LLMUnavailable, LLMError)):
            return {"outcome": "error", "reason": str(err)}
        return {"outcome": "abstain", "reason": f"invalid output: {err}"}

    def retrieve(state):
        try:
            return {"analogs": index.search(state["text"], k=3)}
        except Exception:
            return {"analogs": []}

    def adjudicate(state):
        try:
            return {"first": ask(state, 0.0)}
        except (LLMUnavailable, LLMError, ValueError) as err:
            return failure(err)

    def check_quote(state):
        quote = verify_quote(state["first"]["evidence_quote"], state["text"])
        if quote is None:
            return {"outcome": "abstain", "reason": "evidence quote not found in source"}
        return {"quote": quote}

    def consistency(state):
        try:
            second = ask(state, 0.7)
        except (LLMUnavailable, LLMError, ValueError) as err:
            return failure(err)
        first = state["first"]
        agree = (
            first["event_type"] == second["event_type"]
            and abs(first["sentiment"] - second["sentiment"]) <= SENTIMENT_TOLERANCE
        )
        if not agree:
            return {"outcome": "abstain", "reason": "second opinion disagrees"}
        confidence = min(first["confidence"], second["confidence"])
        return {"outcome": "ok", "final": {**first, "confidence": confidence}}

    def route(state):
        return "stop" if state.get("outcome") else "go"

    graph = StateGraph(State)
    graph.add_node("retrieve", retrieve)
    graph.add_node("adjudicate", adjudicate)
    graph.add_node("check_quote", check_quote)
    graph.add_node("consistency", consistency)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "adjudicate")
    graph.add_conditional_edges("adjudicate", route, {"stop": END, "go": "check_quote"})
    graph.add_conditional_edges("check_quote", route, {"stop": END, "go": "consistency"})
    graph.add_edge("consistency", END)
    return graph.compile()
