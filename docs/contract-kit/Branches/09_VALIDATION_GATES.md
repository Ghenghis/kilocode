# Validation Gates

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## Universal gates
Every feature branch must pass:

```bash
git status --short --branch
git diff --check
git diff --name-status upstream/main...HEAD || git diff --name-status upstream/master...HEAD
git log --oneline --decorate --max-count=30
```

## Secret scan gate
Run at minimum:

```bash
git grep -n -I -E "(api[_-]?key|secret|token|password|passwd|bearer|private[_-]?key|BEGIN RSA|BEGIN OPENSSH|BEGIN PRIVATE)" HEAD -- .
```

If tools are available, also run gitleaks/trufflehog. If secrets are found, stop and remediate before pushing.

## Project-specific validation discovery
Do not invent commands. Discover from files:

- `package.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `package-lock.json`
- `pyproject.toml`
- `requirements.txt`
- `Cargo.toml`
- `go.mod`
- `Makefile`
- `Dockerfile`
- `docker-compose.yml`
- `.github/workflows/*`

## Common validation examples
Node/TypeScript projects:

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

PNPM projects:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Python projects:

```bash
python -m pip install -r requirements.txt
python -m pytest
python -m compileall .
```

Docker projects:

```bash
docker compose config
docker compose build
```

## Pass/fail rule
If the upstream clean base already fails, document it as baseline failure and prove the feature branch does not make it worse. If the feature branch introduces new failures, status is BLOCKED.
