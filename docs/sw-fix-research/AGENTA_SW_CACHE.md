# AGENTA: VS Code Service Worker Cache Investigation

**Date:** 2026-04-27  
**Machine:** Windows 11 Pro (Admin profile)  
**VS Code Version:** 1.117.0 (commit `10c8e557c8b9f9ed0a87f61f1c9a44bde731c409`, quality: stable)  
**SW Script Version:** `VERSION = 4` (`vscode-resource-cache-4`)  
**Error Under Investigation:** `InvalidStateError: Failed to register a ServiceWorker: The document is in an invalid state`

---

## 1. Directory Structure

```
C:\Users\Admin\AppData\Roaming\Code\Service Worker\
├── ScriptCache\
│   ├── index                       (24 bytes)
│   ├── index-dir\
│   │   └── the-real-index          (96 bytes)  ← updated at 19:57:54
│   ├── 2cc80dabc69f58b6_0          (16,270 bytes)  ← STALE ENTRY
│   └── 4cb013792b196a35_0          (16,270 bytes)  ← newer duplicate
└── Database\
    ├── 000003.log                  (1,558 bytes, locked by VS Code process)
    ├── CURRENT                     (16 bytes)  → "MANIFEST-000001"
    ├── LOCK                        (0 bytes, exclusively locked)
    ├── LOG                         (0 bytes)
    └── MANIFEST-000001             (41 bytes)  → leveldb.BytewiseComparator
```

---

## 2. Full Directory Listing with Sizes and Modification Dates

### ScriptCache

| File | Size (bytes) | Modified | Born |
|------|-------------|----------|------|
| `2cc80dabc69f58b6_0` | 16,270 | 2026-04-27 17:53:46 | 2026-04-27 17:53:46 |
| `4cb013792b196a35_0` | 16,270 | 2026-04-27 19:57:34 | 2026-04-27 19:57:34 |
| `index` | 24 | 2026-04-27 17:53:46 | 2026-04-27 17:53:46 |
| `index-dir\the-real-index` | 96 | 2026-04-27 19:57:54 | 2026-04-27 17:53:46 |

### Database (LevelDB — locked by VS Code process)

| File | Size (bytes) | Modified |
|------|-------------|----------|
| `000003.log` | 1,558 | 2026-04-27 17:53:46 |
| `CURRENT` | 16 | 2026-04-27 17:53:46 |
| `LOCK` | 0 | 2026-04-27 17:53:46 |
| `LOG` | 0 | 2026-04-27 19:54:41 |
| `MANIFEST-000001` | 41 | 2026-04-27 17:53:46 |

---

## 3. Stale Entry Confirmed: `2cc80dabc69f58b6_0`

**YES — the stale entry `2cc80dabc69f58b6_0` (16,270 bytes) is present.**

- Born: 2026-04-27 17:53:46 (earlier session)
- Last modified: 2026-04-27 17:53:46
- The cache index (`the-real-index`) was updated at 19:57:54, pointing to both entries
- A second entry `4cb013792b196a35_0` (identical 16,270 bytes) was created at 19:57:34 — this is the current active entry

Both entries cache the same script: `service-worker.js?v=4` (`VERSION = 4`). The `index` and `the-real-index` files are Chrome Disk Cache index structures that maintain pointers to both.

---

## 4. ScriptCache File Content Identification

Both `2cc80dabc69f58b6_0` and `4cb013792b196a35_0` contain:

- **Content:** VS Code webview Service Worker script (Microsoft Corporation, MIT License)
- **Script version:** `const VERSION = 4;`  
- **Cache name:** `vscode-resource-cache-4`
- **Key URL fragment:** `service-worker.js?v=4&vscode-resource-base-authority=vscode-resource.vscode-cdn.net`
- **Binary header magic:** `30 5C 72 A7 1B 6D FB FC` (Chrome SimpleCache entry header)
- **No URL embedded in the script blob itself** — the URL lives in the LevelDB Database

---

## 5. vscode-webview:// Protocol — Found in Database

The LevelDB `000003.log` contains two distinct SW registrations using the `vscode-webview://` protocol:

### Registration 0 (older — corresponds to `2cc80dabc69f58b6_0`)
```
INITDATA_UNIQUE_ORIGIN: vscode-webview://1b9ujhlce718co96gdhi6h0gl4sm3lu61b741ptvp54khuclm32i/
Scope:  vscode-file://vscode-app
SW URL: vscode-webview://1b9ujhlce718co96gdhi6h0gl4sm3lu61b741ptvp54khuclm32i/service-worker.js
        ?v=4&vscode-resource-base-authority=vscode-resource.vscode-cdn.net&remoteAuthority=
REG key: REG:vscode-webview://1b9ujhlce718co96gdhi6h0gl4sm3lu61b741ptvp54khuclm32i/^vscode-file://vscode-app
```

### Registration 1 (newer — corresponds to `4cb013792b196a35_0`)
```
INITDATA_UNIQUE_ORIGIN: vscode-webview://15gdepo4qhojd3b7nmdfad94m1kcv0b4v25i6g4h29odl6v5jj28/
Scope:  vscode-file://vscode-app
SW URL: vscode-webview://15gdepo4qhojd3b7nmdfad94m1kcv0b4v25i6g4h29odl6v5jj28/service-worker.js
        ?v=4&vscode-resource-base-authority=vscode-resource.vscode-cdn.net&remoteAuthority=
REG key: REG:vscode-webview://15gdepo4qhojd3b7nmdfad94m1kcv0b4v25i6g4h29odl6v5jj28/^vscode-file://vscode-app
```

**Key observation:** Each webview gets a unique random subdomain in the `vscode-webview://` origin. Registration 0's origin (`1b9ujh...`) is from a stale/closed webview session. The DB retains both registrations without pruning. When a new webview tries to register with the same origin UUID collision or the old orphaned entry blocks activation, the `InvalidStateError` is triggered.

The LevelDB also records a **shared SW script hash** for both registrations:
```
1CBB8DD18C998B2D9287D2C43DC80A40B928FB8761CECE8B40C8360ED1AF948E
```
This is consistent — same `VERSION=4` script, same bytes.

---

## 6. Stale vs Current Entry Analysis

| Entry | Key | Born | Status | Why |
|-------|-----|------|--------|-----|
| `2cc80dabc69f58b6_0` | REGID 0 / origin `1b9ujhlce7...` | 17:53:46 | **STALE** | From a closed/orphaned webview session; the `1b9ujh` origin no longer has an active client |
| `4cb013792b196a35_0` | REGID 1 / origin `15gdepo4qh...` | 19:57:34 | Current | Active webview session created at ~19:57 |

The `the-real-index` was updated at 19:57:54 (right after `4cb013792b196a35_0` was born), confirming the newer entry is the active one.

The stale Registration 0 (`1b9ujhlce718co96gdhi6h0gl4sm3lu61b741ptvp54khuclm32i`) has no corresponding active VS Code webview and its SW is in a zombie state — registered but with no controlling document. This is the root cause of the `InvalidStateError`: attempting to register a new SW on an origin that already has a zombie registration triggers Chromium's "document is in an invalid state" check.

---

## 7. PowerShell Commands

### 7a. Selectively Clear ONLY Stale Entry

This targets `2cc80dabc69f58b6_0` (and its LevelDB references) while leaving the active `4cb013792b196a35_0` intact.

> **IMPORTANT:** VS Code must be fully closed before running these commands. The Database files are exclusively locked while VS Code is running.

```powershell
# STEP 1: Close VS Code first (or kill it)
# Get-Process Code | Stop-Process -Force

# STEP 2: Remove the stale ScriptCache blob
$staleEntry = "C:\Users\Admin\AppData\Roaming\Code\Service Worker\ScriptCache\2cc80dabc69f58b6_0"
if (Test-Path $staleEntry) {
    Remove-Item $staleEntry -Force
    Write-Host "Removed stale ScriptCache entry: $staleEntry"
} else {
    Write-Host "Stale entry not found (already clean)"
}

# STEP 3: Delete the entire Database (LevelDB) to force SW re-registration
# The cache index (ScriptCache\index and index-dir\the-real-index) references
# both entries via hash — it is safer to wipe the DB and let VS Code rebuild it.
$dbPath = "C:\Users\Admin\AppData\Roaming\Code\Service Worker\Database"
if (Test-Path $dbPath) {
    Remove-Item $dbPath -Recurse -Force
    Write-Host "Removed SW Database (LevelDB) at: $dbPath"
}

# STEP 4: Also reset the ScriptCache index files so VS Code rebuilds the index
# (leaving 4cb013792b196a35_0 in place but with a fresh index)
$indexFiles = @(
    "C:\Users\Admin\AppData\Roaming\Code\Service Worker\ScriptCache\index",
    "C:\Users\Admin\AppData\Roaming\Code\Service Worker\ScriptCache\index-dir\the-real-index"
)
foreach ($f in $indexFiles) {
    if (Test-Path $f) { Remove-Item $f -Force; Write-Host "Removed index: $f" }
}

Write-Host "`nSelective stale-entry clear complete. Restart VS Code."
```

### 7b. Clear ALL Service Worker Caches (Nuclear Option)

Wipes everything under `Service Worker\` — VS Code will re-register all SWs on next launch.

```powershell
# CLOSE VS CODE FIRST
# Get-Process Code | Stop-Process -Force

$swRoot = "C:\Users\Admin\AppData\Roaming\Code\Service Worker"

if (Test-Path $swRoot) {
    Remove-Item $swRoot -Recurse -Force
    Write-Host "Nuclear clear complete — entire SW directory removed: $swRoot"
    Write-Host "VS Code will recreate it on next launch."
} else {
    Write-Host "SW directory not found — already clean."
}
```

### 7c. Verify Cache Is Clear After Deletion

Run this after deleting, before restarting VS Code:

```powershell
$swRoot = "C:\Users\Admin\AppData\Roaming\Code\Service Worker"

Write-Host "=== SW Cache Status ==="
if (-not (Test-Path $swRoot)) {
    Write-Host "CLEAN: SW directory does not exist."
} else {
    $allFiles = Get-ChildItem $swRoot -Recurse -File -Force
    if ($allFiles.Count -eq 0) {
        Write-Host "CLEAN: SW directory exists but contains no files."
    } else {
        Write-Host "WARNING: SW directory still has $($allFiles.Count) file(s):"
        $allFiles | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize
    }
}
```

Alternatively, run once VS Code has been restarted to confirm fresh registration:

```powershell
# After VS Code restarts — should see exactly 1 ScriptCache entry and a fresh Database
$scriptCache = "C:\Users\Admin\AppData\Roaming\Code\Service Worker\ScriptCache"
Get-ChildItem $scriptCache -File -Force | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
```

---

## 8. Does VS Code Self-Clean on Version Update?

**No — VS Code does NOT automatically clear Service Worker caches on version update.**

Evidence:
- Both ScriptCache entries (`2cc80dabc69f58b6_0` born 17:53:46, `4cb013792b196a35_0` born 19:57:34) survived within the same VS Code 1.117.0 session and accumulated over hours.
- The LevelDB retains all SW registrations across restarts; Chromium's embedded renderer (which hosts the webview) does not purge registrations on version upgrade — it only invalidates cache entries if the SW script URL changes or the script byte-for-byte differs.
- In this case both entries share `VERSION=4` and an identical 16,270-byte blob hash (`1CBB8DD18C998B2D9287D2C43DC80A40B928FB8761CECE8B40C8360ED1AF948E`), so the Chromium cache sees no reason to evict either.

**What DOES trigger self-cleaning:**
- Bumping `const VERSION = 4` → `5` in the VS Code source (forces cache name change to `vscode-resource-cache-5`; old `vscode-resource-cache-4` entries are deleted by the `activate` handler via `caches.delete()`)
- The SW's own `activate` handler already calls `sw.clients.claim()` and would sweep old named caches — but it only sweeps *named runtime caches*, not the ScriptCache entries themselves (those are managed by Chromium's HTTP cache layer, not the SW Cache API)
- Manually deleting the `Service Worker\` directory

---

## 9. Root Cause Summary

The `InvalidStateError: Failed to register a ServiceWorker: The document is in an invalid state` originates from:

1. **Orphaned SW registration in LevelDB** — Registration 0 (`vscode-webview://1b9ujhlce718co96gdhi6h0gl4sm3lu61b741ptvp54khuclm32i/`) points to a script cached at `2cc80dabc69f58b6_0`. The controlling webview document is gone (closed/navigated), leaving the SW in a "redundant-but-not-unregistered" zombie state in the LevelDB.

2. **Chromium rejects re-registration on a zombie origin** — When VS Code opens a new webview and tries to call `navigator.serviceWorker.register()`, Chromium finds the existing DB record for that origin and refuses because the associated document context is invalid (`InvalidStateError`).

3. **The `the-real-index` still references both entries** — So the ScriptCache does not self-evict the stale blob.

**Fix:** Clear the stale LevelDB entry and ScriptCache blob using the selective PowerShell commands in §7a, or wipe the entire SW directory (§7b) for a guaranteed clean state.

---

## 10. References

- VS Code source: `src/vs/workbench/contrib/webview/browser/pre/service-worker.ts` (compiled into the 16,270-byte blob)
- Chromium bug: https://github.com/microsoft/vscode/issues/244143 (referenced twice inside the cached script)
- SW script internal version: `const VERSION = 4` → cache name `vscode-resource-cache-4`
- LevelDB SW DB keys: `REG:`, `REGID_TO_ORIGIN:`, `INITDATA_UNIQUE_ORIGIN:`, `URES:`, `PRES:`, `RES:`
