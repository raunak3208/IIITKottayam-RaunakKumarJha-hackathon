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

CREDIBILITY = {"filing": 1.0, "news": 0.9, "social": 0.6}


def impact_score(event_type, sentiment, type_confidence, source):
    raw = (
        SEVERITY[event_type]
        * (0.5 + 0.5 * abs(sentiment))
        * CREDIBILITY[source]
        * (0.6 + 0.4 * type_confidence)
    )
    return round(1 + 9 * min(raw, 1.0), 1)
