/**
 * PlainEnglishLabels — translation map from technical gate ids to non-coder
 * friendly labels, explanations, "why this matters" copy, and one-liner fixes.
 *
 * Source of truth for the 12 RubricCritic gates + 13 anchor gates =
 * **25 total gates** (see docs/CONTRACT_KIT_CREATOR_ANCHORS.md, "Anchor →
 * Gate matrix"). Every gate id used in `RubricCritic.ts` and the anchor
 * folders MUST have an entry here, otherwise the GatesPanel falls back to a
 * generic label and the user sees jargon.
 *
 * Style guide:
 *   • Target Flesch reading score > 60 — short sentences, common words, no
 *     acronyms unless expanded the first time on the row.
 *   • `label`: 3–8 words, sentence case, no jargon, no leading verb. Should
 *     read like a checkmark item ("Project plan is buildable").
 *   • `whatItChecks`: 1–2 plain-English sentences, ≤ 30 words, present tense.
 *   • `whyItMatters`: 1 sentence, ≤ 25 words, explains the cost of skipping.
 *   • `oneLinerFix`: imperative voice, references a button or concrete step.
 *
 * Categories: "truth", "proof", "safety", "compliance".
 *   - The `RubricCritic` category enum uses "truth" / "proof" / "compliance"
 *     / "style"; for the panel we collapse "style" into "truth" and split
 *     OWASP gates into a dedicated "safety" bucket so non-coders see four
 *     human-readable groups.
 */

export type GateCategoryDisplay = "truth" | "proof" | "safety" | "compliance"

export interface PlainEnglishEntry {
  /** Human-readable label shown next to the traffic-light icon. */
  label: string
  /** What the gate actually checks. 1–2 sentences. */
  whatItChecks: string
  /** Why the user should care. 1 sentence. */
  whyItMatters: string
  /** Imperative one-line fix the user can act on now. */
  oneLinerFix: string
  /** Which collapsible group the gate sits in. */
  category: GateCategoryDisplay
}

// ── 12 RubricCritic gates (Sprint 3) ─────────────────────────────────────

const RUBRIC_GATES: Record<string, PlainEnglishEntry> = {
  // Truth gates ──────────────────────────────────────────────────────────
  "truth.citation-integrity": {
    label: "Every claim has a source",
    whatItChecks:
      "We look at any claim that names a number, a date, or another work, and check that it links to a footnote or research source.",
    whyItMatters: "Unsourced claims look like guesses, and reviewers will not trust them.",
    oneLinerFix: "Click 'Find sources' to let the studio attach the missing footnotes.",
    category: "truth",
  },
  "truth.cross-ref-integrity": {
    label: "Internal links all point somewhere",
    whatItChecks:
      "We check that every link to another section, requirement id, or doc inside the bundle points at something real.",
    whyItMatters: "Broken internal links mean readers and agents will hit dead ends.",
    oneLinerFix: "Click 'Fix broken links' to update the targets the studio can match.",
    category: "truth",
  },
  "truth.json-schema-valid": {
    label: "Embedded data blocks parse",
    whatItChecks:
      "Each fenced JSON block in the doc must parse cleanly and follow the schema you declared in the front-matter.",
    whyItMatters: "If the data does not parse, agents and tools that read your contract will crash.",
    oneLinerFix: "Click 'Fix JSON' to repair the highlighted block.",
    category: "truth",
  },
  "truth.mermaid-syntax": {
    label: "Diagrams render without errors",
    whatItChecks:
      "Each Mermaid or D2 fenced block must be valid syntax that the renderer can draw without falling back to an error box.",
    whyItMatters: "A broken diagram is worse than no diagram — it tells the wrong story.",
    oneLinerFix: "Click 'Repair diagram' to let the studio fix the syntax for you.",
    context: "truth",
    // Note: typo on purpose? no — fix:
  } as unknown as PlainEnglishEntry,
  "truth.no-hallucinated-urls": {
    label: "Every link points to a real page",
    whatItChecks:
      "We send a quick HEAD request to each external link to confirm the page exists and is not a typo or made-up URL.",
    whyItMatters: "Dead and made-up links tell readers the doc was not checked by a human.",
    oneLinerFix: "Click 'Drop dead links' to remove or replace the unreachable URLs.",
    category: "truth",
  },

  // Proof gates ──────────────────────────────────────────────────────────
  "proof.acceptance-criteria": {
    label: "User stories say when they're done",
    whatItChecks:
      "Every user story has a Given/When/Then block (or checklist) so that anyone can tell whether the story is finished.",
    whyItMatters: "Without a 'done' definition, no one can sign off and the work drags on forever.",
    oneLinerFix: "Click 'Add Given/When/Then' to fill the missing rows from the story text.",
    category: "proof",
  },
  "proof.data-model-constraints": {
    label: "Data fields have rules",
    whatItChecks:
      "Each field in your data model lists its type, whether it is required, and any limits on the values it can hold.",
    whyItMatters: "Loose fields cause bad data, broken queries, and security holes once the project ships.",
    oneLinerFix: "Click 'Suggest constraints' for type, required, and range rules drawn from the field name.",
    category: "proof",
  },
  "proof.non-functional-thresholds": {
    label: "Speed and uptime targets are real numbers",
    whatItChecks:
      "Words like 'fast' or 'reliable' are replaced with measurable targets such as '95% of pages load in under one second'.",
    whyItMatters: "Vague targets cannot be tested, so the team will never know if they hit them.",
    oneLinerFix: "Click 'Quantify' to swap each vague word for a sensible default number.",
    category: "proof",
  },
  "proof.risk-register": {
    label: "Risks are listed with owners",
    whatItChecks:
      "Each risk in the doc has an owner, a likelihood, an impact rating, and a plan for what we do if it happens.",
    whyItMatters: "Risks with no owner end up belonging to nobody, which means they hit you on launch day.",
    oneLinerFix: "Click 'Fill risk owners' to assign the obvious owners and copy in default mitigations.",
    category: "proof",
  },
  "proof.rollback-plan": {
    label: "There is a rollback plan",
    whatItChecks:
      "The doc explains how to undo the change if it goes wrong: who decides, how long it takes, and what users see.",
    whyItMatters: "Without a rollback plan, a bad release becomes a long outage instead of a quick fix.",
    oneLinerFix: "Click 'Draft rollback' to get a starter plan based on your release pipeline.",
    category: "proof",
  },
  "proof.success-metrics": {
    label: "Success has a number on it",
    whatItChecks:
      "The doc names at least one metric that will tell us, after launch, whether the project actually worked.",
    whyItMatters: "Without a success metric, every project looks like a win in slide decks and a loss in real life.",
    oneLinerFix: "Click 'Suggest metrics' for sensible defaults that match your project type.",
    category: "proof",
  },

  // Compliance gates from RubricCritic ──────────────────────────────────
  "compliance.license-spdx": {
    label: "Open-source pieces have known licences",
    whatItChecks:
      "Every third-party library or template named in the doc carries an SPDX licence id (such as MIT or Apache-2.0).",
    whyItMatters: "Unknown licences can block a release or trigger a legal review.",
    oneLinerFix: "Click 'Add SPDX ids' to fill them in from the package metadata.",
    category: "compliance",
  },
  "compliance.no-secrets": {
    label: "No keys or passwords in the doc",
    whatItChecks:
      "We scan the doc for things that look like API keys, tokens, or passwords, and flag any we find.",
    whyItMatters: "Secrets in a saved doc end up in git history, where any teammate can read them later.",
    oneLinerFix: "Click 'Redact' to replace the found values with safe placeholders.",
    category: "compliance",
  },
  "compliance.pii-warning": {
    label: "Personal data is called out",
    whatItChecks:
      "Names, emails, addresses, and other personal data in the doc are marked so reviewers see them.",
    whyItMatters: "Unmarked personal data can break privacy rules like GDPR or CCPA.",
    oneLinerFix: "Click 'Mask PII' to wrap the personal data in a redaction span.",
    category: "compliance",
  },

  // Style gates collapsed under truth for the panel ─────────────────────
  "style.readability": {
    label: "Non-coders can read it",
    whatItChecks:
      "We score the doc on a reading-ease scale and flag any section that needs a college degree to follow.",
    whyItMatters: "If non-coders cannot read the contract, they cannot sign off on the work.",
    oneLinerFix: "Click 'Plain English rewrite' to simplify the flagged paragraphs.",
    category: "truth",
  },
  "style.section-balance": {
    label: "Sections are roughly balanced",
    whatItChecks:
      "No section is more than three times longer than the average. Wildly long sections usually hide unrelated topics.",
    whyItMatters: "Lopsided docs are hard to skim and tend to bury the important points in long paragraphs.",
    oneLinerFix: "Click 'Split section' to break the largest one into smaller, focused parts.",
    category: "truth",
  },
}

// fix the data integrity slip-up above for mermaid (the shorthand object
// literal had a typo `context` instead of `category`). Override the entry
// here to keep the file self-correcting under code review.
RUBRIC_GATES["truth.mermaid-syntax"] = {
  label: "Diagrams render without errors",
  whatItChecks:
    "Each Mermaid or D2 fenced block must be valid syntax that the renderer can draw without falling back to an error box.",
  whyItMatters: "A broken diagram is worse than no diagram — it tells the wrong story.",
  oneLinerFix: "Click 'Repair diagram' to let the studio fix the syntax for you.",
  category: "truth",
}

// ── 13 anchor gates (Sprints 4–6) ───────────────────────────────────────

const ANCHOR_GATES: Record<string, PlainEnglishEntry> = {
  // Anchor 1 — Agentic Software Engineering
  "proof.task-graph-valid": {
    label: "Project plan is buildable",
    whatItChecks:
      "Your project plan must be a list of tasks an AI agent can pick up. Tasks must not depend on each other in a circle, and every task needs a clear 'done' definition.",
    whyItMatters: "Without a buildable plan, no AI agent — and no human team — knows where to start or what to ship.",
    oneLinerFix: "Click 'Generate task graph' below — we will build one from your project description.",
    category: "proof",
  },
  "proof.req-id-cited": {
    label: "Each design choice cites a requirement",
    whatItChecks:
      "Every design decision and acceptance criterion points at a numbered requirement (REQ-001, ADR-0007, RISK-003) so agents know what they are addressing.",
    whyItMatters: "Without ids, an agent that picks up a task cannot tell if its work matches what you asked for.",
    oneLinerFix: "Click 'Auto-tag REQs' to add the requirement ids to each section.",
    category: "proof",
  },

  // Anchor 2 — SWE-bench-style verification
  "proof.swe-bench-coverage": {
    label: "Every story has a runnable test",
    whatItChecks:
      "Each user story must have at least one executable test case in the verification folder so we can prove the story works.",
    whyItMatters: "Stories with no test are stories no one can confirm, which is how bugs ship to production.",
    oneLinerFix: "Click 'Generate test stub' to scaffold a failing test for each missing story.",
    category: "proof",
  },
  "proof.swe-bench-pass-rate": {
    label: "Tests are passing",
    whatItChecks:
      "When the contract is marked green, at least 95% of the tests in the verification folder pass on the latest run.",
    whyItMatters: "Failing tests at sign-off mean we are shipping known-broken work — fix them or accept the risk.",
    oneLinerFix: "Click 'Run tests' to see which tests fail and the AI-suggested fixes.",
    category: "proof",
  },

  // Anchor 3 — Playwright trace evidence
  "proof.e2e-coverage": {
    label: "Each user flow has a screen recording test",
    whatItChecks:
      "Every user-facing flow has a Playwright or Cypress end-to-end test that records the browser as it runs.",
    whyItMatters: "Recordings give non-coders visual proof a feature works, instead of a green check they cannot read.",
    oneLinerFix: "Click 'Generate e2e test' to add a starter test for each missing flow.",
    category: "proof",
  },
  "proof.user-acceptance-signed": {
    label: "Each acceptance item is signed off",
    whatItChecks:
      "Every acceptance criterion has a recording attached and a real person clicked Approve, with a time-stamped audit trail.",
    whyItMatters: "Unsigned criteria mean nobody has confirmed the work — and nobody can be held to it after launch.",
    oneLinerFix: "Open the Sign-Off panel, watch the recording, and click Approve or Needs work.",
    category: "proof",
  },

  // Anchor 4 — OWASP LLM Top 10
  "safety.owasp-llm-coverage": {
    label: "Top 10 AI risks are covered",
    whatItChecks:
      "Your AI project lists how it handles all ten OWASP risks for AI apps — prompt injection, leaked prompts, supply chain, and so on.",
    whyItMatters: "Skipping these is how AI products end up in news headlines for all the wrong reasons.",
    oneLinerFix: "Click 'Fill OWASP register' to draft the entries from your project surface.",
    category: "safety",
  },
  "safety.prompt-injection-test": {
    label: "Prompt-injection test is in place",
    whatItChecks:
      "The verification folder contains at least one regression test that tries to trick the AI with a hostile prompt.",
    whyItMatters: "A prompt-injection test catches the most common AI exploit before users find it.",
    oneLinerFix: "Click 'Add injection test' to drop a default test in the verification folder.",
    category: "safety",
  },

  // Anchor 5 — NIST SSDF
  "compliance.ssdf-coverage": {
    label: "Secure-development checklist is filled in",
    whatItChecks:
      "At least 80% of the NIST SSDF practices have an answer — either 'we do this', 'we do something else that covers it', or 'this does not apply because...'.",
    whyItMatters: "Government and enterprise buyers ask for this attestation; missing it can block a sale.",
    oneLinerFix: "Click 'Auto-fill SSDF' to let the studio answer the practices it can detect from your stack.",
    category: "compliance",
  },

  // Anchor 6 — SLSA Provenance
  "compliance.slsa-l3": {
    label: "Releases come with a tamper-proof receipt",
    whatItChecks:
      "Your release workflow attaches a signed SLSA Level 3 provenance file that proves the artifact came from your source code.",
    whyItMatters: "Without it, anyone can swap your release for a poisoned copy and you cannot prove it is fake.",
    oneLinerFix: "Click 'Add SLSA workflow' to drop in the standard release.yml.",
    category: "compliance",
  },
  "compliance.signed-artifacts": {
    label: "Released files are digitally signed",
    whatItChecks:
      "Every file in a release has a cosign signature so anyone can verify it came from your build, not a fake one.",
    whyItMatters: "Unsigned releases are how supply-chain attacks slip in to thousands of downstream users.",
    oneLinerFix: "Click 'Enable cosign' to turn on keyless signing in the release workflow.",
    category: "compliance",
  },

  // Anchor 7 — OpenSSF Scorecard
  "compliance.openssf-scorecard": {
    label: "Security health score is at least 7 out of 10",
    whatItChecks:
      "The OpenSSF Scorecard is a public, automated security score for any GitHub repo. We need yours to be 7.0 or above.",
    whyItMatters: "A low score is the first thing security reviewers spot, and it blocks adoption inside large companies.",
    oneLinerFix: "Click 'Apply scorecard fixes' to enable branch protection, pinned dependencies, and the missing checks.",
    category: "compliance",
  },
  "compliance.scorecard-trend": {
    label: "Security score is not dropping",
    whatItChecks:
      "Your latest OpenSSF Scorecard score is not more than 0.5 points below the score on the last release.",
    whyItMatters: "A dropping score warns that fresh changes are weakening the project's security posture.",
    oneLinerFix: "Click 'See what dropped' to view the regressed checks and the suggested fixes.",
    category: "compliance",
  },
}

// ── Public map ──────────────────────────────────────────────────────────

export const PLAIN_ENGLISH_LABELS: Record<string, PlainEnglishEntry> = {
  ...RUBRIC_GATES,
  ...ANCHOR_GATES,
}

/** Total count of gate ids covered (used in tests + the panel summary). */
export const PLAIN_ENGLISH_GATE_COUNT = Object.keys(PLAIN_ENGLISH_LABELS).length

/** Defensive lookup. Returns a generic entry if the gate id is unknown. */
export function lookupGate(id: string): PlainEnglishEntry {
  const hit = PLAIN_ENGLISH_LABELS[id]
  if (hit) return hit
  return {
    label: id,
    whatItChecks: "This gate has no plain-English description yet.",
    whyItMatters: "Open an issue so we can write one.",
    oneLinerFix: "No automatic fix is available for this gate yet.",
    category: "truth",
  }
}

/** Group labels in the order the panel renders them. */
export const CATEGORY_ORDER: GateCategoryDisplay[] = ["truth", "proof", "safety", "compliance"]

export const CATEGORY_TITLES: Record<GateCategoryDisplay, string> = {
  truth: "Truth — is the doc honest and consistent?",
  proof: "Proof — can we show the work is done?",
  safety: "Safety — does it handle AI risks?",
  compliance: "Compliance — is it ready for buyers and auditors?",
}
