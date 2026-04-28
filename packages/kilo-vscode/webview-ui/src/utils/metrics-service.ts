/**
 * metrics-service.ts
 * Client-side per-provider metrics accumulator.
 *
 * Stores individual request records in sessionStorage, then derives
 * percentile latencies, success rates, and rolling request rates on demand.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RequestRecord {
	provider: string
	inputTokens: number
	outputTokens: number
	latencyMs: number
	costUsd: number
	timestamp: number
	success: boolean
}

export interface ProviderMetrics {
	provider: string
	requestCount: number
	successRate: number // 0-1
	p50LatencyMs: number
	p95LatencyMs: number
	p99LatencyMs: number
	avgCostUsd: number
	totalCostUsd: number
	requestsPerMin: number
}

// ── Internal state ────────────────────────────────────────────────────────────

const STORAGE_KEY = "kilocode_metrics"
const MAX_RECORDS = 1000
const RECENT_WINDOW_MS = 60_000

let records: RequestRecord[] = []

// Auto-load on module init
;(function init() {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (raw) {
			const parsed = JSON.parse(raw)
			if (Array.isArray(parsed)) {
				records = parsed as RequestRecord[]
			}
		}
	} catch {
		/* parse / quota error — start fresh */
	}
})()

// ── Persistence ───────────────────────────────────────────────────────────────

function persist(): void {
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records))
	} catch {
		/* storage quota exceeded — silently skip */
	}
}

// ── Percentile helper ─────────────────────────────────────────────────────────

/**
 * Compute the p-th percentile from a pre-sorted ascending array.
 * Returns 0 for an empty array.
 */
function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0
	const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
	return sorted[idx]
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a single completed request.
 *
 * @param provider     Provider id, e.g. "openai"
 * @param inputTokens  Input token count for the request
 * @param outputTokens Output token count for the request
 * @param latencyMs    End-to-end latency in milliseconds
 * @param success      Whether the request succeeded (default: true)
 */
export function recordRequest(
	provider: string,
	inputTokens: number,
	outputTokens: number,
	latencyMs: number,
	success = true
): void {
	const record: RequestRecord = {
		provider,
		inputTokens,
		outputTokens,
		latencyMs,
		costUsd: 0, // callers may enrich via getRecentRequests if needed
		timestamp: Date.now(),
		success,
	}

	records.push(record)

	// Cap total record count — drop oldest quarter when limit is hit
	if (records.length > MAX_RECORDS) {
		records = records.slice(Math.floor(MAX_RECORDS / 4))
	}

	persist()
}

/**
 * Compute and return metrics for all providers that have at least one record.
 */
export function getMetrics(): ProviderMetrics[] {
	const now = Date.now()
	const byProvider: Record<string, RequestRecord[]> = {}

	for (const r of records) {
		if (!byProvider[r.provider]) byProvider[r.provider] = []
		byProvider[r.provider].push(r)
	}

	return Object.entries(byProvider).map(([provider, recs]) => {
		const successCount = recs.filter((r) => r.success).length
		const sortedLatency = [...recs.map((r) => r.latencyMs)].sort((a, b) => a - b)
		const totalCost = recs.reduce((sum, r) => sum + r.costUsd, 0)
		const cutoff = now - RECENT_WINDOW_MS
		const recentCount = recs.filter((r) => r.timestamp >= cutoff).length

		return {
			provider,
			requestCount: recs.length,
			successRate: recs.length > 0 ? successCount / recs.length : 0,
			p50LatencyMs: percentile(sortedLatency, 50),
			p95LatencyMs: percentile(sortedLatency, 95),
			p99LatencyMs: percentile(sortedLatency, 99),
			avgCostUsd: recs.length > 0 ? totalCost / recs.length : 0,
			totalCostUsd: totalCost,
			requestsPerMin: recentCount,
		}
	})
}

/**
 * Returns metrics for a single provider, or null if no records exist for it.
 */
export function getMetricsForProvider(provider: string): ProviderMetrics | null {
	const all = getMetrics()
	return all.find((m) => m.provider === provider) ?? null
}

/**
 * Wipe all accumulated metrics for the current session.
 */
export function clearMetrics(): void {
	records = []
	try {
		sessionStorage.removeItem(STORAGE_KEY)
	} catch {
		/* ignore */
	}
}

/**
 * Return the most recent request records, newest first.
 *
 * @param limit Maximum number of records to return (default: all)
 */
export function getRecentRequests(limit?: number): RequestRecord[] {
	const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp)
	return limit !== undefined ? sorted.slice(0, limit) : sorted
}
