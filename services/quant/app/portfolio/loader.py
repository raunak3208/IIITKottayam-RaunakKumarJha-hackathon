import os
from functools import cache

import pandas as pd

PATH = os.getenv("PORTFOLIO_PATH", "../../data/portfolio/positions.csv")
REQUIRED = ["position_id", "asset_class", "market_value"]
NUMERIC = {
    "market_value": 0.0,
    "notional": 0.0,
    "duration": 0.0,
    "convexity": 0.0,
    "spread_sensitivity": 0.0,
    "pd": 0.0,
    "lgd": 0.0,
    "beta": 1.0,
    "delta": 0.0,
}


@cache
def load_positions():
    df = pd.read_csv(PATH)
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"positions file is missing columns: {missing}")

    for column, default in NUMERIC.items():
        if column not in df:
            df[column] = default
        else:
            df[column] = pd.to_numeric(df[column], errors="coerce").fillna(default)

    if "currency" not in df:
        df["currency"] = "USD"
    df["currency"] = df["currency"].fillna("USD")
    df["asset_class"] = df["asset_class"].str.lower()
    return df.to_dict("records")
