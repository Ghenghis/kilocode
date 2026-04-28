/**
 * TabSkeleton — shimmer-loading placeholder shown while a lazy settings tab
 * is being fetched.  Matches approximate tab content dimensions so the layout
 * does not jump when the real component mounts.
 *
 * Used as the `fallback` prop of a `<Suspense>` that wraps each lazy tab.
 */

import { Component } from "solid-js"

// ── Shimmer keyframe is injected once into the document head ──────────────────

let shimmerInjected = false

function ensureShimmerStyle(): void {
  if (shimmerInjected || typeof document === "undefined") return
  shimmerInjected = true
  const style = document.createElement("style")
  style.textContent = `
    @keyframes tab-skeleton-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
    .tab-skeleton-line {
      border-radius: 4px;
      background: linear-gradient(
        90deg,
        var(--vscode-editor-background, #1e1e1e) 25%,
        var(--vscode-widget-border, #3c3c3c)     50%,
        var(--vscode-editor-background, #1e1e1e) 75%
      );
      background-size: 800px 100%;
      animation: tab-skeleton-shimmer 1.6s infinite linear;
    }
  `
  document.head.appendChild(style)
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TabSkeleton: Component = () => {
  ensureShimmerStyle()

  return (
    <div
      aria-busy="true"
      aria-label="Loading settings tab…"
      style={{
        padding: "20px 16px",
        display: "flex",
        "flex-direction": "column",
        gap: "14px",
        width: "100%",
        "box-sizing": "border-box",
      }}
    >
      {/* Heading placeholder */}
      <div
        class="tab-skeleton-line"
        style={{ height: "20px", width: "55%", opacity: "0.7" }}
      />

      {/* Description paragraph lines */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
        <div class="tab-skeleton-line" style={{ height: "13px", width: "90%" }} />
        <div class="tab-skeleton-line" style={{ height: "13px", width: "75%" }} />
      </div>

      {/* First settings row */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "12px",
          "margin-top": "8px",
        }}
      >
        <div class="tab-skeleton-line" style={{ height: "13px", width: "30%" }} />
        <div
          class="tab-skeleton-line"
          style={{ height: "28px", flex: "1", "border-radius": "3px" }}
        />
      </div>

      {/* Second settings row */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "12px",
        }}
      >
        <div class="tab-skeleton-line" style={{ height: "13px", width: "38%" }} />
        <div
          class="tab-skeleton-line"
          style={{ height: "28px", flex: "1", "border-radius": "3px" }}
        />
      </div>

      {/* Toggle row */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "10px",
          "margin-top": "4px",
        }}
      >
        <div
          class="tab-skeleton-line"
          style={{ height: "18px", width: "36px", "border-radius": "9px" }}
        />
        <div class="tab-skeleton-line" style={{ height: "13px", width: "45%" }} />
      </div>

      {/* Sub-section heading */}
      <div
        class="tab-skeleton-line"
        style={{ height: "16px", width: "40%", "margin-top": "12px", opacity: "0.6" }}
      />

      {/* Third settings row */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "12px",
        }}
      >
        <div class="tab-skeleton-line" style={{ height: "13px", width: "28%" }} />
        <div
          class="tab-skeleton-line"
          style={{ height: "28px", flex: "1", "border-radius": "3px" }}
        />
      </div>

      {/* Fourth settings row */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "12px",
        }}
      >
        <div class="tab-skeleton-line" style={{ height: "13px", width: "42%" }} />
        <div
          class="tab-skeleton-line"
          style={{ height: "28px", width: "120px", "border-radius": "3px" }}
        />
      </div>
    </div>
  )
}

export default TabSkeleton
