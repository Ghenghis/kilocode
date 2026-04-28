/**
 * Unit tests for the Anchor 1 (Agentic Software Engineering) gates.
 *   - proof.task-graph-valid: passing graph, cyclic graph, missing-dep graph.
 *   - proof.req-id-cited: unscoped imperative flagged, scoped imperative passes.
 */

import { describe, expect, it } from "bun:test"

import taskGraphValid from "../agentic/task-graph-valid"
import reqIdCited from "../agentic/req-id-cited"

const PASSING_GRAPH = `
\`\`\`yaml
tasks:
  - id: T-001
    title: Bootstrap repo
    dependsOn: []
    acceptanceCriteria: |
      Given a fresh checkout, When npm install runs, Then it exits 0.
    assigneeRole: devops
  - id: T-002
    title: Provision DB
    dependsOn: [T-001]
    acceptanceCriteria: |
      Postgres is reachable on the dev compose stack.
    assigneeRole: devops
  - id: T-003
    title: Write smoke tests
    dependsOn: [T-002]
    acceptanceCriteria: |
      Smoke suite exercises listing-create golden path (REQ-001).
    assigneeRole: qa
\`\`\`
`.trim()

const CYCLIC_GRAPH = `
\`\`\`yaml
tasks:
  - id: T-001
    title: A
    dependsOn: [T-003]
    acceptanceCriteria: ac
    assigneeRole: backend-eng
  - id: T-002
    title: B
    dependsOn: [T-001]
    acceptanceCriteria: ac
    assigneeRole: backend-eng
  - id: T-003
    title: C
    dependsOn: [T-002]
    acceptanceCriteria: ac
    assigneeRole: backend-eng
\`\`\`
`.trim()

const MISSING_DEP_GRAPH = `
\`\`\`yaml
tasks:
  - id: T-001
    title: A
    dependsOn: []
    acceptanceCriteria: ac
    assigneeRole: backend-eng
  - id: T-002
    title: B
    dependsOn: [T-999]
    acceptanceCriteria: ac
    assigneeRole: backend-eng
\`\`\`
`.trim()

describe("proof.task-graph-valid", () => {
	it("passes a clean DAG with all leaves carrying acceptance criteria", async () => {
		const issues = await taskGraphValid.validate(PASSING_GRAPH)
		expect(issues).toBeNull()
	})

	it("flags a cycle in the dependency graph", async () => {
		const issues = await taskGraphValid.validate(CYCLIC_GRAPH)
		expect(issues).not.toBeNull()
		const messages = (issues ?? []).map((i) => i.message).join("\n")
		expect(messages).toContain("cycle")
	})

	it("flags a dependsOn id that does not exist in the task list", async () => {
		const issues = await taskGraphValid.validate(MISSING_DEP_GRAPH)
		expect(issues).not.toBeNull()
		const messages = (issues ?? []).map((i) => i.message).join("\n")
		expect(messages).toMatch(/unknown id 'T-999'/)
	})
})

describe("proof.req-id-cited", () => {
	it("flags an imperative claim that does not reference a REQ/ADR/RISK id", async () => {
		const doc = "The system must rate-limit aggressively to protect upstream services."
		const issues = await reqIdCited.validate(doc)
		expect(issues).not.toBeNull()
		expect((issues ?? []).length).toBeGreaterThan(0)
		expect((issues ?? [])[0].severity).toBe("warn")
	})

	it("passes when the imperative claim cites a REQ id", async () => {
		const doc = "The system must rate-limit aggressively per REQ-014 to protect upstream services."
		const issues = await reqIdCited.validate(doc)
		expect(issues).toBeNull()
	})
})
