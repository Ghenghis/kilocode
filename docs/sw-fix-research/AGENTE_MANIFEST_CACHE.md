# AGENTE — VS Code Extension Manifest Cache Research

**Investigator:** Agent E  
**Date:** 2026-04-27  
**Scope:** VS Code internal extension manifest and activation caches; VSIX install replace-vs-append behavior; `kilocode.kilo-code` conflict analysis

---

## 1. Where VS Code Caches Extension Manifests

### Primary Registry — `extensions.json`

**Path:** `C:\Users\Admin\.vscode\extensions\extensions.json`

This is VS Code's single source of truth for installed extensions. It is a flat JSON array where each entry contains:

- `identifier.id` — the extension ID (e.g., `kilocode.kilo-code`)
- `identifier.uuid` — marketplace UUID (absent for pure-VSIX installs)
- `version` — semver string
- `location` / `relativeLocation` — folder name under `.vscode\extensions\`
- `metadata.source` — `"gallery"` or `"vsix"` (critical field)
- `metadata.pinned` — `true` when installed from VSIX (prevents auto-update)
- `metadata.installedTimestamp` — Unix ms, used for conflict resolution

This file is **read at VS Code startup**. If it is stale (entry points to a folder that no longer exists, or has a wrong version), VS Code will display incorrect metadata until the cache is rebuilt.

### Parsed Manifest Cache — `extensions.user.cache`

**Path:** `C:\Users\Admin\AppData\Roaming\Code\CachedProfilesData\__default__profile__\extensions.user.cache`

This is a **compiled parse cache** of all installed extension `package.json` manifests. Structure:

```json
{
  "input": {
    "location": "vscode-userdata:/c:/Users/Admin/.vscode/extensions/extensions.json",
    "mtime": 1777344697892,
    "productVersion": "1.117.0",
    "productCommit": "10c8e557c8b9f9ed0a87f61f1c9a44bde731c409"
  },
  "result": [ /* full manifest objects for every installed extension */ ]
}
```

Key behavior:
- Cache is **keyed on the mtime of `extensions.json`** and the VS Code commit hash.
- If `extensions.json` mtime changes (which it does after any install/uninstall), this cache is **automatically invalidated and rebuilt**.
- Therefore, stale manifest contributions (icons, commands, activation events) from this cache are only possible if `extensions.json` mtime does not update — which does not happen in normal installs.

### Builtin Extension Cache

**Path:** `C:\Users\Admin\AppData\Roaming\Code\CachedProfilesData\__default__profile__\extensions.builtin.cache`

Same structure as `extensions.user.cache` but covers VS Code's bundled extensions. Not relevant to VSIX installs.

### VSIX Download Cache

**Path:** `C:\Users\Admin\AppData\Roaming\Code\CachedExtensionVSIXs\`

Files are named `<publisher>.<name>-<version>[-<platform>]` (no `.vsix` extension). Observed entries include:

```
kilocode.kilo-code-7.2.22-win32-x64       (70.9 MB, Apr 25)
rooveterinaryinc.roo-cline-3.53.0
saoudrizwan.claude-dev-3.81.0
...
```

These are the raw VSIX bytes cached by VS Code after a gallery download. They are **not read at runtime** — VS Code extracts the VSIX to `.vscode\extensions\<id>-<version>\` during install and uses that folder directly. The cache here is only for reinstall/rollback without re-downloading.

**Important discrepancy found:** `CachedExtensionVSIXs` contains `kilocode.kilo-code-7.2.22-win32-x64` (a newer gallery version), but the **active installed version** is `kilocode.kilo-code-7.2.21-canary.6` (our VSIX). VS Code has a pending update ready but our pinned VSIX is blocking its application — this is the correct behavior.

### Obsolete Extension Tracking

**Path:** `C:\Users\Admin\.vscode\extensions\.obsolete`

VS Code writes superseded extension folder names here after an update. On next startup, it deletes those folders. Example:

```json
{
  "anthropic.claude-code-2.1.96-win32-x64": true,
  "anthropic.claude-code-2.1.105-win32-x64": true,
  "anthropic.claude-code-2.1.108-win32-x64": true
}
```

Note: **No kilocode entries appear in `.obsolete`**. This means VS Code has not scheduled any old kilo-code folder for deletion, which is consistent with there being only one installed version (`7.2.21-canary.6`).

### Additional Cache Locations (minor)

| Path | Contents |
|------|----------|
| `C:\Users\Admin\AppData\Roaming\Code\CachedConfigurations\defaults\` | Merged configuration defaults from all active extensions |
| `C:\Users\Admin\AppData\Roaming\Code\CachedProfilesData\configurationDefaultsOverrides\` | Profile-level config overrides |
| `C:\Users\Admin\AppData\Roaming\Code\User\globalStorage\<publisher>.<name>\` | Extension runtime state/storage (not manifest cache) |
| `C:\Users\Admin\AppData\Roaming\Code\CachedData\<commit-hash>\chrome\` | V8 snapshot / compiled JS cache; keyed per VS Code commit |

---

## 2. How VSIX Installation Replaces vs. Appends

### Install Mechanics

When you run `code --install-extension foo.vsix`:

1. VS Code extracts the VSIX into `.vscode\extensions\<id>-<version>\`
2. It writes a new entry into `extensions.json` **for that ID**
3. If an entry for the same `identifier.id` already exists in `extensions.json`, **the old entry is replaced** — VS Code does not allow two entries with the same ID in the registry array
4. The old extension folder (different version number) is written to `.obsolete` and deleted on next startup
5. `extensions.json` mtime is updated, invalidating `extensions.user.cache` — it is rebuilt on next activation

### Version Coexistence on Disk

While VS Code's registry only keeps one entry per extension ID, **the folder for the previous version can temporarily persist on disk** between the install and the next full VS Code restart (when `.obsolete` cleanup runs). During this window:

- The registry points to the new version's folder
- The old folder exists but is not loaded
- After restart, VS Code's startup cleaner deletes folders listed in `.obsolete`

### VSIX Source Flag (`"pinned": true`)

Extensions installed from a `.vsix` file receive `"source": "vsix"` and `"pinned": true` in `extensions.json`. This means:

- VS Code's auto-update mechanism will **not overwrite** a pinned extension with a gallery update
- The gallery update is still downloaded to `CachedExtensionVSIXs` (hence the `7.2.22` file observed)
- The update is held pending but not applied until the user explicitly updates or unpins

---

## 3. Does `kilocode.kilo-code` Conflict With the Upstream Marketplace Extension?

### Current State (observed on this machine)

From `extensions.json`:

```json
{
  "identifier": { "id": "kilocode.kilo-code", "uuid": "849d53b8-0eb4-4e6b-b73f-870eefcbbf1b" },
  "version": "7.2.21-canary.6",
  "relativeLocation": "kilocode.kilo-code-7.2.21-canary.6",
  "metadata": {
    "source": "vsix",
    "pinned": true,
    "installedTimestamp": 1777344687244,
    "publisherDisplayName": "Kilo Code"
  }
}
```

From `extensions.user.cache` (the live manifest):

```json
{
  "identifier": { "id": "kilocode.kilo-code" },
  "manifest": {
    "name": "kilo-code",
    "displayName": "KiloCode MAOS Edition",
    "version": "7.2.21-canary.6",
    "publisher": "kilocode"
  }
}
```

### Conflict Risk Assessment

**The extension ID `kilocode.kilo-code` is shared between our custom VSIX and the upstream marketplace extension.**

| Factor | Assessment |
|--------|-----------|
| Can both versions coexist in registry? | NO — VS Code only permits one entry per ID in `extensions.json` |
| Can both folder versions coexist on disk? | Temporarily YES, but `.obsolete` removes the old one at next restart |
| Will gallery auto-update overwrite our VSIX? | NO — `"pinned": true` blocks auto-update |
| Does the gallery update download anyway? | YES — `kilocode.kilo-code-7.2.22-win32-x64` is in `CachedExtensionVSIXs` |
| If user clicks "Update" in Extensions panel? | YES — the gallery version replaces our custom VSIX, losing all MAOS customizations |
| Does the same UUID work for both? | The UUID `849d53b8-0eb4-4e6b-b73f-870eefcbbf1b` is the upstream marketplace UUID, which our VSIX embed — this creates an identity link that VS Code uses to offer gallery updates |

**Conclusion: Conflict risk is REAL.** The `"pinned"` flag currently prevents replacement, but it is a user-facing toggle. If the user manually updates, the custom VSIX is silently replaced by the marketplace version. The `"uuid"` being the marketplace UUID also means VS Code's extension panel shows the marketplace version as an "available update", which is confusing.

---

## 4. Correct Install Sequence for Clean Replacement

### Goal: Install custom `kilocode.kilo-code` VSIX and ensure no stale cache persists

```powershell
# Step 1: Close all VS Code windows
Get-Process Code -ErrorAction SilentlyContinue | Stop-Process -Force

# Step 2: Uninstall any existing kilocode.kilo-code (removes registry entry and schedules folder deletion)
code --uninstall-extension kilocode.kilo-code

# Step 3: Delete the old extension folder(s) manually (do not wait for VS Code to clean up)
Remove-Item "$env:USERPROFILE\.vscode\extensions\kilocode.kilo-code-*" -Recurse -Force -ErrorAction SilentlyContinue

# Step 4: Remove the .obsolete entry for kilo-code to avoid confusion
$obsoletePath = "$env:USERPROFILE\.vscode\extensions\.obsolete"
if (Test-Path $obsoletePath) {
    $obsolete = Get-Content $obsoletePath | ConvertFrom-Json
    $obsolete.PSObject.Properties.Remove("kilocode.kilo-code*")
    # Re-save (manually edit or reconstruct JSON)
}

# Step 5: Delete the extensions.user.cache to force full manifest rebuild
Remove-Item "$env:APPDATA\Code\CachedProfilesData\__default__profile__\extensions.user.cache" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\Code\CachedProfilesData\__default__profile__\extensions.builtin.cache" -Force -ErrorAction SilentlyContinue

# Step 6: Remove the stale gallery VSIX cache for kilo-code to prevent unwanted update application
Remove-Item "$env:APPDATA\Code\CachedExtensionVSIXs\kilocode.kilo-code-*" -Force -ErrorAction SilentlyContinue

# Step 7: Install the custom VSIX
code --install-extension "G:\path\to\kilocode.kilo-code-7.2.21-canary.6.vsix"

# Step 8: Verify install
code --list-extensions --show-versions | Select-String "kilocode"
```

### Why This Order Matters

- Deleting the extension folder **before** `--install-extension` ensures the old manifest is not briefly loaded
- Deleting `extensions.user.cache` forces VS Code to re-parse all manifests fresh — prevents ghost icon/command contributions from the old version persisting in the startup cache
- Removing `CachedExtensionVSIXs` entries prevents VS Code from silently re-applying the gallery update after restart

---

## 5. PowerShell Commands to Verify Only One Version Is Active

```powershell
# --- CHECK 1: List all installed kilocode extensions ---
code --list-extensions --show-versions | Select-String "kilocode"

# --- CHECK 2: Verify extensions.json has exactly one kilo-code entry ---
$extJson = Get-Content "$env:USERPROFILE\.vscode\extensions\extensions.json" | ConvertFrom-Json
$kiloEntries = $extJson | Where-Object { $_.identifier.id -like "kilocode.kilo-code" }
Write-Host "Registry entries for kilocode.kilo-code: $($kiloEntries.Count)"
$kiloEntries | Select-Object @{n='id';e={$_.identifier.id}}, version, relativeLocation, @{n='source';e={$_.metadata.source}}, @{n='pinned';e={$_.metadata.pinned}}

# --- CHECK 3: Verify only one physical folder exists ---
$folders = Get-ChildItem "$env:USERPROFILE\.vscode\extensions" -Directory | Where-Object { $_.Name -like "kilocode.kilo-code-*" }
Write-Host "Physical folders for kilocode.kilo-code: $($folders.Count)"
$folders | Select-Object Name, LastWriteTime

# --- CHECK 4: Check .obsolete for any kilo-code markers ---
$obsolete = Get-Content "$env:USERPROFILE\.vscode\extensions\.obsolete" | ConvertFrom-Json
$obsolete.PSObject.Properties | Where-Object { $_.Name -like "*kilo-code*" } | Select-Object Name, Value

# --- CHECK 5: Verify manifest cache matches installed version ---
$cache = Get-Content "$env:APPDATA\Code\CachedProfilesData\__default__profile__\extensions.user.cache" | ConvertFrom-Json
$kiloCached = $cache.result | Where-Object { $_.identifier.id -eq "kilocode.kilo-code" }
Write-Host "Cached manifest version: $($kiloCached.manifest.version)"
Write-Host "Cached manifest displayName: $($kiloCached.manifest.displayName)"

# --- CHECK 6: Confirm pinned status (protects against gallery overwrite) ---
$kiloEntries | Select-Object @{n='pinned';e={$_.metadata.pinned}}, @{n='source';e={$_.metadata.source}}

# --- CHECK 7: Check if a newer gallery version is waiting in VSIX cache ---
Get-ChildItem "$env:APPDATA\Code\CachedExtensionVSIXs" | Where-Object { $_.Name -like "kilocode.kilo-code-*" } | Select-Object Name, Length, LastWriteTime
```

---

## 6. Summary of Findings

| Question | Answer |
|----------|--------|
| Does VS Code cache extension manifests? | YES — `extensions.user.cache` stores full parsed manifests |
| Is the cache invalidated on VSIX install? | YES — automatically, via `extensions.json` mtime check |
| Can stale manifests persist? | YES, briefly, during the window between VSIX install and VS Code restart |
| Does installing a new VSIX with the same ID replace the old one? | YES — registry enforces one entry per ID; old folder goes to `.obsolete` |
| Can both versions coexist as active? | NO — only one registry entry per ID is loaded |
| Does `kilocode.kilo-code` VSIX conflict with the marketplace extension? | YES — same ID and UUID; `"pinned"` flag is the only guard |
| Is `"pinned": true` currently set for our VSIX? | YES — confirmed in `extensions.json` |
| Is a newer gallery version lurking in cache? | YES — `kilocode.kilo-code-7.2.22-win32-x64` in `CachedExtensionVSIXs` |
| **Manifest cache causes stale persistence?** | **YES — if VS Code is not fully restarted after VSIX install** |

### Critical Risk

The `"pinned": true` flag is user-visible and one click in the Extensions panel removes it, after which VS Code will auto-apply the cached `7.2.22` gallery version — silently replacing the MAOS customizations. The `CachedExtensionVSIXs\kilocode.kilo-code-7.2.22-win32-x64` file (70.9 MB) should be **deleted** as part of any clean-install procedure to remove this risk.
