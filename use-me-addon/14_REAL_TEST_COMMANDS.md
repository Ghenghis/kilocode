# Real Test Commands

## Static syntax audit
```bash
python -m compileall src tests
```

## Marker audit
```bash
python tools/audit_v17_markers.py --root .
```

## Local pytest
```bash
pytest tests -q
```

## Boot gate drill
```bash
bash deploy/scripts/run_boot_gate.sh
bash deploy/scripts/run_repair_drill.sh
```

## Playwright
```bash
pytest tests/e2e -q
```

## VPS verification
```bash
bash deploy/scripts/verify_stack.sh
```
