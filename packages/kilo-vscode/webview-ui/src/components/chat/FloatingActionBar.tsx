/**
 * FloatingActionBar component
 * Persistent floating bar at the bottom of the chat view with quick-access buttons.
 * Collapses to a single "+" button when not focused/hovered.
 */

import { Component, Show, createSignal, onCleanup } from "solid-js"
import { Tooltip } from "@kilocode/kilo-ui/tooltip"
import { useVSCode } from "../../context/vscode"
import { useSession } from "../../context/session"

interface FloatingActionBarProps {
  onOpenCommandBar?: () => void
  onOpenTemplates?: () => void
}

export const FloatingActionBar: Component<FloatingActionBarProps> = (props) => {
  const vscode = useVSCode()
  const session = useSession()
  const [expanded, setExpanded] = createSignal(false)
  const [modelDropdownOpen, setModelDropdownOpen] = createSignal(false)
  const [agentDropdownOpen, setAgentDropdownOpen] = createSignal(false)

  let barRef: HTMLDivElement | undefined

  const handleFocusIn = () => { setExpanded(true) }
  const handleFocusOut = (e: FocusEvent) => {
    // Only collapse if focus leaves the bar entirely
    if (barRef && !barRef.contains(e.relatedTarget as Node)) {
      setExpanded(false)
      setModelDropdownOpen(false)
      setAgentDropdownOpen(false)
    }
  }

  const handleMouseEnter = () => { setExpanded(true) }
  const handleMouseLeave = () => {
    if (!modelDropdownOpen() && !agentDropdownOpen()) setExpanded(false)
  }

  const attachFile = () => {
    vscode.postMessage({ type: "selectImages" })
    setExpanded(false)
  }

  const attachScreenshot = () => {
    vscode.postMessage({ type: "captureEditorScreenshot" })
    setExpanded(false)
  }

  const switchModel = () => {
    setModelDropdownOpen((v) => !v)
    setAgentDropdownOpen(false)
  }

  const selectAgent = (agentName: string) => {
    session.selectAgent(agentName)
    setAgentDropdownOpen(false)
    setExpanded(false)
  }

  const applyPreset = () => {
    // Dispatch event to open preset picker
    window.dispatchEvent(new CustomEvent("openPresetPicker"))
    setExpanded(false)
  }

  const availableAgents = () => session.agents().filter((a) => a.mode !== "subagent" && !a.hidden)

  return (
    <div
      ref={barRef}
      class="floating-action-bar"
      classList={{ "floating-action-bar--expanded": expanded() }}
      onFocusIn={handleFocusIn}
      onFocusOut={handleFocusOut}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="toolbar"
      aria-label="Quick actions"
    >
      <Show
        when={expanded()}
        fallback={
          <Tooltip value="Quick actions" placement="top">
            <button
              class="fab-toggle-btn"
              onClick={() => setExpanded(true)}
              aria-label="Expand quick actions"
              aria-expanded={expanded()}
            >
              <span class="fab-plus-icon" aria-hidden="true">+</span>
            </button>
          </Tooltip>
        }
      >
        <div class="fab-actions">
          <Tooltip value="Attach file" placement="top">
            <button class="fab-action-btn" onClick={attachFile} aria-label="Attach file (click to browse)">
              <span class="fab-action-icon" aria-hidden="true">&#128206;</span>
              <span class="fab-action-label">File</span>
            </button>
          </Tooltip>

          <Tooltip value="Capture editor screenshot" placement="top">
            <button class="fab-action-btn" onClick={attachScreenshot} aria-label="Attach screenshot of editor">
              <span class="fab-action-icon" aria-hidden="true">&#128444;</span>
              <span class="fab-action-label">Screenshot</span>
            </button>
          </Tooltip>

          <div class="fab-dropdown-wrapper">
            <Tooltip value="Switch model" placement="top">
              <button
                class="fab-action-btn"
                classList={{ "fab-action-btn--active": modelDropdownOpen() }}
                onClick={switchModel}
                aria-label="Switch AI model"
                aria-haspopup="listbox"
                aria-expanded={modelDropdownOpen()}
                aria-controls="fab-model-dropdown"
              >
                <span class="fab-action-icon" aria-hidden="true">&#8644;</span>
                <span class="fab-action-label">Model</span>
              </button>
            </Tooltip>
            <Show when={modelDropdownOpen()}>
              <div id="fab-model-dropdown" class="fab-dropdown fab-model-dropdown" role="listbox" aria-label="Select model">
                <div class="fab-dropdown-header">Switch Model</div>
                <button
                  class="fab-dropdown-item"
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    // Trigger the existing ModelSelector by dispatching a custom event
                    window.dispatchEvent(new CustomEvent("openModelSelector"))
                    setModelDropdownOpen(false)
                    setExpanded(false)
                  }}
                >
                  Open model selector
                </button>
              </div>
            </Show>
          </div>

          <div class="fab-dropdown-wrapper">
            <Tooltip value="Select agent" placement="top">
              <button
                class="fab-action-btn"
                classList={{ "fab-action-btn--active": agentDropdownOpen() }}
                onClick={() => {
                  setAgentDropdownOpen((v) => !v)
                  setModelDropdownOpen(false)
                }}
                aria-label="Select MAOS agent"
                aria-haspopup="listbox"
                aria-expanded={agentDropdownOpen()}
                aria-controls="fab-agent-dropdown"
              >
                <span class="fab-action-icon" aria-hidden="true">&#127919;</span>
                <span class="fab-action-label">Agent</span>
              </button>
            </Tooltip>
            <Show when={agentDropdownOpen()}>
              <div id="fab-agent-dropdown" class="fab-dropdown fab-agent-dropdown" role="listbox" aria-label="Select agent">
                <div class="fab-dropdown-header">Select Agent</div>
                {availableAgents().map((agent) => (
                  <button
                    class="fab-dropdown-item"
                    classList={{ "fab-dropdown-item--active": session.selectedAgent() === agent.name }}
                    role="option"
                    aria-selected={session.selectedAgent() === agent.name}
                    onClick={() => selectAgent(agent.name)}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            </Show>
          </div>

          <Tooltip value="Apply preset" placement="top">
            <button class="fab-action-btn" onClick={applyPreset} aria-label="Apply prompt preset">
              <span class="fab-action-icon" aria-hidden="true">&#9889;</span>
              <span class="fab-action-label">Preset</span>
            </button>
          </Tooltip>

          <button
            class="fab-collapse-btn"
            onClick={() => {
              setExpanded(false)
              setModelDropdownOpen(false)
              setAgentDropdownOpen(false)
            }}
            aria-label="Collapse quick actions"
            aria-expanded={expanded()}
          >
            <span aria-hidden="true">&#215;</span>
          </button>
        </div>
      </Show>
    </div>
  )
}
