# Contract Kit Creator — SOTA 2026 Audit

> **Quality bar: every component must be state-of-the-art for 2026.** No 2023-vintage choices, no deprecated patterns, no models that have been superseded. This document is the running ledger of "current best" and locks in our floor.
>
> **Version:** 0.2 (post-audit hardening pass — 2026-04-28)
> **Audit input:** `SOTA_2026_AUDIT_REPORT.md` by Claude Opus 4.7, 2026-04-28.

---

## Changelog

### v0.2 — 2026-04-28 — Post-audit hardening pass
- **Pinned versions** for fast-moving specs: MCP `2025-06-18`, A2A LF `v0.2+`, OWASP LLM `2025` (Nov 2024 publication), Vercel AI SDK `v5`, Tldraw `v3.x` + `@tldraw/ai 0.x`, Milkdown `7.x` + `@milkdown/crepe`, sqlite-vec (production-stable 2024 release), SLSA `Build L3` (v1.0 track terminology).
- **Fixed EU AI Act** high-risk effective date: **Aug 2, 2026** (not Feb 2026). Added GPAI obligations date (Aug 2, 2025) and GPAI Code of Practice reference.
- **Updated DeepSeek** lineup: V3.1 → V3.2 (Sept 2025 sparse-attention release) plus R1-0528 successor.
- **Updated Claude lineup** with Opus 4.5+ for the deliberation/planner role; Sonnet 4.5 demoted to vision/structured-output worker tier.
- **Reconciled AIBOM with SPDX 3.0 AI profile**: AIBOM is a profile of SPDX 3.0, not a separate standard. Pin to SPDX 3.0.1 + AI profile + Dataset profile, with CycloneDX 1.6 ML-BOM as alternative.
- **Paired C2PA with SynthID-Text**: C2PA Content Credentials v2.1 covers binaries; SynthID-Text (Google, open-sourced via HuggingFace Transformers Oct 2024) covers plain text.
- **SLSA terminology fix**: pin to `Build L3` under v1.0 Build track (Source track split out).
- **Added 9 missing techs**: Terminal-Bench, GAIA, BrowseComp, METR RE-Bench, MCP registry, NIST SP 800-218A, CycloneDX 1.6 ML-BOM + VEX, SynthID-Text, DSPy 3 + GEPA optimizer, and the vendor-side eval harnesses (Anthropic Evals, OpenAI Evals, Google Gemini Eval).
- **Added Risk-of-stale items to monitor** section with 8 fast-moving picks and review-by dates.
- **Added Bonus moonshots** section with 10 cutting-edge candidates flagged by the audit.
- **Resolved or marked 11 [LC] (low-confidence) claims** from the audit appendix with `<!-- TODO: verify -->` annotations or defensible general phrasing.

### v0.1 — 2026-Q1 — Initial SOTA-2026 audit ledger
- Initial pass; 92 picks across 8 domains.

---

## Models — SOTA-2026 lineup (locked)

| Role | Pick | Why 2026-current |
|---|---|---|
| Reasoning planner / deliberation | **Claude Opus 4.5+ (extended thinking)** or **OpenAI o3** or **GPT-5** | Opus 4.5/4.6/4.7 (late-2025 → early-2026) is the current Anthropic flagship deliberation tier; o3 (Apr 2025) and GPT-5 (Aug 2025) are the OpenAI counterparts. <!-- TODO: verify GPT-5 release date when WebSearch available --> [^opus45] [^o3] [^gpt5] |
| Vision / structured-output worker | **Claude Sonnet 4.5** (Sept 29, 2025) | Best vision + structured-output discipline on technical diagrams; SWE-bench Verified ≥77% reported by Anthropic. [^sonnet45] |
| Section workers (cheap, fast) | **Claude Haiku 4.5** (Oct 15, 2025) or **Gemini 2.5 Flash Thinking** | Haiku 4.5 matches Sonnet 4 quality at 1/3 cost; Flash Thinking has hidden CoT. [^haiku45] |
| Long-context recall | **Gemini 2.5 Pro (1M ctx; 2M experimental)** | Best for cross-doc consistency reconciler. <!-- TODO: verify 2M ctx GA status --> [^gemini25] |
| Open-weights reasoning | **DeepSeek V3.2** (Sept 2025, sparse attention) + **R1-0528** successor line | V3.1 superseded; V3.2 is current open-weights reasoning frontier. <!-- TODO: verify exact V3.2 release date --> [^deepseekv32] |
| Vision (screenshot → spec) | **Claude Sonnet 4.5 vision** > Gemini 2.5 Pro > GPT-4.1 | Best structured-output discipline on technical diagrams. |
| Local-first fallback (open-weights frontier, variant-pinned) | **Llama 4 Maverick** (general, Apr 2025) / **Qwen3-Coder** (code) / **Qwen3-VL** (vision) / **MiniMax M2** (reasoning) via Ollama | 2026 open-weights frontier; pin per-task variants rather than bare model family. <!-- TODO: verify Llama 4 Maverick/Scout/Behemoth split details --> [^llama4] [^qwen3] |
| Default user-facing | **MiniMax M2** | User's primary; cheap reasoning, 1M ctx, function-call native. [^minimax] |

**Rejected as outdated:** GPT-3.5, Claude 2.x, Llama 2/3.0, original GPT-4 (replaced by 4.1/o-series/GPT-5), Gemini 1.5 (replaced by 2.5), Claude Sonnet 3.x, DeepSeek V3 / V3.1 (replaced by V3.2).

---

## Agentic patterns — SOTA-2026

| Pattern | Status | Source |
|---|---|---|
| **MCP (Model Context Protocol)** — pinned to spec revision **`2025-06-18`** | ✅ MUST integrate | Anthropic, late 2024; production-stable as of `2025-06-18` revision; adopted by Anthropic, OpenAI, Microsoft, Google. [^mcp-spec] |
| **MCP Registry / server marketplace** | ✅ MUST integrate (discovery story) | Anthropic-hosted registry, shipped 2025. <!-- TODO: verify registry release date --> [^mcp-registry] |
| **A2A (Agent-to-Agent protocol) — Linux Foundation v0.2+** | ✅ experimental integration | Contributed to Linux Foundation in mid-2025; now an open-governance project under `a2aproject/A2A`. Pre-1.0 in early 2026 — treat as experimental, don't make it a hard gate. [^a2a] |
| **Computer Use** API | ✅ included as tool surface | Anthropic Oct 2024 (`computer-use-2024-10-22` beta header); GA mid-2025. [^computer-use] |
| **Claude Code CLI / Cursor Composer / Devin patterns** | ✅ aligns with Anchor 1 | 2024-2026 |
| **PCC (Plan-Critique-Compose)** | ✅ already in spec | this design |
| **Reflexion / Self-Refine / ReAct** | ✅ included | 2023-2024 papers (Madaan 2023 Self-Refine; Shinn 2023 Reflexion), still SOTA primitives |
| **Constitutional AI** | ✅ in safety layer | Anthropic 2022 → 2026 evolution |
| **Constitutional Classifiers** (Anthropic Feb 2025) | ✅ NEW — pre/post LLM-call safety classifier | Layered defense for prompt-injection (pairs with Anchor 4 OWASP LLM01). [^constitutional-classifiers] |
| **Tree-of-Thoughts** | ✅ for complex reasoning | Princeton 2023, still relevant |
| **Skeleton-of-Thought** | ⚠️ niche, optional | not always worth latency |
| **DSPy 3.0 + GEPA optimizer** (Aug 2025) | ✅ replaces moonshot DSPy MIPROv2 | DSPy 3 with GEPA (Genetic-Pareto prompt optimization) dominates MIPROv2 when an eval corpus exists. [^dspy3] [^gepa] |
| **Multi-agent debate (Du et al.)** | ✅ for critic loop | works in 2026 |

**Rejected as outdated:** Plain CoT (use ToT or extended-thinking instead), original ReAct without observation budget (too brittle), AutoGPT-style infinite loops (replaced by bounded plan-execute), DSPy MIPROv2 (replaced by GEPA when eval corpus is present).

---

## Verification & evidence — SOTA-2026

- **SWE-bench Verified** (Anthropic-curated, Aug 2024, 500-issue subset) — current SWE benchmark gold-standard. [^swebench]
- **SWE-Lancer** (Cognition / OpenAI, 2025) — freelance-style multi-task evaluation
- **METR Long-Task Suite** + **METR RE-Bench** (research-engineering benchmark) — 2024-2025 — METR's RE-Bench is the current gold-standard for "can the agent do my job for an hour"; aligns with non-coder "watch trace videos" UX. <!-- TODO: verify RE-Bench exact citation --> [^re-bench]
- **TAU-bench** (Sierra, 2024 — `arxiv.org/abs/2406.12045`) — canonical tool-using-agent eval
- **Terminal-Bench** (Stanford/Anthropic, 2024) — tests agents on real CLI tasks; better signal than SWE-bench alone for "can the kit's verification harness drive a real shell". [^terminal-bench]
- **GAIA** (Meta, 2023) — canonical general-assistant benchmark. [^gaia]
- **BrowseComp** (OpenAI, 2025) — deep web research eval; directly relevant to `ResearchService`. [^browsecomp]
- **WebArena / VisualWebArena** (2024) — browser-agent eval
- **Playwright Trace Viewer** (v1.40+; "v2" in earlier docs is informal). Trace format stable. [^playwright-trace]
- **Cypress Test Replay** (2025) — current commercial standard
- **Inspect AI** (UK AISI, MIT-licensed) — official UK govt eval framework. [^inspect]
- **Promptfoo / DeepEval / Ragas** — current LLM eval stacks. [^promptfoo]
- **Lighteval** (HuggingFace) — current open eval harness
- **Vendor-side eval harnesses** (NEW): **Anthropic Console "Evaluations"** + **OpenAI Evals "responses" track** + **Google Gemini Eval** — plug directly into the model APIs and emit OTel traces. Cheaper than building bespoke; link out from Inspect AI. [^anthropic-evals] [^openai-evals]
- **Bias bounty pattern** (HuggingFace + Anthropic, 2025) — for model card

**Replaced 2023-era picks:** plain unit tests as evidence (now: tests + traces + screenshots + signed attestation), LLM-as-judge alone (now: deterministic gates first, LLM-as-judge as soft layer only).

---

## Security & supply chain — SOTA-2026

- **OWASP LLM Top 10 2025** (published Nov 2024 for 2025 cycle — pin to the SHA of the markdown file used for risk-register generation). Includes companion **OWASP GenAI Red Teaming Guide** (2025) and **OWASP AI Security Solutions Landscape** (2024-2025). [^owasp-llm-2025] [^owasp-redteam]
- **NIST SP 800-218 v1.1** (Feb 2022 SSDF revision) **and NIST SP 800-218A** (Generative AI / Foundation Models SSDF companion, 2024) — both required for AI-shipping projects. [^nist-218] [^nist-218a]
- **NIST AI RMF 1.0** + **AI RMF Generative AI Profile (NIST AI 600-1, July 26, 2024)** — current generative-AI risk framework. Add **NIST AI 100-2 E2024** (Adversarial ML Taxonomy) and **CAISI (formerly US AISI) pre-deployment evaluations**. [^nist-600-1]
- **EU AI Act** — entered into force **Aug 1, 2024**. **GPAI obligations apply Aug 2, 2025**. **High-risk Annex III obligations apply Aug 2, 2026**. Add the **GPAI Code of Practice** (published 2025). <!-- TODO: verify exact dates when WebSearch available --> [^eu-ai-act]
- **SLSA v1.0 — Build L3** (April 2024 spec; v1.0 splits into Build / Source tracks — pin to `Build L3` explicitly, since L3 alone is ambiguous). Track **SLSA v1.1 Build track** (RC floated late 2025). [^slsa-v1]
- **in-toto attestation v1.0** (current schema). Predicate types we'll emit: **SLSA Provenance v1.0**, **SBOM**, **VSA** (Verification Summary Attestation), **SCAI** (Supply Chain Attribute Integrity). Track **in-toto v2 attestation framework** progress. [^in-toto]
- **Sigstore (cosign + Rekor + Fulcio)** — production-stable; used by Kubernetes, npm provenance. [^sigstore]
- **CISA Secure Software Self-Attestation Form** — finalized March 2024. [^cisa-attestation]
- **OpenSSF Scorecard** — actively maintained, current. [^scorecard]
- **SBOM SPDX 3.0.1 + AI profile + Dataset profile** (April 2024 release; AI profile is the canonical AIBOM-class format for SPDX-shipping projects — supersedes the "AIBOM as separate standard" framing). [^spdx-3]
- **CycloneDX 1.6 ML-BOM + VEX** (2024) — alternative AIBOM format; **VEX (Vulnerability Exploitability eXchange)** is now expected alongside SBOM for enterprise shipping. [^cyclonedx-mlbom] [^cisa-vex]
- **Content provenance — paired offering**:
  - **C2PA Content Credentials v2.1** (2024) — production format for binary/media outputs. [^c2pa]
  - **SynthID-Text** (Google, open-sourced via HuggingFace Transformers Oct 2024) — text-watermarking layer that pairs with C2PA. C2PA alone doesn't cover plain text. [^synthid]

**Replaced 2023 picks:** SLSA v0.x (now v1.0 Build L3), SPDX 2.x (now 3.0.1), unsigned attestations (now mandatory cosign+Rekor), AIBOM-as-separate-standard (now SPDX 3.0 AI profile *or* CycloneDX 1.6 ML-BOM).

---

## Editor / authoring — SOTA-2026

- **Milkdown 7.x** with **`@milkdown/crepe`** preset (separate package). Note: Crepe targets React/Vue out of the box — for SolidJS (our stack) lower-level Milkdown packages with manual integration are required (engineering risk flagged). [^milkdown-crepe]
- **CodeMirror 6** — active maintenance, current SOTA. [^cm6]
- **Pandoc-style footnotes** — durable standard
- **MDX / GFM hybrid** for component embedding — current
- **Yjs / Loro CRDT** for real-time collab (Loro is 2024+ pick over older Automerge). [^loro]
- **Tldraw v3.x** + **@tldraw/ai 0.x** module (v2 → v3 broke APIs in mid-2024 — pin both). <!-- TODO: verify @tldraw/ai exact path/version --> [^tldraw]
- **D2 primary** for diagrams — preferred over Mermaid (cleaner output, ELK layout). Note: Mermaid 11.x (2024) closed much of the gap (architecture diagrams, packet diagrams, block diagrams, xychart-beta, mind maps). Make D2-vs-Mermaid a config flag; both should work. [^d2] [^mermaid-11]

**Rejected:** Quill (legacy), Slate (still good but Milkdown beats it for MD round-trip), DraftJS (Meta-deprecated), Lexical (too low-level for our timeline).

---

## RAG / Research — SOTA-2026

- **Late chunking** (Jina AI 2024 — `arxiv.org/abs/2409.04701`) — current chunking SOTA. [^late-chunking]
- **Agentic RAG** (multi-hop, query rewriting) — current
- **GraphRAG** (Microsoft 2024, OSS) for cross-doc synthesis. [^graphrag]
- **ColBERT v2** for retrieval — SOTA dense (with **ColBERT-Live** / **PLAID-X** as 2024-2025 successors to monitor). [^colbert]
- **Self-RAG / Corrective-RAG (CRAG)** — Asai 2024 (`arxiv.org/abs/2310.11511`), Yan 2024 (`arxiv.org/abs/2401.15884`) — current. [^self-rag] [^crag]
- **Tavily** for web — current SOTA agentic-search API
- **Semantic Scholar Graph API** — current academic search
- **Cohere rerank v3** or **Voyage v3** — current reranking SOTA (both 2024 reranker generations)
- **sqlite-vec** (Alex Garcia, production-stable as of 2024 — replacement for sqlite-vss). [^sqlite-vec]

**Rejected as outdated:** plain BM25-only retrieval, original RAG without query rewriting, fixed-size chunking, Pinecone-only architectures (sqlite-vec embeds locally), sqlite-vss (replaced by sqlite-vec).

---

## Eval & observability — SOTA-2026

- **OpenTelemetry GenAI semantic conventions** (status: "Development" 2024-2025, on track to "Stable" — use the conventions package, not bare attribute strings). [^otel-genai]
- **Phoenix / Arize / LangSmith / Langfuse** — current LLM observability stacks
- **Inspect AI** — UK govt eval framework (current)
- **Helicone / Langwatch** — current proxy-based observability
- **Promptfoo** — current eval-as-code
- **Lighteval** (HuggingFace) — current open eval harness
- **Vendor-side eval harnesses**: **Anthropic Console "Evaluations"** (Aleph methodology in API form) + **OpenAI Evals "responses" track** + **Google Gemini Eval** — emit OTel traces, pluggable from Inspect AI.

**Pick for our stack**: ship OpenTelemetry GenAI traces; expose them in Hub canonical-settings + Hermes for cross-tab observability.

---

## What changes in our existing implementation

After audit, these spec items get a SOTA-2026 upgrade:

| Was | Now (SOTA-2026) |
|---|---|
| Mermaid primary | **D2 primary**, Mermaid fallback only (config-flagged; Mermaid 11.x closed the gap — revisit Q4 2026) |
| Just OpenAI/Anthropic | + **MCP (`2025-06-18`) + MCP Registry**, **A2A LF v0.2+ handshake** (experimental), **Computer Use** |
| Just web search | + **Tavily + Semantic Scholar + late chunking + ColBERT-style rerank** |
| Plain unit tests | + **Playwright traces + signed test attestations** |
| Self-built telemetry | **OpenTelemetry GenAI semantic conventions** |
| OWASP LLM 2023 | **OWASP LLM 2025** (Nov 2024 publication) + GenAI Red Teaming Guide |
| SLSA L1 | **SLSA Build L3** (v1.0 track terminology — non-falsifiable provenance) |
| SPDX 2.x SBOM | **SPDX 3.0.1 + AI profile + Dataset profile** (AIBOM is a profile of SPDX 3.0, not a separate standard) |
| Generic risk register | + **NIST AI RMF Generative AI Profile** mapping + **NIST AI 100-2 E2024** Adversarial ML Taxonomy |
| Static templates | + **template versioning**, **template signing** (cosign), **C2PA Content Credentials v2.1** for binaries paired with **SynthID-Text** for text |

These are not new features — they are **substitutions** for outdated picks. The spec docs will be updated by the SOTA-audit agent.

---

## Non-coder UX — SOTA-2026

- **Reasoning collapsed by default** — pattern from Claude.ai Artifacts, ChatGPT-canvas (2024-2026 standard)
- **Trace videos as primary acceptance signal** — pattern from Linear / GitHub PR previews / Vercel deployments
- **One-tap re-render for audience** — pattern from Notion AI / Anthropic prompt-tuner
- **Inline diff with hunk-level approve/reject** — pattern from Cursor Composer
- **Voice-first onboarding** — pattern from Vercel v0 / Lovable

**Rejected:** chatbot-only interfaces (these are 2022 patterns), wizard-first flows (boring, low-conversion in 2025+ benchmarks), ticket-system feel.

---

## Locked-in decisions (commit now, revisit Q3 2026)

1. **Models** as listed in the table at top (variant-pinned per task; `RoutingService` capability tags rather than name-binding)
2. **D2 primary** for diagrams (config-flagged; Mermaid 11.x closing the gap)
3. **MCP integration is non-negotiable** — every Contract Kit emits MCP server stubs; pin spec revision `2025-06-18`
4. **OpenTelemetry GenAI** for telemetry
5. **OWASP LLM 2025** + **NIST AI RMF 600-1** for AI safety gates
6. **SLSA Build L3 + cosign keyless** for release attestation
7. **OpenSSF Scorecard ≥ 9.0/10** scaffold floor (was 7.0 — raised after SOTA review)
8. **Playwright traces required** on every E2E spec — not optional
9. **SPDX 3.0.1 AI profile (AIBOM)** ships in every AI-project Contract Kit
10. **C2PA Content Credentials v2.1 (binaries) + SynthID-Text (text watermarking)** content provenance for LLM-generated outputs

---

## Risk-of-stale items to monitor

The audit (Section 5) flagged 8 picks expected to be superseded by Q4 2026. Each has an owner and a "review by" date — re-confirm SOTA status on or before that date.

| # | Item | Why it'll likely move | Mitigation | Review by |
|---|---|---|---|---|
| R1 | **Claude Sonnet/Opus 4.5+** as primary | Anthropic ships every 6–12 months; Sonnet 5 / Opus 5 likely Q3-Q4 2026 | Pin via `RoutingService` capability tags, not by name | 2026-09-30 |
| R2 | **MCP spec `2025-06-18`** | MCP iterating fast — elicitation, structured tool output, OAuth, transport; major revision likely Q3-Q4 2026 | Negotiate version on handshake; isolate transport behind a port | 2026-09-30 |
| R3 | **A2A protocol (LF v0.2+)** | LF governance is young; spec pre-1.0 early 2026 | Treat as experimental; don't make it a hard gate | 2026-09-30 |
| R4 | **OpenTelemetry GenAI Semantic Conventions** | Still "Development" status late 2025; may rename attributes before "Stable" | Use the conventions package, not bare strings | 2026-12-31 |
| R5 | **D2 vs Mermaid** primary | Mermaid 11.x closing the gap (architecture, packet, ELK plugin in beta); 50/50 by Q4 2026 | Config flag; both must work | 2026-12-31 |
| R6 | **Late-chunking** as default | Better techniques appearing — PLAID-X, ColBERT-Live, summary trees (RAPTOR 2024), HiPPO-style hierarchical merging | Make chunker pluggable; benchmark per-corpus | 2026-09-30 |
| R7 | **OWASP LLM Top 10 v2025** | OWASP refreshes every ~18 months; v2026/2027 plausible | Pin to the SHA of the markdown file used for risk-register generation | 2026-12-31 |
| R8 | **Tldraw v3 / @tldraw/ai** | Tldraw iterating quickly with AI features 2025-2026 | Hide behind a thin adapter; isolate AI-module integration | 2026-09-30 |

---

## Bonus moonshots — 2026 cutting-edge additions worth considering

These go beyond SOTA-current into "bleeding edge". Each is high-value-low-cost to evaluate.

1. **Lean 4 + AI proof search** — formal verification of the most important specs (auth, payments, ACL). Generate a TLA+/Alloy spec from the PRD, model-check it, attach the trace as evidence. References: AlphaProof (DeepMind 2024), Lean Copilot 2024. [^lean4] [^tla]
2. **World-model sandboxes (E2B / Modal)** — production-grade equivalent to Genie 2 / V-JEPA 2 demos: run the scaffolded project's tests in a forkable VM, replayable as evidence. [^e2b] [^modal]
3. **Agent-vs-agent red-team eval (Microsoft PyRIT, Anthropic *Petri*)** — dedicated adversary agent runs on every PR (prompt injection, jailbreaks, exfiltration probes); results feed Anchor 4 (OWASP LLM). [^pyrit] [^petri]
4. **AI-Scientist methodology (Sakana AI 2024)** — for research-heavy contract kits, the agent generates falsifiable claims and designs experiments — better evidence than "the AI cited a source". [^ai-scientist]
5. **Constitutional Classifiers (Anthropic Feb 2025)** — layered safety classifier running before *and* after the LLM call; matches Anchor 4's prompt-injection regression-test requirement with a real defense, not just a test. [^constitutional-classifiers]
6. **Differentially-private telemetry** — ε-DP guarantees on aggregate telemetry are the 2026 standard for any user-touching AI product. References: Google DP-Auditing 2024, Apple PCC pattern. [^dp]
7. **Hermetic builds for SLSA Build L4** — Nix flakes + Bazel hermetic builds make L4 tractable for scaffolded projects; stretch goal. [^reproducible-builds]
8. **Modern toolchain (`uv` / `bun` / `biome`)** — Astral `uv` for Python, `bun` 1.x for JS, `oxc`/`biome 2.x` for lint/format are the 2024-2025 Rust-based replacements for pip/poetry, npm/yarn, ESLint/Prettier. If the scaffold pipeline still emits `npm` and `pip`, it's already 2023-vintage. [^uv] [^bun] [^biome]
9. **AI PR reviewers (CodeRabbit, Greptile, Sourcery)** — pair `agent-spec.yaml` with an AI reviewer that consumes the YAML; CodeRabbit's AST review (2024) and Greptile (2025) are current. [^coderabbit] [^greptile]
10. **Active-inference critic loops** — instead of fixed-prompt Reflexion, the critic agent maintains a running posterior over which gates fail most and prioritizes those — Friston-style active inference patterns appearing in agent literature 2025+.

---

## References / sources

[^opus45]: https://www.anthropic.com/news/claude-opus-4-5 — Claude Opus 4.5 (and successor 4.6/4.7) Anthropic flagship line, late 2025/early 2026. <!-- TODO: verify exact URL when WebSearch available -->
[^o3]: https://openai.com/index/introducing-o3-and-o4-mini/ — OpenAI o3 release Apr 16, 2025.
[^gpt5]: https://openai.com/index/gpt-5/ — GPT-5 release Aug 2025. <!-- TODO: verify release date -->
[^sonnet45]: https://www.anthropic.com/news/claude-sonnet-4-5 — Sept 29, 2025.
[^haiku45]: https://www.anthropic.com/news/claude-haiku-4-5 — Oct 15, 2025.
[^gemini25]: https://blog.google/technology/google-deepmind/google-gemini-updates-io-2025/ — Gemini 2.5 Pro / 2.5 Flash Thinking. <!-- TODO: verify 2M ctx GA -->
[^deepseekv32]: https://api-docs.deepseek.com/news/news250929 — DeepSeek V3.2 Sept 2025 sparse-attention. <!-- TODO: verify exact release date -->
[^llama4]: https://ai.meta.com/blog/llama-4-multimodal-intelligence/ — Llama 4 Maverick/Scout/Behemoth split Apr 2025. <!-- TODO: verify variant naming -->
[^qwen3]: https://qwenlm.github.io/blog/ — Qwen 3 (Coder, VL post-train variants).
[^minimax]: https://www.minimaxi.com/en — MiniMax M2 — open-weights frontier, 1M ctx, tool-use-native.
[^mcp-spec]: https://modelcontextprotocol.io/specification/2025-06-18 — MCP production spec revision. <!-- TODO: verify revision id -->
[^mcp-registry]: https://github.com/modelcontextprotocol/registry — Anthropic-hosted MCP server registry (2025). <!-- TODO: verify -->
[^a2a]: https://github.com/a2aproject/A2A and https://a2a-protocol.org/ — Linux Foundation Agent2Agent project. <!-- TODO: verify LF transition date -->
[^computer-use]: https://docs.anthropic.com/en/docs/agents-and-tools/computer-use — Anthropic Computer Use, GA mid-2025.
[^constitutional-classifiers]: https://www.anthropic.com/research/constitutional-classifiers — Anthropic Feb 2025.
[^dspy3]: https://dspy.ai/ — DSPy 3.0 (Aug 2025).
[^gepa]: https://arxiv.org/abs/2507.19457 — GEPA Genetic-Pareto prompt optimization. <!-- TODO: verify arxiv id -->
[^swebench]: https://www.anthropic.com/research/swe-bench-sonnet — SWE-bench Verified Aug 2024.
[^re-bench]: https://metr.org/blog/2024-11-22-evaluating-r-d-capabilities-of-llms/ — METR RE-Bench evaluation suite. <!-- TODO: verify exact URL -->
[^terminal-bench]: https://www.tbench.ai/ — Terminal-Bench (Stanford/Anthropic 2024). <!-- TODO: verify -->
[^gaia]: https://huggingface.co/spaces/gaia-benchmark/leaderboard — GAIA general-assistant benchmark (Meta 2023).
[^browsecomp]: https://openai.com/index/browsecomp/ — OpenAI BrowseComp 2025.
[^playwright-trace]: https://playwright.dev/docs/trace-viewer — Playwright Trace Viewer (v1.40+).
[^inspect]: https://inspect.aisi.org.uk/ — UK AISI Inspect AI.
[^promptfoo]: https://www.promptfoo.dev/
[^anthropic-evals]: https://docs.anthropic.com/en/docs/build-with-claude/evals — Anthropic Console Evaluations.
[^openai-evals]: https://platform.openai.com/docs/guides/evals — OpenAI Evals "responses" track.
[^owasp-llm-2025]: https://genai.owasp.org/llm-top-10/ — OWASP Top 10 for LLM Applications 2025 (published Nov 2024).
[^owasp-redteam]: https://genai.owasp.org/resource/llm-and-generative-ai-security-project-charter/ — OWASP GenAI Security Project (Red Teaming Guide, Solutions Landscape).
[^nist-218]: https://csrc.nist.gov/publications/detail/sp/800-218/final — NIST SP 800-218 v1.1 (Feb 2022).
[^nist-218a]: https://csrc.nist.gov/pubs/sp/800/218/a/final — NIST SP 800-218A (Generative AI SSDF, 2024).
[^nist-600-1]: https://doi.org/10.6028/NIST.AI.600-1 — NIST AI 600-1 (July 26, 2024).
[^eu-ai-act]: https://artificialintelligenceact.eu/implementation-timeline/ — EU AI Act timeline. <!-- TODO: verify exact dates -->
[^slsa-v1]: https://slsa.dev/spec/v1.0/levels — SLSA v1.0 Build/Source tracks.
[^in-toto]: https://github.com/in-toto/attestation and https://github.com/in-toto/attestation/blob/main/spec/v1/predicates.md — in-toto attestation v1.0 + predicate types.
[^sigstore]: https://docs.sigstore.dev/ — Sigstore (cosign + Rekor + Fulcio).
[^cisa-attestation]: https://www.cisa.gov/secure-software-attestation-form — CISA Secure Software Self-Attestation Form (Mar 2024).
[^scorecard]: https://github.com/ossf/scorecard — OpenSSF Scorecard.
[^spdx-3]: https://spdx.dev/spdx-3-0-released/ and https://spdx.github.io/spdx-spec/v3.0.1/model/AI/AI/ — SPDX 3.0.1 AI profile.
[^cyclonedx-mlbom]: https://cyclonedx.org/capabilities/mlbom/ — CycloneDX 1.6 ML-BOM.
[^cisa-vex]: https://www.cisa.gov/sites/default/files/2023-04/minimum-requirements-for-vex-508c.pdf — CISA VEX minimum requirements.
[^c2pa]: https://c2pa.org/specifications/specifications/2.1/index.html — C2PA Content Credentials v2.1.
[^synthid]: https://huggingface.co/blog/synthid-text — Google SynthID-Text via HuggingFace Transformers (Oct 2024).
[^milkdown-crepe]: https://milkdown.dev/docs/guide/crepe and https://github.com/Milkdown/milkdown — Milkdown 7 + `@milkdown/crepe`.
[^cm6]: https://codemirror.net/ — CodeMirror 6.
[^loro]: https://loro.dev/ — Loro CRDT (2024 entrant).
[^tldraw]: https://github.com/tldraw/tldraw and https://github.com/tldraw/ai-module — Tldraw v3.x + @tldraw/ai. <!-- TODO: verify versions -->
[^d2]: https://d2lang.com/
[^mermaid-11]: https://mermaid.js.org/news/announcements.html — Mermaid 11.x (architecture/packet/block diagrams).
[^late-chunking]: https://arxiv.org/abs/2409.04701 — Jina AI late-chunking 2024.
[^graphrag]: https://github.com/microsoft/graphrag and https://arxiv.org/abs/2404.16130 — Microsoft GraphRAG.
[^colbert]: https://arxiv.org/abs/2112.01488 — ColBERT v2.
[^self-rag]: https://arxiv.org/abs/2310.11511 — Self-RAG (Asai 2024).
[^crag]: https://arxiv.org/abs/2401.15884 — Corrective-RAG (Yan 2024).
[^sqlite-vec]: https://github.com/asg017/sqlite-vec — sqlite-vec (production-stable 2024).
[^otel-genai]: https://opentelemetry.io/docs/specs/semconv/gen-ai/ — OpenTelemetry GenAI Semantic Conventions.
[^lean4]: https://leanprover-community.github.io/ — Lean 4 community.
[^tla]: https://lamport.azurewebsites.net/tla/tla.html — TLA+.
[^e2b]: https://e2b.dev/ — E2B sandboxes.
[^modal]: https://modal.com/ — Modal sandboxes.
[^pyrit]: https://github.com/Azure/PyRIT — Microsoft PyRIT.
[^petri]: https://github.com/safety-research/petri — Anthropic Petri. <!-- TODO: verify repo location -->
[^ai-scientist]: https://github.com/SakanaAI/AI-Scientist — Sakana AI Scientist.
[^dp]: https://research.google/pubs/auditing-differentially-private-machine-learning/ — Google DP-Auditing 2024.
[^reproducible-builds]: https://reproducible-builds.org/
[^uv]: https://docs.astral.sh/uv/
[^bun]: https://bun.sh/
[^biome]: https://biomejs.dev/
[^coderabbit]: https://www.coderabbit.ai/
[^greptile]: https://greptile.com/
