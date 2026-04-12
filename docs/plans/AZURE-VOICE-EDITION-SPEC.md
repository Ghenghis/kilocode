# KiloCode 7.2.1 — Azure Voice Edition

## Overview
A clean fork of KiloCode with Azure TTS as the **default and primary** voice provider. No RVC Docker dependency, no browser fallback complexity. Azure voices replace the stock robot web voices out of the box.

**Repo**: https://github.com/Ghenghis/Kilocode-Azure  
**Local**: `G:\Github\kilocode-Azure`  
**Version**: 7.2.1 - Azure Voice Edition  
**Default voice**: en-GB-MaisieNeural (UK female)

## What Changes From Base KiloCode

### Remove
- RVC Docker integration (container, bridge, port scanning, edge_tts voices)
- Browser TTS as default provider
- Fallback chain (RVC → Azure → Browser)
- AudioCritic quality gate
- ChunkedSpeechPlayer RVC path
- VoiceStudioProvider RVC proxy
- All RVC message types and handlers

### Keep
- Azure TTS synthesis (`synthesizeAzure()`)
- Web Audio API playback (`AudioContext` + `AudioBufferSourceNode`)
- SynthesisCache for performance
- Auto-speak on session idle
- Volume control
- Speech Log
- Preview button

### Add/Change
- Azure as default provider (not browser)
- API key input with live validation (green/red indicator)
- Organized voice dropdown: all 100+ English voices grouped by locale
- Connection status indicator (green = connected, red = invalid key)
- Remove provider tab bar (Azure is the only provider)
- Simplified SpeechConfig (no rvc/browser fields needed for primary path)

## UI Design

### Speech Settings Panel (simplified)

```
┌─────────────────────────────────────────────────┐
│ Speech Settings                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│ Enable Speech    [toggle]                        │
│ Auto Speak       [toggle]                        │
│ Volume           [====●====] 80%                 │
│                                                  │
│ ── Azure TTS Connection ──────────────────────── │
│                                                  │
│ API Key    [●●●●●●●●●●●●●●●●●●●] [Validate]     │
│            ● Connected (green) / ● Invalid (red) │
│                                                  │
│ Region     [westus ▾]                            │
│                                                  │
│ ── Voice Selection ───────────────────────────── │
│                                                  │
│ Voice      [en-GB-MaisieNeural (Maisie, UK) ▾]   │
│                                                  │
│ Grouped by locale:                               │
│   ▸ English - UK (en-GB) — 12 voices             │
│   ▸ English - US (en-US) — 30+ voices            │
│   ▸ English - AU (en-AU) — 8 voices              │
│   ▸ English - IN (en-IN) — 4 voices              │
│   ▸ English - IE (en-IE) — 2 voices              │
│   ▸ English - CA (en-CA) — 2 voices              │
│   ▸ English - NZ (en-NZ) — 2 voices              │
│   ... etc                                        │
│                                                  │
│ Preview    [Hello, this is a preview...]         │
│            [Play Preview]                        │
│                                                  │
│ ── Speech Log ────────────────────────────────── │
│ 11:04:25 azure  Hello, this is...    ✓           │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Voice Dropdown Structure
- Group by locale (en-GB, en-US, en-AU, etc.)
- Show: voice name, gender, locale
- Format: `Maisie (Female, UK)` — not the raw ID
- Default: en-GB-MaisieNeural
- All English locales included (100+ voices total)

### API Key Validation
- User enters key → clicks "Validate" (or auto-validate on blur)
- POST test synthesis to `https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`
- Green dot + "Connected" if HTTP 200
- Red dot + specific error if 401/403/429/network error
- Key stored in VS Code settings (encrypted workspace config)

## Technical Architecture

### Simplified Speech Pipeline

```
User clicks Play / Auto-speak triggers
  ↓
ensureAudioReady()  ← resume AudioContext during gesture
  ↓
synthesizeAzure(text, config, signal)
  ├── Build SSML: <speak><voice name="en-GB-MaisieNeural">{text}</voice></speak>
  ├── POST to https://{region}.tts.speech.microsoft.com/cognitiveservices/v1
  ├── Headers: Ocp-Apim-Subscription-Key, Content-Type: ssml+xml
  ├── Output format: audio-24khz-48kbitrate-mono-mp3
  └── Returns: Blob (MP3 audio)
  ↓
SynthesisCache.get/set  ← LRU cache (32 entries)
  ↓
playBlobInternal(blob, volume)
  ├── ctx.decodeAudioData(arrayBuffer)
  ├── sourceNode = ctx.createBufferSource()
  ├── gainNode = ctx.createGain() → volume control
  ├── sourceNode.connect(gainNode).connect(ctx.destination)
  └── sourceNode.start(0)
  ↓
Audio plays through speakers
```

### Key Files to Modify

| File | Change |
|------|--------|
| `speech-playback.ts` | Remove RVC synthesis, remove fallback chain, Azure-only |
| `SpeechTab.tsx` | Remove provider tabs, Azure-only UI, grouped voice dropdown |
| `App.tsx` | Simplify auto-speak config (Azure only) |
| `azure-voices.ts` | Full English voice catalog grouped by locale |
| `KiloProvider.ts` | Remove all RVC message handlers |
| `package.json` | Version 7.2.1, display name "KiloCode - Azure Voice Edition" |
| `VoiceStudioProvider.ts` | Remove or keep for Azure voice browsing only |

### SpeechConfig (simplified)

```typescript
export interface SpeechConfig {
  volume: number        // 0-100
  azure: {
    region: string      // e.g. "westus"
    apiKey: string
    voiceId: string     // e.g. "en-GB-MaisieNeural"
  }
  streamSpeech?: boolean
  vadEnabled?: boolean
}
```

### Azure Voice Data Structure

```typescript
interface AzureVoice {
  id: string           // "en-GB-MaisieNeural"
  locale: string       // "en-GB"
  name: string         // "Maisie"
  gender: "Female" | "Male"
  localeName: string   // "English - UK"
}

// Grouped by locale for dropdown
interface VoiceGroup {
  locale: string       // "en-GB"
  localeName: string   // "English - UK"
  voices: AzureVoice[]
}

export const AZURE_VOICE_GROUPS: VoiceGroup[] = [
  {
    locale: "en-GB",
    localeName: "English - UK",
    voices: [
      { id: "en-GB-MaisieNeural", locale: "en-GB", name: "Maisie", gender: "Female", localeName: "English - UK" },
      { id: "en-GB-SoniaNeural", locale: "en-GB", name: "Sonia", gender: "Female", localeName: "English - UK" },
      { id: "en-GB-RyanNeural", locale: "en-GB", name: "Ryan", gender: "Male", localeName: "English - UK" },
      // ... all en-GB voices
    ]
  },
  // ... en-US, en-AU, en-IN, etc.
]
```

## Settings Schema

```jsonc
{
  "kilo-code.new.speech.enabled": true,
  "kilo-code.new.speech.autoSpeak": true,
  "kilo-code.new.speech.volume": 80,
  "kilo-code.new.speech.azure.apiKey": "",
  "kilo-code.new.speech.azure.region": "westus",
  "kilo-code.new.speech.azure.voiceId": "en-GB-MaisieNeural"
}
```

## Build & Install

```bash
cd packages/kilo-vscode
npm run package -- --no-dependencies     # typecheck + lint + esbuild
npx @vscode/vsce package --no-dependencies  # create VSIX (~75 MB)
code --install-extension kilo-code-7.2.1.vsix --force
# Ctrl+Shift+P → "Reload Window"
```

**CRITICAL**: Always verify VSIX is ~75 MB (includes kilo.exe CLI binary). A 16 MB VSIX means the binary is missing and the extension will be broken.

## Success Criteria

1. Fresh install defaults to Azure TTS (not browser)
2. User enters API key → green indicator confirms connection
3. Voice dropdown shows 100+ English voices organized by locale
4. Default voice is en-GB-MaisieNeural
5. Auto-speak in chat uses Azure voice
6. Preview plays Azure voice (not browser)
7. No RVC code, no Docker dependency, no browser fallback
8. Speech Log shows actual provider used (always "azure")
