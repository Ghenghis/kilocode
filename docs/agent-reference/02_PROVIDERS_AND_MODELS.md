# KiloCode Providers & Models
> FOR AGENTS. Typed, structured, exhaustive.

---

## 1. Model String Format

All model references use the format `"<providerID>/<modelID>"`.

```
"anthropic/claude-3-5-sonnet-20241022"
"openai/gpt-4o"
"google/gemini-2.5-pro-preview-05-06"
"amazon-bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0"
"kilo/anthropic/claude-sonnet-4-5"
"openrouter/anthropic/claude-3-5-sonnet"
"gitlab/duo-chat-sonnet-4-6"
"github-copilot/claude-opus-4.6"
"lmstudio/llama3"
"ollama-cloud/llama3.2"
```

The `/` after the first token is the providerID/modelID split. Model IDs may themselves contain `/` (e.g. openrouter, kilo).

**Parsing:**
```typescript
function parseModel(model: string): { providerID: ProviderID; modelID: ModelID } {
  const [providerID, ...rest] = model.split("/")
  return { providerID: ProviderID.make(providerID), modelID: ModelID.make(rest.join("/")) }
}
```

Config keys:
- `model`: default main model — `"anthropic/claude-sonnet-4-5"`
- `small_model`: lightweight model for title gen / summarization

---

## 2. Core TypeScript Types

### ProviderID / ModelID (branded strings)

```typescript
// packages/opencode/src/provider/schema.ts
type ProviderID = string & Brand<"ProviderID">
type ModelID    = string & Brand<"ModelID">

// Well-known ProviderID constants:
ProviderID.kilo               // "kilo"
ProviderID.opencode           // "opencode"
ProviderID.anthropic          // "anthropic"
ProviderID.openai             // "openai"
ProviderID.google             // "google"
ProviderID.googleVertex       // "google-vertex"
ProviderID.githubCopilot      // "github-copilot"
ProviderID.amazonBedrock      // "amazon-bedrock"
ProviderID.azure              // "azure"
ProviderID.openrouter         // "openrouter"
ProviderID.mistral            // "mistral"
ProviderID.gitlab             // "gitlab"
```

### Model (runtime schema + inferred type)

```typescript
// packages/opencode/src/provider/provider.ts  (Model zod schema)
interface Model {
  id:         ModelID
  providerID: ProviderID
  name:       string
  family?:    string
  status:     "alpha" | "beta" | "deprecated" | "active"
  release_date: string
  api: {
    id:  string   // actual model ID sent to the API
    url: string   // base URL
    npm: string   // npm package name
  }
  capabilities: {
    temperature: boolean
    reasoning:   boolean
    attachment:  boolean
    toolcall:    boolean
    input:  { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean }
    output: { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean }
    interleaved: boolean | { field: "reasoning_content" | "reasoning_details" }
  }
  cost: {
    input:  number   // USD per token (input)
    output: number   // USD per token (output)
    cache: { read: number; write: number }
    experimentalOver200K?: {
      input: number; output: number
      cache: { read: number; write: number }
    }
  }
  limit: {
    context: number
    input?:  number
    output:  number
  }
  options:  Record<string, any>
  headers:  Record<string, string>
  variants: Record<string, Record<string, any>>

  // KiloCode extensions:
  recommendedIndex?: number
  prompt?:          string   // enum from PROMPTS
  isFree?:          boolean
  ai_sdk_provider?: string  // enum from AI_SDK_PROVIDERS
}
```

### Provider Info

```typescript
// packages/opencode/src/provider/provider.ts  (Info zod schema)
interface ProviderInfo {
  id:      ProviderID
  name:    string
  source:  "env" | "config" | "custom" | "api"
  env:     string[]        // env var names that activate this provider
  key?:    string          // resolved API key
  options: Record<string, any>
  models:  Record<string, Model>
}
```

### ConfigProvider.Info (opencode.json / kilo.jsonc shape)

```typescript
// packages/opencode/src/config/provider.ts
interface ProviderConfig {
  api?:       string             // override base URL
  name?:      string
  env?:       string[]
  id?:        string
  npm?:       string
  whitelist?: string[]           // only these model IDs
  blacklist?: string[]           // exclude these model IDs
  options?: {
    apiKey?:       string
    baseURL?:      string
    timeout?:      number | false  // ms; false = disable; default 120000
    chunkTimeout?: number          // ms between SSE chunks
    enterpriseUrl?: string         // GitHub Enterprise URL (copilot only)
    setCacheKey?:   boolean        // enable promptCacheKey
    [key: string]:  any
  }
  models?: Record<string, ConfigProvider.Model | null>  // null = delete sentinel
}
```

### ConfigProvider.Model (per-model override in config)

```typescript
interface ConfigProviderModel {
  id?:           string
  name?:         string
  family?:       string
  release_date?: string
  attachment?:   boolean
  reasoning?:    boolean
  temperature?:  boolean
  tool_call?:    boolean
  interleaved?:  boolean | { field: "reasoning_content" | "reasoning_details" }
  cost?: {
    input?: number; output?: number
    cache_read?: number; cache_write?: number
  }
  limit?: { context?: number; input?: number; output?: number }
  modalities?: {
    input?:  ("text"|"audio"|"image"|"video"|"pdf")[]
    output?: ("text"|"audio"|"image"|"video"|"pdf")[]
  }
  status?:   "alpha" | "beta" | "deprecated"
  provider?: { npm?: string; api?: string }
  options?:  Record<string, any>
  headers?:  Record<string, string>
  variants?: Record<string, { disabled?: boolean; [key: string]: any } | null>
}
```

---

## 3. Provider Discovery Flow

```
1. Load models.dev snapshot (bundled at build; refreshed from https://models.dev/api.json every 60 min)
2. Inject kilo provider: fetch models from https://api.kilo.ai/api/openrouter (or org-scoped URL)
3. Inject apertis provider: fetch from https://api.apertis.ai/v1
4. Merge config providers (opencode.json / kilo.jsonc  →  provider[id] blocks)
5. Activate providers whose env vars are set
6. Activate providers with stored API keys (auth store)
7. Run custom loaders (for amazon-bedrock, google-vertex, azure, gitlab, cloudflare, etc.)
8. Re-apply config provider options (highest precedence)
9. GitLab: dynamic model discovery via discoverWorkflowModels() — appended to gitlab.models
10. Plugin auth loaders can inject additional options
11. Filter: disabled_providers removed; enabled_providers kept exclusively
12. Filter: alpha models hidden unless KILO_ENABLE_EXPERIMENTAL_MODELS flag
13. Filter: deprecated models always removed
14. Filter: blacklist / whitelist per provider applied
```

**Model count source:**
- Static list from `models.dev` snapshot (bundled JS + JSON cache at `~/.kilo/cache/models.json`)
- Dynamic fetch: kilo (API), apertis (API), gitlab (project-scoped API)
- Custom config: models added via `provider[id].models` in config files

---

## 4. All Providers

### 4.1 Provider Table (confirmed from snapshot + source)

| Provider | ID | Auth Method | ENV Vars | npm Package | Base URL | Notes |
|---|---|---|---|---|---|---|
| Anthropic | `anthropic` | API key | `ANTHROPIC_API_KEY` | `@ai-sdk/anthropic` | SDK default (https://api.anthropic.com) | Adds `anthropic-beta: claude-code-20250219,...` header |
| OpenAI | `openai` | API key | `OPENAI_API_KEY` | `@ai-sdk/openai` | SDK default (https://api.openai.com/v1) | Uses Responses API for GPT-5+ models |
| Google | `google` | API key | `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` | `@ai-sdk/google` | SDK default | |
| Amazon Bedrock | `amazon-bedrock` | AWS creds / bearer token | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BEARER_TOKEN_BEDROCK` | `@ai-sdk/amazon-bedrock` | SDK default | Cross-region prefixing applied automatically |
| Azure OpenAI | `azure` | API key + resource name | `AZURE_RESOURCE_NAME`, `AZURE_API_KEY`, `AZURE_OPENAI_ENDPOINT` | `@ai-sdk/azure` | `https://<resource>.openai.azure.com` | Uses Responses API unless `useCompletionUrls` option set |
| Azure Cognitive Services | `azure-cognitive-services` | API key + resource name | `AZURE_COGNITIVE_SERVICES_RESOURCE_NAME`, `AZURE_COGNITIVE_SERVICES_API_KEY` | `@ai-sdk/azure` | `https://<resource>.cognitiveservices.azure.com/openai` | |
| OpenRouter | `openrouter` | API key | `OPENROUTER_API_KEY` | `@openrouter/ai-sdk-provider` | `https://openrouter.ai/api/v1` | Adds `HTTP-Referer` and `X-Title` headers |
| Mistral | `mistral` | API key | `MISTRAL_API_KEY` | `@ai-sdk/mistral` | SDK default | |
| Groq | `groq` | API key | `GROQ_API_KEY` | `@ai-sdk/groq` | SDK default | |
| xAI (Grok) | `xai` | API key | `XAI_API_KEY` | `@ai-sdk/xai` | SDK default | Uses Responses API |
| Cohere | `cohere` | API key | `COHERE_API_KEY` | `@ai-sdk/cohere` | SDK default | |
| Cerebras | `cerebras` | API key | `CEREBRAS_API_KEY` | `@ai-sdk/cerebras` | SDK default | Adds `X-Cerebras-3rd-Party-Integration: kilo` header |
| DeepInfra | `deepinfra` | API key | `DEEPINFRA_API_KEY` | `@ai-sdk/deepinfra` | SDK default | |
| Together AI | `togetherai` | API key | `TOGETHER_API_KEY` | `@ai-sdk/togetherai` | SDK default | |
| Perplexity | `perplexity` | API key | `PERPLEXITY_API_KEY` | `@ai-sdk/perplexity` | SDK default | |
| Vercel AI Gateway | `vercel` | API key | `AI_GATEWAY_API_KEY` | `@ai-sdk/gateway` | SDK default | Adds `http-referer` and `x-title` headers |
| Alibaba (DashScope Intl) | `alibaba` | API key | `DASHSCOPE_API_KEY` | `@ai-sdk/alibaba` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | |
| Google Vertex AI | `google-vertex` | GCP ADC | `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS` | `@ai-sdk/google-vertex` | GCP Vertex endpoint | Requires project; fetches GCP access token via google-auth-library |
| Google Vertex (Anthropic) | `google-vertex-anthropic` | GCP ADC | `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS` | `@ai-sdk/google-vertex/anthropic` | GCP Vertex Anthropic endpoint | |
| GitHub Copilot | `github-copilot` | OAuth or token | `GITHUB_TOKEN` | `@ai-sdk/openai-compatible` (custom SDK) | `https://api.githubcopilot.com` | Uses Responses API for GPT-5+; chat for GPT-5-mini |
| GitHub Copilot Enterprise | `github-copilot-enterprise` | OAuth or token | `GITHUB_TOKEN` | `@ai-sdk/github-copilot` | GitHub Enterprise URL | KiloCode-added; see `enterpriseUrl` option |
| GitHub Models | `github-models` | API key / token | `GITHUB_TOKEN` | `@ai-sdk/openai-compatible` | `https://models.github.ai/inference` | |
| GitLab Duo | `gitlab` | OAuth or API key | `GITLAB_TOKEN` | `gitlab-ai-provider` | `https://gitlab.com` (or `GITLAB_INSTANCE_URL`) | Dynamic workflow model discovery; OAuth or PRIVATE-TOKEN auth |
| Kilo Gateway | `kilo` | OAuth or API key | `KILO_API_KEY` | `@kilocode/kilo-gateway` | `https://api.kilo.ai/api/openrouter` (anon) or org-scoped | Free models available without auth; routes via org-scoped URL when `kilocodeOrganizationId` set |
| OpenCode Zen | `opencode` | API key | `OPENCODE_API_KEY` | `@ai-sdk/openai-compatible` | `https://opencode.ai/zen/v1` | Free models available without auth |
| Apertis | `apertis` | API key | `APERTIS_API_KEY` | `@ai-sdk/openai-compatible` | `https://api.apertis.ai/v1` | Models fetched dynamically |
| Cloudflare Workers AI | `cloudflare-workers-ai` | API key + account ID | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_KEY` | `@ai-sdk/openai-compatible` | `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1` | Account ID required |
| Cloudflare AI Gateway | `cloudflare-ai-gateway` | API token | `CLOUDFLARE_API_TOKEN` (or `CF_AIG_TOKEN`), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_ID` | `ai-gateway-provider` | Dynamic from account/gateway IDs | Unified API `provider/model` format; uses `createAiGateway` + `createUnified` |
| SAP AI Core | `sap-ai-core` | Service key | `AICORE_SERVICE_KEY`, `AICORE_DEPLOYMENT_ID`, `AICORE_RESOURCE_GROUP` | `@jerome-benoit/sap-ai-provider-v2` | SAP AI Core endpoint | Service key JSON stored in env var |
| Venice AI | `venice` | API key | `VENICE_API_KEY` | `venice-ai-sdk-provider` | SDK default | |
| LMStudio | `lmstudio` | API key (optional) | `LMSTUDIO_API_KEY` | `@ai-sdk/openai-compatible` | `http://127.0.0.1:1234/v1` | Local inference |
| Ollama Cloud | `ollama-cloud` | API key | `OLLAMA_API_KEY` | `@ai-sdk/openai-compatible` | `https://ollama.com/v1` | |
| Fireworks AI | `fireworks-ai` | API key | `FIREWORKS_API_KEY` | `@ai-sdk/openai-compatible` | `https://api.fireworks.ai/inference/v1/` | |
| DeepSeek | `deepseek` | API key | `DEEPSEEK_API_KEY` | `@ai-sdk/openai-compatible` | `https://api.deepseek.com` | |
| Nvidia NIM | `nvidia` | API key | `NVIDIA_API_KEY` | `@ai-sdk/openai-compatible` | `https://integrate.api.nvidia.com/v1` | |
| NovitaAI | `novita-ai` | API key | `NOVITA_API_KEY` | `@ai-sdk/openai-compatible` | `https://api.novita.ai/openai` | |
| Nebius | `nebius` | API key | `NEBIUS_API_KEY` | `@ai-sdk/openai-compatible` | `https://api.tokenfactory.nebius.com/v1` | |
| ZenMux | `zenmux` | API key | `ZENMUX_API_KEY` | `@ai-sdk/openai-compatible` | `https://zenmux.ai/api/v1` | Adds `HTTP-Referer` / `X-Title` headers |
| SiliconFlow | `siliconflow` | API key | `SILICONFLOW_API_KEY` | `@ai-sdk/openai-compatible` | `https://api.siliconflow.com/v1` | |

> Additional providers in snapshot (115 total): `302ai`, `abacus`, `alibaba-cn`, `alibaba-coding-plan`, `aihubmix`, `baseten`, `berget`, `chutes`, `clarifai`, `cohere`, `cortecs`, `deepseek`, `digitalocean`, `dinference`, `drun`, `evroc`, `firmware`, `friendli`, `groq`, `helicone`, `hpc-ai`, `huggingface`, `inception`, `inference`, `io-net`, `jiekou`, `kimi-for-coding`, `llama`, `llmgateway`, `lucidquery`, `meganova`, `minimax`, `modelscope`, `moonshotai`, `morph`, `nano-gpt`, `nova`, `ovhcloud`, `poe`, `privatemode-ai`, `qiniu-ai`, `regolo-ai`, `requesty`, `scaleway`, `siliconflow-cn`, `stackit`, `stepfun`, `synthetic`, `tencent-coding-plan`, `the-grid-ai`, `upstage`, `venice`, `vivgrid`, `vultr`, `wandb`, `wafer.ai`, `xiaomi`, `zhipuai`, `zai`, and others. These follow the same OpenAI-compatible pattern.

---

## 5. Auth Flows

### 5.1 Auth Types

```typescript
// Auth stored in ~/.kilo/auth/<providerID>.json
type AuthInfo =
  | { type: "api";  key: string; metadata?: Record<string, any> }
  | { type: "oauth"; access: string; refresh?: string; expires?: number; accountId?: string; [key: string]: any }
  | { type: "wellknown"; key: string; token: string }  // enterprise SSO

// Source priority (highest first):
// 1. auth store (kilo auth <provider>)
// 2. env vars (e.g. ANTHROPIC_API_KEY)
// 3. config file options.apiKey
// 4. anonymous/public fallback (kilo, opencode only)
```

### 5.2 Auth Method Schema

```typescript
// packages/opencode/src/provider/auth.ts
interface AuthMethod {
  type:    "oauth" | "api"
  label:   string
  prompts?: Array<TextPrompt | SelectPrompt>
}

interface TextPrompt {
  type:         "text"
  key:          string
  message:      string
  placeholder?: string
  when?:        { key: string; op: "eq" | "neq"; value: string }
}

interface SelectPrompt {
  type:    "select"
  key:     string
  message: string
  options: Array<{ label: string; value: string; hint?: string }>
  when?:   { key: string; op: "eq" | "neq"; value: string }
}
```

### 5.3 Provider-Specific Auth Notes

| Provider | Auth Flow | Notes |
|---|---|---|
| `anthropic` | API key | `ANTHROPIC_API_KEY` or stored key |
| `openai` | API key | `OPENAI_API_KEY` or stored key |
| `google` | API key | `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` |
| `amazon-bedrock` | AWS credential chain | Profile, access keys, IAM role, web identity, or bearer token; `AWS_BEARER_TOKEN_BEDROCK` takes highest precedence |
| `azure` | API key + resource | `AZURE_RESOURCE_NAME` + `AZURE_API_KEY`; or `AZURE_OPENAI_ENDPOINT` |
| `google-vertex` | GCP ADC | `google-auth-library` `getApplicationDefault()`; requires `GOOGLE_VERTEX_PROJECT` |
| `google-vertex-anthropic` | GCP ADC | Same as `google-vertex` |
| `github-copilot` | OAuth (GitHub) | Plugin-driven OAuth; stores `access` token |
| `github-copilot-enterprise` | OAuth (GitHub Enterprise) | `enterpriseUrl` option required |
| `gitlab` | OAuth or API key | OAuth: `Authorization: Bearer`; API key: `PRIVATE-TOKEN` header |
| `kilo` | OAuth or API key | OAuth via Kilo Cloud; free tier uses `apiKey: "anonymous"` |
| `cloudflare-workers-ai` | API key + account ID | `CLOUDFLARE_ACCOUNT_ID` required; accountId also storable in auth metadata |
| `cloudflare-ai-gateway` | API token | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_GATEWAY_ID` all required |
| `sap-ai-core` | Service key JSON | `AICORE_SERVICE_KEY` environment variable with JSON blob |

---

## 6. Model Discovery Details

### 6.1 Static Source (models.dev)

- **Bundled snapshot:** `packages/opencode/src/provider/models-snapshot.js` — compiled at build time
- **Cache file:** `~/.kilo/cache/models.json` (or hash-suffixed for custom URLs)
- **TTL:** 5 minutes (300 000 ms) before refresh attempt; background refresh every 60 min
- **Override:** `KILO_MODELS_PATH` env var to load from a local file; `KILO_MODELS_URL` to change source URL
- **Disable fetch:** `KILO_DISABLE_MODELS_FETCH` flag

```typescript
// Resolution order in models.ts → get()
// 1. KILO_MODELS_PATH file (if set)
// 2. ~/.kilo/cache/models.json
// 3. Bundled models-snapshot.js
// 4. Fetch from https://models.dev/api.json
```

### 6.2 Dynamic Sources

| Provider | Discovery Method | API Endpoint |
|---|---|---|
| `kilo` | `ModelCache.fetch("kilo", opts)` | `https://api.kilo.ai/api/openrouter` (or org-scoped) |
| `apertis` | `ModelCache.fetch("apertis", opts)` | `https://api.apertis.ai/v1` |
| `gitlab` | `discoverWorkflowModels()` from `gitlab-ai-provider` | `<instanceUrl>/api/v4/...` |

### 6.3 Config-Injected Models

Any provider block in config can define custom models:

```jsonc
// kilo.jsonc
{
  "provider": {
    "my-litellm": {
      "api": "http://localhost:4000/v1",
      "npm": "@ai-sdk/openai-compatible",
      "env": ["LITELLM_API_KEY"],
      "models": {
        "my-model": {
          "name": "My Custom Model",
          "limit": { "context": 128000, "output": 8192 },
          "temperature": true,
          "tool_call": true,
          "attachment": false,
          "reasoning": false
        }
      }
    }
  }
}
```

---

## 7. Key Files

| File | Purpose |
|---|---|
| `packages/opencode/src/provider/schema.ts` | `ProviderID` and `ModelID` branded types + well-known constants |
| `packages/opencode/src/provider/provider.ts` | Main `Provider.Service` Effect layer; `Model` and `Info` zod schemas; `parseModel()` |
| `packages/opencode/src/provider/models.ts` | models.dev fetch/cache logic; `Provider` and `Model` raw schemas; `get()` |
| `packages/opencode/src/provider/models-snapshot.js` | Bundled static provider/model snapshot (generated at build) |
| `packages/opencode/src/provider/model-cache.ts` | Dynamic model cache (`ModelCache.fetch`, `ModelCache.refresh`) |
| `packages/opencode/src/provider/auth.ts` | `ProviderAuth.Service` Effect layer; OAuth flow orchestration |
| `packages/opencode/src/provider/transform.ts` | Model variant transforms |
| `packages/opencode/src/provider/sdk/copilot/` | Custom GitHub Copilot SDK (chat + Responses API adapters) |
| `packages/opencode/src/config/provider.ts` | `ConfigProvider.Info` and `ConfigProvider.Model` zod schemas (config file shapes) |
| `packages/opencode/src/config/config.ts` | Global `Config.Info` schema including `provider`, `model`, `small_model`, `enabled_providers`, `disabled_providers` |
| `packages/opencode/src/kilocode/provider/provider.ts` | KiloCode provider patches: `KILO_BUNDLED_PROVIDERS`, `kiloCustomLoaders`, `patchCustomLoaderResult`, `buildTimeoutSignal` |

---

## 8. Provider Loading Order and State

```
State machine per instance (InstanceState):
  providers:    Record<ProviderID, ProviderInfo>    // active + configured
  sdk:          Map<string, BundledSDK>             // cached SDK instances (keyed by hash)
  modelLoaders: Record<string, CustomModelLoader>  // per-provider model selector fn
  varsLoaders:  Record<string, CustomVarsLoader>   // per-provider URL template vars
```

Provider `source` field values:
- `"env"` — activated by environment variable
- `"api"` — activated by stored API key (auth store)
- `"config"` — explicitly configured in config file
- `"custom"` — activated by custom loader (e.g. AWS credential chain detected)

`autoload: true` on a custom loader result → provider added to active set even without explicit env/key.

---

## 9. Default Model Resolution

```typescript
// Priority order in Provider.Service.defaultModel():
// 1. cfg.model (explicit config key "model")
// 2. ~/.kilo/state/model.json (most recently used)
// 3. First provider in active providers list
//    → sorted by: gpt-5 > claude-sonnet-4 > big-pickle > gemini-3-pro > "latest" suffix > lexicographic desc

// Small model priority per provider (getSmallModel()):
// default:           ["claude-haiku-4-5","claude-haiku-4.5","3-5-haiku","3.5-haiku","gemini-3-flash","gemini-2.5-flash","gpt-5-nano"]
// opencode-*:        ["gpt-5-nano"]
// github-copilot-*:  ["gpt-5-mini","claude-haiku-4.5", ...default]
// kilo-*:            ["kilo-auto/small"]
// cfg.small_model overrides all of the above
```

---

## 10. Amazon Bedrock Cross-Region Model ID Prefixing

Bedrock model IDs are automatically prefixed based on region:

| Region prefix | Applied prefix | Model families |
|---|---|---|
| `us-*` (non-gov) | `us.` | claude, nova-*, deepseek |
| `eu-west-*`, `eu-north-*`, `eu-central-*`, `eu-south-*` | `eu.` | claude, nova-lite, nova-micro, llama3, pixtral |
| `ap-southeast-2`, `ap-southeast-4` | `au.` | anthropic.claude-sonnet-4-5, anthropic.claude-haiku |
| `ap-northeast-1` | `jp.` | claude, nova-lite, nova-micro, nova-pro |
| other `ap-*` | `apac.` | claude, nova-lite, nova-micro, nova-pro |
| Models already prefixed with `global.`, `us.`, `eu.`, `jp.`, `apac.`, `au.` | unchanged | — |

---

## 11. OpenAI-Compatible Provider Configuration Pattern

Any custom provider using `@ai-sdk/openai-compatible`:

```jsonc
{
  "provider": {
    "<custom-id>": {
      "api": "https://your-endpoint/v1",
      "npm": "@ai-sdk/openai-compatible",
      "env": ["YOUR_API_KEY_ENV"],
      "options": {
        "apiKey": "optional-literal-key",
        "baseURL": "https://your-endpoint/v1",
        "timeout": 120000
      },
      "models": {
        "<model-id>": {
          "name": "Display Name",
          "limit": { "context": 128000, "output": 8192 },
          "temperature": true,
          "tool_call": true,
          "attachment": false,
          "reasoning": false,
          "release_date": "2025-01-01"
        }
      }
    }
  }
}
```

Bundled npm packages for custom providers: all packages in `BUNDLED_PROVIDERS` map are pre-bundled. Unbundled packages are installed on-demand via `Npm.add()`.

---

## 12. canary.9 improvements

### ProvidersTab: testProviderKey / testProviderKeyResult message flow

`ProvidersTab` now has an inline "Test" button next to each API key input field. The flow:

1. User clicks **Test** → webview sends `{ type: "testProviderKey", requestId: string, providerID: string, apiKey: string }`.
2. Extension validates the key against the provider's endpoint (lightweight `/models` or equivalent call).
3. Extension responds with `{ type: "testProviderKeyResult", requestId: string, success: boolean, error?: string }`.
4. ProvidersTab displays a success check or error message inline below the key field.

**Health badge:** Each provider card now shows a coloured health badge:
- Green (`healthy`) — key present and last test passed
- Amber (`unknown`) — key present but not yet tested in this session
- Red (`error`) — last test failed (error text stored in component state)

**Debounce:** Test is automatically triggered 800 ms after the user stops typing in the API key field (in addition to the explicit Test button). Debounce is implemented with a `useDebounce` hook in `ProvidersTab.tsx`.

### ModelsTab: favorites via toggleFavorite message, cost/context/capability display, virtualization

- **Favorites:** Clicking the star icon on a model card dispatches `{ type: "toggleFavorite", action: "add"|"remove", providerID, modelID }`. The extension persists to `globalState["favoriteModels"]` and broadcasts `{ type: "favoritesLoaded", favorites }` back. Favorites are shown in a dedicated **Starred** section at the top of the model list.
- **Cost / context / capability display:** Each model card now renders three metadata chips:
  - Cost: `$X.XX / 1M tok` (input cost from `model.cost.input * 1_000_000`)
  - Context: human-formatted context window (e.g. `200K`, `1M`)
  - Capabilities: icon pills for `image`, `reasoning`, `audio`, `pdf` (shown only when `true`)
- **Virtualization:** The model list uses a virtual scroll window (`react-virtual` or equivalent) so that large provider lists (500+ models) render without DOM performance degradation. Only visible rows are mounted.

### CustomProviderDialog: provider presets, connection test, env detection

- **Provider presets:** The "Add Custom Provider" dialog now ships a preset picker with common OpenAI-compatible endpoints (LiteLLM, Ollama local, LM Studio, vLLM, etc.). Selecting a preset pre-fills `baseURL`, `npm`, and any required env var names.
- **Connection test:** A **Test Connection** button sends `{ type: "testCustomProviderConnection", requestId, baseURL, apiKey? }`. The extension attempts a `GET <baseURL>/models` request and returns `{ type: "customProviderConnectionResult", requestId, success, models?: string[], error? }`. If successful, the dialog populates the model list automatically.
- **Env detection:** On dialog open the extension sends `{ type: "detectCustomProviderEnv" }`. The extension scans the current process environment for known provider env vars and returns `{ type: "customProviderEnvDetected", detected: Record<string, string> }`. Detected vars are shown as suggested values in the dialog form.

### CustomProviderModelCard: test button, capability inference from model ID

- **Test button:** Each model entry in `CustomProviderModelCard` has a per-model **Test** button. Clicking it dispatches `{ type: "testCustomProviderModel", requestId, baseURL, apiKey?, modelID }`. The extension sends a minimal completion request to verify the model is reachable and returns `{ type: "customProviderModelTestResult", requestId, modelID, success, latencyMs?, error? }`. Pass/fail is shown inline.
- **Capability inference from model ID:** When a custom model is added without explicit capability flags, `CustomProviderModelCard` applies a heuristic based on the model ID string:
  - Contains `vision`, `vl`, `image` → `attachment: true`
  - Contains `reasoning`, `think`, `r1` → `reasoning: true`
  - Contains `instruct`, `chat` → `toolcall: true` (default true for most)
  - Contains `tts`, `audio` → audio output capability flagged
  These inferred values are shown as editable checkboxes and written to the config `models[id]` block on save.
