# KiloCode canary.9 — Settings User Guide

Welcome to KiloCode's settings panel. This guide walks you through everything you need to know to
configure KiloCode quickly and confidently, from opening settings for the first time to tuning
advanced agent behaviour.

---

## 1. Quick Start

### Opening settings

Three ways to get there — pick the one that feels natural:

- **Keyboard shortcut:** Press `Ctrl+,` (comma) from anywhere in VS Code.
- **Sidebar icon:** Click the KiloCode icon in the Activity Bar on the left, then click the gear
  icon at the top of the KiloCode panel.
- **Command palette:** Press `Ctrl+Shift+P`, type `KiloCode: Open Settings`, and press Enter.

### Navigating to a tab

Once settings are open you will see a row of tabs across the top — Models, Providers, Agent
Behaviour, and so on. Click any tab to jump directly to it. You can also use the built-in command
palette (see Section 2) to jump by name.

### Making a change

Flip a toggle, select a value from a drop-down, or type into a text field. The settings panel
shows an **unsaved indicator** (a small dot or highlighted border) as soon as anything changes,
so you always know whether you have pending edits.

### Saving

Press **`Ctrl+S`** to save. KiloCode merges your edits and writes them to `kilo.json` on disk.
The unsaved indicator disappears once the save is confirmed. If you change your mind before
saving, press **`Escape`** or click **Discard** to revert to the last saved state.

> **Tip:** Extension-level settings (Browser, Autocomplete, Notifications, Speech) save
> immediately when you toggle them — no Ctrl+S needed. The save bar only appears for
> configuration keys that live in `kilo.json`.

---

## 2. Settings Navigation

### Tab groups

Settings are split into 24 tabs organised into rough groups:

| Group | Tabs |
|---|---|
| Core AI | Models, Providers |
| Agent control | Agent Behaviour, Auto Approve |
| Editor integration | Browser, Checkpoints, Autocomplete, Context, Commit Message |
| Infrastructure | SSH & Remote, VPS & Infra, Hermes, ZeroClaw, Provider Routing, Memory, Training & GPU, Governance, Hub |
| Personalisation | Display, Notifications, Speech, Language |
| Advanced / meta | Experimental, About KiloCode |

You do not have to visit every tab. Most users only ever need **Models**, **Providers**, and
optionally **Agent Behaviour**.

### Breadcrumb navigation

When you are inside a tab that has sub-sections — for example, Agent Behaviour has sub-tabs for
Agents, MCP Servers, Rules, Workflows, Skills, and Presets — a breadcrumb trail appears near the
top of the panel. Click any segment of the breadcrumb to jump back up.

### Ctrl+K command palette

Press **`Ctrl+K`** from anywhere inside the settings panel to open the command palette. Start
typing any setting name or tab name and the palette filters results in real time.

```
┌─────────────────────────────────────────────────────────────┐
│  > models                                                   │
│  ─────────────────────────────────────────────────────────  │
│  ● Models tab                                               │
│    Set active model · Star favourites · Filter by cap       │
│  ─────────────────────────────────────────────────────────  │
│  ○ Agent Behaviour › agents › model override                │
│  ○ Commit Message tab                                       │
│  ○ Experimental › small_model                               │
└─────────────────────────────────────────────────────────────┘
  ↑↓ navigate   Enter select   Tab/Shift+Tab wrap   Esc close
```

- Type to filter the list.
- Press `↑` / `↓` to move the highlight.
- Press `Enter` to jump to the highlighted item.
- Press `Tab` or `Shift+Tab` to cycle through results without leaving the keyboard.
- Press `Escape` to close without navigating anywhere.

---

## 3. Provider Setup Guide

A provider is a service that supplies AI models — Anthropic, OpenAI, Google, Amazon Bedrock, and
others. You need at least one active provider before KiloCode can respond to any request.

### Step-by-step: adding Anthropic

1. **Open the Providers tab** — click it in the tab bar or press `Ctrl+K` and type `providers`.

2. **Click the "+" button** in the top-right corner of the provider list.
   A provider picker appears showing all supported providers.

3. **Select Anthropic** from the list.
   A configuration card slides in with an API Key field.

4. **Paste your API key** into the field.
   KiloCode validates the key automatically as soon as you paste — you do not need to click a
   button. Within a second or two the card shows a green **"Working"** badge if the key is valid,
   or a red **"Invalid key"** message if it is not.

5. **Done for basic use.** The Anthropic provider is now active and all Claude models become
   available in the Models tab.

### Optional: custom endpoint

If your organisation routes API traffic through a proxy or uses a private Anthropic endpoint:

1. Expand the **Advanced** section on the provider card.
2. Enter your custom base URL in the **Endpoint** field (for example
   `https://my-proxy.example.com/anthropic`).
3. Press `Ctrl+S` to save.

Leave the Endpoint field blank to use Anthropic's default API URL.

### Other providers

The same steps apply to every provider. Common ones to add:

- **OpenAI** — paste your OpenAI API key.
- **Google** — paste your Gemini API key.
- **OpenRouter** — paste your OpenRouter key to access dozens of models through one provider.
- **Ollama / LM Studio** — no API key needed; just set the local server URL in the Endpoint field.

---

## 4. Model Selection Guide

### Opening the Models tab

Click **Models** in the tab bar or press `Ctrl+K` and type `models`.

The tab shows every model available across all your configured providers. The currently active
model is shown with a **green dot** to its left.

### Starring favourite models

Click the **star icon** next to any model to add it to your favourites. Starred models appear at
the top of every model picker throughout the extension, saving you from scrolling through a long
list each time.

### Filtering by capability

Use the capability filter chips near the top of the tab to narrow the list:

- **Vision** — models that can analyse images and screenshots.
- **Tools** — models that support function/tool calling (required for most KiloCode agents).
- **Fast** — lighter models suited to quick tasks like title generation or summarisation.

You can combine filters — for example, Vision + Tools shows only multi-modal models that also
support tool calls.

### Sorting by cost

Click the **Cost** column header to sort cheapest first. This is handy when you want to keep
routine tasks affordable while reserving expensive flagship models for complex work.

### Setting the active model

Click any model row and then click **Set as active** (or simply double-click the row). The green
dot moves to confirm the change. Press `Ctrl+S` to persist the choice to `kilo.json`.

You can also set a separate **Small model** — a lightweight model KiloCode uses for background
tasks like generating session titles or compacting long conversations. Setting a small model keeps
costs down without affecting the quality of your main interactions.

---

## 5. MAOS Agent Configuration

MAOS (Multi-Agent Orchestration System) lets you tune how KiloCode's built-in agents behave for
different workflows.

### Opening the Agent Behaviour tab

Click **Agent Behaviour** in the tab bar. Inside you will find several sub-tabs; for this section
focus on the **Agents** sub-tab.

### Enabling and disabling agents

Each agent (Plan, Build, Debug, Orchestrator, Ask, Explore, and any custom agents you create) has
an **Enabled** toggle. Disable agents you do not use to keep the orchestrator's choices simple and
predictable.

### Setting step limits and timeouts

On each agent card you can set:

- **Max steps** — the maximum number of tool calls the agent may make in a single run. Lower this
  to prevent runaway sessions; raise it for long refactoring tasks.
- **Timeout (seconds)** — how long the agent is allowed to run before KiloCode stops it
  automatically. A value of `0` means no timeout.

### Preset buttons

Four quick-preset buttons appear at the top of the Agents sub-tab:

| Preset | What it does |
|---|---|
| **Dev** | High step limits, all build and debug agents enabled |
| **Review** | Moderate limits, disables write-heavy agents |
| **Write** | Focused on content generation, disables code agents |
| **Research** | Read-only explore agent enabled, write agents disabled |

Presets apply instantly as a starting point — you can tweak individual agents after applying one.

### Emergency stop behaviour

At the bottom of the Agents sub-tab you will find **Emergency stop settings**. Configure:

- **Stop on error threshold** — how many consecutive errors trigger an automatic halt.
- **Confirm before each step** — forces a human approval click for every tool call (useful during
  sensitive operations).
- **Hard stop shortcut** — `Ctrl+Shift+.` by default; change it here if it conflicts with another
  binding.

---

## 6. Hub Connection Setup

The Hub tab connects KiloCode to the local KiloCode Hub service, which coordinates shared state
between VS Code and the KiloCode web dashboard.

### Step-by-step

1. **Open the Hub tab** — click it in the tab bar or press `Ctrl+K` and type `hub`.

2. **Select a preset URL** from the drop-down, or type a custom URL in the field below it.
   The default local address is `http://localhost:3000`.

3. **Set connection timeout** — enter the number of seconds KiloCode should wait for a response
   before declaring the Hub unreachable. The default is 10 seconds; increase this on slow networks.

4. **Click "Refresh Now"** to test the connection immediately.
   - A green **Connected** badge means the Hub responded successfully.
   - A red **Unreachable** badge means either the Hub service is not running or the URL is wrong.

5. **Press `Ctrl+S`** to save the URL and timeout settings.

### phpMyAdmin port conflict warning

If you see a warning banner that reads **"Port conflict detected — phpMyAdmin may be using this
port"**, it means another service on your machine is already listening on the Hub's configured
port (commonly port 80 or 8080).

To resolve it:

- Change the Hub URL to use a different port, for example `http://localhost:3001`.
- Or stop the phpMyAdmin service before starting the Hub.

This warning is informational only — KiloCode will still try to connect; you will see whether it
succeeds or fails in the connection badge.

---

## 7. Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| `Ctrl+,` | Open KiloCode settings |
| `Ctrl+K` | Open command palette inside settings |
| `Ctrl+S` | Save pending settings changes |
| `Escape` | Discard pending changes / close command palette |
| `↑` / `↓` | Navigate command palette items |
| `Enter` | Select highlighted palette item |
| `Tab` / `Shift+Tab` | Navigate palette items (wraps around) |
| `Ctrl+Shift+.` | Emergency stop (halt all agents immediately) |

---

## 8. Notifications and Quiet Hours

### Per-event toggles

Open the **Notifications** tab. You will find three event types:

- **Agent done** — notifies you when a long-running agent task finishes.
- **Permission request** — pops up when an agent needs your approval before continuing.
- **Errors** — alerts you when something goes wrong.

Each event type has two toggles: one for the visual notification and one for a sound effect.
Toggle either independently.

### Quiet hours

At the bottom of the Notifications tab, enable **Quiet hours** and set a start time and end time.
During quiet hours, KiloCode suppresses all notification sounds and banners — useful if you are
pair-programming on a shared screen or working in a shared space.

Quiet hours use your local system clock. They do not affect the agent itself — tasks continue
running; you just will not be interrupted until the quiet period ends.

---

## 9. Creating a Preset

Presets let you save a complete settings snapshot and switch between configurations instantly —
handy if you work across different projects with different requirements.

### Step-by-step

1. **Open Agent Behaviour > Presets sub-tab.**

2. **Click "New Preset".**
   A dialog appears asking for a name, optional description, and tags.

3. **Name your preset** clearly (for example, `frontend-review` or `data-pipeline-build`).

4. **Add tags** (optional but recommended) — tags let you filter presets later. Examples:
   `review`, `build`, `fast`, `careful`.

5. **Click "Save Snapshot."**
   KiloCode captures the current state of all agent settings, step limits, timeouts, and model
   selections into the preset.

6. **Versioning** — each time you update a preset, KiloCode increments a version number
   automatically. You can view version history by clicking the clock icon on the preset card.
   Roll back to any earlier version by selecting it from the history list and clicking "Restore."

7. **Comparing presets** — select two presets from the list and click **"Compare."**
   A side-by-side diff shows every setting that differs between them, making it easy to
   understand the practical effect of switching.

### Switching to a preset

Click any preset card, then click **"Apply."** KiloCode loads the preset values into the settings
panel. Review if you like, then press `Ctrl+S` to commit.

---

## 10. Troubleshooting Common Issues

### "Error loading webview"

**Symptom:** The settings panel shows a grey screen with "Error loading webview."

**Cause and fix:** This was a known issue with a stale VS Code webview cache. It is fixed
automatically in canary.9 — KiloCode now clears the relevant cache entries on startup. No action
is needed on your part. If you upgraded from an earlier build and still see this, restart VS Code
once; the auto-cache-clear will run and the issue will not recur.

---

### phpMyAdmin port conflict

**Symptom:** Hub tab shows a port-conflict warning; connection fails.

**Fix:**

1. Open the Hub tab.
2. Change the URL to use a port that nothing else is using, for example `http://localhost:3001`.
3. Press `Ctrl+S` and click **Refresh Now** to confirm the new URL connects.

If you need phpMyAdmin, you can also change phpMyAdmin's port in its own configuration instead.

---

### Two extension IDs conflict

**Symptom:** You have both a development build and the marketplace build installed simultaneously.
KiloCode behaves unpredictably — settings from one instance bleed into the other.

**Fix:** Run the clean-install script included in the repository:

```bash
# From the repository root:
bash scripts/clean-install.sh
```

This uninstalls both extension versions, clears shared state, and reinstalls the correct single
version. After the script finishes, reload VS Code (`Ctrl+Shift+P` → "Developer: Reload Window").

---

### Settings not saving

**Symptom:** You changed a setting, the panel looks correct, but after restarting VS Code the
setting has reverted.

**Check these in order:**

1. **Did you press `Ctrl+S`?**
   Changes to `kilo.json`-backed settings (Models, Providers, Agent Behaviour, most others) are
   not written until you explicitly save. Look for the unsaved indicator — a dot or highlight on
   the save bar — and press `Ctrl+S`.

2. **Check the unsaved badge.**
   If the badge is gone but the setting still reverted, there may have been a write error. Open
   the VS Code Output panel (`Ctrl+Shift+U`) and select "KiloCode" from the drop-down to see any
   error messages.

3. **Extension settings (Browser, Autocomplete, Notifications) save immediately.**
   If one of these is reverting, check that your VS Code user settings are not overriding the
   value. Open `Ctrl+Shift+P` → "Preferences: Open User Settings (JSON)" and look for any
   `kilo-code.new.*` keys that might be forcing a different value.

4. **File permissions.**
   On Linux and macOS, confirm that `~/.config/kilo/kilo.json` (or the equivalent path on your
   system) is writable by your user account:
   ```bash
   ls -la ~/.config/kilo/kilo.json
   ```
   If it is owned by root or read-only, correct the permissions with `chmod` or `chown`.

---

*KiloCode canary.9 — Settings User Guide*
*Last updated: 2026-04-27*
