# AGENTC — Extension Installation & Cached Data Audit

**Date:** 2026-04-27
**Scope:** VS Code extension directories, globalStorage, workspaceStorage, CachedData (V8)
**Finding:** Multiple KiloCode versions simultaneously installed — YES (count: 2)

---

## 1. All Installed VS Code Extensions

Path: `C:\Users\Admin\.vscode\extensions\`

| Extension ID | Version | Install Source | Pinned |
|---|---|---|---|
| anthropic.claude-code | 2.1.121 | gallery | no |
| bierner.markdown-mermaid | 1.32.0 | gallery | no |
| christian-kohler.npm-intellisense | 1.4.5 | gallery | no |
| connor4312.esbuild-problem-matchers | 0.0.3 | gallery | no |
| davidanson.vscode-markdownlint | 0.61.2 | gallery | no |
| dbaeumer.vscode-eslint | 3.0.24 | gallery | no |
| eamodio.gitlens | 17.12.2 | gallery | no |
| esbenp.prettier-vscode | 12.4.0 | gallery | no |
| ghenghis.pixelpaw | 1.2.0 | vsix | yes |
| github.copilot-chat | 0.45.1 | gallery | no |
| github.vscode-pull-request-github | 0.138.0 | gallery | no |
| google.geminicodeassist | 2.79.0 | gallery | no |
| **kilocode.kilo-code** | **7.2.21-canary.6** | **vsix** | **yes** |
| **kilocode.kilocode-maos** | **7.2.21-EVO2** | **vsix** | **yes** |
| ms-azuretools.vscode-azure-github-copilot | 1.0.201 | gallery | no |
| ms-azuretools.vscode-azure-mcp-server | 2.0.43 | gallery | no |
| ms-azuretools.vscode-azureresourcegroups | 0.12.4 | gallery | no |
| ms-azuretools.vscode-containers | 2.4.2 | gallery | no |
| ms-azuretools.vscode-docker | 2.0.0 | gallery | no |
| ms-playwright.playwright | 1.1.18 | gallery | no |
| ms-python.debugpy | 2025.18.0 | gallery | no |
| ms-python.python | 2026.4.0 | gallery | no |
| ms-python.vscode-pylance | 2026.2.1 | gallery | no |
| ms-python.vscode-python-envs | 1.28.0 | gallery | no |
| ms-toolsai.jupyter | 2025.9.1 | gallery | no |
| ms-toolsai.jupyter-keymap | 1.1.2 | gallery | no |
| ms-toolsai.jupyter-renderers | 1.3.0 | gallery | no |
| ms-toolsai.vscode-jupyter-cell-tags | 0.1.9 | gallery | no |
| ms-toolsai.vscode-jupyter-slideshow | 0.1.6 | gallery | no |
| ms-vscode-remote.remote-containers | 0.454.0 | gallery | no |
| ms-vscode-remote.remote-wsl | 0.104.3 | gallery | no |
| ms-vscode.extension-test-runner | 0.0.14 | gallery | no |
| ms-vscode.live-server | 0.4.18 | gallery | no |
| ms-vscode.notepadplusplus-keybindings | 1.0.7 | gallery | no |
| ms-vscode.powershell | 2025.4.0 | gallery | no |
| ms-vscode.vscode-node-azure-pack | 1.8.1 | gallery | no |
| ms-windows-ai-studio.windows-ai-studio | 1.0.0 | gallery | no |
| rooveterinaryinc.roo-cline | 3.53.0 | gallery | no |
| saoudrizwan.claude-dev | 3.81.0 | gallery | no |
| teamsdevapp.vscode-ai-foundry | 1.0.0 | gallery | no |

---

## 2. KiloCode Extension Versions — Doubled-Icons Cause CONFIRMED

Two distinct KiloCode-family extensions are installed simultaneously under the **same publisher** (`kilocode`) with **different extension IDs** but the **same `displayName`** ("KiloCode MAOS Edition"). VS Code renders a sidebar icon and activity bar entry for each loaded extension — this is the direct cause of doubled icons.

### kilocode.kilo-code — 7.2.21-canary.6

- **Directory:** `C:\Users\Admin\.vscode\extensions\kilocode.kilo-code-7.2.21-canary.6\`
- **Extension ID:** `kilocode.kilo-code`
- **displayName:** `KiloCode MAOS Edition`
- **Installed:** 2026-04-25 (timestamp 1777344687244), pinned, source=vsix
- **UUID:** `849d53b8-0eb4-4e6b-b73f-870eefcbbf1b`

### kilocode.kilocode-maos — 7.2.21-EVO2

- **Directory:** `C:\Users\Admin\.vscode\extensions\kilocode.kilocode-maos-7.2.21-EVO2\`
- **Extension ID:** `kilocode.kilocode-maos`
- **displayName:** `KiloCode MAOS Edition`
- **Installed:** 2026-04-24 (timestamp 1777296961162), pinned, source=vsix
- **UUID:** *(no UUID — VSIX-only, not marketplace-registered)*

### Shared `dist/` bundle layout (identical in both)

Both extensions contain an identical bundle structure:

```
dist/
  extension.js        # Main extension entry (Node host process)
  extension.js.map
  webview.js          # Primary webview bundle
  webview.css
  kiloclaw.js         # Agent-manager sidebar panel
  kiloclaw.css
  agent-manager.js
  diff-viewer.js
  diff-virtual.js
  [KaTeX font files x ~60]
```

The two `extension.js` files will both be activated by VS Code because their `package.json` IDs are different (`kilo-code` vs `kilocode-maos`). VS Code has no deduplication across different IDs even when `displayName` collides.

---

## 3. globalStorage — KiloCode Entries

Path: `C:\Users\Admin\AppData\Roaming\Code\User\globalStorage\`

**No dedicated KiloCode globalStorage subdirectory exists.** VS Code creates per-extension subdirectories using the publisher+name ID (e.g., `kilocode.kilo-code/`). Neither `kilocode.kilo-code/` nor `kilocode.kilocode-maos/` directories are present in globalStorage at this time.

This means:
- Neither extension has written persistent globalState keys to disk yet (or all state is stored in the shared `state.vscdb` SQLite database rather than flat files).
- The global `state.vscdb` at `C:\Users\Admin\AppData\Roaming\Code\User\globalStorage\state.vscdb` is a SQLite database that holds all extension globalState keys. A `strings` scan of this file returned no kilo-specific keys, confirming no accumulated KiloCode state.

**profileAssociations in `storage.json`** show the user has opened KiloCode-related repos from multiple paths:
```
file:///c%3A/Users/Admin/Downloads/VPS/code/kilocode-fresh
file:///g%3A/Github/Kilo_Code
file:///g%3A/Github/kilocode
file:///g%3A/Github/kilocode-Azure
file:///g%3A/Github/kilocode-Azure2
file:///g%3A/kilocode-7.1.9
file:///g%3A/KiloCode-DaveAI
```

These are workspace profile-association entries, not extension cache. They will persist across reinstalls but are harmless.

---

## 4. VS Code Extension Manifest Cache

VS Code does **not** maintain a separate parsed cache of `package.json` manifests on disk. The `extensions.json` file at `C:\Users\Admin\.vscode\extensions\extensions.json` serves as the extension registry — it is the manifest metadata store. Key observations:

- Both KiloCode entries appear in `extensions.json` with their full metadata.
- Both are marked `"pinned": true` and `"source": "vsix"` — VS Code will not auto-update or auto-remove them.
- The `extensions.json` file is updated atomically by VS Code on install/uninstall. Manually deleting an extension directory without also removing its entry from `extensions.json` leaves a broken/zombie registration that causes VS Code to show error icons.

**V8 CachedData:** `C:\Users\Admin\AppData\Roaming\Code\CachedData\` contains 5 subdirectories (named by VS Code build hash). Each contains `chrome/js/` with ~22 V8 bytecode cache files named by content hash. These are compiled caches of VS Code's own core JS — they contain **no extension-specific compiled bytecode**. Extension `dist/extension.js` files are compiled and cached in-memory at activation time; they are not written to CachedData on disk.

---

## 5. KiloCode Directories in AppData — Complete List

Scan of `C:\Users\Admin\AppData\` (all depths):

| Path | Type |
|---|---|
| `C:\Users\Admin\.vscode\extensions\kilocode.kilo-code-7.2.21-canary.6\` | Extension install |
| `C:\Users\Admin\.vscode\extensions\kilocode.kilocode-maos-7.2.21-EVO2\` | Extension install |

No other KiloCode directories were found in AppData (no workspaceStorage, no globalStorage, no LocalAppData entries).

---

## 6. How to Cleanly Uninstall All KiloCode Versions Before Installing canary.7

### Why a clean uninstall matters

Both extensions are `"pinned": true` in `extensions.json`. VS Code's UI uninstall will remove the directory and the `extensions.json` entry. However, if VS Code is running during removal, the entry may be re-serialized from memory. Always close VS Code first.

Additionally, since `kilocode.kilocode-maos` has **no marketplace UUID**, VS Code's extension host cannot verify it via the gallery — it will never be auto-removed or flagged as outdated. It must be removed manually.

### PowerShell — Complete Clean Install Script

```powershell
# ============================================================
# KiloCode Complete Clean Install — run with VS Code CLOSED
# ============================================================

# 1. Close VS Code if running
Get-Process -Name "Code" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# 2. Remove extension directories
$extRoot = "$env:USERPROFILE\.vscode\extensions"
$kiloDirs = @(
    "$extRoot\kilocode.kilo-code-7.2.21-canary.6",
    "$extRoot\kilocode.kilocode-maos-7.2.21-EVO2"
)
foreach ($dir in $kiloDirs) {
    if (Test-Path $dir) {
        Remove-Item -Recurse -Force $dir
        Write-Host "Removed: $dir"
    }
}

# 3. Remove entries from extensions.json (VS Code's registry)
$extJson = "$extRoot\extensions.json"
$entries = Get-Content $extJson -Raw | ConvertFrom-Json
$filtered = $entries | Where-Object {
    $_.identifier.id -notmatch "^kilocode\."
}
$filtered | ConvertTo-Json -Depth 10 | Set-Content $extJson -Encoding UTF8
Write-Host "Cleaned extensions.json — removed $(($entries.Count - $filtered.Count)) KiloCode entries"

# 4. Remove KiloCode globalStorage directories (if they exist)
$globalStorage = "$env:APPDATA\Code\User\globalStorage"
@("kilocode.kilo-code", "kilocode.kilocode-maos") | ForEach-Object {
    $path = Join-Path $globalStorage $_
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
        Write-Host "Removed globalStorage: $path"
    } else {
        Write-Host "No globalStorage entry for $_"
    }
}

# 5. Clear V8 CachedData (optional — forces VS Code to recompile all JS on next launch)
#    Only needed if you suspect stale bytecode. Uncomment to enable:
# Remove-Item -Recurse -Force "$env:APPDATA\Code\CachedData\*"
# Write-Host "Cleared V8 CachedData"

# 6. Install canary.7 VSIX
# $vsixPath = "path\to\kilocode-7.2.21-canary.7.vsix"
# code --install-extension $vsixPath

Write-Host ""
Write-Host "Clean uninstall complete. Install canary.7 and restart VS Code."
```

### Manual steps (no PowerShell)

1. Close VS Code completely (check Task Manager — `Code.exe` must be gone).
2. Delete `C:\Users\Admin\.vscode\extensions\kilocode.kilo-code-7.2.21-canary.6\`
3. Delete `C:\Users\Admin\.vscode\extensions\kilocode.kilocode-maos-7.2.21-EVO2\`
4. Open `C:\Users\Admin\.vscode\extensions\extensions.json` in Notepad.
5. Delete the two JSON objects whose `identifier.id` values are `"kilocode.kilo-code"` and `"kilocode.kilocode-maos"`. Ensure the array remains valid JSON (no trailing commas).
6. Save and close.
7. Double-click the canary.7 `.vsix` file, or run: `code --install-extension kilocode-canary7.vsix`

---

## 7. What globalState Survives a Reinstall vs What Gets Cleared

### Cleared on uninstall (if done properly)

| Item | Location | Cleared? |
|---|---|---|
| Extension binaries | `.vscode/extensions/kilocode.*/dist/` | YES — directory deleted |
| Extension manifest registration | `.vscode/extensions/extensions.json` | YES — entry removed |
| Per-extension globalStorage folder | `globalStorage/kilocode.kilo-code/` | YES — if deleted in step 4 above |
| V8 bytecode cache | `CachedData/*/chrome/js/` | Only if manually cleared (step 5) |

### Survives a reinstall (persists)

| Item | Location | Notes |
|---|---|---|
| globalState keys in SQLite | `globalStorage/state.vscdb` | Keyed by `kilocode.kilo-code.<key>` — survives unless DB is edited or the key namespace changes |
| workspaceStorage entries | `workspaceStorage/<hash>/state.vscdb` | Workspace-level state — survives unless workspace storage is deleted |
| profileAssociations | `globalStorage/storage.json` | Workspace-to-profile mappings — harmless, never causes functional issues |
| VS Code settings (settings.json) | `Code\User\settings.json` | User/workspace settings referencing KiloCode — survives |
| Keybindings | `Code\User\keybindings.json` | Any KiloCode keybindings — survives |

### Note on `state.vscdb` key namespace

KiloCode stores globalState using VS Code's `context.globalState.update(key, value)` API. Keys are namespaced internally as `kilocode.kilo-code/<key>` (for the `kilo-code` extension ID). If canary.7 ships with the same extension ID (`kilocode.kilo-code`), it will inherit all previously stored globalState keys. If the ID changes to `kilocode.kilocode-maos` or a new ID, the old keys become orphaned (invisible to the new version, but not deleted). This is relevant for migration: any stored API keys, conversation history, or profile settings will only be visible to canary.7 if it uses the same extension ID.

---

## Summary

| Question | Answer |
|---|---|
| Multiple KiloCode versions installed simultaneously? | **YES — 2 versions** |
| Extension IDs | `kilocode.kilo-code` (canary.6) and `kilocode.kilocode-maos` (EVO2) |
| Both have same displayName? | YES — both show "KiloCode MAOS Edition" |
| This causes doubled icons? | YES — confirmed root cause |
| KiloCode globalStorage directory present? | NO — no accumulated disk state |
| V8 CachedData contains extension bytecode? | NO — CachedData is VS Code core JS only |
| Clean uninstall requires editing extensions.json? | YES — especially for pinned VSIX installs |
