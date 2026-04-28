# Contract Kit Creator — The 7 Anchors

> Addendum to `CONTRACT_STUDIO_SPEC.md`. This is the **non-coder-friendly Contract Kit Creator** vision, not a generic chatbot. Every gate, every feature, every UX decision must trace back to one of these 7 anchors.

---

## Why anchors instead of features

A "PRD generator" is a feature. A **Contract Kit Creator** is a regulated artifact-producer: the user describes what they want; the kit emits a bundle of:

1. Plain-English contract documents (PRD, ADR, Privacy Doc, Model Card)
2. Verifiable specifications (OpenAPI, JSON Schema, acceptance criteria)
3. Reproducible test evidence (Playwright/Cypress traces, SWE-bench-style runs)
4. Security/compliance attestations (SLSA provenance, OpenSSF Scorecard, NIST SSDF practices)
5. Risk register (OWASP LLM Top 10 mapped to system surface)
6. CI workflows that prove the above on every change

A non-coder owns the bundle. A coder (or KiloCode's main agent) implements it. The bundle is the contract — what was promised, what was delivered, what's measurable, what's audit-trail-able.

The 7 anchors are the **non-negotiable backbone**. Without all 7, this is just another chatbot.

---

## Anchor 1 — Agentic Software Engineering (the meta-frame)

**What it is:** State-of-the-art patterns for AI agents that ship software — Devin, Cursor Composer, Cognition's Slack clone, Copilot Workspace, Claude Code, OpenAI Codex CLI, GitHub Spark.

**Why it anchors us:** the kit isn't read once and discarded — it's the persistent contract that ANY agentic system can pick up and ship from. Output format must be agent-friendly (structured, machine-validatable, regenerable on change).

**What ships in the kit:**
- `agent-spec.yaml` — the contract in machine-readable form (intent, capabilities, NFRs, decisions, risks)
- `task-graph.yaml` — DAG of buildable units that ANY agent can claim
- Reverse-mappable identifiers (`REQ-001`, `ADR-0007`, `RISK-003`) so agents can cite what they're addressing
- A `.kilo/contracts/CLAUDE.md` (or similar) that primes the next agent session

**Reference patterns to ship:**
- ReAct loop (reason→act→observe)
- Plan-Critique-Compose (PCC) — already in main spec
- Supervisor-Worker for multi-task fan-out
- Reflexion for self-revision
- Constitutional AI for guardrails

**Gate mapping:** every contract must have a `task-graph` that any compliant agent can execute. Validates structurally (DAG has no cycles, every leaf has acceptance criteria, every story has a Given/When/Then).

**Reference URLs:**
- https://www.princeton-nlp.github.io/SWE-agent/ (SWE-agent paper + agent design)
- https://github.com/githubnext/copilot-workspace (Copilot Workspace's plan/spec/edit triad)
- https://docs.anthropic.com/en/docs/agents-and-tools/computer-use (computer-use as agent surface)
- https://github.com/anthropics/anthropic-cookbook (agent recipes)

---

## Anchor 2 — SWE-bench-style Verification

**What it is:** Princeton's SWE-bench is the canonical benchmark for "did the agent fix the bug?" — it runs the project's actual tests against the agent's patch. SWE-bench Verified (Anthropic + Princeton) is the QA-cleaned version. SWE-Lancer extends to freelance-style multi-task work. Devin's eval suite uses similar mechanics.

**Why it anchors us:** "the AI wrote a PRD" is unfalsifiable. "the AI's PRD produced a scaffold whose tests pass" is falsifiable. We use the SWE-bench *methodology* (not the dataset) — every kit ships with a verification harness that re-runs against current artifacts.

**What ships in the kit:**
- `verification/` directory with executable test cases per acceptance criterion
- A test-case format: `{ id, given, when, then, run: () => Promise<bool>, evidence: TraceArtifact }`
- A runner that executes all tests, records pass/fail + timing, emits a JUnit XML + JSON report
- Re-runnable in CI, locally, in KiloCode's main agent — same harness, same result format

**Gate mapping:**
- **proof.swe-bench-coverage** — every user story has at least one executable test case
- **proof.swe-bench-pass-rate** — at green-checkmark time, ≥ 95% of tests pass (configurable)
- **proof.swe-bench-evidence** — failed tests must have a trace artifact (anchor 3)

**Implementation hint:** runner can use `vitest`/`playwright` for JS, `pytest` for Python; framework auto-detected from scaffold. Each test result records the artifact path for trace evidence.

**Reference URLs:**
- https://www.swebench.com/ (canonical site + paper)
- https://www.swebench.com/SWE-bench/SWE-bench-Verified/ (verified subset, Anthropic-curated)
- https://github.com/princeton-nlp/SWE-bench (codebase, evaluation harness)
- https://arxiv.org/abs/2310.06770 (SWE-bench paper, ICLR 2024)
- https://www.cognition.ai/blog/swe-bench-technical-report (Devin's eval methodology)

---

## Anchor 3 — Playwright/Cypress Trace Evidence

**What it is:** Playwright's `tracing.start({ screenshots: true, snapshots: true, sources: true })` produces a deterministic `.zip` you can open in Trace Viewer, scrubbing every action, network call, console message, DOM snapshot. Cypress produces video + screenshots + Test Replay. This is **forensic-grade** test evidence — auditable, replayable, shareable.

**Why it anchors us:** non-coders need *visual proof* a feature works. A "test passed" badge means nothing to them. A 30-second video of the user flow, with timestamped network calls and DOM state, is unambiguous.

**What ships in the kit:**
- `verification/e2e/` directory of Playwright/Cypress specs, one per user story
- Every CI run uploads `trace.zip` + screenshots + video as artifacts
- `verification/INDEX.md` lists every test case with a link to its latest trace
- Trace viewer embedded in the kit's README via GitHub Actions artifact links
- "Sign-off" UX: gate is green only when the user has *watched* the trace (not just seen the badge)

**Gate mapping:**
- **proof.e2e-coverage** — every user-facing flow has an E2E spec
- **proof.e2e-evidence** — every CI run uploads traces (configurable retention; default 30 days)
- **proof.visual-regression** — Playwright's `expect(page).toHaveScreenshot()` baseline-locked
- **proof.user-acceptance** — for non-coder sign-off: each acceptance criterion shows the trace + a 1-click "Approve" / "Reject" button writing to the audit log

**Implementation hint:** scaffold pipeline emits a `playwright.config.ts` with tracing always on for failing tests, on-first-retry for flaky tests; Cypress config with `videoUploadOnPasses: false` for cost. CI workflow (`.github/workflows/e2e.yml`) uploads artifacts.

**Reference URLs:**
- https://playwright.dev/docs/trace-viewer (canonical trace viewer docs)
- https://playwright.dev/docs/api/class-tracing (tracing API)
- https://docs.cypress.io/guides/cloud/test-replay (Cypress test replay)
- https://playwright.dev/docs/test-snapshots (visual regression)

---

## Anchor 4 — OWASP LLM Top 10

**What it is:** The OWASP Foundation's Top 10 risks for LLM applications (LLM01–LLM10, 2023 + 2025 versions — **pinned to OWASP LLM Top 10 2025**, published Nov 2024 for the 2025 cycle). Categories: prompt injection, sensitive info disclosure, supply chain, data + model poisoning, improper output handling, excessive agency, system prompt leak, vector + embedding weaknesses, misinformation, unbounded consumption. Companion documents: **OWASP GenAI Red Teaming Guide** (2025) and **OWASP AI Security Solutions Landscape** (2024-2025) — both maintained under the OWASP GenAI Security Project.

**Why it anchors us:** Contract Kit Creator IS an LLM application that ingests user prompts and emits artifacts. Every kit it produces for an AI-system project ALSO surfaces these risks. Both must be addressed.

**What ships in the kit (for AI-system projects):**
- A pre-filled `risk-register/owasp-llm.md` mapping the project's surface to each LLM01–LLM10
- For each risk: likelihood, impact, current mitigations, residual risk, owner
- Test cases for at least 3 risks (prompt injection regression, system prompt leak detection, output schema enforcement)
- Threat model section in the design doc with explicit LLM Top 10 callouts

**What we ship internally (for the kit creator itself):**
- LLM01 Prompt Injection: input sanitization on user-pasted content, never let user prompt rewrite system prompt
- LLM02 Sensitive Info Disclosure: redaction layer on telemetry/logs (already in `kilo-telemetry` per multi-provider research)
- LLM03 Supply Chain: SLSA attestations on kit artifacts (anchor 6)
- LLM04 Data Poisoning: domain pack + template registry signed + version-locked
- LLM06 Sensitive Info Disclosure (output): never echo API keys, never include user secrets in generated docs
- LLM08 Excessive Agency: human-in-the-loop on scaffold emission, GovernanceService approval on high-risk doc types
- LLM09 Misinformation: every claim cited (anchor + research integration); rubric flag on uncited specifics
- LLM10 Unbounded Consumption: token budget per generation, rate-limit guard, cost telemetry

**Gate mapping:**
- **safety.owasp-llm-coverage** — for any project flagged as "uses LLMs", risk register covers all 10
- **safety.prompt-injection-test** — kit ships with at least one prompt-injection regression test for the project
- **safety.no-secrets-in-output** — generated docs scanned for AWS/OpenAI/Anthropic key patterns + custom org patterns

**Reference URLs:**
- https://genai.owasp.org/llm-top-10/ (canonical LLM Top 10 site)
- https://owasp.org/www-project-top-10-for-large-language-model-applications/ (OWASP project page)
- https://github.com/OWASP/www-project-top-10-for-large-language-model-applications (source repo with 2025 updates)

---

## Anchor 5 — NIST SSDF (SP 800-218 + SP 800-218A)

**What it is:** Secure Software Development Framework. Two-part NIST guidance:
- **NIST SP 800-218 v1.1** (Feb 2022) — the base SSDF for all software. Defines four practice groups: PO (Prepare the Organization), PS (Protect the Software), PW (Produce Well-Secured Software), RV (Respond to Vulnerabilities). Each has sub-tasks with reference standards (NIST 800-53, ISO 27001, OWASP SAMM).
- **NIST SP 800-218A** (2024) — the **Generative AI / Foundation Models extension to SSDF**. The actual practice list a GenAI project should attest against; mandatory for any AI-shipping kit.

**Why it anchors us:** US federal procurement (EO 14028) requires SSDF attestation for software shipped to government buyers. Even non-federal users benefit from SSDF as the gold-standard secure-development baseline. Contract Kit Creator generates SSDF-compliant project scaffolds out of the box.

**What ships in the kit:**
- `compliance/ssdf-attestation.md` — pre-filled NIST SSDF v1.1 attestation template, with each practice marked: "implemented" / "compensating control" / "not applicable" / "TBD"
- For "TBD" items: AI suggests implementation steps based on the project's tech stack
- CI workflow that re-validates attestation on every release
- The CISA Secure Software Development Self-Attestation Form template (the literal PDF the US government accepts) — pre-filled

**Specific SSDF practices we automate:**
- **PO.1** define security requirements → derived from PRD's NFR section
- **PS.1** protect all forms of code → SLSA Build L3 attestation (anchor 6)
- **PS.2** provide a mechanism for verifying integrity → cosign-signed artifacts
- **PW.4** reuse existing well-secured software → scaffold uses pinned, audited dependencies
- **PW.6** configure compilation/build/installation processes to improve security → CI uses pinned action SHAs, runs in hardened runner
- **PW.7** review/analyze human-readable code → CodeQL scan, semgrep scan, license scan in CI
- **PW.8** test the executable for vulnerabilities → OWASP ZAP / Burp scan stub
- **RV.1** identify/confirm vulnerabilities on ongoing basis → Dependabot + Renovate config
- **RV.2** assess/prioritize remediation → SLA in `SECURITY.md`
- **RV.3** analyze vulnerabilities to identify root causes → postmortem template (already in our 28 templates)

**Gate mapping:**
- **compliance.ssdf-coverage** — minimum 80% of SSDF practices have an answer ("implemented" or "N/A with reason")
- **compliance.ssdf-attestation-fresh** — attestation regenerated within last 90 days

**Reference URLs:**
- https://csrc.nist.gov/publications/detail/sp/800-218/final (canonical NIST SP 800-218 v1.1)
- https://csrc.nist.gov/pubs/sp/800/218/a/final (NIST SP 800-218A — Generative AI SSDF, 2024)
- https://www.cisa.gov/secure-software-attestation-form (CISA self-attestation form, finalized March 2024)
- https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf (PDF)
- https://www.whitehouse.gov/briefing-room/presidential-actions/2021/05/12/executive-order-on-improving-the-nations-cybersecurity/ (EO 14028 context)

---

## Anchor 6 — SLSA Provenance

**What it is:** Supply-chain Levels for Software Artifacts (SLSA, "salsa"). Under **SLSA v1.0** (April 2024) the framework split into two tracks: **Build** track (Build L1 / L2 / L3) and **Source** track. Provenance = signed attestation describing how an artifact was built (source, builder, dependencies, parameters), expressed in in-toto format. **SLSA Build L3** = hardened build platform with non-falsifiable provenance. (Pre-v1.0 docs that say "SLSA L3" without a track qualifier are ambiguous; pin to `Build L3` explicitly.)

**Why it anchors us:** "I built this" → "Here's a signed attestation that says this artifact was built from this commit by this builder using these dependencies, and the signature is verifiable against a public transparency log." That's the difference between trust and verifiable trust. Critical for any kit shipping to enterprise or government.

**What ships in the kit:**
- `.github/workflows/release.yml` that uses `slsa-framework/slsa-github-generator` to produce a SLSA Build L3 provenance for every release artifact
- `cosign` configured for keyless signing via OIDC (Sigstore)
- Provenance verification step in CI (consumers can check)
- A `verify.sh` script the user can run locally that verifies any release artifact
- The kit's OWN release pipeline (i.e. the .vsix we ship) gets SLSA Build L3 — eat our own dogfood

**SLSA Build track (v1.0):**
- Build L1: documented build process
- Build L2: provenance + tamper-resistant build service (GitHub Actions checks this)
- Build L3: hardened build platform, non-falsifiable provenance — **our target**
- Build L4 / hermetic builds: stretch goal — Nix flakes / Bazel hermetic make this tractable; see "Bonus moonshots" in `CONTRACT_KIT_SOTA_2026.md`.

**SLSA Source track:** separate axis under v1.0; pin if/when source-level provenance is required by downstream consumers. Track v1.1 (RC floated late 2025) for any updates.

**Gate mapping:**
- **compliance.slsa-build-l3** — release workflow attaches a verifiable SLSA **Build L3** provenance
- **compliance.signed-artifacts** — every release artifact has a cosign signature
- **compliance.in-toto-attestation** — provenance follows in-toto attestation v1.0 schema with at minimum these predicate types: SLSA Provenance v1.0, SBOM, VSA, SCAI

**Reference URLs:**
- https://slsa.dev/ (canonical SLSA site)
- https://slsa.dev/spec/v1.0/ (current spec)
- https://github.com/slsa-framework/slsa-github-generator (canonical generator)
- https://docs.sigstore.dev/cosign/overview/ (cosign signing)
- https://github.com/in-toto/attestation (in-toto attestation v1.0 schema)
- https://www.cisa.gov/sites/default/files/2023-11/Securing_the_Software_Supply_Chain_Recommended_Practices_for_SBOM_Consumption_TLP-CLEAR_508c_0.pdf (CISA SBOM consumption guide)

---

## Anchor 7 — OpenSSF Scorecard

**What it is:** Automated security scoring for any GitHub repo, run by the Open Source Security Foundation. 18+ checks: branch protection, code review, CI test coverage, dependency update tools, fuzzing, license, maintained, packaging, pinned dependencies, SAST, signed releases, SBOM, token permissions, vulnerabilities, etc. Each check returns a 0–10 score; aggregate score is the headline metric.

**Why it anchors us:** Single, public, automated security health metric. Non-coders can read "Your project scored 8.2/10. Three issues to fix." Coders can read the JSON output. Industry-recognized, easy to explain.

**What ships in the kit:**
- `.github/workflows/scorecard.yml` running OpenSSF Scorecard weekly + on every PR
- Output uploaded to GitHub Security tab via SARIF
- Scorecard badge in README
- Pre-merge: PR must not lower scorecard score by >0.5 points
- Scorecard threshold configurable per project (default ≥ 7.0/10)
- Companion `scorecard-fix.md` AI-generated playbook for failing checks specific to the project

**Specific checks the scaffold pipeline auto-passes:**
- **Binary-Artifacts**: scaffolds use lockfiles, not vendored binaries → 10/10
- **Branch-Protection**: scaffolds emit `branch-protection.tf` template → user must enable
- **CI-Tests**: CI workflows are present (anchor 2 + 3) → 10/10
- **Code-Review**: `.github/CODEOWNERS` present → 10/10
- **Dependency-Update-Tool**: Dependabot config emitted → 10/10
- **Fuzzing**: ClusterFuzzLite stub for OSS projects → ≥ 6/10
- **License**: MIT/Apache-2.0/etc. SPDX-id'd → 10/10
- **Maintained**: hard to auto-pass (requires actual commits over time)
- **Packaging**: GitHub Release config emitted → 10/10
- **Pinned-Dependencies**: package-lock.json + pinned action SHAs → 10/10
- **SAST**: CodeQL workflow emitted → 10/10
- **Security-Policy**: `SECURITY.md` emitted → 10/10
- **Signed-Releases**: cosign integration (anchor 6) → 10/10
- **SBOM**: anchore/sbom-action emitted → 10/10
- **Token-Permissions**: workflows use minimum permissions → 10/10

Goal: scaffolds achieve **9.0+/10 OpenSSF Scorecard out of the box**. Most "vibe-coded" projects today score 3–5.

**Gate mapping:**
- **compliance.openssf-scorecard** — scaffolded repos achieve ≥ 7.0/10 (configurable)
- **compliance.scorecard-trend** — score must not regress vs. baseline by > 0.5 points

**Reference URLs:**
- https://github.com/ossf/scorecard (canonical scorecard tool)
- https://securityscorecards.dev/ (scorecard dashboard, public scores for any repo)
- https://github.com/ossf/scorecard-action (GitHub Action)
- https://openssf.org/blog/2024/05/15/openssf-scorecard-the-easiest-way-to-build-a-secure-foundation-for-your-software/ (intro)

---

## How the 7 anchors compose into the user flow

```
[Non-coder describes project] 
    │
    ▼
[Prompt Enhancer asks 3 clarifying questions] (anchor 1: agentic frame)
    │
    ▼
[Studio generates Contract Bundle:]
    ├── PRD.md, ADR-*.md, model-card.md, runbook.md  (templates)
    ├── agent-spec.yaml, task-graph.yaml             (anchor 1)
    ├── verification/
    │   ├── unit/  (vitest/pytest tests)             (anchor 2)
    │   ├── e2e/   (Playwright + tracing)            (anchor 3)
    │   └── INDEX.md                                  (links every test → trace)
    ├── risk-register/
    │   └── owasp-llm.md                              (anchor 4, if AI project)
    ├── compliance/
    │   ├── ssdf-attestation.md                       (anchor 5)
    │   └── slsa-provenance.json                      (anchor 6)
    └── .github/workflows/
        ├── ci.yml         (run tests, capture traces)
        ├── release.yml    (SLSA Build L3 + cosign)  (anchor 6)
        └── scorecard.yml  (OpenSSF weekly)          (anchor 7)
    │
    ▼
[Truth + Proof gates run on save:]
    ├── 12 gates from RubricCritic
    ├── + 7 anchor-specific gates (one per anchor)
    └── Green checkmark only when all errors clear
    │
    ▼
[User clicks "Generate Project"]
    │
    ▼
[Scaffold Pipeline emits the bundle to disk + git init]
    │
    ▼
[KiloCode main agent picks up agent-spec.yaml + task-graph.yaml and starts coding]
    │
    ▼
[CI runs verification harness; uploads traces; updates Scorecard]
    │
    ▼
[Non-coder watches the trace videos, signs off each acceptance criterion]
    │
    ▼
[Release workflow signs + attests + ships]
```

The whole loop is **non-coder-completable** except the literal coding step (which the agent does). Every gate has a plain-English explanation, every artifact has a "what is this and why does it matter" tooltip, every red gate has a one-click "Apply suggested fix" button.

---

## Anchor → Gate matrix

| Anchor | Gate ID | Severity | Plain-English label |
|---|---|---|---|
| 1. Agentic SWE | `proof.task-graph-valid` | error | "AI agents need a task graph; yours has missing pieces." |
| 1. Agentic SWE | `proof.req-id-cited` | warn | "Some claims don't reference any requirement; agents won't know what they're for." |
| 2. SWE-bench | `proof.swe-bench-coverage` | error | "Some user stories have no executable test." |
| 2. SWE-bench | `proof.swe-bench-pass-rate` | error | "Tests are failing. Fix them before shipping." |
| 3. Playwright | `proof.e2e-coverage` | warn | "Some user flows have no end-to-end test recording." |
| 3. Playwright | `proof.user-acceptance-signed` | error | "An acceptance criterion is unsigned." |
| 4. OWASP LLM | `safety.owasp-llm-coverage` | error | "Your AI project hasn't addressed all 10 OWASP LLM risks." |
| 4. OWASP LLM | `safety.prompt-injection-test` | warn | "No prompt-injection regression test." |
| 5. NIST SSDF | `compliance.ssdf-coverage` | warn | "NIST SSDF self-attestation is incomplete." |
| 6. SLSA | `compliance.slsa-build-l3` | error | "Release workflow doesn't produce a SLSA Build L3 attestation." |
| 6. SLSA | `compliance.signed-artifacts` | error | "Release artifacts aren't signed." |
| 7. OpenSSF | `compliance.openssf-scorecard` | warn | "OpenSSF Scorecard is below 7.0/10." |
| 7. OpenSSF | `compliance.scorecard-trend` | warn | "Scorecard score is dropping." |

**13 anchor-derived gates** layered on top of the 12 from `RubricCritic` = **25 total gates** in the "Contract Kit Creator" verification system.

---

## Open question: contract kit creator vs. studio framing

Two product names in play:
- **Contract Markdowns Studio** — current spec name
- **Contract Kit Creator** — user's preferred non-coder framing

Recommendation: keep **Contract Kit Creator** as the marketed product name (clearer for non-coders). The 28th tab is labeled "Contract Kits". The technical service tree under `src/services/contracts/` stays as-is. `studio` becomes an internal concept (the editing surface inside the kit creator).

---

## Status

This addendum is the source of truth for verification + compliance. The base spec at `CONTRACT_STUDIO_SPEC.md` covers the editor + generation core; this anchor doc covers what makes the output **trustworthy**. Both are required.

Implementation roadmap update: each anchor adds 1–2 sprints to the original 4-sprint plan. New 6-sprint roadmap:

- Sprint 1 — Editor + skeleton (per main spec)
- Sprint 2 — Templates + generation (per main spec)
- Sprint 3 — Truth + Proof gates from RubricCritic
- **Sprint 4 — Anchors 1+2: agent-spec.yaml, task-graph.yaml, SWE-bench-style verification harness**
- **Sprint 5 — Anchors 3+4: Playwright trace capture, OWASP LLM risk register, prompt-injection testing**
- **Sprint 6 — Anchors 5+6+7: NIST SSDF (SP 800-218 v1.1 + SP 800-218A) attestation, SLSA Build L3 release workflow, OpenSSF Scorecard CI**

Sprint 4–6 are the "Contract Kit Creator" differentiator vs. a generic AI doc tool.
