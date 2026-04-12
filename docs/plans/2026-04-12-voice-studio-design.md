# Voice Studio Design -- KiloCode Azure Voice Edition

**Date**: 2026-04-12
**Status**: Approved
**Approach**: B -- "Voice Studio" (3 collapsible sections, full width)

## Overview

Redesign the Speech tab into a full Azure Voice Studio. Remove Browser/RVC provider tabs entirely. Use the full panel width for 3 collapsible sections: Connection + Global, Voice Browser + Favorites, and Voice Fine-Tuning. Every control includes descriptive text explaining what it does.

Default voice: **en-GB-MaisieNeural** (UK Maisie).

## Design Principles

- Azure is the only voice provider -- no tabs, no fallback chain
- Full panel width for every section (VS Code sidebar is narrow, maximize space)
- Descriptive labels on every control -- tell users what changing a slider does
- Favorites + Presets for instant voice switching
- Custom pronunciations for technical terms (critical for coding assistant)
- Save everything: voice + tuning + pronunciations as named presets

---

## Section 1: Connection + Global Settings

**Behavior**: Collapsed by default once a valid API key is saved. Header shows green "Connected" badge when collapsed.

### Controls

| Control | Type | Default | Description shown to user |
|---------|------|---------|--------------------------|
| API Key | masked text input | (empty) | "Azure Cognitive Services subscription key" |
| Region | text input | westus | "Azure service region. Must match your Speech resource (e.g. eastus, westus2)" |
| Enable Speech | toggle | on | "Enable text-to-speech output for assistant replies" |
| Auto-Speak | toggle | on | "Automatically speak assistant replies when they complete" |
| Interaction Mode | dropdown | Assist | "Choose how voice responses work during your session" |
| Volume | slider 0-100% | 80% | "Speech output volume level" |
| Stop speech when typing | toggle | on | "Automatically interrupt ongoing speech playback as soon as you start typing a new message" |
| Speech Debug Mode | toggle | off | "Show verbose speech engine logs in the developer console" |

### Voice Profiles (sub-section)

Applied automatically based on content detection. Scaled by Sentiment Intensity.

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Sentiment Intensity | slider 0-100% | 70% | "Controls how strongly pitch and rate shift to match the emotional tone of responses" |

| Content Type | Profile | Modifiers |
|-------------|---------|-----------|
| Error / stack trace | serious | Pitch -1 st, Rate 0.95x |
| Success / completion | upbeat | Pitch +/-0, Rate 1.0x |
| Code explanation | teaching | Pitch +/-0, Rate 0.9x |
| Quick confirmation | casual | Pitch +0.5 st, Rate 1.1x |

### Multi-Voice Dialogue Mode

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Multi-Voice Dialogue | toggle | off | "Each AI agent speaks in a distinct voice when multiple agents are active in a conversation" |

---

## Section 2: Voice Browser + Favorites

**Behavior**: Always expanded. Main interaction area.

### Favorites Bar

Horizontal row of chips at the top of the section.

- **Starred voices** shown with `*` prefix: `[* Maisie UK]`
- **Saved presets** shown with `#` prefix: `[# Coding Mode]`
- Click any chip to instantly switch to that voice (and load preset settings if applicable)
- Chips are draggable to reorder

### Search

Full-width search bar: `[Search voices...]`

Searches by name, locale, and gender. Examples:
- "female UK" -- filters to female en-GB voices
- "aria" -- finds Aria directly
- "male" -- all male voices across locales

### Locale Tabs

Horizontal tabs below search bar:

`[All] [en-GB] [en-US] [en-AU] [en-IN] [More v]`

- "All" shows every voice
- Individual locale tabs filter to that locale
- "More" dropdown for less common: en-IE, en-CA, en-NZ, en-ZA, en-SG, en-HK, en-KE, en-NG, en-PH, en-TZ

### Voice Cards

Each voice displayed as a card in a vertical list:

```
+-----------------------------------------------+
| * Maisie         Female   en-GB   [>] Preview  |
|   "Natural, warm British accent"               |
|   Styles: cheerful, sad, angry, chat           |
+-----------------------------------------------+
```

Card elements:
- **Star icon** (left) -- click to toggle favorite
- **Name** -- display name (e.g., "Maisie")
- **Gender** -- Female / Male
- **Locale** -- en-GB, en-US, etc.
- **[>] Preview button** -- instant one-click preview using the test text
- **Description line** -- short characterization of the voice
- **Styles line** -- lists available speaking styles (important for fine-tuning). Voices without style support show "Styles: default only"

Clicking anywhere on the card (except star/preview) selects the voice and expands Section 3.

### Preview Test Area

Below the voice list:

```
+-------------------------------------------------+
| [Hello! This is a preview of the speech output. |
|  You can type longer sentences here to test how |
|  the voice handles different types of content.] |
+-------------------------------------------------+
| Say-as: [Auto v]                                |
| "Controls how Azure interprets numbers, dates,  |
|  and special text in the preview"               |
| Options: auto / number / spell-out / date /     |
|          characters                             |
|                                                 |
| [Play Preview]   [Compare All Favorites]        |
+-------------------------------------------------+
```

- **Multi-line text area** -- users can paste long sentences, code snippets, or technical content to test
- **Say-as dropdown** -- tells Azure how to interpret special content
- **Play Preview** -- plays with current voice + fine-tuning settings
- **Compare All Favorites** -- plays preview text through each favorited voice back-to-back

---

## Section 3: Voice Fine-Tuning

**Behavior**: Appears/expands when a voice is selected. Header shows the selected voice name.

### Prosody Controls

| Control | Type | Range | Default | Description |
|---------|------|-------|---------|-------------|
| Pitch | slider | -50% to +50% | +0 | "Raise or lower the vocal pitch. Positive values sound brighter/younger. Negative sounds deeper/more authoritative." |
| Rate | slider | 0.5x to 2.0x | 1.0x | "Speed of speech. Lower for complex explanations, higher for quick confirmations. Affects how natural pauses sound." |
| Voice Volume | slider 0-100% | 0-100% | use global | "Volume for this voice only. Overrides global volume when set. Useful when switching between voices that have different natural loudness." |

Voice Volume has a `[ ] Use global volume` checkbox. When checked, the slider is disabled and global volume applies.

### Speaking Style

Only shown for voices that support styles. Grayed out / hidden for voices that only support "default".

| Control | Type | Range | Default | Description |
|---------|------|-------|---------|-------------|
| Style | selectable chips | voice-dependent | default | "Changes the emotional tone of the entire response. Not all voices support all styles." |
| Style Intensity | slider | 0.5x to 2.0x | 1.0x | "How strongly the style is applied. At 0.5x the style is subtle. At 2.0x it is very pronounced. Start at 1.0x and adjust to taste." |

Available styles are shown as clickable chips. Only styles supported by the selected voice are active. Example for Maisie: `[default] [cheerful] [sad] [angry] [chat]`

### Timing & Flow

| Control | Type | Range | Default | Description |
|---------|------|-------|---------|-------------|
| Sentence Pause | slider | 0ms to 2000ms | 250ms | "Silence inserted between sentences. Longer pauses feel more deliberate and easier to follow. Shorter pauses feel more conversational." |
| Paragraph Break | slider | 0ms to 5000ms | 500ms | "Silence inserted between paragraphs or major sections. Helps listeners distinguish topic changes in longer responses." |

### Emphasis

| Control | Type | Options | Default | Description |
|---------|------|---------|---------|-------------|
| Emphasis Level | dropdown | none / reduced / moderate / strong | moderate | "Controls word stress in speech. 'Strong' makes key words stand out more clearly. 'Reduced' makes speech flow more smoothly. Applied to words Azure detects as important." |

### Custom Pronunciations

Editable table for teaching Azure how to say technical terms.

| Word/Phrase | Pronounce As |
|-------------|-------------|
| kubectl | kube control |
| nginx | engine x |
| .env | dot env |
| PostgreSQL | post gres Q L |
| char | care |
| sudo | sue doo |

- `[+ Add pronunciation]` button below table
- Each row has a delete (x) button
- Pronunciations are saved per preset
- Applied to all speech output via SSML `<sub>` elements

Description: "Azure TTS often mispronounces technical terms. Add custom pronunciations here. These are saved with your preset and applied to all speech."

### Audio Quality

| Control | Type | Options | Default | Description |
|---------|------|---------|---------|-------------|
| Output Format | dropdown | Low 16kHz MP3 / Standard 24kHz MP3 / High 48kHz MP3 | Standard 24kHz | "Higher quality sounds better but uses more bandwidth. Standard is recommended for most use. High is best for presentations or recording." |

### Quota Display

```
Usage this session: ~12,400 characters
[===========                        ] ~0.2%
Free tier: 5,000,000 chars/month
```

Description: "Estimated usage since extension loaded. Resets on Azure billing cycle, not per session."

Character count tracked client-side by summing text length of all synthesis requests.

### Save Configuration

```
Preset Name    [Coding Mode                  ]
[Save as Preset]   [Reset to Defaults]
```

**Save as Preset** captures:
- Selected voice (ID + locale)
- Pitch, rate, voice volume
- Speaking style + style intensity
- Sentence pause, paragraph break
- Emphasis level
- Custom pronunciations
- Audio quality setting

Description: "Saves the current voice + all fine-tuning settings as a named preset. Presets appear as chips in your Favorites for instant recall."

### Saved Presets List

```
[# Coding Mode]        Maisie, cheerful, 0.9x
                       [Load] [Edit] [Delete]

[# Presentation]       Sonia, default, 0.85x
                       [Load] [Edit] [Delete]

[# Debugging]          Ryan, chat, 1.0x
                       [Load] [Edit] [Delete]
```

Each preset shows: name, voice, style, rate as a summary. Actions: Load (switch to it), Edit (load into fine-tuning controls), Delete.

---

## Data Model

### VoicePreset (stored in VS Code settings)

```typescript
interface VoicePreset {
  name: string              // "Coding Mode"
  voiceId: string           // "en-GB-MaisieNeural"
  pitch: number             // -50 to 50 (percent)
  rate: number              // 0.5 to 2.0
  volume: number | null     // null = use global
  style: string             // "cheerful" | "default" | etc.
  styleDegree: number       // 0.5 to 2.0
  sentencePause: number     // 0 to 2000 (ms)
  paragraphBreak: number    // 0 to 5000 (ms)
  emphasis: string          // "none" | "reduced" | "moderate" | "strong"
  pronunciations: Array<{   // custom pronunciation overrides
    word: string
    pronounceAs: string
  }>
  audioFormat: string       // "audio-16khz-..." | "audio-24khz-..." | "audio-48khz-..."
}
```

### Favorites (stored in VS Code settings)

```typescript
interface FavoritesConfig {
  starredVoices: string[]   // ["en-GB-MaisieNeural", "en-GB-SoniaNeural"]
  presets: VoicePreset[]    // saved voice+settings combos
  order: string[]           // display order of chips (mix of voice IDs and preset names)
}
```

### AzureVoice (extended from current)

```typescript
interface AzureVoice {
  id: string                // "en-GB-MaisieNeural"
  locale: string            // "en-GB"
  name: string              // "Maisie"
  gender: "Female" | "Male"
  description: string       // "Natural, warm British accent"
  styles: string[]          // ["cheerful", "sad", "angry", "chat"] or []
}
```

### SSML Generation

Fine-tuning controls map to SSML elements:

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
  <voice name="en-GB-MaisieNeural">
    <mstts:express-as style="cheerful" styledegree="1.5">
      <prosody pitch="+5%" rate="0.9" volume="80">
        <emphasis level="moderate">
          <sub alias="kube control">kubectl</sub> apply was successful.
        </emphasis>
      </prosody>
    </mstts:express-as>
    <break time="500ms"/>
  </voice>
</speak>
```

---

## Settings Schema (VS Code)

```jsonc
{
  // Section 1: Connection + Global
  "kilo-code.new.speech.enabled": true,
  "kilo-code.new.speech.autoSpeak": true,
  "kilo-code.new.speech.volume": 80,
  "kilo-code.new.speech.interactionMode": "assist",
  "kilo-code.new.speech.interruptOnType": true,
  "kilo-code.new.speech.debugMode": false,
  "kilo-code.new.speech.sentimentIntensity": 70,
  "kilo-code.new.speech.multiVoiceMode": false,
  "kilo-code.new.speech.azure.apiKey": "",
  "kilo-code.new.speech.azure.region": "westus",
  "kilo-code.new.speech.azure.voiceId": "en-GB-MaisieNeural",

  // Section 2: Favorites
  "kilo-code.new.speech.favorites.starredVoices": ["en-GB-MaisieNeural"],
  "kilo-code.new.speech.favorites.order": ["en-GB-MaisieNeural"],

  // Section 3: Fine-Tuning (active/last-used)
  "kilo-code.new.speech.tuning.pitch": 0,
  "kilo-code.new.speech.tuning.rate": 1.0,
  "kilo-code.new.speech.tuning.volume": null,
  "kilo-code.new.speech.tuning.style": "default",
  "kilo-code.new.speech.tuning.styleDegree": 1.0,
  "kilo-code.new.speech.tuning.sentencePause": 250,
  "kilo-code.new.speech.tuning.paragraphBreak": 500,
  "kilo-code.new.speech.tuning.emphasis": "moderate",
  "kilo-code.new.speech.tuning.audioFormat": "audio-24khz-48kbitrate-mono-mp3",
  "kilo-code.new.speech.tuning.pronunciations": [],

  // Saved Presets
  "kilo-code.new.speech.presets": []
}
```

---

## User Flow

1. **First launch**: Section 1 expanded, enter API key + region, green badge appears, Section 1 auto-collapses
2. **Browse voices**: Section 2 shows all 125+ voices, default Maisie selected
3. **Quick preview**: Click [>] on any voice card to hear it with the test text
4. **Select voice**: Click a voice card, Section 3 expands with fine-tuning controls
5. **Fine-tune**: Adjust pitch, rate, style, pauses. Click Play Preview to test changes
6. **Save preset**: Name it "Coding Mode", click Save. Preset chip appears in Favorites bar
7. **Daily use**: Click a Favorites chip to instantly switch voice + all settings
8. **Discover**: Use search and locale tabs to find new voices, star the ones you like

---

## Files to Modify

| File | Change |
|------|--------|
| `SpeechTab.tsx` | Complete rewrite -- 3 collapsible sections, voice browser, fine-tuning panel |
| `azure-voices.ts` | Add `description` and `styles` fields to each voice entry |
| `speech-playback.ts` | Update `synthesizeAzure()` to build SSML with prosody, style, emphasis, sub elements |
| `SpeechConfig` type | Add fine-tuning fields, preset type, favorites type |
| `KiloProvider.ts` | Handle new settings keys for tuning/presets/favorites |
| `package.json` | Add new settings schema entries for all new controls |

---

## Out of Scope (Future)

- Voice cloning / custom neural voices (Azure Custom Voice)
- Non-English voice support
- SSML visual editor (drag-and-drop prosody)
- Voice recording / export to file
- Viseme / lip-sync data
