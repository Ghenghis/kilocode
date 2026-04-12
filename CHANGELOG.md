# Changelog - KiloCode Azure Voice Edition

## [7.2.1] - Azure Voice Edition

### Major Changes

- **Azure as default and only voice provider** -- replaces stock browser TTS
- Default voice: **en-GB-MaisieNeural** (UK Maisie)
- 100+ premium English neural voices grouped by locale

### Added

- Azure API key input with live validation (green/red connection indicator)
- Region selector for Azure Speech endpoints
- Grouped voice dropdown: all English voices organized by locale
  - en-GB (British English) -- 14 voices
  - en-US (American English) -- 20+ voices
  - en-AU (Australian English) -- 11 voices
  - en-IN (Indian English) -- 4 voices
  - en-IE (Irish English) -- 2 voices
  - en-CA (Canadian English) -- 2 voices
  - en-NZ (New Zealand English) -- 2 voices
  - en-ZA (South African English) -- 2 voices
- Connection status monitoring with specific error messages
- Simplified SpeechConfig (Azure-only fields)

### Removed

- RVC Docker integration (container, bridge, port scanning, edge_tts voices)
- Browser TTS as default provider
- Fallback chain (RVC -> Azure -> Browser)
- AudioCritic blocking quality gate (kept as info-only logging)
- ChunkedSpeechPlayer RVC path
- VoiceStudioProvider RVC proxy
- All RVC message types and handlers in KiloProvider
- Provider tab bar (Browser | Azure | RVC)
- EDGE_TTS_VOICES list

### Kept

- Azure TTS synthesis (`synthesizeAzure()`)
- Web Audio API playback (`AudioContext` + `AudioBufferSourceNode`)
- SynthesisCache (LRU, 32 entries)
- Auto-speak on session idle
- Volume control
- Speech Log
- Preview button

### Technical

- Simplified `SpeechConfig` -- removed `rvc`, `browser`, `allowFallback` fields
- Simplified `SpeechEngine.speak()` -- Azure only, no fallback chain
- Updated `package.json`: version 7.2.1, displayName "KiloCode - Azure Voice Edition"
- Full English voice catalog in `azure-voices.ts` grouped by locale

| Before (7.2.0 base) | After (7.2.1 Azure Edition) |
|---------------------|----------------------------|
| 3 providers (RVC, Azure, Browser) | Azure only |
| Browser as default | Azure as default |
| en-US-JennyNeural default | en-GB-MaisieNeural default |
| Fallback chain on failure | Error shown on failure |
| RVC Docker required for premium voices | Azure API key only |
| AudioCritic gate blocking playback | No blocking gate |

---

## [7.2.0] - Base KiloCode

- Original KiloCode release with RVC + Azure + Browser voice providers
- Browser TTS as default
- RVC Docker integration for voice conversion
- AudioCritic quality gate
- Fallback chain: RVC -> Azure -> Browser
