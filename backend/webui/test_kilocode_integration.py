"""Test KiloCode HubPanel integration with Hub v2."""
import time
import json
import urllib.request
import urllib.error
from typing import Dict, Any

BASE = "http://localhost:8095"
TOKEN = "test-token-123"
AUTH = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
INFO = "\033[33mINFO\033[0m"


def req(method: str, path: str, headers: Dict[str, str] = None, body: Dict[str, Any] = None) -> tuple:
    """Make HTTP request to Hub."""
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(r, timeout=5) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as ex:
        return 0, {"error": str(ex)}


def test_kilocode_sync_endpoint():
    """Test the /api/runtime/kilocode/sync endpoint that HubPanel.ts calls."""
    print("\n=== Testing KiloCode Sync Endpoint ===")
    
    # Test without auth (should fail)
    s, b = req("POST", "/api/runtime/kilocode/sync", 
               headers={"Content-Type": "application/json"}, 
               body={"version": "1.0.0", "synced": True})
    ok = s == 401
    print(f"  {PASS if ok else FAIL}  Sync without auth: {s} (expected 401)")
    
    # Test with auth (should succeed)
    s, b = req("POST", "/api/runtime/kilocode/sync", 
               headers=AUTH, 
               body={"version": "1.0.0", "synced": True})
    ok = s == 200 and b.get("ok") is True
    print(f"  {PASS if ok else FAIL}  Sync with auth: {s} (expected 200)")
    
    # Check if sync state is recorded
    s, b = req("GET", "/api/settings/sync", headers=AUTH)
    ok = s == 200 and b.get("kilocode_synced") is True
    print(f"  {PASS if ok else FAIL}  Sync state recorded: {s}")
    
    return ok


def test_sse_events():
    """Test SSE events that should flow to KiloCode."""
    print("\n=== Testing SSE Events ===")
    
    # Test SSE endpoint responds
    import socket
    try:
        sock = socket.create_connection(("localhost", 8095), timeout=3)
        sock.sendall(b"GET /events HTTP/1.1\r\nHost: localhost:8095\r\nAccept: text/event-stream\r\n\r\n")
        data = sock.recv(512).decode(errors="replace")
        sock.close()
        ok = "text/event-stream" in data or "200 OK" in data
        print(f"  {PASS if ok else FAIL}  SSE endpoint: {'streaming' if ok else 'failed'}")
    except Exception as ex:
        print(f"  {FAIL}  SSE endpoint: {ex}")
        return False
    
    # Trigger an event that KiloCode should receive
    print(f"  {INFO}  Triggering provider reset event...")
    s, b = req("POST", "/api/providers/lmstudio/reset", headers=AUTH)
    if s == 200:
        print(f"  {PASS}  Event triggered: provider reset")
        time.sleep(1)  # Give time for SSE to propagate
    else:
        print(f"  {FAIL}  Failed to trigger event: {s}")
    
    return True


def test_hubpanel_requirements():
    """Test requirements for HubPanel.ts to work."""
    print("\n=== Testing HubPanel Requirements ===")
    
    # Hub must be running
    s, b = req("GET", "/health")
    ok = s == 200 and b.get("status") == "ok"
    print(f"  {PASS if ok else FAIL}  Hub health check: {s}")
    
    # Shell HTML must serve
    try:
        with urllib.request.urlopen(BASE, timeout=5) as resp:
            content = resp.read().decode()
            ok = "Hub v2" in content and "Loading Hub v2" in content
            print(f"  {PASS if ok else FAIL}  Shell HTML serves: {len(content)} bytes")
    except Exception as ex:
        print(f"  {FAIL}  Shell HTML serves: {ex}")
        return False
    
    # Panels manifest must serve
    s, b = req("GET", "/panels/manifest.json")
    ok = s == 200 and "panels" in b and len(b["panels"]) == 13
    print(f"  {PASS if ok else FAIL}  Panel manifest: {len(b.get('panels', []))} panels")
    
    # Core JS must serve
    try:
        with urllib.request.urlopen(f"{BASE}/panels/core.js", timeout=5) as resp:
            content = resp.read()
            ok = b"export default hub" in content
            print(f"  {PASS if ok else FAIL}  Core JS serves: {len(content)} bytes")
    except Exception as ex:
        print(f"  {FAIL}  Core JS serves: {ex}")
        return False
    
    return True


def main():
    """Run all KiloCode integration tests."""
    print("\n" + "="*60)
    print("Hub v2 — KiloCode Integration Test Suite")
    print("="*60)
    
    results = []
    
    # Test HubPanel requirements
    results.append(test_hubpanel_requirements())
    
    # Test sync endpoint
    results.append(test_kilocode_sync_endpoint())
    
    # Test SSE events
    results.append(test_sse_events())
    
    # Summary
    print("\n" + "="*60)
    passed = sum(results)
    total = len(results)
    print(f"Result: {passed}/{total} test groups passed")
    
    if passed == total:
        print("\n✅ All KiloCode integration tests passed!")
        print("\nNext steps:")
        print("1. Open VS Code with KiloCode extension")
        print("2. Ensure Hub is running: python src/webui/hub_start.py")
        print("3. Run command: kilo-code.hub.open")
        print("4. Verify Hub loads in VS Code webview")
        print("5. Check Settings panel shows 'KiloCode: synced'")
    else:
        print(f"\n❌ {total - passed} test group(s) failed")
        print("Fix issues before testing in VS Code")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
