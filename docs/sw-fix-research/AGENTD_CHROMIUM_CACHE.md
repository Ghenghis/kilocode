# AGENTD — Chromium/Electron Cache Investigation
## VS Code `%APPDATA%\Code\` Electron-Level State

**Investigation date:** 2026-04-27  
**VS Code version:** 1.117.0  
**Target question:** Does IndexedDB hold stale SW registrations that cause `InvalidStateError`?

---

## 1. Complete Directory Tree — `%APPDATA%\Code\`

```
C:\Users\Admin\AppData\Roaming\Code\
├── Azure Accounts\              # VS Code extension data (Azure auth tokens)
├── Backups\                     # Auto-save backup files
├── blob_storage\
│   └── 512b0c9f-0784-4629-ad04-b7f19afbe737\   # Blob UUID partition
├── Cache\                       # HTTP response cache (~8 MB, 35 items)
├── CachedConfigurations\        # Workspace config cache (5 items, 0.5 KB)
├── CachedData\                  # V8 compiled bytecode cache (236 items, ~65 MB)
├── CachedExtensionVSIXs\        # Downloaded extension VSIX packages
├── CachedProfilesData\          # Profile data cache (3 items, ~3 MB)
├── Code Cache\
│   ├── js\                      # JS bytecode (index + index-dir/the-real-index)
│   └── wasm\                    # WASM bytecode (index + index-dir/the-real-index)
├── Crashpad\                    # Crash dump metadata
├── DawnGraphiteCache\           # WebGPU Dawn pipeline cache (data_0..3, index)
├── DawnWebGPUCache\             # WebGPU cache variant (data_0..3, f_000001, index)
├── GPUCache\                    # Chromium GPU shader cache (data_0..3, index)
├── Local Storage\
│   └── leveldb\                 # LevelDB — extension/webview local storage
│       ├── 000003.log           # Active WAL (~17 KB, updated 2026-04-27)
│       ├── CURRENT
│       ├── LOCK
│       ├── LOG / LOG.old
│       └── MANIFEST-000001
├── logs\                        # VS Code diagnostic logs
├── Network\
│   ├── Cookies                  # SQLite — session cookies (28 KB)
│   ├── Cookies-journal          # SQLite WAL (empty)
│   ├── Network Persistent State # JSON — HSTS/QUIC/server hints (18 KB)
│   ├── NetworkDataMigrated      # Migration sentinel (empty)
│   ├── TransportSecurity        # HSTS preload state (11 KB)
│   ├── Trust Tokens             # SQLite — Privacy Pass tokens (36 KB)
│   └── Trust Tokens-journal     # SQLite WAL (empty)
├── Service Worker\
│   ├── Database\                # LevelDB — SW REGISTRATION DATABASE  <-- KEY
│   │   ├── 000003.log           # Active WAL (3112 bytes, locked by Code.exe)
│   │   ├── CURRENT
│   │   ├── LOCK
│   │   ├── LOG / LOG.old        # (both empty — compaction ran cleanly)
│   │   └── MANIFEST-000001
│   └── ScriptCache\             # Disk cache — cached SW JS files
│       ├── 2cc80dabc69f58b6_0   # SW script body #1 (16270 bytes)
│       ├── 4cb013792b196a35_0   # SW script body #2 (16270 bytes)
│       ├── index                # Cache index (24 bytes)
│       └── index-dir\
│           └── the-real-index   # Disk-cache manifest (72 bytes)
├── Session Storage\             # LevelDB — per-session key/value store
│   ├── 000005.ldb .. 000037.ldb # Compacted SST tables (stale sessions present)
│   ├── 000036.log               # Active WAL (23 KB, updated 2026-04-27)
│   ├── CURRENT / LOCK
│   ├── LOG / LOG.old
│   └── MANIFEST-000001          # Dates back to 2/28/2025
├── Shared Dictionary\           # Brotli shared compression dict (SQLite + disk cache)
├── shared_proto_db\             # Chromium protobuf database (LevelDB)
│   └── metadata\
├── User\                        # VS Code settings, keybindings, extensions list
├── VideoDecodeStats\            # Hardware video decode performance stats
├── WebStorage\                  # Origin-partitioned Web Storage (3.27 GB, 12917 items!)
├── Workspaces\                  # Workspace metadata
├── code.lock                    # PID lock file
├── DIPS                         # Bounce-tracking protection data
├── languagepacks.json           # Installed language pack registry
├── Local State                  # Chromium local state (DPAPI-encrypted OS crypt key)
├── machineid                    # VS Code telemetry machine ID
├── Preferences                  # Chromium preferences JSON
└── SharedStorage                # Chrome Shared Storage API data
```

**Key observation:** There is NO `IndexedDB\` directory under `%APPDATA%\Code\`. Chromium in Electron/VS Code does NOT use the `IndexedDB` backend for Service Worker registrations. Instead, SW registrations are stored in the **`Service Worker\Database\` LevelDB** (a dedicated store, separate from the DOM-level IndexedDB API). This is intentional Chromium architecture.

---

## 2. Service Worker Registration State — Deep Analysis

### 2a. SW Database (LevelDB) — Active Registrations

File: `C:\Users\Admin\AppData\Roaming\Code\Service Worker\Database\000003.log`  
Status: **LOCKED** by running `Code.exe` (normal — it is live)

Decoded content confirms **2 active SW registrations**:

| Field | Registration 0 | Registration 1 |
|-------|---------------|---------------|
| **REGID** | 0 | 1 |
| **Origin** | `vscode-webview://1b9ujhlce718co96gdhi6h0gl4sm3lu61b741ptvp54khuclm32i/` | `vscode-webview://15gdepo4qhojd3b7nmdfad94m1kcv0b4v25i6g4h29odl6v5jj28/` |
| **Scope** | `vscode-webview://<id>/` (root) | `vscode-webview://<id>/` (root) |
| **Script URL** | `vscode-webview://<id>/service-worker.js?v=4&vscode-resource-base-authority=vscode-resource.vscode-cdn.net&remoteAuthority=` | same pattern |
| **Parent origin** | `vscode-file://vscode-app` | `vscode-file://vscode-app` |
| **INITDATA_UNIQUE_ORIGIN** | present | present |
| **Script version (v=)** | **4** | **4** |

Raw LevelDB key types present:
- `INITDATA_NEXT_REGISTRATION_ID` — counter = **2** (two registrations ever created)
- `INITDATA_NEXT_VERSION_ID` — counter = **2**
- `INITDATA_NEXT_RESOURCE_ID` — counter = **2**
- `INITDATA_DB_VERSION` — version = **2**
- `REG:<origin>` — registration record
- `REGID_TO_ORIGIN:<id>` — reverse lookup
- `URES:<id>` — unstored resource (script URL reference)
- `PRES:<id>` — pending resource
- `RES:<id>` — resource record

### 2b. ScriptCache — Cached SW Scripts

Two cached script files, both 16270 bytes (identical script, different origin):

| File | Size | Content |
|------|------|---------|
| `2cc80dabc69f58b6_0` | 16270 bytes | Microsoft VSCode webview service-worker.js |
| `4cb013792b196a35_0` | 16270 bytes | Microsoft VSCode webview service-worker.js |

Both files begin with the standard VS Code copyright header and `/// <reference lib="webworker" />` — they are the **real installed script**, not corrupted. The script file contains `VERSION = 4`, matching the registered `?v=4` URLs.

**Conclusion on staleness:** The registered version (v=4) MATCHES the currently installed VS Code 1.117.0 service-worker.js (which also declares `VERSION = 4`). The registrations are not stale in terms of version mismatch. However, the **two separate `vscode-webview://` origins** represent two distinct webview instances (identified by long random hex IDs in the hostname). These are opaque origins assigned per webview panel — registrations from old/closed webview panels accumulate and are never cleaned up.

### 2c. Session Storage — Stale LDB Files

The Session Storage LevelDB contains `.ldb` files dating back to **April 2025** (12+ months old), indicating compacted session data from old VS Code sessions that was never purged:

```
000005.ldb   2025-04-17  (12+ months stale)
000029.ldb   2025-12-22
000031.ldb   2025-12-22
000034.ldb   2026-02-04
000037.ldb   2026-03-29
000036.log   2026-04-27  (current)
```

---

## 3. How SW Registrations Are Stored — ScriptCache vs Database vs Both

Chromium uses **two separate stores** for a Service Worker registration:

```
Service Worker Registration
         │
         ├── Service Worker\Database\   (LevelDB)
         │   ├── Registration metadata  ← origin, scope, script URL, state flags
         │   ├── REGID ↔ ORIGIN maps
         │   └── Resource URL records   ← URL of SW script (NOT the script body)
         │
         └── Service Worker\ScriptCache\  (Disk Cache / SimpleCache format)
             ├── <hash>_0               ← actual JS script body bytes
             └── index + index-dir\     ← disk-cache manifest (URL→hash map)
```

**Key distinction:**
- The **Database** is the authoritative registration registry. It controls whether a SW is "registered" from Chromium's perspective. An `InvalidStateError` on `register()` originates here when Chromium rejects a duplicate or conflicting registration.
- The **ScriptCache** is purely a performance cache. Deleting it forces a network/file re-fetch of the SW script on next registration but does NOT remove the registration itself.
- Chromium does **not** use the DOM-level `IndexedDB` API for SW registrations. The `Service Worker\Database\` LevelDB is a private internal store, not accessible via `window.indexedDB`.

**Why `InvalidStateError` occurs:**
The `InvalidStateError` on `navigator.serviceWorker.register()` in VS Code webviews typically happens when:
1. A SW registration exists for the origin but the **SW script URL has changed** (e.g. `?v=3` → `?v=4`) and the update check is mid-flight or stalled.
2. The registration is in a **redundant** state (old SW still "installed", new one activating) and the calling context is destroyed before completion.
3. Two webview instances with the **same opaque origin** attempt concurrent registration (rare but possible with VS Code's per-panel origin assignment scheme).

---

## 4. PowerShell Commands to Clear SW State

**IMPORTANT: Close VS Code completely before running any of these commands.**

### 4a. Clear Only the SW Registration Database (targeted fix)

```powershell
# Close VS Code first!
$swDb = "$env:APPDATA\Code\Service Worker\Database"
if (Test-Path $swDb) {
    Remove-Item $swDb -Recurse -Force
    Write-Host "Cleared: $swDb"
}
```

This deletes all service worker registrations. On next VS Code start, VS Code will re-register the SW from scratch via `navigator.serviceWorker.register()`.

### 4b. Clear SW Registration Database + ScriptCache (recommended)

```powershell
$swRoot = "$env:APPDATA\Code\Service Worker"
if (Test-Path $swRoot) {
    Remove-Item $swRoot -Recurse -Force
    Write-Host "Cleared all SW state: $swRoot"
}
```

### 4c. Clear Session Storage (remove stale LDB files)

```powershell
$ss = "$env:APPDATA\Code\Session Storage"
if (Test-Path $ss) {
    Remove-Item $ss -Recurse -Force
    Write-Host "Cleared Session Storage: $ss"
}
```

### 4d. Clear IndexedDB (not applicable here)

There is **no `IndexedDB\` directory** under `%APPDATA%\Code\`. VS Code does not maintain a Chromium-style `IndexedDB\` folder. If you see this suggested elsewhere it does not apply to VS Code's Electron build.

---

## 5. Complete Nuclear Clear Script — All Chromium-Level Caches

This script clears every Chromium-level cache except user settings, extensions, and workspaces.

```powershell
# =============================================================
# VS Code Chromium Cache Nuclear Clear
# Run with VS Code FULLY CLOSED
# =============================================================

$appdata = $env:APPDATA
$codePath = "$appdata\Code"

# Verify VS Code is not running
$codeProc = Get-Process "Code" -ErrorAction SilentlyContinue
if ($codeProc) {
    Write-Error "VS Code is still running! Close it first."
    exit 1
}

$targets = @(
    # Service Worker (registrations + script cache) — FIXES InvalidStateError
    "$codePath\Service Worker",

    # HTTP response cache
    "$codePath\Cache",

    # V8 bytecode / JS + WASM compiled code cache
    "$codePath\Code Cache",
    "$codePath\CachedData",

    # GPU shader pipeline caches
    "$codePath\GPUCache",
    "$codePath\DawnGraphiteCache",
    "$codePath\DawnWebGPUCache",

    # Session / Local / Shared storage (LevelDB stores)
    "$codePath\Session Storage",
    "$codePath\Local Storage",

    # Blob storage partitions
    "$codePath\blob_storage",

    # Origin-partitioned web storage (WARNING: 3.27 GB on this machine!)
    "$codePath\WebStorage",

    # Shared protobuf DB
    "$codePath\shared_proto_db",

    # Shared Dictionary (Brotli compression)
    "$codePath\Shared Dictionary",

    # Network state: HSTS, QUIC hints, Trust Tokens
    "$codePath\Network",

    # Video stats
    "$codePath\VideoDecodeStats",

    # DIPS (bounce tracking)
    "$codePath\DIPS"
)

$totalCleared = 0
foreach ($target in $targets) {
    if (Test-Path $target) {
        $size = (Get-ChildItem $target -Recurse -ErrorAction SilentlyContinue |
                 Measure-Object -Property Length -Sum).Sum
        Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
        $mb = [Math]::Round($size / 1MB, 1)
        $totalCleared += $size
        Write-Host "  CLEARED  $target  ($mb MB)"
    } else {
        Write-Host "  SKIP     $target  (not found)"
    }
}

$totalMB = [Math]::Round($totalCleared / 1MB, 1)
Write-Host "`nTotal cleared: $totalMB MB"
Write-Host "Done. Start VS Code to rebuild caches from scratch."
```

**What this preserves (NOT deleted):**
- `User\` — settings.json, keybindings, snippets, extension list
- `Workspaces\` — workspace metadata
- `Backups\` — auto-save backups
- `logs\` — diagnostic logs
- `CachedExtensionVSIXs\` — downloaded extension packages (optional to keep)
- `CachedConfigurations\` — workspace config cache (tiny, safe to keep)
- `Azure Accounts\` — Azure auth tokens
- `Local State` — Chromium OS crypt key (DPAPI-encrypted; clearing would break cookie decryption)
- `Preferences` — Chromium preferences
- `machineid` — VS Code telemetry ID

---

## 6. Would Clearing IndexedDB Alone Fix the `InvalidStateError`?

**Short answer: There is no IndexedDB to clear — it does not exist in this VS Code installation.**

**Long answer:**

The `Service Worker\Database\` LevelDB is what matters, and it is NOT the same as the DOM-level `IndexedDB` API. They are completely separate storage mechanisms:

| Storage | Path | API | Used for SW? |
|---------|------|-----|-------------|
| SW Registration DB | `Service Worker\Database\` LevelDB | Internal Chromium C++ | YES — registration metadata |
| SW Script Cache | `Service Worker\ScriptCache\` | SimpleCache | YES — JS script body |
| DOM IndexedDB | `IndexedDB\` LevelDB | `window.indexedDB` JS API | NO (not present in this install) |
| Local Storage | `Local Storage\leveldb\` | `window.localStorage` | NO |

**To fix `InvalidStateError`:**

Clearing `Service Worker\Database\` (the SW registration LevelDB) **will fix** `InvalidStateError` caused by:
- Stale registrations for dead `vscode-webview://` origins
- Registrations in broken/redundant state
- Version mismatch between registered script URL and new install

Clearing **only** the ScriptCache will NOT fix `InvalidStateError` because the registration entries in the Database are still present and still govern what Chromium accepts during `register()`.

**Recommended minimal fix:**

```powershell
# Targeted fix — clears SW registrations only
Remove-Item "$env:APPDATA\Code\Service Worker" -Recurse -Force
```

This is safe and reversible — VS Code recreates the entire `Service Worker\` tree on next launch.

**Current state assessment:**

The two active registrations found in this investigation are for **v=4**, which matches the installed VS Code 1.117.0 (`VERSION = 4`). The registrations are **not stale by version**. However, there are registrations for **two different opaque `vscode-webview://` origins** with long random hex hostnames — these represent past webview panel sessions. If a new webview panel opens with a third opaque origin and attempts to register a SW, a collision or race condition against these existing entries could trigger `InvalidStateError` in certain Chromium update-check edge cases.

---

## Summary

| Finding | Value |
|---------|-------|
| IndexedDB directory present | **NO** — does not exist |
| SW registrations in LevelDB Database | **YES — 2 active** |
| Stale by version (v= mismatch) | **NO** — both are v=4, matching installed |
| Stale by orphaned origins | **POSSIBLE** — 2 old webview origins accumulated |
| Session Storage stale LDB files | **YES** — files from April 2025 (12+ months) |
| WebStorage bloat | **YES** — 3.27 GB across 12,917 items |
| Would clearing SW Database fix InvalidStateError | **YES** — if caused by registration state |
| Would clearing IndexedDB fix it | **N/A** — IndexedDB does not exist here |
