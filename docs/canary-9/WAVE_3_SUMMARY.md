# KiloCode canary.10 — Wave-3 Improvements

> Wave-3 added 13 game-changing improvements on top of the 18 canary.10 wave-2 components. All fully implemented, 0 TypeScript errors.

## Feature Matrix

| Feature | File | Lines | Category | Wired Into |
|---|---|---|---|---|
| ToolCallBlock | `chat/ToolCallBlock.tsx` | 444 | Chat UX | AssistantMessage.tsx, VscodeSessionTurn.tsx |
| EnhancedCodeBlock | `chat/EnhancedCodeBlock.tsx` | 302 | Chat UX | AssistantMessage.tsx (DOM injection) |
| ConversationExport | `chat/ConversationExport.tsx` | 495 | Chat UX | TaskHeader.tsx |
| MessageSearch | `chat/MessageSearch.tsx` | 259 | Chat UX | MessageList.tsx |
| ProviderCapabilityMatrix | `settings/ProviderCapabilityMatrix.tsx` | 692 | Settings | ProvidersTab.tsx |
| AdvancedModelParams | `settings/AdvancedModelParams.tsx` | 778 | Settings | ModeEditView.tsx |
| MCP Tools enhancements | `settings/AgentBehaviourTab.tsx` | +761 | Settings | inline |
| DisplayTab theming | `settings/DisplayTab.tsx` | 1089→1510 | Settings | inline |
| VirtualMessageList | `chat/VirtualMessageList.tsx` | 250 | Performance | ChatView.tsx, MessageList.tsx |
| performance.ts | `utils/performance.ts` | 169 | Performance | — (utilities) |
| TabSkeleton | `settings/TabSkeleton.tsx` | 155 | Performance | Settings.tsx |
| Accessibility pass | 9 files + `styles/accessibility.css` | 181 | a11y | all canary.10 components |
| PromptInput enhancements | `chat/PromptInput.tsx` | 1469 | Chat UX | inline |
| useComposeDraft | `hooks/useComposeDraft.ts` | 183 | Chat UX | PromptInput.tsx |

---

## Wave-3 Feature Details

### ToolCallBlock
Replaces raw `<pre>` tool output with collapsible blocks featuring:
- **State machine**: pending (pulsing dot) → running (spinner) → success (✓) → error (✗)
- **Per-tool timing**: "ran in 342ms" shown after completion
- **Collapsible JSON input**: syntax-highlighted (key/string/number/bool/null), collapsed by default
- **Streaming output**: 8-line truncation with "Show N more lines" toggle, live pulse while streaming
- **File path links**: output file paths post `openFile` message to extension
- **Diff stat**: `+N −M` lines shown when file was modified
- **Retry**: error state shows error text + "Retry" button posting `retryToolRequest`
- **Categories** (border color): file ops=blue, shell=orange, web=purple, code=green, other=gray
- CSS: `tool-call-block.css` (imported in chat.css)

### EnhancedCodeBlock
DOM-injection enhancement (same pattern as existing run-buttons) wrapping all `<pre>` blocks with:
- Language badge (top-left), detected from fence language
- Copy button → "Copied!" 2s feedback
- Line numbers toggle (click count)
- Word-wrap toggle
- "Open in editor" → `openInEditorRequest` message
- "Run in terminal" for bash/sh/python/node → `runInTerminalRequest`
- **Diff-aware rendering**: detects unified diff format, colors `+`/`-`/`@@` lines
- **Max-height collapse**: >20 lines collapses to 12 with "Show N more" expander
- CSS: `enhanced-code-block.css` (530 lines)

### ConversationExport
Full modal triggered from TaskHeader export button:
- **Formats**: Markdown / JSON / HTML (self-contained) / Plain text
- **Range**: Full conversation / Last N messages / Selected messages
- **Include options**: Tool calls, Timestamps, System prompt
- Browser `Blob` download, no server round-trip

### MessageSearch
Ctrl+F floating search bar:
- Highlights all matches via `<mark>` injection
- "X of Y" counter, up/down navigation
- ESC dismisses and clears highlights
- Refactored from inline MessageList code to standalone `MessageSearchHandle` ref

### ProviderCapabilityMatrix
Visual grid inside ProvidersTab (collapsible):
- 7 capability columns: Vision, Function Calling, Streaming, Context >100k, >200k, Price tier, Speed tier
- Per-provider `$/1M tokens` estimated cost (static lookup, 28 providers)
- ✓/✗/~/— with green/red/amber/gray color coding
- Clicking a row scrolls to that provider's config section

### AdvancedModelParams
Collapsible panel in ModeEditView (blue dot when any param overridden):
- Temperature (0–2.0) with preset snap buttons
- Top-P (0–1), Top-K (1–200, provider-conditional)
- Max tokens input with model-default hint
- Stop sequences tag input (max 4)
- System prompt override textarea with char counter + "Reset to global"
- Frequency/presence penalties (OpenAI-compatible providers only)
- Seed input
- "Reset all to defaults" clears all to `undefined`

### MCP Tools Enhancements (AgentBehaviourTab +761 lines)
- **Server health badges**: 🟢 Connected / 🟡 Connecting / 🔴 Disconnected / ⚪ Not started
- **Reconnect button** per disconnected server
- **Tool permissions panel**: per-server expandable list of tools with auto-approve checkboxes
- **Test tool modal**: sends `testMcpTool` message, shows result (success/error)
- **Import/Export**: JSON config download + file-input import

### DisplayTab Theming (1089 → 1510 lines)
- 10-preset accent color swatches (circular, active highlighted)
- Bubble background opacity slider (0–30%), live CSS var update
- Code block theme **live preview** with tokenized sample showing actual theme colors
- Typography section: font size (12–20px), font family, line height presets, letter spacing
- 4 **layout presets**: Minimal / Standard / Comfortable / Developer
- **200px live preview pane**: fake exchange updating in real-time as settings change

### VirtualMessageList
Virtual scroll for 500+ message conversations:
- Uses `virtua/solid` (existing project dep) with `overscan={10}`
- `ResizeObserver` per row for accurate variable-height measurement
- Stick-to-bottom while `working()` is true, unsticks on manual scroll
- `scrollToMessage(id)` and `scrollToBottom()` imperative handles via ref

### performance.ts (169 lines)
- `debounce<T>(fn, ms)` — leading-edge with trailing call
- `throttle<T>(fn, ms)` — throttle with trailing final value
- `measureRender(name)` — `performance.mark`/`measure` wrapper
- `createDerivedMemo<T>(deps, compute)` — shallow-deep equality before recompute

### TabSkeleton (155 lines)
Shimmer-loading placeholder for all 24 lazy-loaded settings tabs:
- CSS keyframe shimmer animation
- Matches approximate tab content layout (heading, description, setting rows, toggle)

### Accessibility Pass (WCAG 2.1 AA)
All 9 canary.10 components updated:
- `role` attributes: toolbar, dialog, combobox, listbox, complementary, group, article
- `aria-label` / `aria-labelledby` / `aria-describedby` on all interactive elements
- `aria-live="polite"` regions for search results, agent status, new message badge
- `aria-expanded`, `aria-selected`, `aria-controls`, `aria-busy`, `aria-modal`
- `aria-hidden="true"` on all decorative icons/spans
- `focusTrap.ts` enhanced: `aria-hidden` on background content, `returnFocus` option
- `accessibility.css` (181 lines): `.sr-only`, `:focus-visible` outlines, reduced-motion, high-contrast

### PromptInput Enhancements (1469 lines total)
- **@mention autocomplete**: floating dropdown, arrow-key nav, Enter/Tab/Escape, pill chip insertion
- **Paste image**: base64 attachment strip above send, ✕ per thumbnail, sent in `attachments[]`
- **Compose history**: Ctrl+↑↓ navigates last 50 sent messages, draft saved/restored
- **Voice input button**: posts `requestVoiceInput`, tooltip for unsupported environments
- `useComposeDraft.ts` (183 lines): sessionStorage persistence, debounced 300ms

---

## New CSS Files Added (wave-3)

| File | Lines | Purpose |
|---|---|---|
| `styles/tool-call-block.css` | ~220 | ToolCallBlock states, categories, JSON syntax |
| `styles/enhanced-code-block.css` | 530 | Code block toolbar, diff colors, collapse |
| `styles/accessibility.css` | 181 | sr-only, focus-visible, reduced-motion, high-contrast |
| `styles/prompt-input.css` | ~250 | Mention dropdown, attachment strip, voice btn |

---

## New Message Types Added (wave-3)

| Type | Direction | Purpose |
|---|---|---|
| `testMcpTool` | Webview→Extension | Trigger MCP tool test |
| `testMcpToolResult` | Extension→Webview | MCP tool test result |
| `ActionRequest` | Webview→Extension | Generic action dispatch |
| `PreviewFileEditsMessage` | Both | File edit preview |
| `reloadWindowRequest` | Webview→Extension | Reload VS Code window |
| `resumeStreamRequest` | Webview→Extension | Resume stalled stream |
| `retryLastRequest` | Webview→Extension | Retry last message |
| `extensionDisconnected` | Extension→Webview | Extension host disconnected |
| `streamError` | Extension→Webview | Streaming error |

---

## TypeScript Status
**0 errors** confirmed across all wave-3 additions (multiple independent `npx tsc --noEmit` runs).

---

## Wave-3 Total: ~5,000 new lines across 14 new/heavily-modified files
