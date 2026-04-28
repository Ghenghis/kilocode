# Security Policy

> Required for the OpenSSF Scorecard `Security-Policy` check (10/10).
> Replace `REPLACE_*` placeholders before publishing the scaffold.

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest| :x:                |

## Reporting a vulnerability

We take security seriously. If you discover a vulnerability, please report it
**privately** so we can investigate and ship a fix before details become
public.

### How to report

Preferred channel — GitHub private vulnerability reporting:

1. Open <https://github.com/REPLACE_WITH_OWNER/REPLACE_WITH_REPO/security/advisories/new>.
2. Fill in the form with as much detail as you can (steps to reproduce, impact,
   affected versions, suggested mitigation if known).
3. Submit. Only the maintainers can see your report.

Alternative — encrypted email:

- Address: `security@REPLACE_WITH_DOMAIN`
- PGP key: `REPLACE_WITH_PGP_FINGERPRINT` (publish at
  `https://REPLACE_WITH_DOMAIN/.well-known/security.txt`)

### What to include

- Affected component(s) and version(s)
- Reproduction steps or proof of concept
- Impact assessment (confidentiality / integrity / availability)
- Any suggested mitigation

### What to expect

| Stage              | SLA                                                |
| ------------------ | -------------------------------------------------- |
| Acknowledgement    | within 2 business days                             |
| Triage + severity  | within 5 business days                             |
| Fix + disclosure   | within 90 days (sooner for critical severity)      |

We follow a coordinated-disclosure model. Once a fix is available we will:

1. Publish a GitHub Security Advisory + CVE (where applicable).
2. Credit the reporter unless they request anonymity.
3. Backport the fix to all supported versions.

## Out of scope

- Vulnerabilities in third-party dependencies (please report upstream)
- Issues that require a privileged user against themselves
- Theoretical attacks without a working proof of concept

## Hall of fame

Reporters who follow this policy will be credited in our `SECURITY-THANKS.md`
file unless they request otherwise.

---

_This policy is a Contract Kit Creator scaffold default. Update the contact
addresses and SLAs to reflect your organisation's actual capacity._
