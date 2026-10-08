import json
from pathlib import Path

from app import config
from eval import (
    ablation_eval,
    adversarial_eval,
    cache_eval,
    embeddings_eval,
    event_eval,
    leakage_probe,
    report,
    retrieval_eval,
    sentiment_eval,
)

RESULTS = Path(__file__).parent / "results"


def step(summary, key, label, fn):
    try:
        result = fn()
    except Exception as err:
        print(f"{label} skipped: {err}")
        return
    if result:
        summary[key] = result
        print(f"{label}: done")


def main():
    RESULTS.mkdir(exist_ok=True)
    summary = {}

    engine = None
    try:
        from app.pipeline.analyze import Engine

        engine = Engine()
        engine.load()
    except Exception as err:
        print(f"engine unavailable, engine-based steps will be skipped: {err}")

    if engine:
        sentiment_model = engine.sentiment
    else:
        from app.models.sentiment import SentimentModel

        sentiment_model = SentimentModel(config.SENTIMENT_MODEL, RESULTS / "no_calibration.json")

    for name in sentiment_eval.LOADERS:
        step(summary, f"sentiment_{name}", f"sentiment {name}", lambda n=name: sentiment_eval.evaluate(n, sentiment_model))

    chosen = summary.get("sentiment_fiqa") or summary.get("sentiment_phrasebank")
    if chosen:
        path = Path(config.ARTIFACTS_DIR) / "calibration.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"temperature": chosen["temperature"], "fit_on": chosen["dataset"]}))
        print(f"saved temperature {chosen['temperature']} to {path}")

    step(summary, "event", "event classification", event_eval.run)
    step(summary, "cache", "semantic cache", cache_eval.run)
    step(summary, "embeddings", "embedding models", embeddings_eval.run)
    if engine:
        step(summary, "retrieval", "analog retrieval", lambda: retrieval_eval.run(engine.embedder))
        step(summary, "ablation", "cascade ablation", lambda: ablation_eval.run(engine))
        step(summary, "leakage", "leakage probe", lambda: leakage_probe.run(engine.llm))
    step(summary, "adversarial", "adversarial suite", lambda: adversarial_eval.run(engine))

    load = RESULTS / "load.json"
    if load.exists():
        summary["load"] = json.loads(load.read_text())

    (RESULTS / "summary.json").write_text(json.dumps(summary, indent=2))
    report.build(summary)
    print(f"wrote {RESULTS / 'summary.json'}, report.md and report.html")


if __name__ == "__main__":
    main()
