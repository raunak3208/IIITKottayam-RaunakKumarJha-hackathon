SEVERITY = {
    "Credit Event": 0.95,
    "Geopolitical": 0.90,
    "Macroeconomic": 0.75,
    "Regulatory Event": 0.70,
    "Merger/Acquisition": 0.60,
    "Earnings": 0.50,
    "Product Launch": 0.35,
    "Other": 0.25,
}

EVENT_TYPES = list(SEVERITY)
CREDIBILITY = {"filing": 1.0, "news": 0.9, "social": 0.6}
MARKET_FACTOR = {"confirmed": 1.1, "unconfirmed": 0.9, "pending": 1.0, "not_applicable": 1.0}
CORROBORATION_BASE = 0.9
CORROBORATION_STEP = 0.05
ANCHOR_WEIGHT = 0.25
FULL_IMPACT_MOVE_PCT = 8.0


def impact_score(event_type, sentiment, type_confidence, source, source_count=1, market="not_applicable"):
    corroboration = CORROBORATION_BASE + CORROBORATION_STEP * min(source_count - 1, 4)
    raw = (
        SEVERITY[event_type]
        * (0.5 + 0.5 * abs(sentiment))
        * CREDIBILITY[source]
        * (0.6 + 0.4 * type_confidence)
        * corroboration
        * MARKET_FACTOR[market]
    )
    return round(1 + 9 * min(raw, 1.0), 1)


def blend_with_analogs(impact, analogs):
    moves = [abs(a["reaction_1d_pct"]) for a in analogs if a.get("reaction_1d_pct") is not None]
    if not moves:
        return impact
    anchor = 1 + 9 * min(sum(moves) / len(moves) / FULL_IMPACT_MOVE_PCT, 1.0)
    return round((1 - ANCHOR_WEIGHT) * impact + ANCHOR_WEIGHT * anchor, 1)
