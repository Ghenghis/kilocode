# Lessons Learned from KiloCode Voice System (epic/agent-enhancement)

## Critical Bugs Found and Fixed

### 1. VS Code Webview Autoplay Policy (ROOT CAUSE)
**Symptom**: Azure and RVC voices never played. User only heard browser robot voice.  
**Root cause**: `new Audio(blobUrl).play()` requires a user gesture in VS Code webviews. Azure/RVC synthesis is async (message bridge round-trip for RVC, network fetch for Azure). By the time the audio blob arrives, the gesture context has expired.  
**Fix**: Replace `HTMLAudioElement.play()` with Web Audio API (`AudioContext` + `AudioBufferSourceNode`). Resume the `AudioContext` synchronously during the user click, then all subsequent blob playback works without further gestures.  
**Key code**: `ensureAudioReady()` called at start of click handlers, `playBlobInternal()` uses `ctx.decodeAudioData()` + `sourceNode.start(0)`.

### 2. AudioCritic Rejecting Valid Audio
**Symptom**: Azure and RVC audio scored below 60/100 on quality checks, triggering error → fallback to browser.  
**Root cause**: Phase 7.3 AudioCritic ran 5 checks (RMS energy, peak amplitude, zero-crossing rate, duration, spectral flatness). Valid TTS audio from Azure/RVC sometimes failed 3+ checks, throwing an error that triggered the fallback chain.  
**Fix**: Demoted AudioCritic from blocking gate to info-only logging. Audio plays regardless of score.

### 3. Silent Fallback Chain Hiding Failures
**Symptom**: Speech Log showed green checkmarks for all providers, but user only heard browser voice.  
**Root cause**: `handleVoiceCompare()` ignored the `SpeechResult.usedFallback` field. It logged "OK" if no exception was thrown, even when audio silently fell back to browser. The fallback chain (RVC → Azure → Browser) always ran — if the primary failed, browser played automatically.  
**Fix**: (a) Disabled fallback by default (`allowFallback: false`). Each provider is isolated — if it fails, error is shown. (b) Fixed `handleVoiceCompare` to check `result.usedFallback` and display the actual provider used.

### 4. edge_tts Voice Mismatch (HTTP 500)
**Symptom**: RVC Docker container returned HTTP 500 on synthesize.  
**Root cause**: User had `en-US-AmberNeural` saved as baseline voice. The Docker container uses `edge_tts` library which only supports 17 en-US voices. AmberNeural is Azure-only and doesn't exist in edge_tts → `NoAudioReceived` exception.  
**Fix**: Created `EDGE_TTS_VOICES` list with only the 17 validated voices. Auto-correct saved settings on load.

### 5. Broken VSIX Missing CLI Binary
**Symptom**: Entire extension broke after installing new build — Azure, RVC, everything stopped.  
**Root cause**: Running `node esbuild.js` directly skips `prepare:cli-binary`. The resulting 16 MB VSIX was missing `kilo.exe` (174 MB). Must use `npm run package` which runs the full pipeline.  
**Fix**: Always use `npm run package -- --no-dependencies` then `npx @vscode/vsce package --no-dependencies`. Verify VSIX is ~75 MB (not 16 MB).

### 6. createEffect Infinite Loop
**Symptom**: SpeechTab froze on provider switch.  
**Root cause**: `createEffect` read `settings()` → called `refreshRvc()` → called `updateNested("rvc","dockerPort")` → called `setSettings()` → re-triggered the effect.  
**Fix**: Use `createMemo(() => settings().provider)` to derive a stable value that only re-triggers when the provider actually changes.

## Architecture Principles Validated

1. **No silent fallback**: When user picks a provider, use ONLY that provider. If it fails, show the error. Never secretly switch to another provider.
2. **Web Audio API over HTMLAudioElement**: In VS Code webviews, `AudioContext` is the only reliable way to play synthesized audio blobs.
3. **Message bridge for CORS**: Webviews cannot fetch `http://localhost` (CORS). All RVC communication must go through the extension host via `postMessage`.
4. **Full build pipeline**: Never shortcut the build. Missing binaries break everything silently.
5. **Test what the user hears**: The Speech Log must reflect reality. If fallback happened, show it.

## Files That Matter

| File | Purpose |
|------|---------|
| `webview-ui/src/utils/speech-playback.ts` | Core speech engine — synthesis + playback |
| `webview-ui/src/utils/audio-critic.ts` | Audio quality validation (info-only) |
| `webview-ui/src/components/settings/SpeechTab.tsx` | Speech settings UI + preview |
| `webview-ui/src/App.tsx` | Auto-speak in DataBridge |
| `src/KiloProvider.ts` | Extension host — RVC message routing |
| `webview-ui/src/data/azure-voices.ts` | Voice definitions for Azure + edge_tts |
