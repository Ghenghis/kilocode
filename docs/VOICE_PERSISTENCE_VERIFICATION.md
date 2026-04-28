# Voice Persistence Verification

This document describes where voice/speech settings are stored, which code paths read and
write them, and how the codebase guarantees that switching the execution backend
(Kilo Native, OpenHands, Goose) never resets or modifies those settings.

---

## 1. Voice storage locations

### VS Code workspace / user settings (primary store)

All speech settings are persisted under the `kilo-code.new.speech.*` prefix in VS Code's
standard settings system (user `settings.json` or workspace `settings.json`).  They survive
extension reloads, workspace switches, and backend changes.

Key settings:

| VS Code setting key                         | Type        | Default                  | Description                              |
|---------------------------------------------|-------------|--------------------------|------------------------------------------|
| `kilo-code.new.speech.enabled`              | boolean     | `true`                   | Master on/off toggle                     |
| `kilo-code.new.speech.autoSpeak`            | boolean     | `true`                   | Auto-speak every assistant reply         |
| `kilo-code.new.speech.provider`             | string      | `"browser"` (or `"azure"` when key is set) | Active TTS provider |
| `kilo-code.new.speech.azure.voiceId`        | string      | `"en-GB-MaisieNeural"`   | Azure neural voice ("Maisie UK")         |
| `kilo-code.new.speech.azure.apiKey`         | string      | `""`                     | Azure Cognitive Services key             |
| `kilo-code.new.speech.azure.region`         | string      | `"westus"`               | Azure region                             |
| `kilo-code.new.speech.volume`               | number      | `80`                     | Master volume 0–100                      |
| `kilo-code.new.speech.tuning.*`             | object      | (see defaults)           | Pitch, rate, style, pronunciations, etc. |
| `kilo-code.new.speech.favorites.*`          | object      | (Maisie starred)         | Starred voices and presets               |

### localStorage (backend state — separate namespace)

Backend selection is stored in `localStorage` under the key `kilocode_backend_state`.
This is a completely different namespace from speech settings and does not overlap with
any `kilo-code.new.speech.*` key.

---

## 2. All code paths that read / write voice settings

### Extension host (reads + serves settings)

| File | Function | Direction |
|------|----------|-----------|
| `src/KiloProvider.ts` `sendSpeechSettings()` (line ~2481) | Reads `kilo-code.new.speech.*` from VS Code config and posts `speechSettingsLoaded` to the webview | **Read** |
| `src/KiloProvider.ts` case `"saveSpeechSettings"` (called from SpeechTab) | Writes individual settings back via `vscode.workspace.getConfiguration(...).update(...)` | **Write** |
| `src/KiloProvider.ts` case `"validateAzureKey"` | Reads `apiKey` + `region` for a one-shot HTTP validation | **Read** |

### Webview (reads settings)

| File | Description |
|------|-------------|
| `webview-ui/src/App.tsx` — `unsubSpeech` handler | Receives `speechSettingsLoaded` and calls both `setSpeechSettings()` (SolidJS signal) and `updateVoiceSettings()` (voice-bridge cache). **Never writes.** |
| `webview-ui/src/App.tsx` — auto-speak `createEffect` | Reads the SolidJS `speechSettings()` signal to decide whether to speak after a busy→idle transition. **Never writes.** |
| `webview-ui/src/utils/voice-bridge.ts` — `updateVoiceSettings()` | Updates the module-level `_currentSettings` cache. Called only from the `speechSettingsLoaded` handler. **Never writes to VS Code settings.** |
| `webview-ui/src/components/settings/SpeechTab.tsx` | Displays a full editor for all speech settings; writes via `saveSpeechSettings` message on explicit user save. **Only fires on deliberate user action.** |

---

## 3. Confirmation that none of these are triggered by backend switching

### How backend switching works

`BackendSelector.tsx` calls `backend.setActiveBackend(id)` which:

1. Updates the `kilocode_backend_state` localStorage key via `BackendContext.saveState()`.
2. Posts `{ type: "backendStateChanged", state }` to the extension host.

Neither step reads or writes any `kilo-code.new.speech.*` key.  The extension host handler
for `backendStateChanged` (in `KiloProvider.ts`) only updates the backend routing state;
it never calls `sendSpeechSettings()` or touches the speech configuration section.

### Verified absence of cross-coupling

A codebase search for patterns that would couple backend switching to voice state found zero
matches for:

- `if (provider|backend|mode) .* (voice|speech|tts|azure)` — no conditional voice writes
- Calls to `sendSpeechSettings()` outside of `case "requestSpeechSettings"` — not present
- `setSpeechSettings` called from `BackendContext` or `BackendSelector` — not present
- `updateVoiceSettings` called from `BackendContext` or `BackendSelector` — not present
  (it is only called from the `speechSettingsLoaded` message handler in App.tsx)

### Voice bridge contract

`voice-bridge.ts` exports `onBackendChanged(newBackend: string)` as an **intentional no-op**.
Its contract comment states explicitly: "This function MUST NOT read or write any voice/speech
settings."  Any future developer who tries to add `setVoice(...)` inside that function will
see the contract violation comment.

---

## 4. Fixes applied to ensure isolation

1. **Created `voice-bridge.ts`** — a new module at
   `packages/kilo-vscode/webview-ui/src/utils/voice-bridge.ts` that:
   - Maintains a local cache of the current `SpeechSettings`.
   - Exposes `speakAgentResponse()` as a backend-agnostic TTS entry-point.
   - Exposes `onBackendChanged()` as an explicit no-op to document the contract.
   - Exposes `subscribeVoiceState()` for reactive UI consumption.

2. **Wired `updateVoiceSettings()` in App.tsx** — the `speechSettingsLoaded` handler now
   calls `updateVoiceSettings(msg.settings)` alongside `setSpeechSettings(msg.settings)`,
   so the bridge cache always reflects the latest settings without requiring any additional
   message round-trips.

No existing code was removed or modified in a way that changes behaviour.  The changes are
purely additive.

---

## 5. Manual verification steps

### Pre-conditions

- Azure TTS configured: `kilo-code.new.speech.azure.apiKey` set, region `westus`,
  voice `en-GB-MaisieNeural` ("Maisie UK").
- `kilo-code.new.speech.enabled` = `true`.
- `kilo-code.new.speech.autoSpeak` = `true`.
- `kilo-code.new.speech.provider` = `azure`.

### Steps

1. **Baseline** — Open the chat sidebar.  Type a message to the agent.  Confirm that
   "Maisie UK" voice speaks the assistant's response.

2. **Switch to OpenHands** — Click the backend pill in the chat toolbar, select
   "OpenHands Dev".  Type a message.  Confirm the same Maisie UK voice speaks the
   response (or speaks a queued response once the session goes idle).

3. **Switch to Goose** — Click the backend pill, select "Goose Operator".  Type a message.
   Confirm the same Maisie UK voice still speaks.

4. **Switch back to Kilo Native** — Click the backend pill, select "Kilo".

5. **Verify voice unchanged** — Open VS Code Settings and confirm that
   `kilo-code.new.speech.azure.voiceId` is still `en-GB-MaisieNeural`.  Open the Kilo Code
   SpeechTab and confirm the selected voice is still "Maisie (UK)".

6. **Verify localStorage is untouched** — Open the webview developer tools
   (Command Palette → "Developer: Open Webview Developer Tools"), go to
   Application → Local Storage, and confirm that `kilocode_backend_state` does not
   contain any `speech` or `voice` keys.

### Expected result

The voice profile ("Maisie UK", Azure, autoSpeak on) is identical at every step.
No reset, no override, no side-effect from backend switching.
