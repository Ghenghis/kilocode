# Release Provenance and Auto-Update Protocol

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

The Kilo Code VSIX, Open WebUI Hub manifests, Hermes provider images, and any other DaveAI-published artifact reach end users through automated channels (auto-update, container pull, npm install). The chain from "code on disk" to "code running on a user machine" must be cryptographically verifiable and must originate from a sanctioned release branch. This document specifies the provenance requirements, the manifest schema, the client-side checks, the publish-side gates, and the rollback workflow.

## Threat model
If `main/master` (or `integration/main`) contains unreleased feature work, and a CI script publishes "current main HEAD" as a release, then the auto-updater pushes pre-release code to every installed client within one polling interval. This is exactly why V3 separates release branches from integration branches. Adjacent threats:

- A maintainer manually invokes a publish workflow against the wrong ref.
- A signed tag is created on a non-release branch and the publish workflow trusts the tag without verifying the branch shape.
- A compromised manifest signing key is used to publish a malicious VSIX with valid SHA256+size fields.
- A user side-loads a manually built VSIX that bypasses the pipeline entirely.

Every provenance requirement below addresses one or more of these threats.

## Provenance requirements for any published artifact (VSIX, Docker image, npm package, etc.)
Every artifact published to a public or semi-public channel must satisfy all of the following:

1. Built from a `release/*` branch only. No artifact may be published from `main`, `master`, `integration/main`, or any feature branch.
2. The build commit must be tagged with `vX.Y.Z` or `vX.Y.Z-rc.N` following SemVer.
3. The tag must be signed: `git tag -s vX.Y.Z -m "..."` (GPG) or the cosign keyless equivalent. Lightweight tags are rejected.
4. A build provenance attestation must be produced. SLSA Level 2 or higher is recommended, generated via in-toto and signed with sigstore (cosign). The attestation binds the artifact digest to the source commit and the build pipeline run.
5. The release manifest must be signed. The auto-updater client must verify that signature before downloading any artifact bytes referenced by the manifest.

## Manifest schema (concrete)
The Hub publishes manifests at `<HUB_BASE>/api/updates/manifest?channel=<channel>`. The current schema includes:

```json
{
  "version": "7.2.21-canary.2",
  "sha256": "<hex>",
  "size": 75921408,
  "signature": "<base64>",
  "releaseNotes": "...",
  "channel": "canary",
  "minimumVersion": "7.0.0",
  "forceDowngrade": false
}
```

REQUIRED additions for V4:

```json
{
  "provenance": {
    "tag": "v7.2.21-canary.2",
    "tagSignedBy": "<gpg-key-fingerprint or sigstore identity>",
    "commitSha": "<40-hex>",
    "releaseBranch": "release/daveai-v7.2.21-canary",
    "buildPipelineRun": "https://github.com/<org>/<repo>/actions/runs/<id>"
  },
  "slsa_provenance_url": "https://<cdn>/attestations/<artifact-sha256>.intoto.jsonl",
  "revoked": false,
  "revokedReason": null
}
```

`provenance.releaseBranch` is the field that lets the client refuse pre-release-from-main attacks at install time.

## AutoUpdateService client checks (already-implemented + new)
File: `packages/kilo-vscode/src/services/auto-update/AutoUpdateService.ts`.

Already implemented (see lines 143-163, marked with `// kilocode_change` comments):

- SHA256 verification of the downloaded VSIX against `manifest.sha256` before `installVSIX` is invoked.
- Byte-size verification against `manifest.size`.
- The manifest `signature` field exists; VERIFY whether the verify step is actually wired before publishing V4. If the field is parsed but never validated, that is a critical gap and must be filled before any new client-side check is meaningful.

NEW checks required for V4 (must land in client before any release-branch enforcement on the server is trusted as sufficient):

1. Verify `manifest.provenance.releaseBranch` matches the regex `^release/.+`. If it does not, abort install and log a critical event.
2. Refuse to install if `manifest.provenance.releaseBranch` equals `main`, `master`, `integration/main`, or any branch matching `feature/.*` or `fix/.*`. This is a hard rule, not a warning.
3. Verify `manifest.provenance.commitSha` is reachable from a signed tag in `origin`. The client may rely on the Hub's attestation rather than fetching git history, but it must verify the SLSA attestation chain at `slsa_provenance_url`.
4. Honor `manifest.revoked == true` by refusing install and surfacing the `revokedReason` to the user.
5. Verify the manifest signature against a pinned public key shipped with the extension. Key rotation requires a new extension release.

## Hub backend publish workflow
Hub-side script: `scripts/publish_release.py` (located under `contract-kit-v17/src/webui/hub/scripts/`). The script is the only sanctioned path to publish a manifest.

Steps performed by `publish_release.py`:

1. Read the input release branch ref. Validate it matches `^release/.+`. If not, return HTTP 422 `release_branch_required` and abort.
2. Verify the head commit on that branch is signed (`git verify-commit HEAD`) and that a signed tag points to it (`git tag --verify <tag>`). If either check fails, return 422 `unsigned_release_head`.
3. Build the artifact in a clean container. Compute SHA256 and size.
4. Generate the SLSA in-toto attestation, sign with cosign, upload to the attestation CDN.
5. Compose the manifest JSON including the `provenance` block.
6. Sign the manifest with the manifest signing key (HSM-backed or sigstore keyless).
7. Upload the artifact, attestation, and manifest to S3/CDN behind the channel route.
8. Append a publish record to the evidence ledger (see doc 04).

Reject conditions (any single failure aborts the publish):

- Branch is not `release/*` -> 422.
- Head commit is unsigned -> 422.
- No signed tag on head commit -> 422.
- SLSA attestation generation failed -> 500, no upload.
- Manifest signing key unavailable -> 500, no upload.

## GitHub Actions workflow gate
Workflow file: `.github/workflows/publish-vsix.yml`.

```yaml
name: Publish VSIX
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write     # cosign keyless
      contents: read
      attestations: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Verify branch is release/*
        run: |
          BRANCH=$(git branch -r --contains "$GITHUB_REF" \
            | grep -E 'origin/release/' | head -n1 | sed 's|.*origin/||')
          if [ -z "$BRANCH" ]; then
            echo "::error::Tag $GITHUB_REF is not on a release/* branch"
            exit 1
          fi
          echo "RELEASE_BRANCH=$BRANCH" >> "$GITHUB_ENV"
      - name: Verify tag is signed
        run: git tag --verify "${GITHUB_REF#refs/tags/}"
      - name: Build VSIX
        run: pnpm -C packages/kilo-vscode build:vsix
      - name: Compute artifact digest
        id: digest
        run: |
          F=$(ls packages/kilo-vscode/*.vsix | head -n1)
          echo "sha256=$(sha256sum "$F" | cut -d' ' -f1)" >> "$GITHUB_OUTPUT"
          echo "size=$(stat -c%s "$F")" >> "$GITHUB_OUTPUT"
      - name: Generate SLSA provenance
        uses: actions/attest-build-provenance@v1
        with:
          subject-path: 'packages/kilo-vscode/*.vsix'
      - name: Sign manifest with cosign
        run: cosign sign-blob --yes manifest.json > manifest.sig
      - name: Publish to Hub
        run: python scripts/publish_release.py \
              --branch "$RELEASE_BRANCH" \
              --tag "${GITHUB_REF#refs/tags/}" \
              --manifest manifest.json \
              --signature manifest.sig
```

The branch-gate step is the single most important control: a tag on `main` or any non-release branch fails the workflow before any artifact is built.

## Channel-to-branch mapping
Channels constrain which release branches feed them.

| Channel | Permitted release branches | Notes |
|---|---|---|
| `stable` | `release/v*-stable`, `release/daveai-v*-stable` | Production users; strictest gates. |
| `canary` | `release/v*-canary*`, `release/daveai-v*-canary*` | Volunteer testers; pre-release. |
| `dev` | any `release/*` | Internal testing; still requires release branch. |

Forbidden for every channel: `main`, `master`, `integration/main`, any `feature/*`, any `fix/*`, any `hotfix/*` not promoted into a `release/*` branch first. The Hub backend enforces the channel-to-branch mapping at publish time and the client enforces the `release/*` shape at install time.

## Rollback workflow when a bad release ships
When a published version is determined to be defective:

1. Hub backend operator runs `scripts/revoke_release.py --version <v> --channel <c> --reason "<text>"`. The script flips `revoked: true` and sets `revokedReason` on the stored manifest, re-signs, and republishes to the channel route.
2. AutoUpdateService client polls the channel within the next hour, sees `revoked: true`, refuses install, and surfaces `revokedReason` to the user. (This requires the new client-side check listed above.)
3. The previous-known-good manifest is republished to the active channel under a new manifest publication timestamp. Clients on the bad version are offered the previous version as a downgrade; `forceDowngrade: true` may be set if the bad release is dangerous.
4. An incident report is opened in the evidence ledger (see doc 04) covering: detection signal, affected version range, affected user count estimate, root cause, corrective action, and operator approval (Dave).

## Audit checklist (quarterly)
Every quarter the operator runs the following audit:

1. List all published versions per channel for the quarter (query the Hub manifest archive).
2. For each version confirm:
   - Build came from a `release/*` branch (check `provenance.releaseBranch`).
   - The `provenance.tag` is signed and verifiable today.
   - The SLSA attestation at `slsa_provenance_url` resolves and verifies.
   - Manifest signature verifies against the currently pinned key (or a documented predecessor key).
3. Sample N=10 user-installed versions from telemetry. For each, confirm the installed SHA256 matches the published manifest's `sha256` for that version. A mismatch indicates side-loading or a compromised distribution path.
4. File the audit report into the evidence ledger.

## Failure modes
- User installs a manually built VSIX that did not go through the pipeline. Not detectable by the auto-updater after the fact. Mitigation: on first connection to the Hub, the client compares its installed SHA256 against the published manifest for its claimed version and warns the user on mismatch. This is a soft control and cannot prevent fully offline installs.
- CI pipeline misconfigured to publish from `main`. Caught by the workflow branch-gate above; if the gate is bypassed (admin override), caught by `publish_release.py`'s 422; if both are bypassed, caught by client-side `releaseBranch` check.
- Tag signed by a compromised key. Rotate the GPG/sigstore identity, re-sign tags for in-flight releases, republish manifests with `tagSignedBy` updated. Old keys are added to a revocation list shipped with the next client release.
- Manifest signature key compromised. Revoke the key, generate a new key, ship a new client extension version with the new pinned key, republish all current-channel manifests under the new signature. Clients on the old key cannot auto-update past the rotation point and must update manually; this is acceptable and intentional.
- SLSA attestation CDN unreachable. Client treats absence of attestation as a hard install failure, not a warning. Better to delay an install than to install unverified bytes.

## Evidence to record per release
For every published artifact, the evidence ledger entry must include:

- Release branch name (full ref).
- Build commit SHA (40-hex).
- Tag name and tag signature fingerprint or sigstore identity.
- Build pipeline run URL.
- Artifact filename and SHA256.
- SLSA attestation URL and digest.
- Manifest publication timestamp and channel.
- Operator approval line: `Approved-by: Dave <date> <signature-or-attestation-id>`.

This evidence is what makes a release auditable months later and is what differentiates a sanctioned release from a side-channel artifact.

## Cross-references
- Doc 11 (`11_RELEASE_BRANCH_ASSEMBLY_PROTOCOL.md`) — branch assembly rules; this doc is the publish-side complement.
- Doc 10 (`10_CROSS_REPO_HUB_AND_ECOSYSTEM_PROTOCOL.md`) — Hub as integration surface inside Kilo Code and Open WebUI.
- Doc 04 — evidence ledger format and incident report schema.
- Doc 09 — universal validation gates.
- Doc 17 — pre-push hook (forbids direct pushes to release source branches before sign-off).
- Doc 27 — secrets and supply chain hardening.
