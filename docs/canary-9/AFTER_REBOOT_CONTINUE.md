# After Reboot — Continuation Guide
**Created:** 2026-04-28 04:17 AM (before system reboot)  
**Reason for reboot:** Extreme system lag (CPU 85%+ with many processes)

---

## ✅ What Was Completed Before Reboot

### Security (contract-kit-v17)
- Ghost extension `kilocode.kilocode-maos-7.2.21-EVO2` removed from `C:\Users\Admin\.vscode\extensions\extensions.json`
- Only remaining KiloCode entry: `kilocode.kilo-code @ 7.2.21-canary.10` ✓
- VS Code SW cache fully cleared (nuclear): Service Worker, Cache, Code Cache, blob_storage, Local Storage, Session Storage, Shared Dictionary — all wiped from `%APPDATA%\Code\`
- 3 scheduled tasks created on claude.ai/code/routines:
  - Token rotation verification (fires 2026-04-29)
  - Weekly upstream-pickup classifier (Mondays)
  - Merge driver PR verification (fires 2026-05-10)

### KiloCode canary.10
- VSIX (72.9 MB, 141 files) is **NOT damaged** — extension activated cleanly (verified in exthost.log)
- Blank webview = VS Code in-memory SW state corruption, fixed by full reboot + cleared disk caches
- After reboot: VS Code will register the SW fresh and webview will load correctly

---

## 🚀 First Steps After Reboot

### Step 1 — Open VS Code (NOT Windsurf)
```
code G:\Github\kilocode-Azure2
```
Wait ~15 seconds for all extensions to activate.

### Step 2 — Verify KiloCode webview loads
1. Click the KiloCode icon in the activity bar (robot head icon)
2. The chat webview should load (no more black screen)
3. If it STILL shows black screen → open VS Code terminal and run:
   ```
   code --disable-extensions --inspect-extensions=9229
   ```
   Then check Help → Toggle Developer Tools → Console for errors.

### Step 3 — Open KiloCode Settings
- Click the gear icon in the KiloCode panel OR
- Ctrl+Shift+P → "KiloCode: Open Settings"
- The "Kilo Settings" tab should show the full settings UI

---

## 📋 Main Pending Task: Visual E2E Testing (20 Agents)

The primary request before reboot was: **comprehensive visual e2e testing of all 24 KiloCode settings tabs** with screenshots as proof.

### Approach
Use Windows MCP Screenshot tool (local) + 20 parallel code-verification agents (remote).

### The 24 Settings Tabs to Test

**AI Models Group:**
1. Models Tab — search/sort/favorites, virtualization for 50+ models
2. Providers Tab — API key test, connect/disconnect, health badges
3. Provider Routing Tab — traffic split, routing rules, latency grid, cost estimate, role matrix, route trace
4. Training & GPU Tab — GPU config, training settings

**Workflow Group:**
5. Agent Behaviour Tab — 21-agent config, MCP health badges, presets (Dev all/Review/Write/Research)
6. Auto Approve Tab — granular tool permissions (bash/read/edit/glob/grep), allow/ask/deny
7. Autocomplete Tab — trigger delay slider, max suggestions, language toggles, live preview
8. Commit Message Tab — presets (Conventional/Angular/Semantic), template editor, live preview
9. Checkpoints Tab — snapshot retention, auto-checkpoint triggers, diff viewer, pruning

**Integrations Group:**
10. Memory (Shiba) Tab — connection status, entry browser, recall interface, agent permissions
11. Browser Tab — Playwright MCP toggle, headless mode, viewport presets
12. SSH & Remote Tab — profile manager, key generator, file browser
13. VPS & Infrastructure Tab — provider config, deployment status
14. Hermes Tab — enable toggle, bridge URL, health ping, active tasks
15. ZeroClaw Tab — executor settings
16. Hub Tab — hub operations dashboard

**System Group:**
17. Notifications Tab — per-event toggles, sound settings, priority filter
18. Speech Tab — TTS provider, voice selection, PTT config
19. Context Tab — ignore patterns, rules files, system prompt preview, token usage meter
20. Display Tab — layout, density, code theme, bubble style, font size, line height — **live preview pane**
21. Governance Tab — authority tiers, approval records, policy audit log
22. Language Tab — UI language selector, per-language model preferences
23. Experimental Tab — feature flags with stability badges (alpha/beta/rc/stable)
24. About Tab — version, connection status, links

### For Each Tab: Test Contract
- **Navigate** to tab (click or use Ctrl+K to jump)
- **Screenshot** the tab in initial state
- **Exercise** interactive controls (sliders, toggles, dropdowns)
- **Screenshot** after interaction showing live preview / response
- **Note** any failures or missing functionality

### Features Requiring Setup Before Testing
| Tab | Setup Required |
|-----|---------------|
| Providers | Need API keys in deploy/.env (MiniMax, SiliconFlow, LiteLLM configured) |
| Provider Routing | Need at least 2 providers active |
| Hermes | Need Hermes running at http://localhost:8091 |
| Memory | Need Shiba service running |
| Browser | Need Chrome installed (it is) |
| Speech | Need Azure TTS key (available in deploy/.env) |
| SSH | Need SSH keys/profiles configured |

---

## 🔒 Pending Security Actions (USER ACTION REQUIRED)

1. **GitHub force-push** (removes leaked creds from git history):
   ```powershell
   cd "G:\Github\contract-kit-v17-purge-034406"
   git push origin --force --all
   git push origin --force --tags
   ```

2. **Rotate 4 credentials** (still using old values):
   - POSTGRES_PASSWORD → SSH to VPS, ALTER USER postgres PASSWORD
   - MINIMAX_API_KEY → platform.minimaxi.com → delete old, create new
   - SILICONFLOW_API_KEY → cloud.siliconflow.cn → revoke, generate new
   - WEBUI_SECRET_KEY → `openssl rand -hex 32`, update VPS + restart webui

   See full guide: `G:\Github\contract-kit-v17\docs\SECURITY_CREDENTIAL_ROTATION_2026-04-28.md`

---

## 📂 Key File Locations

| Item | Path |
|------|------|
| canary.10 VSIX | `G:\Github\kilocode-Azure2\packages\kilo-vscode\kilocode-maos-7.2.21-canary.10.vsix` |
| Installed extension | `C:\Users\Admin\.vscode\extensions\kilocode.kilo-code-7.2.21-canary.10\` |
| deploy/.env (local, gitignored) | `G:\Github\contract-kit-v17\deploy\.env` |
| Security rotation guide | `G:\Github\contract-kit-v17\docs\SECURITY_CREDENTIAL_ROTATION_2026-04-28.md` |
| Scheduled routines | https://claude.ai/code/routines |

---

## 🔧 If Webview Still Blank After Reboot

The VSIX is confirmed intact (153 files, extension.js 7.7MB, webview.js 15.3MB, webview.css, all assets present). If the blank webview persists:

1. Open VS Code Developer Tools: Help → Toggle Developer Tools
2. Switch to Console tab
3. Look for errors like "Failed to load resource" or "CSP violation"
4. The most likely remaining cause: VS Code's internal service-worker.js URI not being intercepted

**Alternative**: Use VS Code's built-in command:
```
Ctrl+Shift+P → "Developer: Reload Window"
```
This forces a soft reload without restarting the whole extension host.

If all else fails, reinstall from VSIX:
```powershell
code --install-extension "G:\Github\kilocode-Azure2\packages\kilo-vscode\kilocode-maos-7.2.21-canary.10.vsix" --force
```

---

**Reboot now — see you on the other side! 🚀**
