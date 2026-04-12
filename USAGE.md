# Usage Guide - KiloCode Azure Voice Edition

## Speech Settings Panel

Access via the KiloCode sidebar settings.

### Top Section

```
+---------------------------------------------------+
| Enable Speech                            [toggle] |
| Enable text-to-speech output for assistant replies |
|                                                   |
| Auto-Speak                               [toggle] |
| Automatically speak assistant replies when they    |
| complete.                                         |
|                                                   |
| Interaction Mode                     [Assist  v]  |
| Choose how voice responses work during your        |
| session                                           |
|                                                   |
| Volume                        [=======*==] 80%    |
| Speech output volume level.                       |
+---------------------------------------------------+
```

### Azure TTS Connection

```
+---------------------------------------------------+
| API Key                    [********************]  |
| Azure Cognitive Services subscription key.         |
|                                                   |
| Region                              [westus    ]  |
| Azure service region (e.g. eastus, westus2).       |
|                                                   |
| Locale Filter                    [All Locales v]  |
| Filter voices by English locale.                   |
|                                                   |
| Voice                  [Maisie (UK) (Female)  v]  |
| Azure Neural TTS voice to use.                     |
+---------------------------------------------------+
```

### Preview

```
+---------------------------------------------------+
| Preview -- Azure TTS                              |
|                                                   |
| [Hello! This is a preview of the speech output. ] |
|                                                   |
| Play Preview     Compare All                      |
+---------------------------------------------------+
```

### Advanced Settings

```
+---------------------------------------------------+
| Speech Debug Mode                        [toggle] |
| Show verbose speech engine logs in the developer   |
| console.                                          |
|                                                   |
| Sentiment Intensity             [======*==] 70%   |
| How strongly the TTS engine modulates pitch and    |
| rate to reflect emotional tone in responses.       |
|                                                   |
| Stop speech when typing                  [toggle] |
| Automatically interrupt ongoing speech playback    |
| as soon as you start typing a new message.         |
+---------------------------------------------------+
```

### Voice Profiles

Applied automatically based on content detection. Intensity is scaled by the Sentiment Intensity setting.

| Content type | Profile | Modifiers |
|-------------|---------|-----------|
| Error / stack trace | **serious** | Pitch -1 st, Rate 0.95x |
| Success / completion | **upbeat** | Pitch +/-0, Rate 1.0x |
| Code explanation | **teaching** | Pitch +/-0, Rate 0.9x |
| Quick confirmation | **casual** | Pitch +0.5 st, Rate 1.1x |

### Multi-Voice Dialogue Mode

When enabled, each AI agent speaks in a distinct voice when multiple agents are active in a conversation. Toggle off by default.

## Controls Reference

### Enable Speech
Toggle speech synthesis on/off. When enabled, the extension speaks assistant replies.

### Auto-Speak
Automatically speaks assistant replies when they complete. No need to click Play each time.

### Interaction Mode
Choose how voice responses work during your session. Default: **Assist**.

### Volume
Slider from 0-100% (default 80%). Controls the gain node in the Web Audio API pipeline.

### API Key
Paste your Azure Cognitive Services subscription key. The field is masked for security.

### Region
Text input for your Azure service region (e.g., `westus`, `eastus`, `westus2`). Must match where you created the Speech resource.

### Locale Filter
Filter the voice dropdown by English locale (e.g., en-GB only, en-US only) or show **All Locales**.

### Voice
Browse 100+ English neural voices. Each entry shows display name, locale, and gender.
Format: `Maisie (UK) (Female)`.
Default: **Maisie (UK) (Female)** -- `en-GB-MaisieNeural`.

### Preview
Type custom text or use the default phrase. Two buttons:
- **Play Preview**: Hear the selected voice with Azure TTS
- **Compare All**: Compare multiple voices side by side

### Sentiment Intensity
Controls how strongly the TTS engine modulates pitch and rate to reflect emotional tone (default 70%). Scales the Voice Profiles modifiers.

### Speech Debug Mode
Enables verbose speech engine logs in the VS Code developer console for troubleshooting.

### Stop Speech When Typing
Automatically interrupts ongoing speech playback as soon as you start typing a new message. Enabled by default.

## Workflow

### Basic Usage
1. Enter your Azure API key and region
2. Pick a voice (or keep UK Maisie as default)
3. Click **Play Preview** to verify audio works
4. Code as normal -- assistant replies are spoken automatically

### Changing Voices
1. Optionally filter by locale using the Locale Filter dropdown
2. Open the Voice dropdown
3. Select a new voice
4. Click **Play Preview** to hear it
5. Voice is saved to VS Code settings automatically

### Using Voice Profiles
Voice profiles are automatic -- the TTS engine detects content type and adjusts:
- Error messages sound more serious (lower pitch, slower)
- Success messages sound upbeat
- Code explanations use a teaching tone (slightly slower)
- Quick confirmations are casual (slightly higher pitch, faster)

Adjust the **Sentiment Intensity** slider to control how pronounced these adjustments are.

### Troubleshooting Audio
If you hear nothing:
1. Check VS Code volume is not muted
2. Check the API key is entered and region is correct
3. Try clicking **Play Preview** (user gesture resumes AudioContext)
4. Enable **Speech Debug Mode** and check developer console
5. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Voice Highlights

| Voice | Locale | Gender | Notes |
|-------|--------|--------|-------|
| Maisie | en-GB | Female | **Default** -- natural UK accent |
| Sonia | en-GB | Female | Clear, professional UK voice |
| Ryan | en-GB | Male | Warm UK male voice |
| Aria | en-US | Female | Versatile US voice |
| Davis | en-US | Male | Natural US male voice |
| Natasha | en-AU | Female | Clear Australian accent |
| Neerja | en-IN | Female | Indian English, expressive variant available |

See [API.md](API.md) for the complete voice catalog.
