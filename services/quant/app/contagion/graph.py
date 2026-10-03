import json
import os
from functools import cache

import networkx as nx

LINKS_PATH = os.getenv("LINKS_PATH", "../../data/portfolio/links.json")
DECAY = 0.6
MAX_HOPS = 2
SECTOR_EDGE = 0.7
GAIN = 0.5


def sector_node(name):
    return f"sector:{name}"


@cache
def load_links():
    with open(LINKS_PATH) as handle:
        return json.load(handle)


def build_graph(positions, edges):
    graph = nx.Graph()
    for p in positions:
        if p["ticker"] and p["sector"]:
            graph.add_edge(p["ticker"], sector_node(p["sector"]), weight=SECTOR_EDGE)
    for a, b, weight in edges:
        if not graph.has_edge(a, b) or graph[a][b]["weight"] < weight:
            graph.add_edge(a, b, weight=weight)
    return graph


def propagate(graph, epicenter):
    exposure = {node: 1.0 for node in epicenter if node in graph}
    frontier = dict(exposure)
    for _ in range(MAX_HOPS):
        reached = {}
        for node, value in frontier.items():
            for neighbor in graph[node]:
                reach = value * graph[node][neighbor]["weight"] * DECAY
                if reach > exposure.get(neighbor, 0.0) and reach > reached.get(neighbor, 0.0):
                    reached[neighbor] = reach
        exposure.update(reached)
        frontier = reached
    return exposure


def epicenter_nodes(positions, tickers, event_type, event_epicenters):
    sectors = {p["ticker"]: p["sector"] for p in positions if p["ticker"] and p["sector"]}
    nodes = set(tickers) | {sector_node(sectors[t]) for t in tickers if t in sectors}
    if not nodes:
        nodes = set(event_epicenters.get(event_type, []))
    return sorted(nodes)


def amplifier(position, exposure):
    reach = max(
        exposure.get(position["ticker"], 0.0),
        exposure.get(sector_node(position["sector"]), 0.0) if position["sector"] else 0.0,
    )
    return 1 + GAIN * reach
