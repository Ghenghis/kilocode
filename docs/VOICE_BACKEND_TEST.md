# Voice Backend Switch Test Plan

Verifies that TTS voice output is unchanged when the user switches the execution backend
between Kilo Native, OpenHands, and Goose.

---

## Pre-conditions

- [ ] Azure TTS key configured: `kilo-code.new.speech.azure.apiKey` is non-empty.
- [ ] Azure region set: `kilo-code.new.speech.azure.region` = `westus` (or your region).
- [ ] Voice selected: `kilo-code.new.speech.azure.voiceId` = `en-GB-MaisieNeural` ("Maisie UK").
- [ ] Provider set: `kilo-code.new.speech.provider` = `azure`.
- [ ] Auto-speak on: `kilo-code.new.speech.autoSpeak` = `true`.
- [ ] Master toggle on: `kilo-code.new.speech.enabled` = `true`.
- [ ] VS Code native speech enabled: `speech.speechSynthesis.enabled` = `true`.

---

## Test 1 — Kilo Native backend speaks in Maisie UK

**Steps:**
1. Confirm the backend pill shows "Kilo".
2. Type a short message in the chat input and press Enter.
3. Wait for the assistant to respond and the session to go idle.

**Expected:** "Maisie UK" Azure neural voice speaks the assistant's reply.

**Result:** ✓ / ✗

---

## Test 2 — Switch to OpenHands: same voice speaks

**Steps:**
1. Click the backend pill in the chat toolbar.
2. Select "OpenHands Dev".
3. Type a short message and press Enter.
4. Wait for the assistant to respond and the session to go idle.

**Expected:** The same "Maisie UK" Azure voice speaks — no voice reset.

**Verify:** Open VS Code Settings and confirm `kilo-code.new.speech.azure.voiceId` is still
`en-GB-MaisieNeural`.

**Result:** ✓ / ✗

---

## Test 3 — Switch to Goose: same voice speaks

**Steps:**
1. Click the backend pill.
2. Select "Goose Operator".
3. Type a short message and press Enter.
4. Wait for the assistant to respond and the session to go idle.

**Expected:** The same "Maisie UK" Azure voice speaks — no voice reset.

**Verify:** `kilo-code.new.speech.azure.voiceId` remains `en-GB-MaisieNeural`.

**Result:** ✓ / ✗

---

## Test 4 — Switch back to Kilo: voice profile unchanged

**Steps:**
1. Click the backend pill.
2. Select "Kilo".
3. Open the Kilo Code SpeechTab (Settings → Speech).

**Expected:**
- Provider is still "Azure".
- Selected voice is still "Maisie (UK)" / `en-GB-MaisieNeural`.
- Auto-speak is still enabled.
- No other speech settings have changed.

**Result:** ✓ / ✗

---

## Test 5 — localStorage isolation check

**Steps:**
1. Open webview developer tools: Command Palette → "Developer: Open Webview Developer Tools".
2. Navigate to Application → Local Storage.
3. Inspect the `kilocode_backend_state` key.

**Expected:** The value contains only backend routing fields (`activeBackend`, `backends`,
`profiles`, `isRunning`, `routingMode`).  It does NOT contain `speech`, `voice`, `tts`,
`azure`, `voiceId`, or `autoSpeak` keys at any nesting level.

**Result:** ✓ / ✗

---

## Architecture notes

### Where voice state is stored

Voice settings live exclusively in VS Code workspace/user settings under the
`kilo-code.new.speech.*` prefix.  They are loaded once on webview init via the
`requestSpeechSettings` / `speechSettingsLoaded` message pair and are never touched
by backend switching code.

### Was TTS already backend-agnostic?

Yes.  The auto-speak logic in `App.tsx` listens to `session.status()` (busy→idle
transition) and reads from the `speechSettings()` SolidJS signal.  Neither the signal
nor its source (`KiloProvider.sendSpeechSettings`) is called from any backend-switching
code path.  The `BackendContext` and `BackendSelector` components do not import or
reference any speech utilities.

### What was added

1. `packages/kilo-vscode/webview-ui/src/utils/voice-bridge.ts` — a new module that:
   - Exposes `speakAgentResponse()` as a public, backend-agnostic TTS entry-point.
   - Maintains a module-level settings cache updated only via `updateVoiceSettings()`.
   - Exposes `onBackendChanged()` as an explicit no-op with a contract comment.
   - Exposes `subscribeVoiceState()` for reactive consumers.

2. `packages/kilo-vscode/webview-ui/src/App.tsx` — the `speechSettingsLoaded` handler
   now calls `updateVoiceSettings(msg.settings)` to keep the bridge cache in sync.

No existing TTS logic was modified.  The changes are additive.

### Files modified

| File | Change |
|------|--------|
| `packages/kilo-vscode/webview-ui/src/utils/voice-bridge.ts` | Created (new file) |
| `packages/kilo-vscode/webview-ui/src/App.tsx` | Added `import { updateVoiceSettings }` and one `updateVoiceSettings(msg.settings)` call |
| `docs/VOICE_PERSISTENCE_VERIFICATION.md` | Created (verification doc) |
| `docs/VOICE_BACKEND_TEST.md` | Created (this file) |

### Issues found

None.  The codebase was already cleanly isolated: backend state and speech state live in
separate storage namespaces and separate code paths.  The voice bridge adds a well-documented
public API layer and makes the isolation explicit and testable.
