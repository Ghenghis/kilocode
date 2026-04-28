# KiloCode MAOS Edition — Release Notes

## Version 7.2.21-canary.10

**Release Date:** In Development
**Publisher:** kilocode
**VS Code Engine:** ^1.105.1
**License:** MIT
**Repository:** https://github.com/Kilo-Org/kilocode

---

## Summary Table

| Area | Key Features | Impact |
|------|-------------|--------|
| Chat View | Message pinning, reactions, split/compare view, branching, inline code execution | Fundamentally richer chat interaction model |
| Smart Scroll & Navigation | Auto-scroll anchor with "N new" badge, bookmarks, chat history search | No more lost messages; precise navigation |
| AI Context Awareness | Context inspector (Ctrl+I), token optimizer, context diff on file change, live cost meter | Full transparency into what the model sees and costs |
| AI Thinking Visualization | Animated agent panel showing name, current action, and sub-steps | Real-time MAOS task legibility |
| Input & UX | Floating action bar, global command bar (Ctrl+Shift+K), message templates, drag & drop, input history | Radically faster prompt composition |
| Autocomplete & Mentions | @ mention autocomplete, / command autocomplete, prompt enhancer, follow-up chips, live token estimate | Structured, guided prompt entry |
| Hub / Open WebUI | Model browser with pull status + RAM, Direct API / Via Hub toggle, download progress, Hub connection dot | First-class Hub model management |
| Task & Agent Awareness | Live MAOS agent status panel (21 agents), task timeline, ETA estimation, workload donut, interrupt | Full MAOS orchestration observability in-chat |
| File Change Tracking | Inline diff preview, file change timeline panel, multi-file edit preview card, checkpoint toasts | Surgical visibility into every file change |
| Keyboard & Accessibility | Global shortcut registry, Ctrl+? help modal, full keyboard coverage, focus trapping, skip links | Zero-mouse-required workflow; full a11y |
| Theme & Visual | Accent color picker, message density, bubble style, font family, code theme, reduced motion, high contrast | Fully personalizable chat appearance |

---

## Chat View Game-Changers

### Message Pinning

A persistent top drawer at the head of the chat panel holds pinned messages. Any message can be pinned via its context menu or the pin icon that appears on hover. Pinned messages persist across sessions and are visible at a glance without scrolling.

- Drag to reorder pinned messages inside the drawer.
- Unpin individually or "Clear all pins" in one action.
- Drawer collapses to a single-line summary when not in focus.

### Message Reactions and Ratings

Each assistant message gains a thumbs-up / thumbs-down rating pair. Clicking thumbs-down opens a compact dropdown:

| Option | Description |
|--------|-------------|
| Wrong information | Factual inaccuracy |
| Off-topic | Response didn't address the question |
| Too verbose | Response was longer than needed |
| Bad code | Code didn't run or had logic errors |
| Other | Free-text field |

Ratings are stored locally and can be exported for fine-tune dataset contribution.

### Chat Split View — Compare Mode

Two side-by-side panes each show a different model answering the same prompt. Activate via the toolbar "Split" button or Ctrl+Shift+C.

- Model selector per pane; panes are independent.
- Responses stream simultaneously.
- A diff-highlight overlay marks token-level differences when both responses are complete.
- Collapse to single pane at any time; the preferred response can be pinned to the main thread.

### Message Branching

Any message in the thread can become the root of a new branch. Right-click → "Branch from here" (or click the branch icon on hover).

- Branch indicator shows the divergence point with a visual fork icon.
- A branch tab strip at the top of the chat panel lists all branches.
- Branches can be renamed, merged back to main, or deleted independently.
- Branch history is persisted in the session store.

### Inline Code Execution

Code blocks rendered in chat now show a Run button. Clicking it:

1. Opens (or reuses) the active VS Code terminal.
2. Pastes and runs the code block.
3. Captures stdout/stderr and displays the output inline beneath the code block as a collapsible result pane.

Supports: shell scripts, Python, Node.js, and any language with a configured VS Code terminal profile. Run is disabled for code blocks whose language cannot be inferred.

### Smart Scroll Anchor

- While the user is reading (scrolled up), new incoming tokens do not force a scroll jump.
- A floating badge "↓ N new" appears at the bottom of the viewport, showing how many new tokens have arrived.
- Clicking the badge, or pressing End, snaps back to the live tail.
- Auto-scroll resumes automatically when the user scrolls back to the bottom.

### Chat Bookmarks

- Bookmark any message via the bookmark icon on hover.
- A Bookmarks side panel (keyboard shortcut Ctrl+B) lists all bookmarked messages across all sessions.
- Clicking a bookmark navigates directly to that message.
- Bookmarks export to Markdown as an annotated snippet list.

---

## AI Context Awareness

### Context Inspector Panel (Ctrl+I)

A floating panel (also dockable) showing the full composition of the AI context for the current turn:

| Section | Content |
|---------|---------|
| System Prompt | Full rendered system prompt, character + token count |
| Rules Files | Each active `.kilo/rules` file with source badge |
| Conversation History | Message-by-message token breakdown |
| Attached Files | File name, size, token cost per file |
| Tool Definitions | Each registered tool with its token footprint |
| Total | Running total vs. context window ceiling, colour-coded |

The panel updates live as the conversation grows or files are attached.

### Token Optimizer

Accessible from the Context Inspector or via Ctrl+Shift+T.

- Analyzes the full context and highlights the highest-cost sections.
- One-click "Summarize old messages" replaces earlier conversation turns with a compact summary, freeing context space.
- Shows a before/after token delta before committing.
- Summarization uses the currently-selected model; the summary is injected as a system-level recap message.

### Context Diff on File Change

When a file that was previously referenced in the conversation changes on disk:

- An amber banner appears at the top of the chat: "Referenced file changed: `src/foo.ts` — re-attach?"
- Clicking "Re-attach" injects the updated file content into the next turn's context.
- Clicking "Dismiss" suppresses the banner for that file for the rest of the session.
- The banner does not appear if auto-attach is enabled in the Context Tab settings.

### Live Cost Meter

A persistent micro-widget at the bottom of the chat panel shows the running session cost.

- Format: `$0.0047` — updates after each completed turn.
- Tooltip on hover shows per-turn breakdown: input tokens × price + output tokens × price.
- A soft warning badge appears when the session exceeds a configurable threshold (default $1.00).
- Cost data is derived from the model's current pricing; Custom Providers show "?" if pricing is not configured.

### AI Thinking Visualization

When an agent is working, an animated panel slides up from the bottom of the chat:

- Agent name and avatar badge (colour-coded per agent role).
- Current high-level action (e.g. "Reading file", "Running tool", "Synthesizing response").
- Sub-step list with live checkmarks as each step completes.
- Elapsed time counter.
- The panel collapses automatically when the turn completes; it can be pinned open via a toggle.

---

## Input & UX Game-Changers

### Floating Action Bar

A compact toolbar docked to the right edge of the chat input box:

| Button | Action |
|--------|--------|
| Attach file | Opens a file picker; selected files are added to context |
| Screenshot | Captures the active VS Code editor pane as an image and attaches it |
| Switch model | Inline model switcher popover |
| Presets | Quick-apply preset popover |

The bar collapses to a single "+" button when the input box is narrow (below 480 px).

### Global Command Bar (Ctrl+Shift+K)

A full-width command palette overlaying the chat panel with AI-specific actions:

- New chat, clear history, switch mode, switch agent, apply preset, compact context.
- Fuzzy search across all actions.
- Recently used actions appear at the top.
- Keyboard-only navigation; Escape dismisses.

### Message Templates with Variables

Saved prompt templates support named variables that are filled at send time:

| Variable | Resolves to |
|----------|-------------|
| `{filename}` | Name of the active editor file |
| `{selection}` | Currently selected text in the editor |
| `{language}` | Language ID of the active editor |
| `{date}` | ISO date string |
| `{mode}` | Current KiloCode mode name |

Templates are managed in a dedicated Templates drawer; import/export as JSON.

### Drag and Drop Files onto Chat Input

Drag any file from the VS Code Explorer or the OS file manager and drop it onto the chat input area. The file is attached to the next message's context automatically. Multiple files can be dropped at once.

### Input History Navigation

- Press Up arrow in an empty input box to load the previous prompt.
- Press Down arrow to move forward through history.
- History persists across sessions (last 100 entries).
- Ctrl+Up opens a full history browser modal with search.

### Multi-Select Messages

- Shift+click any two messages to select the range between them.
- A floating action bar appears above the selection:
  - "Use as context" — injects selected messages as context for the next turn.
  - "Export selected" — exports to Markdown or JSON.
  - "Delete selected" — removes from session history with confirmation.

### @ Mention Autocomplete

Typing `@` in the input box opens an autocomplete dropdown:

| Prefix | Resolves to |
|--------|-------------|
| `@filename` | Files in the workspace |
| `@agent` | Named MAOS agents (kc-main, kc-01 … kc-20) |
| `@rules` | Active rules files |
| `@url` | Recently visited URLs (from Browser Tab history) |

Arrow keys navigate; Enter or Tab inserts; Escape dismisses.

### / Command Autocomplete

Typing `/` opens the slash-command dropdown:

| Command | Action |
|---------|--------|
| `/new` | Start a new chat session |
| `/clear` | Clear the current session history |
| `/mode` | Switch KiloCode mode |
| `/agent` | Switch to a specific MAOS agent |
| `/preset` | Apply a saved preset |
| `/compact` | Summarize and compact the context |

### Prompt Enhancer

The sparkle button (next to the send button) rewrites the current input using an AI pass:

- Improves structure, adds relevant context hints, fixes grammar.
- Shows a before/after diff in a small popover before committing.
- The enhancement model is configurable (defaults to the fastest available model).
- Can be toggled off entirely in Settings → Display.

### Follow-Up Suggestion Chips

After each assistant response, up to 3 contextually-relevant follow-up prompts are shown as clickable chips beneath the message. Clicking a chip inserts it into the input box (it is not sent automatically). Chips can be dismissed individually.

### Live Token Estimate on Input

As the user types, a small label to the right of the input box updates to show "~N tokens", reflecting the approximate token count of the current draft plus the current context. The estimate uses a client-side tokenizer approximation.

---

## Hub / Open WebUI Integration

### Hub Model Browser

A new dedicated model browser panel within the Hub Tab:

- Lists all models available on the connected Hub instance.
- Per-model cards show: name, parameter count, quantization, RAM requirement, and pull status (Not pulled / Pulling / Available).
- One-click pull initiation directly from the browser.
- Filter by tag, size class, and availability.

### Direct API vs. Via Hub Toggle

A toggle on the model selector and in the Hub Tab allows routing inference requests:

- **Direct API**: requests go directly from the extension host to the provider API.
- **Via Hub relay**: requests are proxied through the Hub instance (useful for shared API key management or local model routing).

### Model Download Progress Bars

When a model pull is in progress, a progress bar appears in the Hub Tab and as a compact inline indicator in the model switcher popover. Download speed and ETA are shown when available.

### Hub Connection Status Widget

A persistent status dot in the bottom-right corner of the chat panel:

- Green: Hub connected and healthy.
- Amber: Hub connecting or degraded.
- Red: Hub unreachable.
- Grey: Hub not configured.

Clicking the dot opens the Hub Tab settings panel.

### Hub Models in Model Switcher

Models available via the connected Hub instance appear in the model switcher with an "H" badge to distinguish them from direct-API models. Hub models that require a pull show a download icon instead.

---

## Task & Agent Awareness

### Live MAOS Agent Status Panel

A collapsible panel in the chat sidebar lists all 21 agents (kc-main + kc-01 through kc-20):

| Column | Content |
|--------|---------|
| Agent | Name and role badge |
| Status | Idle / Active / Waiting / Error |
| Current Action | Last reported action string |
| Steps | Steps taken in the current task |

The panel updates in real time via the existing SSE channel.

### Task Timeline

A horizontal Gantt-style bar chart shows each agent's contribution across the current task duration:

- Each agent occupies one row; bars are colour-coded by agent role.
- Hovering a bar segment shows the action performed during that interval.
- The timeline is scrollable and zoomable (scroll-wheel or pinch).
- Exported as SVG from the panel's overflow menu.

### Task Progress Estimation with ETA

When a multi-agent task is running:

- A progress bar in the task header shows estimated completion percentage.
- An ETA label (e.g. "~2 min remaining") is displayed and updated as agents complete steps.
- ETA is derived from rolling averages of similar historical tasks.

### Agent Workload Distribution Donut Chart

A small donut chart in the task header visualizes each agent's share of the total step count for the current task. Hovering a segment highlights the corresponding agent row in the status panel.

### Interrupt and Redirect

At any point during a running task:

- An "Interrupt" button stops all active agents gracefully (in-flight tool calls are allowed to complete).
- A "Redirect" input appears after interruption; the user can type a new instruction and resume.
- Interrupt state is logged to the session history.

---

## File Change Tracking

### Inline File Diff Preview in Chat Messages

When an agent edits a file, the corresponding chat message includes a collapsible inline diff:

- Unified diff format with syntax-highlighted lines.
- "Apply" and "Revert" buttons per diff block.
- Diff is read-only once applied; a "View in editor" link opens the file in a diff editor pane.

### File Change Timeline Panel

A side panel (accessible from the chat toolbar) with a "Changes (N)" badge showing all file changes made during the current session:

- Chronological list of changed files with timestamp and change type (created / modified / deleted).
- Click any entry to view the diff.
- Filter by agent, file type, or time range.

### Multi-File Edit Preview Card

Before an agent applies a set of edits spanning multiple files, a preview card is shown in chat:

- Lists all files to be modified with per-file line delta (+N / -N).
- "Apply all", "Apply selected", and "Cancel" actions.
- Each file row expands to show the full diff before committing.

### Checkpoint Auto-Create Toast Badge

When the system automatically creates a checkpoint (based on configured triggers), a brief toast badge appears in the bottom-right corner: "Checkpoint created — N files". Clicking the badge navigates to the Checkpoints Tab.

---

## Keyboard and Accessibility

### Global Shortcut Registry

All KiloCode keyboard shortcuts are registered in a central registry and exposed via a Ctrl+? help modal:

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Send message |
| Escape | Cancel in-progress generation |
| Ctrl+N | New chat session |
| Ctrl+H | Open session history |
| Ctrl+F | Search in chat |
| Ctrl+I | Open context inspector |
| Ctrl+B | Open bookmarks panel |
| Ctrl+Shift+K | Open global command bar |
| Ctrl+Shift+C | Toggle compare / split view |
| Ctrl+Shift+T | Open token optimizer |
| Alt+Up / Alt+Down | Navigate between messages |
| Ctrl+? | Show shortcut reference modal |

### Full Focus Trapping for Modals

All modal dialogs (compare mode, context inspector, command bar, prompt enhancer diff popover) trap focus correctly. Tab cycles within the modal; Escape closes it and returns focus to the triggering element.

### Skip Links for Accessibility

Skip links are injected at the top of the chat panel markup:

- "Skip to chat input"
- "Skip to message list"
- "Skip to agent status panel"

Skip links are visible on focus (keyboard) and hidden otherwise. They comply with WCAG 2.1 AA success criterion 2.4.1.

---

## Theme and Visual Customization

### Custom Accent Color Picker

In Settings → Display, a color picker allows choosing a custom accent color applied to:

- Active borders, focus rings, selected states.
- Badge backgrounds, chip fill, progress bar fill.
- The chosen color is validated for minimum WCAG contrast ratio against both light and dark VS Code themes.

### Chat Message Density

Three density options, selectable in Settings → Display:

| Option | Line height | Padding |
|--------|-------------|---------|
| Compact | 1.3 | 6 px 8 px |
| Normal | 1.6 | 10 px 12 px |
| Spacious | 1.9 | 16 px 20 px |

### Chat Bubble Style

Three bubble style options:

| Style | Description |
|-------|-------------|
| Bubble | Rounded card with background fill per sender |
| Flat | No background; left border accent only |
| Minimal | Plain text, no visual container |

### Custom Font Family Selector

A dropdown in Settings → Display allows choosing the chat font family from:

- System UI (default)
- VS Code Editor Font (inherits `editor.fontFamily`)
- Inter, JetBrains Mono, Fira Code, Source Code Pro (bundled web fonts)
- Custom — free-text input for any font available on the host

### Code Block Theme

The code block syntax theme selector (introduced in canary.9) is now properly wired to the CSS custom-property layer. Changes apply immediately to all rendered code blocks without a webview reload.

Supported themes: `default`, `github-dark`, `dracula`, `monokai`, `nord`, `solarized-dark`, `one-dark`.

### Reduced Motion Toggle

An explicit toggle in Settings → Display respects the user's `prefers-reduced-motion` OS setting by default but can also be forced on or off independently of the OS preference. When enabled:

- All CSS transitions are reduced to instant or cross-fade only.
- Animated panels (thinking visualization, badge pulse, skeleton shimmer) are replaced with static indicators.

### High Contrast Mode Toggle

An explicit high-contrast toggle in Settings → Display applies a high-contrast CSS layer on top of the active VS Code theme, regardless of the OS accessibility setting.

- Increases text/background contrast ratios to WCAG AAA levels.
- Removes decorative gradients and drop shadows.
- Increases focus ring width to 3 px.

---

## Architecture Notes

All canary.10 features are built on the existing webview ↔ extension host IPC layer (postMessage). New IPC handlers required for canary.10 features will be added incrementally as code agents complete their implementations. The features above are in active development; individual items may land across multiple interim builds before the canary.10 tag is cut.

---

## Upgrade Notes

1. **Canary.9 compatibility**: all canary.9 settings and session data are forward-compatible with canary.10. No migration step is required.
2. **Code execution**: Inline code execution requires that the target language runtime be available on the system PATH accessible to VS Code's integrated terminal. No new VS Code permissions are needed.
3. **Hub relay**: The Direct API / Via Hub toggle requires Hub instance version 0.4.0 or later for the relay endpoint to be available.
4. **High contrast + custom accent**: If both high contrast mode and a custom accent color are active simultaneously, the high contrast contrast-ratio requirement takes precedence; the accent color may be auto-adjusted.

---

## Wave-3 Improvements (post-initial release)

> 13 additional game-changing improvements delivered after initial canary.10 release. All carry 0 TypeScript errors.

| Feature | Lines | Impact |
|---|---|---|
| **ToolCallBlock** — collapsible tool invocations with state machine, timing, diff stats | 444 | Full tool-call transparency |
| **EnhancedCodeBlock** — language badge, copy, line numbers, diff-aware, open-in-editor | 302 | Best-in-class code block UX |
| **ConversationExport** — Markdown/JSON/HTML/Plain text modal with range/include options | 495 | One-click conversation archiving |
| **MessageSearch** — Ctrl+F floating search, highlight + X-of-Y navigation | 259 | Instant message retrieval |
| **ProviderCapabilityMatrix** — 28-provider grid: vision, context, price, speed | 692 | At-a-glance provider comparison |
| **AdvancedModelParams** — temperature, top-p/k, stop sequences, penalties, seed | 778 | Full parameter control per mode |
| **MCP Tools** — server health badges, tool permissions, auto-approve, test modal, import/export | +761 | Production-grade MCP management |
| **DisplayTab deep-dive** — accent swatches, opacity, layout presets, live preview pane | +421 | Fully personalizable in real-time |
| **VirtualMessageList** — virtual scroll for 500+ messages (virtua/solid, ResizeObserver) | 250 | No lag on long conversations |
| **performance.ts** — debounce, throttle, measureRender, createDerivedMemo utilities | 169 | Systematic perf toolkit |
| **TabSkeleton** — shimmer placeholder for all 24 lazy-loaded settings tabs | 155 | Perceived performance |
| **Accessibility (WCAG 2.1 AA)** — role/aria/focus-trap on 9 components + accessibility.css | 181 | Zero-discrimination UX |
| **PromptInput enhancements** — @mention pills, paste-image strip, Ctrl+↑↓ history, voice btn | 1469 | Richest input in any AI IDE extension |

See [`WAVE_3_SUMMARY.md`](./WAVE_3_SUMMARY.md) for full details.

---

## Known Issues in canary.10 (in development)

- Chat split / compare mode is not yet available on VS Code versions below 1.105.1.
- The task timeline SVG export may produce incorrect bar widths for tasks longer than 60 minutes (fix in progress).
- Follow-up suggestion chips are not yet generated for tool-use-only turns (turns where the assistant called tools but produced no prose).
- Live cost meter shows "?" for Hub-relay models until pricing metadata is surfaced by the Hub API.

---

*KiloCode MAOS Edition is open source — MIT License. Contributions welcome at https://github.com/Kilo-Org/kilocode.*
