/**
 * StudioController — fan-out façade for `contract:*` webview messages.
 *
 * Sprint 1 + 2 scope:
 *   • contract:list                → DocStore.list()
 *   • contract:open                → DocStore.read()
 *   • contract:save                → DocStore.save() + atomic rename + sha
 *   • contract:enhancePrompt       → PromptEnhancer.enhance()
 *   • contract:generate            → AgenticDocGen.generate() (streaming)
 *   • contract:regenerateSection   → AgenticDocGen.regenerateSection() (streaming)
 *   • contract:rewriteInline       → AgenticDocGen.rewriteInline() (streaming)
 *   • contract:templates:list      → TemplateService.list()
 *   • contract:rubric:score        → gateRunner.runAll()
 *
 * All other contract:* messages return a `contract:error` envelope tagged
 * `not-implemented` so the webview can display a clear "coming in Sprint N"
 * message instead of failing silently.
 *
 * Returns true when the message was consumed; false otherwise so the host
 * router can keep walking. The handler is intentionally side-effect free
 * outside of `ctx.postMessage` so it is safe to invoke from any V4 dispatch
 * site.
 */

import * as vscode from "vscode"

import { docStore, type RefsSidecar } from "./DocStore"
import { runAll as runAllGates } from "./gateRunner"
import { PromptEnhancer, type EnrichedIntent } from "./PromptEnhancer"
import { AgenticDocGen, type DocGenRequest } from "./AgenticDocGen"
import { TemplateService, templateService, handleTemplateMessage } from "./TemplateService"
import type { RoutingService } from "../routing/RoutingService"
import type { SignOffRecord } from "./gates/anchors/playwright"

export interface StudioControllerContext {
  postMessage: (msg: unknown) => void
  /**
   * Optional routing service. When omitted, PromptEnhancer + AgenticDocGen
   * still run in deterministic-fallback mode (no LLM). Sprint 1.5 will make
   * this required once the ProviderAdapter lands.
   */
  routing?: RoutingService
  /**
   * When the host webview is disposed, this flag is flipped to `true`.
   * Long-running streaming handlers (e.g. `contract:generate`) check this
   * before each `postMessage` call so they break out of their async iterator
   * and abort the underlying LLM request instead of pulling tokens forever.
   */
  disposed?: boolean
  // Future: extensionContext, hermes, governance, etc. — Sprint 3+.
  [key: string]: unknown
}

const NOT_IMPLEMENTED_TYPES = new Set<string>([
  "contract:diagram",
  "contract:research",
  "contract:scaffold",
  "contract:audienceRender",
])

/**
 * Lazy singletons. We don't construct PromptEnhancer / AgenticDocGen at module
 * load because they need a RoutingService — instead we build per-call from
 * the context.routing reference (or fall back to a routing-less mode that
 * relies on heuristics).
 *
 * `templateService` is a module-level singleton initialised in
 * `extension.ts:activate()` via `templateService.init(extensionUri)`. The
 * `getTemplateSvc()` shim returns it so existing callers (AgenticDocGen)
 * keep using the same accessor pattern as in Sprint 2.
 */
function getTemplateSvc(): TemplateService {
  return templateService
}

function buildEnhancer(ctx: StudioControllerContext): PromptEnhancer {
  // Heuristics work without a routing service; the LLM-call helper inside
  // PromptEnhancer no-ops gracefully when routing.completeChat is missing.
  return new PromptEnhancer((ctx.routing ?? ({} as RoutingService)) as RoutingService)
}

function buildDocGen(ctx: StudioControllerContext): AgenticDocGen {
  return new AgenticDocGen(
    (ctx.routing ?? ({} as RoutingService)) as RoutingService,
    getTemplateSvc(),
  )
}

function isContractType(t: string): boolean {
  return t.startsWith("contract:")
}

const SIGN_OFFS_DIR = "verification/sign-offs"
const CRITERION_ID_RE = /^AC-\d{2,4}$/

function getWorkspaceRoot(): vscode.Uri | undefined {
  const folders = vscode.workspace.workspaceFolders
  return folders && folders.length > 0 ? folders[0].uri : undefined
}

function isValidSignOff(value: unknown): value is SignOffRecord {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.approvedBy === "string" &&
    v.approvedBy.length > 0 &&
    typeof v.approvedAt === "string" &&
    v.approvedAt.length > 0 &&
    typeof v.traceUrl === "string" &&
    v.traceUrl.length > 0
  )
}

interface SignOffStatus {
  criterionId: string
  signed: boolean
  approvedBy?: string
  approvedAt?: string
  traceUrl?: string
  path: string
}

async function readSignOffsDir(): Promise<SignOffStatus[]> {
  const root = getWorkspaceRoot()
  if (!root) return []
  const dirUri = vscode.Uri.joinPath(root, SIGN_OFFS_DIR)
  let entries: [string, vscode.FileType][] = []
  try {
    entries = await vscode.workspace.fs.readDirectory(dirUri)
  } catch {
    return []
  }
  const out: SignOffStatus[] = []
  for (const [name, kind] of entries) {
    if (kind !== vscode.FileType.File) continue
    const m = /^(AC-\d{2,4})\.json$/.exec(name)
    if (!m) continue
    const criterionId = m[1]!
    const fileUri = vscode.Uri.joinPath(dirUri, name)
    const relPath = `${SIGN_OFFS_DIR}/${name}`
    try {
      const bytes = await vscode.workspace.fs.readFile(fileUri)
      const parsed = JSON.parse(new TextDecoder("utf-8").decode(bytes))
      if (isValidSignOff(parsed)) {
        out.push({
          criterionId,
          signed: true,
          approvedBy: parsed.approvedBy,
          approvedAt: parsed.approvedAt,
          traceUrl: parsed.traceUrl,
          path: relPath,
        })
      } else {
        out.push({ criterionId, signed: false, path: relPath })
      }
    } catch {
      out.push({ criterionId, signed: false, path: relPath })
    }
  }
  out.sort((a, b) => a.criterionId.localeCompare(b.criterionId))
  return out
}

async function writeSignOff(
  criterionId: string,
  record: SignOffRecord,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const root = getWorkspaceRoot()
  if (!root) return { ok: false, error: "No workspace folder open" }
  if (!CRITERION_ID_RE.test(criterionId)) {
    return { ok: false, error: `Invalid criterionId: ${criterionId} (expected AC-### form)` }
  }
  const dirUri = vscode.Uri.joinPath(root, SIGN_OFFS_DIR)
  try {
    await vscode.workspace.fs.createDirectory(dirUri)
  } catch {
    // ignore — createDirectory is idempotent on the vscode FS
  }
  const fileUri = vscode.Uri.joinPath(dirUri, `${criterionId}.json`)
  const body = JSON.stringify(record, null, 2) + "\n"
  try {
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(body))
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  return { ok: true, path: `${SIGN_OFFS_DIR}/${criterionId}.json` }
}

function postError(ctx: StudioControllerContext, requestType: string, code: string, message: string): void {
  ctx.postMessage({
    type: "contract:error",
    requestType,
    code,
    message,
  })
}

/**
 * Top-level dispatcher invoked from `KiloProvider.dave.ts`.
 * Returns true if `msg` was a `contract:*` message and was handled (or
 * acknowledged with an error envelope). Returns false if the type is
 * outside the contract namespace.
 */
export async function handleContractMessage(
  msg: Record<string, unknown>,
  ctx: StudioControllerContext,
): Promise<boolean> {
  const type = typeof msg?.type === "string" ? (msg.type as string) : ""
  if (!isContractType(type)) return false

  try {
    switch (type) {
      case "contract:list": {
        const docs = await docStore.list()
        ctx.postMessage({ type: "contract:list:result", docs })
        return true
      }

      case "contract:open": {
        const path = typeof msg.path === "string" ? msg.path : ""
        if (!path) {
          postError(ctx, type, "bad-request", "Missing 'path'")
          return true
        }
        try {
          const doc = await docStore.read(path)
          ctx.postMessage({ type: "contract:open:result", doc })
        } catch (err) {
          postError(ctx, type, "open-failed", err instanceof Error ? err.message : String(err))
        }
        return true
      }

      case "contract:save": {
        const path = typeof msg.path === "string" ? msg.path : ""
        const markdown = typeof msg.markdown === "string" ? (msg.markdown as string) : ""
        const refs = (msg.refs ?? undefined) as RefsSidecar | undefined
        if (!path) {
          postError(ctx, type, "bad-request", "Missing 'path'")
          return true
        }
        const result = await docStore.save(path, markdown, refs)
        ctx.postMessage({
          type: "contract:save:result",
          ok: result.ok,
          sha: result.sha,
          error: result.error,
        })
        return true
      }

      case "contract:templates:list":
      case "contract:templates:install": {
        // Delegate to the dedicated TemplateService handler, which knows how
        // to enumerate the bundled `assets/contract-templates/*.md` set and
        // to surface "not-implemented" hints for the V3 URL/Hub paths.
        await handleTemplateMessage(msg, ctx)
        return true
      }

      case "contract:enhancePrompt": {
        const rawIdea = typeof msg.rawIdea === "string" ? msg.rawIdea : ""
        if (!rawIdea) {
          postError(ctx, type, "bad-request", "Missing 'rawIdea'")
          return true
        }
        const enhancer = buildEnhancer(ctx)
        const result = await enhancer.enhance(rawIdea)
        ctx.postMessage({
          type: "contract:enhancePrompt:result",
          enriched: result.enriched,
          questions: result.questions,
          offline: !ctx.routing,
        })
        return true
      }

      case "contract:rubric:score": {
        const path = typeof msg.path === "string" ? msg.path : (typeof msg.docPath === "string" ? msg.docPath : "")
        const docTypeIn = typeof msg.docType === "string" ? msg.docType : "*"
        let markdown = typeof msg.markdown === "string" ? msg.markdown : ""
        let refs: unknown = msg.refs
        if (!markdown && path) {
          try {
            const doc = await docStore.read(path)
            markdown = doc.markdown
            if (refs === undefined) refs = doc.refs
          } catch (err) {
            postError(ctx, type, "open-failed", err instanceof Error ? err.message : String(err))
            return true
          }
        }
        if (!markdown) {
          postError(ctx, type, "bad-request", "Missing 'markdown' or 'path'")
          return true
        }
        try {
          const result = await runAllGates(markdown, docTypeIn, refs)
          ctx.postMessage({
            type: "contract:rubric:result",
            score: result.score,
            issues: result.issues,
            passed: result.passedGates,
            failed: result.failedGates,
            path,
          })
        } catch (err) {
          postError(ctx, type, "rubric-failed", err instanceof Error ? err.message : String(err))
        }
        return true
      }

      case "contract:generate": {
        const intent = msg.intent as EnrichedIntent | undefined
        const mode = (msg.mode === "deep" ? "deep" : "quick") as "quick" | "deep"
        const templateId = typeof msg.templateId === "string" ? msg.templateId : ""
        if (!intent || !templateId) {
          postError(ctx, type, "bad-request", "Missing 'intent' or 'templateId'")
          return true
        }
        const docgen = buildDocGen(ctx)
        const ac = new AbortController()
        const req: DocGenRequest = { intent, mode, templateId }
        try {
          // If the webview is disposed mid-stream, the loop must terminate
          // — otherwise it pulls LLM tokens forever and `postMessage`
          // throws/silently fails. We check `ctx.disposed` before every
          // post and abort the AbortController in `finally` so the
          // underlying LLM request is cancelled even on early exit.
          for await (const delta of docgen.generate(req, ac.signal)) {
            if (ctx.disposed) break
            ctx.postMessage({ type: "contract:generate:delta", ...delta })
          }
          if (!ctx.disposed) ctx.postMessage({ type: "contract:generate:done" })
        } catch (err) {
          if (!ctx.disposed) {
            postError(ctx, type, "generate-failed", err instanceof Error ? err.message : String(err))
          }
        } finally {
          ac.abort()
        }
        return true
      }

      case "contract:regenerateSection": {
        const docPath = typeof msg.docPath === "string" ? msg.docPath : ""
        const sectionId = typeof msg.sectionId === "string" ? msg.sectionId : ""
        const instruction = typeof msg.instruction === "string" ? msg.instruction : undefined
        if (!docPath || !sectionId) {
          postError(ctx, type, "bad-request", "Missing 'docPath' or 'sectionId'")
          return true
        }
        let docMarkdown: string
        try {
          const doc = await docStore.read(docPath)
          docMarkdown = doc.markdown
        } catch (err) {
          postError(ctx, type, "open-failed", err instanceof Error ? err.message : String(err))
          return true
        }
        const docgen = buildDocGen(ctx)
        try {
          for await (const delta of docgen.regenerateSection(docMarkdown, sectionId, instruction)) {
            ctx.postMessage({ type: "contract:section:delta", ...delta })
          }
          ctx.postMessage({ type: "contract:section:done", sectionId })
        } catch (err) {
          postError(ctx, type, "regenerate-failed", err instanceof Error ? err.message : String(err))
        }
        return true
      }

      case "contract:trace:approve": {
        const criterionId = typeof msg.criterionId === "string" ? msg.criterionId : ""
        const traceUrl = typeof msg.traceUrl === "string" ? msg.traceUrl : ""
        const signedBy = typeof msg.signedBy === "string" ? msg.signedBy : ""
        if (!criterionId || !traceUrl || !signedBy) {
          postError(ctx, type, "bad-request", "Missing 'criterionId', 'traceUrl', or 'signedBy'")
          return true
        }
        const record: SignOffRecord = {
          approvedBy: signedBy,
          approvedAt: new Date().toISOString(),
          traceUrl,
        }
        const result = await writeSignOff(criterionId, record)
        if (result.ok) {
          ctx.postMessage({
            type: "contract:trace:approve:result",
            ok: true,
            criterionId,
            path: result.path,
            record,
          })
        } else {
          ctx.postMessage({
            type: "contract:trace:approve:result",
            ok: false,
            criterionId,
            error: result.error,
          })
        }
        return true
      }

      case "contract:trace:list": {
        const signOffs = await readSignOffsDir()
        ctx.postMessage({ type: "contract:trace:list:result", signOffs })
        return true
      }

      case "contract:rewriteInline": {
        const text = typeof msg.text === "string" ? msg.text : ""
        const instruction = typeof msg.instruction === "string" ? msg.instruction : ""
        if (!text || !instruction) {
          postError(ctx, type, "bad-request", "Missing 'text' or 'instruction'")
          return true
        }
        const docgen = buildDocGen(ctx)
        try {
          for await (const chunk of docgen.rewriteInline(text, instruction)) {
            ctx.postMessage({ type: "contract:inline:delta", chunk })
          }
          ctx.postMessage({ type: "contract:inline:done" })
        } catch (err) {
          postError(ctx, type, "rewrite-failed", err instanceof Error ? err.message : String(err))
        }
        return true
      }

      default: {
        if (NOT_IMPLEMENTED_TYPES.has(type)) {
          postError(ctx, type, "not-implemented", `${type} is scheduled for a later sprint.`)
          return true
        }
        // Unknown contract:* type — consume but mark as unknown so the user
        // sees a deterministic error rather than silence.
        postError(ctx, type, "unknown-type", `Unknown contract message type: ${type}`)
        return true
      }
    }
  } catch (err) {
    postError(ctx, type, "internal", err instanceof Error ? err.message : String(err))
    return true
  }
}
