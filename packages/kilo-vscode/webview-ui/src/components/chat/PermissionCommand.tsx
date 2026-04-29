/**
 * PermissionCommand component
 * Renders a bash command with preserved newlines, scrollable when long.
 * Includes a copy-to-clipboard button that appears on hover.
 */

import { Component, createSignal, onCleanup } from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { Tooltip } from "@kilocode/kilo-ui/tooltip"
import { useLanguage } from "../../context/language"

export const PermissionCommand: Component<{ command: string }> = (props) => {
  const language = useLanguage()
  const [copied, setCopied] = createSignal(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(copyTimer))

  const copy = () => {
    navigator.clipboard.writeText(props.command)
    setCopied(true)
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div data-slot="permission-command">
      <pre data-slot="permission-command-pre">{props.command}</pre>
      <Tooltip value={language.t("ui.permission.copyCommand")} placement="top">
        <button
          data-slot="permission-command-copy"
          data-copied={copied() ? "" : undefined}
          onClick={copy}
          aria-label={language.t("ui.permission.copyCommand")}
        >
          <Icon name={copied() ? "check-small" : "copy"} size="small" />
        </button>
      </Tooltip>
    </div>
  )
}
