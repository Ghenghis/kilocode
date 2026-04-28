/**
 * TokenOptimizer — Feature 2
 *
 * "Optimize context" button that:
 *   - Analyses which messages consume the most tokens
 *   - Shows a ranked list: "Turn #N (X,XXX tokens) — summary available"
 *   - One-click summarization via session.compact()
 *   - Shows projected token count after optimization
 */

import { Component, For, Show, createMemo, createSignal } from "solid-js"
import { useSession } from "../../context/session"
import { useProvider } from "../../context/provider"

export const TokenOptimizer: Component = () => {
  const session = useSession()
  const provider = useProvider()

  const [open, setOpen] = createSignal(false)

  // Only show when there are assistant messages
  const hasMessages = createMemo(() => session.messages().some((m) => m.role === "assistant"))

  /** Build a ranked list of turns by token cost. */
  const ranked = createMemo(() => {
    return session
      .messages()
      .filter((m) => m.role === "assistant" && m.tokens)
      .map((m, i) => {
        const tk = m.tokens!
        const total = tk.input + tk.output
        return { idx: i + 1, id: m.id.slice(-6), total, input: tk.input, output: tk.output }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  })

  /** Total tokens currently used. */
  const totalTokens = createMemo(() => {
    const usage = session.contextUsage()
    return usage?.tokens ?? 0
  })

  /** Very rough projected tokens after compaction (strip top-half of ranked turns). */
  const projectedTokens = createMemo(() => {
    const cut = ranked()
      .slice(0, Math.ceil(ranked().length / 2))
      .reduce((s, r) => s + r.total, 0)
    return Math.max(0, totalTokens() - cut)
  })

  const sel = createMemo(() => session.selected())
  const contextLimit = createMemo(() => {
    const m = sel() ? provider.findModel(sel()!) : undefined
    return m?.limit?.context ?? m?.contextLength ?? 0
  })

  const fmtNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  const busy = createMemo(() => session.status() !== "idle")

  const handleOptimize = () => {
    session.compact()
    setOpen(false)
  }

  return (
    <Show when={hasMessages()}>
      <div class="token-optimizer">
        <button
          class="token-optimizer-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open()}
          disabled={busy()}
          title="Optimize context window"
        >
          <span class="token-optimizer-icon">⚡</span>
          <span>Optimize context</span>
        </button>

        <Show when={open()}>
          <div class="token-optimizer-panel">
            <div class="token-optimizer-header">
              <span class="token-optimizer-title">Context Optimization</span>
              <button
                class="token-optimizer-close"
                onClick={() => setOpen(false)}
                aria-label="Close optimizer"
              >
                ×
              </button>
            </div>

            <div class="token-optimizer-body">
              <div class="token-optimizer-summary">
                <div class="token-optimizer-stat">
                  <span class="token-optimizer-stat-label">Current</span>
                  <span class="token-optimizer-stat-val">
                    {fmtNum(totalTokens())}
                    <Show when={contextLimit() > 0}>
                      {" / "}{fmtNum(contextLimit())}
                    </Show>
                  </span>
                </div>
                <div class="token-optimizer-stat">
                  <span class="token-optimizer-stat-label">After compact</span>
                  <span class="token-optimizer-stat-val token-optimizer-projected">
                    ~{fmtNum(projectedTokens())}
                  </span>
                </div>
              </div>

              <div class="token-optimizer-ranked-title">
                Top token consumers
              </div>
              <ul class="token-optimizer-ranked">
                <For each={ranked()}>
                  {(entry, i) => (
                    <li class="token-optimizer-ranked-item">
                      <span class="token-optimizer-ranked-num">#{i() + 1}</span>
                      <span class="token-optimizer-ranked-label">
                        Turn {entry.idx}
                        <span class="token-optimizer-ranked-id"> #{entry.id}</span>
                      </span>
                      <span class="token-optimizer-ranked-tokens">
                        {fmtNum(entry.total)} tokens
                      </span>
                      <span class="token-optimizer-ranked-tag">summary available</span>
                    </li>
                  )}
                </For>
              </ul>

              <button
                class="token-optimizer-btn"
                onClick={handleOptimize}
                disabled={busy()}
              >
                Compact &amp; summarize
              </button>
              <div class="token-optimizer-hint">
                Older messages will be summarized to free up context.
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  )
}
