# 39 — Incident Runbook

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

## Purpose

Doc 12 covers generic disaster recovery. Doc 24 catalogs `Fx.y` lookups. Doc 27 hardens secrets and supply chain. This doc is the **operational glue**: when something has gone wrong right now, who does what, in what order, with what messaging, and what must be true before the incident can be closed.

This is the runbook a human (or agent) opens at 02:00 when an alert fires. It assumes you have read 12, 24, and 27 once.

---

## Incident severities

| Severity | Definition | Examples | Response SLA |
|---|---|---|---|
| **SEV-0** | Critical. Data loss, public secret leak, complete outage. ABSOLUTE RULE violated. | Push to `main` landed on origin; secret rotated-too-late; backup mirror unrecoverable while mutation in flight; production hub down. | Commander assigned within 15 min, 24/7 |
| **SEV-1** | High. Service-impacting but not total outage. | One repo's release rolled out broken VSIX; CI pipeline compromised; partial DB restore failed; force-push through protection. | Commander within 30 min business hours, 1 h off-hours |
| **SEV-2** | Medium. Degraded service. Workaround exists. | Non-critical dep yanked from registry; one auth flow regressed; signing infra temporarily unavailable. | Commander within 4 business hours |
| **SEV-3** | Low. Cosmetic / quality. | Typo in release notes; stale docs link; non-load-bearing log warning. | Triaged in normal backlog grooming |

Cross-reference: doc 24 CRITICAL → SEV-0; HIGH → SEV-1; MEDIUM → SEV-2; LOW → SEV-3. Upgrade severity if user impact is worse than per-phase severity suggests.

---

## Incident lifecycle

Six phases. Every incident, regardless of severity, passes through all six.

### 1. DETECT

Signal sources:
- **Monitoring** — hub uptime, build failure, signature mismatch, scheduled task failure (rotation T+72h verifier).
- **Hook log** — pre-push hook (doc 17) blocked a push; CI gate failure; gitleaks finding.
- **Agent verdict** — sub-agent emitted `BLOCK`/`CRITICAL`; Verifier disagreed with Owner (doc 24 FX.5).
- **User report** — internal user, external user, security disclosure, GitHub issue tagged `security`.

Detector opens an incident channel/ticket and pages. Do not begin remediation before TRIAGE assigns a Commander.

### 2. TRIAGE (within 15 min for SEV-0/SEV-1)

- **Assign Incident Commander** (first responder who acknowledges; single-threaded, doesn't debug).
- **Severity-classify**. When in doubt, classify higher.
- **Assemble responders**: Communications Lead, Operations Lead, Subject Expert. SEV-0 needs all four; SEV-2/3 may consolidate.
- **Open evidence dir**: `<EVIDENCE_ROOT>/incidents/<YYYY-MM-DD>_<KIND>_<UTC-timestamp>/`.

### 3. CONTAIN

Goal: stop the bleeding. Not fix it yet.

Common moves:
- **Rotate secret** (doc 27 steps 1-3) — provider dashboard immediately, before file edits.
- **Revoke token** — GitHub PAT, registry token, signing key, deploy key.
- **Revert release** — pull VSIX from marketplace, roll back image tag, redirect CDN.
- **Pause writes** — read-only mode, disable PR merges, stop scheduled mirror sync.
- **Isolate** — take affected runner offline, suspend account, rotate signing keys.

Document every action with timestamp in incident timer.

### 4. ERADICATE

Goal: underlying defect or compromise is gone.

Examples:
- Secret-in-history → history rewrite per doc 27 (only after rotation verified).
- Compromised CI runner → rebuild from clean image, rotate all credentials it had access to.
- Bad release → identify regressing commit, prepare fix-forward or revert PR, stage on non-prod.
- Push-to-main → execute doc 12 §"Recover accidental local main commit" under operator co-signature.

Eradicate produces a written diagnosis sufficient for postmortem §Root cause.

### 5. RECOVER

- Bring service back. Re-enable writes, restore traffic, redeploy verified-good artifact.
- **Verify**: smoke test that would have caught original signal. Monitor green; user confirmed.
- **Communicate**: send "Resolved" status update.
- Do not declare incident closed yet — closure requires LEARN + mandatory follow-ups.

### 6. LEARN (postmortem within 5 business days; SEV-0 within 3)

- Author postmortem.
- Every postmortem produces N action items, each tracked as a feature card per doc 06. PRs link back.
- A postmortem MUST identify at least one **lesson promoted to control** — concrete addition or change to a doc such that the same incident shape is now prevented or detected earlier.

---

## Roles during an incident

| Role | Responsibility | Boundary |
|---|---|---|
| **Incident Commander (IC)** | Owns response. Single decision-maker. Maintains incident timer. Decides severity changes. Calls all-clear. | Does NOT debug or write code; if they want to, they hand off IC first. |
| **Communications Lead** | Drafts status messages. Posts to status page, internal channels, external channels. SEV-0 coordinates with legal/PR. | Does NOT speculate on cause. Quotes only what IC has confirmed. |
| **Operations Lead** | Executes containment + recovery actions. Owns the keyboard for production-touching changes. | Does NOT decide what to do — IC decides; Ops Lead executes and reports. |
| **Subject Expert (SE)** | Deepest knowledge of affected component. Diagnoses root cause, proposes fix. | Reports to IC; does not push fixes without IC approval. |

SEV-0 always has all four roles, distinct people if possible.

---

## Incident timer template

Append-only log. UTC times. Save as `timer.md` in incident evidence dir.

```
# Incident <YYYY-MM-DD>_<KIND> — Timer (UTC)

T+0     : Detected by <signal source>
T+...   : Commander assigned (<name>)
T+...   : Severity classified: SEV-<n>
T+...   : Comms Lead / Ops Lead / SE assembled
T+...   : CONTAIN action: <what was done>
T+...   : Status page initial message posted
T+...   : ERADICATE action: <what was done>
T+...   : Status page update posted
T+...   : RECOVER action: <what was done>
T+...   : Smoke test green (link to CI run)
T+...   : Status page resolved message posted
T+...   : Postmortem doc opened: <path>
T+72h   : Rotation verification scheduled (cred: <name>, verifier task: <id>)
T+...   : Postmortem published; action items filed as cards <id-list>
T+...   : Incident closed by <IC name>
```

Append-only. Corrections go in new lines.

---

## Per-incident-type playbook references

| Incident type | Primary playbook | Secondary |
|---|---|---|
| **Secret leak** | doc 27 §Secret remediation flow | doc 24 F6.4 |
| **Push to main** | doc 24 F7.2 | doc 12 §Recover accidental local main commit |
| **Force-push through protection** | doc 18 §Incident path | doc 12 §Restore from mirror |
| **Backup unrecoverable** | doc 24 F1.1 / F1.2 / F1.4 | doc 12 §Restore from mirror, §Restore from bundle |
| **VSIX bad release** | doc 23 §Rollback workflow | doc 27 §VSIX supply chain |
| **CI compromise / workflow injection** | doc 27 §Workflow injection prevention | doc 24 FX.5; doc 18 |
| **Dependency confusion / lockfile attack** | doc 27 §Lock-file integrity | doc 24 F6.5 |
| **Compromised maintainer** | doc 27 §Compromised-maintainer detection | doc 27 §Audit cadence |
| **Unknown / no match** | doc 24 §How to use (treat CRITICAL, halt) | this doc §Forbidden patterns |

If matches more than one type: secret leak first (rotate), then containment of contaminating channel, then recovery.

---

## Status page templates

### Initial (within 15 min of TRIAGE for SEV-0/SEV-1)

```
[INVESTIGATING] <component> — <one-line user-facing symptom>

We are investigating reports of <symptom> affecting <scope>.
Started: <UTC timestamp>
Impact: <what users will see>
Workaround: <if any; otherwise "None at this time">
Next update: in <30 min for SEV-0; 60 min for SEV-1>
```

### Update (every 30 min for SEV-0, 60 min for SEV-1)

```
[IDENTIFIED | MITIGATING] <component> — <one-line current state>

Update at <UTC timestamp>: <what we know now; what action is in flight>.
Impact: <change since previous>
Workaround: <unchanged | new workaround>
Next update: in <interval>
```

Allowed verbs: "identified", "mitigating", "deploying fix", "monitoring". Forbidden: "should be fixed", "we think it was", "probably", any unverified attribution.

### Resolved

```
[RESOLVED] <component> — <one-line user-facing outcome>

Resolved at <UTC timestamp>. <One sentence on what was done.>
Duration: <T+0 to RECOVER complete>
Affected: <scope>
A postmortem will be published within <3 business days for SEV-0; 5 for SEV-1/2>.
```

For SEV-0 with public-secret-leak: include explicit user-action text. Coordinate with legal before posting.

---

## Postmortem template

File at `artifacts/repo-sync/POSTMORTEM_<YYYY-MM-DD>_<KIND>.md`.

```md
# POSTMORTEM <YYYY-MM-DD>_<KIND>.md

## Summary
<2-4 sentences. What happened, who was affected, how long, what the fix was.>

## Timeline (UTC)
<Copy incident timer verbatim. Do not edit.>

## Root cause
<The single underlying defect. Trace from symptom to defect with evidence (commit SHAs, log lines). No blame language.>

## Detection
<How was this detected? Time from defect-introduced to detected? Was the signal one of the four canonical sources?>

## Containment
<What was done to stop bleeding. Time-to-contain. Trade-offs made.>

## Eradication
<How root cause was removed. Code change SHA, config change, history rewrite range, key rotation IDs. Evidence cause is actually gone.>

## Recovery
<How service was restored. Smoke tests run. User-comms timeline.>

## Impact (users, data, $)
- Users affected: <count or scope>
- Data lost / exposed: <none | description with bounds>
- Financial: <revenue lost, refund obligations, infra cost>
- Reputation / trust: <public disclosure required?>

## Action items (owner / due date)
| # | Action | Owner | Due | Card ID | Status |
|---|---|---|---|---|---|
| 1 | <e.g. Add gitleaks Tier-2 to PR-required checks> | <@handle> | <date> | <card-id> | open |

Every action item is filed as a feature card per doc 06 within 2 business days.

## Lesson promoted to control: <doc-NN §section>
<One paragraph: what generic control, when added to which doc, would have prevented or detected this incident at least one phase earlier. The control MUST be merged into the named doc as part of this postmortem.>
```

---

## Action-item tracking

- Every action item from a postmortem is filed as a **feature card** (`provenance: postmortem-<YYYY-MM-DD>_<KIND>`).
- PR closing a card includes body line: `Closes action item #N from POSTMORTEM_<YYYY-MM-DD>_<KIND>.md`.
- IC reviews postmortem's action-item table at T+30 days and T+90 days. Open past-due item → SEV-2 of its own.
- Postmortem doc is **append-only** for action-item table: each row gets updated `Status` line with date.

---

## Mandatory follow-ups

These are non-skippable. Commander cannot close incident without them.

### Rotation verification at T+72h (any credential incident)

- Scheduled task (created at TRIAGE, registered with `scheduled-tasks`) attempts to use the **old** credential at T+72h.
- Expected: 401 / 403 / `invalid_grant`.
- Output appended to incident evidence as `t+72h_rotation_verification.log`.
- If old credential still works at T+72h: severity upgraded by one level, IC re-paged, ERADICATE re-opens.
- Applies to: API keys, OAuth tokens, GitHub PATs, deploy keys, signing keys, registry tokens, webhook secrets, JWT signing secrets.

### Backup re-verification (after any restore-from-mirror)

- Phase 1 backup-and-restore proof (doc 04) re-run end-to-end on restored repo.
- HEAD SHA, ref count, object count must match pre-incident snapshot.
- New mirror+bundle generated from restored canonical, stored at `<EVIDENCE_ROOT>/<repo>_post_incident_<UTC>/`.

### Branch-protection re-verification (after any bypass usage)

- Re-verify protection config matches doc 18 within 4 hours of RECOVER.
- Diff `gh api repos/<org>/<repo>/branches/<branch>/protection` against canonical config.
- Drift is itself an incident (SEV-2 minimum).
- Bypass event recorded in postmortem with named owner + explicit `re-locked at <UTC>` timestamp.

---

## Forbidden patterns during incidents

- **Silent fix without postmortem.** Severe enough to page → gets a postmortem.
- **Postmortem without action items.** Either incomplete or lesson-to-control not identified.
- **Closing the incident before T+72h verification** for credential incidents.
- **Speculating about cause in user comms.** Causal claims wait for postmortem.
- **Editing the incident timer retroactively.** Append-only.
- **Operator solo on SEV-0 containment.** Containment actions require operator co-signature; IC + Ops Lead are two people.
- **Skipping evidence capture under time pressure.** Even SEV-0 captures evidence as you go.
- **Reusing a rotated credential value.** Old value is dead; "v2" of similar name OK; resurrecting old value is not.

---

## Cross-references

- **doc 12** — Rollback and Disaster Recovery.
- **doc 23** — Provenance and release attestation; VSIX rollback workflow.
- **doc 24** — Failure Mode Library; severity ladder.
- **doc 27** — Secrets and Supply Chain Hardening.

Adjacent:
- doc 06 — Feature card format (action items).
- doc 09 — Validation Gates (Tier 1-4 secret scans).
- doc 17 — Pre-push hook (DETECT signal).
- doc 18 — Branch protection (force-push and bypass cases).

When an incident escalates beyond what this runbook covers, IC files a kit-level review item proposing how this runbook should be extended.
