/**
 * Unit tests for Anchor 4 (OWASP LLM Top 10) gates.
 *
 * Coverage:
 *   - owaspLlmCoverage skips non-AI contracts
 *   - owaspLlmCoverage passes a fully-filled register
 *   - owaspLlmCoverage fails on missing sections / leftover ai-fill placeholders
 *   - promptInjectionTest warns when LLM01 has no test ids
 *   - noSecretsInOutput detects each credential family
 *   - noSecretsInOutput tolerates obviously-illustrative long base64 lines
 */

import { describe, expect, it } from "bun:test"

import owaspLlmCoverage from "../owasp/owasp-llm-coverage"
import promptInjectionTest from "../owasp/prompt-injection-test"
import noSecretsInOutput from "../owasp/no-secrets-in-output"

const SECTION_NUMBERS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"] as const

function fullyFilledRegister(): string {
	const sections = SECTION_NUMBERS.map((n) => {
		return [
			`## LLM${n}: Category ${n}`,
			"",
			"**Threat Scenarios for THIS project:**",
			"- We accept user input via /chat.",
			"",
			"**Likelihood:** medium",
			"",
			"**Impact:** high",
			"",
			"**Mitigations Implemented:**",
			"- Input validation on all user prompts.",
			"",
			"**Mitigations Pending:**",
			"- None.",
			"",
			"**Test Cases Required:** PI-001",
			"",
			"**Owner:** @security-team",
			"",
			"**Residual Risk:** mitigated",
			"",
		].join("\n")
	}).join("\n")
	return [
		"---",
		"templateId: owasp-llm-top10",
		"aiSystem: true",
		"---",
		"",
		"# Risk Register",
		"",
		sections,
		"",
		"See verification/cases/prompt-injection.test.ts",
		"",
	].join("\n")
}

describe("safety.owasp-llm-coverage", () => {
	it("skips non-AI contracts (returns null)", async () => {
		const doc = "---\ntitle: x\n---\n\n# Hello\n"
		const issues = await owaspLlmCoverage.validate(doc)
		expect(issues).toBeNull()
	})

	it("passes a fully-filled register on an aiSystem contract", async () => {
		const doc = fullyFilledRegister()
		const issues = await owaspLlmCoverage.validate(doc)
		expect(issues).toBeNull()
	})

	it("fails when sections are missing", async () => {
		const doc = [
			"---",
			"aiSystem: true",
			"---",
			"",
			"## LLM01: Prompt Injection",
			"**Likelihood:** low",
			"",
		].join("\n")
		const issues = await owaspLlmCoverage.validate(doc)
		expect(issues).not.toBeNull()
		// 9 missing sections (LLM02..LLM10)
		const missing = issues!.filter((i) => /missing section/.test(i.message))
		expect(missing.length).toBe(9)
	})

	it("fails when ai-fill placeholders remain unresolved", async () => {
		const sections = SECTION_NUMBERS.map((n) =>
			[
				`## LLM${n}: Category ${n}`,
				"",
				"**Likelihood:** <!-- ai-fill: low|medium|high -->",
				"**Impact:** medium",
				"",
			].join("\n"),
		).join("\n")
		const doc = ["---", "aiSystem: true", "---", "", sections].join("\n")
		const issues = await owaspLlmCoverage.validate(doc)
		expect(issues).not.toBeNull()
		const placeholderHits = issues!.filter((i) => /unresolved/.test(i.message))
		expect(placeholderHits.length).toBe(10)
	})
})

describe("safety.prompt-injection-test", () => {
	it("skips non-AI contracts", async () => {
		const issues = await promptInjectionTest.validate("# nothing\n")
		expect(issues).toBeNull()
	})

	it("warns when LLM01 lists no test ids and no verification path is referenced", async () => {
		const doc = [
			"---",
			"aiSystem: true",
			"---",
			"",
			"## LLM01: Prompt Injection",
			"",
			"**Test Cases Required:** TBD",
			"",
		].join("\n")
		const issues = await promptInjectionTest.validate(doc)
		expect(issues).not.toBeNull()
		expect(issues!.length).toBeGreaterThan(0)
		expect(issues![0].severity).toBe("warn")
	})

	it("passes when LLM01 lists a PI-### id", async () => {
		const doc = [
			"---",
			"aiSystem: true",
			"---",
			"",
			"## LLM01: Prompt Injection",
			"",
			"**Test Cases Required:** PI-001, PI-002",
			"",
		].join("\n")
		const issues = await promptInjectionTest.validate(doc)
		expect(issues).toBeNull()
	})

	it("passes when a verification/cases/prompt-injection path is referenced", async () => {
		const doc = [
			"---",
			"aiSystem: true",
			"---",
			"",
			"## LLM01: Prompt Injection",
			"",
			"**Test Cases Required:** see verification/cases/prompt-injection.test.ts",
			"",
		].join("\n")
		const issues = await promptInjectionTest.validate(doc)
		expect(issues).toBeNull()
	})
})

describe("safety.no-secrets-in-output", () => {
	it("detects an AWS access key", async () => {
		const doc = "Use this: AKIAIOSFODNN7EXAMPLE in the config."
		const issues = await noSecretsInOutput.validate(doc)
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /AWS access key/.test(i.message))).toBe(true)
	})

	it("detects an OpenAI key", async () => {
		const doc = "key=sk-proj-abcdefghijklmnopqrstuvwx"
		const issues = await noSecretsInOutput.validate(doc)
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /OpenAI/.test(i.message))).toBe(true)
	})

	it("detects an Anthropic key", async () => {
		const doc = "ANTHROPIC=sk-ant-api03-abcdefghijklmnopqrstuvwxyz"
		const issues = await noSecretsInOutput.validate(doc)
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /Anthropic/.test(i.message))).toBe(true)
	})

	it("detects a GitHub PAT", async () => {
		const doc = "token: ghp_abcdefghijklmnopqrstuvwxyz0123456789AB"
		const issues = await noSecretsInOutput.validate(doc)
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /GitHub PAT/.test(i.message))).toBe(true)
	})

	it("detects a JWT", async () => {
		const doc = "auth: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
		const issues = await noSecretsInOutput.validate(doc)
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /JWT/.test(i.message))).toBe(true)
	})

	it("detects a long base64 string when not marked as illustrative", async () => {
		const blob = "QmFzZTY0RGF0YUJsb2JUaGF0SXNQcm9iYWJseUFTZWNyZXRWYWx1ZUluUmVhbGl0eQ"
		const doc = `secret value: ${blob}`
		const issues = await noSecretsInOutput.validate(doc)
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /base64/.test(i.message))).toBe(true)
	})

	it("tolerates a long base64 string on a line marked REDACTED", async () => {
		const blob = "QmFzZTY0RGF0YUJsb2JUaGF0SXNQcm9iYWJseUFTZWNyZXRWYWx1ZUluUmVhbGl0eQ"
		const doc = `REDACTED example: ${blob}`
		const issues = await noSecretsInOutput.validate(doc)
		expect(issues).toBeNull()
	})

	it("returns null on a clean doc", async () => {
		const issues = await noSecretsInOutput.validate("# Just a normal contract\n\nNothing to see.")
		expect(issues).toBeNull()
	})
})
