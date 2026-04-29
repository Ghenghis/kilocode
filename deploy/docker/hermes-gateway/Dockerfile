# ── Hermes Gateway — FastAPI orchestration gateway ───────────────────────────
FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-hermes.txt ./
RUN pip install --no-cache-dir -r requirements-hermes.txt

COPY src/ ./src/

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "src.hermes.gateway_server:app", \
     "--host", "0.0.0.0", "--port", "8000", "--workers", "2", \
     "--log-level", "info"]
