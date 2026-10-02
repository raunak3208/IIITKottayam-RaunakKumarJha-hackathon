# RiskPulse

Real-time financial risk intelligence. Unstructured text goes in, structured risk signals come out, and a stress-testing module and dashboard consume them.

Pipeline: `news and Reddit -> ingestion -> AI risk engine -> signals -> gateway -> dashboard and stress testing`

## Run

```
cp .env.example .env
make clean
make up
```

`make clean` is needed once after upgrading from Phase 0, because the database schema gained a table. The first start downloads the language models (a few hundred MB, cached in a volume), so the AI service takes a few minutes to become ready. Open http://localhost:5173.

| Service | Port | Role |
|---|---|---|
| dashboard | 5173 | React UI |
| gateway | 3000 | REST and SSE API, stress-test trigger |
| ingestion | 3001 | News (RSS) and Reddit connectors |
| ai | 8000 | Risk engine: entity linking, FinBERT sentiment, event classification, impact score |
| quant | 8001 | Portfolio and stress engine |
| postgres, redis | 5432, 6379 | Storage and streams |

## Data flow

1. Ingestion polls the RSS feeds and Reddit, cleans and deduplicates items by content hash, and writes them to the `raw.items` stream.
2. The AI service links companies, scores sentiment with FinBERT, classifies the event with a zero-shot model, computes an impact score, and publishes a contract-validated signal to `signals.v1`.
3. The gateway stores each signal and streams it to the dashboard. If a signal matches a scenario trigger in `services/quant/app/scenarios/library.yaml`, it runs that stress scenario against the portfolio, with a cooldown per scenario.

Failed items go to `raw.dlq` and `signals.dlq`.

## API

- `GET /v1/signals`, `GET /v1/signals/stream` (SSE events `signal` and `stress`), `POST /v1/signals`
- `GET /v1/scenarios`, `GET /v1/portfolio`, `GET /v1/stress`, `POST /v1/stress/run`
- `POST` to the AI service `localhost:8000/v1/analyze` with `{"text": "...", "source": "news"}` to score any text directly
- `GET /health` on every service

## Portfolio

`data/portfolio/positions.csv` holds the positions (loans, bonds, equities, derivatives). Replace it with the provided sample transaction data mapped to the same columns.

## Contracts

`contracts/*.v1.schema.json` define the shared shapes. Check them with `npm install` then `make validate`.
