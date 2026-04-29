"""Test KiloCode agents integration with Hub v2."""
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
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as ex:
        return 0, {"error": str(ex)}


def test_kilocode_cli_bridge():
    """Test the KiloCode CLI bridge endpoints."""
    print("\n=== Testing KiloCode CLI Bridge ===")
    
    # Test KiloCode agent status
    s, b = req("GET", "/api/agents/kilo/status", headers=AUTH)
    if s == 200:
        print(f"  {PASS}  KiloCode agent status: {s}")
        print(f"  {INFO}  Found {len(b.get('agents', []))} agents")
        for agent in b.get('agents', [])[:3]:  # Show first 3
            print(f"    - {agent.get('id', 'unknown')}: {agent.get('status', 'unknown')}")
    else:
        print(f"  {FAIL}  KiloCode agent status: {s} - {b.get('error', 'unknown')}")
        print(f"  {INFO}  This is expected if KiloCode CLI is not built")
        return False
    
    # Test KiloCode sessions
    s, b = req("GET", "/api/agents/kilo/sessions", headers=AUTH)
    if s == 200:
        print(f"  {PASS}  KiloCode sessions: {s}")
    else:
        print(f"  {FAIL}  KiloCode sessions: {s}")
    
    return True


def test_mock_agents_fallback():
    """Test that mock agents still work as fallback."""
    print("\n=== Testing Mock Agents Fallback ===")
    
    # Test mock agents list
    s, b = req("GET", "/api/agents", headers=AUTH)
    ok = s == 200 and "agents" in b and len(b["agents"]) > 0
    print(f"  {PASS if ok else FAIL}  Mock agents list: {s} ({len(b.get('agents', []))} agents)")
    
    # Test mock agent assignment
    s, b = req("POST", "/api/agents/kc-01/assign", headers=AUTH, body={"task": "test task"})
    ok = s == 200 and b.get("ok") is True
    print(f"  {PASS if ok else FAIL}  Mock agent assignment: {s}")
    
    # Test mock agent release
    s, b = req("POST", "/api/agents/kc-01/release", headers=AUTH)
    ok = s == 200 and b.get("ok") is True
    print(f"  {PASS if ok else FAIL}  Mock agent release: {s}")
    
    return ok


def test_agents_panel():
    """Test the agents panel functionality."""
    print("\n=== Testing Agents Panel ===")
    
    # Test that agents panel loads
    s, b = req("GET", "/panels/agents.js")
    ok = s == 200 and len(b) > 1000  # Should be substantial JS content
    print(f"  {PASS if ok else FAIL}  Agents panel JS: {s} ({len(b)} bytes)")
    
    # Test panel manifest includes agents
    s, b = req("GET", "/panels/manifest.json")
    ok = s == 200 and any(p.get("id") == "agents" for p in b.get("panels", []))
    print(f"  {PASS if ok else FAIL}  Agents in manifest: {s}")
    
    return ok


def main():
    """Run all KiloCode agents tests."""
    print("\n" + "="*60)
    print("Hub v2 — KiloCode Agents Integration Test Suite")
    print("="*60)
    
    results = []
    
    # Test CLI bridge (may fail if CLI not built)
    results.append(test_kilocode_cli_bridge())
    
    # Test mock agents fallback
    results.append(test_mock_agents_fallback())
    
    # Test agents panel
    results.append(test_agents_panel())
    
    # Summary
    print("\n" + "="*60)
    passed = sum(results)
    total = len(results)
    print(f"Result: {passed}/{total} test groups passed")
    
    if passed == total:
        print("\n✅ All agents integration tests passed!")
        print("\nAgent Status:")
        print("- Mock agents: Working (fallback)")
        print("- KiloCode CLI bridge: Connected" if results[0] else "- KiloCode CLI bridge: Not available (CLI not built)")
        print("\nTo use actual KiloCode agents:")
        print("1. Build KiloCode CLI: cd G:/Github/kilocode-Azure2 && bun run build")
        print("2. Restart Hub v2")
        print("3. Agents panel will show real KiloCode agents")
    else:
        print(f"\n❌ {total - passed} test group(s) failed")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
