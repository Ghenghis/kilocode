---
templateId: cisa-self-attestation
version: 1.0.0
nistSsdfVersion: "1.1"
sourceUrl: "https://www.cisa.gov/secure-software-attestation-form"
lastReviewed: <!-- ai-fill: YYYY-MM-DD -->
attestationId: <!-- ai-fill: uuid -->
---

# Secure Software Development Attestation Form

> Source: CISA — Cybersecurity and Infrastructure Security Agency.
> Canonical URL: <https://www.cisa.gov/secure-software-attestation-form>
>
> This template mirrors the literal Secure Software Development Self-Attestation
> Form ("Common Form") that software producers complete pursuant to OMB
> Memoranda M-22-18 and M-23-16, attesting that the producer follows secure
> software development practices outlined in NIST Special Publication 800-218,
> *Secure Software Development Framework (SSDF) Version 1.1*, and the NIST
> Software Supply Chain Security Guidance (collectively, the "NIST Guidance").

---

## Section I. Producer Information

| Field | Value |
|---|---|
| Software Producer (Company) name | <!-- ai-fill --> |
| Producer point of contact (name) | <!-- ai-fill --> |
| Producer point of contact (title) | <!-- ai-fill --> |
| Producer point of contact (email) | <!-- ai-fill --> |
| Producer point of contact (phone) | <!-- ai-fill --> |
| Producer mailing address | <!-- ai-fill --> |

---

## Section II. Software Identification

This attestation covers (select one):

- [ ] A single software product (Section II.A).
- [ ] All software produced by the producer.
- [ ] All software produced by the producer's identified division/branch
      (specify): <!-- ai-fill -->
- [ ] Multiple specific software products (list below).

### II.A — Software Product(s) Covered

| Product Name | Version(s) | Date First Produced | Software Description |
|---|---|---|---|
| <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> | <!-- ai-fill --> |

---

## Section III. Attestation Statements

The producer attests that, with respect to the software identified in
Section II:

### 1A. Secure Development Environments

> The software is developed and built in secure environments. Those
> environments are secured by the following actions, at a minimum:
> separating and protecting each environment involved in developing and
> building software; regularly logging, monitoring, and auditing trust
> relationships used for authorization and access to any software
> development and build environments and among components within each
> environment; enforcing multi-factor authentication and conditional
> access across the environments relevant to developing and building
> software in a manner that minimizes security risk; taking consistent
> and reasonable steps to document as well as minimize use or inclusion
> of software products that create undue risk within the environments
> used to develop and build software; encrypting sensitive data, such
> as credentials, to the extent practicable and based on risk; and
> implementing defensive cyber security practices, including continuous
> monitoring of operations and alerts and, as necessary, responding to
> suspected and confirmed cyber incidents.

- [ ] **Attested.** The producer attests to compliance with statement 1A.

Mapped SSDF practices: PO.5, PS.1.

### 1B. Provenance and Integrity of Internal Code and Third-Party Components

> The software producer makes a good-faith effort to maintain trusted source
> code supply chains by employing automated tools or comparable processes to
> address the security of internal code and third-party components and to
> manage related vulnerabilities.

- [ ] **Attested.** The producer attests to compliance with statement 1B.

Mapped SSDF practices: PO.1, PO.3, PS.1, PS.2, PW.4, RV.1.

### 1C. Provenance Maintained for Internal Code and Third-Party Components

> The software producer maintains provenance for internal code and third-party
> components incorporated into the software to the greatest extent feasible.

- [ ] **Attested.** The producer attests to compliance with statement 1C.

Mapped SSDF practices: PO.1, PO.3, PS.2, PS.3, PW.4.

### 1D. Vulnerability Disclosure and Response

> The software producer employs automated tools or comparable processes that
> check for security vulnerabilities. In addition:
> The producer operates these processes on an ongoing basis and, at a minimum,
> prior to product, version, or update releases; the producer has a policy or
> process to address discovered security vulnerabilities prior to product
> release; and the producer operates a vulnerability disclosure program and
> accepts, reviews, and addresses disclosed software vulnerabilities in a
> timely fashion and according to any timelines specified in the
> vulnerability disclosure program or applicable policies.

- [ ] **Attested.** The producer attests to compliance with statement 1D.

Mapped SSDF practices: PW.7, PW.8, RV.1, RV.2, RV.3.

---

## Section IV. Third-Party Assessment (optional)

If applicable, the producer has obtained a third-party assessment of the
software identified in Section II by a Third-Party Assessor Organization
(3PAO) certified under FedRAMP, or by a 3PAO approved in writing by the
relevant agency.

- [ ] Not applicable — producer self-attests.
- [ ] Third-party assessment attached (assessor: <!-- ai-fill -->;
      report id: <!-- ai-fill -->; date: <!-- ai-fill -->).

---

## Section V. Attestation by Authorized Representative

The undersigned, an authorized representative of the software producer named
in Section I, hereby attests that the producer follows the secure software
development practices identified in Section III with respect to the
software identified in Section II. The undersigned acknowledges that
willfully providing false or misleading information in connection with this
attestation may constitute a violation of 18 U.S.C. § 1001 and may result
in administrative, civil, or criminal penalties.

| Field | Value |
|---|---|
| Authorized representative — full name | <!-- ai-fill --> |
| Authorized representative — title | <!-- ai-fill --> |
| Signature | <!-- ai-fill --> |
| Date signed | <!-- ai-fill: YYYY-MM-DD --> |
| Attestation identifier (uuid) | <!-- ai-fill --> |

---

## Appendix — Cross-Reference to NIST SSDF (SP 800-218)

The mapping of CISA Common Form statements 1A–1D to NIST SSDF v1.1 practices
is provided above for traceability. The full structured SSDF self-attestation
lives alongside this form at `compliance/ssdf-attestation.md` (template:
`ssdf-attestation.template.md`).
