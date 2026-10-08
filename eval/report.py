import json
from html import escape
from pathlib import Path

from app import config

RESULTS = Path(__file__).parent / "results"


def ci(value, interval):
    return f"{value:.3f} ({interval[0]:.3f} to {interval[1]:.3f})"


def num(value, digits=3):
    return "-" if value is None else f"{value:.{digits}f}"


def sections(s):
    out = []

    rows = [
        [r["dataset"], ci(r["macro_f1"], r["macro_f1_ci"]), num(r["accuracy"]),
         num(r["ece_before"]), num(r["ece_after"]), num(r["temperature"], 2), r.get("note", "")]
        for key, r in s.items() if key.startswith("sentiment_")
    ]
    if rows:
        out.append(("Sentiment and calibration", ["Dataset", "Macro-F1 (95% CI)", "Accuracy", "ECE before", "ECE after", "Temperature", "Note"], rows))

    event = s.get("event")
    if event:
        rows = [[name, ci(event[name]["macro_f1"], event[name]["macro_f1_ci"]), num(event[name]["accuracy"]), str(event["n_test"])]
                for name in ("embedding_head", "zero_shot") if name in event]
        out.append(("Event classification (time-based split)", ["Model", "Macro-F1 (95% CI)", "Accuracy", "Test items"], rows))

    ablation = s.get("ablation")
    if ablation:
        rows = [[mode, ci(m["event_macro_f1"], m["event_macro_f1_ci"]), num(m["sentiment_accuracy"]),
                 num(m["mean_ms"], 0), num(m["p95_ms"], 0), num(m["escalation_rate"], 2),
                 str(m["llm_calls"]), str(m["tokens"]), num(m["cost_per_item_usd"], 5)]
                for mode, m in ablation["modes"].items()]
        out.append(("Cascade ablation", ["Configuration", "Event macro-F1 (95% CI)", "Sentiment accuracy", "Mean ms", "p95 ms", "Escalated", "LLM calls", "Tokens", "Cost per item (USD)"], rows))

    cache = s.get("cache")
    if cache:
        row = min(cache["sweep"], key=lambda r: abs(r["threshold"] - config.CACHE_THRESHOLD))
        rows = [[mode.replace("_", " "), num(row[mode]["hit_rate"], 2), num(row[mode]["false_hit_rate"], 2)]
                for mode in ("similarity_only", "with_scope", "with_scope_and_guard")]
        out.append((f"Semantic cache at threshold {row['threshold']}", ["Variant", "Hit rate on true duplicates", "False-hit rate on flipped meaning"], rows))

    emb = s.get("embeddings")
    if emb:
        rows = [[name, num(v["auc"]), num(v["mean_same"]), num(v["mean_different"])]
                for name, v in emb.items() if name != "pairs"]
        out.append(("Embedding models on tricky pairs", ["Model", "AUC", "Mean similarity, same", "Mean similarity, different"], rows))

    retrieval = s.get("retrieval")
    if retrieval:
        rows = [[mode] + [num(retrieval[mode][f"recall@{k}"]) for k in (1, 3, 5)] for mode in ("bm25", "dense", "hybrid")]
        out.append(("Analog retrieval", ["Mode", "Recall@1", "Recall@3", "Recall@5"], rows))

    adv = s.get("adversarial")
    if adv:
        rows = [[k, f"{v['passed']} of {v['total']}", num(v["rate"], 2)] for k, v in adv["kinds"].items()]
        rows.append(["all", f"{adv['passed']} of {adv['total']}", num(adv["pass_rate"], 2)])
        out.append(("Adversarial suite", ["Attack type", "Passed", "Pass rate"], rows))

    leak = s.get("leakage")
    if leak:
        rows = [[name, str(leak[name]["n"]), num(leak[name]["accuracy"])] for name in ("before_cutoff", "after_cutoff")]
        rows.append(["gap", "", num(leak.get("gap"))])
        title = "Leakage probe" + ("" if leak["reliable"] else " (too few events per group to be reliable)")
        out.append((title, ["Group", "Events", "Direction accuracy"], rows))

    load = s.get("load")
    if load:
        rows = [["steady / burst rate (items per s)", f"{load['steady_rate']} / {load['burst_rate']}"],
                ["peak backlog", str(load["peak_backlog"])],
                ["drain time after publishing (s)", str(load["drain_seconds_after_publish"])],
                ["throughput (items per s)", str(load["throughput_per_s"])]]
        rows += [[f"{tier} latency p50 / p95 (ms)", f"{v['p50']} / {v['p95']}"] for tier, v in load["latency_ms"].items()]
        out.append(("Load test", ["Measure", "Value"], rows))
    return out


def reliability_svg(before, after, size=260):
    def points(bins):
        return " ".join(f"{p['confidence'] * size:.1f},{(1 - p['accuracy']) * size:.1f}" for p in bins)

    return (
        f'<svg viewBox="-30 -10 {size + 40} {size + 50}" width="320" role="img" aria-label="Reliability diagram">'
        f'<line x1="0" y1="{size}" x2="{size}" y2="0" stroke="#999" stroke-dasharray="4"/>'
        f'<polyline points="{points(before)}" fill="none" stroke="#b3261e" stroke-width="2"/>'
        f'<polyline points="{points(after)}" fill="none" stroke="#2457c5" stroke-width="2"/>'
        f'<text x="0" y="{size + 18}" font-size="11">confidence</text>'
        f'<text x="-26" y="12" font-size="11">accuracy</text>'
        f'<text x="0" y="{size + 34}" font-size="11" fill="#b3261e">before calibration</text>'
        f'<text x="120" y="{size + 34}" font-size="11" fill="#2457c5">after calibration</text></svg>'
    )


def build(summary):
    parts = sections(summary)
    md = ["# RiskPulse results\n"]
    page = [
        "<!doctype html><meta charset='utf-8'><title>RiskPulse results</title>",
        "<style>body{font:15px system-ui,sans-serif;max-width:1000px;margin:24px auto;padding:0 16px;color:#14213d}"
        "table{border-collapse:collapse;width:100%;margin:8px 0 28px}th,td{padding:6px 10px;border-bottom:1px solid #d6dce4;text-align:left}"
        "th{color:#5b677a;font-weight:500}h1{font-size:1.5rem}h2{font-size:1.05rem;margin:24px 0 0}</style>",
        "<h1>RiskPulse results</h1>",
    ]
    for title, headers, rows in parts:
        md.append(f"## {title}\n")
        md.append("| " + " | ".join(headers) + " |")
        md.append("|" + "---|" * len(headers))
        md += ["| " + " | ".join(r) + " |" for r in rows]
        md.append("")
        page.append(f"<h2>{escape(title)}</h2><table><tr>" + "".join(f"<th>{escape(h)}</th>" for h in headers) + "</tr>")
        page += ["<tr>" + "".join(f"<td>{escape(c)}</td>" for c in r) + "</tr>" for r in rows]
        page.append("</table>")
        if title.startswith("Sentiment"):
            for key, r in summary.items():
                if key.startswith("sentiment_") and r.get("reliability_before"):
                    page.append(f"<p>Reliability diagram, {escape(r['dataset'])}</p>" + reliability_svg(r["reliability_before"], r["reliability_after"]))
                    break
    (RESULTS / "report.md").write_text("\n".join(md))
    (RESULTS / "report.html").write_text("\n".join(page))


if __name__ == "__main__":
    build(json.loads((RESULTS / "summary.json").read_text()))
