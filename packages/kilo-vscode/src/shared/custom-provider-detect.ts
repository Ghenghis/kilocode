/**
 * Custom-provider environment detection + connection/model testing.
 *
 * SECURITY: API keys MUST never be logged in cleartext. The `maskKey()` helper
 * is the single sink for any key surfaced in errors or telemetry.
 */

export type DetectedProvider = {
  /** Display name (e.g. "OpenAI", "Anthropic", "Ollama"). */
  name: string
  /** Stable id used as the providerID seed (e.g. "openai", "ollama"). */
  id: string
  /** OpenAI-compatible base URL (no trailing slash). Suggested default. */
  baseUrl: string
  /** Env var the apiKey was sourced from (omitted for keyless providers like Ollama). */
  apiKeyEnv?: string
  /** API shape the test endpoints should use. */
  shape: "openai" | "ollama"
  /** True when the environment actually populated this provider. */
  detected: boolean
}

export type TestConnectionResult = {
  ok: boolean
  latencyMs: number
  modelCount?: number
  error?: string
  /** True when error was HTTP 401/403. */
  auth?: boolean
}

export type TestModelResult = {
  ok: boolean
  latencyMs: number
  error?: string
  auth?: boolean
}

const DEFAULT_TIMEOUT_MS = 10_000

/** Mask a secret to the form `sk-…ab12` (or `***` if too short). Never throws. */
export function maskKey(raw: string | undefined | null): string {
  if (!raw) return "(none)"
  const s = String(raw)
  if (s.length <= 6) return "***"
  return `${s.slice(0, 3)}…${s.slice(-3)}`
}

/** Strip any cleartext key from an error string by replacing it with the mask. */
function scrub(err: string, key?: string): string {
  if (!key) return err
  return err.split(key).join(maskKey(key))
}

/**
 * Scan `process.env` for known provider env vars and synthesize candidate configs.
 * Always returns the full registry — `detected` flips to true when env populated it.
 */
export function detectCustomProviderEnv(env: NodeJS.ProcessEnv = process.env): DetectedProvider[] {
  const get = (...names: string[]) => names.find((n) => !!env[n])
  const result: DetectedProvider[] = []

  // OpenAI / OpenAI-compatible
  {
    const keyVar = get("OPENAI_API_KEY", "OPENAI_KEY")
    const base = env.OPENAI_BASE_URL || env.OPENAI_API_BASE || "https://api.openai.com/v1"
    result.push({
      name: "OpenAI",
      id: "openai",
      baseUrl: stripTrailing(base),
      apiKeyEnv: keyVar,
      shape: "openai",
      detected: !!keyVar,
    })
  }

  // Anthropic — uses OpenAI-style /v1/models when `/v1` baseUrl is provided
  {
    const keyVar = get("ANTHROPIC_API_KEY", "CLAUDE_API_KEY")
    const base = env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1"
    result.push({
      name: "Anthropic",
      id: "anthropic",
      baseUrl: stripTrailing(base),
      apiKeyEnv: keyVar,
      shape: "openai",
      detected: !!keyVar,
    })
  }

  // Groq
  {
    const keyVar = get("GROQ_API_KEY")
    result.push({
      name: "Groq",
      id: "groq",
      baseUrl: stripTrailing(env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"),
      apiKeyEnv: keyVar,
      shape: "openai",
      detected: !!keyVar,
    })
  }

  // Together AI
  {
    const keyVar = get("TOGETHER_API_KEY")
    result.push({
      name: "Together AI",
      id: "together",
      baseUrl: stripTrailing(env.TOGETHER_BASE_URL || "https://api.together.xyz/v1"),
      apiKeyEnv: keyVar,
      shape: "openai",
      detected: !!keyVar,
    })
  }

  // Mistral
  {
    const keyVar = get("MISTRAL_API_KEY")
    result.push({
      name: "Mistral",
      id: "mistral",
      baseUrl: stripTrailing(env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1"),
      apiKeyEnv: keyVar,
      shape: "openai",
      detected: !!keyVar,
    })
  }

  // OpenRouter
  {
    const keyVar = get("OPENROUTER_API_KEY", "OPEN_ROUTER_API_KEY")
    result.push({
      name: "OpenRouter",
      id: "openrouter",
      baseUrl: stripTrailing(env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"),
      apiKeyEnv: keyVar,
      shape: "openai",
      detected: !!keyVar,
    })
  }

  // Ollama (no API key, hostname-based detection)
  {
    const host = env.OLLAMA_HOST || env.OLLAMA_BASE_URL
    const baseUrl = host ? normalizeOllamaHost(host) : "http://localhost:11434"
    result.push({
      name: "Ollama",
      id: "ollama",
      baseUrl,
      shape: "ollama",
      detected: !!host,
    })
  }

  // LM Studio (OpenAI-compatible, no key required by default)
  {
    const url = env.LM_STUDIO_URL || env.LMSTUDIO_BASE_URL
    result.push({
      name: "LM Studio",
      id: "lmstudio",
      baseUrl: stripTrailing(url || "http://localhost:1234/v1"),
      shape: "openai",
      detected: !!url,
    })
  }

  // vLLM / generic OpenAI-compatible local server
  {
    const url = env.VLLM_BASE_URL || env.OPENAI_COMPATIBLE_BASE_URL
    if (url) {
      result.push({
        name: "vLLM",
        id: "vllm",
        baseUrl: stripTrailing(url),
        apiKeyEnv: get("VLLM_API_KEY"),
        shape: "openai",
        detected: true,
      })
    }
  }

  return result
}

function stripTrailing(s: string): string {
  return s.replace(/\/+$/, "")
}

function normalizeOllamaHost(raw: string): string {
  const trimmed = raw.trim()
  if (/^https?:\/\//.test(trimmed)) return stripTrailing(trimmed)
  // Bare host:port form, common for OLLAMA_HOST
  return stripTrailing(`http://${trimmed}`)
}

/** Build the right `/models` (or `/api/tags`) URL for the API shape. */
function listEndpoint(baseUrl: string, shape: "openai" | "ollama"): string {
  const base = stripTrailing(baseUrl)
  if (shape === "ollama") {
    // Ollama lists installed models at /api/tags
    return base.replace(/\/v1$/, "") + "/api/tags"
  }
  // OpenAI-compatible
  return base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`
}

function chatEndpoint(baseUrl: string, shape: "openai" | "ollama"): string {
  const base = stripTrailing(baseUrl)
  if (shape === "ollama") {
    return base.replace(/\/v1$/, "") + "/api/generate"
  }
  return base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`
}

/** Test connection to a custom provider. Returns latency + (best-effort) model count. */
export async function testCustomProviderConnection(opts: {
  baseUrl: string
  apiKey?: string
  shape: "openai" | "ollama"
  headers?: Record<string, string>
  timeoutMs?: number
}): Promise<TestConnectionResult> {
  const url = listEndpoint(opts.baseUrl, opts.shape)
  const headers: Record<string, string> = { "Content-Type": "application/json", ...opts.headers }
  if (opts.apiKey && opts.shape === "openai") {
    headers["Authorization"] = `Bearer ${opts.apiKey}`
  }

  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
    const latencyMs = Date.now() - started

    if (!res.ok) {
      const text = await safeText(res)
      const auth = res.status === 401 || res.status === 403
      return {
        ok: false,
        latencyMs,
        auth,
        error: scrub(`HTTP ${res.status}: ${text.slice(0, 200)}`, opts.apiKey),
      }
    }

    let modelCount: number | undefined
    try {
      const body = (await res.json()) as { data?: unknown[]; models?: unknown[] }
      const items = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : undefined
      if (items) modelCount = items.length
    } catch {
      // Body wasn't JSON — connection still ok.
    }

    return { ok: true, latencyMs, modelCount }
  } catch (err) {
    const latencyMs = Date.now() - started
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, latencyMs, error: scrub(message, opts.apiKey) }
  }
}

/** Send a 1-token "ping" completion to verify the model serves traffic. */
export async function testCustomProviderModel(opts: {
  baseUrl: string
  apiKey?: string
  modelId: string
  shape: "openai" | "ollama"
  headers?: Record<string, string>
  timeoutMs?: number
}): Promise<TestModelResult> {
  const url = chatEndpoint(opts.baseUrl, opts.shape)
  const headers: Record<string, string> = { "Content-Type": "application/json", ...opts.headers }
  if (opts.apiKey && opts.shape === "openai") {
    headers["Authorization"] = `Bearer ${opts.apiKey}`
  }

  const body =
    opts.shape === "ollama"
      ? { model: opts.modelId, prompt: "ping", stream: false, options: { num_predict: 1 } }
      : {
          model: opts.modelId,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          stream: false,
        }

  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
    const latencyMs = Date.now() - started

    if (!res.ok) {
      const text = await safeText(res)
      const auth = res.status === 401 || res.status === 403
      return {
        ok: false,
        latencyMs,
        auth,
        error: scrub(`HTTP ${res.status}: ${text.slice(0, 200)}`, opts.apiKey),
      }
    }

    // Drain body so the connection is freed; we don't care about content.
    await res.text().catch(() => "")
    return { ok: true, latencyMs }
  } catch (err) {
    const latencyMs = Date.now() - started
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, latencyMs, error: scrub(message, opts.apiKey) }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}
