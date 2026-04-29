# 35 — Docker and Container Discipline

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run. Container images derived from such pushes are equally invalid and must not be tagged, signed, or published.

Containers are the execution surface for the Hub backend (Python FastAPI in `contract-kit-v17`), for several Hermes service variants, and — via upstream `zeroclawlabs` v0.6.0 — for ZeroClaw build/runtime images. The VPS at `187.77.30.206` (Ubuntu 24.04) is the only sanctioned production host.

## Threat model

1. Mutable base-image tag rot. `python:3.12-slim` today is not the same bytes as next week.
2. Secrets baked into image layers. `COPY .env .` and `ENV API_KEY=...` survive in image history.
3. Privileged container blast radius. `--privileged` and bind-mounts of `/` give kernel-level reach.
4. Compose-file drift between dev and prod. Dev compose using `:latest` accidentally promoted to prod.
5. Unscanned vulnerabilities. CVEs published after build, undetected because no scan ran.
6. Forged or unsigned image manifests.

## Image pinning policy

Every `FROM` reference in production MUST pin to an immutable digest, not a tag.

```dockerfile
# WRONG
FROM python:3.12-slim
# RIGHT
FROM python:3.12-slim@sha256:8f3a8b8e0d4d0f5c7e8a2b1c9d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e
```

Re-pinning cadence:
- **Monthly baseline**: scheduled task pulls each base's `:tag`, records digest, opens a PR if changed. PR carries `deps` label (doc 27); rebuilds + scans every dependent image.
- **On CVE**: `trivy`/`grype` flags HIGH or CRITICAL → re-pin within 72 hours.
- **Frozen during release**: no base bumps inside an active `release/*` branch.

Pinned digest list at `infra/docker/PINNED_DIGESTS.md`.

## Multi-stage build pattern

### Hub (Python FastAPI)

```dockerfile
# syntax=docker/dockerfile:1.7
ARG PY_BUILDER_DIGEST=sha256:<pin>
ARG PY_RUNTIME_DIGEST=sha256:<pin>

FROM python:3.12-slim@${PY_BUILDER_DIGEST} AS builder
WORKDIR /build
COPY pyproject.toml poetry.lock ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir poetry==1.8.3 && \
    poetry export --without-hashes --format=requirements.txt > requirements.txt && \
    pip wheel --wheel-dir=/wheels -r requirements.txt
COPY src/ ./src/

FROM gcr.io/distroless/python3-debian12@${PY_RUNTIME_DIGEST} AS runtime
WORKDIR /app
COPY --from=builder /wheels /wheels
COPY --from=builder /build/src /app/src
USER nonroot
ENV PYTHONPATH=/app PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz').read()"]
LABEL org.opencontainers.image.source="https://github.com/Ghenghis/contract-kit-v17"
ENTRYPOINT ["python", "-m", "uvicorn", "src.webui.hub.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Kilo VSIX builder (Bun)

```dockerfile
# syntax=docker/dockerfile:1.7
ARG BUN_DIGEST=sha256:<pin>
ARG WOLFI_DIGEST=sha256:<pin>

FROM oven/bun:1.1@${BUN_DIGEST} AS builder
WORKDIR /src
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
COPY . .
RUN bun run build:vsix

FROM cgr.dev/chainguard/wolfi-base@${WOLFI_DIGEST} AS runtime
WORKDIR /out
COPY --from=builder /src/packages/kilo-vscode/*.vsix /out/
USER nonroot
LABEL org.opencontainers.image.source="https://github.com/Ghenghis/contract-kit-v17"
```

### ZeroClaw (Rust)

Upstream ships `Dockerfile`, `Dockerfile.ci`, `Dockerfile.debian` (per doc 30). Production runtime is distroless static:

```dockerfile
# syntax=docker/dockerfile:1.7
ARG RUST_DIGEST=sha256:<pin>
ARG STATIC_DIGEST=sha256:<pin>

FROM rust:1.82@${RUST_DIGEST} AS builder
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/build/target \
    cargo build --release --locked && \
    cp target/release/zeroclaw /zeroclaw

FROM gcr.io/distroless/static-debian12@${STATIC_DIGEST} AS runtime
COPY --from=builder /zeroclaw /usr/local/bin/zeroclaw
USER nonroot
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["/usr/local/bin/zeroclaw", "healthcheck"]
LABEL org.opencontainers.image.source="https://github.com/zeroclawlabs/zeroclaw"
ENTRYPOINT ["/usr/local/bin/zeroclaw"]
```

## Distroless / hardened base preference

| Workload | Preferred runtime base |
|---|---|
| Python services (Hub, Hermes-py) | `gcr.io/distroless/python3-debian12@sha256:...` |
| Static binaries (Rust, Go) | `gcr.io/distroless/static-debian12@sha256:...` |
| General-purpose / glibc-sensitive | `cgr.dev/chainguard/wolfi-base@sha256:...` |
| Node runtime services | `cgr.dev/chainguard/node@sha256:...` |

**Forbidden as runtime bases**: `ubuntu:latest`, `debian:latest`, `alpine:latest` (any `:latest`), `python:3.12` (full image), any image lacking digest.

## Dockerfile checklist

- `FROM` pinned to digest.
- `USER nonroot` (or numeric UID >= 10000) in runtime stage.
- `--mount=type=cache` for every package manager invocation.
- No secrets in `ENV` or `RUN`. No `COPY .env*`. Build-time secrets via `--mount=type=secret`, never `--build-arg`.
- `HEALTHCHECK` for any long-running service.
- `LABEL org.opencontainers.image.source="<repo URL>"`.
- `LABEL org.opencontainers.image.revision="<commit-sha>"` at build.
- SBOM via `syft <image> -o cyclonedx-json` attached as attestation.
- `.dockerignore` reviewed.
- Multi-stage; only runtime stage tagged.

## .dockerignore minimum baseline

```
.git
.gitignore
.env
.env.*
.envrc
node_modules
__pycache__
*.pyc
.venv
venv
dist
build
*.log
.claude
.evidence
.pytest_cache
.mypy_cache
.ruff_cache
target
coverage
*.pem
*.key
*.crt
id_rsa*
*.tfstate
*.tfstate.backup
```

`.git` is non-negotiable — without it, full history (including any historical secrets) ends up in build context.

## Build provenance

Same regime as VSIX (doc 23):

1. Built only from `release/*` branch via `.github/workflows/publish-image.yml`. Branch-gate identical to VSIX.
2. Image manifest signed: `cosign sign --yes ghcr.io/ghenghis/contract-kit-hub@sha256:<digest>`
3. SLSA build provenance via `actions/attest-build-provenance@v1` with `subject-name` set to image ref. Stored as OCI referrer.
4. SBOM (CycloneDX, `syft`) as separate attestation: `cosign attest --type cyclonedx --predicate sbom.json <image-ref>`.
5. Verification before deploy:
   ```bash
   cosign verify --certificate-identity-regexp '.*release/.+' \
     --certificate-oidc-issuer https://token.actions.githubusercontent.com \
     ghcr.io/ghenghis/contract-kit-hub@sha256:<digest>
   ```

## Compose file conventions

Two compose files, never mixed:
- `docker-compose.yml` — production. Every `image:` is a digest. Used for VPS deploy.
- `docker-compose.dev.yml` — local dev. May reference tags. NEVER deployed to VPS.

```yaml
# docker-compose.yml (prod)
services:
  hub:
    image: ghcr.io/ghenghis/contract-kit-hub@sha256:abcd...
    restart: unless-stopped
    read_only: true
    cap_drop: ["ALL"]
    security_opt: ["no-new-privileges:true"]
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 512M }
    healthcheck:
      test: ["CMD", "/usr/local/bin/healthcheck.sh"]
      interval: 30s
      timeout: 5s
      retries: 3
    secrets:
      - hub_db_password
secrets:
  hub_db_password:
    file: /etc/contract-kit/secrets/hub_db_password
```

Mixing tag-based and digest-based references in prod is forbidden (CI failure).

## Secret mounting

- **Docker secrets (preferred for prod)**: files mounted at `/run/secrets/<name>` at runtime. Never in image. Compose `secrets:` block + external file path on VPS at `/etc/contract-kit/secrets/` (mode 0600).
- **Env file at runtime via `--env-file`**: acceptable for non-production. Outside image, outside build context, NEVER `COPY`'d.
- **FORBIDDEN**: `COPY .env`, `ENV API_KEY=...`, `--build-arg SECRET=...`.

Build-time secrets via BuildKit:
```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm install --frozen-lockfile
```

## Resource limits

Every service in `docker-compose.yml` MUST declare CPU + memory limits.

```yaml
deploy:
  resources:
    limits: { cpus: "1.0", memory: 512M }
    reservations: { cpus: "0.25", memory: 128M }
```

Starting points: Hub `1.0 CPU / 512M`, ZeroClaw `0.5 CPU / 256M`, Hermes `0.5 CPU / 256M`. Tune from `docker stats` over 7-day window.

## Rebuild cadence

- **Weekly**: scheduled task pulls each base's current `:tag`, records digest, rebuilds even if digest unchanged.
- **On CVE**: HIGH/CRITICAL CVE on pinned base or dep → rebuild within 72h. PR carries `security` label.
- **Pre-release**: every release branch triggers `--no-cache` rebuild.

Registered in `scheduled-tasks` so it survives maintainer rotation.

## Forbidden patterns

CI-failures and merge-blockers:

1. `:latest` tag in `docker-compose.yml` (prod) or any production Dockerfile `FROM`.
2. `--privileged` containers anywhere except documented, time-boxed debug.
3. Bind-mounting `/` or any host root path.
4. `USER root` in runtime stage.
5. Baking `*.pem`, `*.key`, `*.crt`, `id_rsa*`, `.env*` into image layers.
6. `ADD <url>` from arbitrary HTTP sources.
7. `docker run --network host` in production.
8. Multiple services in one container ("fat container").
9. Disabling `HEALTHCHECK` to silence a flapping probe.

## Image-vulnerability scanning

```bash
trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed \
  ghcr.io/ghenghis/contract-kit-hub@sha256:<digest>

grype ghcr.io/ghenghis/contract-kit-hub@sha256:<digest> \
  --fail-on high --only-fixed
```

Release gate: any HIGH/CRITICAL fixable vuln blocks signing/push. Two escape hatches require operator approval:
1. **Documented exception**: vuln in unreachable code path. Recorded at `infra/docker/CVE_EXCEPTIONS.md` with CVE ID, image ref, justification, expiry (max 30 days).
2. **Upstream-unfixed**: no fix available. Same exception file; expiry tracks upstream ETA.

Scan results stored at `<EVIDENCE_ROOT>/container-scans/<image-ref>/<date>/` per doc 23.

## Cross-references

- doc 23 — Release provenance and auto-update.
- doc 27 — Secrets and supply-chain hardening.
- doc 31 — VPS deployment topology.
- doc 32 — CI/CD blueprint.

## TL;DR

1. `FROM` pins to `@sha256:...`. Never tags. Re-pin monthly or on CVE.
2. Multi-stage build. Distroless or Wolfi runtime. `USER nonroot`.
3. No secrets in layers. Docker secrets at runtime; BuildKit secret mounts at build.
4. `.dockerignore` excludes `.git`, `.env*`, keys, caches.
5. Cosign-sign every image. SLSA attestation. SBOM via `syft`.
6. `docker-compose.yml` (prod) is digests-only. `docker-compose.dev.yml` may use tags. Never mix.
7. `trivy` + `grype` scan before sign. HIGH/CRITICAL fixable = block.
8. Resource limits + healthchecks on every service.
9. `--privileged`, `:latest` in prod, root user, baked-in keys: forbidden.
10. Weekly rebuild from pinned base. CVE rebuild within 72h.
