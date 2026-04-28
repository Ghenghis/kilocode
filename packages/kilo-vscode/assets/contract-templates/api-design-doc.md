---
templateId: api-design-doc
templateName: "API Design Document"
templateVersion: "1.0.0"
templateDescription: "REST/HTTP API design contract: Resource Model, Endpoints, Auth, Errors, Versioning, Pagination, Rate Limits, Deprecation Policy, SDK."
templateCategory: api
templateRubric: api-design-rubric-v1
author: "KiloCode Studio"
---

# {{API_NAME}} — API Design

| Field | Value |
|---|---|
| API name | <!-- ai-fill --> |
| Status | <!-- ai-fill: Draft / Stable / Beta / Deprecated --> |
| Author | <!-- ai-fill --> |
| Reviewers | <!-- ai-fill: API council, security, SRE, SDK owners --> |
| Last updated | <!-- ai-fill --> |
| Style guide | <!-- ai-fill: e.g., Google AIPs, Microsoft REST guidelines, internal API style --> |

> **Goal of this doc**: Establish a contract that is *long-lived*. APIs are
> easier to ship than to evolve. Decisions made here echo for years.

## 1. Overview

<!-- ai-fill: 2-3 paragraphs. What this API does, who calls it, the workflow it enables. End with the "elevator example" — a single curl command that demonstrates the typical use. -->

```bash
curl -X POST https://api.example.com/v1/things \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $UUID" \
  -d '{"name": "demo"}'
```

## 2. Resource model

<!-- ai-fill: The API's noun graph. List each resource, its parent (if hierarchical), and its identifier shape. Then a one-line description of each. The resource model is the single most important section — get this right and the endpoints write themselves. -->

| Resource | Identifier | Parent | Description |
|---|---|---|---|
| `Project` | `proj_<ulid>` | — | Top-level tenant container. |
| `Thing` | `thg_<ulid>` | Project | <!-- ai-fill --> |
| `Tag` | `tag_<slug>` | Project | <!-- ai-fill --> |
| `Run` | `run_<ulid>` | Thing | <!-- ai-fill --> |

### Identifier scheme

<!-- ai-fill: Choose one and justify: ULID, KSUID, UUIDv7, snowflake, opaque base32. State whether IDs are sortable, whether they encode tenant info, and whether they are exposed in URLs. Keep IDs prefixed (`proj_`, `thg_`) so logs and customer tickets are unambiguous. -->

### Field naming conventions

<!-- ai-fill: snake_case vs camelCase, timestamp format (RFC 3339 with `Z`), decimal handling (string for monetary?), enum casing, null vs absent. A 2-paragraph statement that all subsequent endpoints inherit. -->

## 3. Endpoints

<!-- ai-fill: Tabular index of every endpoint. Each row is a contract. Then per-endpoint subsections with full request/response schemas. Group by resource, ordered as `Create / Read / List / Update / Delete / Custom`. -->

| Method | Path | Description | Idempotent? | Auth |
|---|---|---|---|---|
| POST | `/v1/projects/:projectId/things` | Create thing | Yes (with `Idempotency-Key`) | Bearer |
| GET | `/v1/things/:thingId` | Get thing | Yes | Bearer |
| GET | `/v1/projects/:projectId/things` | List things | Yes | Bearer |
| PATCH | `/v1/things/:thingId` | Update thing | No (uses `If-Match`) | Bearer |
| DELETE | `/v1/things/:thingId` | Soft-delete thing | Yes | Bearer |
| POST | `/v1/things/:thingId:archive` | Archive (custom verb) | Yes | Bearer |

### 3.1 Create thing

```http
POST /v1/projects/{projectId}/things
Authorization: Bearer <token>
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "name": "string (1..120)",
  "tags": ["tag_blue", "tag_alpha"],
  "metadata": {"k": "v"}
}
```

**Response — 201 Created**:

```json
{
  "id": "thg_01HZV...",
  "project_id": "proj_01HZV...",
  "name": "demo",
  "tags": ["tag_blue", "tag_alpha"],
  "metadata": {"k": "v"},
  "created_at": "2026-04-28T12:00:00Z",
  "updated_at": "2026-04-28T12:00:00Z"
}
```

**Response — 4xx**: see §5 Errors.

<!-- ai-fill: Repeat this shape for each endpoint. Capture: required vs optional fields, validation bounds, default behaviour for omitted fields, response codes (the *full set*, not just 200), example error payloads. -->

### 3.2 Get thing

<!-- ai-fill -->

### 3.3 List things

<!-- ai-fill: with pagination — see §7. -->

### 3.4 Update thing

<!-- ai-fill: with conditional update — `If-Match: <etag>` and 412 on conflict. -->

### 3.5 Custom verbs

<!-- ai-fill: When you genuinely need a non-CRUD action (`:archive`, `:merge`, `:cancel`), use the colon-suffix custom-verb pattern from Google AIPs: `POST /v1/things/{id}:archive`. Document the safety constraints (idempotency, side-effects, billing impact). -->

## 4. Authentication and authorization

<!-- ai-fill:
- **AuthN**: bearer JWT? OAuth 2.1 client-credentials? mTLS? API keys for server-to-server only? State the issuer, audience, and token lifetime.
- **AuthZ**: the authorization model — roles, scopes, ABAC. Tie scopes to endpoints in a table.
- **Multi-tenant scoping**: how the request is constrained to a tenant. Path? Token claim? Both? -->

| Scope | Allows | Denies |
|---|---|---|
| `things:read` | GET on Things | All writes |
| `things:write` | Create/Update/Delete | Cross-project access |
| `admin` | All | — |

**Token introspection**: <!-- ai-fill: link to the introspection endpoint and the cache TTL we expect SDKs to use. -->

## 5. Errors

<!-- ai-fill: A *single* documented error envelope shape. The error code namespace is finite and stable; new codes are additive. The HTTP status maps to a category; the `code` is what client code branches on. -->

```json
{
  "error": {
    "code": "things.name_too_long",
    "message": "name must be at most 120 characters",
    "status": 400,
    "request_id": "req_01HZV...",
    "details": [
      {"field": "name", "issue": "too_long", "limit": 120, "actual": 142}
    ],
    "doc_url": "https://docs.example.com/errors/things.name_too_long"
  }
}
```

### Error code registry

<!-- ai-fill: A canonical table mapping `code` → HTTP status → meaning → recovery hint. Codes never disappear; they are deprecated, not removed. -->

| Code | Status | Meaning | Client recovery |
|---|---|---|---|
| `auth.unauthenticated` | 401 | Token missing or invalid | Re-authenticate |
| `auth.forbidden` | 403 | Insufficient scope | Don't retry |
| `things.not_found` | 404 | Thing does not exist or is hidden by RLS | Don't retry |
| `things.conflict` | 409 | ETag mismatch | Re-fetch and retry |
| `rate_limit.exceeded` | 429 | Tenant quota exhausted | Honor `Retry-After` |
| `internal.unavailable` | 503 | Backend dependency degraded | Exponential backoff |

### Idempotency

<!-- ai-fill: Which methods accept `Idempotency-Key`, the key TTL on the server (typically 24h), the behaviour on key reuse with a different body (409). Reference: Stripe / GitHub patterns. -->

## 6. Versioning

<!-- ai-fill: One sentence policy. Pick one; do not mix:

- **URL versioning** (`/v1/`, `/v2/`) — recommended for public APIs.
- **Header versioning** (`Accept: application/vnd.example.v1+json`) — recommended only for narrow internal APIs.

Within a major version: additive only. New optional fields, new endpoints, new error codes. Never remove fields, change types, or repurpose codes.

Across major versions: full migration window (see §9 Deprecation policy). -->

**Backwards-compat checklist for every PR touching this API**:
- [ ] No removed fields.
- [ ] No tightened validation on existing fields.
- [ ] No changed enum values (only new ones added).
- [ ] No changed HTTP status for an existing code.
- [ ] No semantic change to an existing field.

## 7. Pagination

<!-- ai-fill: Cursor pagination is the default. Page-number pagination is a footgun (skipped/duplicated rows under writes). Document:

- The page-size limit (default 50, max 200).
- The cursor format (opaque, not ordered, server-signed if leaking is a concern).
- The `next_cursor` semantics — `null` means done.
- Stable ordering: define the tiebreaker (e.g., `(created_at desc, id desc)`).
- Consistent reads under pagination — what guarantee do we offer if rows mutate mid-iteration? -->

```http
GET /v1/things?limit=50&cursor=eyJjcyI6IjAxSFp...
```

```json
{
  "data": [/* ... 50 things ... */],
  "next_cursor": "eyJjcyI6IjAxSFp..."
}
```

## 8. Rate limiting

<!-- ai-fill: Quota model — per-tenant or per-token? Sliding window or token bucket? Default and burst limits. Headers we always emit (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` on 429). Different categories (read vs write vs expensive). -->

| Category | Steady QPS | Burst | Window | Header prefix |
|---|---|---|---|---|
| Read | 50 / tenant | 100 | 60s | `X-RateLimit-Read-` |
| Write | 10 / tenant | 20 | 60s | `X-RateLimit-Write-` |
| Expensive (search/list with deep scan) | 1 / tenant | 5 | 60s | `X-RateLimit-Expensive-` |

## 9. Deprecation policy

<!-- ai-fill: A written promise to clients. Recommended template:

- **Notice period**: 6 months minimum for a breaking change (12 for paid plans).
- **Communication**: email to verified billing contact + `Sunset` header on responses + changelog post.
- **Behavior of deprecated endpoints**: emit `Deprecation: <date>` and `Sunset: <date>` headers per RFC 8594; continue to function until sunset.
- **Removal of fields**: only across major versions; deprecated fields are nullable and absent from new client SDKs.
- **Sunset response**: 410 Gone with `code: api.sunset` and a link to the migration guide. -->

## 10. SDK and client guidance

<!-- ai-fill: Languages we ship SDKs for, the source-of-truth (OpenAPI? Smithy? gRPC? handwritten?). Generation strategy. Style: typed errors, retry-with-backoff baked in, automatic `Idempotency-Key` for unsafe verbs, paginator helpers. -->

| Language | Package | Source | Status |
|---|---|---|---|
| TypeScript | `@example/api` | generated from OpenAPI | <!-- ai-fill --> |
| Python | `example-api` | handwritten + types | <!-- ai-fill --> |
| Go | `github.com/example/api-go` | generated | <!-- ai-fill --> |

**Retries**: SDKs retry idempotent requests on `5xx` and `408/429` with exponential backoff + jitter. Max 4 attempts. Servers must remain idempotent under retry storms.

## 11. Observability for clients

<!-- ai-fill: Headers we emit so customers can debug:
- `X-Request-Id` — surface this in our error messages and our support tooling.
- `Server-Timing` — for performance debugging.
- Correlation IDs (W3C `traceparent`) propagated end-to-end.
- A `/v1/_diagnostics/echo` endpoint that returns the request as the server saw it. -->

## 12. Open questions

<!-- ai-fill: 5-10 unresolved decisions. Each with owner and call-it date. -->

## 13. Appendix

- OpenAPI 3.1 spec: <!-- ai-fill: link -->
- Postman collection: <!-- ai-fill -->
- Changelog: <!-- ai-fill -->
- API style guide we inherit from: <!-- ai-fill -->

---

> **API design first principles** (cut from the doc before publishing):
> - Resources are nouns, actions are verbs. Pluralise resource paths.
> - Idempotency is not optional for unsafe methods; it is a feature.
> - Errors are part of the contract. Their codes outlive their messages.
> - Pagination is cursor-based unless you have a specific reason it isn't.
> - Versioning policy is more important than the version number you pick.
> - Every public endpoint has at least one example; every error has at least one example.
