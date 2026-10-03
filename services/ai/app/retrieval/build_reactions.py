import json
from datetime import datetime, timedelta
from pathlib import Path

from app import config


def reactions(dates, closes, event_date):
    index = next((i for i, d in enumerate(dates) if d >= event_date), None)
    if index is None or index == 0:
        return None
    base = closes[index - 1]
    out = {"reaction_1d_pct": round((closes[index] / base - 1) * 100, 2)}
    if index + 4 < len(closes):
        out["reaction_5d_pct"] = round((closes[index + 4] / base - 1) * 100, 2)
    return out


def main():
    import yfinance as yf

    path = Path(config.ANALOGS_PATH)
    events = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    filled = 0
    for event in events:
        day = datetime.strptime(event["date"], "%Y-%m-%d")
        try:
            history = yf.Ticker(event["symbol"]).history(
                start=day - timedelta(days=10), end=day + timedelta(days=15), auto_adjust=True
            )
            dates = [d.strftime("%Y-%m-%d") for d in history.index]
            result = reactions(dates, history["Close"].tolist(), event["date"])
        except Exception as err:
            print(f"{event['id']} {event['symbol']}: {err}")
            continue
        if result:
            event.update(result)
            filled += 1
        else:
            print(f"{event['id']} {event['symbol']}: no price data")

    path.write_text("\n".join(json.dumps(e) for e in events) + "\n")
    print(f"filled reactions for {filled} of {len(events)} events")


if __name__ == "__main__":
    main()
