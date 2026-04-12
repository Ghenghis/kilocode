# Session Handoff — KiloCode Azure Voice Edition

## For New Session: Read This First

This document gives a new Claude session everything needed to implement the Azure Voice Edition without repeating mistakes from the original project.

## Project Identity

- **Repo**: https://github.com/Ghenghis/Kilocode-Azure
- **Local path**: `G:\Github\kilocode-Azure`
- **Base**: Fork of KiloCode v7.2.1 (from `G:\Github\kilocode`)
- **Branch**: Work on `main` (fresh repo, no complex branch structure)
- **Goal**: Strip out RVC Docker + browser fallback. Azure TTS is the only voice provider.

## User Preferences (NON-NEGOTIABLE)

- **No stubs, no placeholders** — real working code only
- **No claiming it works without testing** — verify before saying "fixed"
- **Default voice**: en-GB-MaisieNeural (UK female)
- **Azure API region**: westus
- **Azure API key**: User will provide in VS Code settings
- **User's test phrase**: "Hello, this is a preview of the speech output."

## What to Read

1. `docs/plans/LESSONS-LEARNED.md` — Critical bugs and fixes from original project
2. `docs/plans/AZURE-VOICE-EDITION-SPEC.md` — Full technical spec for what to build
3. This file — session context and warnings

## Critical Technical Knowledge

### VS Code Webview Autoplay Policy
**THE #1 GOTCHA.** VS Code webviews block `new Audio(blob).play()` unless called during a user gesture. Azure synthesis is async (network fetch), so the gesture context expires before the blob arrives.

**MUST USE**: Web Audio API (`AudioContext` + `AudioBufferSourceNode`).
- Call `ensureAudioReady()` synchronously in click handlers (before any `await`)
- `AudioContext` stays resumed for the entire session after one gesture
- `sourceNode.start(0)` replaces `audio.play()` — no autoplay restriction

### Build Pipeline
```bash
cd packages/kilo-vscode
npm run package -- --no-dependencies     # FULL pipeline: typecheck + lint + esbuild
npx @vscode/vsce package --no-dependencies  # Create VSIX
code --install-extension kilo-code-*.vsix --force
```
- **NEVER** run `node esbuild.js` alone — it skips `prepare:cli-binary`
- **ALWAYS** verify VSIX is ~75 MB (not 16 MB)
- After install: Ctrl+Shift+P → "Reload Window"

### Azure TTS API
```
POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1
Headers:
  Ocp-Apim-Subscription-Key: {apiKey}
  Content-Type: application/ssml+xml
  X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3
Body:
  <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <voice name="en-GB-MaisieNeural">{escaped text}</voice>
  </speak>
Response: MP3 audio blob
```
- 401 = invalid key
- 403 = key lacks TTS permissions
- 429 = rate limited
- Blob < 100 bytes = empty audio (bad voice ID or region)

### Solid.js Gotchas (Webview UI Framework)
- `createEffect` + `setSettings()` inside the effect = infinite loop
- Use `createMemo(() => settings().specificField)` to prevent re-triggers
- Import everything explicitly: `import { createSignal, createEffect, createMemo, ... } from "solid-js"`

## Implementation Order

### Phase 1: Strip RVC (clean the codebase)
1. Remove RVC message types from `types/messages.ts`
2. Remove RVC handlers from `KiloProvider.ts` (rvcHealth, rvcVoices, rvcSynthesize, rvcFindPort, rvcHttpGet, rvcHttpPostBinary)
3. Remove RVC bridge from `speech-playback.ts` (synthesizeRvc, setRvcBridge, getRvcBridge)
4. Remove RVC bridge registration from `App.tsx` and `SpeechTab.tsx`
5. Remove RVC from fallback chain in `speech-playback.ts`
6. Remove AudioCritic import and calls (no longer needed without multi-provider complexity)
7. Remove `VoiceStudioProvider.ts` RVC proxy code
8. Remove `EDGE_TTS_VOICES` from `azure-voices.ts`

### Phase 2: Azure-Only Speech Engine
1. Simplify `SpeechConfig` — remove `rvc`, `browser`, `allowFallback` fields
2. Simplify `SpeechEngine.speak()` — Azure only, no fallback chain
3. Keep `ensureAudioReady()` and Web Audio API playback (critical!)
4. Keep `SynthesisCache` for performance
5. Keep `synthesizeAzure()` as-is (it works)

### Phase 3: UI — Azure Voice Settings
1. Remove provider tab bar (Browser | Azure | RVC)
2. Add API key input with validation button and green/red indicator
3. Add region dropdown (westus, eastus, westeurope, etc.)
4. Build grouped voice dropdown (all English voices by locale)
5. Default to en-GB-MaisieNeural
6. Keep Preview button and Speech Log

### Phase 4: Voice Catalog
1. Expand `azure-voices.ts` with full English voice catalog (100+ voices)
2. Group by locale: en-GB, en-US, en-AU, en-IN, en-IE, en-CA, en-NZ, etc.
3. Include: ID, locale, display name, gender
4. Source: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts

### Phase 5: Defaults & Polish
1. Change default provider from "browser" to "azure" everywhere
2. Change default voice from "en-US-JennyNeural" to "en-GB-MaisieNeural"
3. Update package.json: name, version "7.2.1", displayName "KiloCode - Azure Voice Edition"
4. Build, install, test end-to-end

## Files Reference (from base KiloCode)

| File | What's There | What to Do |
|------|-------------|------------|
| `webview-ui/src/utils/speech-playback.ts` | Full engine with RVC+Azure+Browser | Strip to Azure-only |
| `webview-ui/src/utils/audio-critic.ts` | AudioCritic + SynthesisCache | Keep SynthesisCache, remove AudioCritic |
| `webview-ui/src/components/settings/SpeechTab.tsx` | 3-provider UI with tabs | Azure-only UI |
| `webview-ui/src/App.tsx` | DataBridge with RVC bridge + auto-speak | Remove RVC bridge, simplify config |
| `webview-ui/src/data/azure-voices.ts` | Azure + edge_tts voice lists | Full English catalog, grouped |
| `webview-ui/src/types/messages.ts` | RVC message types | Remove RVC types |
| `src/KiloProvider.ts` | RVC message handlers + settings | Remove RVC handlers |
| `src/VoiceStudioProvider.ts` | RVC proxy + voice studio | Simplify or remove |
| `package.json` | Version, name, dependencies | Update for Azure Edition |

## Test Checklist

- [ ] Fresh install: no API key → shows red indicator, no crash
- [ ] Enter valid key → green indicator, "Connected"
- [ ] Enter invalid key → red indicator, specific error message
- [ ] Voice dropdown shows 100+ English voices grouped by locale
- [ ] Default voice is en-GB-MaisieNeural
- [ ] Play Preview → hear Maisie's voice (not robot)
- [ ] Auto-speak in chat → hear Maisie's voice on assistant replies
- [ ] Stop button halts playback
- [ ] Volume slider works
- [ ] Speech Log shows "azure" provider with ✓
- [ ] VSIX is ~75 MB (includes CLI binary)
- [ ] No RVC errors in console
- [ ] No browser fallback — if Azure fails, error shown (not robot voice)
