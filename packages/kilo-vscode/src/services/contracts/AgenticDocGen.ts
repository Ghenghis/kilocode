/**
 * AgenticDocGen — Plan-Critique-Compose (PCC) topology for contract drafting.
 *
 * Sprint 2 ships a minimal "Compose" skeleton:
 *   • generate()           — fetches a template, splits by `## ` headings,
 *                            replaces each `<!-- ai-fill: ... -->` block by
 *                            yielding section deltas as the routing layer
 *                            streams tokens (or a deterministic local fallback
 *                            if the routing service has no chat method yet).
 *   • regenerateSection()  — finds the named section in an existing markdown
 *                            doc and rewrites just that section using the
 *                            surrounding sections as context.
 *   • rewriteInline()      — simple "rewrite this fragment to: <instruction>"
 *                            for the inline ghost-rewrite UX.
 *
 *   TODO Sprint 3: PCC critic loop — Outline Planner (Sonnet extended thinking)
 *   produces the section dependency graph; Section Workers (Haiku) draft each
 *   section in parallel; a Reflexion-style Rubric Critic scores against the
 *   chosen template's rubric and re-drafts weak sections; a Consistency
 *   Reconciler unifies terminology before final emit.
 *
 * The chat call goes through `RoutingService.completeChat()` (or whatever the
 * existing routing API exposes). Today RoutingService only owns provider
 * selection — Sprint 1.5 adds the Vercel AI SDK adapter that will surface a
 * real `completeChat()` and a streaming `streamChat()` entry point. Until then
 * we cast the routing service to `any` and degrade gracefully when the methods
 * are missing.
 *
 *   TODO(Sprint 1.5): replace `routing as any` with `ProviderAdapter` once the
 *   Vercel AI SDK wrapper lands and exposes streamChat()/completeChat().
 */

import type { RoutingService } from "../routing/RoutingService"
import type { TemplateService } from "./TemplateService"
import type { EnrichedIntent } from "./PromptEnhancer"

// ─── Public types ───────────────────────────────────────────

export interface DocGenRequest {
  intent: EnrichedIntent
  mode: "quick" | "deep"
  templateId: string
}

export interface SectionDelta {
  sectionId: string
  /** Partial or full markdown content. */
  content: string
  done: boolean
}

interface ParsedSection {
  /** Stable id derived from the heading text. */
  id: string
  /** The literal heading line (e.g. `## Problem`). */
  heading: string
  /** Heading depth (number of leading `#`). */
  depth: number
  /** Body between this heading and the next, including ai-fill markers. */
  body: string
  /** True when the body contains at least one `<!-- ai-fill: ... -->` block. */
  needsFill: boolean
}

const AI_FILL_RE = /<!--\s*ai-fill:\s*([^>]*?)\s*-->/g

// ─── Service ────────────────────────────────────────────────

export class AgenticDocGen {
  constructor(
    private readonly routing: RoutingService,
    private readonly templateSvc: TemplateService,
  ) {}

  /**
   * Streaming generator — yields section deltas as the doc fills in.
   *
   * Sprint 2 strategy: split the template by `## ` headings and emit one
   * SectionDelta per section. Sections without ai-fill markers pass through
   * verbatim (and are emitted immediately with `done: true`); sections with
   * markers are sent to the LLM and either streamed back token-by-token (if
   * the routing layer has streaming) or emitted as a single final chunk.
   *
   * Sequential by default for deterministic streaming. The full PCC version
   * will parallelise the workers and reorder by dependency.
   */
  async *generate(req: DocGenRequest, signal: AbortSignal): AsyncIterableIterator<SectionDelta> {
    const tpl = await this.templateSvc.getTemplate(req.templateId)
    if (!tpl) {
      throw new Error(`AgenticDocGen.generate: unknown templateId "${req.templateId}"`)
    }

    // The new TemplateService stores the full markdown (including front-matter)
    // in `content`. AgenticDocGen wants just the body so the generated doc
    // does not carry the template's front-matter. Strip a leading `---` block.
    const bodyOnly = stripFrontMatter(tpl.content)
    const titled = applyTitle(bodyOnly, deriveTitle(req.intent))
    const sections = splitSections(titled)

    for (const section of sections) {
      if (signal.aborted) return

      if (!section.needsFill) {
        yield { sectionId: section.id, content: rebuildSection(section), done: true }
        continue
      }

      // Emit an empty starter delta so the editor reserves the section.
      yield { sectionId: section.id, content: section.heading + "\n\n", done: false }

      const filled = await this.fillSection({
        intent: req.intent,
        mode: req.mode,
        templateName: tpl.name,
        section,
        signal,
      })

      yield { sectionId: section.id, content: filled, done: true }
    }
  }

  /**
   * Single-section regenerate — finds the named section in an already-saved
   * markdown doc and rewrites just that section.
   */
  async *regenerateSection(
    docMarkdown: string,
    sectionId: string,
    instruction?: string,
  ): AsyncIterableIterator<SectionDelta> {
    const sections = splitSections(docMarkdown)
    const target = sections.find((s) => s.id === sectionId)
    if (!target) {
      throw new Error(`AgenticDocGen.regenerateSection: section "${sectionId}" not found`)
    }

    // Build a context snippet: previous and next section bodies (truncated).
    const idx = sections.indexOf(target)
    const prev = sections[idx - 1]
    const next = sections[idx + 1]
    const contextBefore = prev ? truncate(rebuildSection(prev), 800) : ""
    const contextAfter = next ? truncate(rebuildSection(next), 400) : ""

    const userInstruction =
      instruction && instruction.trim().length > 0
        ? `Rewrite the section per this instruction: ${instruction.trim()}`
        : "Rewrite the section to be clearer, more specific, and more actionable."

    const prompt = [
      "You are rewriting a single section of a markdown contract.",
      "Reply with ONLY the rewritten section, starting from its heading. No preamble, no postscript.",
      "",
      "Surrounding context (do not rewrite, only use for consistency):",
      contextBefore ? `--- previous section ---\n${contextBefore}` : "(no previous section)",
      contextAfter ? `--- next section ---\n${contextAfter}` : "(no next section)",
      "",
      "--- section to rewrite ---",
      rebuildSection(target),
      "",
      userInstruction,
    ].join("\n")

    yield { sectionId: target.id, content: target.heading + "\n\n", done: false }
    const rewritten = (await this.callChat(prompt, "low")) ?? localRewriteFallback(target, instruction)
    yield { sectionId: target.id, content: rewritten, done: true }
  }

  /**
   * Inline range rewrite for the editor's select-then-Tab UX.
   * Yields one or more string chunks; the final chunk is the complete rewrite.
   */
  async *rewriteInline(text: string, instruction: string): AsyncIterableIterator<string> {
    const prompt = [
      "Rewrite the following text per the instruction. Reply with ONLY the rewritten text, no commentary.",
      `Instruction: ${instruction.trim() || "Improve clarity and concision."}`,
      "",
      "--- text ---",
      text,
    ].join("\n")
    const reply = (await this.callChat(prompt, "low")) ?? localInlineFallback(text, instruction)
    yield reply
  }

  // ── Internals ──

  private async fillSection(args: {
    intent: EnrichedIntent
    mode: "quick" | "deep"
    templateName: string
    section: ParsedSection
    signal: AbortSignal
  }): Promise<string> {
    const { intent, mode, templateName, section, signal } = args

    // Extract the ai-fill hints to guide the model.
    const hints: string[] = []
    let m: RegExpExecArray | null
    AI_FILL_RE.lastIndex = 0
    while ((m = AI_FILL_RE.exec(section.body)) !== null) {
      hints.push(m[1].trim())
    }

    const constraintsSummary = intent.constraints.length
      ? intent.constraints.map((c) => `- ${c.name}: ${c.value}`).join("\n")
      : "(none specified)"

    const sysPrompt = [
      `You are drafting one section of a "${templateName}" contract in markdown.`,
      `Mode: ${mode === "deep" ? "Deep — be thorough, include trade-offs" : "Quick — be concise, ship-shape draft"}.`,
      "Reply with ONLY the section content starting from its heading line.",
      "Do not include the surrounding template scaffolding.",
      "Replace any '<!-- ai-fill: ... -->' marker with concrete prose.",
    ].join(" ")

    const userPrompt = [
      `Section heading: ${section.heading}`,
      "",
      "Section skeleton (replace ai-fill markers):",
      section.body,
      "",
      "Project intent:",
      `- raw idea: ${intent.rawIdea}`,
      `- domain: ${intent.domain}`,
      `- audience: ${intent.audience.join(", ")}`,
      `- key decisions: ${intent.keyDecisions.length ? intent.keyDecisions.join(", ") : "(tbd)"}`,
      "",
      "Constraints:",
      constraintsSummary,
      "",
      hints.length ? `Per-marker hints (in order):\n- ${hints.join("\n- ")}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    if (signal.aborted) return rebuildSection(section)

    const reply = await this.callChat(`${sysPrompt}\n\n${userPrompt}`, "low")
    if (!reply) return localFillFallback(section, intent)
    return reply
  }

  /**
   * Best-effort wrapper over `routing.completeChat()`. Returns the assistant
   * reply as a string, or `undefined` when the method is missing or the call
   * throws. Streaming is not yet wired; Sprint 1.5's ProviderAdapter will add
   * incremental token deltas.
   *
   * TODO(Sprint 1.5): switch to streaming via ProviderAdapter and yield
   * partial tokens upstream so the editor renders mid-section.
   */
  private async callChat(prompt: string, riskLevel: "low" | "medium" | "high"): Promise<string | undefined> {
    const chat = (this.routing as unknown as { completeChat?: (req: unknown) => Promise<unknown> }).completeChat
    if (typeof chat !== "function") return undefined
    try {
      const raw = (await chat.call(this.routing, {
        task: "contract",
        riskLevel,
        privacyMode: "cloud_ok",
        messages: [{ role: "user", content: prompt }],
      })) as unknown
      return extractText(raw)
    } catch {
      return undefined
    }
  }
}

// ─── Markdown helpers ───────────────────────────────────────

function stripFrontMatter(raw: string): string {
  // The new TemplateService keeps the YAML-ish front-matter block in `content`
  // for provenance. AgenticDocGen only wants the body so the generated doc
  // does not inherit the template's metadata.
  const text = raw.replace(/\r\n/g, "\n")
  if (!text.startsWith("---\n")) return raw
  const end = text.indexOf("\n---\n", 4)
  if (end < 0) return raw
  return text.slice(end + 5)
}

function applyTitle(body: string, title: string): string {
  return body.replace(/\{\{title\}\}/g, title)
}

function deriveTitle(intent: EnrichedIntent): string {
  const idea = (intent.rawIdea || "").trim()
  if (idea.length === 0) return "Untitled Contract"
  // Take the first sentence/clause, cap at 80 chars.
  const firstClause = idea.split(/[.!?\n]/)[0] ?? idea
  const trimmed = firstClause.trim()
  if (trimmed.length <= 80) return trimmed
  return trimmed.slice(0, 77).trimEnd() + "..."
}

/**
 * Split a markdown doc into sections delimited by `## ` (level-2) headings.
 * The leading `# Title` block (if present) is treated as section index 0.
 * Sub-headings (`### …`) stay inside their parent section.
 */
function splitSections(markdown: string): ParsedSection[] {
  const lines = markdown.split(/\r?\n/)
  const sections: ParsedSection[] = []
  let currentHeading = ""
  let currentDepth = 0
  let currentBody: string[] = []

  const flush = () => {
    if (!currentHeading && currentBody.every((l) => l.trim().length === 0)) return
    const id = headingToId(currentHeading) || `section-${sections.length}`
    const body = currentBody.join("\n")
    AI_FILL_RE.lastIndex = 0
    const needsFill = AI_FILL_RE.test(body)
    AI_FILL_RE.lastIndex = 0
    sections.push({
      id,
      heading: currentHeading,
      depth: currentDepth,
      body,
      needsFill,
    })
    currentHeading = ""
    currentDepth = 0
    currentBody = []
  }

  for (const line of lines) {
    const headingMatch = /^(#{1,2})\s+(.*)$/.exec(line)
    if (headingMatch) {
      // Flush the preceding section before starting a new one.
      flush()
      currentDepth = headingMatch[1].length
      currentHeading = line
      continue
    }
    currentBody.push(line)
  }
  flush()
  return sections
}

function headingToId(heading: string): string {
  const stripped = heading.replace(/^#+\s+/, "").trim()
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function rebuildSection(s: ParsedSection): string {
  if (!s.heading) return s.body
  return `${s.heading}\n${s.body}`.replace(/\s+$/g, "") + "\n"
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n) + "…"
}

function extractText(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw
  if (!raw || typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  if (typeof o.content === "string") return o.content
  if (typeof o.text === "string") return o.text
  if (typeof o.message === "object" && o.message !== null) {
    const m = o.message as Record<string, unknown>
    if (typeof m.content === "string") return m.content
  }
  if (Array.isArray(o.choices) && o.choices.length > 0) {
    const c = o.choices[0] as Record<string, unknown>
    if (typeof c.message === "object" && c.message !== null) {
      const cm = c.message as Record<string, unknown>
      if (typeof cm.content === "string") return cm.content
    }
    if (typeof c.text === "string") return c.text
  }
  return undefined
}

// ─── Deterministic fallbacks (offline / no-LLM mode) ────────

function localFillFallback(section: ParsedSection, intent: EnrichedIntent): string {
  const stripped = section.body.replace(AI_FILL_RE, (_match, hint) => `_TODO: ${String(hint).trim()}._`)
  const note = `\n\n_Generated offline. Re-run **Regenerate Section** with a model online for a real draft. (domain: ${intent.domain})_`
  return `${section.heading}\n${stripped}${note}\n`
}

function localRewriteFallback(section: ParsedSection, instruction?: string): string {
  const note = instruction ? `\n\n_Offline rewrite stub for instruction: ${instruction}_` : "\n\n_Offline rewrite stub._"
  return `${section.heading}\n${section.body}${note}\n`
}

function localInlineFallback(text: string, instruction: string): string {
  return `${text}\n\n[offline rewrite stub: ${instruction.slice(0, 80)}]`
}
