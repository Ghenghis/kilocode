/**
 * tab-status-badges.tsx
 *
 * Reusable status-indicator components for KiloCode settings tabs.
 * All components rely on VS Code CSS variables so they stay theme-compatible.
 *
 * Exports:
 *   StatusBadge    — pill badge with semantic color variants
 *   PulseDot       — animated pulsing dot for "live / connected" signals
 *   CountBadge     — numeric badge for queues, alert counts, etc.
 *   HealthIndicator — traffic-light dot + label for service health
 */

import { Component, JSX, Show } from "solid-js"

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Semantic color variants that map to VS Code theme tokens */
export type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral"

/** Maps variant → CSS color value using VS Code variables */
const variantColors: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
  success: {
    bg: "var(--vscode-testing-iconPassed, #2ea043)",
    fg: "var(--vscode-editor-background, #fff)",
    border: "var(--vscode-testing-iconPassed, #2ea043)",
  },
  warning: {
    bg: "var(--vscode-editorWarning-foreground, #cca700)",
    fg: "var(--vscode-editor-background, #fff)",
    border: "var(--vscode-editorWarning-foreground, #cca700)",
  },
  error: {
    bg: "var(--vscode-errorForeground, #f14c4c)",
    fg: "var(--vscode-editor-background, #fff)",
    border: "var(--vscode-errorForeground, #f14c4c)",
  },
  info: {
    bg: "var(--vscode-debugIcon-startForeground, #007acc)",
    fg: "var(--vscode-editor-background, #fff)",
    border: "var(--vscode-debugIcon-startForeground, #007acc)",
  },
  neutral: {
    bg: "var(--vscode-badge-background)",
    fg: "var(--vscode-badge-foreground)",
    border: "var(--vscode-badge-background)",
  },
}

// ---------------------------------------------------------------------------
// StatusBadge — pill-shaped label badge
// ---------------------------------------------------------------------------

export interface StatusBadgeProps {
  /** Semantic variant controls the background color */
  variant?: BadgeVariant
  /** Text content inside the pill */
  children: JSX.Element
  /** Optional title for accessibility tooltip */
  title?: string
  /** Additional inline styles */
  style?: JSX.CSSProperties
  class?: string
}

export const StatusBadge: Component<StatusBadgeProps> = (props) => {
  const v = () => props.variant ?? "neutral"
  const colors = () => variantColors[v()]

  return (
    <span
      title={props.title}
      class={props.class}
      style={{
        display: "inline-flex",
        "align-items": "center",
        padding: "1px 7px",
        "border-radius": "10px",
        "font-size": "10px",
        "font-weight": "600",
        "letter-spacing": "0.03em",
        "white-space": "nowrap",
        background: colors().bg,
        color: colors().fg,
        border: `1px solid ${colors().border}`,
        "line-height": "16px",
        ...props.style,
      }}
    >
      {props.children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// PulseDot — animated "live" indicator dot
// ---------------------------------------------------------------------------

export interface PulseDotProps {
  /** Color variant; defaults to "success" */
  variant?: BadgeVariant
  /** Dot diameter in px; defaults to 8 */
  size?: number
  /** Accessible label (screen-reader) */
  "aria-label"?: string
  style?: JSX.CSSProperties
  class?: string
}

/**
 * Renders a small dot with a CSS keyframe pulse animation indicating a live
 * or active connection state. The animation is defined once and injected as a
 * `<style>` element (idempotent — duplicate injections are guarded by id).
 */
export const PulseDot: Component<PulseDotProps> = (props) => {
  // Inject keyframe CSS once into the document (no-op if already present)
  if (typeof document !== "undefined" && !document.getElementById("kc-pulse-dot-style")) {
    const style = document.createElement("style")
    style.id = "kc-pulse-dot-style"
    style.textContent = `
      @keyframes kc-pulse {
        0%   { transform: scale(1);   opacity: 1;   }
        50%  { transform: scale(1.6); opacity: 0.4; }
        100% { transform: scale(1);   opacity: 1;   }
      }
      .kc-pulse-dot {
        border-radius: 50%;
        animation: kc-pulse 2s ease-in-out infinite;
        display: inline-block;
        flex-shrink: 0;
      }
    `
    document.head.appendChild(style)
  }

  const v = () => props.variant ?? "success"
  const size = () => props.size ?? 8
  const color = () => variantColors[v()].bg

  return (
    <span
      role="status"
      aria-label={props["aria-label"] ?? "live indicator"}
      class={`kc-pulse-dot${props.class ? ` ${props.class}` : ""}`}
      style={{
        width: `${size()}px`,
        height: `${size()}px`,
        background: color(),
        "box-shadow": `0 0 0 2px ${color()}40`,
        ...props.style,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// CountBadge — numeric count badge
// ---------------------------------------------------------------------------

export interface CountBadgeProps {
  /** The number to display */
  count: number
  /** Color variant; defaults to "neutral" */
  variant?: BadgeVariant
  /** If count exceeds this, display "{max}+" instead */
  max?: number
  /** Hide the badge entirely when count is 0 */
  hideWhenZero?: boolean
  title?: string
  style?: JSX.CSSProperties
  class?: string
}

export const CountBadge: Component<CountBadgeProps> = (props) => {
  const max = () => props.max ?? 99
  const shouldHide = () => props.hideWhenZero && props.count === 0
  const displayValue = () => (props.count > max() ? `${max()}+` : String(props.count))
  const v = () => props.variant ?? "neutral"
  const colors = () => variantColors[v()]

  return (
    <Show when={!shouldHide()}>
      <span
        title={props.title ?? `${props.count} item${props.count !== 1 ? "s" : ""}`}
        class={props.class}
        style={{
          display: "inline-flex",
          "align-items": "center",
          "justify-content": "center",
          "min-width": "18px",
          height: "18px",
          padding: "0 5px",
          "border-radius": "9px",
          "font-size": "10px",
          "font-weight": "700",
          "white-space": "nowrap",
          background: colors().bg,
          color: colors().fg,
          "line-height": "1",
          ...props.style,
        }}
      >
        {displayValue()}
      </span>
    </Show>
  )
}

// ---------------------------------------------------------------------------
// HealthIndicator — traffic-light dot + text label
// ---------------------------------------------------------------------------

export type HealthStatus = "healthy" | "degraded" | "error" | "unknown"

export interface HealthIndicatorProps {
  /** Service health status */
  status: HealthStatus
  /** Human-readable label shown next to the dot */
  label?: string
  /** Show the dot only (no label) */
  dotOnly?: boolean
  style?: JSX.CSSProperties
  class?: string
}

const healthDotColor: Record<HealthStatus, string> = {
  healthy: "var(--vscode-testing-iconPassed, #2ea043)",
  degraded: "var(--vscode-editorWarning-foreground, #cca700)",
  error: "var(--vscode-errorForeground, #f14c4c)",
  unknown: "var(--vscode-descriptionForeground, #6e7681)",
}

const healthLabel: Record<HealthStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  error: "Error",
  unknown: "Unknown",
}

export const HealthIndicator: Component<HealthIndicatorProps> = (props) => {
  const dotColor = () => healthDotColor[props.status]
  const text = () => props.label ?? healthLabel[props.status]

  return (
    <span
      role="status"
      aria-label={`Service status: ${text()}`}
      class={props.class}
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: "5px",
        "font-size": "11px",
        color: "var(--vscode-foreground)",
        ...props.style,
      }}
    >
      {/* Traffic-light dot */}
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          "border-radius": "50%",
          background: dotColor(),
          "flex-shrink": "0",
        }}
      />
      <Show when={!props.dotOnly}>
        <span>{text()}</span>
      </Show>
    </span>
  )
}
