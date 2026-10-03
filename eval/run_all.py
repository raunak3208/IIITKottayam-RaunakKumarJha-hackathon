import json
from pathlib import Path

from app import config
from app.models.sentiment import SentimentModel
from eval import cache_eval, event_eval, sentiment_eval

RESULTS = Path(__file__).parent / "results"


def main():
    RESULTS.mkdir(exist_ok=True)
    summary = {}

    model = SentimentModel(config.SENTIMENT_MODEL, RESULTS / "no_calibration.json")
    for name in sentiment_eval.LOADERS:
        try:
            result = sentiment_eval.evaluate(name, model)
        except Exception as err:
            print(f"sentiment {name} skipped: {err}")
            continue
        summary[f"sentiment_{name}"] = result
        print(
            f"sentiment {name}: macro-F1 {result['macro_f1']} {result['macro_f1_ci']} "
            f"accuracy {result['accuracy']} ECE {result['ece_before']} -> {result['ece_after']} "
            f"(T={result['temperature']}) {result['note']}"
        )

    chosen = summary.get("sentiment_fiqa") or summary.get("sentiment_phrasebank")
    if chosen:
        path = Path(config.ARTIFACTS_DIR) / "calibration.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"temperature": chosen["temperature"], "fit_on": chosen["dataset"]}))
        print(f"saved temperature {chosen['temperature']} to {path}")

    events = event_eval.run()
    if events:
        summary["event"] = events
        for name in ("embedding_head", "zero_shot"):
            if name in events:
                r = events[name]
                print(f"event {name}: macro-F1 {r['macro_f1']} {r['macro_f1_ci']} accuracy {r['accuracy']}")

    cache = cache_eval.run()
    if cache:
        summary["cache"] = cache
        for row in cache["sweep"]:
            print(
                f"cache threshold {row['threshold']}: "
                + " | ".join(
                    f"{m} hit {row[m]['hit_rate']} false {row[m]['false_hit_rate']}"
                    for m in cache_eval.MODES
                )
            )

    (RESULTS / "summary.json").write_text(json.dumps(summary, indent=2))
    print(f"wrote {RESULTS / 'summary.json'}")


if __name__ == "__main__":
    main()
