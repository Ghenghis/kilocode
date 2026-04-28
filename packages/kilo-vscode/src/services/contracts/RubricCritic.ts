/**
 * RubricCritic — pluggable Truth Gates + Proof Gates engine for the Contract
 * Studio. Implements the rubric described in `docs/CONTRACT_STUDIO_SPEC.md`
 * (rubric section + governance integration).
 *
 * Gates are plain objects with a single `validate(doc, refs?)` async hook.
 * Each gate may be marked applicable to a specific docType (e.g. "prd",
 * "rfc", "adr") or run unconditionally (`docTypes: "*"`). Failure is
 * communicated as an array of `GateIssue` records — each carrying line/range
 * info, severity and an optional auto-fix suggestion.
 *
 * The engine deliberately treats gates as black boxes — they may use regex,
 * external parsers (mermaid, JSON.parse, etc.), or even network HEAD checks.
 * The runner enforces a per-gate timeout so a slow gate cannot stall the
 * full rubric pass.
 *
 * Scoring: each applicable gate is worth 1 unit. The total is reduced by
 * weighted penalties: error -1, warn -0.4, info 0. Final score is clamped
 * to [0, 1].
 */

export type GateSeverity = "error" | "warn" | "info"
export type GateCategory = "truth" | "proof" | "compliance" | "style"

export interface GateIssue {
	line?: number
	column?: number
	severity: GateSeverity
	message: string
	suggestion?: string
	gateId?: string
}

export interface Gate {
	id: string
	name: string
	description: string
	category: GateCategory
	severity: GateSeverity
	/** "*" or a list of doc-type ids this gate applies to. */
	docTypes?: "*" | string[]
	/** Returns null if passed, or array of issues with line/range info if failed. */
	validate(doc: string, refs?: unknown): Promise<GateIssue[] | null>
	/** Optional auto-fix that returns a corrected doc. */
	autoFix?(doc: string, issue: GateIssue): Promise<string>
}

export interface RubricResult {
	score: number
	issues: GateIssue[]
	passedGates: string[]
	failedGates: string[]
}

const DEFAULT_GATE_TIMEOUT_MS = 8000

function appliesTo(gate: Gate, docType: string): boolean {
	if (!gate.docTypes || gate.docTypes === "*") return true
	return gate.docTypes.includes(docType)
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`Gate "${label}" timed out after ${ms}ms`)), ms)
	})
	try {
		return (await Promise.race([p, timeout])) as T
	} finally {
		if (timer) clearTimeout(timer)
	}
}

export class RubricCritic {
	private gates = new Map<string, Gate>()
	private timeoutMs = DEFAULT_GATE_TIMEOUT_MS

	register(gate: Gate): void {
		if (!gate.id) throw new Error("Gate missing id")
		this.gates.set(gate.id, gate)
	}

	unregister(id: string): boolean {
		return this.gates.delete(id)
	}

	list(): Gate[] {
		return Array.from(this.gates.values())
	}

	setGateTimeout(ms: number): void {
		this.timeoutMs = Math.max(500, Math.floor(ms))
	}

	/** Run all applicable gates for a doc-type, return scored result. */
	async run(doc: string, docType: string, refs?: unknown): Promise<RubricResult> {
		const issues: GateIssue[] = []
		const passedGates: string[] = []
		const failedGates: string[] = []
		const applicable = this.list().filter((g) => appliesTo(g, docType))

		await Promise.all(
			applicable.map(async (gate) => {
				try {
					const result = await withTimeout(gate.validate(doc, refs), this.timeoutMs, gate.id)
					if (result === null || result.length === 0) {
						passedGates.push(gate.id)
					} else {
						failedGates.push(gate.id)
						for (const iss of result) issues.push({ ...iss, gateId: gate.id })
					}
				} catch (err) {
					failedGates.push(gate.id)
					issues.push({
						severity: "warn",
						message: `Gate ${gate.id} threw: ${err instanceof Error ? err.message : String(err)}`,
						gateId: gate.id,
					})
				}
			}),
		)

		const total = applicable.length || 1
		let weighted = passedGates.length
		for (const iss of issues) {
			if (iss.severity === "error") weighted -= 1
			else if (iss.severity === "warn") weighted -= 0.4
		}
		const raw = weighted / total
		const score = Math.max(0, Math.min(1, raw))

		return { score, issues, passedGates, failedGates }
	}
}

/** Singleton instance used by the StudioController + gateRunner. */
export const rubricCritic = new RubricCritic()
