# =============================================================================
# RiskPulse — single root Dockerfile with named build targets
#
# Usage (via docker-compose):
#   docker compose up --build
#
# Usage (manual):
#   docker build --target ai      -t riskpulse-ai      .
#   docker build --target quant   -t riskpulse-quant   .
#   docker build --target gateway -t riskpulse-gateway .
#   docker build --target ingestion -t riskpulse-ingestion .
#   docker build --target dashboard -t riskpulse-dashboard .
# =============================================================================


# ─── Shared base images ───────────────────────────────────────────────────────

FROM python:3.11-slim AS python-base
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

FROM node:20-alpine AS node-base


# ─── ai ───────────────────────────────────────────────────────────────────────

FROM python-base AS ai
WORKDIR /srv
COPY services/ai/requirements.txt ./
RUN uv pip install --system --no-cache --index-strategy unsafe-best-match -r requirements.txt
COPY services/ai/app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


# ─── quant ────────────────────────────────────────────────────────────────────

FROM python-base AS quant
WORKDIR /srv
COPY services/quant/requirements.txt ./
RUN uv pip install --system --no-cache -r requirements.txt
COPY services/quant/app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


# ─── gateway ──────────────────────────────────────────────────────────────────

FROM node-base AS gateway
WORKDIR /app
COPY services/gateway/package.json ./
RUN npm install --omit=dev
COPY services/gateway/src ./src
CMD ["node", "src/server.js"]


# ─── ingestion ────────────────────────────────────────────────────────────────

FROM node-base AS ingestion
WORKDIR /app
COPY services/ingestion/package.json ./
RUN npm install --omit=dev
COPY services/ingestion/src ./src
CMD ["node", "src/index.js"]


# ─── dashboard ────────────────────────────────────────────────────────────────

FROM node-base AS dashboard
WORKDIR /app
COPY apps/dashboard/package.json ./
RUN npm install
COPY apps/dashboard .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
