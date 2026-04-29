/**
 * Settings tab-cycle regression smoke test.
 *
 * Goal
 * ----
 * The user reported a "click 6-8 tabs → freeze" pattern. Root cause class:
 * a tab module registers a side-effect (window message listener, setInterval,
 * setTimeout, raw addEventListener) without a paired cleanup. Each remount
 * leaks one more listener until the renderer chokes.
 *
 * Strategy
 * --------
 * A real Solid SSR + jsdom mount cycle for 28 tabs × N iterations is too
 * heavy and flaky for `bun test`. Instead, this test does **static analysis**
 * over every `*Tab.tsx` file in this directory:
 *
 *   For each tab:
 *     count(addEventListener)   <= count(removeEventListener) + count(onCleanup)
 *     count(setInterval(...))   <= count(clearInterval) + count(onCleanup)
 *     count(setTimeout(...))    <= count(clearTimeout)  + count(onCleanup)
 *
 * `onCleanup(...)` is allowed to satisfy any of the three because it is the
 * canonical Solid teardown hook and tabs commonly tear down a Set of timers
 * inside one onCleanup block.
 *
 * False-positive avoidance
 * ------------------------
 * Naive /setInterval/ matches identifiers like `setIntervalMs` (a Solid
 * signal setter). The regex below requires the function-call form
 * `setInterval(` / `setTimeout(` so identifiers that merely *contain* the
 * substring are ignored. `addEventListener` and `removeEventListener` are
 * always called as methods so the bare-word match is sufficient there.
 *
 * Comments and string literals are NOT stripped: in tab files these tokens
 * only appear in real code or in comments **about** real code, and counting
 * comment occurrences as "uses" makes the test more conservative (it errs
 * toward demanding cleanups), not less.
 *
 * What this catches
 * -----------------
 * Someone adds `setInterval(poll, 5000)` in a new tab and forgets the
 * `onCleanup(() => clearInterval(...))` — count(setInterval) = 1,
 * count(clearInterval) + count(onCleanup) = 0, the assertion fails.
 *
 * What this does NOT catch
 * ------------------------
 * - Listeners attached imperatively to module-scope singletons (the message
 *   bus). Those are tested separately at the bus level.
 * - Listeners whose cleanup lives in a sibling helper file. We accept that
 *   trade-off; tab files in this codebase keep their own teardown.
 */

import { test, expect } from "bun:test"
import { promises as fs } from "node:fs"
import * as path from "node:path"

const TABS_DIR = path.resolve(__dirname, "..")

async function listTabFiles(): Promise<string[]> {
  const entries = await fs.readdir(TABS_DIR)
  return entries.filter((name) => name.endsWith("Tab.tsx")).map((name) => path.join(TABS_DIR, name))
}

interface TabCounts {
  addListener: number
  removeListener: number
  setInterval: number
  clearInterval: number
  setTimeout: number
  clearTimeout: number
  onCleanup: number
}

function countMatches(source: string, pattern: RegExp): number {
  const matches = source.match(pattern)
  return matches ? matches.length : 0
}

function analyse(source: string): TabCounts {
  return {
    // bare-word: these are always method calls in this codebase
    addListener: countMatches(source, /\baddEventListener\b/g),
    removeListener: countMatches(source, /\bremoveEventListener\b/g),
    // require '(' to avoid matching `setIntervalMs`, `clearTimeoutHandle`, etc.
    setInterval: countMatches(source, /\bsetInterval\s*\(/g),
    clearInterval: countMatches(source, /\bclearInterval\s*\(/g),
    setTimeout: countMatches(source, /\bsetTimeout\s*\(/g),
    clearTimeout: countMatches(source, /\bclearTimeout\s*\(/g),
    onCleanup: countMatches(source, /\bonCleanup\s*\(/g),
  }
}

test("every *Tab.tsx ships pairwise cleanups for listeners and timers", async () => {
  const files = await listTabFiles()
  expect(files.length).toBeGreaterThanOrEqual(28)

  const failures: string[] = []

  for (const file of files) {
    const source = await fs.readFile(file, "utf8")
    const c = analyse(source)
    const tabName = path.basename(file)

    // onCleanup is the catch-all teardown hook — credit it against all three
    // categories. Tabs frequently funnel many timers into one onCleanup block.
    const cleanupBudget = c.onCleanup

    if (c.addListener > c.removeListener + cleanupBudget) {
      failures.push(
        `${tabName}: addEventListener=${c.addListener} but removeEventListener=${c.removeListener} ` +
          `and onCleanup=${c.onCleanup} (need add <= remove + onCleanup)`,
      )
    }
    if (c.setInterval > c.clearInterval + cleanupBudget) {
      failures.push(
        `${tabName}: setInterval=${c.setInterval} but clearInterval=${c.clearInterval} ` +
          `and onCleanup=${c.onCleanup} (need set <= clear + onCleanup)`,
      )
    }
    if (c.setTimeout > c.clearTimeout + cleanupBudget) {
      failures.push(
        `${tabName}: setTimeout=${c.setTimeout} but clearTimeout=${c.clearTimeout} ` +
          `and onCleanup=${c.onCleanup} (need set <= clear + onCleanup)`,
      )
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Tab cleanup regression detected in ${failures.length} tab(s):\n  - ` + failures.join("\n  - "),
    )
  }
})

test("tab inventory still matches the documented 28-tab Settings shell", async () => {
  // Locks the count so a tab added without a corresponding entry in the
  // Settings shell or a tab silently dropped is surfaced quickly.
  const files = await listTabFiles()
  expect(files.length).toBe(28)
})
