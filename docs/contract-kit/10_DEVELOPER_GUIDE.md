# 10 — Developer Guide

Standards, tooling, and workflow for contributing to the KiloCode Contract Kit v17 ecosystem.

---

## Code Standards

### Python

- **Style:** PEP 8, enforced via `ruff` (replaces flake8 + isort)
- **Type hints:** Required on all public functions and class methods
- **Docstrings:** Google-style for all public classes and functions
- **Max line length:** 100 characters

```bash
# Lint
ruff check src/ tests/

# Format
ruff format src/ tests/

# Type check
mypy src/ --strict
```

### TypeScript (Playwright tests, VSIX)

- **Style:** ESLint + Prettier
- **Target:** ES2020, strict mode
- **Max line length:** 120 characters

```bash
npx eslint tests/e2e/ src/kilocode/
npx prettier --check tests/e2e/ src/kilocode/
```

---

## Automated Repair Framework

The project includes a code quality framework that detects and auto-repairs common issues:

### Linting Autofix
```bash
# Auto-fix all fixable ruff issues
ruff check src/ tests/ --fix

# Format in place
ruff format src/ tests/
```

### Pre-commit Hooks

Install hooks (runs linting + syntax check on every commit):
```bash
pip install pre-commit
pre-commit install
```

`.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: check-ast
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-json
      - id: check-yaml
```

---

## Event Handling Rules

All UI buttons in `hub.html` must follow this pattern:

```javascript
document.getElementById('btn-example').addEventListener('click', async () => {
  try {
    const result = await call('POST', '/api/some/endpoint', {key: 'value'});
    if (result.error) throw new Error(result.error);
    // update UI
    appendLog('panel-log', `Success: ${result.status}`);
  } catch (err) {
    appendLog('panel-log', `Error: ${err.message}`);
    console.error('btn-example failed:', err);
  }
});
```

**Rules:**
- Never use inline `onclick` attributes
- Always use `addEventListener`
- Always wrap `call()` in try/catch
- Always log result to panel log
- Always handle `result.error` field

---

## Debugging System

### Backend Logging

All `src/` Python files use the standard logger pattern:
```python
import logging
logger = logging.getLogger(__name__)

logger.debug("Debug detail: %s", value)
logger.info("Operation completed: %s", operation)
logger.warning("Degraded mode: %s", reason)
logger.error("Failed: %s", error, exc_info=True)
```

**Never use `print()` in production code.** Use `logger.*` instead.

### Log Levels per Environment

| Environment | Log Level | Config |
|-------------|-----------|--------|
| Development | `DEBUG` | `LOG_LEVEL=DEBUG` env var |
| Staging | `INFO` | `LOG_LEVEL=INFO` |
| Production (VPS) | `WARNING` | `LOG_LEVEL=WARNING` |

### Viewing Logs
```bash
# systemd service logs
journalctl -u kilocode-webui -n 100 --no-pager
journalctl -u kilocode-runtime -f

# Docker container logs
docker logs hermes1 -f --tail 100

# Set debug level at runtime (dashboard.py)
POST /api/maintenance/set-log-level  {"level": "DEBUG"}
```

### Common Error Patterns + Fixes

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `RuntimeError: asyncio.create_task` outside loop | `ZeroClawGateway` instantiated outside async context | Use individual adapters; do not instantiate `ZeroClawGateway` directly |
| `TypeError: Can't instantiate abstract class` | Trying to use `ZeroClawAdapter` directly | Use a concrete adapter: `GitAdapter`, `ShellAdapter`, etc. |
| `CircuitBreaker OPEN` on all providers | All providers failing health probe | Check API keys in `.env`; check LM Studio/Ollama running |
| Hub shows all red dots | `dashboard.py` cannot reach services | Verify services running on correct ports; check UFW rules |
| `drift > 0` in VSIX pane | Settings desync | Click `syncRuntimeSettings` command button or call `POST /runtime/kilocode/cmd` |

---

## Code Quality Metrics

Track these metrics and maintain thresholds:

| Metric | Tool | Threshold |
|--------|------|-----------|
| Test coverage | `pytest --cov` | ≥ 80% |
| Lint errors | `ruff check` | 0 errors |
| Type errors | `mypy --strict` | 0 errors |
| Stub functions | `grep "pass  # STUB"` | 0 matches |
| Cyclomatic complexity | `ruff --select C90` | ≤ 10 per function |

```bash
# Full quality check (run before PR)
ruff check src/ tests/ && \
ruff format --check src/ tests/ && \
mypy src/ --strict && \
pytest tests/ --cov=src --cov-fail-under=80 && \
! grep -r "pass  # STUB" src/ && \
echo "Quality check passed"
```

---

## Git Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, all gates must pass |
| `develop` | Integration branch |
| `feature/<name>` | Feature development |
| `fix/<name>` | Bug fixes |
| `hotfix/<name>` | Production hotfixes (branch from main) |

### Commit Message Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

Examples:
```
feat(webui): add KiloCode sync status panel to VSIX pane
fix(zeroclaw): add abstract enforcement to ZeroClawAdapter
docs(architecture): regenerate all SVG diagrams
test(hermes): add 35 unit tests for all adapter classes
```

### PR Checklist

Before opening a PR:
- [ ] All 6 acceptance gates pass (see [docs/07_TESTING_GUIDE.md](07_TESTING_GUIDE.md))
- [ ] Ruff lint: 0 errors
- [ ] mypy: 0 errors
- [ ] No `pass  # STUB` in `src/`
- [ ] New endpoints added to [docs/09_API_REFERENCE.md](09_API_REFERENCE.md)
- [ ] SVG diagrams updated if architecture changed

---

## Adding a New API Endpoint

1. Add handler to appropriate service file (`dashboard.py`, `core.py`, etc.)
2. Add type hints and docstring
3. Add to [docs/09_API_REFERENCE.md](09_API_REFERENCE.md) — method, path, body, description
4. Add unit test in `tests/unit/test_webui_control_center.py` (or appropriate test file)
5. Add Playwright test in `tests/e2e/test_hub_playwright.ts` if endpoint is UI-facing
6. Wire panel JS function in `hub.html` if adding new UI capability

---

## Adding a New SVG Diagram

1. Create `docs/diagrams/<NN>_<name>.svg` following the dark-theme palette:
   - Background: `#0f172a`
   - Blue services: `#1e3a5f` / `#3b82f6`
   - Green services: `#1f3720` / `#22c55e`
   - Orange services: `#2d1b1b` / `#f97316`
   - Purple: `#1c1c2d` / `#818cf8`
2. Embed in relevant `.md` with `<img src="diagrams/<name>.svg" width="100%"/>`
3. Reference from `ARCHITECTURE.md` with a brief section explaining the diagram

---

## Technical Debt Tracker

| Item | File | Priority |
|------|------|---------|
| `ZeroClawGateway` async init | `src/zeroclaw/adapters.py` | Medium |
| SSH adapter not implemented | `src/zeroclaw/adapters.py` | Low |
| Docker adapter not implemented | `src/zeroclaw/adapters.py` | Low |
| `task_fanout()` synchronous only | `src/hermes/orchestrator.py` | Low |
| `validation()` substring-match only | `src/hermes/orchestrator.py` | Medium |
| Integration tests: stubs only | `tests/integration/` | High |
| KiloCode inference engine | `src/kilocode/settings/` | Low |

---

## See Also

- [docs/07_TESTING_GUIDE.md](07_TESTING_GUIDE.md) — all test commands
- [docs/09_API_REFERENCE.md](09_API_REFERENCE.md) — endpoint reference
- [ARCHITECTURE.md](../ARCHITECTURE.md) — system architecture
