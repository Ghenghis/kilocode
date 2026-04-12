# KiloCode - Azure Voice Edition

**Version 7.2.1**

A fork of [KiloCode](https://github.com/Kilo-Org/kilocode) with Azure Cognitive Services as the **default and only** voice provider. Stock browser TTS voices are replaced with Azure's premium neural voices. No RVC Docker dependency, no browser fallback.

**Default voice**: en-GB-MaisieNeural (UK female)

## Features

- **Azure Neural Voices**: 100+ premium English voices grouped by locale
  - en-GB (British English)
  - en-US (American English)
  - en-AU (Australian English)
  - en-IN (Indian English)
  - en-IE (Irish English)
  - en-CA (Canadian English)
  - en-NZ (New Zealand English)
  - en-ZA (South African English)
- **API Key Management**: Secure masked key input with region configuration
- **Locale Filter**: Filter voices by English locale or browse all
- **Grouped Voice Dropdown**: Browse voices by locale with display name and gender
- **Voice Profiles**: Automatic tone adjustment based on content type (error, success, teaching, casual)
- **Sentiment Intensity**: Control how strongly pitch/rate modulate for emotional tone
- **Interaction Mode**: Choose how voice responses work during sessions
- **Multi-Voice Dialogue**: Each AI agent uses a distinct voice in multi-agent conversations
- **Compare All**: Preview and compare multiple voices side by side
- **Stop on Typing**: Auto-interrupt speech when you start typing
- **Speech Debug Mode**: Verbose engine logs in developer console
- **Web Audio API Playback**: Reliable audio in VS Code webviews (no autoplay restrictions)
- **Synthesis Cache**: LRU cache (32 entries) for repeated phrases
- **Auto-Speak**: Automatically speaks assistant replies when they complete

## What Changed From Base KiloCode

| Removed | Kept | Added |
|---------|------|-------|
| RVC Docker integration | Azure TTS synthesis | Azure as default provider |
| Browser TTS as default | Web Audio API playback | API key input with validation |
| Fallback chain (RVC -> Azure -> Browser) | SynthesisCache | Grouped voice dropdown (100+ voices) |
| AudioCritic quality gate | Auto-speak on idle | Connection status indicator |
| ChunkedSpeechPlayer RVC path | Volume control | Region selector |
| VoiceStudioProvider RVC proxy | Speech Log | Default: en-GB-MaisieNeural |
| All RVC message types/handlers | Preview button | Simplified SpeechConfig |

## Quick Start

1. Install the VSIX extension in VS Code
2. Open Speech Settings (Ctrl+Shift+P -> "KiloCode: Speech Settings")
3. Enter your Azure API key and click Validate
4. Green indicator = connected, red = invalid key
5. Select a voice from the dropdown (default: UK Maisie)
6. Start coding -- assistant replies are spoken with your chosen Azure voice

## Build & Install

```bash
cd packages/kilo-vscode
npm run package -- --no-dependencies     # typecheck + lint + esbuild
npx @vscode/vsce package --no-dependencies  # create VSIX (~75 MB)
code --install-extension kilo-code-7.2.1.vsix --force
# Ctrl+Shift+P -> "Reload Window"
```

**Important**: Verify the VSIX is ~75 MB. A 16 MB VSIX means the CLI binary is missing and the extension will be broken.

## Requirements

- VS Code 1.80+
- Azure Cognitive Services Speech resource ([free tier available](https://azure.microsoft.com/free/))
- Internet connection for Azure TTS API

## Documentation

- [Setup Guide](SETUP.md) -- Azure account and extension installation
- [Usage Guide](USAGE.md) -- Using the speech settings UI
- [API Reference](API.md) -- Azure Speech API details and voice catalog
- [Troubleshooting](TROUBLESHOOTING.md) -- Common issues and fixes
- [Changelog](CHANGELOG.md) -- Version history

## Technical Details

- **UI Framework**: Solid.js (VS Code webview)
- **Audio**: Web Audio API (`AudioContext` + `AudioBufferSourceNode`)
- **API**: Azure Cognitive Services Speech REST API
- **Cache**: LRU synthesis cache (32 entries)
- **Build**: esbuild + vsce packaging

See [docs/plans/AZURE-VOICE-EDITION-SPEC.md](docs/plans/AZURE-VOICE-EDITION-SPEC.md) for the full technical specification.

## License

MIT License -- see [LICENSE](LICENSE)

## Links

- **GitHub**: https://github.com/Ghenghis/Kilocode-Azure
- **Base Project**: https://github.com/Kilo-Org/kilocode
- **Azure Speech Docs**: https://learn.microsoft.com/azure/ai-services/speech-service/
