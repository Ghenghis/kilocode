---
templateId: model-card
templateName: "AI Model Card (Mitchell et al.)"
templateVersion: "1.0.0"
templateDescription: "Model card per Mitchell et al. 2019 — Model Details, Intended Use, Factors, Metrics, Eval Data, Training Data, Ethical Considerations, Caveats. The disclosure standard for ML models."
templateCategory: ml
templateRubric: model-card-rubric-v1
author: "KiloCode Studio"
---

# Model Card: {{MODEL_NAME}}

> **Source**: Mitchell, Wu, Zaldivar, Barnes, Vasserman, Hutchinson,
> Spitzer, Raji, & Gebru (2019). *Model Cards for Model Reporting*. FAT*.
> This template implements the canonical 8 sections from that paper plus
> the additional disclosure sections requested by the EU AI Act and
> NIST AI RMF.
>
> **Audience**: model developers, downstream integrators, regulators,
> auditors, end-users, and people *affected by* the model's use. The card
> should be intelligible to all five audiences, not optimised for one.

## 1. Model details

### Identity

| Field | Value |
|---|---|
| Model name | <!-- ai-fill --> |
| Version | <!-- ai-fill: semver or hash --> |
| Date of release | <!-- ai-fill --> |
| License | <!-- ai-fill: SPDX identifier — e.g., Apache-2.0, MIT, custom EULA --> |
| Citation | <!-- ai-fill: BibTeX entry or "Cite as: …" --> |
| Contact | <!-- ai-fill: email + on-call rotation for safety/abuse reports --> |
| Owner / steward | <!-- ai-fill: org + team --> |
| Repository | <!-- ai-fill: URL --> |
| Weights URL | <!-- ai-fill: model registry / HF repo / private store --> |

### Architecture

<!-- ai-fill: 2-3 paragraphs covering:
- Architecture family (transformer-decoder, encoder-decoder, mixture-of-experts, classical ML, retrieval-augmented, etc.).
- Parameter count, layer count, attention head count, hidden size, vocabulary size, context window.
- Notable architectural choices (RoPE, MoE routing, sliding-window attention) and why.
- Inputs accepted (text, image, audio, modalities) and outputs produced (token stream, JSON, embeddings, classes).
- Compute footprint at inference (typical/peak GPU memory, latency p50/p95).
- Quantisation options (fp16/bf16/int8/int4) and their trade-offs. -->

### Training compute

| Item | Value |
|---|---|
| Training accelerator | <!-- ai-fill: e.g., 512× H100 80GB --> |
| Training duration | <!-- ai-fill --> |
| Total training compute | <!-- ai-fill: FLOPs --> |
| Approx. carbon footprint | <!-- ai-fill: tCO₂e — methodology link --> |
| Energy source | <!-- ai-fill: grid mix at training site --> |

## 2. Intended use

### Primary intended uses

<!-- ai-fill: bulleted list of the *first-class* use cases the model is built for. Each bullet: "Use case — description — typical caller — expected input/output shape." Be specific. "Customer support chat for B2B SaaS, English only, 8 turns max, max 2,000 input tokens, JSON-structured output for actions." -->

- <!-- ai-fill -->
- <!-- ai-fill -->
- <!-- ai-fill -->

### Primary intended users

<!-- ai-fill: who calls the model. End users? Application developers? Researchers? Regulators? Each comes with different documentation needs and risk profile. -->

### Out-of-scope use cases

<!-- ai-fill: explicit list of uses the model is *not* fit for. This is the most important sub-section of §2 — the model card's strongest legal and ethical hedge. Examples:

- Medical diagnosis or treatment planning.
- Hiring decisions, lending decisions, or other consequential automated decisions about a person.
- Generation of content depicting minors in harmful contexts.
- Legal advice or contract drafting where the user is a non-lawyer.
- Facial recognition for surveillance.

Each item should explain *why* the model is unfit (e.g., "training data does not include MedQA-style cases; eval shows high false-confidence on clinical prompts"). -->

## 3. Factors

> "Factors" are the dimensions along which model performance is expected
> to vary materially. Naming factors lets us evaluate by slice rather
> than by aggregate metric.

### Relevant factors

<!-- ai-fill: enumerate the dimensions that meaningfully affect performance and the values within each:

- **Demographic groups**: age, gender, ethnicity, language, locale.
- **Instrumentation**: device type, microphone quality, lighting condition.
- **Environment**: noise, occlusion, latency budget.
- **Domain shift**: training corpus epoch vs deployment time, jurisdiction shift.
- **User intent**: benign vs adversarial, expert vs novice.

For each factor, name (a) why it matters, (b) the values you evaluate over, (c) any sub-population whose evaluation set is small enough that statistical significance is borderline. -->

| Factor | Values evaluated | Notes |
|---|---|---|
| Language | en, es, fr, de, ja, zh, ar | <!-- ai-fill: e.g., ar evaluated on a 1k sample only --> |
| Input length | <512, 512–2k, 2k–8k, 8k–32k, >32k tokens | <!-- ai-fill --> |
| Domain | general, code, finance, medical | <!-- ai-fill: medical out-of-scope per §2 --> |
| Adversarial input | benign, prompt-injection, jailbreak | <!-- ai-fill --> |

### Evaluation factors

<!-- ai-fill: which factors did we actually evaluate over (vs which we identified but did not), and why. Be honest about gaps. -->

## 4. Metrics

### Headline metrics

<!-- ai-fill: 3-6 metrics that summarise the model. For each: definition, dataset, value with confidence interval. Avoid leaderboard-only metrics; include a metric that maps to the *user-visible* outcome. -->

| Metric | Definition | Dataset | Value (95% CI) |
|---|---|---|---|
| Exact-match accuracy | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |
| Pass@1 (code) | <!-- ai-fill --> | HumanEval | <!-- ai-fill --> |
| Faithfulness | LLM-as-judge over RAG-grounded factuality | <!-- ai-fill --> | <!-- ai-fill --> |
| Toxicity rate | RealToxicityPrompts | <!-- ai-fill --> | <!-- ai-fill --> |
| Refusal rate (benign) | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |
| Refusal rate (harmful) | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |

### Decision threshold

<!-- ai-fill: if the model produces a probability/score, the threshold(s) we recommend, the rationale, and the trade-off curve (PR/ROC). State whether the threshold is calibrated or raw. -->

### Variation across factors

<!-- ai-fill: per-factor breakdown of headline metrics. Surface disparities. Where a slice is below the aggregate by >5%, name the gap and the mitigation work it triggered. -->

| Factor slice | Metric | Value | Δ vs aggregate |
|---|---|---|---|
| en | accuracy | <!-- ai-fill --> | <!-- ai-fill --> |
| es | accuracy | <!-- ai-fill --> | <!-- ai-fill --> |
| ar | accuracy | <!-- ai-fill --> | <!-- ai-fill --> |
| input ≥ 32k tokens | accuracy | <!-- ai-fill --> | <!-- ai-fill --> |

## 5. Evaluation data

<!-- ai-fill: The datasets used to evaluate. For each:
- Name + citation.
- Size (number of examples, tokens, classes).
- Provenance (how collected, by whom, license).
- Pre-processing and any filtering applied.
- Known biases or coverage gaps.
- Whether held out from training (with the de-duplication procedure described). -->

### Datasets

| Dataset | Size | Provenance | License | Held out? |
|---|---|---|---|---|
| <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |
| <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |
| <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |

### Motivation

<!-- ai-fill: why these datasets and not others. What populations / use cases they cover, what they don't. -->

## 6. Training data

<!-- ai-fill: This is where transparency expectations are highest and operational realities push back. Be as specific as your IP and contractual obligations allow. Cover:

- Data sources (web crawl, books, code, licensed feeds, internal logs).
- Approximate token / example counts per source.
- Date cutoff.
- Deduplication procedure.
- Licensing / consent posture per source.
- PII removal procedures and residual risk.
- Filters applied (toxicity, copyright, malware, NSFW, low-quality).
- Languages and their proportions.
- Notable exclusions (e.g., "GitHub repos with 'noai' in their training-config opt-out file"). -->

### Sources

| Source | Approx. share | Cutoff | Licensing posture |
|---|---|---|---|
| Public web crawl | <!-- ai-fill: % --> | <!-- ai-fill --> | <!-- ai-fill --> |
| Code repositories | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |
| Licensed corpora | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |
| Books | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |
| Synthetic | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |

### Filtering and deduplication

<!-- ai-fill: name the filters in order of application; describe near-duplicate removal (MinHash threshold, n-gram size); note false-positive trade-offs. -->

### Known coverage gaps and biases

<!-- ai-fill: list 3-5 known gaps that affect downstream performance. Examples:

- Underrepresentation of African and Indigenous languages.
- Web crawl skews male, English, and urban.
- Code data is dominated by JavaScript/Python; system languages (Rust, Go) are under-represented.

Pair each gap with the §4 metric variation it most likely explains. -->

## 7. Ethical considerations

<!-- ai-fill: A frank discussion. The model card is the right surface for this; downstream integrators rely on it. Cover at minimum:

- **Foreseeable harms**: misinformation, bias amplification, privacy leakage, copyright concerns, automation of consequential decisions, manipulation, dual-use risk (cybersec, bio, chem, CBRN).
- **Mitigations applied**: RLHF, content filtering, refusal training, output watermarking, rate-limiting on safety-relevant endpoints, KYC for elevated quotas.
- **Residual risk**: what we know remains harmful even after mitigation.
- **Affected stakeholders**: end users, third parties, communities represented in training data, communities *not* represented (downstream invisibility).
- **Power asymmetries**: who can deploy this vs who is subject to its outputs.
- **Reversibility**: when an output causes harm, can the user/affected party seek redress? -->

### Foreseeable harms

| Harm | Likelihood | Severity | Mitigation | Residual risk |
|---|---|---|---|---|
| <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |

### Misuse and adversarial use

<!-- ai-fill: known jailbreak surfaces, prompt-injection susceptibility, evasion attacks on classifiers. Reference any red-team report. -->

### Reporting harm

<!-- ai-fill: how a person harmed by the model's output (or affected by it without using it) can report. Specify the channel, expected response time, and whether they have a right to opt out / be forgotten. -->

## 8. Caveats and recommendations

<!-- ai-fill: A short list of things a downstream user should know before depending on this model. Examples:

- "The model has not been evaluated on inputs longer than 32k tokens; performance beyond this is unknown."
- "The model does not have access to information about events after {{TRAINING_CUTOFF}}; combine with retrieval for time-sensitive use."
- "Outputs are non-deterministic at temperature > 0; use seeded sampling for reproducibility."
- "Numeric reasoning beyond 4-digit arithmetic is unreliable; prefer a calculator tool."
- "We strongly recommend human review for any output used in a consequential decision (hiring, lending, medical, legal)." -->

### Recommendations for downstream developers

- <!-- ai-fill -->
- <!-- ai-fill -->
- <!-- ai-fill -->

### Recommendations for end users

- <!-- ai-fill -->
- <!-- ai-fill -->

## 9. Compliance disclosures

> Required by NIST AI RMF and EU AI Act-aligned governance.

| Item | Status |
|---|---|
| EU AI Act risk classification | <!-- ai-fill: minimal / limited / high / unacceptable + rationale --> |
| NIST AI RMF profile applied | <!-- ai-fill --> |
| Conformity assessment / external audit | <!-- ai-fill: completed / in progress / n/a --> |
| Data Protection Impact Assessment (DPIA) | <!-- ai-fill --> |
| Pre-deployment red-team report | <!-- ai-fill: link --> |
| Watermarking / provenance signals emitted | <!-- ai-fill --> |
| Energy and carbon disclosure | <!-- ai-fill --> |

## 10. Versioning and change log

<!-- ai-fill: every release of the card. Each entry: version, date, what changed in the model, what changed in the card. The change log is the single most useful artefact for an integrator who returned after 12 months. -->

| Version | Date | Model change | Card change |
|---|---|---|---|
| 1.0.0 | <!-- ai-fill --> | initial release | initial card |
| 1.0.1 | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |
| 1.1.0 | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |

## 11. References

- Mitchell et al. (2019). Model Cards for Model Reporting. FAT*. <!-- ai-fill: arxiv link -->
- NIST AI RMF 1.0. <!-- ai-fill: link -->
- EU AI Act, Annex IV. <!-- ai-fill: link -->
- Internal red-team report: <!-- ai-fill -->
- Eval datasheets: <!-- ai-fill -->
- Training data datasheet (Gebru et al.): <!-- ai-fill -->

---

> **Reviewer checklist** (cut from the doc before publishing):
> - [ ] Out-of-scope uses are explicit and non-trivial.
> - [ ] Metrics are reported per factor, not just aggregate.
> - [ ] Training-data sources are disclosed at the granularity our IP team allows.
> - [ ] Known harms are named with mitigation *and* residual risk.
> - [ ] Compliance disclosures (§9) are filled or marked n/a with rationale.
> - [ ] A non-technical reader can understand §1, §2, and §8.
