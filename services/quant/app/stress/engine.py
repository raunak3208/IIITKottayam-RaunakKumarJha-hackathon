from functools import cache
from pathlib import Path

import yaml

from app.portfolio.loader import load_positions

LIBRARY = Path(__file__).parent.parent / "scenarios" / "library.yaml"
BASE_CURRENCY = "USD"
PD_PER_100BP = 1.0


@cache
def scenarios():
    return yaml.safe_load(LIBRARY.read_text())


def get_scenario(scenario_id):
    return next((s for s in scenarios() if s["scenario_id"] == scenario_id), None)


def reprice(position, shocks):
    kind = position["asset_class"]
    value = position["market_value"]

    if kind == "equity":
        after = value * (1 + position["beta"] * shocks["equity_pct"] / 100)
    elif kind == "bond":
        dy = (shocks["rate_bp"] + position["spread_sensitivity"] * shocks["credit_spread_bp"]) / 10000
        after = value * (1 - position["duration"] * dy + 0.5 * position["convexity"] * dy**2)
    elif kind == "loan":
        spread = shocks["credit_spread_bp"]
        stressed_pd = min(1.0, position["pd"] * (1 + PD_PER_100BP * spread / 100))
        after = value * (1 - position["duration"] * spread / 10000)
        after -= value * position["lgd"] * (stressed_pd - position["pd"])
    elif kind == "derivative":
        after = value + position["delta"] * position["notional"] * shocks["equity_pct"] / 100
    else:
        after = value

    if position["currency"] != BASE_CURRENCY:
        after *= 1 + shocks["fx_pct"] / 100
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


def run_stress(scenario):
    positions = load_positions()
    before = {}
    after = {}
    for p in positions:
        kind = p["asset_class"]
        before[kind] = before.get(kind, 0.0) + p["market_value"]
        after[kind] = after.get(kind, 0.0) + reprice(p, scenario["shocks"])

    total_before = sum(before.values())
    total_after = sum(after.values())
    return {
        "scenario": scenario,
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
    }
