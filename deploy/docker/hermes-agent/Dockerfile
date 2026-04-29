# ── Hermes Agent — extends existing hermes-agent with contract-kit src ───────
# Base: the same image currently running on VPS as hermes1-5
FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Install hermes-agent dependencies first (from hermes-agent repo)
COPY requirements-agent.txt ./
RUN pip install --no-cache-dir -r requirements-agent.txt

# Copy contract-kit source modules
COPY src/ ./src/

# Copy hermes-agent source from repo
COPY hermes-agent-src/ ./hermes_agent/

# Config directory (mounted at runtime)
RUN mkdir -p /app/config /root/.hermes/skills

# Non-root is impractical here — agent needs git + ssh
EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENV AGENT_ID=hermes1
ENV AGENT_ROLE=planning_strategist
ENV NATS_URL=nats://nats:4222
ENV RUNTIME_URL=http://runtime-core:8000

CMD ["python", "-m", "uvicorn", "src.hermes.gateway_server:app", \
     "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
