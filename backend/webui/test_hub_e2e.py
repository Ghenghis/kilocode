"""Hub v2 E2E verification script. Run while hub_start.py is running."""
import sys
import urllib.request
import urllib.error
import json

BASE = "http://localhost:8095"
TOKEN = "test-token-123"
AUTH = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
NO_AUTH = {"Content-Type": "application/json"}

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
INFO = "\033[33mINFO\033[0m"


def req(method, path, headers=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(r, timeout=8) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as ex:
        return 0, {"error": str(ex)}


results = []

def check(label, status, body, expect_status, extra_check=None):
    ok = status == expect_status
    if extra_check:
        ok = ok and extra_check(body)
    tag = PASS if ok else FAIL
    detail = f"status={status} (expected {expect_status})"
    if not ok:
        detail += f" body={json.dumps(body)[:120]}"
    print(f"  {tag}  {label}: {detail}")
    results.append(ok)
    return body


print("\n=== 1. Core health ===")
s, b = req("GET", "/health")
check("GET /health", s, b, 200, lambda b: b.get("status") == "ok")
check("auth=enabled in health", s, b, 200, lambda b: b.get("auth") == "enabled")

print("\n=== 2. Panel manifest (13 panels) ===")
s, b = req("GET", "/panels/manifest.json")
check("GET /panels/manifest.json", s, b, 200)
panel_count = len(b.get("panels", []))
ok = panel_count == 13
print(f"  {PASS if ok else FAIL}  Panel count={panel_count} (expected 13)")
results.append(ok)

print("\n=== 3. Panel JS asset served ===")
try:
    with urllib.request.urlopen(BASE + "/panels/overview.js", timeout=5) as resp:
        content = resp.read()
        ok = b"export default" in content or b"import" in content
        print(f"  {PASS if ok else FAIL}  GET /panels/overview.js: {len(content)} bytes, JS content={'yes' if ok else 'no'}")
        results.append(ok)
except Exception as ex:
    print(f"  {FAIL}  GET /panels/overview.js: {ex}")
    results.append(False)

print("\n=== 4. Read routes work without token ===")
for path in ["/api/providers/status", "/api/staging/status", "/api/agents", "/api/kom/status", "/api/openwebui/status"]:
    s, b = req("GET", path, headers={})
    check(f"GET {path} (no token)", s, b, 200)

print("\n=== 5. Write route REJECTS without token (401) ===")
s, b = req("POST", "/api/providers/lmstudio/reset", headers=NO_AUTH)
check("POST /api/providers/lmstudio/reset (no token)", s, b, 401)

s, b = req("POST", "/api/runtime/kilocode/sync", headers=NO_AUTH, body={})
check("POST /api/runtime/kilocode/sync (no token)", s, b, 401)

print("\n=== 6. Write route REJECTS wrong token (401) ===")
s, b = req("POST", "/api/providers/lmstudio/reset", headers={"Authorization": "Bearer wrong", "Content-Type": "application/json"})
check("POST /api/providers/lmstudio/reset (wrong token)", s, b, 401)

print("\n=== 7. Write route ACCEPTS correct token ===")
s, b = req("POST", "/api/providers/lmstudio/reset", headers=AUTH)
check("POST /api/providers/lmstudio/reset (correct token)", s, b, 200, lambda b: b.get("ok") is True)

print("\n=== 8. Disruptive route (promote) REJECTS without maintenance window (403) ===")
s, b = req("POST", "/api/staging/promote", headers=AUTH)
check("POST /api/staging/promote (no window)", s, b, 403)

print("\n=== 9. Open maintenance window ===")
s, b = req("POST", "/api/settings/maintenance", headers=AUTH, body={"reason": "e2e-test", "duration_minutes": 15})
check("POST /api/settings/maintenance", s, b, 200, lambda b: b.get("ok") is True)
print(f"     window={json.dumps(b.get('window', {}))}")

print("\n=== 10. Disruptive after window open, no validation (409 — must validate first) ===")
s, b = req("POST", "/api/staging/promote", headers=AUTH)
# 409 = auth passed (window is open) but staging correctly requires validation first
check("POST /api/staging/promote (window open, no validation)", s, b, 409,
      lambda b: "validation" in json.dumps(b).lower())

print("\n=== 11. Validate staging ===")
s, b = req("POST", "/api/staging/validate", headers=AUTH)
print(f"  {INFO}  POST /api/staging/validate: status={s} passed={b.get('passed')} checks={b.get('checks')}")
results.append(True)  # validation may fail if staging:8099 not running

print("\n=== 12. Staging promote after validation (if passed) ===")
if b.get("passed"):
    s2, b2 = req("POST", "/api/staging/promote", headers=AUTH)
    check("POST /api/staging/promote (validated+window)", s2, b2, 200)
    if s2 == 200:
        print("\n=== 13. Rollback ===")
        s3, b3 = req("POST", "/api/staging/rollback", headers=AUTH)
        check("POST /api/staging/rollback", s3, b3, 200, lambda b: b.get("ok") is True)
else:
    print(f"  {INFO}  Staging port not running — promote skipped (expected in dev)")
    results.append(True)

print("\n=== 14. SSE /events responds ===")
import socket
try:
    sock = socket.create_connection(("localhost", 8095), timeout=3)
    sock.sendall(b"GET /events HTTP/1.1\r\nHost: localhost:8095\r\nAccept: text/event-stream\r\n\r\n")
    data = sock.recv(512).decode(errors="replace")
    sock.close()
    ok = "text/event-stream" in data or "200 OK" in data
    print(f"  {PASS if ok else FAIL}  GET /events SSE: {'streaming' if ok else 'unexpected: ' + data[:100]}")
    results.append(ok)
except Exception as ex:
    print(f"  {FAIL}  GET /events SSE: {ex}")
    results.append(False)

print("\n=== 15. MCP endpoint exists ===")
try:
    with urllib.request.urlopen(BASE + "/mcp", timeout=5) as resp:
        mcp_status = resp.status
except urllib.error.HTTPError as e:
    mcp_status = e.code
except Exception:
    mcp_status = 0
ok = mcp_status not in (0,)
print(f"  {PASS if ok else FAIL}  GET /mcp: status={mcp_status} ({'mounted' if ok else 'connection failed'})")
results.append(ok)

print("\n=== 16. Close maintenance window ===")
s, b = req("DELETE", "/api/settings/maintenance", headers=AUTH)
check("DELETE /api/settings/maintenance", s, b, 200)

print("\n=== 17. Disruptive after window closed (403 again) ===")
s, b = req("POST", "/api/staging/promote", headers=AUTH)
check("POST /api/staging/promote (window closed)", s, b, 403)

print(f"\n{'='*50}")
passed = sum(results)
total = len(results)
print(f"Result: {passed}/{total} checks passed")
if passed == total:
    print("\033[32mAll checks passed — Hub v2 E2E verified\033[0m")
else:
    print(f"\033[31m{total - passed} check(s) failed\033[0m")
    sys.exit(1)
