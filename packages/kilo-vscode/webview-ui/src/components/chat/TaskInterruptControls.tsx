/**
 * TaskInterruptControls — mid-task control bar shown while a session is busy.
 *
 * Provides three actions:
 *   1. Pause task  — sends `{ type: "pauseTask", sessionId }` via vscode.postMessage.
 *                    (The extension/backend can implement the actual pause; this sends
 *                     the canonical IPC message defined in 05_CHAT_TASK_FLOW.md.)
 *   2. Redirect    — text input + "Send" to inject a new instruction mid-task.
 *                    Sends `{ type: "newMessage", text }` which the session handler
 *                    will queue as the next user prompt.
 *   3. Hand off    — agent picker dropdown + "Hand Off" to route remaining work to a
 *                    specific MAOS agent via `{ type: "setSessionMode", modeId }`.
 *
 * The bar is only rendered while session.status() === "busy".
 */

import { Component, Show, createSignal, For } from "solid-js"
import { Button } from "@kilocode/kilo-ui/button"
import { Icon } from "@kilocode/kilo-ui/icon"
import { useSession } from "../../context/session"
import { useVSCode } from "../../context/vscode"
import { MAOS_AGENTS } from "./AgentStatusPanel"

export const TaskInterruptControls: Component = () => {
  const session = useSession()
  const vscode = useVSCode()

  const [redirectText, setRedirectText] = createSignal("")
  const [handoffAgent, setHandoffAgent] = createSignal<string>("")
  const [mode, setMode] = createSignal<"none" | "redirect" | "handoff">("none")

  const busy = () => session.status() === "busy"
  const sid = () => session.currentSessionID()

  // ── Pause ───────────────────────────────────────────────────────────

  const handlePause = () => {
    const id = sid()
    if (!id) return
    vscode.postMessage({ type: "pauseTask", sessionId: id } as never)
  }

  // ── Redirect ─────────────────────────────────────────────────────────

  const handleRedirect = () => {
    const text = redirectText().trim()
    if (!text) return
    session.sendMessage(text)
    setRedirectText("")
    setMode("none")
  }

  // ── Hand off ──────────────────────────────────────────────────────────

  const handleHandOff = () => {
    const id = sid()
    const agentId = handoffAgent()
    if (!id || !agentId) return
    const agent = MAOS_AGENTS.find((a) => a.id === agentId)
    if (!agent) return
    // Set the session mode to the chosen agent
    session.setSessionAgent(id, agent.name)
    vscode.postMessage({ type: "setSessionMode", sessionId: id, modeId: agent.name } as never)
    setHandoffAgent("")
    setMode("none")
  }

  return (
    <Show when={busy()}>
      <div class="tic-root" role="toolbar" aria-label="Task interrupt controls">
        {/* Hidden consequence descriptions for screen readers */}
        <span id="tic-pause-desc" class="sr-only">
          Sends a pause request to the running task. The task will stop after the current step.
        </span>
        <span id="tic-redirect-desc" class="sr-only">
          Opens a text field to inject a new instruction into the running task.
        </span>
        <span id="tic-handoff-desc" class="sr-only">
          Opens an agent picker to route the remaining work to a different MAOS agent.
        </span>

        {/* Primary action row */}
        <div class="tic-row">
          {/* Pause */}
          <Button
            variant="secondary"
            size="small"
            onClick={handlePause}
            class="tic-btn tic-btn--pause"
            aria-label="Pause task"
            aria-describedby="tic-pause-desc"
          >
            <Icon name="pause" size="small" aria-hidden="true" />
            Pause
          </Button>

          {/* Redirect toggle */}
          <Button
            variant={mode() === "redirect" ? "primary" : "ghost"}
            size="small"
            onClick={() => setMode((m) => (m === "redirect" ? "none" : "redirect"))}
            class="tic-btn"
            aria-label="Redirect task"
            aria-expanded={mode() === "redirect"}
            aria-controls="tic-redirect-panel"
            aria-describedby="tic-redirect-desc"
          >
            <Icon name="edit" size="small" aria-hidden="true" />
            Redirect
          </Button>

          {/* Hand off toggle */}
          <Button
            variant={mode() === "handoff" ? "primary" : "ghost"}
            size="small"
            onClick={() => setMode((m) => (m === "handoff" ? "none" : "handoff"))}
            class="tic-btn"
            aria-label="Hand off to agent"
            aria-expanded={mode() === "handoff"}
            aria-controls="tic-handoff-panel"
            aria-describedby="tic-handoff-desc"
          >
            <Icon name="arrow-right" size="small" aria-hidden="true" />
            Hand Off
          </Button>
        </div>

        {/* Redirect input */}
        <Show when={mode() === "redirect"}>
          <div
            id="tic-redirect-panel"
            class="tic-expand"
            role="alertdialog"
            aria-label="Redirect running task"
            aria-describedby="tic-redirect-prompt-desc"
          >
            <span id="tic-redirect-prompt-desc" class="sr-only">
              Type a new instruction and press Send to redirect the running task.
            </span>
            <input
              class="tic-input"
              type="text"
              placeholder="Add new instruction for the running task…"
              value={redirectText()}
              onInput={(e) => setRedirectText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleRedirect()
                }
                if (e.key === "Escape") setMode("none")
              }}
              aria-label="New redirect instruction"
              autofocus
            />
            <Button
              variant="primary"
              size="small"
              onClick={handleRedirect}
              disabled={!redirectText().trim()}
              aria-label="Send redirect instruction"
            >
              Send
            </Button>
          </div>
        </Show>

        {/* Agent picker for hand-off */}
        <Show when={mode() === "handoff"}>
          <div
            id="tic-handoff-panel"
            class="tic-expand"
            role="alertdialog"
            aria-label="Hand off task to agent"
            aria-describedby="tic-handoff-prompt-desc"
          >
            <span id="tic-handoff-prompt-desc" class="sr-only">
              Choose a MAOS agent to take over the current task, then press Hand Off to confirm.
            </span>
            <select
              class="tic-select"
              value={handoffAgent()}
              onChange={(e) => setHandoffAgent(e.currentTarget.value)}
              aria-label="Select agent for hand-off"
            >
              <option value="">— choose agent —</option>
              <For each={MAOS_AGENTS}>
                {(agent) => (
                  <option value={agent.id}>
                    {agent.name}
                  </option>
                )}
              </For>
            </select>
            <Button
              variant="primary"
              size="small"
              onClick={handleHandOff}
              disabled={!handoffAgent()}
              aria-label="Confirm hand off to selected agent"
            >
              Hand Off
            </Button>
          </div>
        </Show>
      </div>
    </Show>
  )
}
