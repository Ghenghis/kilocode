# Voice Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Azure Voice Studio to KiloCode 7.2.4 (kilocode-Azure2) as the default and only voice provider, with full voice browsing, favorites, fine-tuning, and saveable presets. Default voice: en-GB-MaisieNeural (UK Maisie).

**Architecture:** Port Azure TTS speech system into the clean 7.2.4 base. No RVC, no browser TTS. Three collapsible sections: Connection+Global, Voice Browser+Favorites, Voice Fine-Tuning. All settings persisted via VS Code configuration. SSML generation handles prosody, styles, emphasis, and custom pronunciations.

**Tech Stack:** Solid.js (webview UI), TypeScript, Azure Cognitive Services Speech REST API, Web Audio API (AudioContext + AudioBufferSourceNode), esbuild, VS Code extension API.

**Working directory:** `G:\Github\kilocode-Azure2`

**Design doc:** `docs/plans/2026-04-12-voice-studio-design.md` (in kilocode-Azure worktree)

**Source files to reference:** `G:\Github\kilocode` (has the original speech system with RVC+Azure+Browser)

---

## Prerequisites

Before starting, initialize git in kilocode-Azure2:

```bash
cd G:\Github\kilocode-Azure2
git init
git add -A
git commit -m "chore: initial commit from KiloCode 7.2.4 base"
```

Copy the design doc into the new repo:

```bash
mkdir -p docs/plans
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\docs\plans\2026-04-12-voice-studio-design.md" docs/plans/
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\docs\plans\AZURE-VOICE-EDITION-SPEC.md" docs/plans/
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\docs\plans\SESSION-HANDOFF.md" docs/plans/
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\docs\plans\LESSONS-LEARNED.md" docs/plans/
git add docs/plans && git commit -m "docs: add Azure Voice Studio design docs"
```

---

## Task 1: Azure Voice Data (azure-voices.ts)

**Files:**
- Create: `packages/kilo-vscode/webview-ui/src/data/azure-voices.ts`

**Step 1: Create voice data file**

Port from `G:\Github\kilocode\packages\kilo-vscode\webview-ui\src\data\azure-voices.ts`. Remove EDGE_TTS_VOICES and EDGE_TTS_VOICE_IDS. Extend AzureVoice interface with `description` and `styles` fields.

```typescript
export interface AzureVoice {
  id: string
  locale: string
  name: string
  gender: "Female" | "Male"
  description: string
  styles: string[]    // empty array if voice has no style support
}

export const AZURE_VOICES: AzureVoice[] = [
  // en-GB (default locale -- Maisie is first)
  { id: "en-GB-MaisieNeural", locale: "en-GB", name: "Maisie (UK)", gender: "Female",
    description: "Natural, warm British accent", styles: [] },
  { id: "en-GB-SoniaNeural", locale: "en-GB", name: "Sonia (UK)", gender: "Female",
    description: "Clear, professional British voice", styles: ["cheerful", "sad"] },
  { id: "en-GB-RyanNeural", locale: "en-GB", name: "Ryan (UK)", gender: "Male",
    description: "Warm, conversational British male", styles: ["chat", "cheerful"] },
  // ... port ALL 125 voices from source file, adding description + styles
  // ... en-GB, en-US, en-AU, en-CA, en-IE, en-IN, en-NZ, en-SG, en-ZA, en-HK, en-KE, en-NG, en-PH, en-TZ
]

export const AZURE_LOCALES = [...new Set(AZURE_VOICES.map((v) => v.locale))].sort()

// Locale display names for UI
export const LOCALE_NAMES: Record<string, string> = {
  "en-GB": "English - UK",
  "en-US": "English - US",
  "en-AU": "English - AU",
  "en-CA": "English - CA",
  "en-IE": "English - IE",
  "en-IN": "English - IN",
  "en-NZ": "English - NZ",
  "en-SG": "English - SG",
  "en-ZA": "English - ZA",
  "en-HK": "English - HK",
  "en-KE": "English - KE",
  "en-NG": "English - NG",
  "en-PH": "English - PH",
  "en-TZ": "English - TZ",
}

// Default voice
export const DEFAULT_VOICE_ID = "en-GB-MaisieNeural"
```

**Source:** Copy the 125 voices from `G:\Github\kilocode\packages\kilo-vscode\webview-ui\src\data\azure-voices.ts` lines 8-125. For each voice, add a `description` (short characterization) and `styles` array. For styles, reference https://learn.microsoft.com/azure/ai-services/speech-service/language-support?tabs=tts -- voices like Aria, Davis, Jenny support styles; most others only support "default".

**Step 2: Commit**

```bash
git add packages/kilo-vscode/webview-ui/src/data/azure-voices.ts
git commit -m "feat: add Azure voice catalog with 125+ English voices"
```

---

## Task 2: Speech Types (messages + voice types)

**Files:**
- Create: `packages/kilo-vscode/webview-ui/src/types/voice.ts`
- Modify: `packages/kilo-vscode/webview-ui/src/types/messages.ts` (lines ~2469, add to WebviewMessage union)

**Step 1: Create voice types**

```typescript
// packages/kilo-vscode/webview-ui/src/types/voice.ts

export interface VoicePreset {
  name: string
  voiceId: string
  pitch: number             // -50 to 50
  rate: number              // 0.5 to 2.0
  volume: number | null     // null = use global
  style: string             // "default" | "cheerful" | etc.
  styleDegree: number       // 0.5 to 2.0
  sentencePause: number     // 0 to 2000 ms
  paragraphBreak: number    // 0 to 5000 ms
  emphasis: string          // "none" | "reduced" | "moderate" | "strong"
  pronunciations: PronunciationEntry[]
  audioFormat: string
}

export interface PronunciationEntry {
  word: string
  pronounceAs: string
}

export interface FavoritesConfig {
  starredVoices: string[]
  presets: VoicePreset[]
  order: string[]
}

export interface SpeechSettings {
  enabled: boolean
  autoSpeak: boolean
  volume: number
  interactionMode: string
  interruptOnType: boolean
  debugMode: boolean
  sentimentIntensity: number
  multiVoiceMode: boolean
  azure: {
    apiKey: string
    region: string
    voiceId: string
  }
  tuning: {
    pitch: number
    rate: number
    volume: number | null
    style: string
    styleDegree: number
    sentencePause: number
    paragraphBreak: number
    emphasis: string
    pronunciations: PronunciationEntry[]
    audioFormat: string
  }
  favorites: FavoritesConfig
  presets: VoicePreset[]
}

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  enabled: false,
  autoSpeak: false,
  volume: 80,
  interactionMode: "assist",
  interruptOnType: true,
  debugMode: false,
  sentimentIntensity: 70,
  multiVoiceMode: false,
  azure: {
    apiKey: "",
    region: "westus",
    voiceId: "en-GB-MaisieNeural",
  },
  tuning: {
    pitch: 0,
    rate: 1.0,
    volume: null,
    style: "default",
    styleDegree: 1.0,
    sentencePause: 250,
    paragraphBreak: 500,
    emphasis: "moderate",
    pronunciations: [],
    audioFormat: "audio-24khz-48kbitrate-mono-mp3",
  },
  favorites: {
    starredVoices: ["en-GB-MaisieNeural"],
    presets: [],
    order: ["en-GB-MaisieNeural"],
  },
  presets: [],
}
```

**Step 2: Add message types to messages.ts**

Add these interfaces before the `WebviewMessage` union type (around line 2326):

```typescript
// Speech settings messages
export interface RequestSpeechSettingsMessage {
  type: "requestSpeechSettings"
}

export interface SpeechSettingsLoadedMessage {
  type: "speechSettingsLoaded"
  settings: import("./voice").SpeechSettings
}

export interface ValidateAzureKeyMessage {
  type: "validateAzureKey"
  apiKey: string
  region: string
}

export interface AzureKeyValidationResultMessage {
  type: "azureKeyValidationResult"
  valid: boolean
  error?: string
}
```

Add `RequestSpeechSettingsMessage` and `ValidateAzureKeyMessage` to the `WebviewMessage` union.
Add `SpeechSettingsLoadedMessage` and `AzureKeyValidationResultMessage` to the `ExtensionMessage` union.

**Step 3: Commit**

```bash
git add packages/kilo-vscode/webview-ui/src/types/voice.ts packages/kilo-vscode/webview-ui/src/types/messages.ts
git commit -m "feat: add speech/voice type definitions and message types"
```

---

## Task 3: Azure TTS Engine (speech-playback.ts)

**Files:**
- Create: `packages/kilo-vscode/webview-ui/src/utils/tts-azure.ts`
- Create: `packages/kilo-vscode/webview-ui/src/utils/speech-playback.ts`

**Step 1: Create Azure TTS synthesis function**

Port from `G:\Github\kilocode\packages\app\src\utils\tts-azure.ts` and extend with SSML fine-tuning support:

```typescript
// packages/kilo-vscode/webview-ui/src/utils/tts-azure.ts

import type { VoicePreset, PronunciationEntry } from "../types/voice"

const AUDIO_FORMATS: Record<string, string> = {
  "audio-16khz-32kbitrate-mono-mp3": "audio-16khz-32kbitrate-mono-mp3",
  "audio-24khz-48kbitrate-mono-mp3": "audio-24khz-48kbitrate-mono-mp3",
  "audio-48khz-96kbitrate-mono-mp3": "audio-48khz-96kbitrate-mono-mp3",
}

export interface AzureTTSOptions {
  region: string
  apiKey: string
  voiceId: string
  pitch?: number          // -50 to 50
  rate?: number           // 0.5 to 2.0
  volume?: number         // 0 to 100
  style?: string
  styleDegree?: number
  emphasis?: string
  pronunciations?: PronunciationEntry[]
  audioFormat?: string
}

export async function synthesizeAzure(
  text: string,
  opts: AzureTTSOptions,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!opts.region) throw new Error("Azure region is not configured")
  if (!opts.apiKey) throw new Error("Azure API key is not configured")
  if (!opts.voiceId) throw new Error("Azure voice is not selected")

  const ssml = buildSSML(text, opts)
  const format = opts.audioFormat ?? "audio-24khz-48kbitrate-mono-mp3"

  const resp = await fetch(
    `https://${opts.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": opts.apiKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": format,
        "User-Agent": "KiloCode-Azure",
      },
      body: ssml,
      signal,
    },
  )

  if (!resp.ok) throw new Error(`Azure TTS error ${resp.status}: ${await resp.text()}`)
  const blob = await resp.blob()
  if (blob.size < 100) throw new Error("Azure returned empty audio -- check voice ID and region")
  return blob
}

function buildSSML(text: string, opts: AzureTTSOptions): string {
  let processedText = applyPronunciations(escapeXml(text), opts.pronunciations ?? [])

  // Wrap in emphasis if set
  if (opts.emphasis && opts.emphasis !== "none") {
    processedText = `<emphasis level="${opts.emphasis}">${processedText}</emphasis>`
  }

  // Wrap in prosody if any prosody changes
  const prosodyAttrs: string[] = []
  if (opts.pitch && opts.pitch !== 0) prosodyAttrs.push(`pitch="${opts.pitch > 0 ? "+" : ""}${opts.pitch}%"`)
  if (opts.rate && opts.rate !== 1.0) prosodyAttrs.push(`rate="${opts.rate}"`)
  if (opts.volume != null) prosodyAttrs.push(`volume="${opts.volume}"`)
  if (prosodyAttrs.length > 0) {
    processedText = `<prosody ${prosodyAttrs.join(" ")}>${processedText}</prosody>`
  }

  // Wrap in express-as if style is set
  if (opts.style && opts.style !== "default") {
    const degree = opts.styleDegree ?? 1.0
    processedText = `<mstts:express-as style="${opts.style}" styledegree="${degree}">${processedText}</mstts:express-as>`
  }

  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">` +
    `<voice name="${opts.voiceId}">${processedText}</voice></speak>`
  )
}

function applyPronunciations(text: string, pronunciations: PronunciationEntry[]): string {
  let result = text
  for (const p of pronunciations) {
    const escaped = escapeXml(p.word)
    const regex = new RegExp(escapeRegex(escaped), "gi")
    result = result.replace(regex, `<sub alias="${escapeXml(p.pronounceAs)}">${escaped}</sub>`)
  }
  return result
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
```

**Step 2: Create speech playback engine**

Port the Web Audio API playback from `G:\Github\kilocode\packages\kilo-vscode\webview-ui\src\utils\speech-playback.ts`. Keep ONLY:
- `ensureAudioReady()` -- AudioContext resume during gesture
- `playBlobInternal()` -- Web Audio API blob playback
- `SynthesisCache` -- LRU cache (32 entries)
- `stop()` -- cancel active playback

Remove ALL references to RVC, browser TTS, fallback chain, AudioCritic blocking.

```typescript
// packages/kilo-vscode/webview-ui/src/utils/speech-playback.ts

import { synthesizeAzure, type AzureTTSOptions } from "./tts-azure"

// --- Web Audio API state ---
let _playbackContext: AudioContext | null = null
let _activeSourceNode: AudioBufferSourceNode | null = null
let _activeGainNode: GainNode | null = null
let _abortController: AbortController | null = null

export function ensureAudioReady(): void {
  if (!_playbackContext) _playbackContext = new AudioContext()
  if (_playbackContext.state === "suspended") _playbackContext.resume()
}

export function getPlaybackContext(): AudioContext {
  if (!_playbackContext) _playbackContext = new AudioContext()
  return _playbackContext
}

export async function speak(text: string, opts: AzureTTSOptions & { globalVolume: number }): Promise<void> {
  stop() // cancel any active playback
  ensureAudioReady()

  _abortController = new AbortController()
  const cacheKey = SynthesisCache.hash(text, opts.voiceId, opts.style ?? "default", opts.pitch ?? 0, opts.rate ?? 1.0)
  let blob = SynthesisCache.get(cacheKey)

  if (!blob) {
    blob = await synthesizeAzure(text, opts, _abortController.signal)
    SynthesisCache.set(cacheKey, blob)
  }

  const volume = opts.volume ?? opts.globalVolume
  await playBlobInternal(blob, volume / 100)
}

export async function playBlobInternal(blob: Blob, volume: number): Promise<void> {
  const ctx = getPlaybackContext()
  const arrayBuffer = await blob.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  gain.gain.value = Math.max(0, Math.min(1, volume))
  source.buffer = audioBuffer
  source.connect(gain).connect(ctx.destination)

  _activeSourceNode = source
  _activeGainNode = gain

  return new Promise<void>((resolve) => {
    source.onended = () => {
      _activeSourceNode = null
      _activeGainNode = null
      resolve()
    }
    source.start(0)
  })
}

export function stop(): void {
  _abortController?.abort()
  _abortController = null
  try { _activeSourceNode?.stop() } catch {}
  _activeSourceNode = null
  _activeGainNode = null
}

export function setVolume(volume: number): void {
  if (_activeGainNode) {
    _activeGainNode.gain.value = Math.max(0, Math.min(1, volume / 100))
  }
}

// --- LRU Synthesis Cache ---
const CACHE_MAX = 32

class _SynthesisCache {
  private _map = new Map<string, Blob>()

  hash(...parts: (string | number)[]): string {
    return parts.join("|")
  }

  get(key: string): Blob | undefined {
    const blob = this._map.get(key)
    if (blob) {
      // LRU touch: delete and re-insert
      this._map.delete(key)
      this._map.set(key, blob)
    }
    return blob
  }

  set(key: string, blob: Blob): void {
    if (this._map.has(key)) this._map.delete(key)
    this._map.set(key, blob)
    // Evict oldest
    while (this._map.size > CACHE_MAX) {
      const oldest = this._map.keys().next().value
      if (oldest) this._map.delete(oldest)
    }
  }

  clear(): void {
    this._map.clear()
  }
}

export const SynthesisCache = new _SynthesisCache()

// --- Session character counter ---
let _sessionChars = 0
export function trackChars(count: number): void { _sessionChars += count }
export function getSessionChars(): number { return _sessionChars }
```

**Step 3: Commit**

```bash
git add packages/kilo-vscode/webview-ui/src/utils/tts-azure.ts packages/kilo-vscode/webview-ui/src/utils/speech-playback.ts
git commit -m "feat: add Azure TTS engine with SSML fine-tuning and Web Audio playback"
```

---

## Task 4: SpeechTab UI Component

**Files:**
- Create: `packages/kilo-vscode/webview-ui/src/components/settings/SpeechTab.tsx`

This is the largest task. Build all 3 collapsible sections from the design doc.

**Step 1: Create SpeechTab.tsx**

Follow the NotificationsTab.tsx pattern (`G:\Github\kilocode-Azure2\packages\kilo-vscode\webview-ui\src\components\settings\NotificationsTab.tsx`):
- Use `useVSCode()` for message passing
- Use `createSignal()` for local state
- Use `vscode.onMessage()` to receive `speechSettingsLoaded`
- Use `vscode.postMessage({ type: "updateSetting", key, value })` to save
- Use `Card`, `SettingsRow`, `Switch`, `Select` from `@kilocode/kilo-ui`

The SpeechTab should implement all 3 sections from the design doc:

1. **Section 1 (Connection + Global)**: Collapsible. API key (masked input), region (text input), Enable Speech toggle, Auto-Speak toggle, Interaction Mode select, Volume slider, Stop on typing toggle, Debug toggle, Sentiment Intensity slider, Voice Profiles table (read-only), Multi-Voice Dialogue toggle. Shows green/red connection badge in header.

2. **Section 2 (Voice Browser + Favorites)**: Always expanded. Favorites chips bar at top (starred voices with `*`, presets with `#`). Search input. Locale filter tabs. Voice cards list (name, gender, locale, description, styles, star icon, preview button). Multi-line preview text area. Say-as dropdown. Play Preview + Compare All Favorites buttons.

3. **Section 3 (Voice Fine-Tuning)**: Expands when voice selected. Pitch slider (-50% to +50%), Rate slider (0.5x to 2.0x), Voice Volume slider + "Use global" checkbox, Style chips (voice-dependent), Style Intensity slider, Sentence Pause slider, Paragraph Break slider, Emphasis dropdown, Custom Pronunciations table with add/delete, Audio Quality dropdown, Quota display, Save as Preset button, Saved Presets list with Load/Edit/Delete.

Every slider/control must include a description label explaining what it does to the user.

**Source reference:** Port structure from `G:\Github\kilocode\packages\kilo-vscode\webview-ui\src\components\settings\SpeechTab.tsx` (918 lines). Strip all RVC/Browser code. Rebuild UI following the design doc layout.

**Step 2: Commit**

```bash
git add packages/kilo-vscode/webview-ui/src/components/settings/SpeechTab.tsx
git commit -m "feat: add Voice Studio SpeechTab with 3-section layout"
```

---

## Task 5: Wire SpeechTab into Settings

**Files:**
- Modify: `packages/kilo-vscode/webview-ui/src/components/settings/Settings.tsx` (lines 10-23 imports, lines 139-151 tab triggers, lines 194-212 tab content)

**Step 1: Add import**

At line 20 (after `import ContextTab`), add:

```typescript
import SpeechTab from "./SpeechTab"
```

**Step 2: Add tab trigger**

After the `context` trigger (line 138), before `experimental` (line 140), add:

```typescript
          <Tabs.Trigger value="speech">
            <Icon name="speech-bubble" />
            <span class="label">Speech</span>
          </Tabs.Trigger>
```

Note: Uses `speech-bubble` icon (already used by Language tab -- check if a different icon like `volume` or `audio` is available in `@kilocode/kilo-ui/icon`, otherwise use `speech-bubble`).

**Step 3: Add tab content**

After the `context` content (line 193), before `experimental` (line 195), add:

```typescript
        <Tabs.Content value="speech">
          <h3>Speech</h3>
          <SpeechTab />
        </Tabs.Content>
```

**Step 4: Commit**

```bash
git add packages/kilo-vscode/webview-ui/src/components/settings/Settings.tsx
git commit -m "feat: wire SpeechTab into Settings tabs"
```

---

## Task 6: Extension Host -- Speech Settings Handler

**Files:**
- Modify: `packages/kilo-vscode/src/KiloProvider.ts` (add speech message handlers)

**Step 1: Add speech settings handler**

Find the message handler switch/if-chain in KiloProvider.ts. Add handlers for:

```typescript
case "requestSpeechSettings": {
  const speech = vscode.workspace.getConfiguration("kilo-code.new")
  const settings = {
    enabled: speech.get("speech.enabled", false),
    autoSpeak: speech.get("speech.autoSpeak", false),
    volume: speech.get("speech.volume", 80),
    interactionMode: speech.get("speech.interactionMode", "assist"),
    interruptOnType: speech.get("speech.interruptOnType", true),
    debugMode: speech.get("speech.debugMode", false),
    sentimentIntensity: speech.get("speech.sentimentIntensity", 70),
    multiVoiceMode: speech.get("speech.multiVoiceMode", false),
    azure: {
      apiKey: speech.get("speech.azure.apiKey", ""),
      region: speech.get("speech.azure.region", "westus"),
      voiceId: speech.get("speech.azure.voiceId", "en-GB-MaisieNeural"),
    },
    tuning: {
      pitch: speech.get("speech.tuning.pitch", 0),
      rate: speech.get("speech.tuning.rate", 1.0),
      volume: speech.get("speech.tuning.volume", null),
      style: speech.get("speech.tuning.style", "default"),
      styleDegree: speech.get("speech.tuning.styleDegree", 1.0),
      sentencePause: speech.get("speech.tuning.sentencePause", 250),
      paragraphBreak: speech.get("speech.tuning.paragraphBreak", 500),
      emphasis: speech.get("speech.tuning.emphasis", "moderate"),
      pronunciations: speech.get("speech.tuning.pronunciations", []),
      audioFormat: speech.get("speech.tuning.audioFormat", "audio-24khz-48kbitrate-mono-mp3"),
    },
    favorites: {
      starredVoices: speech.get("speech.favorites.starredVoices", ["en-GB-MaisieNeural"]),
      presets: speech.get("speech.favorites.presets", []),
      order: speech.get("speech.favorites.order", ["en-GB-MaisieNeural"]),
    },
    presets: speech.get("speech.presets", []),
  }
  panel.webview.postMessage({ type: "speechSettingsLoaded", settings })
  break
}

case "validateAzureKey": {
  // Test synthesis with a short phrase to validate key
  try {
    const resp = await fetch(
      `https://${message.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": message.apiKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        },
        body: `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='en-GB-MaisieNeural'>test</voice></speak>`,
      },
    )
    if (resp.ok) {
      panel.webview.postMessage({ type: "azureKeyValidationResult", valid: true })
    } else {
      panel.webview.postMessage({
        type: "azureKeyValidationResult",
        valid: false,
        error: `HTTP ${resp.status}: ${resp.statusText}`,
      })
    }
  } catch (e: any) {
    panel.webview.postMessage({
      type: "azureKeyValidationResult",
      valid: false,
      error: e.message ?? "Network error",
    })
  }
  break
}
```

**Step 2: Commit**

```bash
git add packages/kilo-vscode/src/KiloProvider.ts
git commit -m "feat: add speech settings and Azure key validation handlers"
```

---

## Task 7: Package.json -- Register Speech Settings

**Files:**
- Modify: `packages/kilo-vscode/package.json` (add to `contributes.configuration.properties` around line 758)

**Step 1: Add speech configuration properties**

Before the closing `}` of `properties` (line 758), add all speech settings:

```json
"kilo-code.new.speech.enabled": {
  "type": "boolean",
  "default": false,
  "description": "Enable Azure Voice Studio for text-to-speech responses"
},
"kilo-code.new.speech.autoSpeak": {
  "type": "boolean",
  "default": false,
  "description": "Automatically speak assistant replies when they complete"
},
"kilo-code.new.speech.volume": {
  "type": "number",
  "default": 80,
  "minimum": 0,
  "maximum": 100,
  "description": "Speech output volume level (0-100)"
},
"kilo-code.new.speech.interactionMode": {
  "type": "string",
  "default": "assist",
  "enum": ["assist", "conversation", "minimal"],
  "description": "How voice responses work during your session"
},
"kilo-code.new.speech.interruptOnType": {
  "type": "boolean",
  "default": true,
  "description": "Stop speech when you start typing"
},
"kilo-code.new.speech.debugMode": {
  "type": "boolean",
  "default": false,
  "description": "Show verbose speech engine logs in developer console"
},
"kilo-code.new.speech.sentimentIntensity": {
  "type": "number",
  "default": 70,
  "minimum": 0,
  "maximum": 100,
  "description": "How strongly pitch/rate shift to match emotional tone (0-100)"
},
"kilo-code.new.speech.multiVoiceMode": {
  "type": "boolean",
  "default": false,
  "description": "Each AI agent speaks in a distinct voice"
},
"kilo-code.new.speech.azure.apiKey": {
  "type": "string",
  "default": "",
  "description": "Azure Cognitive Services Speech API key"
},
"kilo-code.new.speech.azure.region": {
  "type": "string",
  "default": "westus",
  "description": "Azure Speech resource region"
},
"kilo-code.new.speech.azure.voiceId": {
  "type": "string",
  "default": "en-GB-MaisieNeural",
  "description": "Azure Neural TTS voice ID"
},
"kilo-code.new.speech.tuning.pitch": {
  "type": "number",
  "default": 0,
  "minimum": -50,
  "maximum": 50,
  "description": "Voice pitch adjustment (-50% to +50%)"
},
"kilo-code.new.speech.tuning.rate": {
  "type": "number",
  "default": 1.0,
  "minimum": 0.5,
  "maximum": 2.0,
  "description": "Speech rate/speed (0.5x to 2.0x)"
},
"kilo-code.new.speech.tuning.volume": {
  "type": ["number", "null"],
  "default": null,
  "description": "Per-voice volume override (null = use global)"
},
"kilo-code.new.speech.tuning.style": {
  "type": "string",
  "default": "default",
  "description": "Speaking style (voice-dependent)"
},
"kilo-code.new.speech.tuning.styleDegree": {
  "type": "number",
  "default": 1.0,
  "minimum": 0.5,
  "maximum": 2.0,
  "description": "Style intensity (0.5x to 2.0x)"
},
"kilo-code.new.speech.tuning.sentencePause": {
  "type": "number",
  "default": 250,
  "minimum": 0,
  "maximum": 2000,
  "description": "Silence between sentences (ms)"
},
"kilo-code.new.speech.tuning.paragraphBreak": {
  "type": "number",
  "default": 500,
  "minimum": 0,
  "maximum": 5000,
  "description": "Silence between paragraphs (ms)"
},
"kilo-code.new.speech.tuning.emphasis": {
  "type": "string",
  "default": "moderate",
  "enum": ["none", "reduced", "moderate", "strong"],
  "description": "Word emphasis level"
},
"kilo-code.new.speech.tuning.pronunciations": {
  "type": "array",
  "default": [],
  "description": "Custom pronunciation overrides for technical terms"
},
"kilo-code.new.speech.tuning.audioFormat": {
  "type": "string",
  "default": "audio-24khz-48kbitrate-mono-mp3",
  "enum": [
    "audio-16khz-32kbitrate-mono-mp3",
    "audio-24khz-48kbitrate-mono-mp3",
    "audio-48khz-96kbitrate-mono-mp3"
  ],
  "enumDescriptions": [
    "Low quality (16kHz) - smallest size",
    "Standard quality (24kHz) - recommended",
    "High quality (48kHz) - best audio"
  ],
  "description": "Audio output format and quality"
},
"kilo-code.new.speech.favorites.starredVoices": {
  "type": "array",
  "default": ["en-GB-MaisieNeural"],
  "description": "Starred favorite voices"
},
"kilo-code.new.speech.favorites.order": {
  "type": "array",
  "default": ["en-GB-MaisieNeural"],
  "description": "Display order of favorites"
},
"kilo-code.new.speech.presets": {
  "type": "array",
  "default": [],
  "description": "Saved voice + tuning presets"
}
```

**Step 2: Update package version and display name**

Change version to `"7.2.4"` and displayName to include Azure Voice Edition:

```json
"displayName": "Kilo Code: Azure Voice Edition",
"version": "7.2.4",
```

**Step 3: Commit**

```bash
git add packages/kilo-vscode/package.json
git commit -m "feat: register speech settings schema and update to Azure Voice Edition"
```

---

## Task 8: Auto-Speak Integration (App.tsx)

**Files:**
- Modify: `packages/kilo-vscode/webview-ui/src/App.tsx`

**Step 1: Add auto-speak on assistant message complete**

In the `AppContent` component's `onMount` message listener, add a handler for when assistant messages complete:

```typescript
import { speak, ensureAudioReady, stop as stopSpeech } from "./utils/speech-playback"

// Inside the message listener:
if (message.type === "assistantMessageComplete" && speechEnabled && autoSpeak) {
  const text = message.text // extract plain text from message
  if (text) {
    speak(text, {
      region: speechSettings.azure.region,
      apiKey: speechSettings.azure.apiKey,
      voiceId: speechSettings.azure.voiceId,
      pitch: speechSettings.tuning.pitch,
      rate: speechSettings.tuning.rate,
      volume: speechSettings.tuning.volume,
      style: speechSettings.tuning.style,
      styleDegree: speechSettings.tuning.styleDegree,
      emphasis: speechSettings.tuning.emphasis,
      pronunciations: speechSettings.tuning.pronunciations,
      audioFormat: speechSettings.tuning.audioFormat,
      globalVolume: speechSettings.volume,
    }).catch((err) => console.error("[Speech] Auto-speak failed:", err))
  }
}
```

**Note:** The exact message type for assistant replies depends on the existing message protocol. Check the `ExtensionMessage` type for the appropriate assistant completion message. This may need to be `"message"` with a role check, or a custom type. Reference the existing kilocode speech integration in `G:\Github\kilocode\packages\kilo-vscode\webview-ui\src\App.tsx` for the correct pattern.

**Step 2: Add interrupt-on-type**

In the text input handler (or PromptInput component), add:

```typescript
if (speechSettings.interruptOnType) {
  stopSpeech()
}
```

**Step 3: Commit**

```bash
git add packages/kilo-vscode/webview-ui/src/App.tsx
git commit -m "feat: add auto-speak and interrupt-on-type integration"
```

---

## Task 9: Documentation Updates

**Files:**
- Copy from worktree: `README.md`, `SETUP.md`, `USAGE.md`, `API.md`, `TROUBLESHOOTING.md`, `CHANGELOG.md`

**Step 1: Copy documentation from the worktree**

```bash
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\README.md" .
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\SETUP.md" .
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\USAGE.md" .
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\API.md" .
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\TROUBLESHOOTING.md" .
cp "G:\Github\kilocode-Azure\.claude\worktrees\friendly-curie\CHANGELOG.md" .
```

**Step 2: Update USAGE.md to reflect Voice Studio design**

The USAGE.md was already updated with the Voice Studio layout from the screenshots. Verify it matches the final design doc.

**Step 3: Commit**

```bash
git add README.md SETUP.md USAGE.md API.md TROUBLESHOOTING.md CHANGELOG.md
git commit -m "docs: add Azure Voice Edition documentation"
```

---

## Task 10: Build and Verify

**Step 1: Install dependencies**

```bash
cd G:\Github\kilocode-Azure2
bun install
```

**Step 2: Type check**

```bash
cd packages/kilo-vscode
bun run typecheck
```

Fix any TypeScript errors.

**Step 3: Build**

```bash
bun run package
```

**Step 4: Verify VSIX size**

```bash
ls -la *.vsix
```

Expected: ~75 MB. If 16 MB, the CLI binary is missing.

**Step 5: Test install**

```bash
code --install-extension kilo-code-*.vsix --force
```

Then Ctrl+Shift+P -> Reload Window.

**Step 6: Manual test checklist**

- [ ] Speech tab appears in Settings sidebar
- [ ] API key input works, validates with green/red indicator
- [ ] Voice dropdown shows 125+ voices grouped by locale
- [ ] Default voice is en-GB-MaisieNeural
- [ ] Play Preview plays Azure voice (not browser robot)
- [ ] Pitch/Rate/Style sliders affect preview playback
- [ ] Favorites star toggle works
- [ ] Save as Preset saves and appears in favorites bar
- [ ] Custom pronunciation applies to preview
- [ ] Auto-speak speaks assistant replies
- [ ] Stop on typing interrupts playback
- [ ] Volume slider works
- [ ] No RVC errors in console

**Step 7: Final commit**

```bash
git add -A
git commit -m "feat: KiloCode Azure Voice Edition 7.2.4 - complete Voice Studio"
```

---

## File Inventory

| # | File | Action | Task |
|---|------|--------|------|
| 1 | `webview-ui/src/data/azure-voices.ts` | Create | Task 1 |
| 2 | `webview-ui/src/types/voice.ts` | Create | Task 2 |
| 3 | `webview-ui/src/types/messages.ts` | Modify | Task 2 |
| 4 | `webview-ui/src/utils/tts-azure.ts` | Create | Task 3 |
| 5 | `webview-ui/src/utils/speech-playback.ts` | Create | Task 3 |
| 6 | `webview-ui/src/components/settings/SpeechTab.tsx` | Create | Task 4 |
| 7 | `webview-ui/src/components/settings/Settings.tsx` | Modify | Task 5 |
| 8 | `src/KiloProvider.ts` | Modify | Task 6 |
| 9 | `package.json` | Modify | Task 7 |
| 10 | `webview-ui/src/App.tsx` | Modify | Task 8 |
| 11 | `README.md` | Create | Task 9 |
| 12 | `SETUP.md` | Create | Task 9 |
| 13 | `USAGE.md` | Create | Task 9 |
| 14 | `API.md` | Create | Task 9 |
| 15 | `TROUBLESHOOTING.md` | Create | Task 9 |
| 16 | `CHANGELOG.md` | Create | Task 9 |

All paths are relative to `packages/kilo-vscode/` unless they start with a root-level filename.
