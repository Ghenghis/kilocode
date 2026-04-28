/**
 * TemplateService — bundled template registry for Contract Markdowns Studio.
 *
 * Sprint 2 scope:
 *   • listTemplates()       → enumerate the 10 builtin templates bundled
 *                             under `assets/contract-templates/*.md`.
 *   • getTemplate(id)       → resolve a single template by its
 *                             front-matter `templateId`.
 *   • installFromUrl(url)   → moonshot path; throws NotImplemented in
 *                             Sprint 2. Hub-shared and URL imports land
 *                             in Sprint 3 alongside the canonical-settings
 *                             template registry sync.
 *
 * Activation contract:
 *   The service expects to be initialised with the extension's root URI so
 *   it can resolve `assets/contract-templates/*.md`. Templates are parsed
 *   exactly once on first access and cached in memory; the cache survives
 *   the lifetime of the extension host. (The bundled template set ships in
 *   the .vsix and never changes within a session.)
 *
 *   ```ts
 *   import { templateService } from "./TemplateService"
 *   templateService.init(context.extensionUri)
 *   ```
 *
 * Front-matter parsing:
 *   We do not pull in `gray-matter` for two reasons: (1) it is a
 *   node-only dep with a small surface we can replicate inline, and
 *   (2) Sprint 1 set the precedent of a zero-third-party `services/`
 *   tree. The parser implemented below understands the strict subset
 *   our templates use — a leading `---` delimited block of `key: value`
 *   pairs — and is unit-tested by the AI-fill section extractor.
 *
 * AI-fill markers:
 *   Each template may declare AI-fillable section by writing
 *   `<!-- ai-fill[: optional description] -->`. The service surfaces the
 *   list of sections (by their nearest preceding `## Heading`) so the
 *   PromptEnhancer / AgenticDocGen can target them deterministically.
 */

import * as vscode from "vscode"

// ───────────────────────────────────────────────────────────────────────────
// Public types — re-exported through `index.ts`.
// ───────────────────────────────────────────────────────────────────────────

export interface Template {
  id: string
  name: string
  version: string
  description: string
  category: string
  rubric?: string
  /** Full markdown body, *including* front-matter (so the editor can show provenance). */
  content: string
  /** Section names (from the nearest preceding `## Heading`) that contain `<!-- ai-fill -->` markers. */
  aiFillSections: string[]
}

export interface TemplateMessageContext {
  postMessage: (msg: unknown) => void
  [key: string]: unknown
}

// ───────────────────────────────────────────────────────────────────────────
// Front-matter parser
// ───────────────────────────────────────────────────────────────────────────

interface ParsedFrontMatter {
  data: Record<string, string>
  body: string
}

/**
 * Parse a leading YAML-ish front-matter block.
 *
 * Accepted shape (matches the templates bundled in this PR):
 *
 *   ---
 *   templateId: prd
 *   templateName: "Product Requirements Document"
 *   ---
 *   (markdown body)
 *
 * Unsupported (deliberately) — multi-line values, nested mappings,
 * sequences, anchors, references. If a template author needs those,
 * they can pull in a real YAML parser; the bundled templates use the
 * key/scalar subset only.
 */
function parseFrontMatter(raw: string): ParsedFrontMatter {
  // Normalise line endings — bundled assets are UTF-8 LF, but tolerate CRLF.
  const text = raw.replace(/\r\n/g, "\n")
  if (!text.startsWith("---\n")) {
    return { data: {}, body: text }
  }
  const end = text.indexOf("\n---\n", 4)
  if (end < 0) {
    return { data: {}, body: text }
  }
  const block = text.slice(4, end)
  const body = text.slice(end + 5)

  const data: Record<string, string> = {}
  for (const line of block.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue
    const colon = line.indexOf(":")
    if (colon < 0) continue
    const key = line.slice(0, colon).trim()
    let value = line.slice(colon + 1).trim()
    // Strip wrapping quotes (single or double) — front-matter strings sometimes carry them.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    // Skip array literals (`[]`), nested mappings (`{}`) — out of scope for our subset.
    if (value === "[]" || value === "{}") continue
    if (key) data[key] = value
  }

  return { data, body }
}

// ───────────────────────────────────────────────────────────────────────────
// AI-fill section extractor
// ───────────────────────────────────────────────────────────────────────────

const AI_FILL_RE = /<!--\s*ai-fill\b[^>]*-->/i
const HEADING_RE = /^#{1,6}\s+(.+?)\s*$/

/**
 * Walk the markdown body and return the unique list of section headings
 * (the nearest preceding `## Heading`) that contain at least one
 * `<!-- ai-fill -->` marker. Ordering is preserved (first occurrence wins).
 *
 * Markers that appear before the first heading are attributed to a
 * synthetic section called `Preamble`.
 */
function extractAiFillSections(markdown: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  let currentSection = "Preamble"
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(HEADING_RE)
    if (heading) {
      currentSection = heading[1].trim()
      continue
    }
    if (AI_FILL_RE.test(line)) {
      if (!seen.has(currentSection)) {
        seen.add(currentSection)
        out.push(currentSection)
      }
    }
  }

  return out
}

// ───────────────────────────────────────────────────────────────────────────
// Service
// ───────────────────────────────────────────────────────────────────────────

const TEMPLATES_DIR = "assets/contract-templates"

export class TemplateService {
  private extensionUri: vscode.Uri | undefined
  private cache: Template[] | undefined
  private cachePromise: Promise<Template[]> | undefined

  /**
   * Wire the service to the extension context. Call once during
   * `extension.ts:activate()` before the first webview message reaches
   * the controller.
   */
  init(extensionUri: vscode.Uri): void {
    this.extensionUri = extensionUri
    // Reset cache so a hot-reload picks up a freshly edited template.
    this.cache = undefined
    this.cachePromise = undefined
  }

  /** Return all bundled templates. Reads + parses on first call; cached thereafter. */
  async listTemplates(): Promise<Template[]> {
    if (this.cache) return this.cache
    if (!this.cachePromise) {
      this.cachePromise = this.loadTemplates().then((tpls) => {
        this.cache = tpls
        return tpls
      })
    }
    return this.cachePromise
  }

  /** Return a single template by `templateId`. */
  async getTemplate(id: string): Promise<Template | undefined> {
    const all = await this.listTemplates()
    return all.find((t) => t.id === id)
  }

  /**
   * Install a template from an arbitrary URL. Reserved for the V3
   * moonshot — Hub-shared templates land in V2 via canonical-settings,
   * and URL imports require sandboxed parsing + Governance review.
   */
  async installFromUrl(_url: string): Promise<Template> {
    throw new Error(
      "TemplateService.installFromUrl is not implemented yet (moonshot — see CONTRACT_STUDIO_SPEC §4 'Templates').",
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: discovery + parsing
  // ─────────────────────────────────────────────────────────────────────────

  private async loadTemplates(): Promise<Template[]> {
    if (!this.extensionUri) {
      // Service was not initialised — return an empty list so the webview
      // gracefully renders the "no templates available" empty state.
      return []
    }

    const dirUri = vscode.Uri.joinPath(this.extensionUri, TEMPLATES_DIR)
    let entries: [string, vscode.FileType][] = []
    try {
      entries = await vscode.workspace.fs.readDirectory(dirUri)
    } catch {
      // Directory missing — bundled assets are absent. Surface as empty.
      return []
    }

    const templates: Template[] = []
    for (const [name, kind] of entries) {
      if (kind !== vscode.FileType.File) continue
      if (!name.toLowerCase().endsWith(".md")) continue
      try {
        const fileUri = vscode.Uri.joinPath(dirUri, name)
        const bytes = await vscode.workspace.fs.readFile(fileUri)
        const raw = new TextDecoder("utf-8").decode(bytes)
        const tpl = this.parseTemplate(raw, name)
        if (tpl) templates.push(tpl)
      } catch {
        // Per-file failures are non-fatal — skip and continue.
      }
    }

    // Stable ordering: by category then by name so the picker UI is deterministic.
    templates.sort((a, b) => {
      const c = a.category.localeCompare(b.category)
      return c !== 0 ? c : a.name.localeCompare(b.name)
    })
    return templates
  }

  private parseTemplate(raw: string, filename: string): Template | undefined {
    const { data, body } = parseFrontMatter(raw)
    const id = data.templateId
    if (!id) return undefined // require an id; a markdown without one is not a template.

    return {
      id,
      name: data.templateName ?? filename.replace(/\.md$/i, ""),
      version: data.templateVersion ?? "0.0.0",
      description: data.templateDescription ?? "",
      category: data.templateCategory ?? "general",
      rubric: data.templateRubric,
      content: raw,
      // Strip the front-matter delimiter for the AI-fill scan — front-matter
      // values can legitimately contain `<!-- ai-fill -->` instructions in
      // descriptions, and we do not want those counted as sections.
      aiFillSections: extractAiFillSections(body),
    }
  }
}

/** Module-singleton — `extension.ts:activate()` calls `templateService.init(...)`. */
export const templateService = new TemplateService()

// ───────────────────────────────────────────────────────────────────────────
// Webview message handler
// ───────────────────────────────────────────────────────────────────────────

/**
 * Resolve `contract:templates:*` messages to webview-bound responses.
 *
 * Returns true when the message was consumed, false when the type lies
 * outside the templates namespace so a parent router can keep walking.
 */
export async function handleTemplateMessage(
  msg: Record<string, unknown>,
  ctx: TemplateMessageContext,
): Promise<boolean> {
  const type = typeof msg?.type === "string" ? (msg.type as string) : ""
  if (!type.startsWith("contract:templates:")) return false

  try {
    switch (type) {
      case "contract:templates:list": {
        const templates = await templateService.listTemplates()
        ctx.postMessage({ type: "contract:templates:result", templates })
        return true
      }
      case "contract:templates:install": {
        const templateId = typeof msg.templateId === "string" ? (msg.templateId as string) : ""
        const from = typeof msg.from === "string" ? (msg.from as string) : "builtin"
        if (!templateId) {
          ctx.postMessage({
            type: "contract:error",
            requestType: type,
            code: "bad-request",
            message: "Missing 'templateId'",
          })
          return true
        }
        if (from === "builtin") {
          // Bundled templates do not require an installation step — they
          // are always available via `contract:templates:list`. Reply with
          // an idempotent success so the webview's install button can be
          // wired with the same contract for the V2 Hub path.
          const tpl = await templateService.getTemplate(templateId)
          if (!tpl) {
            ctx.postMessage({
              type: "contract:error",
              requestType: type,
              code: "not-found",
              message: `Unknown template: ${templateId}`,
            })
            return true
          }
          ctx.postMessage({
            type: "contract:templates:installed",
            templateId,
            from,
            template: tpl,
          })
          return true
        }
        if (from === "url") {
          ctx.postMessage({
            type: "contract:error",
            requestType: type,
            code: "not-implemented",
            message:
              "URL-based template installation is reserved for the V3 moonshot. See CONTRACT_STUDIO_SPEC §4 'Templates'.",
          })
          return true
        }
        if (from === "hub") {
          ctx.postMessage({
            type: "contract:error",
            requestType: type,
            code: "not-implemented",
            message: "Hub-shared template install lands in Sprint 3 alongside canonical-settings sync.",
          })
          return true
        }
        ctx.postMessage({
          type: "contract:error",
          requestType: type,
          code: "bad-request",
          message: `Unknown 'from' source: ${from}`,
        })
        return true
      }
      default: {
        // A future contract:templates:* message we do not yet recognise —
        // consume it but reply deterministically so the webview surfaces
        // a clear "unsupported" hint instead of silence.
        ctx.postMessage({
          type: "contract:error",
          requestType: type,
          code: "unknown-type",
          message: `Unknown templates message type: ${type}`,
        })
        return true
      }
    }
  } catch (err) {
    ctx.postMessage({
      type: "contract:error",
      requestType: type,
      code: "internal",
      message: err instanceof Error ? err.message : String(err),
    })
    return true
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Test-only helpers (used by `__tests__/TemplateService.test.ts`).
// Not part of the public API but exported so the unit suite can drive
// the parser without a real `vscode.Uri`.
// ───────────────────────────────────────────────────────────────────────────

export const __TESTING__ = {
  parseFrontMatter,
  extractAiFillSections,
}
