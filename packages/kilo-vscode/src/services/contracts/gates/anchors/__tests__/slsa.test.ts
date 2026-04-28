/**
 * Tests for the Anchor 6 (SLSA Provenance) gate validators.
 *
 * Each gate gets a passing + failing fixture, plus a focused test for
 * the in-toto v1.0 schema parser.
 */
import { describe, expect, it } from "bun:test"

import slsaL3, { findGeneratorReference } from "../slsa/slsa-l3"
import signedArtifacts, { workflowSignsWithCosign } from "../slsa/signed-artifacts"
import inTotoAttestation, {
	validateInTotoAttestation,
	IN_TOTO_STATEMENT_V1,
	SLSA_PROVENANCE_V1,
} from "../slsa/in-toto-attestation"

const FAKE_SHA = "9b8d2a1c4f3e6d5a8b7c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a"

const VALID_PROVENANCE = JSON.stringify({
	_type: IN_TOTO_STATEMENT_V1,
	subject: [{ name: "kilo-code-7.2.21.vsix", digest: { sha256: FAKE_SHA } }],
	predicateType: SLSA_PROVENANCE_V1,
	predicate: {
		buildDefinition: { buildType: "https://example/buildtype" },
		runDetails: {
			builder: {
				id: "https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@refs/tags/v2.0.0",
			},
		},
	},
})

const RELEASE_VSIX_YAML = `
name: release-vsix
on:
  push:
    tags: ["v*"]
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    steps:
      - uses: sigstore/cosign-installer@4959ce089c2fe283b1654b3d70d8cd4a4e8f96e5
      - run: |
          COSIGN_EXPERIMENTAL=1 cosign sign-blob --yes dist/foo.vsix
  provenance:
    permissions: { id-token: write, contents: write, actions: read }
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@5a775b367a56d5bd118a224a811bba288150a563
    with:
      base64-subjects: \${{ needs.build.outputs.digest }}
`

describe("compliance.slsa-l3", () => {
	it("passes when a release workflow uses the canonical SLSA generator", async () => {
		const issues = await slsaL3.validate("", {
			workflows: { ".github/workflows/release-vsix.yml": RELEASE_VSIX_YAML },
		})
		expect(issues).toBeNull()
	})

	it("fails when no release workflow exists", async () => {
		const issues = await slsaL3.validate("", { workflows: {} })
		expect(issues).not.toBeNull()
		expect(issues![0].severity).toBe("error")
		expect(issues![0].message).toMatch(/No.*release.*\.yml/i)
	})

	it("fails when release workflow does not use a SLSA generator", async () => {
		const yaml = `
name: release
on: { push: { tags: ["v*"] } }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm publish
`
		const issues = await slsaL3.validate("", {
			workflows: { ".github/workflows/release.yml": yaml },
		})
		expect(issues).not.toBeNull()
		expect(issues![0].message).toMatch(/SLSA L3 generator/i)
	})

	it("findGeneratorReference recognises pinned SHA references", () => {
		const ref = findGeneratorReference(RELEASE_VSIX_YAML)
		expect(ref).toBe(
			"slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml",
		)
	})
})

describe("compliance.signed-artifacts", () => {
	it("passes when the workflow signs with cosign + OIDC", async () => {
		const issues = await signedArtifacts.validate("", {
			workflows: { ".github/workflows/release-vsix.yml": RELEASE_VSIX_YAML },
		})
		expect(issues).toBeNull()
	})

	it("passes when a cosign.pub key is committed", async () => {
		const issues = await signedArtifacts.validate("", {
			files: { "cosign.pub": "-----BEGIN PUBLIC KEY-----\nABCD\n-----END PUBLIC KEY-----\n" },
		})
		expect(issues).toBeNull()
	})

	it("fails when neither cosign.pub nor a signing workflow exists", async () => {
		const issues = await signedArtifacts.validate("", {
			files: { "README.md": "# hi" },
			workflows: { ".github/workflows/ci.yml": "name: ci\non: push\n" },
		})
		expect(issues).not.toBeNull()
		expect(issues![0].severity).toBe("error")
	})

	it("workflowSignsWithCosign requires installer + sign + OIDC marker", () => {
		expect(workflowSignsWithCosign(RELEASE_VSIX_YAML)).toBe(true)
		expect(workflowSignsWithCosign("uses: sigstore/cosign-installer@v3")).toBe(false)
	})
})

describe("compliance.in-toto-attestation", () => {
	it("passes for a valid SLSA v1.0 statement", async () => {
		const issues = await inTotoAttestation.validate("", {
			provenance: { path: "p.json", content: VALID_PROVENANCE },
		})
		expect(issues).toBeNull()
	})

	it("fails when _type is wrong", async () => {
		const bad = JSON.stringify({
			_type: "https://in-toto.io/Statement/v0.1",
			subject: [{ digest: { sha256: FAKE_SHA } }],
			predicateType: SLSA_PROVENANCE_V1,
			predicate: {},
		})
		const issues = await inTotoAttestation.validate("", {
			provenance: { path: "p.json", content: bad },
		})
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /_type/.test(i.message))).toBe(true)
	})

	it("fails when subject digest is not 64-char hex", async () => {
		const bad = JSON.stringify({
			_type: IN_TOTO_STATEMENT_V1,
			subject: [{ digest: { sha256: "not-a-real-digest" } }],
			predicateType: SLSA_PROVENANCE_V1,
			predicate: {},
		})
		const issues = await inTotoAttestation.validate("", {
			provenance: { path: "p.json", content: bad },
		})
		expect(issues).not.toBeNull()
		expect(issues!.some((i) => /sha256/.test(i.message))).toBe(true)
	})

	it("validateInTotoAttestation accepts JSONL input", () => {
		const jsonl = VALID_PROVENANCE + "\n"
		const result = validateInTotoAttestation(jsonl)
		expect(result.ok).toBe(true)
		expect(result.parsed?.predicateType).toBe(SLSA_PROVENANCE_V1)
	})

	it("validateInTotoAttestation rejects malformed JSON", () => {
		const result = validateInTotoAttestation("{not json")
		expect(result.ok).toBe(false)
		expect(result.errors[0]).toMatch(/not valid JSON/)
	})
})
