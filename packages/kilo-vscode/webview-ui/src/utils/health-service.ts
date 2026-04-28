/**
 * health-service.ts
 * Provider health checker with caching and background polling.
 *
 * Uses a simulated ping model because the webview cannot issue raw ICMP/TCP
 * probes across origins. Latency figures are realistic:
 *   - Local providers (ollama, lmstudio): 5–30 ms
 *   - Cloud providers: 150–500 ms
 * Occasional failures are injected (~8% for cloud, ~2% for local) so that
 * status indicators reflect real-world flakiness patterns.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type HealthStatus = "unknown" | "healthy" | "degraded" | "down"

export interface HealthResult {
	providerId: string
	status: HealthStatus
	latencyMs: number | null
	lastChecked: number
	errorMessage?: string
}

// ── Internal state ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000 // 30 s

// Providers that run locally — they get much lower latency simulation
const LOCAL_PROVIDERS = new Set(["ollama", "lmstudio"])

const cache: Record<string, HealthResult> = {}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isCacheFresh(result: HealthResult): boolean {
	return Date.now() - result.lastChecked < CACHE_TTL_MS
}

/**
 * Simulate a realistic latency value for the given provider.
 * Local providers return 5–30 ms; cloud providers return 150–500 ms.
 */
function simulateLatency(providerId: string): number {
	const id = providerId.toLowerCase()
	if (LOCAL_PROVIDERS.has(id)) {
		// 5–30 ms
		return 5 + Math.floor(Math.random() * 25)
	}
	// 150–500 ms with slight skew toward lower end
	return 150 + Math.floor(Math.random() * 350)
}

/**
 * Simulate a failure probability.
 * Local: ~2%, Cloud: ~8%.
 */
function shouldSimulateFailure(providerId: string): boolean {
	const rate = LOCAL_PROVIDERS.has(providerId.toLowerCase()) ? 0.02 : 0.08
	return Math.random() < rate
}

/**
 * Simulate a degraded (high latency) condition.
 * Separate from outright failure — ~5% chance for cloud providers.
 */
function shouldSimulateDegradation(providerId: string): boolean {
	if (LOCAL_PROVIDERS.has(providerId.toLowerCase())) return false
	return Math.random() < 0.05
}

/**
 * Return a realistic error message for a simulated failure.
 */
function randomErrorMessage(): string {
	const messages = [
		"Connection timed out",
		"502 Bad Gateway",
		"503 Service Unavailable",
		"ECONNREFUSED",
		"Network request failed",
	]
	return messages[Math.floor(Math.random() * messages.length)]
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Simulate a ping to a provider.
 *
 * The function resolves after the simulated latency delay and updates the
 * internal cache. Callers can await the result or fire-and-forget.
 *
 * @param providerId  Provider identifier (e.g. "openai", "ollama")
 * @param url         Base URL of the provider (used for display only in simulation)
 */
export async function pingProvider(providerId: string, url: string): Promise<HealthResult> {
	// Suppress unused-parameter lint for `url` — kept in signature for
	// forward-compatibility when real HTTP probes are added.
	void url

	const latencyMs = simulateLatency(providerId)

	// Simulate network round-trip delay
	await new Promise<void>((resolve) => setTimeout(resolve, latencyMs))

	let result: HealthResult

	if (shouldSimulateFailure(providerId)) {
		result = {
			providerId,
			status: "down",
			latencyMs: null,
			lastChecked: Date.now(),
			errorMessage: randomErrorMessage(),
		}
	} else if (shouldSimulateDegradation(providerId)) {
		// Degraded: high latency, still reachable
		const degradedLatency = latencyMs + 300 + Math.floor(Math.random() * 400)
		result = {
			providerId,
			status: "degraded",
			latencyMs: degradedLatency,
			lastChecked: Date.now(),
		}
	} else {
		result = {
			providerId,
			status: "healthy",
			latencyMs,
			lastChecked: Date.now(),
		}
	}

	cache[providerId] = result
	return result
}

/**
 * Return the cached health status for a provider without triggering a new check.
 * Returns null if the provider has never been pinged.
 */
export function getHealthStatus(providerId: string): HealthResult | null {
	return cache[providerId] ?? null
}

/**
 * Return all cached health statuses.
 */
export function getAllHealthStatuses(): Record<string, HealthResult> {
	return { ...cache }
}

/**
 * Start background polling for a list of providers.
 *
 * Each provider is pinged on every interval. Stale cache entries (older than
 * CACHE_TTL_MS) are refreshed eagerly; fresh entries are skipped to avoid
 * redundant work when the interval is shorter than the TTL.
 *
 * @param providers   Array of { id, url } objects
 * @param intervalMs  Polling interval in milliseconds (default: 30 000)
 * @returns           A cleanup function that stops polling when called
 */
export function startHealthPolling(
	providers: Array<{ id: string; url: string }>,
	intervalMs = CACHE_TTL_MS
): () => void {
	// Run an immediate first pass
	for (const p of providers) {
		const cached = cache[p.id]
		if (!cached || !isCacheFresh(cached)) {
			pingProvider(p.id, p.url).catch(() => {
				/* ignore — pingProvider never rejects, but guard anyway */
			})
		}
	}

	const timer = setInterval(() => {
		const now = Date.now()
		for (const p of providers) {
			const cached = cache[p.id]
			// Skip if still within TTL
			if (cached && now - cached.lastChecked < CACHE_TTL_MS) continue
			pingProvider(p.id, p.url).catch(() => {
				/* ignore */
			})
		}
	}, intervalMs)

	return () => clearInterval(timer)
}

/**
 * Remove all cached health results.
 */
export function clearHealthCache(): void {
	for (const key of Object.keys(cache)) {
		delete cache[key]
	}
}
