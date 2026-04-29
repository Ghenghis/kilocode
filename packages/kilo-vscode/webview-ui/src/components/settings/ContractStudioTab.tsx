/**
 * ContractStudioTab — Sprint 1 of the Contract Markdowns Studio.
 *
 * Spec: docs/CONTRACT_STUDIO_SPEC.md (Sprint 1 — "Editor + skeleton").
 *
 * Sprint 1 goal: user can create a blank `.md`, type, save, reopen.
 * Milkdown 7 + CM6 source-mode arrives in Sprint 2; for now the editor pane
 * is a plain `<textarea>` and the preview is a `<pre>` showing the raw
 * markdown source. This keeps the bundle budget at zero new deps.
 *
 * Layout (matches the spec ASCII art):
 *
 *   +--------+----------------+----------+
 *   |  TOC   |   EDITOR       | PREVIEW  |
 *   |  ~200  |   flex: 1      |  ~400    |
 *   +--------+----------------+----------+
 *   |  Chat drawer (collapsed by default) |
 *   +-------------------------------------+
 *
 * Outgoing messages (to extension host):
 *   • contract:list           — refresh TOC
 *   • contract:open           — load a doc into the editor
 *   • contract:save           — persist current doc
 *   • contract:enhancePrompt  — clarifying-question pass on chat input
 *   • contract:generate       — kick off draft generation
 *
 * Incoming messages (from extension host):
 *   • contract:list:result        — TOC contents
 *   • contract:open:result        — doc payload (path, markdown, sha)
 *   • contract:save:result        — { ok, sha, error? }
 *   • contract:generate:delta     — streaming draft chunk
 *   • contract:generate:done      — final marker
 *
 * Listener is registered in `onMount` and torn down in `onCleanup` so the
 * tab is safe to mount/unmount repeatedly.
 */

import { Component, createSignal, For, Show, onMount, onCleanup } from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { Button } from "@kilocode/kilo-ui/button"
import { useVSCode } from "../../context/vscode"
import { subscribeToMessages } from "../../lib/message-bus"
import GatesPanel from "./contract-studio/GatesPanel"
import SignOffPanel from "./contract-studio/SignOffPanel"
import EmptyState from "./contract-studio/EmptyState"

type ToolsTab = "gates" | "signoff" | "ai"

// ── Types ────────────────────────────────────────────────────────────────

interface ContractMeta {
  path: string
  name: string
  mtimeMs: number
  size: number
}

interface ContractDoc {
  path: string
  markdown: string
  sha: string
  mtimeMs: number
}

type Audience = "eng" | "exec" | "legal"
type Mode = "quick" | "deep"

const CONTRACTS_DIR = ".kilo/contracts"

// ── Small style tokens (mirrors WorkstationTab/OpenClawTab visual idiom) ─

const paneBorder = "1px solid var(--vscode-panel-border)"
const dimText = "var(--vscode-descriptionForeground)"
const editorBg = "var(--vscode-editor-background)"
const inputBg = "var(--vscode-input-background)"

// ── Helpers ──────────────────────────────────────────────────────────────

function defaultDocName(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`
  return `untitled-${stamp}.md`
}

function isContractMessage(t: unknown): t is string {
  return typeof t === "string" && t.startsWith("contract:")
}

// ── Component ────────────────────────────────────────────────────────────

const ContractStudioTab: Component = () => {
  const vscode = useVSCode()

  const [docs, setDocs] = createSignal<ContractMeta[]>([])
  const [activePath, setActivePath] = createSignal<string | null>(null)
  const [markdown, setMarkdown] = createSignal<string>("")
  const [savedSha, setSavedSha] = createSignal<string>("")
  const [dirty, setDirty] = createSignal(false)
  const [statusMsg, setStatusMsg] = createSignal<string>("Ready")
  const [audience, setAudience] = createSignal<Audience>("eng")
  const [mode, setMode] = createSignal<Mode>("quick")
  const [chatOpen, setChatOpen] = createSignal(false)
  const [chatInput, setChatInput] = createSignal("")
  const [streaming, setStreaming] = createSignal(false)
  const [toolsTab, setToolsTab] = createSignal<ToolsTab>("gates")
  const [previewVisible, setPreviewVisible] = createSignal(true)

  // ── Outgoing (typed loosely; the host accepts the contract:* envelope). ─
  // We cast to `never` to satisfy the strict WebviewMessage union when the
  // contract types overlap with V4SubsystemRequest.
  const post = (m: Record<string, unknown>) => vscode.postMessage(m as never)

  const refreshList = () => post({ type: "contract:list", workspaceOnly: true })

  const openDoc = (path: string) => post({ type: "contract:open", path })

  const newDoc = () => {
    const name = defaultDocName()
    const path = `${CONTRACTS_DIR}/${name}`
    setActivePath(path)
    setMarkdown("# " + name.replace(/\.md$/, "") + "\n\n")
    setSavedSha("")
    setDirty(true)
    setStatusMsg(`New: ${path}`)
  }

  const saveDoc = () => {
    const path = activePath()
    if (!path) {
      setStatusMsg("No active document — click 'New' first")
      return
    }
    setStatusMsg("Saving…")
    post({ type: "contract:save", path, markdown: markdown() })
  }

  const submitChat = (e: SubmitEvent) => {
    e.preventDefault()
    const text = chatInput().trim()
    if (!text) return
    setStreaming(true)
    setStatusMsg("Generating…")
    post({ type: "contract:enhancePrompt", rawIdea: text })
    post({
      type: "contract:generate",
      intent: { rawIdea: text, audience: audience() },
      mode: mode(),
      templateId: "default",
    })
    setChatInput("")
  }

  // ── Incoming message handler ──────────────────────────────────────────
  // Receives the unwrapped message payload directly from the shared bus.
  const onMessage = (raw: unknown) => {
    const msg = raw as { type?: unknown; [k: string]: unknown }
    if (!isContractMessage(msg?.type)) return
    switch (msg.type) {
      case "contract:list:result": {
        const list = (msg.docs as ContractMeta[] | undefined) ?? []
        setDocs(list)
        break
      }
      case "contract:open:result": {
        const doc = msg.doc as ContractDoc | undefined
        if (!doc) break
        setActivePath(doc.path)
        setMarkdown(doc.markdown ?? "")
        setSavedSha(doc.sha ?? "")
        setDirty(false)
        setStatusMsg(`Opened: ${doc.path}`)
        break
      }
      case "contract:save:result": {
        const ok = Boolean(msg.ok)
        const sha = typeof msg.sha === "string" ? msg.sha : ""
        if (ok) {
          setSavedSha(sha)
          setDirty(false)
          setStatusMsg(`Saved (sha ${sha.slice(0, 7)})`)
          refreshList()
        } else {
          const err = typeof msg.error === "string" ? msg.error : "Save failed"
          setStatusMsg(err)
        }
        break
      }
      case "contract:generate:delta": {
        const chunk = typeof msg.markdown === "string" ? msg.markdown : ""
        if (chunk) setMarkdown((prev) => prev + chunk)
        setDirty(true)
        break
      }
      case "contract:generate:done": {
        setStreaming(false)
        setStatusMsg("Generation complete")
        break
      }
      case "contract:error": {
        const err = typeof msg.message === "string" ? msg.message : "Error"
        setStatusMsg(err)
        setStreaming(false)
        break
      }
      default:
        break
    }
  }

  let unsubscribe: (() => void) | undefined
  onMount(() => {
    unsubscribe = subscribeToMessages(onMessage)
    refreshList()
  })
  onCleanup(() => unsubscribe?.())

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        "min-height": "560px",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "8px 12px",
          "border-bottom": paneBorder,
          background: "var(--vscode-editorWidget-background)",
        }}
      >
        <Button variant="ghost" size="small" onClick={newDoc} title="Create a new contract">
          <Icon name="plus" size="small" />
          <span style={{ "margin-left": "4px" }}>New</span>
        </Button>
        <Button variant="ghost" size="small" onClick={refreshList} title="Refresh contract list">
          <Icon name="reset" size="small" />
          <span style={{ "margin-left": "4px" }}>Open</span>
        </Button>
        <Button
          variant="primary"
          size="small"
          onClick={saveDoc}
          disabled={!activePath() || !dirty()}
          title="Save the active contract"
        >
          <Icon name="check" size="small" />
          <span style={{ "margin-left": "4px" }}>Save</span>
        </Button>
        <div style={{ flex: 1 }} />
        <label style={{ "font-size": "12px", color: dimText }}>Audience</label>
        <select
          value={audience()}
          onChange={(e) => setAudience(e.currentTarget.value as Audience)}
          style={{
            background: inputBg,
            color: "var(--vscode-input-foreground)",
            border: "1px solid var(--vscode-input-border)",
            "border-radius": "3px",
            padding: "2px 6px",
            "font-size": "12px",
          }}
        >
          <option value="eng">Eng</option>
          <option value="exec">Exec</option>
          <option value="legal">Legal</option>
        </select>
        <label style={{ "font-size": "12px", color: dimText, "margin-left": "8px" }}>Mode</label>
        <select
          value={mode()}
          onChange={(e) => setMode(e.currentTarget.value as Mode)}
          style={{
            background: inputBg,
            color: "var(--vscode-input-foreground)",
            border: "1px solid var(--vscode-input-border)",
            "border-radius": "3px",
            padding: "2px 6px",
            "font-size": "12px",
          }}
        >
          <option value="quick">Quick</option>
          <option value="deep">Deep</option>
        </select>
      </div>

      {/* Three-pane body */}
      <div style={{ display: "flex", flex: 1, "min-height": 0 }}>
        {/* TOC */}
        <div
          style={{
            width: "200px",
            "border-right": paneBorder,
            overflow: "auto",
            background: "var(--vscode-sideBar-background)",
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              "font-size": "11px",
              "text-transform": "uppercase",
              "letter-spacing": "0.05em",
              color: dimText,
              "border-bottom": paneBorder,
            }}
          >
            Contracts ({docs().length})
          </div>
          <Show
            when={docs().length > 0}
            fallback={
              <div style={{ padding: "12px", "font-size": "12px", color: dimText }}>
                No contracts yet. Click <strong>New</strong> to create one.
              </div>
            }
          >
            <ul style={{ "list-style": "none", margin: 0, padding: 0 }}>
              <For each={docs()}>
                {(doc) => (
                  <li>
                    <button
                      type="button"
                      onClick={() => openDoc(doc.path)}
                      style={{
                        display: "block",
                        width: "100%",
                        "text-align": "left",
                        padding: "6px 10px",
                        "font-size": "12px",
                        background: doc.path === activePath() ? "var(--vscode-list-activeSelectionBackground)" : "transparent",
                        color:
                          doc.path === activePath()
                            ? "var(--vscode-list-activeSelectionForeground)"
                            : "var(--vscode-foreground)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {doc.name}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>

        {/* Editor — when no doc is active and the user has nothing typed, show
            the non-coder EmptyState so they can describe what they want to
            build instead of staring at a blank textarea. */}
        <div style={{ flex: 1, display: "flex", "flex-direction": "column", "min-width": 0 }}>
          <div
            style={{
              padding: "6px 10px",
              "font-size": "11px",
              "text-transform": "uppercase",
              "letter-spacing": "0.05em",
              color: dimText,
              "border-bottom": paneBorder,
            }}
          >
            Editor — {activePath() ?? "no document"}
            <Show when={dirty()}>
              <span style={{ "margin-left": "6px", color: "var(--vscode-gitDecoration-modifiedResourceForeground)" }}>•</span>
            </Show>
          </div>
          <Show
            when={activePath() || markdown()}
            fallback={<EmptyState />}
          >
            <textarea
              value={markdown()}
              onInput={(e) => {
                setMarkdown(e.currentTarget.value)
                setDirty(true)
              }}
              placeholder="# Start typing your contract markdown here…"
              spellcheck={false}
              style={{
                flex: 1,
                width: "100%",
                padding: "12px",
                "font-family": "var(--vscode-editor-font-family, monospace)",
                "font-size": "13px",
                "line-height": "1.5",
                background: editorBg,
                color: "var(--vscode-editor-foreground)",
                border: "none",
                outline: "none",
                resize: "none",
              }}
            />
          </Show>
        </div>

        {/* Preview */}
        <Show when={previewVisible()}>
          <div
            style={{
              width: "320px",
              "border-left": paneBorder,
              overflow: "auto",
              background: "var(--vscode-editorWidget-background)",
              display: "flex",
              "flex-direction": "column",
            }}
          >
            <div
              style={{
                padding: "6px 10px",
                "font-size": "11px",
                "text-transform": "uppercase",
                "letter-spacing": "0.05em",
                color: dimText,
                "border-bottom": paneBorder,
                display: "flex",
                "align-items": "center",
                gap: "6px",
              }}
            >
              <span style={{ flex: 1 }}>Preview (raw markdown)</span>
              <button
                type="button"
                onClick={() => setPreviewVisible(false)}
                title="Hide preview"
                style={{
                  background: "transparent",
                  color: dimText,
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <Icon name="close" size="small" />
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: "12px",
                flex: 1,
                "white-space": "pre-wrap",
                "word-break": "break-word",
                "font-size": "12px",
                "font-family": "var(--vscode-editor-font-family, monospace)",
                color: "var(--vscode-foreground)",
              }}
            >
              {markdown() || "(empty)"}
            </pre>
          </div>
        </Show>

        {/* Tools rail — non-coder gates, sign-off, AI thread */}
        <div
          style={{
            width: "340px",
            "border-left": paneBorder,
            background: "var(--vscode-sideBar-background)",
            display: "flex",
            "flex-direction": "column",
            "min-width": 0,
          }}
          aria-label="Tools rail"
        >
          {/* Tools rail tab strip */}
          <div
            role="tablist"
            style={{
              display: "flex",
              "border-bottom": paneBorder,
              background: "var(--vscode-editorWidget-background)",
            }}
          >
            <For each={[
              { id: "gates" as ToolsTab, label: "Gates" },
              { id: "signoff" as ToolsTab, label: "Sign-off" },
              { id: "ai" as ToolsTab, label: "AI" },
            ]}>
              {(tab) => (
                <button
                  role="tab"
                  type="button"
                  aria-selected={toolsTab() === tab.id}
                  onClick={() => setToolsTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: "8px 6px",
                    "font-size": "12px",
                    background: toolsTab() === tab.id ? "var(--vscode-tab-activeBackground)" : "transparent",
                    color: toolsTab() === tab.id ? "var(--vscode-tab-activeForeground)" : dimText,
                    border: "none",
                    "border-bottom": toolsTab() === tab.id
                      ? "2px solid var(--vscode-focusBorder)"
                      : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              )}
            </For>
            <Show when={!previewVisible()}>
              <button
                type="button"
                onClick={() => setPreviewVisible(true)}
                title="Show preview"
                style={{
                  padding: "8px",
                  background: "transparent",
                  border: "none",
                  color: dimText,
                  cursor: "pointer",
                }}
              >
                <Icon name="eye" size="small" />
              </button>
            </Show>
          </div>

          {/* Tools rail body */}
          <div style={{ flex: 1, "min-height": 0, overflow: "hidden" }}>
            <Show when={toolsTab() === "gates"}>
              <GatesPanel docPath={activePath() ?? undefined} markdown={markdown()} docType="prd" />
            </Show>
            <Show when={toolsTab() === "signoff"}>
              <SignOffPanel docPath={activePath() ?? undefined} />
            </Show>
            <Show when={toolsTab() === "ai"}>
              <div style={{ padding: "12px", "font-size": "12px", color: dimText }}>
                AI thread arrives in Sprint 2. For now, use the chat drawer below.
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Chat drawer */}
      <div style={{ "border-top": paneBorder }}>
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          style={{
            display: "flex",
            "align-items": "center",
            gap: "6px",
            width: "100%",
            padding: "6px 10px",
            background: "var(--vscode-editorWidget-background)",
            color: "var(--vscode-foreground)",
            border: "none",
            cursor: "pointer",
            "font-size": "12px",
            "text-align": "left",
          }}
          title="Toggle the doc-scoped AI chat drawer"
        >
          <Icon name={chatOpen() ? "chevron-down" : "chevron-right"} size="small" />
          <span>Chat ({chatOpen() ? "open" : "collapsed"})</span>
          <Show when={streaming()}>
            <span style={{ "margin-left": "8px", color: dimText }}>streaming…</span>
          </Show>
        </button>
        <Show when={chatOpen()}>
          <form
            onSubmit={submitChat}
            style={{ display: "flex", gap: "6px", padding: "8px 10px", "border-top": paneBorder }}
          >
            <input
              type="text"
              value={chatInput()}
              onInput={(e) => setChatInput(e.currentTarget.value)}
              placeholder="What are you building? (Quick = <30s, Deep = full critic loop)"
              style={{
                flex: 1,
                padding: "6px 8px",
                "font-size": "12px",
                background: inputBg,
                color: "var(--vscode-input-foreground)",
                border: "1px solid var(--vscode-input-border)",
                "border-radius": "3px",
              }}
            />
            <Button variant="primary" size="small" type="submit" disabled={streaming() || !chatInput().trim()}>
              {streaming() ? "Generating…" : "Generate"}
            </Button>
          </form>
        </Show>
      </div>

      {/* Status rail */}
      <div
        style={{
          padding: "4px 10px",
          "border-top": paneBorder,
          "font-size": "11px",
          color: dimText,
          background: "var(--vscode-statusBar-background, var(--vscode-editorWidget-background))",
        }}
      >
        {statusMsg()}
      </div>
    </div>
  )
}

export default ContractStudioTab
