/**
 * tab-icons.tsx
 *
 * Custom inline SVG icon components for KiloCode's custom settings tabs.
 * Each icon is 16×16 with viewBox="0 0 16 16" and uses `currentColor` so
 * they automatically adopt the VS Code theme foreground color.
 *
 * Usage:
 *   import { OpenClawIcon } from "./tab-icons"
 *   <OpenClawIcon />
 *   <OpenClawIcon width={24} height={24} />  // scale up if needed
 */

import { Component, JSX } from "solid-js"

interface IconProps {
  width?: number | string
  height?: number | string
  class?: string
  style?: JSX.CSSProperties
  "aria-hidden"?: boolean
}

const defaults: IconProps = {
  width: 16,
  height: 16,
  "aria-hidden": true,
}

// ---------------------------------------------------------------------------
// ZeroClawIcon — Shield with circuit-board paths
// Represents protected, multi-endpoint execution with hardware-level isolation
// ---------------------------------------------------------------------------
export const ZeroClawIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Shield outline */}
    <path d="M8 1.5 L13.5 3.5 L13.5 8.5 C13.5 11.5 8 14.5 8 14.5 C8 14.5 2.5 11.5 2.5 8.5 L2.5 3.5 Z" />
    {/* Circuit horizontal trace */}
    <line x1="5" y1="7" x2="7" y2="7" />
    {/* Circuit node left */}
    <circle cx="4.5" cy="7" r="0.75" fill="currentColor" stroke="none" />
    {/* Circuit horizontal trace right */}
    <line x1="9" y1="7" x2="11" y2="7" />
    {/* Circuit node right */}
    <circle cx="11.5" cy="7" r="0.75" fill="currentColor" stroke="none" />
    {/* Circuit vertical drop */}
    <line x1="8" y1="7" x2="8" y2="10" />
    {/* Circuit node center */}
    <circle cx="8" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    {/* Circuit node bottom */}
    <circle cx="8" cy="10.5" r="0.75" fill="currentColor" stroke="none" />
    {/* Cross trace */}
    <line x1="7" y1="7" x2="9" y2="7" />
  </svg>
)

// ---------------------------------------------------------------------------
// OpenClawIcon — Lobster claw gripping a speech bubble
// Playful brand mark for the OpenClaw API-gateway / chat relay
// ---------------------------------------------------------------------------
export const OpenClawIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Chat bubble body */}
    <path d="M3 2.5 L11 2.5 Q12.5 2.5 12.5 4 L12.5 7.5 Q12.5 9 11 9 L7.5 9 L5.5 11 L5.5 9 L3 9 Q1.5 9 1.5 7.5 L1.5 4 Q1.5 2.5 3 2.5 Z" />
    {/* Claw upper arm — comes from bottom-right */}
    <path d="M10.5 10 C11.5 10.5 13 10 13.5 11.5 C14 13 12.5 14.5 11 13.5" />
    {/* Claw lower arm */}
    <path d="M9.5 11.5 C10 12.5 9.5 14 8.5 14 C7.5 14 7 13 7.5 12" />
    {/* Claw pivot joint */}
    <circle cx="10" cy="10.5" r="0.75" fill="currentColor" stroke="none" />
  </svg>
)

// ---------------------------------------------------------------------------
// HermesIcon — Winged envelope with speed lines
// Represents the Hermes message-pipeline / async delivery system
// ---------------------------------------------------------------------------
export const HermesIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Envelope body */}
    <rect x="3.5" y="5" width="9" height="7" rx="0.75" />
    {/* Envelope flap / V-fold */}
    <polyline points="3.5,5.5 8,9 12.5,5.5" />
    {/* Left wing — upper feather */}
    <path d="M3.5 6 C2.5 5 1.5 4 1 3 C2 3.25 3 4 3.5 5" />
    {/* Left wing — lower feather */}
    <path d="M3.5 7.5 C2 7 1 6 0.5 5 C1.5 5 2.5 6 3.5 7" />
    {/* Right wing — upper feather */}
    <path d="M12.5 6 C13.5 5 14.5 4 15 3 C14 3.25 13 4 12.5 5" />
    {/* Right wing — lower feather */}
    <path d="M12.5 7.5 C14 7 15 6 15.5 5 C14.5 5 13.5 6 12.5 7" />
    {/* Speed lines below envelope */}
    <line x1="5" y1="13.5" x2="8" y2="13.5" />
    <line x1="4" y1="14.5" x2="7" y2="14.5" />
  </svg>
)

// ---------------------------------------------------------------------------
// HubIcon — Hub-and-spoke network node
// Central operations node connecting multiple services
// ---------------------------------------------------------------------------
export const HubIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Central hub node */}
    <circle cx="8" cy="8" r="2" />
    {/* Spoke nodes — 6 equidistant spokes */}
    <circle cx="8" cy="1.5" r="1" />
    <line x1="8" y1="2.5" x2="8" y2="6" />

    <circle cx="13.5" cy="4.5" r="1" />
    <line x1="12.65" y1="5.35" x2="9.4" y2="6.9" />

    <circle cx="13.5" cy="11.5" r="1" />
    <line x1="12.65" y1="10.65" x2="9.4" y2="9.1" />

    <circle cx="8" cy="14.5" r="1" />
    <line x1="8" y1="13.5" x2="8" y2="10" />

    <circle cx="2.5" cy="11.5" r="1" />
    <line x1="3.35" y1="10.65" x2="6.6" y2="9.1" />

    <circle cx="2.5" cy="4.5" r="1" />
    <line x1="3.35" y1="5.35" x2="6.6" y2="6.9" />
  </svg>
)

// ---------------------------------------------------------------------------
// VPSIcon — Server rack with status LEDs
// Represents VPS/infrastructure management
// ---------------------------------------------------------------------------
export const VPSIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Rack chassis outline */}
    <rect x="2" y="1.5" width="12" height="13" rx="1" />
    {/* Server unit 1 */}
    <rect x="3.5" y="3" width="9" height="3" rx="0.5" />
    {/* LED dot on unit 1 */}
    <circle cx="11.5" cy="4.5" r="0.6" fill="currentColor" stroke="none" />
    {/* Server unit 2 */}
    <rect x="3.5" y="7" width="9" height="3" rx="0.5" />
    {/* LED dot on unit 2 */}
    <circle cx="11.5" cy="8.5" r="0.6" fill="currentColor" stroke="none" />
    {/* Server unit 3 — partial height for spacing */}
    <rect x="3.5" y="11" width="9" height="2" rx="0.5" />
    {/* LED dot on unit 3 */}
    <circle cx="11.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
    {/* Drive slot lines on unit 1 */}
    <line x1="4.5" y1="4.5" x2="9.5" y2="4.5" stroke-dasharray="1.5 1" />
  </svg>
)

// ---------------------------------------------------------------------------
// SSHIcon — Terminal window with a key symbol
// Represents SSH / remote system access
// ---------------------------------------------------------------------------
export const SSHIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Terminal window frame */}
    <rect x="1.5" y="2" width="13" height="10" rx="1" />
    {/* Title bar separator */}
    <line x1="1.5" y1="4.5" x2="14.5" y2="4.5" />
    {/* Prompt chevron */}
    <polyline points="3,7 5,8.5 3,10" />
    {/* Key body — circle */}
    <circle cx="11" cy="8.5" r="2" />
    {/* Key shaft */}
    <line x1="13" y1="8.5" x2="15" y2="8.5" />
    {/* Key teeth */}
    <line x1="14" y1="8.5" x2="14" y2="9.5" />
    {/* Key bow cut-out (inner ring implied by circle fill:none) */}
    {/* Bottom tab bar */}
    <line x1="1.5" y1="13.5" x2="14.5" y2="13.5" />
    <rect x="5" y="12" width="6" height="2" rx="0.5" fill="currentColor" stroke="none" opacity="0.25" />
  </svg>
)

// ---------------------------------------------------------------------------
// TrainingIcon — Neural network nodes with connecting edges
// Represents model training, fine-tuning, and GPU compute
// ---------------------------------------------------------------------------
export const TrainingIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Input layer — 2 nodes */}
    <circle cx="2.5" cy="5" r="1.25" />
    <circle cx="2.5" cy="11" r="1.25" />

    {/* Hidden layer — 3 nodes */}
    <circle cx="8" cy="3" r="1.25" />
    <circle cx="8" cy="8" r="1.25" />
    <circle cx="8" cy="13" r="1.25" />

    {/* Output layer — 2 nodes */}
    <circle cx="13.5" cy="5.5" r="1.25" />
    <circle cx="13.5" cy="10.5" r="1.25" />

    {/* Edges: input → hidden */}
    <line x1="3.75" y1="5" x2="6.75" y2="3" />
    <line x1="3.75" y1="5" x2="6.75" y2="8" />
    <line x1="3.75" y1="5" x2="6.75" y2="13" />
    <line x1="3.75" y1="11" x2="6.75" y2="3" />
    <line x1="3.75" y1="11" x2="6.75" y2="8" />
    <line x1="3.75" y1="11" x2="6.75" y2="13" />

    {/* Edges: hidden → output */}
    <line x1="9.25" y1="3" x2="12.25" y2="5.5" />
    <line x1="9.25" y1="8" x2="12.25" y2="5.5" />
    <line x1="9.25" y1="13" x2="12.25" y2="5.5" />
    <line x1="9.25" y1="3" x2="12.25" y2="10.5" />
    <line x1="9.25" y1="8" x2="12.25" y2="10.5" />
    <line x1="9.25" y1="13" x2="12.25" y2="10.5" />
  </svg>
)

// ---------------------------------------------------------------------------
// MemoryIcon — Brain outline with database cylinder overlay
// Represents persistent memory / knowledge-base (Shiba)
// ---------------------------------------------------------------------------
export const MemoryIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Left brain lobe */}
    <path d="M7.5 13 L7.5 4 C7.5 2.5 5.5 1.5 4 2.5 C2.5 3.5 2 5 2.5 6.5 C1.5 7 1 8 1.5 9 C1 9.5 1 10.5 1.5 11 C1.5 12.5 3 13.5 4.5 13 Z" />
    {/* Right brain lobe */}
    <path d="M8.5 13 L8.5 4 C8.5 2.5 10.5 1.5 12 2.5 C13.5 3.5 14 5 13.5 6.5 C14.5 7 15 8 14.5 9 C15 9.5 15 10.5 14.5 11 C14.5 12.5 13 13.5 11.5 13 Z" />
    {/* Brain stem / corpus callosum hint */}
    <line x1="7.5" y1="13" x2="8.5" y2="13" />
    <line x1="7.5" y1="8" x2="8.5" y2="8" />
    {/* Database cylinder — small, bottom-right overlay */}
    <ellipse cx="12" cy="11.5" rx="2.5" ry="1" />
    <line x1="9.5" y1="11.5" x2="9.5" y2="14" />
    <line x1="14.5" y1="11.5" x2="14.5" y2="14" />
    <ellipse cx="12" cy="14" rx="2.5" ry="1" />
    <line x1="10" y1="12.5" x2="14" y2="12.5" stroke-dasharray="1.5 1" />
  </svg>
)

// ---------------------------------------------------------------------------
// GovernanceIcon — Shield with a checkmark inside
// Represents policy enforcement, approvals, and compliance
// ---------------------------------------------------------------------------
export const GovernanceIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Shield */}
    <path d="M8 1.5 L13.5 3.5 L13.5 8.5 C13.5 11.5 8 14.5 8 14.5 C8 14.5 2.5 11.5 2.5 8.5 L2.5 3.5 Z" />
    {/* Checkmark */}
    <polyline points="5,8 7,10.5 11,6" stroke-width="1.5" />
  </svg>
)

// ---------------------------------------------------------------------------
// SpeechIcon — Sound-wave / waveform
// Represents voice and speech synthesis settings
// ---------------------------------------------------------------------------
export const SpeechIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Waveform bars — 7 bars of varying height centered on y=8 */}
    <line x1="1.5" y1="9.5" x2="1.5" y2="6.5" />
    <line x1="3.5" y1="11"  x2="3.5" y2="5" />
    <line x1="5.5" y1="12.5" x2="5.5" y2="3.5" />
    <line x1="7.5" y1="13.5" x2="7.5" y2="2.5" />
    <line x1="9.5" y1="12.5" x2="9.5" y2="3.5" />
    <line x1="11.5" y1="11"  x2="11.5" y2="5" />
    <line x1="13.5" y1="9.5" x2="13.5" y2="6.5" />
    {/* Decorative outer arc to hint at microphone/speaker */}
    <path d="M1 6 A7 7 0 0 0 1 10" opacity="0.4" />
    <path d="M15 6 A7 7 0 0 1 15 10" opacity="0.4" />
  </svg>
)

// ---------------------------------------------------------------------------
// RoutingIcon — Branching flow arrows
// Represents provider routing / load balancing logic
// ---------------------------------------------------------------------------
export const RoutingIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Entry node */}
    <circle cx="2.5" cy="8" r="1.5" />
    {/* Trunk line */}
    <line x1="4" y1="8" x2="6" y2="8" />
    {/* Fork point */}
    <circle cx="6.5" cy="8" r="0.5" fill="currentColor" stroke="none" />
    {/* Upper branch */}
    <path d="M6.5 8 C7.5 8 8 5.5 9 5" />
    <line x1="9" y1="5" x2="11" y2="5" />
    {/* Upper destination */}
    <circle cx="12.5" cy="5" r="1.5" />
    {/* Lower branch */}
    <path d="M6.5 8 C7.5 8 8 10.5 9 11" />
    <line x1="9" y1="11" x2="11" y2="11" />
    {/* Lower destination */}
    <circle cx="12.5" cy="11" r="1.5" />
    {/* Arrow heads */}
    <polyline points="10.5,4 11.5,5 10.5,6" />
    <polyline points="10.5,10 11.5,11 10.5,12" />
  </svg>
)

// ---------------------------------------------------------------------------
// AgentBackendsIcon — Two overlapping rectangles with a chevron/switch symbol
// Represents switching between agent execution backends
// ---------------------------------------------------------------------------
export const AgentBackendsIcon: Component<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width={props.width ?? defaults.width}
    height={props.height ?? defaults.height}
    class={props.class}
    style={props.style}
    aria-hidden={props["aria-hidden"] ?? true}
    fill="none"
    stroke="currentColor"
    stroke-width="1.25"
    stroke-linecap="round"
    stroke-linejoin="round"
    shape-rendering="crispEdges"
  >
    {/* Back rectangle (offset upper-left) */}
    <rect x="1.5" y="2" width="9" height="6" rx="1" />
    {/* Front rectangle (offset lower-right) */}
    <rect x="5.5" y="8" width="9" height="6" rx="1" />
    {/* Switch chevron — pointing right, centered between the two rects */}
    <polyline points="8,6.5 10.5,8 8,9.5" />
    {/* Horizontal connector line to chevron */}
    <line x1="6" y1="8" x2="9" y2="8" />
  </svg>
)
