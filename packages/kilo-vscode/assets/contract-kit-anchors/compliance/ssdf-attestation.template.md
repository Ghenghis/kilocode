---
templateId: ssdf-attestation
version: 1.0.0
nistSsdfVersion: "1.1"
lastReviewed: <!-- ai-fill: YYYY-MM-DD -->
attestationId: <!-- ai-fill: uuid -->
---

# NIST SSDF (SP 800-218) Self-Attestation

> Source of truth: NIST Special Publication 800-218, *Secure Software Development
> Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software
> Vulnerabilities*. Published 2022-02. Canonical URL:
> <https://csrc.nist.gov/publications/detail/sp/800-218/final>
> PDF: <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf>

This document is the project's structured self-attestation against the four
SSDF practice groups (PO / PS / PW / RV). For each practice, fill in the
`Status`, `Evidence`, and (if applicable) `Compensating Control` fields.

Status values (use exactly one):
- `implemented` — practice is fully in place; cite evidence path(s).
- `compensating` — alternate control achieves equivalent assurance; describe it.
- `n/a` — practice does not apply to this project; explain why in `Notes`.
- `tbd` — not yet decided. Counts against `compliance.ssdf-coverage` gate.

---

## PO — Prepare the Organization

> *Practices to ensure that the organization's people, processes, and technology
> are prepared to perform secure software development at the organization level.*
> — NIST SP 800-218 §2.1

### PO.1 — Define Security Requirements for Software Development

**Description (NIST):** Ensure that security requirements for software
development are known at all times so that they can be taken into account
throughout the SDLC and duplication of effort can be minimized because the
requirements information can be collected once and shared.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PO.2 — Implement Roles and Responsibilities

**Description (NIST):** Ensure that everyone inside and outside of the
organization involved in the SDLC is prepared to perform their SSDF-related
roles and responsibilities throughout the SDLC.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PO.3 — Implement Supporting Toolchains

**Description (NIST):** Use automation to reduce human effort and improve the
accuracy, reproducibility, usability, and comprehensiveness of security
practices throughout the SDLC, as well as provide a way to document and
demonstrate the use of these practices.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PO.4 — Define and Use Criteria for Software Security Checks

**Description (NIST):** Help ensure that the software resulting from the SDLC
meets the organization's expectations by defining and using criteria for
checking the software's security during development.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PO.5 — Implement and Maintain Secure Environments for Software Development

**Description (NIST):** Ensure that all components of the environments for
software development are strongly protected from internal and external threats
to prevent compromises of the environments or the software being developed or
maintained within them.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

---

## PS — Protect the Software

> *Practices to protect all components of the software from tampering and
> unauthorized access.* — NIST SP 800-218 §2.2

### PS.1 — Protect All Forms of Code from Unauthorized Access and Tampering

**Description (NIST):** Help prevent unauthorized changes to code, both
inadvertent and intentional, which could circumvent or negate the intended
security characteristics of the software. For code that is not intended to be
publicly accessible, this helps prevent theft of the software and may make it
more difficult or time-consuming for attackers to find vulnerabilities in the
software.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PS.2 — Provide a Mechanism for Verifying Software Release Integrity

**Description (NIST):** Help software acquirers ensure that the software they
acquire is legitimate and has not been tampered with.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PS.3 — Archive and Protect Each Software Release

**Description (NIST):** Preserve software releases in order to help identify,
analyze, and eliminate vulnerabilities discovered in the software after release.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

---

## PW — Produce Well-Secured Software

> *Practices to produce well-secured software with minimal security
> vulnerabilities in its releases.* — NIST SP 800-218 §2.3

### PW.1 — Design Software to Meet Security Requirements and Mitigate Security Risks

**Description (NIST):** Identify and evaluate the security requirements for the
software; determine what security risks the software is likely to face during
operation and how the software's design and architecture should mitigate those
risks; and justify any cases where risk-based decisions dictate that security
requirements should be relaxed or waived.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PW.2 — Review the Software Design to Verify Compliance with Security Requirements and Risk Information

**Description (NIST):** Help ensure that the software will meet the security
requirements and satisfactorily address the identified risk information.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PW.3 — Reuse Existing, Well-Secured Software When Feasible Instead of Duplicating Functionality

> Note: PW.3 was retired in SSDF v1.1; its content was merged into PW.4.
> Retained here as a placeholder to keep the canonical numbering visible.

- **Status:** n/a
- **Evidence:** Folded into PW.4 per NIST SP 800-218 v1.1 release notes.
- **Compensating Control:**
- **Notes:** Retired practice; do not edit.

### PW.4 — Reuse Existing, Well-Secured Software When Feasible Instead of Duplicating Functionality

**Description (NIST):** Lower the costs of software development, expedite
software development, and decrease the likelihood of introducing additional
security vulnerabilities into the software by reusing software modules and
services that have already had their security posture checked.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PW.5 — Create Source Code by Adhering to Secure Coding Practices

**Description (NIST):** Decrease the number of security vulnerabilities in the
software, and reduce costs by minimizing vulnerabilities introduced during
source code creation that meet or exceed organization-defined vulnerability
severity criteria.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PW.6 — Configure the Compilation, Interpreter, and Build Processes to Improve Executable Security

**Description (NIST):** Decrease the number of security vulnerabilities in the
software and reduce costs by eliminating vulnerabilities before testing occurs.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PW.7 — Review and/or Analyze Human-Readable Code to Identify Vulnerabilities and Verify Compliance with Security Requirements

**Description (NIST):** Help identify vulnerabilities so that they can be
corrected before the software is released to prevent exploitation. Using
automated methods lowers the effort and resources needed to detect
vulnerabilities. Human-readable code includes source code, scripts, and any
other form of code that an organization deems human-readable.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PW.8 — Test Executable Code to Identify Vulnerabilities and Verify Compliance with Security Requirements

**Description (NIST):** Help identify vulnerabilities so that they can be
corrected before the software is released in order to prevent exploitation.
Using automated methods lowers the effort and resources needed to detect
vulnerabilities and improves traceability and repeatability.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### PW.9 — Configure Software to Have Secure Settings by Default

**Description (NIST):** Help improve the security of the software at the time
of installation to reduce the likelihood of the software being deployed with
weak security settings, putting it at greater risk of compromise.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

---

## RV — Respond to Vulnerabilities

> *Practices to identify residual vulnerabilities in software releases and
> respond appropriately to address those vulnerabilities and prevent similar
> ones from occurring in the future.* — NIST SP 800-218 §2.4

### RV.1 — Identify and Confirm Vulnerabilities on an Ongoing Basis

**Description (NIST):** Help ensure that vulnerabilities are identified more
quickly so that they can be remediated more quickly in accordance with risk,
reducing the window of opportunity for attackers.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### RV.2 — Assess, Prioritize, and Remediate Vulnerabilities

**Description (NIST):** Help ensure that vulnerabilities are remediated in
accordance with risk to reduce the window of opportunity for attackers.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

### RV.3 — Analyze Vulnerabilities to Identify Their Root Causes

**Description (NIST):** Help reduce the frequency of vulnerabilities in the
future.

- **Status:** <!-- ai-fill: implemented|compensating|n/a|tbd -->
- **Evidence:** <!-- ai-fill: paths to artifacts -->
- **Compensating Control:** <!-- ai-fill: only if status=compensating -->
- **Notes:** <!-- ai-fill -->

---

## Signature Block

By signing below, the authorized representative attests that the information in
this self-attestation is true and accurate to the best of their knowledge.

- **signedBy:** <!-- ai-fill: full name -->
- **role:** <!-- ai-fill: title / authority -->
- **date:** <!-- ai-fill: YYYY-MM-DD -->
- **attestationId:** <!-- ai-fill: uuid (matches front-matter) -->
