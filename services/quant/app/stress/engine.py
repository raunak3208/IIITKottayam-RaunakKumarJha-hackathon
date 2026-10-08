from functools import cache
from pathlib import Path

import numpy as np
import yaml

from app.contagion.graph import (
    amplifier,
    build_graph,
    epicenter_nodes,
    load_links,
    propagate,
)
from app.portfolio.loader import load_positions
from app.simulation.monte_carlo import FACTORS, sample_shocks, tail_risk

LIBRARY = Path(__file__).parent.parent / "scenarios" / "library.yaml"
BASE_CURRENCY = "USD"
PD_PER_100BP = 1.0
MIN_SCALE, MAX_SCALE = 0.5, 1.5
MAX_REVERSE_SCALE = 20.0


@cache
def scenarios():
    return yaml.safe_load(LIBRARY.read_text())


def get_scenario(scenario_id):
    return next((s for s in scenarios() if s["scenario_id"] == scenario_id), None)


def shock_scale(scenario, impact, confidence):
    if impact is None or confidence is None:
        return 1.0
    scale = (impact / scenario["trigger"]["min_impact"]) * (0.5 + 0.5 * confidence)
    return float(min(MAX_SCALE, max(MIN_SCALE, scale)))


def reprice(position, shocks, amplifier=1.0):
    kind = position["asset_class"]
    value = position["market_value"]
    equity = shocks["equity_pct"] * amplifier
    spread = shocks["credit_spread_bp"] * amplifier

    if kind == "equity":
        after = value * (1 + position["beta"] * equity / 100)
    elif kind == "bond":
        dy = (shocks["rate_bp"] + position["spread_sensitivity"] * spread) / 10000
        after = value * (1 - position["duration"] * dy + 0.5 * position["convexity"] * dy**2)
    elif kind == "loan":
        stressed_pd = np.minimum(1.0, position["pd"] * (1 + PD_PER_100BP * spread / 100))
        after = value * (1 - position["duration"] * spread / 10000)
        after = after - value * position["lgd"] * (stressed_pd - position["pd"])
    elif kind == "derivative":
        after = value + position["delta"] * position["notional"] * equity / 100
    else:
        after = value

    if position["currency"] != BASE_CURRENCY:
        after = after * (1 + shocks["fx_pct"] / 100)
    return after


def exposure(positions):
    totals = {}
    for p in positions:
        totals[p["asset_class"]] = totals.get(p["asset_class"], 0.0) + p["market_value"]
    grand = sum(totals.values())
    return [
        {"asset_class": k, "value": round(v, 2), "share": round(v / grand, 4) if grand else 0}
        for k, v in sorted(totals.items(), key=lambda kv: -kv[1])
    ]


def _total_after(positions, shocks, amplifiers):
    return sum(reprice(p, shocks, a) for p, a in zip(positions, amplifiers))


def _context(scenario, impact, confidence, tickers, custom_shocks):
    positions = load_positions()
    links = load_links()
    if custom_shocks:
        scale, shocks = 1.0, {k: float(custom_shocks[k]) for k in FACTORS}
    else:
        scale = shock_scale(scenario, impact, confidence)
        shocks = {k: v * scale for k, v in scenario["shocks"].items()}

    graph = build_graph(positions, links["edges"])
    epicenter = epicenter_nodes(
        positions, tickers or [], scenario["trigger"]["event_type"], links["event_epicenters"]
    )
    reach = propagate(graph, epicenter)
    amplifiers = [amplifier(p, reach) for p in positions]
    return positions, shocks, amplifiers, epicenter, reach, scale


def run_stress(scenario, impact=None, confidence=None, tickers=None, simulations=2000, seed=42,
               custom_shocks=None):
    positions, shocks, amplifiers, epicenter, reach, scale = _context(
        scenario, impact, confidence, tickers, custom_shocks
    )

    before, after = {}, {}
    for p, a in zip(positions, amplifiers):
        kind = p["asset_class"]
        before[kind] = before.get(kind, 0.0) + p["market_value"]
        after[kind] = after.get(kind, 0.0) + float(reprice(p, shocks, a))

    total_before = sum(before.values())
    total_after = sum(after.values())
    plain_after = float(_total_after(positions, shocks, [1.0] * len(positions)))

    draws = sample_shocks(shocks, simulations, seed)
    pnl = _total_after(positions, draws, amplifiers) - total_before

    return {
        "scenario": scenario,
        "scale": round(scale, 3),
        "shocks_applied": {k: round(v, 2) for k, v in shocks.items()},
        "value_before": round(total_before, 2),
        "value_after": round(total_after, 2),
        "loss": round(total_after - total_before, 2),
        "loss_pct": round((total_after - total_before) / total_before * 100, 2) if total_before else 0,
        "by_asset_class": [
            {
                "asset_class": kind,
                "before": round(before[kind], 2),
                "after": round(after[kind], 2),
                "change": round(after[kind] - before[kind], 2),
            }
            for kind in sorted(before, key=lambda k: -before[k])
        ],
        "exposure": exposure(positions),
        "contagion": {
            "epicenter": epicenter,
            "affected": [
                {"node": n, "exposure": round(v, 3)}
                for n, v in sorted(reach.items(), key=lambda kv: -kv[1])
                if n not in epicenter
            ][:8],
            "positions_amplified": sum(1 for a in amplifiers if a > 1.0),
            "extra_loss": round(total_after - plain_after, 2),
        },
        "risk": {"simulations": simulations, **tail_risk(pnl)},
    }


def sensitivity(scenario, tickers=None, custom_shocks=None):
    positions, shocks, amplifiers, *_ = _context(scenario, None, None, tickers, custom_shocks)
    before = sum(p["market_value"] for p in positions)
    base = float(_total_after(positions, shocks, amplifiers)) - before

    factors = []
    for factor in FACTORS:
        deltas = []
        for multiplier in (0.5, 1.5):
            varied = {**shocks, factor: shocks[factor] * multiplier}
            deltas.append(float(_total_after(positions, varied, amplifiers)) - before - base)
        factors.append(
            {
                "factor": factor,
                "base_shock": round(shocks[factor], 2),
                "low_delta": round(deltas[0], 2),
                "high_delta": round(deltas[1], 2),
                "swing": round(abs(deltas[1] - deltas[0]), 2),
            }
        )
    factors.sort(key=lambda f: -f["swing"])
    return {"base_change": round(base, 2), "factors": factors}


def reverse(scenario, target_loss_pct, tickers=None):
    positions, shocks, amplifiers, *_ = _context(scenario, None, None, tickers, None)
    before = sum(p["market_value"] for p in positions)

    def loss_pct(multiplier):
        scaled = {k: v * multiplier for k, v in shocks.items()}
        return (float(_total_after(positions, scaled, amplifiers)) - before) / before * 100

    target = -abs(target_loss_pct)
    high = MAX_REVERSE_SCALE
    if loss_pct(high) > target:
        return {"reachable": False, "max_scale_tested": high, "loss_pct_at_max": round(loss_pct(high), 2)}

    low = 0.0
    for _ in range(50):
        mid = (low + high) / 2
        if loss_pct(mid) > target:
            low = mid
        else:
            high = mid
    return {
        "reachable": True,
        "scale": round(high, 3),
        "shocks": {k: round(v * high, 2) for k, v in shocks.items()},
        "loss_pct": round(loss_pct(high), 2),
        "loss": round(loss_pct(high) / 100 * before, 2),
    }
