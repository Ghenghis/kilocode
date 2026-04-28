# AGENTB — VS Code General Cache Investigation

**Date:** 2026-04-27  
**Machine:** Windows 11 Pro — `C:\Users\Admin`  
**Scope:** All VS Code general caches (NOT Service Worker)

---

## 1. Directory Inventory

### 1.1 `Cache\` — HTTP / Chromium Disk Cache
**Path:** `C:\Users\Admin\AppData\Roaming\Code\Cache\`  
**Total:** 33 files, **8.05 MB**

| File / Folder | Size | Last Modified |
|---|---|---|
| `Cache_Data\index` | 524,656 B | 2026-04-24 23:09 |
| `Cache_Data\data_3` | 4,202,496 B | 2026-04-27 05:54 |
| `Cache_Data\data_2` | 1,056,768 B | 2026-04-27 05:54 |
| `Cache_Data\data_1` | 270,336 B | 2026-04-27 05:54 |
| `Cache_Data\data_0` | 45,056 B | 2026-04-27 05:54 |
| `Cache_Data\f_000004` – `f_000032` | 19 KB – 470 KB each | 2026-04-25 – 2026-04-27 |
| `No_Vary_Search\snapshot.baf` | 20 B | 2026-02-07 |
| `No_Vary_Search\journal.baj` | 0 B | 2026-04-27 05:54 |

This is a standard Chromium SimpleCache (disk cache) for HTTP requests made by the VS Code renderer (marketplace calls, telemetry endpoints, CDN resources). The `data_*` slab files hold cached HTTP response bodies. The `f_000*` files are individual overflow cache entries. The oldest `No_Vary_Search\snapshot.baf` dates back to **2026-02-07** and represents a stale cache entry from a VS Code version 2+ months ago.

---

### 1.2 `GPUCache\` — GPU Shader Cache
**Path:** `C:\Users\Admin\AppData\Roaming\Code\GPUCache\`  
**Total:** 5 files, **5.57 MB**

| File | Size | Last Modified |
|---|---|---|
| `data_0` | 45,056 B | 2026-04-27 17:53 |
| `data_1` | 270,336 B | 2026-04-27 17:54 |
| `data_2` | 1,056,768 B | 2026-04-27 06:57 |
| `data_3` | 4,202,496 B | 2026-04-27 06:57 |
| `index` | 262,512 B | **2026-02-28** |

The `index` file is **58+ days old** (from February 28, 2026) — a different age from the data files. This mismatch indicates the index was carried over from an old VS Code install or GPU driver update while the data slabs were regenerated. Stale GPU cache causes the Electron renderer to recompile WebGL/WebGPU shaders on an outdated index, which can produce:
- Flickering or blank webviews
- Slow first render after startup
- In extreme cases, renderer crashes with `GPU process exited` errors
- No functional impact on extension logic/JS execution

---

### 1.3 `CachedData\` — V8 Compiled JS Cache
**Path:** `C:\Users\Admin\AppData\Roaming\Code\CachedData\`  
**Total:** ~206 files, **65.23 MB**

Each subdirectory is named after the SHA hash of a specific VS Code version. VS Code stores V8 bytecode (`.cache` blobs) for its own JavaScript files — **this is where compiled JS for the VS Code shell and extensions loads from**.

| Hash | Files | Size | Age |
|---|---|---|---|
| `10c8e557c8b9f9ed0a87f61f1c9a44bde731c409` | 25 | 11.76 MB | 2026-04-23 (**active**) |
| `41dd792b5e652393e7787322889ed5fdc58bd75b` | — | 11.58 MB | 2026-04-12 |
| `cfbea10c5ffb233ea9177d34726e6056e89913dc` | — | 11.63 MB | 2026-03-28 |
| `072586267e68ece9a47aa43f8c108e0dcbf44622` | — | 17.58 MB | 2026-02-27 |
| `994fd12f8d3a5aa16f17d42c041e5809167e845a` | — | 12.67 MB | 2026-02-07 |

**Does stale CachedData cause extension problems?**

Yes — in specific scenarios:
1. The active hash (`10c8e557c8`) corresponds to VS Code commit `10c8e557c8` (current install as of 2026-04-25). V8 bytecode is tied to the exact binary version, so the active directory is safe.
2. The **4 orphaned older hashes** (`994fd12f`, `072586267`, `cfbea10c`, `41dd792b`) are from removed VS Code versions. They waste ~53 MB of disk space but do **not** interfere with loading — VS Code selects the hash matching its current commit.
3. If an extension's `extension.js` was compiled into bytecode under a different Node/V8 version (e.g., after downgrading VS Code), the mismatch causes V8 to silently fall back to JIT, not a crash. However, if VS Code accidentally picks up a wrong-version `.cache` file (unusual but possible if hashes collide), it can trigger syntax errors or activation failures.

**Bottom line:** CachedData from old VS Code versions accumulates and wastes disk space, but the orphaned hashes do not interfere. Clearing old hashes is safe and frees ~53 MB.

---

### 1.4 `CachedExtensionVSIXs\` — VSIX Download Cache
**Path:** `C:\Users\Admin\AppData\Roaming\Code\CachedExtensionVSIXs\`  
**Total:** 20 files, **720.35 MB**

| Extension VSIX | Size | Last Modified |
|---|---|---|
| `google.geminicodeassist-2.79.0` | **218.8 MB** | 2026-04-22 |
| `ms-windows-ai-studio.windows-ai-studio-1.0.0-win32-x64` | **88.1 MB** | 2026-04-16 |
| `ms-azuretools.vscode-azure-github-copilot-1.0.201-win32-x64` | **109.7 MB** | 2026-04-10 |
| `anthropic.claude-code-2.1.121-win32-x64` | **78.7 MB** | 2026-04-27 |
| `kilocode.kilo-code-7.2.22-win32-x64` | **67.6 MB** | 2026-04-25 |
| `ms-azuretools.vscode-azure-mcp-server-2.0.43-win32-x64` | 45.8 MB | 2026-04-24 |
| `rooveterinaryinc.roo-cline-3.53.0` | 31.7 MB | 2026-04-24 |
| `ms-toolsai.jupyter-2025.9.1-win32-x64` | 6.5 MB | 2026-04-01 |
| `ms-toolsai.jupyter-renderers-1.3.0` | 7.4 MB | 2026-04-01 |
| `github.copilot-chat-0.45.1` | 19.4 MB | 2026-04-24 |
| `eamodio.gitlens-17.12.2` | 4.9 MB | 2026-04-22 |
| `saoudrizwan.claude-dev-3.81.0` | 14.4 MB | 2026-04-24 |
| `github.vscode-pull-request-github-0.138.0` | 2.0 MB | 2026-04-21 |
| `ms-vscode-remote.remote-containers-0.454.0` | 2.2 MB | 2026-04-17 |
| `ms-python.vscode-python-envs-1.28.0-win32-x64` | 3.8 MB | 2026-04-16 |
| `teamsdevapp.vscode-ai-foundry-1.0.0` | 17.4 MB | 2026-04-16 |
| `ms-toolsai.jupyter-renderers-1.3.0` | 7.4 MB | 2026-04-01 |
| `ms-vscode.live-server-0.4.18` | 0.3 MB | 2026-04-01 |
| `ms-vscode.vscode-node-azure-pack-1.8.1` | 0.02 MB | 2026-04-17 |
| `ms-playwright.playwright-1.1.18` | 0.6 MB | 2026-04-27 |

**KiloCode VSIXs cached:**
- `kilocode.kilo-code-7.2.22-win32-x64` — 67.61 MB, last modified **2026-04-25 00:03**

This is the only KiloCode VSIX in the download cache. There is no older version lingering. The VSIX cache is only used by VS Code when re-installing an extension without downloading again — it does not interfere with the installed extension.

**Note:** `google.geminicodeassist-2.79.0` (218.8 MB) is the single largest entry, nearly a third of the total cache.

---

### 1.5 `logs\` — VS Code Session Logs
**Path:** `C:\Users\Admin\AppData\Roaming\Code\logs\`  
**Total:** 949 files, **9.8 MB**  
**Sessions found:** 10 (from 2026-04-25 to 2026-04-27)

#### Critical Errors Found in Extension Host Logs

**Recurring error across ALL recent sessions (most impactful):**
```
[error] Activating extension kilocode.kilo-code failed due to an error:
[error] Error: command 'kilo-code.v4.toggleDebugMode' already exists
```
and:
```
[error] Activating extension kilocode.kilocode-maos failed due to an error:
[error] Error: command 'kilo-code.v4.toggleDebugMode' already exists
```

This error appears **5+ times per session**, caused by two extensions (`kilocode.kilo-code` and `kilocode.kilocode-maos`) both registering the same command. One extension activates first, registers `kilo-code.v4.toggleDebugMode`, then the second extension fails when it tries to register the same command ID. This is a duplicate command registration conflict — **not a cache issue**.

**Secondary recurring error:**
```
[error] An error occurred when disposing the subscriptions for extension 'eamodio.gitlens':
[error] Error: Channel has been closed
```
GitLens channel lifecycle issue on reload — benign, not cache-related.

**No Service Worker errors were found** in any log file across all 10 sessions. SW errors would appear in `renderer.log` or as `[Extension Host]` SW messages — none present.

---

### 1.6 VS Code Installation
**Path:** `C:\Users\Admin\AppData\Local\Programs\Microsoft VS Code\`  
**Active version directory:** `10c8e557c8` (matches active CachedData hash)  
**Code.exe date:** 2026-04-21  
**Installed:** 2026-04-25 (uninstaller timestamp)

---

## 2. Safety Classification

| Cache | Safe to Clear | Notes |
|---|---|---|
| `Cache\Cache_Data\` | YES | HTTP cache; VS Code rebuilds on next launch. No functional data. |
| `Cache\No_Vary_Search\` | YES | Stale 2026-02-07 entry; safe to delete. |
| `GPUCache\` | YES | Shader cache only. Cleared automatically if GPU driver changes. Minor visual stutter on first launch. |
| `CachedData\<old hashes>` | YES | Hashes not matching current commit are dead weight. 4 orphaned dirs = ~53 MB. |
| `CachedData\10c8e557c8...` (active) | CAUTION | Clearing forces V8 to recompile on next launch (~5-10s slower first start). Recovers automatically. |
| `CachedExtensionVSIXs\` | YES | Re-download required on reinstall. No impact on running extensions. Large (720 MB). |
| `CachedExtensionVSIXs\kilocode.kilo-code-7.2.22` | YES | Only if you are not planning to reinstall this exact version offline. |
| `logs\` | YES | Diagnostic only. VS Code auto-purges old sessions eventually. |

---

## 3. PowerShell Commands to Clear Each Cache

> **VS Code must be fully closed before running any of these.** Use `Stop-Process -Name Code -Force` to ensure it is not running.

### 3.1 Close VS Code
```powershell
# Ensure VS Code is fully closed
Stop-Process -Name "Code" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
```

### 3.2 Clear HTTP Cache (safe, recommended)
```powershell
Remove-Item "C:\Users\Admin\AppData\Roaming\Code\Cache\Cache_Data\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Users\Admin\AppData\Roaming\Code\Cache\No_Vary_Search\*" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "HTTP Cache cleared."
```

### 3.3 Clear GPU Cache (safe, minor visual stutter on first launch)
```powershell
Remove-Item "C:\Users\Admin\AppData\Roaming\Code\GPUCache\*" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "GPU Cache cleared."
```

### 3.4 Clear ORPHANED V8 CachedData only (safe — keeps active hash)
```powershell
$activeCommit = "10c8e557c8b9f9ed0a87f61f1c9a44bde731c409"
$cachedDataPath = "C:\Users\Admin\AppData\Roaming\Code\CachedData"
Get-ChildItem $cachedDataPath -Directory | Where-Object { $_.Name -ne $activeCommit } | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Removed stale CachedData: $($_.Name)"
}
Write-Host "Orphaned V8 cache cleared (~53 MB freed)."
```

### 3.5 Clear ACTIVE V8 CachedData (forces full V8 recompile on next launch)
```powershell
# Only run this if you suspect corrupted bytecode is causing issues
$activeCommit = "10c8e557c8b9f9ed0a87f61f1c9a44bde731c409"
Remove-Item "C:\Users\Admin\AppData\Roaming\Code\CachedData\$activeCommit\*" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Active V8 cache cleared. First VS Code launch will be 5-10s slower."
```

### 3.6 Clear ALL CachedExtensionVSIXs (frees 720 MB, requires re-download on reinstall)
```powershell
Remove-Item "C:\Users\Admin\AppData\Roaming\Code\CachedExtensionVSIXs\*" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Extension VSIX cache cleared (720 MB freed)."
```

### 3.7 Clear only KiloCode VSIX
```powershell
Remove-Item "C:\Users\Admin\AppData\Roaming\Code\CachedExtensionVSIXs\kilocode.kilo-code-7.2.22-win32-x64" -Force -ErrorAction SilentlyContinue
Write-Host "KiloCode VSIX cache entry removed."
```

### 3.8 Clear old log sessions (keep last 2)
```powershell
$logsPath = "C:\Users\Admin\AppData\Roaming\Code\logs"
$keepCount = 2
Get-ChildItem $logsPath -Directory | Sort-Object LastWriteTime -Descending | Select-Object -Skip $keepCount | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Removed log session: $($_.Name)"
}
```

### 3.9 Nuclear: Clear ALL general caches at once
```powershell
Stop-Process -Name "Code" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$paths = @(
    "C:\Users\Admin\AppData\Roaming\Code\Cache\Cache_Data\*",
    "C:\Users\Admin\AppData\Roaming\Code\Cache\No_Vary_Search\*",
    "C:\Users\Admin\AppData\Roaming\Code\GPUCache\*",
    "C:\Users\Admin\AppData\Roaming\Code\CachedData\*",
    "C:\Users\Admin\AppData\Roaming\Code\CachedExtensionVSIXs\*"
)
foreach ($p in $paths) {
    Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "All general caches cleared. VS Code will rebuild on next launch."
```

---

## 4. What Requires Restart

| Action | VS Code State Required | Notes |
|---|---|---|
| Clear `Cache\` | Must be **closed** | Chromium holds file locks while running |
| Clear `GPUCache\` | Must be **closed** | GPU process holds file locks |
| Clear `CachedData\` (orphaned) | Must be **closed** | No lock risk but safer when closed |
| Clear `CachedData\` (active) | Must be **closed** | V8 regenerates on next launch |
| Clear `CachedExtensionVSIXs\` | Can be **open** (not using) | Files not locked unless install in progress |
| Clear `logs\` | Can be **open** | Only affects old sessions, new session files are unaffected |

---

## 5. Key Finding: Critical Extension Activation Error

**The logs reveal a genuine blocking problem unrelated to HTTP/SW cache:**

```
Error: command 'kilo-code.v4.toggleDebugMode' already exists
```

This error fires on **every single VS Code launch** and causes either `kilocode.kilo-code` or `kilocode.kilocode-maos` to fail activation. Both extensions ship command ID `kilo-code.v4.toggleDebugMode` and VS Code activates both sequentially — the second one always fails. This is the **primary extension loading failure** on this machine.

**This cannot be fixed by clearing any cache.** It requires removing one of the two conflicting KiloCode extensions.

---

## 6. Recommended Clear Order

Run steps in this order for a complete general-cache reset:

| Step | Action | Disk Freed | Risk |
|---|---|---|---|
| 1 | Close VS Code (`Stop-Process`) | — | None |
| 2 | Clear `GPUCache\*` | 5.6 MB | None (stale index present) |
| 3 | Clear `Cache\Cache_Data\*` and `No_Vary_Search\*` | 8.1 MB | None |
| 4 | Clear orphaned `CachedData\` hashes | ~53 MB | None |
| 5 | Clear `CachedExtensionVSIXs\*` | **720 MB** | Requires re-download on reinstall |
| 6 | Clear active `CachedData\` hash (optional) | 11.8 MB | 5-10s slower first launch |
| 7 | Clear old log sessions | ~9 MB | None |
| **Total** | | **~808 MB** | |

---

## 7. Conclusion

**Most impactful cache to clear beyond SW:** `CachedExtensionVSIXs\` — it holds **720 MB** of extension download packages, dominated by Google Gemini (218 MB), Azure GitHub Copilot (110 MB), and Windows AI Studio (88 MB). This cache has zero effect on running extensions; clearing it only means re-downloading VSIXs if you reinstall those extensions.

**GPU cache is the most impactful for stability** within the smaller caches: the `GPUCache\index` file dates to **2026-02-28** (58 days old) while data files are current — this mismatch is a real anomaly that can cause renderer instability. Clear it first.

**The actual extension-loading problem on this machine** is the `kilo-code.v4.toggleDebugMode already exists` conflict between `kilocode.kilo-code` and `kilocode.kilocode-maos` — no cache operation will resolve it.
