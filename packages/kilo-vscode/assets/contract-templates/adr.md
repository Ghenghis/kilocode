---
templateId: adr
templateName: "Architecture Decision Record (Nygard)"
templateVersion: "1.0.0"
templateDescription: "Michael Nygard's classic 4-section ADR: Status, Context, Decision, Consequences. The decision-record format that became the industry default."
templateCategory: architecture
templateRubric: adr-rubric-v1
author: "KiloCode Studio"
---

# ADR-{{NUMBER}}: {{SHORT_TITLE_VERB_PHRASE}}

> **File naming**: `adr/NNNN-kebab-case-title.md`. Numbers are monotonically
> assigned and never reused. Once an ADR is **Accepted**, it is immutable;
> change a decision by writing a *new* ADR that **Supersedes** the old one.

| Field | Value |
|---|---|
| Number | <!-- ai-fill: e.g., 0042 — zero-padded to 4 digits --> |
| Title | <!-- ai-fill: short verb phrase, e.g., "Use D2 for system diagrams" — never a question --> |
| Date | <!-- ai-fill: ISO date of the decision --> |
| Author | <!-- ai-fill: name + team --> |
| Reviewers | <!-- ai-fill: 2-4 names: tech lead, on-call SRE, security, product --> |
| Tags | <!-- ai-fill: e.g., `frontend`, `database`, `observability` --> |

## Status

<!-- ai-fill: Exactly one of:
  - **Proposed** — under review, not yet adopted.
  - **Accepted** — adopted; the team is bound by this decision.
  - **Rejected** — considered and decided against.
  - **Deprecated** — was Accepted; no longer applies but old code may still reflect it.
  - **Superseded by ADR-NNNN** — replaced by a later record.

Add a one-line note when the status changes and the date. Status history is preserved by always appending, never editing. -->

**Status**: Proposed
**Status history**:
- 2026-01-15 — Proposed by {{AUTHOR}}.
- (future) Accepted | Rejected | Superseded by ADR-XXXX

## Context

<!-- ai-fill: 2-4 paragraphs. Describe the forces at play — technical, organisational, business — that motivate this decision. The context section is *value-neutral*: anyone reading it should agree on the facts even if they disagree with the eventual decision.

Cover:
- The state of the system today and the trigger that surfaced this question.
- The constraints (latency budgets, cost ceilings, headcount, deadlines, regulatory).
- The non-negotiables (existing contracts, dependencies that cannot move).
- What we have already learned from prototypes, RFCs, or production incidents.

Resist the temptation to argue for the decision here. Describe the forces; defer the verdict to the Decision section. -->

### Forces

<!-- ai-fill: A bulleted list of the competing concerns. Make the trade-offs visible — readers should see *why this is a hard call*, not why the answer is obvious. Examples:

- We need sub-200ms p95 read latency. (perf)
- We need write availability during a region failover. (availability)
- The team has 1.5 SREs and limited capacity to operate a new datastore. (ops)
- Our existing analytics pipeline assumes the source is Postgres-shaped. (compatibility)
- A 12-month vendor commitment is the procurement reality. (lock-in / contracts) -->

### Considered alternatives

<!-- ai-fill: Brief — Nygard ADRs do *not* enumerate alternatives in the depth that MADR does. List the 2-4 options seriously considered, one line each. Keep the deep comparison in the Decision section. -->

1. **Option A — <!-- ai-fill -->**: <!-- ai-fill: 1 sentence -->
2. **Option B — <!-- ai-fill -->**: <!-- ai-fill: 1 sentence -->
3. **Option C — Status quo (do nothing)**: <!-- ai-fill: 1 sentence on what failure looks like if we keep doing this -->

## Decision

<!-- ai-fill: One short paragraph stating the decision in active voice and the present tense. The classic Nygard formula: "We will adopt X for Y." Then 2-4 paragraphs explaining *why this option, why now, and why not the alternatives*.

Be opinionated. ADRs are not whitepapers; they are commitments. A reader should finish this section knowing exactly what we are doing and exactly which arguments persuaded the author.

End the Decision section with the *one sentence the team is going to repeat* when someone asks "why did we do it this way?" That sentence is the value of the ADR. -->

**We will**: <!-- ai-fill: e.g., "adopt PostgreSQL with logical replication for our primary OLTP store and offload analytical queries to a daily Snowflake export." -->

### Why

<!-- ai-fill: Walk through the reasoning. Lean on the forces named in Context. Cite benchmarks, prototypes, or incident retros. -->

### Why not the alternatives

<!-- ai-fill: One paragraph (or one bullet) per rejected option, naming the specific force or constraint that disqualified it. Avoid strawmen — represent each alternative at its strongest. -->

## Consequences

<!-- ai-fill: List the positive, negative, and neutral consequences of this decision. The honesty of this section is what makes ADRs useful 2 years later when someone asks "why did we accept that operational burden?".

Group as:
- **Positive** — what becomes easier or faster.
- **Negative** — what becomes harder, more expensive, or riskier. Include the *cost we are paying willingly*.
- **Neutral** — second-order effects that are neither wins nor losses but worth noting (e.g., "we now have two query languages").
- **Follow-ups** — work items, ADRs, runbooks, or trainings this decision creates. -->

### Positive

- <!-- ai-fill -->
- <!-- ai-fill -->
- <!-- ai-fill -->

### Negative

- <!-- ai-fill: e.g., "Operating Postgres logical replication adds an on-call learning-curve cost; estimated 2 weeks for an SRE to become primary on-call." -->
- <!-- ai-fill -->
- <!-- ai-fill -->

### Neutral

- <!-- ai-fill -->
- <!-- ai-fill -->

### Follow-ups

- [ ] <!-- ai-fill: e.g., write runbook for failover --> · owner: <!-- ai-fill --> · by: <!-- ai-fill -->
- [ ] <!-- ai-fill: e.g., update onboarding doc --> · owner: <!-- ai-fill --> · by: <!-- ai-fill -->
- [ ] <!-- ai-fill: e.g., follow-up ADR on backup retention --> · owner: <!-- ai-fill --> · by: <!-- ai-fill -->

## References

<!-- ai-fill: Links to: prior ADRs (especially the one this might supersede), RFCs, prototype branches, benchmark gists, vendor contracts, incident post-mortems, and external articles. Use Pandoc-style numbered footnotes if you want diff-friendliness. -->

- [^1]: <!-- ai-fill: Title — URL — accessed YYYY-MM-DD -->
- [^2]: <!-- ai-fill -->
- [^3]: <!-- ai-fill -->

---

> **Editorial conventions**:
> - Keep an ADR to one printed page when possible. If you need 4 pages of analysis, you probably want a *design doc* with an ADR pointing at it.
> - Do not edit Accepted ADRs. Write a new one with status **Supersedes ADR-NNNN**.
> - Title is a verb phrase — "Use X", "Adopt Y", "Switch from A to B" — never a question.
> - The audience is a future engineer onboarding to your team; explain enough that they can reconstruct the trade-off without you in the room.

## Worked example (delete before publishing)

The example below shows what a finished ADR looks like — copy-paste shape,
not content. The four canonical Nygard sections are the same; only the
specifics change.

> **ADR-0007: Use Postgres logical replication for cross-region eventing**
>
> **Status**: Accepted (2026-02-14, Eng Council)
>
> **Context**: We run a single Postgres primary in us-east-1 and serve
> eu-west-1 read traffic from physical replicas with ~1.2s lag at p99.
> Marketing's new EU campaign needs sub-200ms p99 reads in EU. We have a
> 12-month commitment to the current Postgres vendor and the team has 1.5
> SREs. The on-call burden of operating two primaries is a known cost.
>
> **Decision**: We will adopt Postgres 16 logical replication to feed an
> in-region writable shadow of the primary's `events` schema. The shadow
> is read-only at the application layer, but logical replication keeps
> p99 lag under 80ms in benchmarks at projected V1 traffic.
>
> **Consequences**:
> - **Positive**: meets the 200ms p99 EU read target; preserves the single
>   logical primary; no application changes beyond a region-aware DSN.
> - **Negative**: adds a logical-replication on-call surface; replica slot
>   bloat is a real risk that requires monitoring; we accept ~6h of
>   recovery time on a publication breakage.
> - **Follow-ups**: ADR-0008 (replication slot monitoring), runbook
>   §5 "logical replication recovery", training doc on `pg_logical_*`.

## Tooling notes

When ADRs are stored under `docs/adr/`, the [adr-tools] CLI can
auto-generate the next number, supersede references, and a TOC:

```bash
adr new "Use D2 for system diagrams"
adr supersedes 7 -t "Use NATS JetStream instead of Kafka"
```

Most teams outgrow `adr-tools` once they have a reviewable PR template;
the *shape* is the point, not the tooling.

[adr-tools]: https://github.com/npryce/adr-tools

## Frequently asked questions

**Q: When do I write an ADR vs a design doc?**
A: Write an ADR for a *single decision*. Write a design doc when the
proposal touches multiple decisions that interact. The ADR can reference
the design doc and link to the specific section that motivates it.

**Q: How granular should an ADR be?**
A: One ADR per *durable* decision. "Use TypeScript" is durable. "Use
TypeScript 5.4 specifically" is not. The granularity test: would a future
engineer asking "why did we do it this way?" be helped by reading this
record alone? If yes, it deserves an ADR.

**Q: My decision is reversible. Do I still need an ADR?**
A: Yes — and the *reversibility* is part of the consequences. The future
maintainer needs to know it is reversible *and* the reversal cost.

**Q: Who can supersede an ADR?**
A: The same review surface that approved the original. If your ADRs are
PR-reviewed by the eng council, supersedes go through the same review.
This is what keeps the historical record honest.
