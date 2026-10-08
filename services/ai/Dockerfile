FROM python:3.11-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /srv

# Install dependencies using uv (fast, reproducible)
# --index-strategy unsafe-best-match needed because torch is on PyTorch index
COPY requirements.txt ./
RUN uv pip install --system --no-cache --index-strategy unsafe-best-match -r requirements.txt

COPY app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
