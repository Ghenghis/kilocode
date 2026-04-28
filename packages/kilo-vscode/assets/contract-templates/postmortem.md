---
templateId: postmortem
templateName: "Blameless Post-mortem"
templateVersion: "1.0.0"
templateDescription: "Blameless incident post-mortem: Summary, Impact, Timeline, Root Cause via 5-Whys, Contributing Factors, Action Items, Lessons Learned."
templateCategory: operations
templateRubric: postmortem-rubric-v1
author: "KiloCode Studio"
---

# Post-mortem: {{INCIDENT_SHORT_TITLE}}

> **Blameless principle**: This document is about the *system* that allowed
> a human to make a mistake, not the human. Names appear only as "the
> on-call engineer", "the deploy author", "the IC". We owe the people
> who touched the incident the dignity of focus on the system.

| Field | Value |
|---|---|
| Incident ID | <!-- ai-fill: e.g., INC-2026-00042 --> |
| Incident commander | <!-- ai-fill --> |
| Author of this doc | <!-- ai-fill --> |
| Reviewers | <!-- ai-fill: tech lead, SRE lead, manager, security if applicable --> |
| Date of incident | <!-- ai-fill: ISO date --> |
| Time detected | <!-- ai-fill: UTC timestamp --> |
| Time mitigated | <!-- ai-fill: UTC timestamp --> |
| Time fully resolved | <!-- ai-fill: UTC timestamp --> |
| Severity | <!-- ai-fill: Sev-1 (revenue critical) / Sev-2 / Sev-3 / Sev-4 --> |
| Customer impact | <!-- ai-fill: e.g., "12% of write requests failed for 47 minutes" --> |
| Status | Draft / Reviewed / Action items in flight / Closed |
| Document version | 1.0 |

> **Distribution**: this document is published to {{INTERNAL_DOC_HUB}} for
> all engineers. A redacted summary is published to the customer-facing
> status page within 5 business days per our incident-comms policy.

## 1. Summary

<!-- ai-fill: 3-4 sentences a busy executive can read in 30 seconds.
- What happened (in customer terms, not internal jargon).
- When it happened and how long it lasted.
- The headline customer impact (number of users / requests / dollars).
- The root cause in one phrase.

Example: "On 2026-04-17 between 14:12 and 14:59 UTC, ~18% of API write requests failed with 503 errors. The root cause was a memory regression in v2.84.0 that triggered OOM kills under peak load. We have rolled back the release, added a memory-saturation pre-deploy gate, and updated the deploy-bake-time policy." -->

## 2. Impact

### Customer-facing impact

<!-- ai-fill:
- Affected surfaces (which APIs, which products, which regions).
- Quantified: percent of requests, number of unique users, number of paying customers, number of tenants.
- Duration of degradation, with the worst-minute number called out.
- Severity from the customer's perspective ("login was unavailable" vs "p95 latency was 2× normal").
- Knock-on effects (queues that backed up, downstream services that throttled, support tickets filed). -->

| Metric | Steady-state | During incident | Delta |
|---|---|---|---|
| API success rate | 99.97% | 81.6% | −18.4 pp |
| p95 write latency | 180ms | 4,200ms | +23× |
| Active users affected | n/a | <!-- ai-fill --> | <!-- ai-fill --> |
| Support tickets filed | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |

### Internal impact

<!-- ai-fill:
- On-call hours consumed.
- Engineers paged.
- Other teams pulled in (security, legal, comms).
- Revenue impact estimate (best/worst case).
- SLO budget burned (with the residual figures). -->

## 3. Timeline

> Times in UTC. Use the *log* facts, not memory. Cross-reference with chat
> archives, dashboards, and audit logs. If a step's timing is uncertain,
> mark it `~` and note the source.

| Time (UTC) | Actor | Event | Source |
|---|---|---|---|
| 13:00 | Deploy bot | Release v2.84.0 begins canary rollout | Deploy log #4521 |
| 13:30 | Deploy bot | Canary completed, full rollout begins | Deploy log #4521 |
| 14:00 | Deploy bot | Full rollout completed | Deploy log #4521 |
| 14:12 | Alerting | `api.error_rate` page fires (1.2%) | PagerDuty INC-42 |
| 14:14 | On-call | Page acked. Begins investigation. | PagerDuty INC-42 |
| 14:18 | On-call | Notes correlation with deploy 14m earlier. | Slack #incidents |
| 14:22 | On-call | Declares Sev-2; pages secondary; opens IC channel | Slack #incidents |
| 14:25 | IC | Status page updated to "investigating" | Status page log |
| 14:33 | On-call | Begins rollback to v2.83.5 | Deploy log #4522 |
| 14:51 | Deploy bot | Rollback completes | Deploy log #4522 |
| 14:59 | Alerting | Error rate returns below 0.05% baseline | Grafana |
| 15:10 | IC | Status page updated to "monitoring" | Status page log |
| 15:30 | IC | Status page updated to "resolved" | Status page log |
| <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |

## 4. Detection

<!-- ai-fill:
- How did we find out? (Synthetic check, customer report, internal alert, social media.)
- Time to detect (TTD) from first user impact.
- Was the alert that fired the *first* signal, or did earlier signals exist that we did not surface?
- If TTD > 5m, why? -->

**TTD (time to detect)**: <!-- ai-fill: e.g., 12m -->
**Detection source**: <!-- ai-fill: e.g., automated alert / customer report / internal dogfood -->
**Was the right alert?**: <!-- ai-fill: yes/no with explanation -->

## 5. Response

<!-- ai-fill:
- Time to ack, time to mitigate, time to resolve.
- Did escalation paths work as designed?
- Did the runbook get us where we needed? Where did it fall short?
- Comms timeline — when was the status page updated, when was the customer email sent? -->

**TTA (time to acknowledge)**: <!-- ai-fill -->
**TTM (time to mitigate)**: <!-- ai-fill -->
**TTR (time to resolve)**: <!-- ai-fill -->

**Things that went well**:
- <!-- ai-fill: e.g., paging caught the regression before customer reports flooded support -->
- <!-- ai-fill -->

**Things that did not go well**:
- <!-- ai-fill: e.g., the runbook for this alert pointed at a stale dashboard -->
- <!-- ai-fill -->

**Things we got lucky on** (would not have helped if conditions were slightly worse):
- <!-- ai-fill: e.g., the bug was OOM, which crashes in obvious ways; if it had been a slow leak we might not have detected for hours -->

## 6. Root cause analysis (5 Whys)

> The 5-Whys exercise is a tool, not a ritual. The goal is to walk past
> the proximate cause to a *systemic* cause that we can fix once. Stop
> when the next "why" lands on something we genuinely can change at the
> system level — usually 3–5 levels deep.

**Q1 — Why did the API return 503s?**
A: The application pods were OOM-killed under peak load.

**Q2 — Why were the pods OOM-killed?**
A: <!-- ai-fill: e.g., v2.84.0 introduced a code path that buffered the entire request body in memory before streaming to the downstream service. -->

**Q3 — Why did this regression reach production?**
A: <!-- ai-fill: e.g., load tests run in CI use a payload size of 4KB; the affected requests in production are 1-10MB. -->

**Q4 — Why did our load tests use the wrong payload size?**
A: <!-- ai-fill: e.g., the load-test payload was set 18 months ago when typical request size was 4KB; it has not been refreshed as customer payload sizes grew. -->

**Q5 — Why was the load-test payload not refreshed?**
A: <!-- ai-fill: e.g., we have no automated re-baselining of load-test fixtures against production telemetry; load-test fixture freshness is owner-less. -->

**Therefore the systemic root cause is**: <!-- ai-fill: a precise, actionable sentence that names the system that needs to change. Not the person, not the line of code — the property of the system. Example: "Our load-test fixtures are not regularly re-baselined against production traffic shape, so regressions that depend on production-scale payloads do not surface in pre-prod." -->

## 7. Contributing factors

> The 5-Whys finds *one* root. Real incidents have multiple contributing
> factors that, taken together, allowed the bad outcome. Name them
> explicitly — fixing only the root often leaves the system fragile.

- **Active failure**: <!-- ai-fill: the deploy that introduced the bug -->
- **Latent condition**: <!-- ai-fill: e.g., autoscaler reacts to CPU only, not to memory pressure -->
- **Defence-in-depth gap**: <!-- ai-fill: e.g., canary stage was 30 minutes, not long enough to see this regression at peak traffic -->
- **Detection gap**: <!-- ai-fill: e.g., memory-saturation alert was scoped to staging, not prod -->
- **Comms gap**: <!-- ai-fill: e.g., status page had no automated update; took 13 minutes for the IC to post manually -->

## 8. What we did *not* do, and why

<!-- ai-fill: Honest list of options we considered during the response and rejected, with rationale. Examples:

- We did not fail-over to the secondary region because metrics indicated the regression would propagate.
- We did not roll forward with a hotfix because rollback was lower-risk and faster.

This section protects future ICs by making the trade-offs visible. -->

## 9. Action items

> Every action item has an owner, a priority, and a target date. Items
> without these three are wishes, not actions. Past post-mortems with
> orphaned action items are how the same incident happens twice.

| ID | Action | Type | Owner | Priority | Due |
|---|---|---|---|---|---|
| AI-1 | <!-- ai-fill: e.g., add memory-saturation pre-deploy gate --> | prevent | <!-- ai-fill --> | P0 | <!-- ai-fill --> |
| AI-2 | <!-- ai-fill: e.g., re-baseline load-test fixtures from prod traffic monthly --> | prevent | <!-- ai-fill --> | P0 | <!-- ai-fill --> |
| AI-3 | <!-- ai-fill: e.g., extend canary bake time to 90m for memory-sensitive services --> | mitigate | <!-- ai-fill --> | P1 | <!-- ai-fill --> |
| AI-4 | <!-- ai-fill: e.g., add memory pressure to autoscaler signal --> | mitigate | <!-- ai-fill --> | P1 | <!-- ai-fill --> |
| AI-5 | <!-- ai-fill: e.g., automate status-page updates from incident channel --> | detect/respond | <!-- ai-fill --> | P2 | <!-- ai-fill --> |
| AI-6 | <!-- ai-fill: e.g., update runbook entry A2 with the dashboard URL fixed --> | respond | <!-- ai-fill --> | P2 | <!-- ai-fill --> |

**Action item types**:
- **prevent**: stops this class of incident from happening again.
- **detect**: surfaces it sooner if it does happen.
- **respond**: shortens TTM/TTR.
- **process**: improves how we run incidents (comms, runbooks, drills).

## 10. Lessons learned

<!-- ai-fill: 3-5 sentences capturing what the team now believes that we did not believe before. These should be transferable beyond this incident — useful when designing the next service, not just this one. -->

- <!-- ai-fill: e.g., "Memory pressure can cascade faster than CPU pressure; our scaling signal needs both." -->
- <!-- ai-fill -->
- <!-- ai-fill -->

## 11. Communication artefacts

- **Status page updates**: <!-- ai-fill: link or paste of each post -->
- **Customer email**: <!-- ai-fill: link to the email we sent (or didn't) -->
- **Internal comms**: <!-- ai-fill: link to the incident channel or summary thread -->
- **Press / regulatory**: <!-- ai-fill: any external notification obligations triggered? GDPR Art. 33 (72h)? -->

## 12. References

- Incident channel: <!-- ai-fill -->
- Dashboards captured at peak: <!-- ai-fill: list -->
- Deploys / commits implicated: <!-- ai-fill -->
- Related runbooks: <!-- ai-fill -->
- Prior post-mortems with overlap: <!-- ai-fill -->

---

> **Reviewer checklist** (cut from the doc before approving):
> - [ ] Summary readable by a non-engineer in 30 seconds.
> - [ ] Timeline grounded in logs, not memory.
> - [ ] 5-Whys reaches a *systemic* root, not a person.
> - [ ] Contributing factors enumerate latent conditions, not just the active failure.
> - [ ] Action items each have owner, priority, and date.
> - [ ] At least one action of each type (prevent, detect, respond) is listed.
> - [ ] Document is blameless throughout — no individual is named in a fault-attributing way.
