/**
 * PromptEnhancer — Ambiguity Detector + Domain Injector + Constraint Extractor.
 *
 * Sprint 2 implementation: each method runs ONE structured-output call against
 * the cheapest model in the provider cascade (typically Claude Haiku, falling
 * back to MiniMax M2). Responses are validated by hand-rolled TypeScript guards
 * — we deliberately avoid pulling in zod for the contracts service surface to
 * keep bundle size flat.
 *
 * The actual chat call goes through `RoutingService` (or whatever the existing
 * routing API exposes). Today RoutingService only exposes `route()` for routing
 * decisions and not a `completeChat()`/streaming entry point — Sprint 1.5 will
 * add a `ProviderAdapter` over the Vercel AI SDK. Until then this file casts
 * the routing service to `any` and calls `routing.completeChat?.(...)` with a
 * graceful fallback to a deterministic local stub when the method is absent.
 *
 *   TODO(Sprint 1.5): replace `routing as any` with `ProviderAdapter` once the
 *   Vercel AI SDK wrapper lands and RoutingService exposes `completeChat()`.
 */

import type { RoutingService } from "../routing/RoutingService"

// ─── Public types ───────────────────────────────────────────

export interface ClarifyingQuestion {
  question: string
  suggestedAnswers?: string[]
}

export interface EnrichedConstraint {
  name: string
  value: string
}

export interface EnrichedIntent {
  rawIdea: string
  /** e.g. "marketplace", "b2b-saas", "ai-tool" */
  domain: string
  /** Detected stakeholders. */
  audience: string[]
  constraints: EnrichedConstraint[]
  keyDecisions: string[]
  /** Recommended template id from TemplateService. */
  templateRecommendation: string
}

export interface AmbiguityReport {
  missing: string[]
  questions: ClarifyingQuestion[]
}

// ─── Domain pack registry ───────────────────────────────────

export interface DomainPack {
  id: string
  name: string
  keywords: string[]
  commonNFRs: string[]
  regulations: string[]
  antipatterns: string[]
  suggestedTemplates: string[]
}

// Sprint 2 ships a flat keyword-routed registry. Sprint 3 swaps this for an
// embedding-routed lookup against the 30 domain packs in `./domains/`.
const BUILTIN_DOMAIN_IDS: ReadonlyArray<string> = [
  "marketplace",
  "b2b-saas",
  "ai-tool",
  "mobile-app",
  "consumer-web",
  "developer-tool",
  "fintech",
  "healthtech",
  "gov",
  "internal-tool",
] as const

const KEYWORD_TO_DOMAIN: ReadonlyArray<{ id: string; matchers: RegExp[] }> = [
  {
    id: "marketplace",
    matchers: [
      /\bmarketplac/i,
      /\bbuyers?\b/i,
      /\bsellers?\b/i,
      /\blistings?\b/i,
      /\bauction/i,
      /\b(c2c|p2p)\b/i,
    ],
  },
  {
    id: "b2b-saas",
    matchers: [
      /\bsaas\b/i,
      /\bb2b\b/i,
      /\benterprise\b/i,
      /\bdashboard\b/i,
      /\bteam[- ]?seats?\b/i,
      /\bsso\b/i,
    ],
  },
  {
    id: "ai-tool",
    matchers: [/\bllm\b/i, /\bagent\b/i, /\bcopilot\b/i, /\bgpt\b/i, /\bclaude\b/i, /\bprompt\b/i],
  },
  {
    id: "mobile-app",
    matchers: [/\bios\b/i, /\bandroid\b/i, /\bmobile app\b/i, /\bswift\b/i, /\bkotlin\b/i],
  },
  {
    id: "consumer-web",
    matchers: [/\bconsumer\b/i, /\bsocial\b/i, /\bb2c\b/i, /\bcreators?\b/i],
  },
  {
    id: "developer-tool",
    matchers: [/\bdev tool\b/i, /\bcli\b/i, /\bsdk\b/i, /\bvs ?code\b/i, /\bide\b/i, /\blibrary\b/i],
  },
  {
    id: "fintech",
    matchers: [/\bfintech\b/i, /\bbanking\b/i, /\bpayments?\b/i, /\bkyc\b/i, /\baml\b/i, /\bledger\b/i],
  },
  {
    id: "healthtech",
    matchers: [/\bhealth/i, /\bhipaa\b/i, /\bclinical\b/i, /\bpatient\b/i, /\bmedical\b/i, /\bphi\b/i],
  },
  {
    id: "gov",
    matchers: [/\bgovernment\b/i, /\bfedramp\b/i, /\bfisma\b/i, /\bpublic sector\b/i, /\bgsa\b/i],
  },
  {
    id: "internal-tool",
    matchers: [/\binternal\b/i, /\badmin\b/i, /\bback ?office\b/i, /\boperations\b/i],
  },
]

// ─── Heuristics for ambiguity detection ─────────────────────

/**
 * Slots a complete idea must populate before a contract draft is worth
 * generating. Missing slot → clarifying question is added.
 */
const REQUIRED_SLOTS: ReadonlyArray<{
  id: string
  question: string
  suggestedAnswers?: string[]
  /** Returns `true` when the slot is FILLED by the idea. */
  detect: (idea: string) => boolean
}> = [
  {
    id: "audience",
    question: "Who are the primary users or stakeholders?",
    suggestedAnswers: ["Consumers (general public)", "Engineers / developers", "Enterprises (B2B)", "Internal team only"],
    detect: (s) =>
      /\b(users?|customers?|engineers?|developers?|teams?|admins?|enterprises?|consumers?|patients?|sellers?|buyers?)\b/i.test(
        s,
      ),
  },
  {
    id: "scale",
    question: "What scale do you expect at launch and at year-1?",
    suggestedAnswers: ["<100 users", "100–10k users", "10k–1M users", ">1M users"],
    detect: (s) => /\b(scale|users|requests?|qps|throughput|concurrent|seats?|tenants?)\b.*\b(\d+|million|thousand|k\b)/i.test(s),
  },
  {
    id: "platform",
    question: "Which platform do you target first?",
    suggestedAnswers: ["Web", "Mobile (iOS+Android)", "Desktop", "CLI / SDK", "VS Code extension"],
    detect: (s) =>
      /\b(web|mobile|ios|android|desktop|cli|sdk|browser|extension|vscode|chrome|api)\b/i.test(s),
  },
  {
    id: "monetisation",
    question: "How will it make money (if at all)?",
    suggestedAnswers: ["Free / open-source", "Subscription", "Per-seat", "Per-usage / metered", "Marketplace fee", "Ads"],
    detect: (s) =>
      /\b(free|paid|subscription|seats?|metered|usage|ads?|fee|commission|saas|tier|pricing)\b/i.test(s),
  },
  {
    id: "compliance",
    question: "Any regulatory or compliance constraints?",
    suggestedAnswers: ["None known", "GDPR", "HIPAA", "SOC 2", "PCI-DSS", "FedRAMP"],
    detect: (s) => /\b(gdpr|hipaa|soc ?2|pci|fedramp|fisma|kyc|aml|compliance|regulator)/i.test(s),
  },
]

/**
 * Cheap regex sweep for vague qualifiers a constraint extractor should challenge
 * (e.g. "fast" → quantify into a p95 latency budget).
 */
const VAGUE_QUALIFIERS: ReadonlyArray<{ name: string; pattern: RegExp; ask: string }> = [
  { name: "performance", pattern: /\b(fast|snappy|quick|low[- ]?latency)\b/i, ask: "p95 latency target (ms)" },
  { name: "scale", pattern: /\b(scalable|massive|huge|web[- ]?scale)\b/i, ask: "peak QPS / concurrent users" },
  { name: "reliability", pattern: /\b(reliable|robust|always[- ]?on|highly available)\b/i, ask: "SLO / uptime target" },
  { name: "secure", pattern: /\b(secure|safe|hardened|zero[- ]?trust)\b/i, ask: "threat model + auth model" },
  { name: "cheap", pattern: /\b(cheap|low[- ]?cost|affordable)\b/i, ask: "monthly infra budget cap (USD)" },
  { name: "easy", pattern: /\b(easy|simple|intuitive|seamless)\b/i, ask: "first-success time target (minutes)" },
]

// ─── Enhancer ───────────────────────────────────────────────

export class PromptEnhancer {
  constructor(private readonly routing: RoutingService) {}

  /**
   * Single-call enhancement: runs ambiguity detection, domain detection, and
   * constraint extraction in parallel, then assembles an EnrichedIntent.
   * The LLM call is best-effort — when the routing layer can't reach a model,
   * we still return a meaningful enriched payload built from heuristics.
   */
  async enhance(rawIdea: string): Promise<{ enriched: EnrichedIntent; questions: ClarifyingQuestion[] }> {
    const [ambiguity, domain, constraints, llmExtras] = await Promise.all([
      this.detectAmbiguity(rawIdea),
      this.injectDomain(rawIdea),
      this.extractConstraints(rawIdea),
      this.callLlmForExtras(rawIdea).catch(() => undefined),
    ])

    const audience = uniqueStrings([
      ...detectAudience(rawIdea),
      ...(llmExtras?.audience ?? []),
    ])
    const keyDecisions = uniqueStrings([
      ...detectKeyDecisions(rawIdea),
      ...(llmExtras?.keyDecisions ?? []),
    ])
    const templateRecommendation =
      llmExtras?.templateRecommendation && typeof llmExtras.templateRecommendation === "string"
        ? llmExtras.templateRecommendation
        : recommendTemplate(domain)

    const enriched: EnrichedIntent = {
      rawIdea,
      domain,
      audience: audience.length > 0 ? audience : ["users"],
      constraints,
      keyDecisions,
      templateRecommendation,
    }

    return { enriched, questions: ambiguity.questions }
  }

  /**
   * Inspect the idea for missing slots. Returns the slot ids that were not
   * detected plus a clarifying question (with suggested answers) for each.
   */
  async detectAmbiguity(idea: string): Promise<AmbiguityReport> {
    const missing: string[] = []
    const questions: ClarifyingQuestion[] = []
    for (const slot of REQUIRED_SLOTS) {
      if (!slot.detect(idea)) {
        missing.push(slot.id)
        questions.push({ question: slot.question, suggestedAnswers: slot.suggestedAnswers })
      }
    }
    return { missing, questions }
  }

  /**
   * Returns the best-matching domain id from the bundled registry. Sprint 3
   * upgrades this to an embedding lookup against the JSON domain packs.
   */
  async injectDomain(idea: string): Promise<string> {
    let bestId = "internal-tool"
    let bestScore = 0
    for (const entry of KEYWORD_TO_DOMAIN) {
      let score = 0
      for (const m of entry.matchers) {
        if (m.test(idea)) score += 1
      }
      if (score > bestScore) {
        bestScore = score
        bestId = entry.id
      }
    }
    // Confidence floor: if nothing matched, return the safe default.
    if (bestScore === 0) return "internal-tool"
    return bestId
  }

  /**
   * Surface vague qualifiers and turn them into name/value constraints with
   * placeholders the user (or the LLM in the next pass) can populate.
   */
  async extractConstraints(idea: string): Promise<EnrichedConstraint[]> {
    const out: EnrichedConstraint[] = []
    for (const q of VAGUE_QUALIFIERS) {
      if (q.pattern.test(idea)) {
        out.push({ name: q.name, value: `TBD: ${q.ask}` })
      }
    }
    // Also pick up any literal "X must Y" / "must support Z" phrases.
    const mustRe = /\bmust (?:support |have |be )?([^.,;\n]{4,80})/gi
    let m: RegExpExecArray | null
    while ((m = mustRe.exec(idea)) !== null) {
      const fragment = m[1].trim().replace(/[.,;]+$/, "")
      if (fragment.length > 0) {
        out.push({ name: "must", value: fragment })
      }
    }
    return out
  }

  // ── LLM bridge ──

  /**
   * Extract LLM-derived extras (audience, key decisions, template
   * recommendation). Best-effort: returns `undefined` when the routing layer
   * has no chat method available.
   *
   * TODO(Sprint 1.5): replace this with `ProviderAdapter.completeJson(...)`.
   */
  private async callLlmForExtras(rawIdea: string): Promise<
    { audience?: string[]; keyDecisions?: string[]; templateRecommendation?: string } | undefined
  > {
    const chat = (this.routing as unknown as { completeChat?: (req: unknown) => Promise<unknown> }).completeChat
    if (typeof chat !== "function") {
      // Routing layer doesn't expose an LLM call yet. Sprint 1.5 will add one.
      return undefined
    }
    try {
      const raw = (await chat.call(this.routing, {
        task: "contract",
        riskLevel: "low",
        privacyMode: "cloud_ok",
        responseFormat: "json",
        messages: [
          {
            role: "system",
            content:
              "You are extracting structured metadata from a product idea. Reply with JSON only, " +
              "no commentary, matching: {\"audience\":string[],\"keyDecisions\":string[],\"templateRecommendation\":string}. " +
              "Do not include trailing commas. Keep arrays under 6 items.",
          },
          { role: "user", content: rawIdea },
        ],
      })) as unknown
      return parseExtras(raw)
    } catch {
      return undefined
    }
  }
}

// ─── Helpers + guards ───────────────────────────────────────

function detectAudience(idea: string): string[] {
  const out: string[] = []
  if (/\bdevelopers?\b/i.test(idea) || /\bengineers?\b/i.test(idea)) out.push("developers")
  if (/\bcustomers?\b/i.test(idea) || /\bconsumers?\b/i.test(idea)) out.push("consumers")
  if (/\benterprise/i.test(idea) || /\bb2b\b/i.test(idea)) out.push("enterprise buyers")
  if (/\badmins?\b/i.test(idea) || /\boperations\b/i.test(idea)) out.push("internal admins")
  if (/\bpatients?\b/i.test(idea)) out.push("patients")
  if (/\bsellers?\b/i.test(idea)) out.push("sellers")
  if (/\bbuyers?\b/i.test(idea)) out.push("buyers")
  return out
}

function detectKeyDecisions(idea: string): string[] {
  const out: string[] = []
  if (/\b(stack|framework|language)\b/i.test(idea)) out.push("Pick the technology stack")
  if (/\b(host|cloud|aws|gcp|azure)\b/i.test(idea)) out.push("Pick the deployment target")
  if (/\b(auth|sso|login|oauth)\b/i.test(idea)) out.push("Pick the authentication model")
  if (/\b(db|database|sql|nosql|postgres|sqlite)\b/i.test(idea)) out.push("Pick the persistence layer")
  if (/\b(payments?|billing|stripe)\b/i.test(idea)) out.push("Pick the payments provider")
  return out
}

function recommendTemplate(domainId: string): string {
  // Conservative defaults — TemplateService.list() is the authoritative source.
  switch (domainId) {
    case "marketplace":
    case "consumer-web":
    case "mobile-app":
    case "b2b-saas":
      return "prd"
    case "ai-tool":
    case "developer-tool":
      return "rfc"
    case "fintech":
    case "healthtech":
    case "gov":
      return "compliance-prd"
    case "internal-tool":
      return "design-doc"
    default:
      return "prd"
  }
}

function uniqueStrings(input: ReadonlyArray<string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of input) {
    const norm = typeof s === "string" ? s.trim() : ""
    if (!norm) continue
    const key = norm.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(norm)
  }
  return out
}

function parseExtras(
  raw: unknown,
): { audience?: string[]; keyDecisions?: string[]; templateRecommendation?: string } | undefined {
  // The routing chat shim may return { content: string } or a raw JSON string,
  // or already-parsed object — handle all three.
  let obj: unknown = raw
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj)
    } catch {
      return undefined
    }
  }
  if (obj && typeof obj === "object" && "content" in obj && typeof (obj as { content: unknown }).content === "string") {
    try {
      obj = JSON.parse((obj as { content: string }).content)
    } catch {
      return undefined
    }
  }
  if (!obj || typeof obj !== "object") return undefined
  const o = obj as Record<string, unknown>
  const audience = isStringArray(o.audience) ? o.audience : undefined
  const keyDecisions = isStringArray(o.keyDecisions) ? o.keyDecisions : undefined
  const templateRecommendation =
    typeof o.templateRecommendation === "string" ? o.templateRecommendation : undefined
  if (!audience && !keyDecisions && !templateRecommendation) return undefined
  return { audience, keyDecisions, templateRecommendation }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string")
}

// Re-export so other contracts services can route by id without re-declaring.
export const KNOWN_DOMAIN_IDS: ReadonlyArray<string> = BUILTIN_DOMAIN_IDS
