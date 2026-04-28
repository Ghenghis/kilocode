/**
 * proof.task-graph-valid (Anchor 1, Agentic Software Engineering)
 *
 * Validates a YAML task-graph emitted by a Contract Kit. The validator runs
 * three independent checks and reports issues per check:
 *
 *   1. **Structural** — the document parses as YAML and conforms to the
 *      shape declared in `assets/contract-kit-anchors/agentic/task-graph.schema.json`
 *      (a small subset of JSON Schema 2020-12 — required fields + types —
 *      since we cannot pull in a full schema engine without adding a dep).
 *   2. **Reference integrity** — every id in any `dependsOn[]` array resolves
 *      to a sibling task id, and ids are unique.
 *   3. **DAG integrity** — depth-first cycle detection using the standard
 *      white/gray/black coloring (Cormen et al.).
 *   4. **Leaf coverage** — every "leaf" task (one nothing depends on) carries
 *      a non-empty `acceptanceCriteria` string. Non-leaf tasks are not
 *      penalised by this gate; the criteria field is still required by schema
 *      but the gate only escalates leaves to error severity.
 *
 * Input contract: the gate is invoked against a markdown doc whose body
 * contains exactly one fenced ` ```yaml ` block representing a task graph,
 * OR against the raw YAML when the doc-type is `task-graph`. Both shapes are
 * supported so the gate slots into the existing RubricCritic flow.
 */

import { parse as parseYaml } from "yaml"

import type { Gate, GateIssue } from "../../../RubricCritic"

interface RawTask {
	id?: unknown
	title?: unknown
	dependsOn?: unknown
	acceptanceCriteria?: unknown
	assigneeRole?: unknown
	estimatedHours?: unknown
}

interface RawGraph {
	tasks?: unknown
	edges?: unknown
}

const TASK_ID_RE = /^T-[A-Z0-9-]+$/

/**
 * Extract the task-graph YAML from either:
 *   - a markdown doc with a ```yaml fenced block, or
 *   - a raw YAML document (no fences).
 */
function extractYaml(doc: string): string | null {
	const fenceRe = /```ya?ml\s*\n([\s\S]*?)```/i
	const fenceMatch = fenceRe.exec(doc)
	if (fenceMatch) return fenceMatch[1]
	// No fence — treat the whole doc as YAML if it begins with a mapping.
	const trimmed = doc.trim()
	if (!trimmed) return null
	if (trimmed.startsWith("#") || trimmed.startsWith("tasks:") || trimmed.startsWith("version:")) {
		return doc
	}
	return null
}

function asArray(x: unknown): unknown[] | null {
	return Array.isArray(x) ? x : null
}

function asString(x: unknown): string | null {
	return typeof x === "string" && x.length > 0 ? x : null
}

/**
 * Cycle detection via DFS with white/gray/black coloring.
 * Returns the first cycle found as an array of task ids, or null.
 */
function findCycle(adj: Map<string, string[]>): string[] | null {
	const WHITE = 0
	const GRAY = 1
	const BLACK = 2
	const color = new Map<string, number>()
	for (const id of adj.keys()) color.set(id, WHITE)

	const parent = new Map<string, string | null>()

	function dfs(start: string): string[] | null {
		// Iterative DFS to avoid recursion-limit issues on large graphs.
		const stack: { id: string; iter: Iterator<string> }[] = []
		color.set(start, GRAY)
		parent.set(start, null)
		stack.push({ id: start, iter: (adj.get(start) ?? [])[Symbol.iterator]() })

		while (stack.length > 0) {
			const top = stack[stack.length - 1]
			const next = top.iter.next()
			if (next.done) {
				color.set(top.id, BLACK)
				stack.pop()
				continue
			}
			const child = next.value
			const childColor = color.get(child) ?? WHITE
			if (childColor === GRAY) {
				// Reconstruct cycle: from `child` back through parents to top.id, plus child.
				const cycle: string[] = [child]
				let cur: string | null = top.id
				while (cur && cur !== child) {
					cycle.push(cur)
					cur = parent.get(cur) ?? null
				}
				cycle.push(child)
				cycle.reverse()
				return cycle
			}
			if (childColor === WHITE) {
				color.set(child, GRAY)
				parent.set(child, top.id)
				stack.push({ id: child, iter: (adj.get(child) ?? [])[Symbol.iterator]() })
			}
		}
		return null
	}

	for (const id of adj.keys()) {
		if ((color.get(id) ?? WHITE) === WHITE) {
			const c = dfs(id)
			if (c) return c
		}
	}
	return null
}

export const taskGraphValid: Gate = {
	id: "proof.task-graph-valid",
	name: "Task graph is valid",
	description:
		"Anchor 1: ensures task-graph.yaml parses, has unique ids, no cycles, all dependsOn references resolve, and every leaf carries acceptance criteria.",
	category: "proof",
	severity: "error",
	docTypes: ["task-graph", "agent-spec", "*"],

	async validate(doc: string): Promise<GateIssue[] | null> {
		const issues: GateIssue[] = []

		const yamlSrc = extractYaml(doc)
		if (yamlSrc === null) {
			return [
				{
					severity: "error",
					message:
						"No YAML task-graph found. Embed the graph in a ```yaml fenced block or use docType 'task-graph'.",
				},
			]
		}

		let parsed: unknown
		try {
			parsed = parseYaml(yamlSrc)
		} catch (err) {
			return [
				{
					severity: "error",
					message: `task-graph YAML failed to parse: ${err instanceof Error ? err.message : String(err)}`,
				},
			]
		}

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return [
				{
					severity: "error",
					message: "task-graph root must be a YAML mapping with a 'tasks' array.",
				},
			]
		}

		const root = parsed as RawGraph
		const tasksRaw = asArray(root.tasks)
		if (!tasksRaw || tasksRaw.length === 0) {
			return [{ severity: "error", message: "task-graph 'tasks' array missing or empty." }]
		}

		// Pass 1 — shape + unique ids + collect adjacency.
		const tasks = new Map<string, RawTask>()
		const adj = new Map<string, string[]>()
		const declaredIds: string[] = []
		const seen = new Set<string>()

		tasksRaw.forEach((entry, idx) => {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
				issues.push({
					severity: "error",
					message: `tasks[${idx}] is not a mapping.`,
				})
				return
			}
			const t = entry as RawTask
			const id = asString(t.id)
			if (!id) {
				issues.push({ severity: "error", message: `tasks[${idx}] missing 'id'.` })
				return
			}
			if (!TASK_ID_RE.test(id)) {
				issues.push({
					severity: "error",
					message: `task '${id}' has malformed id (expected pattern T-XXX).`,
				})
			}
			if (seen.has(id)) {
				issues.push({ severity: "error", message: `Duplicate task id '${id}'.` })
				return
			}
			seen.add(id)
			declaredIds.push(id)

			if (!asString(t.title)) {
				issues.push({ severity: "error", message: `task '${id}' missing 'title'.` })
			}
			if (!asString(t.assigneeRole)) {
				issues.push({ severity: "error", message: `task '${id}' missing 'assigneeRole'.` })
			}

			const dependsOnRaw = t.dependsOn ?? []
			const dependsArr = asArray(dependsOnRaw)
			if (!dependsArr) {
				issues.push({
					severity: "error",
					message: `task '${id}' 'dependsOn' must be an array (got ${typeof dependsOnRaw}).`,
				})
			}
			const deps = (dependsArr ?? []).map((d) => (typeof d === "string" ? d : "")).filter((s) => s.length > 0)
			tasks.set(id, t)
			adj.set(id, deps)
		})

		// Early bail if structural errors prevent reasoning about edges.
		if (tasks.size === 0) {
			return issues.length > 0 ? issues : [{ severity: "error", message: "No usable tasks parsed." }]
		}

		// Pass 2 — reference integrity.
		for (const id of declaredIds) {
			const deps = adj.get(id) ?? []
			for (const dep of deps) {
				if (!tasks.has(dep)) {
					issues.push({
						severity: "error",
						message: `task '${id}' depends on unknown id '${dep}'.`,
					})
				}
			}
		}

		// Pass 3 — cycle detection.
		const cycle = findCycle(adj)
		if (cycle) {
			issues.push({
				severity: "error",
				message: `task graph has a cycle: ${cycle.join(" -> ")}`,
				suggestion: "Break the cycle by removing one dependsOn edge or splitting one task in two.",
			})
		}

		// Pass 4 — leaf coverage. A leaf is a task no one depends on.
		const incoming = new Set<string>()
		for (const deps of adj.values()) for (const d of deps) incoming.add(d)
		for (const id of declaredIds) {
			const isLeaf = !incoming.has(id)
			if (!isLeaf) continue
			const t = tasks.get(id)
			const ac = asString(t?.acceptanceCriteria)
			if (!ac) {
				issues.push({
					severity: "error",
					message: `leaf task '${id}' missing 'acceptanceCriteria'.`,
					suggestion: "Add a Given/When/Then or RFC 2119 acceptance-criteria string.",
				})
			}
		}

		return issues.length > 0 ? issues : null
	},
}

export default taskGraphValid
