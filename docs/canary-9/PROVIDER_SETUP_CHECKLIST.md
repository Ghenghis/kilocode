# KiloCode MAOS canary.10 — Provider Setup Checklist

**Extension:** kilocode.kilo-code 7.2.21-canary.10
**Date:** 2026-04-28
**Purpose:** After rotating API keys, this checklist tells you exactly where each key lives, which UI field to update, and how to verify the connection.

---

## Where API Keys Are Stored

The extension uses **two separate storage mechanisms**. Rotating a `.env` file does NOT automatically update keys already written to VS Code's encrypted store.

| Provider / Service | Storage Location | VS Code key name |
|---|---|---|
| Hermes pipeline (MiniMax routed) | `context.secrets` (encrypted) | `kilo-code.new.hermes.apiKey` |
| MiniMax (onboarding import) | `context.secrets` (encrypted) | `daveai.minimax.apiKey` |
| Anthropic Claude (onboarding import) | `context.secrets` (encrypted) | `daveai.anthropic.apiKey` |
| HuggingFace token (onboarding) | `context.secrets` (encrypted) | `daveai.hf.token` |
| HuggingFace token (training) | `context.secrets` + config | `kilo-code.new.training.huggingface.token` |
| MiniMax (auto-fill / provider config) | `workspace.getConfiguration` (plaintext) | `kilo-code.new.provider.minimax.apiKey` |
| SiliconFlow (auto-fill / provider config) | `workspace.getConfiguration` (plaintext) | `kilo-code.new.provider.siliconflow.apiKey` |
| GitHub token (auto-fill) | `workspace.getConfiguration` (plaintext) | `kilo-code.new.provider.github.token` |
| Azure Speech | `workspace.getConfiguration` (plaintext) | `kilo-code.new.speech.azure.apiKey` |
| Google Cloud TTS | `workspace.getConfiguration` (plaintext) | `kilo-code.new.speech.google.apiKey` |
| OpenAI TTS | `workspace.getConfiguration` (plaintext) | `kilo-code.new.speech.openai.apiKey` |
| ElevenLabs TTS | `workspace.getConfiguration` (plaintext) | `kilo-code.new.speech.elevenlabs.apiKey` |
| Amazon Polly | `workspace.getConfiguration` (plaintext) | `kilo-code.new.speech.polly.accessKeyId` / `.secretAccessKey` |

> **Critical:** Keys in `context.secrets` are stored in the OS credential store (Windows Credential Manager). They survive `.env` rotation and must be updated through the extension UI — not by editing `.env` files.

---

## Key Resolution Priority (Hermes / MiniMax routing)

The Hermes pipeline (which routes to MiniMax and other providers) resolves the bearer key in this order:

1. `context.secrets` under `kilo-code.new.hermes.apiKey` — **wins if set**
2. `process.env.HERMES_API_KEY`
3. `process.env.KILOCODE_API_KEY`
4. `process.env.MINIMAX_API_KEY`
5. `process.env.ANTHROPIC_API_KEY`

If a stale key is in SecretStorage, it will always win over a rotated env var.

---

## Updating Keys After Rotation

### Hermes / MiniMax pipeline key (most important after rotation)

1. Open VS Code Command Palette (`Ctrl+Shift+P`)
2. Run: **`Hermes: Set API Key`** (command ID: `kilo-code.new.hermes.setApiKey`)
3. Paste your new MiniMax/Hermes API key when prompted
4. The extension confirms: "Hermes API key stored in VS Code SecretStorage."

To clear the SecretStorage entry and fall back to env vars instead:
- Run: **`Hermes: Clear API Key`** (command ID: `kilo-code.new.hermes.clearApiKey`)

### MiniMax / Anthropic / HuggingFace (onboarding keys)

These keys are stored under `daveai.*` in SecretStorage. To update them re-run the onboarding wizard, or update them directly via the Settings panel:

1. Open Kilo Code sidebar panel
2. Go to **Settings** tab
3. Navigate to the relevant provider section (see per-provider table below)
4. Paste the new key and save

### Speech provider keys (plaintext config)

These are stored in VS Code's plain settings (`settings.json`), so they DO update when you use Settings UI:

1. Open VS Code Settings (`Ctrl+,`)
2. Search for `kilo-code.new.speech.<provider>.apiKey`
3. Paste the new value

---

## All Supported Providers

### Cloud LLM / Chat Providers (require API keys)

| Provider | Key Field | Where to Get Key | Needs Key? |
|---|---|---|---|
| **MiniMax** (via Hermes bridge) | `kilo-code.new.hermes.apiKey` in SecretStorage | [platform.minimaxi.com](https://platform.minimaxi.com) | YES |
| **MiniMax** (provider config) | `kilo-code.new.provider.minimax.apiKey` in config | [platform.minimaxi.com](https://platform.minimaxi.com) | YES |
| **SiliconFlow** | `kilo-code.new.provider.siliconflow.apiKey` in config | [siliconflow.cn](https://siliconflow.cn) | YES |
| **Anthropic Claude** | `daveai.anthropic.apiKey` in SecretStorage | [console.anthropic.com](https://console.anthropic.com) | YES |
| **GitHub Models** | `kilo-code.new.provider.github.token` in config | [github.com/settings/tokens](https://github.com/settings/tokens) | YES |
| **HuggingFace** | `daveai.hf.token` in SecretStorage | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | YES |
| **OpenAI** | VS Code native config | [platform.openai.com](https://platform.openai.com) | YES |
| **Google Gemini** | VS Code native config | [aistudio.google.com](https://aistudio.google.com) | YES |
| **Azure OpenAI** | VS Code native config | Azure Portal | YES |
| **AWS Bedrock** | VS Code native config | AWS Console | YES |
| **DeepSeek** | VS Code native config | [platform.deepseek.com](https://platform.deepseek.com) | YES |
| **Mistral** | VS Code native config | [console.mistral.ai](https://console.mistral.ai) | YES |
| **Groq** | VS Code native config | [console.groq.com](https://console.groq.com) | YES |
| **xAI (Grok)** | VS Code native config | [x.ai/api](https://x.ai/api) | YES |
| **Fireworks AI** | VS Code native config | [fireworks.ai](https://fireworks.ai) | YES |
| **Featherless** | VS Code native config | [featherless.ai](https://featherless.ai) | YES |
| **Cerebras** | VS Code native config | [cloud.cerebras.ai](https://cloud.cerebras.ai) | YES |
| **SambaNova** | VS Code native config | [cloud.sambanova.ai](https://cloud.sambanova.ai) | YES |
| **OpenRouter** | VS Code native config | [openrouter.ai](https://openrouter.ai) | YES |

### Local Providers (no API key required)

| Provider | Configuration | Needs Key? |
|---|---|---|
| **Ollama** | `kilo-code.new.workstation.localAI.ollama.apiBase` (default: `http://localhost:11434`) | NO — runs locally |
| **LM Studio** | `kilo-code.new.workstation.localAI.lmStudio.apiBase` (default: `http://localhost:1234`) | NO — runs locally |

### Speech / TTS Providers

| Provider | Key Field | Needs Key? |
|---|---|---|
| Browser TTS | built-in | NO |
| **Azure Cognitive Speech** | `kilo-code.new.speech.azure.apiKey` | YES |
| **Google Cloud TTS** | `kilo-code.new.speech.google.apiKey` | YES |
| **OpenAI TTS** | `kilo-code.new.speech.openai.apiKey` | YES |
| **ElevenLabs** | `kilo-code.new.speech.elevenlabs.apiKey` | YES |
| **Amazon Polly** | `kilo-code.new.speech.polly.accessKeyId` + `.secretAccessKey` | YES |

---

## MiniMax + SiliconFlow Specific Setup

This extension is specifically optimised for a MiniMax / SiliconFlow routing stack. The Hermes bridge (`http://187.77.30.206:18789`) routes requests through KiloCode → Hermes → ZeroClaw.

### Step-by-step for MiniMax via Hermes

1. **Enable Hermes pipeline**
   - Command Palette: `Hermes: Toggle Pipeline`
   - Or: Settings > `kilo-code.new.hermes.enabled` = `true`

2. **Store your MiniMax API key**
   - Command Palette: `Hermes: Set API Key`
   - Paste key (format: starts with `eyJ...` or provider-specific prefix)
   - Key is stored encrypted in Windows Credential Manager

3. **Verify Hermes URL is correct**
   - Settings: `kilo-code.new.hermes.baseUrl` = `http://187.77.30.206:18789`

4. **Test the connection** (see section below)

### Step-by-step for SiliconFlow (direct provider)

1. Settings > Search `kilo-code.new.provider.siliconflow.apiKey`
2. Paste your SiliconFlow API key (format: `sk-...`)
3. The auto-fill button in the Settings UI can pull this from `C:\Users\Admin\Downloads\api\.env.contract-kit` or `SILICONFLOW_API_KEY` env var automatically

---

## Testing a Provider Connection

### Test Hermes / MiniMax pipeline

1. Command Palette (`Ctrl+Shift+P`)
2. Run: **`Hermes: Test Connection`** (command ID: `kilo-code.new.hermes.testConnection`)
3. A notification shows:
   - Bridge URL
   - Reachable: yes/no
   - Status OK: yes/no
   - Latency in ms
   - Key source: `secret` (SecretStorage) or `env` (environment variable)
   - Server version

### Test speech providers (Azure, etc.)

1. Open Settings > Kilo Code > Speech
2. Use the **Validate** / **Test** button next to the API key field
3. For Azure: the extension sends a test request to `https://<region>.api.cognitive.microsoft.com/sts/v1.0/issueToken`

### Auto-discover keys from Downloads folder

The extension scans `C:\Users\Admin\Downloads\api\` for `.env` files automatically. If your new keys are in that folder:

1. Open Kilo Code Settings panel in the sidebar
2. Look for the **Auto-fill** button next to each provider field
3. Clicking it triggers a scan of the downloads folder and known env vars

---

## After Rotating Keys — Quick Checklist

- [ ] Run `Hermes: Clear API Key` to remove the old stale SecretStorage key
- [ ] Run `Hermes: Set API Key` and paste the new MiniMax / Hermes key
- [ ] Run `Hermes: Test Connection` — confirm "Status OK: yes" and "Key source: secret"
- [ ] If using SiliconFlow directly: update `kilo-code.new.provider.siliconflow.apiKey` in VS Code Settings
- [ ] Update `.env` files in `C:\Users\Admin\Downloads\api\` with rotated values
- [ ] If speech is used: update `kilo-code.new.speech.azure.apiKey` (or relevant TTS provider) in VS Code Settings (`Ctrl+,`)
- [ ] If HuggingFace training is used: re-run onboarding or update `kilo-code.new.training.huggingface.token` in settings

---

## Legacy Migration Note

If you previously used KiloCode v5.x (Roo Code fork), old provider profiles were stored in SecretStorage under `roo_cline_config_api_config`. The new extension has a migration service that reads these on first run and copies them to the new key locations. If migration already ran, you must update keys through the Settings UI — the old SecretStorage entries are deleted after migration.
