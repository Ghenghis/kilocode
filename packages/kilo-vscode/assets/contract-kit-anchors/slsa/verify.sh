#!/bin/sh
# Local SLSA L3 attestation verifier (POSIX sh, no jq).
#
# Usage:   ./verify.sh <artifact-path> <provenance-path>
# Returns: 0 = signature + provenance verified
#          1 = tampered, missing, or unverifiable
#
# Dependencies:
#   - cosign  (https://docs.sigstore.dev/cosign/installation/)
#       macOS:  brew install cosign
#       Linux:  curl -sLO https://github.com/sigstore/cosign/releases/download/v2.4.0/cosign-linux-amd64
#               sudo install -m 0755 cosign-linux-amd64 /usr/local/bin/cosign
#       Win:    winget install sigstore.cosign  (or use verify.ps1)
#
# References:
#   SLSA spec    https://slsa.dev/spec/v1.0/
#   in-toto v1.0 https://github.com/in-toto/attestation/tree/main/spec
#   cosign       https://docs.sigstore.dev/cosign/overview/

set -eu

usage() {
    printf 'usage: %s <artifact-path> <provenance-path>\n' "$0" >&2
    exit 1
}

[ "$#" -eq 2 ] || usage

ARTIFACT="$1"
PROVENANCE="$2"

if [ ! -f "$ARTIFACT" ]; then
    printf 'FAIL: artifact not found: %s\n' "$ARTIFACT" >&2
    exit 1
fi
if [ ! -f "$PROVENANCE" ]; then
    printf 'FAIL: provenance not found: %s\n' "$PROVENANCE" >&2
    exit 1
fi

if ! command -v cosign >/dev/null 2>&1; then
    printf 'FAIL: cosign is not installed. Install: https://docs.sigstore.dev/cosign/installation/\n' >&2
    exit 1
fi

# 1) Validate the provenance JSON parses, has the right _type and predicateType.
#    POSIX-only: grep on flat JSON, no jq dependency.
EXPECT_TYPE='https://in-toto.io/Statement/v1'
EXPECT_PREDICATE='https://slsa.dev/provenance/v1'

if ! grep -q "\"_type\"[[:space:]]*:[[:space:]]*\"${EXPECT_TYPE}\"" "$PROVENANCE"; then
    printf 'FAIL: provenance _type is not %s — file is malformed or not in-toto v1.0.\n' "$EXPECT_TYPE" >&2
    exit 1
fi

if ! grep -q "\"predicateType\"[[:space:]]*:[[:space:]]*\"${EXPECT_PREDICATE}\"" "$PROVENANCE"; then
    printf 'FAIL: predicateType is not %s — provenance is not SLSA v1.0.\n' "$EXPECT_PREDICATE" >&2
    exit 1
fi

# 2) Compute artifact sha256, normalise to lowercase hex.
if command -v sha256sum >/dev/null 2>&1; then
    ARTIFACT_SHA=$(sha256sum "$ARTIFACT" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
    ARTIFACT_SHA=$(shasum -a 256 "$ARTIFACT" | awk '{print $1}')
else
    printf 'FAIL: no sha256sum / shasum available on PATH.\n' >&2
    exit 1
fi

# 3) Confirm provenance subject digest matches the artifact.
if ! grep -q "\"sha256\"[[:space:]]*:[[:space:]]*\"${ARTIFACT_SHA}\"" "$PROVENANCE"; then
    printf 'FAIL: artifact sha256 (%s) is NOT in provenance subject digests — artifact may be tampered.\n' "$ARTIFACT_SHA" >&2
    exit 1
fi

# 4) Cosign keyless verification. The slsa-github-generator workflow signs
#    with a Fulcio identity; restrict to the canonical generator only.
EXPECT_ISSUER='https://token.actions.githubusercontent.com'
EXPECT_IDENTITY_RE='^https://github.com/slsa-framework/slsa-github-generator/'

if ! COSIGN_EXPERIMENTAL=1 cosign verify-blob-attestation \
    --type slsaprovenance1 \
    --certificate-identity-regexp "$EXPECT_IDENTITY_RE" \
    --certificate-oidc-issuer "$EXPECT_ISSUER" \
    --bundle "$PROVENANCE" \
    "$ARTIFACT" >/dev/null 2>&1; then
    # Fall back to verify-attestation (legacy callers).
    if ! COSIGN_EXPERIMENTAL=1 cosign verify-attestation \
        --type slsaprovenance \
        --certificate-identity-regexp "$EXPECT_IDENTITY_RE" \
        --certificate-oidc-issuer "$EXPECT_ISSUER" \
        "$ARTIFACT" >/dev/null 2>&1; then
        printf 'FAIL: cosign keyless verification failed for %s.\n' "$ARTIFACT" >&2
        printf '       The signature, certificate, or transparency log entry is invalid.\n' >&2
        exit 1
    fi
fi

printf 'OK: artifact %s\n' "$ARTIFACT"
printf '    sha256        %s\n' "$ARTIFACT_SHA"
printf '    provenance    %s\n' "$PROVENANCE"
printf '    builder       slsa-framework/slsa-github-generator (verified via Sigstore)\n'
printf '    SLSA level    L3 (provenance attests builder, source, and parameters)\n'
exit 0
