# RiskPulse results

## Sentiment and calibration

| Dataset | Macro-F1 (95% CI) | Accuracy | ECE before | ECE after | Temperature | Note |
|---|---|---|---|---|---|---|
| phrasebank | 0.964 (0.952 to 0.974) | 0.974 | 0.058 | 0.007 | 0.60 | FinBERT was fine-tuned on this dataset, so the score is optimistic |

## Event classification (time-based split)

| Model | Macro-F1 (95% CI) | Accuracy | Test items |
|---|---|---|---|
| zero_shot | 0.000 (0.000 to 0.000) | 0.000 | 1 |

## Cascade ablation

| Configuration | Event macro-F1 (95% CI) | Sentiment accuracy | Mean ms | p95 ms | Escalated | LLM calls | Tokens | Cost per item (USD) |
|---|---|---|---|---|---|---|---|---|
| tier1_only | 0.000 (0.000 to 0.000) | 0.000 | 8280 | 8280 | 0.00 | 0 | 0 | 0.00000 |
| llm_only | 1.000 (1.000 to 1.000) | 0.000 | 6000 | 6000 | 1.00 | 0 | 0 | 0.00000 |
| cascade | 0.000 (0.000 to 0.000) | 0.000 | 11702 | 11702 | 1.00 | 0 | 0 | 0.00000 |

## Semantic cache at threshold 0.92

| Variant | Hit rate on true duplicates | False-hit rate on flipped meaning |
|---|---|---|
| similarity only | 0.60 | 0.00 |
| with scope | 0.60 | 0.00 |
| with scope and guard | 0.60 | 0.00 |

## Embedding models on tricky pairs

| Model | AUC | Mean similarity, same | Mean similarity, different |
|---|---|---|---|
| bge-small-en-v1.5 | 0.978 | 0.920 | 0.850 |
| all-MiniLM-L6-v2 | 0.356 | 0.827 | 0.882 |

## Adversarial suite

| Attack type | Passed | Pass rate |
|---|---|---|
| injection | 19 of 19 | 1.00 |
| flip | 12 of 12 | 1.00 |
| quote | 8 of 8 | 1.00 |
| parse | 9 of 9 | 1.00 |
| pipeline | 1 of 10 | 0.10 |
| all | 49 of 58 | 0.84 |
