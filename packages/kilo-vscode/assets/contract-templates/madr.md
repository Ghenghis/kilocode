---
templateId: madr
templateName: "Markdown Any Decision Record (MADR 4.0)"
templateVersion: "1.0.0"
templateDescription: "MADR 4.0 — the structured decision-record format with Drivers, Considered Options, Decision Outcome, Consequences, and per-option Pros/Cons."
templateCategory: architecture
templateRubric: madr-rubric-v1
author: "KiloCode Studio"
status: proposed
date: 2026-01-15
deciders: []
consulted: []
informed: []
---

# {{SHORT_TITLE_IMPERATIVE}}

> **MADR vs Nygard ADR**: Use MADR when the option-comparison itself is the
> heart of the decision. Use the simpler Nygard ADR (`adr.md`) when the
> decision is mostly about declaring direction with light alternatives.
>
> **File naming**: `docs/decisions/NNNN-kebab-case-title.md` per the MADR
> 4.0 convention. Numbers are monotonic; titles are verb phrases.

## Context and problem statement

<!-- ai-fill: 2-3 short paragraphs framing the decision. Explain (a) what is true today, (b) what trigger created the need for a decision, (c) the constraints we cannot move (deadline, budget, headcount, regulatory). Phrase the question itself as the closing sentence — e.g., "Which message broker should we adopt for cross-service eventing?" — so the rest of the doc reads as the answer. -->

## Decision drivers

<!-- ai-fill: 4-8 bullets. Each driver is the *thing the decision must satisfy* — quality attributes, organisational constraints, or business outcomes. Drivers should be testable. Avoid platitudes ("must be reliable") in favour of concrete thresholds ("p99 read latency under 50ms at 5k QPS"). -->

- <!-- ai-fill: e.g., p99 read latency < 50ms at 5k QPS -->
- <!-- ai-fill: e.g., on-call burden ≤ 1 SRE hour/week steady-state -->
- <!-- ai-fill: e.g., open-source license compatible with our distribution -->
- <!-- ai-fill: e.g., supports our existing OpenTelemetry stack out of the box -->
- <!-- ai-fill: e.g., total cost of ownership < $X / month at projected V1 traffic -->

## Considered options

<!-- ai-fill: 2-5 options. Be honest — include the realistic candidates, not strawmen. The "do nothing" / status-quo option is worth listing if abandoning the decision is plausible. -->

- **Option 1**: <!-- ai-fill: name + 1-line summary -->
- **Option 2**: <!-- ai-fill: name + 1-line summary -->
- **Option 3**: <!-- ai-fill: name + 1-line summary -->
- **Option 4 (status quo)**: <!-- ai-fill: 1-line description -->

## Decision outcome

**Chosen option**: "<!-- ai-fill: name of the chosen option -->"

**Rationale** (in one or two sentences):
<!-- ai-fill: The single most important reason this option wins. Tie back to a specific decision driver. Example: "Option 2 (NATS JetStream) is the only candidate that meets the 50ms p99 driver while keeping the on-call burden under a single SRE-hour/week, per the bench results in §Pros & Cons." -->

### Consequences

<!-- ai-fill: List positive, negative, and follow-up consequences. The negative-consequence list is the *price we are agreeing to pay willingly*. Future maintainers will thank you for naming it explicitly. -->

- ✅ **Positive**: <!-- ai-fill -->
- ✅ **Positive**: <!-- ai-fill -->
- ⚠️ **Negative**: <!-- ai-fill: the non-trivial cost we are accepting -->
- ⚠️ **Negative**: <!-- ai-fill -->
- 🔄 **Follow-up**: <!-- ai-fill: ADR / runbook / training that this decision creates -->

### Confirmation

<!-- ai-fill: How will we *know* this decision is working? Name the metric, the dashboard, and the threshold at which we would re-open the decision. Without this, an MADR is a wish. -->

- **Metric**: <!-- ai-fill -->
- **Threshold for revisiting**: <!-- ai-fill: e.g., "if p99 exceeds 80ms for 7 days, re-open with a new MADR" -->
- **Dashboard / probe**: <!-- ai-fill -->

## Pros and cons of the options

> Repeat one sub-section per option from the Considered options list. Keep
> the structure consistent so reviewers can compare options eye-to-eye.

### Option 1 — {{NAME}}

<!-- ai-fill: 2-3 sentences describing what this option is and the operational shape (managed service? self-hosted? library?). -->

- ✅ <!-- ai-fill: a strength tied to a decision driver -->
- ✅ <!-- ai-fill -->
- ❌ <!-- ai-fill: a weakness tied to a decision driver -->
- ❌ <!-- ai-fill -->
- 🔬 **Evidence**: <!-- ai-fill: link to a benchmark, prototype, or production case study -->

### Option 2 — {{NAME}}

(Same shape.)

- ✅ <!-- ai-fill -->
- ✅ <!-- ai-fill -->
- ❌ <!-- ai-fill -->
- ❌ <!-- ai-fill -->
- 🔬 **Evidence**: <!-- ai-fill -->

### Option 3 — {{NAME}}

(Same shape.)

- ✅ <!-- ai-fill -->
- ❌ <!-- ai-fill -->
- 🔬 **Evidence**: <!-- ai-fill -->

### Option 4 — Status quo

<!-- ai-fill: What happens if we make no change. Often the right baseline because it makes the *cost of action* visible. -->

- ✅ Zero migration cost.
- ✅ Familiar to the team.
- ❌ <!-- ai-fill: the failure mode that motivated this decision in the first place -->
- ❌ <!-- ai-fill: the cost we keep paying -->

## More information

<!-- ai-fill: Links to RFCs, prototype branches, vendor contracts, benchmark notebooks, and prior or related ADRs/MADRs. The MADR 4.0 spec recommends listing the participants of the decision here as well. -->

- **Related decisions**: <!-- ai-fill: e.g., supersedes ADR-0017; depends on ADR-0023 -->
- **References**: <!-- ai-fill -->
- **Discussion thread**: <!-- ai-fill: link to slack/RFC -->
- **Participants**: deciders {{DECIDERS}}, consulted {{CONSULTED}}, informed {{INFORMED}}.

---

> **MADR 4.0 conventions** (cut from the doc before publishing):
> - Title in imperative mood ("Use X", "Adopt Y") — not a question.
> - Status front-matter: `proposed | rejected | accepted | deprecated | superseded by ADR-NNNN`.
> - Each option must address each decision driver. If an option is silent on a driver, that is itself a finding worth flagging.
> - Decision Outcome's Confirmation field is the new MADR 4.0 contribution — do not skip it.
> - When superseding, append `superseded-by` to the front-matter and never edit the body of the old record.

## Worked example (delete before publishing)

A complete MADR for a real-shaped decision, to anchor the shape:

> ### Use NATS JetStream as primary message broker
>
> #### Context and problem statement
> Our event bus today is a single-region Kafka cluster managed by the
> platform team. Two new product surfaces (notifications, audit) need
> ordered per-tenant streams with sub-50ms p99 publish latency. The
> Kafka cluster runs at 70% headroom and the platform team has signalled
> they cannot onboard another high-throughput tenant for 6 months. Which
> message broker should we adopt for the new surfaces?
>
> #### Decision drivers
> - p99 publish latency < 50ms at 5,000 msgs/sec per tenant.
> - On-call burden ≤ 1 SRE-hour/week steady-state for the new surface.
> - Open-source license compatible with our distribution model.
> - Native support for OpenTelemetry without a sidecar.
> - 6-month time-to-stability — slipping into Q4 is unacceptable.
>
> #### Considered options
> - **Kafka (existing cluster)** — onboard onto the existing cluster.
> - **NATS JetStream (new)** — stand up a 3-node cluster.
> - **Redis Streams (new)** — single-node + replica.
> - **Status quo (do nothing)** — defer the new surfaces.
>
> #### Decision outcome
> **Chosen option**: "NATS JetStream (new)".
> **Rationale**: It is the only candidate that meets the 50ms p99 driver
> while keeping the on-call burden under one SRE-hour/week per the bench
> results in §Pros & Cons.
>
> ##### Consequences
> - ✅ Hits all five decision drivers.
> - ✅ Reduces blast radius — broker failures do not cascade into Kafka.
> - ⚠️ Adds a second broker the team must learn to operate.
> - ⚠️ Opens a new monitoring + alerting surface; we will need a runbook.
> - 🔄 Follow-up: ADR-0042 — JetStream multi-region replication policy.
>
> ##### Confirmation
> - **Metric**: `notifications.publish.p99_ms`.
> - **Threshold for revisiting**: if p99 exceeds 80ms for 7 days, re-open.
> - **Dashboard**: <link>

## Differences from Nygard ADRs

| Field | Nygard ADR | MADR 4.0 |
|---|---|---|
| Drivers | Implicit in "Context" | Explicit list — must be testable |
| Options | One sentence each | Per-option pros/cons section |
| Confirmation | Implicit | Explicit metric + revisit threshold |
| Front-matter | Optional | Required (status, deciders) |
| File suffix | `.md` (verb-phrase title) | `.md` (verb-phrase title) |
| Numbering | Monotonic, never reused | Same |

If you only ever need to declare a direction with light alternatives,
Nygard's 4-section ADR is the right call (see `adr.md`). If the
*comparison itself* is the heart of the decision, MADR 4.0 buys you
real value through Pros & Cons + Confirmation.

## Tooling

The `log4brains` and `adr-tools` CLIs both speak MADR. `log4brains` adds
a static-site generator that publishes the decision log as a navigable
website, which is helpful once the count exceeds ~30 records.

## When to write a new MADR vs. amend

| Situation | Action |
|---|---|
| The decision still stands, but a confirmation metric needs updating | Amend the original record (note the date in §More Information). |
| The decision is being narrowed (e.g., applies only to one service) | Amend with a Scope subsection. |
| The decision is reversed | Write a new MADR with `superseded-by` linking to the old one; do not edit the old body. |
| The drivers have shifted enough that the *same* option might lose | Write a new MADR even if the conclusion is the same — the drivers are part of the record. |

## Reviewer rubric (cut before publishing)

- [ ] Drivers are testable (quantified or referenceable).
- [ ] Each option addresses each driver — silence is a flagged finding.
- [ ] Pros & Cons cite evidence (link to a benchmark, prototype, or case study).
- [ ] Decision Outcome's Confirmation field names a metric *and* a revisit threshold.
- [ ] Status front-matter matches the current state.
- [ ] Title is an imperative verb phrase, not a question.
