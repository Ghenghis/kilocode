# Azure Speech API Reference

## Overview

KiloCode Azure Voice Edition uses the Azure Cognitive Services Speech REST API for text-to-speech synthesis. Azure is the sole voice provider -- there is no browser TTS fallback.

## Endpoint

```
POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1
```

## Authentication

| Header | Value |
|--------|-------|
| `Ocp-Apim-Subscription-Key` | Your Azure API key |
| `Content-Type` | `application/ssml+xml` |
| `X-Microsoft-OutputFormat` | `audio-24khz-48kbitrate-mono-mp3` |

## Request Body (SSML)

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <voice name="en-GB-MaisieNeural">
        Hello, this is a preview of the speech output.
    </voice>
</speak>
```

The `xml:lang` attribute on `<speak>` is required but the actual language is determined by the `<voice name>`.

## Response

- **Success (200)**: MP3 audio blob (`audio-24khz-48kbitrate-mono-mp3`)
- **Error**: HTTP status code with error details

## Speech Pipeline

```
User clicks Play / Auto-speak triggers
  |
  v
ensureAudioReady()          <-- resume AudioContext during gesture
  |
  v
SynthesisCache.get()        <-- check LRU cache (32 entries)
  |  (cache miss)
  v
synthesizeAzure(text, config, signal)
  |-- Build SSML with voice name and escaped text
  |-- POST to Azure TTS endpoint
  |-- Headers: API key, SSML content type, MP3 output format
  |-- Returns: Blob (MP3 audio)
  |
  v
SynthesisCache.set()        <-- store for reuse
  |
  v
playBlobInternal(blob, volume)
  |-- ctx.decodeAudioData(arrayBuffer)
  |-- sourceNode = ctx.createBufferSource()
  |-- gainNode = ctx.createGain() -> volume control
  |-- sourceNode.connect(gainNode).connect(ctx.destination)
  |-- sourceNode.start(0)
  |
  v
Audio plays through speakers
```

## Error Codes

| HTTP Code | Meaning | Resolution |
|-----------|---------|------------|
| 200 | Success | Audio blob returned |
| 400 | Bad Request | Invalid SSML format -- check XML escaping |
| 401 | Unauthorized | Invalid API key -- regenerate in Azure Portal |
| 403 | Forbidden | Key lacks TTS permissions -- check resource config |
| 429 | Rate Limited | Too many requests -- wait and retry |
| 502 | Service Unavailable | Azure outage -- check status.azure.com |

**Note**: A response blob smaller than 100 bytes typically indicates an invalid voice ID or region mismatch.

## Rate Limits

| Tier | Requests/min | Characters/month |
|------|-------------|-----------------|
| Free (F0) | 20 | 5,000,000 |
| Standard (S0) | 100 | Unlimited ($1/1M chars) |

## Complete English Voice Catalog

### en-GB (British English)

| Voice ID | Display Name | Gender |
|----------|-------------|--------|
| en-GB-MaisieNeural | Maisie | Female |
| en-GB-SoniaNeural | Sonia | Female |
| en-GB-ThomasNeural | Thomas | Male |
| en-GB-RyanNeural | Ryan | Male |
| en-GB-AbbiNeural | Abbi | Female |
| en-GB-AlfieNeural | Alfie | Male |
| en-GB-BellaNeural | Bella | Female |
| en-GB-ElliotNeural | Elliot | Male |
| en-GB-EllieNeural | Ellie | Female |
| en-GB-EthanNeural | Ethan | Male |
| en-GB-HollieNeural | Hollie | Female |
| en-GB-MiaNeural | Mia | Female |
| en-GB-NoahNeural | Noah | Male |
| en-GB-OliviaNeural | Olivia | Female |

### en-US (American English)

| Voice ID | Display Name | Gender |
|----------|-------------|--------|
| en-US-AriaNeural | Aria | Female |
| en-US-DavisNeural | Davis | Male |
| en-US-JennyNeural | Jenny | Female |
| en-US-GuyNeural | Guy | Male |
| en-US-JaneNeural | Jane | Female |
| en-US-JasonNeural | Jason | Male |
| en-US-MichelleNeural | Michelle | Female |
| en-US-RogerNeural | Roger | Male |
| en-US-SteffanNeural | Steffan | Male |
| en-US-NancyNeural | Nancy | Female |
| en-US-AmberNeural | Amber | Female |
| en-US-AnaNeural | Ana | Female |
| en-US-ArthurNeural | Arthur | Male |
| en-US-AshleyNeural | Ashley | Female |
| en-US-BrandonNeural | Brandon | Male |
| en-US-BrianNeural | Brian | Male |
| en-US-EmmaNeural | Emma | Female |
| en-US-EricNeural | Eric | Male |
| en-US-JacobNeural | Jacob | Male |
| en-US-JennyMultilingualNeural | Jenny Multilingual | Female |

### en-AU (Australian English)

| Voice ID | Display Name | Gender |
|----------|-------------|--------|
| en-AU-NatashaNeural | Natasha | Female |
| en-AU-WilliamNeural | William | Male |
| en-AU-CourtneyNeural | Courtney | Female |
| en-AU-DanielNeural | Daniel | Male |
| en-AU-JoanneNeural | Joanne | Female |
| en-AU-KenNeural | Ken | Male |
| en-AU-KimNeural | Kim | Female |
| en-AU-LeeNeural | Lee | Male |
| en-AU-LisaNeural | Lisa | Female |
| en-AU-NeilNeural | Neil | Male |
| en-AU-TinaNeural | Tina | Female |

### en-IN (Indian English)

| Voice ID | Display Name | Gender |
|----------|-------------|--------|
| en-IN-NeerjaExpressiveNeural | Neerja Expressive | Female |
| en-IN-NeerjaNeural | Neerja | Female |
| en-IN-PrabhatNeural | Prabhat | Male |
| en-IN-AashiNeural | Aashi | Female |

### en-IE (Irish English)

| Voice ID | Display Name | Gender |
|----------|-------------|--------|
| en-IE-EmilyNeural | Emily | Female |
| en-IE-ConnorNeural | Connor | Male |

### en-CA (Canadian English)

| Voice ID | Display Name | Gender |
|----------|-------------|--------|
| en-CA-ClaraNeural | Clara | Female |
| en-CA-LiamNeural | Liam | Male |

### en-NZ (New Zealand English)

| Voice ID | Display Name | Gender |
|----------|-------------|--------|
| en-NZ-MollyNeural | Molly | Female |
| en-NZ-MitchellNeural | Mitchell | Male |

### en-ZA (South African English)

| Voice ID | Display Name | Gender |
|----------|-------------|--------|
| en-ZA-LeahNeural | Leah | Female |
| en-ZA-LukeNeural | Luke | Male |

## SpeechConfig Schema

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

## References

- [Azure Speech Service documentation](https://learn.microsoft.com/azure/ai-services/speech-service/)
- [Supported voices list](https://learn.microsoft.com/azure/ai-services/speech-service/language-support?tabs=tts)
- [SSML reference](https://learn.microsoft.com/azure/ai-services/speech-service/speech-synthesis-markup)
- [Pricing](https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/)
