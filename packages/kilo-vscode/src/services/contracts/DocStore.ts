/**
 * DocStore — Filesystem layer for Contract Markdowns Studio.
 *
 * Source of truth: `${workspaceFolder}/.kilo/contracts/*.md`
 *   Optional sidecar: `${workspaceFolder}/.kilo/contracts/<name>.refs.json`
 *
 * Responsibilities:
 *   • list()  — enumerate contract markdowns in the workspace.
 *   • read()  — load a single contract (markdown + sidecar refs if any).
 *   • save()  — atomic write (temp file → rename) and return SHA-256 of the
 *               persisted content. The sidecar is written alongside (also
 *               atomically) when refs are supplied.
 *
 * Atomicity: we write to `<path>.tmp` first, then rename onto `<path>`.
 * On Windows, `vscode.workspace.fs.rename` overwrites if the target exists
 * provided we pass `overwrite: true`. The temp file is removed on failure.
 *
 * The SHA-256 is taken over the exact bytes written (UTF-8 markdown), giving
 * the webview a stable content hash for change-detection / cache-busting.
 *
 * Sprint 1 Definition of Done: list + read + save round-trip.
 */

import * as crypto from "node:crypto"
import * as vscode from "vscode"

const CONTRACTS_DIR = ".kilo/contracts"

export interface ContractMeta {
  /** Workspace-relative path, e.g. ".kilo/contracts/prd-vintage-cameras.md". */
  path: string
  /** Display name (basename without extension). */
  name: string
  /** Last modification time (ms since epoch), 0 if unknown. */
  mtimeMs: number
  /** File size in bytes, 0 if unknown. */
  size: number
}

export interface RefEntry {
  id: string
  source: string
  url?: string
  snippet?: string
  fetchedAt?: number
}

export interface RefsSidecar {
  version: 1
  refs: RefEntry[]
}

export interface ContractDoc {
  path: string
  markdown: string
  refs?: RefsSidecar
  /** SHA-256 of the markdown content (hex). */
  sha: string
  mtimeMs: number
}

export interface SaveResult {
  ok: boolean
  sha: string
  /** Populated when ok === false. */
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function workspaceRoot(): vscode.Uri | undefined {
  const folders = vscode.workspace.workspaceFolders
  return folders && folders.length > 0 ? folders[0].uri : undefined
}

function joinUri(base: vscode.Uri, ...parts: string[]): vscode.Uri {
  return vscode.Uri.joinPath(base, ...parts)
}

function sha256Hex(content: string | Uint8Array): string {
  const h = crypto.createHash("sha256")
  if (typeof content === "string") h.update(content, "utf8")
  else h.update(content)
  return h.digest("hex")
}

async function ensureDir(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(uri)
  } catch {
    // createDirectory is idempotent on the vscode FS, but some adapters throw
    // EEXIST. Swallow — if the dir is unusable, the subsequent writeFile fails.
  }
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri)
    return true
  } catch {
    return false
  }
}

function refsSidecarUriFor(mdUri: vscode.Uri): vscode.Uri {
  // Replace trailing ".md" with ".refs.json"; if no .md suffix, append.
  const path = mdUri.path
  const base = path.endsWith(".md") ? path.slice(0, -3) : path
  return mdUri.with({ path: `${base}.refs.json` })
}

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

export class DocStore {
  /** Enumerate contract markdowns in `${workspace}/.kilo/contracts/`. */
  async list(): Promise<ContractMeta[]> {
    const root = workspaceRoot()
    if (!root) return []
    const dir = joinUri(root, CONTRACTS_DIR)
    if (!(await exists(dir))) return []

    let entries: [string, vscode.FileType][] = []
    try {
      entries = await vscode.workspace.fs.readDirectory(dir)
    } catch {
      return []
    }

    const out: ContractMeta[] = []
    for (const [name, kind] of entries) {
      if (kind !== vscode.FileType.File) continue
      if (!name.endsWith(".md")) continue
      const fileUri = joinUri(dir, name)
      let mtimeMs = 0
      let size = 0
      try {
        const stat = await vscode.workspace.fs.stat(fileUri)
        mtimeMs = stat.mtime
        size = stat.size
      } catch {
        // best-effort
      }
      out.push({
        path: `${CONTRACTS_DIR}/${name}`,
        name: name.replace(/\.md$/, ""),
        mtimeMs,
        size,
      })
    }
    out.sort((a, b) => b.mtimeMs - a.mtimeMs)
    return out
  }

  /** Load a contract markdown plus its refs sidecar (if present). */
  async read(relPath: string): Promise<ContractDoc> {
    const root = workspaceRoot()
    if (!root) throw new Error("No workspace folder open")
    const fileUri = joinUri(root, relPath)
    const bytes = await vscode.workspace.fs.readFile(fileUri)
    const markdown = new TextDecoder("utf-8").decode(bytes)
    const sha = sha256Hex(bytes)

    let refs: RefsSidecar | undefined
    const sidecarUri = refsSidecarUriFor(fileUri)
    if (await exists(sidecarUri)) {
      try {
        const sidecarBytes = await vscode.workspace.fs.readFile(sidecarUri)
        const parsed = JSON.parse(new TextDecoder("utf-8").decode(sidecarBytes))
        if (parsed && typeof parsed === "object") {
          refs = parsed as RefsSidecar
        }
      } catch {
        // Corrupt sidecar — surface as missing refs rather than breaking the read.
      }
    }

    let mtimeMs = 0
    try {
      mtimeMs = (await vscode.workspace.fs.stat(fileUri)).mtime
    } catch {
      // ignore
    }

    return { path: relPath, markdown, refs, sha, mtimeMs }
  }

  /**
   * Atomic save: writes to `<path>.tmp` then renames over the target.
   * Returns the SHA-256 of the persisted content.
   */
  async save(relPath: string, markdown: string, refs?: RefsSidecar): Promise<SaveResult> {
    const root = workspaceRoot()
    if (!root) return { ok: false, sha: "", error: "No workspace folder open" }

    const fileUri = joinUri(root, relPath)
    const dirUri = vscode.Uri.joinPath(fileUri, "..")
    await ensureDir(dirUri)

    const bytes = new TextEncoder().encode(markdown)
    const sha = sha256Hex(bytes)
    const tmpUri = fileUri.with({ path: `${fileUri.path}.tmp` })

    try {
      await vscode.workspace.fs.writeFile(tmpUri, bytes)
      // Rename over target. `overwrite: true` is required because the file
      // typically already exists.
      await vscode.workspace.fs.rename(tmpUri, fileUri, { overwrite: true })
    } catch (err) {
      // Best-effort cleanup of temp file.
      try {
        await vscode.workspace.fs.delete(tmpUri, { useTrash: false })
      } catch {
        // ignore
      }
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, sha: "", error: `Save failed: ${msg}` }
    }

    if (refs) {
      const sidecarUri = refsSidecarUriFor(fileUri)
      const sidecarTmp = sidecarUri.with({ path: `${sidecarUri.path}.tmp` })
      try {
        const sidecarBytes = new TextEncoder().encode(JSON.stringify(refs, null, 2))
        await vscode.workspace.fs.writeFile(sidecarTmp, sidecarBytes)
        await vscode.workspace.fs.rename(sidecarTmp, sidecarUri, { overwrite: true })
      } catch (err) {
        try {
          await vscode.workspace.fs.delete(sidecarTmp, { useTrash: false })
        } catch {
          // ignore
        }
        // Markdown saved successfully; surface refs error in the message but
        // still report ok=true so the caller knows the doc is durable.
        return {
          ok: true,
          sha,
          error: `Markdown saved but refs sidecar failed: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    }

    return { ok: true, sha }
  }
}

/** Singleton — Sprint 1 has no per-workspace state to scope. */
export const docStore = new DocStore()
