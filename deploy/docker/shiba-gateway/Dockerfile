# ── Shiba Memory Gateway — FastAPI + asyncpg memory store ───────────────────
#
# Build context: repository root (so we can COPY backend/shiba/ into the image
# without mounting a giant context). Invoke as:
#
#     docker build \
#         -f deploy/docker/shiba-gateway/Dockerfile \
#         -t contract-kit/shiba-gateway:latest \
#         .
#
# This mirrors deploy/vps/build_and_push.sh's pattern for hermes-gateway.

FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Requirements first to maximise layer cache reuse.
COPY deploy/docker/shiba-gateway/requirements-shiba.txt ./
RUN pip install --no-cache-dir -r requirements-shiba.txt

# Code goes under /app/backend/shiba so `python -m uvicorn backend.shiba.gateway_server:app`
# resolves correctly inside the container. We deliberately do NOT copy the rest
# of backend/ — its top-level __init__.py imports unrelated modules (e.g.
# integration/) that would baloon the image and require extra deps.
COPY backend/shiba/ ./backend/shiba/

# Provide an empty backend/__init__.py so Python treats backend as a package
# without pulling in the repo's full tree.
RUN echo '' > ./backend/__init__.py

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

EXPOSE 18789

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:18789/health || exit 1

CMD ["python", "-m", "uvicorn", "backend.shiba.gateway_server:app", \
     "--host", "0.0.0.0", "--port", "18789", "--workers", "1", \
     "--log-level", "info"]
