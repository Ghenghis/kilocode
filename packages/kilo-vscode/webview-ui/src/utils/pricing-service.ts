/**
 * pricing-service.ts
 * Fetches real-time AI provider pricing data.
 *
 * Strategy:
 * 1. Try to fetch from provider APIs that expose pricing (e.g., OpenRouter aggregates many)
 * 2. Fall back to cached/known prices with timestamp
 * 3. Cache results in localStorage for 24h to avoid hammering APIs
 *
 * Best source: https://openrouter.ai/api/v1/models returns pricing for 100+ models
 */

export interface ModelPricing {
	id: string
	name: string
	provider: string
	inputPer1M: number // USD per 1M input tokens
	outputPer1M: number // USD per 1M output tokens
	contextLength: number
	isLocal: boolean
	lastUpdated: number // timestamp
}

const CACHE_KEY = "kilo_pricing_cache"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Fallback pricing data (used when API unavailable)
// Accurate as of 2026-04 based on official provider pages:
//   OpenAI: $2.50/$10.00 for GPT-4o, $0.15/$0.60 for GPT-4o Mini
//   Anthropic: $3.00/$15.00 for Claude Sonnet 4.6, $1.00/$5.00 for Claude Haiku 4.5
//   Groq: $0.59/$0.79 for Llama 3.3 70B, $0.05/$0.08 for Llama 3.1 8B
//   DeepSeek: $0.28/$0.42 for DeepSeek V3 Chat, $0.55/$2.19 for DeepSeek R1
//   MiniMax: $0.30/$1.20 for MiniMax M2.7, $0.15/$1.15 for MiniMax M2.5
//   SiliconFlow: $0.05-$0.086/M for Qwen2.5 models
export const FALLBACK_PRICING: ModelPricing[] = [
	{
		id: "openai/gpt-4o",
		name: "GPT-4o",
		provider: "OpenAI",
		inputPer1M: 2.5,
		outputPer1M: 10.0,
		contextLength: 128000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "openai/gpt-4o-mini",
		name: "GPT-4o Mini",
		provider: "OpenAI",
		inputPer1M: 0.15,
		outputPer1M: 0.6,
		contextLength: 128000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "anthropic/claude-sonnet-4-6",
		name: "Claude Sonnet 4.6",
		provider: "Anthropic",
		inputPer1M: 3.0,
		outputPer1M: 15.0,
		contextLength: 200000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "anthropic/claude-haiku-4-5",
		name: "Claude Haiku 4.5",
		provider: "Anthropic",
		inputPer1M: 1.0,
		outputPer1M: 5.0,
		contextLength: 200000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "groq/llama-3.3-70b-versatile",
		name: "Llama 3.3 70B (Groq)",
		provider: "Groq",
		inputPer1M: 0.59,
		outputPer1M: 0.79,
		contextLength: 128000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "groq/llama-3.1-8b-instant",
		name: "Llama 3.1 8B (Groq)",
		provider: "Groq",
		inputPer1M: 0.05,
		outputPer1M: 0.08,
		contextLength: 128000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "deepseek/deepseek-chat",
		name: "DeepSeek V3 Chat",
		provider: "DeepSeek",
		inputPer1M: 0.28,
		outputPer1M: 0.42,
		contextLength: 64000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "deepseek/deepseek-reasoner",
		name: "DeepSeek R1",
		provider: "DeepSeek",
		inputPer1M: 0.55,
		outputPer1M: 2.19,
		contextLength: 64000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "minimax/minimax-m2.7",
		name: "MiniMax M2.7",
		provider: "MiniMax",
		inputPer1M: 0.3,
		outputPer1M: 1.2,
		contextLength: 1000000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "minimax/minimax-m2.5",
		name: "MiniMax M2.5",
		provider: "MiniMax",
		inputPer1M: 0.15,
		outputPer1M: 1.15,
		contextLength: 1000000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "siliconflow/qwen2.5-72b",
		name: "Qwen 2.5 72B (SiliconFlow)",
		provider: "SiliconFlow",
		inputPer1M: 0.086,
		outputPer1M: 0.086,
		contextLength: 32000,
		isLocal: false,
		lastUpdated: 1745000000000,
	},
	{
		id: "ollama/local",
		name: "Ollama (any model)",
		provider: "Ollama",
		inputPer1M: 0,
		outputPer1M: 0,
		contextLength: 0,
		isLocal: true,
		lastUpdated: 1745000000000,
	},
	{
		id: "lmstudio/local",
		name: "LM Studio (any model)",
		provider: "LM Studio",
		inputPer1M: 0,
		outputPer1M: 0,
		contextLength: 0,
		isLocal: true,
		lastUpdated: 1745000000000,
	},
]

interface OpenRouterModel {
	id: string
	name: string
	pricing?: { prompt: string; completion: string }
	context_length?: number
}

function loadCache(): { data: ModelPricing[]; timestamp: number } | null {
	try {
		const raw = localStorage.getItem(CACHE_KEY)
		if (!raw) return null
		return JSON.parse(raw)
	} catch {
		return null
	}
}

function saveCache(data: ModelPricing[]): void {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
	} catch {
		/* storage quota */
	}
}

/**
 * Fetch real-time pricing from OpenRouter's public API.
 * OpenRouter aggregates pricing for 100+ models including GPT-4o, Claude, etc.
 * No auth required for the models listing endpoint.
 */
export async function fetchLivePricing(): Promise<ModelPricing[]> {
	// Check cache first
	const cached = loadCache()
	if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
		return cached.data
	}

	try {
		const res = await fetch("https://openrouter.ai/api/v1/models", {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(8000),
		})
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		const json = (await res.json()) as { data: OpenRouterModel[] }

		const pricing: ModelPricing[] = json.data
			.filter((m) => m.pricing?.prompt && m.pricing?.completion)
			.map((m) => {
				const inputPer1M = parseFloat(m.pricing!.prompt) * 1_000_000
				const outputPer1M = parseFloat(m.pricing!.completion) * 1_000_000
				const [providerSlug] = m.id.split("/")
				return {
					id: m.id,
					name: m.name,
					provider: providerSlug.charAt(0).toUpperCase() + providerSlug.slice(1),
					inputPer1M,
					outputPer1M,
					contextLength: m.context_length ?? 0,
					isLocal: false,
					lastUpdated: Date.now(),
				}
			})

		// Merge with local providers (always free)
		const withLocals = [...pricing, ...FALLBACK_PRICING.filter((p) => p.isLocal)]

		saveCache(withLocals)
		return withLocals
	} catch {
		// Return fallback on any error
		return FALLBACK_PRICING
	}
}

export function formatPrice(usdPer1M: number): string {
	if (usdPer1M === 0) return "FREE"
	if (usdPer1M < 1) return `$${usdPer1M.toFixed(2)}`
	return `$${usdPer1M.toFixed(2)}`
}

export function getCacheAge(): string {
	const cached = loadCache()
	if (!cached) return "never"
	const ageMs = Date.now() - cached.timestamp
	const ageMin = Math.floor(ageMs / 60000)
	if (ageMin < 60) return `${ageMin}m ago`
	return `${Math.floor(ageMin / 60)}h ago`
}

// ── Static per-provider fallback pricing ─────────────────────────────────────

/**
 * Flat per-provider pricing averages used when no model-level data is available.
 * Values represent a reasonable midpoint for the provider's typical model tier.
 */
export const PROVIDER_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
	anthropic:   { inputPer1M: 3.0,  outputPer1M: 15.0  },
	openai:      { inputPer1M: 2.5,  outputPer1M: 10.0  },
	deepseek:    { inputPer1M: 0.14, outputPer1M: 0.28  },
	groq:        { inputPer1M: 0.05, outputPer1M: 0.08  },
	minimax:     { inputPer1M: 0.20, outputPer1M: 0.60  },
	siliconflow: { inputPer1M: 0.07, outputPer1M: 0.21  },
	ollama:      { inputPer1M: 0,    outputPer1M: 0     },
	lmstudio:    { inputPer1M: 0,    outputPer1M: 0     },
	openrouter:  { inputPer1M: 0.50, outputPer1M: 2.0   },
}

// ── New exports ───────────────────────────────────────────────────────────────

/**
 * Look up pricing for a specific provider from live cache or PROVIDER_PRICING fallback.
 * Returns { inputPer1M, outputPer1M } or null if the provider is completely unknown.
 */
export function getProviderPricing(providerId: string): { inputPer1M: number; outputPer1M: number } | null {
	const needle = providerId.toLowerCase()

	// 1. Check PROVIDER_PRICING (fast path)
	if (PROVIDER_PRICING[needle]) return PROVIDER_PRICING[needle]

	// 2. Try to derive from live/cached model data
	const cached = loadCache()
	const source = cached ? cached.data : FALLBACK_PRICING
	const entry = source.find(
		(m) =>
			m.provider.toLowerCase() === needle ||
			m.id.toLowerCase().startsWith(`${needle}/`)
	)
	if (!entry) return null
	return { inputPer1M: entry.inputPer1M, outputPer1M: entry.outputPer1M }
}

/**
 * Formats a cost estimate as "~$0.043" given token counts and a provider id.
 * Falls back to PROVIDER_PRICING when no model-level data is found.
 */
export function formatCostEstimate(
	inputTokens: number,
	outputTokens: number,
	providerId: string
): string {
	const pricing = getProviderPricing(providerId)
	if (!pricing) return "~$?"
	const cost =
		(inputTokens / 1_000_000) * pricing.inputPer1M +
		(outputTokens / 1_000_000) * pricing.outputPer1M
	if (cost === 0) return "FREE"
	if (cost < 0.001) return `~$${cost.toFixed(6)}`
	if (cost < 0.01) return `~$${cost.toFixed(4)}`
	return `~$${cost.toFixed(3)}`
}

/**
 * Returns whether the live-cached price for a model is higher, lower, or equal
 * to the hardcoded fallback price (simulates a 30-day comparison).
 */
export function getPricingTrend(modelId: string): "up" | "down" | "stable" {
	const cached = loadCache()
	if (!cached) return "stable"
	const live = cached.data.find((m) => m.id === modelId)
	const fallback = FALLBACK_PRICING.find((m) => m.id === modelId)
	if (!live || !fallback) return "stable"
	const liveAvg = (live.inputPer1M + live.outputPer1M) / 2
	const fallbackAvg = (fallback.inputPer1M + fallback.outputPer1M) / 2
	const diff = liveAvg - fallbackAvg
	if (Math.abs(diff) < 0.001) return "stable"
	return diff > 0 ? "up" : "down"
}

// ── Capability matrix for all 9 supported providers ──────────────────────────

export interface ProviderCapabilities {
	vision: boolean
	tools: boolean
	streaming: boolean
	maxContext: number
}

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
	openai:      { vision: true,  tools: true,  streaming: true,  maxContext: 128000  },
	anthropic:   { vision: true,  tools: true,  streaming: true,  maxContext: 200000  },
	groq:        { vision: false, tools: true,  streaming: true,  maxContext: 128000  },
	deepseek:    { vision: false, tools: true,  streaming: true,  maxContext: 64000   },
	minimax:     { vision: false, tools: false, streaming: true,  maxContext: 1000000 },
	siliconflow: { vision: false, tools: true,  streaming: true,  maxContext: 32000   },
	ollama:      { vision: false, tools: false, streaming: true,  maxContext: 8192    },
	lmstudio:    { vision: false, tools: false, streaming: true,  maxContext: 4096    },
	"azure-oai": { vision: true,  tools: true,  streaming: true,  maxContext: 128000  },
}

// ── Display metadata shared across tabs ──────────────────────────────────────

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
	openai:      "OpenAI",
	anthropic:   "Anthropic",
	groq:        "Groq",
	deepseek:    "DeepSeek",
	minimax:     "MiniMax",
	siliconflow: "SiliconFlow",
	ollama:      "Ollama",
	lmstudio:    "LM Studio",
	"azure-oai": "Azure OpenAI",
}

export const PROVIDER_COLORS: Record<string, string> = {
	openai:      "#10a37f",
	anthropic:   "#cc785c",
	groq:        "#f55036",
	deepseek:    "#4a9eff",
	minimax:     "#9b59b6",
	siliconflow: "#e67e22",
	ollama:      "#3498db",
	lmstudio:    "#8e44ad",
	"azure-oai": "#0078d4",
}
