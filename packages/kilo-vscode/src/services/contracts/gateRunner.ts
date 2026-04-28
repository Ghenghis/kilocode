/**
 * gateRunner — auto-registers every built-in gate with the singleton
 * RubricCritic and exposes a `runAll(doc, docType, refs?)` convenience
 * helper for callers that don't want to interact with the critic directly
 * (StudioController + tests).
 *
 * Adding a new gate is a one-liner: import its default export below and
 * append it to BUILT_IN_GATES.
 */

import { rubricCritic, type Gate, type RubricResult } from "./RubricCritic"

import truthNoHallucinatedUrls from "./gates/truth-no-hallucinated-urls"
import truthMermaidSyntax from "./gates/truth-mermaid-syntax"
import truthJsonSchemaValid from "./gates/truth-json-schema-valid"
import truthCrossRefIntegrity from "./gates/truth-cross-ref-integrity"
import truthCitationIntegrity from "./gates/truth-citation-integrity"
import proofAcceptanceCriteria from "./gates/proof-acceptance-criteria"
import proofSuccessMetrics from "./gates/proof-success-metrics"
import proofNonFunctionalThresholds from "./gates/proof-non-functional-thresholds"
import proofRiskRegister from "./gates/proof-risk-register"
import proofRollbackPlan from "./gates/proof-rollback-plan"
import proofDataModelConstraints from "./gates/proof-data-model-constraints"
import complianceNoSecrets from "./gates/compliance-no-secrets"
import compliancePiiWarning from "./gates/compliance-pii-warning"
import complianceLicenseSpdx from "./gates/compliance-license-spdx"
import styleReadability from "./gates/style-readability"
import styleSectionBalance from "./gates/style-section-balance"

export const BUILT_IN_GATES: Gate[] = [
	// Truth
	truthNoHallucinatedUrls,
	truthMermaidSyntax,
	truthJsonSchemaValid,
	truthCrossRefIntegrity,
	truthCitationIntegrity,
	// Proof
	proofAcceptanceCriteria,
	proofSuccessMetrics,
	proofNonFunctionalThresholds,
	proofRiskRegister,
	proofRollbackPlan,
	proofDataModelConstraints,
	// Compliance
	complianceNoSecrets,
	compliancePiiWarning,
	complianceLicenseSpdx,
	// Style
	styleReadability,
	styleSectionBalance,
]

let registered = false

/**
 * Idempotently register every built-in gate with the global RubricCritic.
 * Safe to call multiple times — only the first call has effect.
 */
export function ensureBuiltInGatesRegistered(): void {
	if (registered) return
	for (const gate of BUILT_IN_GATES) {
		rubricCritic.register(gate)
	}
	registered = true
}

/**
 * Run every applicable gate over the doc. Caller-friendly wrapper that
 * lazily registers gates on first call.
 */
export async function runAll(doc: string, docType: string, refs?: unknown): Promise<RubricResult> {
	ensureBuiltInGatesRegistered()
	return rubricCritic.run(doc, docType, refs)
}

export { rubricCritic }
