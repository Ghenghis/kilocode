/**
 * Unit tests for the Truth + Proof + Compliance + Style gates.
 *
 * Each gate gets at least one positive (passes) and one negative (fails)
 * scenario. We avoid mocking the network for the URL gate; instead we
 * stub `globalThis.fetch` per-test.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test"

import truthNoHallucinatedUrls from "../gates/truth-no-hallucinated-urls"
import truthMermaidSyntax from "../gates/truth-mermaid-syntax"
import truthJsonSchemaValid from "../gates/truth-json-schema-valid"
import truthCrossRefIntegrity from "../gates/truth-cross-ref-integrity"
import truthCitationIntegrity from "../gates/truth-citation-integrity"
import proofAcceptanceCriteria from "../gates/proof-acceptance-criteria"
import proofSuccessMetrics from "../gates/proof-success-metrics"
import proofNonFunctionalThresholds from "../gates/proof-non-functional-thresholds"
import proofRiskRegister from "../gates/proof-risk-register"
import proofRollbackPlan from "../gates/proof-rollback-plan"
import proofDataModelConstraints from "../gates/proof-data-model-constraints"
import complianceNoSecrets from "../gates/compliance-no-secrets"
import compliancePiiWarning from "../gates/compliance-pii-warning"
import complianceLicenseSpdx from "../gates/compliance-license-spdx"
import styleReadability from "../gates/style-readability"
import styleSectionBalance from "../gates/style-section-balance"

import { rubricCritic, RubricCritic } from "../RubricCritic"
import { runAll, BUILT_IN_GATES, ensureBuiltInGatesRegistered } from "../gateRunner"

describe("RubricCritic", () => {
	it("scores a clean doc near 1.0", async () => {
		const local = new RubricCritic()
		local.register({
			id: "always-pass",
			name: "always pass",
			description: "x",
			category: "truth",
			severity: "info",
			validate: async () => null,
		})
		const r = await local.run("hello", "*")
		expect(r.score).toBeGreaterThan(0.99)
		expect(r.failedGates.length).toBe(0)
	})
	it("penalises errors more than warns", async () => {
		const local = new RubricCritic()
		local.register({
			id: "err",
			name: "e",
			description: "x",
			category: "truth",
			severity: "error",
			validate: async () => [{ severity: "error", message: "boom" }],
		})
		const r = await local.run("d", "*")
		expect(r.score).toBeLessThan(0.5)
	})
})

describe("truth-no-hallucinated-urls", () => {
	const realFetch = globalThis.fetch
	afterEach(() => {
		globalThis.fetch = realFetch
	})
	it("passes when fetch reports OK for all URLs", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(globalThis as any).fetch = async () => ({ ok: true, status: 200 })
		const issues = await truthNoHallucinatedUrls.validate("See https://example.com/x")
		expect(issues).toBeNull()
	})
	it("warns when a URL is unreachable", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(globalThis as any).fetch = async () => ({ ok: false, status: 404 })
		const issues = await truthNoHallucinatedUrls.validate("Broken https://nope.invalid/x")
		expect(issues).not.toBeNull()
		expect(issues!.length).toBeGreaterThan(0)
		expect(issues![0].severity).toBe("warn")
	})
})

describe("truth-mermaid-syntax", () => {
	it("passes for a valid flowchart block", async () => {
		const md = "```mermaid\nflowchart TB\n  A --> B\n```\n"
		const issues = await truthMermaidSyntax.validate(md)
		expect(issues).toBeNull()
	})
	it("flags an unbalanced block", async () => {
		const md = "```mermaid\nflowchart TB\n  A[((unclosed --> B\n```\n"
		const issues = await truthMermaidSyntax.validate(md)
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /unbalanced/.test(i.message))).toBe(true)
	})
	it("flags an unknown diagram type", async () => {
		const md = "```mermaid\ngibberishDiagram\n```\n"
		const issues = await truthMermaidSyntax.validate(md)
		expect(issues).not.toBeNull()
	})
})

describe("truth-json-schema-valid", () => {
	it("passes for a valid JSON block", async () => {
		const md = "```json\n{\"a\":1}\n```\n"
		const issues = await truthJsonSchemaValid.validate(md)
		expect(issues).toBeNull()
	})
	it("flags broken JSON", async () => {
		const md = "```json\n{not-json}\n```\n"
		const issues = await truthJsonSchemaValid.validate(md)
		expect(issues).not.toBeNull()
		expect(issues![0].severity).toBe("error")
	})
})

describe("truth-cross-ref-integrity", () => {
	it("passes when anchors resolve", async () => {
		const md = "# Intro\n\nSee [doc](#intro).\n"
		const issues = await truthCrossRefIntegrity.validate(md)
		expect(issues).toBeNull()
	})
	it("flags an unresolved anchor", async () => {
		const md = "# Intro\n\nSee [foo](#not-here).\n"
		const issues = await truthCrossRefIntegrity.validate(md)
		expect(issues).not.toBeNull()
	})
})

describe("truth-citation-integrity", () => {
	it("passes when sidecar has all referenced ids", async () => {
		const md = "Text [^src-1].\n"
		const issues = await truthCitationIntegrity.validate(md, { refs: [{ id: "src-1", source: "x" }] })
		expect(issues).toBeNull()
	})
	it("flags a citation with no sidecar entry", async () => {
		const md = "Text [^src-9].\n"
		const issues = await truthCitationIntegrity.validate(md, { refs: [] })
		expect(issues).not.toBeNull()
	})
	it("accepts in-doc footnote definitions", async () => {
		const md = "Text [^a].\n\n[^a]: A definition.\n"
		const issues = await truthCitationIntegrity.validate(md)
		expect(issues).toBeNull()
	})
})

describe("proof-acceptance-criteria", () => {
	it("passes with Given/When/Then", async () => {
		const md = "Given a user is logged in, When they click foo, Then they see bar."
		const issues = await proofAcceptanceCriteria.validate(md)
		expect(issues).toBeNull()
	})
	it("passes with RFC 2119", async () => {
		const md = "The system MUST refuse expired tokens."
		const issues = await proofAcceptanceCriteria.validate(md)
		expect(issues).toBeNull()
	})
	it("fails for a vibes doc", async () => {
		const md = "We will probably ship this someday."
		const issues = await proofAcceptanceCriteria.validate(md)
		expect(issues).not.toBeNull()
	})
})

describe("proof-success-metrics", () => {
	it("passes with quantitative metric", async () => {
		const md = "# Doc\n\n## Success Metrics\n\n- Latency p95 < 200ms.\n"
		const issues = await proofSuccessMetrics.validate(md)
		expect(issues).toBeNull()
	})
	it("fails with no metrics section", async () => {
		const md = "# Doc\n\nText only.\n"
		const issues = await proofSuccessMetrics.validate(md)
		expect(issues).not.toBeNull()
	})
	it("fails with metrics section but no quantification", async () => {
		const md = "# Doc\n\n## KPIs\n\nWe want it to be good.\n"
		const issues = await proofSuccessMetrics.validate(md)
		expect(issues).not.toBeNull()
	})
})

describe("proof-non-functional-thresholds", () => {
	it("passes when ≥2 thresholds present", async () => {
		const md =
			"# Doc\n\n## Non-Functional Requirements\n\n- Latency p95 < 200ms.\n- Error rate below 0.1%.\n- Throughput > 1000 rps.\n"
		const issues = await proofNonFunctionalThresholds.validate(md)
		expect(issues).toBeNull()
	})
	it("warns when NFR section is too thin", async () => {
		const md = "# Doc\n\n## NFR\n\nMust be fast.\n"
		const issues = await proofNonFunctionalThresholds.validate(md)
		expect(issues).not.toBeNull()
	})
})

describe("proof-risk-register", () => {
	it("passes with ≥3 entries + mitigation", async () => {
		const md =
			"# Doc\n\n## Risks\n\n- A: rollback if X. Mitigation: feature-flag.\n- B: another mitigation step.\n- C: more mitigation.\n"
		const issues = await proofRiskRegister.validate(md)
		expect(issues).toBeNull()
	})
	it("warns when risks section absent", async () => {
		const md = "# Doc\n\nNo risks here.\n"
		const issues = await proofRiskRegister.validate(md)
		expect(issues).not.toBeNull()
	})
})

describe("proof-rollback-plan", () => {
	it("passes when deployment names rollback", async () => {
		const md = "# Doc\n\n## Deployment\n\nWe ship behind a feature-flag and can rollback in 1 click.\n"
		const issues = await proofRollbackPlan.validate(md)
		expect(issues).toBeNull()
	})
	it("warns when deployment lacks rollback", async () => {
		const md = "# Doc\n\n## Deployment\n\nWe deploy on Friday.\n"
		const issues = await proofRollbackPlan.validate(md)
		expect(issues).not.toBeNull()
	})
})

describe("proof-data-model-constraints", () => {
	it("passes when section names indexes/PK", async () => {
		const md = "# Doc\n\n## Data Model\n\nUsers table; primary key on id, unique index on email.\n"
		const issues = await proofDataModelConstraints.validate(md)
		expect(issues).toBeNull()
	})
	it("warns when section omits constraints", async () => {
		const md = "# Doc\n\n## Data Model\n\nWe will store users somewhere.\n"
		const issues = await proofDataModelConstraints.validate(md)
		expect(issues).not.toBeNull()
	})
	it("is silent when no Data Model section exists", async () => {
		const md = "# Just an intro\n"
		const issues = await proofDataModelConstraints.validate(md)
		expect(issues).toBeNull()
	})
})

describe("compliance-no-secrets", () => {
	it("passes for clean doc", async () => {
		const issues = await complianceNoSecrets.validate("hello world")
		expect(issues).toBeNull()
	})
	it("flags an AWS access key", async () => {
		const md = "Key: AKIAIOSFODNN7EXAMPLE in code"
		const issues = await complianceNoSecrets.validate(md)
		expect(issues).not.toBeNull()
		expect(issues![0].severity).toBe("error")
	})
	it("flags a private key block", async () => {
		const md = "-----BEGIN RSA PRIVATE KEY-----\nxxx\n-----END RSA PRIVATE KEY-----"
		const issues = await complianceNoSecrets.validate(md)
		expect(issues).not.toBeNull()
	})
})

describe("compliance-pii-warning", () => {
	it("passes when example.com email is used", async () => {
		const issues = await compliancePiiWarning.validate("Contact user@example.com")
		expect(issues).toBeNull()
	})
	it("warns on real-looking email without privacy section", async () => {
		const issues = await compliancePiiWarning.validate("Contact alice@acme.io")
		expect(issues).not.toBeNull()
	})
	it("passes when privacy section exists", async () => {
		const md = "Contact alice@acme.io\n\n## Privacy\n\nWe handle this carefully."
		const issues = await compliancePiiWarning.validate(md)
		expect(issues).toBeNull()
	})
})

describe("compliance-license-spdx", () => {
	it("passes for valid SPDX id", async () => {
		const md = "Open source license: MIT.\nSPDX-License-Identifier: MIT"
		const issues = await complianceLicenseSpdx.validate(md)
		expect(issues).toBeNull()
	})
	it("warns for unknown SPDX id", async () => {
		const md = "Our open-source license: SPDX-License-Identifier: Bogus-Foo-1.0"
		const issues = await complianceLicenseSpdx.validate(md)
		expect(issues).not.toBeNull()
	})
	it("is silent without license keywords", async () => {
		const issues = await complianceLicenseSpdx.validate("nothing license-y here")
		expect(issues).toBeNull()
	})
})

describe("style-readability", () => {
	it("is silent for a short doc", async () => {
		const issues = await styleReadability.validate("Hi.")
		expect(issues).toBeNull()
	})
	it("scores a typical paragraph above 30 (no warning)", async () => {
		const md = "The cat sat on the mat. The dog ran fast. We had fun. ".repeat(20)
		const issues = await styleReadability.validate(md)
		expect(issues).toBeNull()
	})
})

describe("style-section-balance", () => {
	it("passes for balanced sections", async () => {
		const md = "# A\n" + "x ".repeat(50) + "\n# B\n" + "y ".repeat(50) + "\n"
		const issues = await styleSectionBalance.validate(md)
		expect(issues).toBeNull()
	})
	it("flags a wildly imbalanced section", async () => {
		const md = "# A\n" + "x ".repeat(80) + "\n# B\n" + "y ".repeat(2000) + "\n"
		const issues = await styleSectionBalance.validate(md)
		expect(issues).not.toBeNull()
	})
})

describe("gateRunner.runAll", () => {
	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(globalThis as any).fetch = async () => ({ ok: true, status: 200 })
	})
	it("registers all 16 built-in gates", () => {
		ensureBuiltInGatesRegistered()
		expect(BUILT_IN_GATES.length).toBe(16)
		expect(rubricCritic.list().length).toBeGreaterThanOrEqual(16)
	})
	it("returns a structured result for any markdown input", async () => {
		const md = "# Title\n\nThe system MUST work.\n\n## Success Metrics\n\np95 < 200ms.\n"
		const result = await runAll(md, "*")
		expect(typeof result.score).toBe("number")
		expect(Array.isArray(result.issues)).toBe(true)
		expect(Array.isArray(result.passedGates)).toBe(true)
		expect(Array.isArray(result.failedGates)).toBe(true)
	})
})
