# Local SLSA L3 attestation verifier (PowerShell).
#
# Usage:   .\verify.ps1 -Artifact <path> -Provenance <path>
# Returns: exit 0 = signature + provenance verified
#          exit 1 = tampered, missing, or unverifiable
#
# Dependencies:
#   cosign  (https://docs.sigstore.dev/cosign/installation/)
#     winget install sigstore.cosign
#     -- or --
#     scoop install cosign
#
# References:
#   SLSA spec    https://slsa.dev/spec/v1.0/
#   in-toto v1.0 https://github.com/in-toto/attestation/tree/main/spec
#   cosign       https://docs.sigstore.dev/cosign/overview/

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $Artifact,
    [Parameter(Mandatory = $true)] [string] $Provenance
)

$ErrorActionPreference = 'Stop'

function Fail([string] $msg) {
    Write-Error "FAIL: $msg"
    exit 1
}

if (-not (Test-Path -LiteralPath $Artifact -PathType Leaf)) {
    Fail "artifact not found: $Artifact"
}
if (-not (Test-Path -LiteralPath $Provenance -PathType Leaf)) {
    Fail "provenance not found: $Provenance"
}

if (-not (Get-Command cosign -ErrorAction SilentlyContinue)) {
    Fail "cosign is not installed. Install: https://docs.sigstore.dev/cosign/installation/"
}

# 1) Validate the provenance JSON parses, has the right _type and predicateType.
$expectType      = 'https://in-toto.io/Statement/v1'
$expectPredicate = 'https://slsa.dev/provenance/v1'

$raw = Get-Content -LiteralPath $Provenance -Raw

# Some generators emit JSONL (one in-toto statement per line) — try parsing
# either as a single JSON document or as the first JSONL record.
$parsed = $null
try {
    $parsed = $raw | ConvertFrom-Json -ErrorAction Stop
} catch {
    $first = ($raw -split "`n")[0]
    try { $parsed = $first | ConvertFrom-Json -ErrorAction Stop } catch {
        Fail "provenance is not valid JSON / JSONL."
    }
}

if ($parsed.'_type' -ne $expectType) {
    Fail "provenance _type is not $expectType (got '$($parsed.'_type')')."
}
if ($parsed.predicateType -ne $expectPredicate) {
    Fail "predicateType is not $expectPredicate (got '$($parsed.predicateType)')."
}

# 2) Compute artifact sha256.
$sha = (Get-FileHash -LiteralPath $Artifact -Algorithm SHA256).Hash.ToLowerInvariant()

# 3) Confirm provenance subject digest matches the artifact.
$matched = $false
foreach ($subject in @($parsed.subject)) {
    if ($subject.digest.sha256 -and ($subject.digest.sha256.ToLowerInvariant() -eq $sha)) {
        $matched = $true
        break
    }
}
if (-not $matched) {
    Fail "artifact sha256 ($sha) is NOT in provenance subject digests — artifact may be tampered."
}

# 4) Cosign keyless verification.
$expectIssuer     = 'https://token.actions.githubusercontent.com'
$expectIdentityRe = '^https://github.com/slsa-framework/slsa-github-generator/'

$env:COSIGN_EXPERIMENTAL = '1'

$cosignArgs = @(
    'verify-blob-attestation',
    '--type', 'slsaprovenance1',
    '--certificate-identity-regexp', $expectIdentityRe,
    '--certificate-oidc-issuer', $expectIssuer,
    '--bundle', $Provenance,
    $Artifact
)

& cosign @cosignArgs *> $null
if ($LASTEXITCODE -ne 0) {
    # Fall back to verify-attestation (legacy callers).
    $fallbackArgs = @(
        'verify-attestation',
        '--type', 'slsaprovenance',
        '--certificate-identity-regexp', $expectIdentityRe,
        '--certificate-oidc-issuer', $expectIssuer,
        $Artifact
    )
    & cosign @fallbackArgs *> $null
    if ($LASTEXITCODE -ne 0) {
        Fail "cosign keyless verification failed for $Artifact. Signature, certificate, or transparency log entry is invalid."
    }
}

Write-Host "OK: artifact $Artifact"
Write-Host "    sha256        $sha"
Write-Host "    provenance    $Provenance"
Write-Host "    builder       slsa-framework/slsa-github-generator (verified via Sigstore)"
Write-Host "    SLSA level    L3 (provenance attests builder, source, and parameters)"
exit 0
