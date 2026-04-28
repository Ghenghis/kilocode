/**
 * useTokenCount — live token estimate below the prompt input.
 * Estimates: Math.ceil(text.length / 4)
 * Color: green < 500 tokens, amber < 2000, red >= 2000
 */

import type { Accessor } from "solid-js"
import { createMemo } from "solid-js"

export type TokenCountLevel = "green" | "amber" | "red"

export interface TokenCount {
  /** Estimated token count */
  count: Accessor<number>
  /** Color level based on count */
  level: Accessor<TokenCountLevel>
  /** Formatted label, e.g. "~42 tokens" */
  label: Accessor<string>
}

export function useTokenCount(text: Accessor<string>): TokenCount {
  const count = createMemo(() => Math.ceil(text().length / 4))

  const level = createMemo((): TokenCountLevel => {
    const n = count()
    if (n < 500) return "green"
    if (n < 2000) return "amber"
    return "red"
  })

  const label = createMemo(() => `~${count()} tokens`)

  return { count, level, label }
}
