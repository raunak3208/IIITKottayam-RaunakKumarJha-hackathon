import json
from datetime import datetime, timedelta, timezone
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


def fetch_history(symbol, start_dt, end_dt):
    try:
        import requests

        sym = symbol.replace(".", "-")
        p1 = int(start_dt.timestamp())
        p2 = int(end_dt.timestamp())
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{sym}?period1={p1}&period2={p2}&interval=1d"
        res = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            timeout=6,
        )
        if res.status_code != 200:
            return [], []
        data = res.json()
        result = data.get("chart", {}).get("result")
        if not result:
            return [], []
        timestamps = result[0].get("timestamp", [])
        quote = result[0].get("indicators", {}).get("quote", [{}])[0]
        closes = quote.get("close", [])
        dates, clean_closes = [], []
        for ts, c in zip(timestamps, closes):
            if c is not None:
                dates.append(datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d"))
                clean_closes.append(float(c))
        return dates, clean_closes
    except Exception:
        return [], []


def main():
    path = Path(config.ANALOGS_PATH)
    events = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    filled = 0
    for event in events:
        day = datetime.strptime(event["date"], "%Y-%m-%d")
        try:
            dates, closes = fetch_history(event["symbol"], day - timedelta(days=10), day + timedelta(days=15))
            result = reactions(dates, closes, event["date"]) if dates else None
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
