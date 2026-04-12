# Setup Guide - KiloCode Azure Voice Edition

## 1. Azure Account Setup

### Create a Speech Resource

1. Sign up at https://azure.microsoft.com/free/ (free tier includes 5M characters/month)
2. Go to [Azure Portal](https://portal.azure.com)
3. Search for **Speech Services** and click **Create**
4. Configure:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new or select existing
   - **Region**: Choose closest region (e.g., West US, UK South, West Europe)
   - **Name**: e.g., "KiloCode-Speech"
   - **Pricing Tier**: Free (F0) or Standard (S0)
5. Click **Create** and wait for deployment

### Get Your API Key

1. Navigate to your Speech resource in Azure Portal
2. Go to **Keys and Endpoint**
3. Copy **Key 1** or **Key 2**
4. Note your **Region** (e.g., `westus`, `uksouth`, `westeurope`)

## 2. Extension Installation

### Build from Source

```bash
git clone https://github.com/Ghenghis/Kilocode-Azure.git
cd kilocode-Azure/packages/kilo-vscode

# Full build pipeline (typecheck + lint + esbuild)
npm run package -- --no-dependencies

# Create VSIX package
npx @vscode/vsce package --no-dependencies

# Install in VS Code
code --install-extension kilo-code-7.2.1.vsix --force
```

### Verify the Build

- VSIX file should be **~75 MB** (includes the CLI binary)
- A 16 MB VSIX means the binary is missing -- rebuild with the full pipeline
- **Never** run `node esbuild.js` directly -- it skips `prepare:cli-binary`

### Reload VS Code

After installing, press `Ctrl+Shift+P` and run **Reload Window**.

## 3. Configure Azure Connection

1. Open KiloCode Speech Settings in VS Code
2. Enter your **API Key** in the key input field
3. Select your **Region** from the dropdown (default: `westus`)
4. Click **Validate**
5. Wait for the connection indicator:
   - **Green**: Connected -- Azure TTS is ready
   - **Red**: Failed -- check your key and region

### VS Code Settings (JSON)

You can also configure directly in `settings.json`:

```jsonc
{
  "kilo-code.new.speech.enabled": true,
  "kilo-code.new.speech.autoSpeak": true,
  "kilo-code.new.speech.volume": 80,
  "kilo-code.new.speech.azure.apiKey": "your-key-here",
  "kilo-code.new.speech.azure.region": "westus",
  "kilo-code.new.speech.azure.voiceId": "en-GB-MaisieNeural"
}
```

## 4. Select a Voice

1. Open the **Voice** dropdown in Speech Settings
2. Voices are grouped by locale:
   - English - UK (en-GB) -- 14 voices
   - English - US (en-US) -- 20+ voices
   - English - AU (en-AU) -- 11 voices
   - And more...
3. Default is **Maisie (Female, UK)** -- `en-GB-MaisieNeural`
4. Click **Play Preview** to hear your selected voice

## Azure Regions

| Region ID | Location |
|-----------|----------|
| `westus` | West US |
| `eastus` | East US |
| `westeurope` | West Europe |
| `uksouth` | UK South |
| `southeastasia` | Southeast Asia |
| `australiaeast` | Australia East |

Choose the region closest to you for lowest latency. Your API key must match the region where you created the Speech resource.

## Next Steps

- [Usage Guide](USAGE.md) -- Learn the full speech settings UI
- [Troubleshooting](TROUBLESHOOTING.md) -- Common setup issues
