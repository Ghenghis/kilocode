/**
 * EnhancedCodeBlock — rich code block component for assistant messages.
 *
 * Features:
 * - Language badge top-left (detected from .language-* class)
 * - Copy button top-right (shows "Copied!" for 2 s then reverts)
 * - Line number toggle (off by default, click badge to toggle)
 * - Word-wrap toggle button
 * - "Open in editor" button → posts openInEditorRequest
 * - "Run in terminal" button (bash/sh/python/ruby/node) → posts runInTerminalRequest
 * - Diff awareness: if unified-diff markers present, colourize +/- lines
 * - Max-height collapse: >20 lines collapsed to 12 with "Show N more" expander
 * - CSS-only syntax highlighting via data-lang attribute
 *
 * Wire-in strategy: DOM injection via MutationObserver, same approach as
 * injectRunButtons in AssistantMessage.tsx. Call injectEnhancedCodeBlocks()
 * with the root element after content renders.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const MAX_LINES_BEFORE_COLLAPSE = 20
const COLLAPSED_VISIBLE_LINES = 12

/** Languages that support "Run in terminal" */
const RUNNABLE_LANGUAGES = new Set([
  "bash", "sh", "shell", "zsh", "fish",
  "python", "python3", "py",
  "node", "nodejs", "javascript", "js",
  "ruby", "rb",
  "perl",
  "powershell", "ps1",
])

/** Normalise a raw language string to a canonical short form */
function normaliseLang(raw: string): string {
  const l = raw.toLowerCase().trim()
  if (l === "python3") return "python"
  if (l === "nodejs" || l === "node.js") return "node"
  if (l === "ps1") return "powershell"
  if (l === "sh" || l === "shell" || l === "zsh" || l === "fish") return "bash"
  if (l === "javascript" || l === "js") return "javascript"
  if (l === "typescript" || l === "ts") return "typescript"
  if (l === "jsx") return "jsx"
  if (l === "tsx") return "tsx"
  if (l === "rb") return "ruby"
  return l
}

/** Detect language from the <code> element's class list */
function detectLanguage(codeEl: HTMLElement): string {
  for (const cls of Array.from(codeEl.classList)) {
    if (cls.startsWith("language-")) {
      const raw = cls.replace("language-", "")
      if (raw && raw !== "none" && raw !== "plaintext") return normaliseLang(raw)
    }
  }
  return ""
}

/** Return true if the code string looks like a unified diff */
function looksLikeDiff(code: string): boolean {
  return /^---\s+[a-z/]/m.test(code) && /^\+\+\+\s+[b/]/m.test(code)
}

// ──────────────────────────────────────────────────────────────────────────────
// DOM helpers
// ──────────────────────────────────────────────────────────────────────────────

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const c of children) el.append(c)
  return el
}

// ──────────────────────────────────────────────────────────────────────────────
// Diff colouring — rewrites <pre> inner HTML line by line
// ──────────────────────────────────────────────────────────────────────────────

function applyDiffColours(pre: HTMLElement): void {
  const text = pre.querySelector("code")?.textContent ?? pre.textContent ?? ""
  const lines = text.split("\n")
  const fragment = document.createDocumentFragment()

  for (const line of lines) {
    const span = document.createElement("span")
    if (line.startsWith("+") && !line.startsWith("+++")) {
      span.className = "ecb-diff-add"
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      span.className = "ecb-diff-del"
    } else if (line.startsWith("@@")) {
      span.className = "ecb-diff-hunk"
    } else {
      span.className = "ecb-diff-ctx"
    }
    span.textContent = line + "\n"
    fragment.appendChild(span)
  }

  // Replace the inner code element content with colourised spans
  const code = pre.querySelector("code")
  if (code) {
    code.textContent = ""
    code.appendChild(fragment)
  } else {
    pre.textContent = ""
    pre.appendChild(fragment)
  }
  pre.setAttribute("data-ecb-diff", "1")
}

// ──────────────────────────────────────────────────────────────────────────────
// Line numbers — wraps each line in a span with a data-line attr
// ──────────────────────────────────────────────────────────────────────────────

function buildLineNumberedContent(text: string): DocumentFragment {
  const frag = document.createDocumentFragment()
  const lines = text.split("\n")
  // Trim trailing empty line artifact from split
  if (lines[lines.length - 1] === "") lines.pop()
  lines.forEach((line, i) => {
    const row = document.createElement("span")
    row.className = "ecb-line"
    row.setAttribute("data-line", String(i + 1))
    row.textContent = line + "\n"
    frag.appendChild(row)
  })
  return frag
}

// ──────────────────────────────────────────────────────────────────────────────
// Main injector — wraps each unprocessed <pre> block
// ──────────────────────────────────────────────────────────────────────────────

let _ecbCounter = 0

/**
 * Walk `root` for unprocessed <pre> blocks and wrap each with the enhanced
 * code block chrome (toolbar, copy, line numbers, collapse, diff, etc.).
 *
 * Safe to call repeatedly — blocks already processed are skipped.
 */
export function injectEnhancedCodeBlocks(
  root: HTMLElement,
  postMessage: (msg: Record<string, unknown>) => void,
): void {
  const blocks = root.querySelectorAll<HTMLElement>("pre:not([data-ecb-injected])")

  blocks.forEach((pre) => {
    const codeEl = pre.querySelector<HTMLElement>("code")
    if (!codeEl) return
    pre.setAttribute("data-ecb-injected", "1")

    const id = `ecb-${++_ecbCounter}`
    const lang = detectLanguage(codeEl)
    const code = codeEl.textContent ?? ""
    const lineCount = (code.match(/\n/g)?.length ?? 0) + (code.endsWith("\n") ? 0 : 1)
    const isDiff = looksLikeDiff(code)
    const isRunnable = RUNNABLE_LANGUAGES.has(lang)

    // State
    let lineNumbersOn = false
    let wordWrapOn = false
    let collapsed = lineCount > MAX_LINES_BEFORE_COLLAPSE

    // ── Outer wrapper ──────────────────────────────────────────────────────────
    const wrapper = document.createElement("div")
    wrapper.className = "ecb-wrapper"
    wrapper.setAttribute("data-lang", lang || "text")
    if (isDiff) wrapper.setAttribute("data-diff", "1")

    // ── Toolbar ───────────────────────────────────────────────────────────────
    const toolbar = document.createElement("div")
    toolbar.className = "ecb-toolbar"

    // Language badge (click to toggle line numbers)
    const langBadge = createEl(
      "button",
      { class: "ecb-lang-badge", title: "Toggle line numbers", type: "button" },
      lang || "text",
    )
    langBadge.addEventListener("click", () => {
      lineNumbersOn = !lineNumbersOn
      pre.setAttribute("data-line-numbers", lineNumbersOn ? "1" : "0")
      langBadge.classList.toggle("ecb-lang-badge--active", lineNumbersOn)
      if (lineNumbersOn) {
        // Build line-numbered spans if not already done
        if (!codeEl.getAttribute("data-ecb-lined")) {
          const plain = codeEl.textContent ?? ""
          codeEl.textContent = ""
          codeEl.appendChild(buildLineNumberedContent(plain))
          codeEl.setAttribute("data-ecb-lined", "1")
        }
      }
    })

    // Copy button
    let copyTimeout: ReturnType<typeof setTimeout> | undefined
    const copyBtn = createEl(
      "button",
      { class: "ecb-copy-btn", title: "Copy code", type: "button" },
      "Copy",
    )
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code)
        copyBtn.textContent = "Copied!"
        copyBtn.classList.add("ecb-copy-btn--success")
        clearTimeout(copyTimeout)
        copyTimeout = setTimeout(() => {
          copyBtn.textContent = "Copy"
          copyBtn.classList.remove("ecb-copy-btn--success")
        }, 2000)
      } catch {
        // clipboard may be restricted in webview
      }
    })

    // Word-wrap toggle
    const wrapBtn = createEl(
      "button",
      { class: "ecb-wrap-btn", title: "Toggle word wrap", type: "button" },
      "Wrap",
    )
    wrapBtn.addEventListener("click", () => {
      wordWrapOn = !wordWrapOn
      pre.setAttribute("data-word-wrap", wordWrapOn ? "1" : "0")
      wrapBtn.classList.toggle("ecb-wrap-btn--active", wordWrapOn)
    })

    // Open in editor button
    const editorBtn = createEl(
      "button",
      { class: "ecb-action-btn", title: "Open in editor", type: "button" },
      "⌨ Editor",
    )
    editorBtn.addEventListener("click", () => {
      postMessage({ type: "openInEditorRequest", code, language: lang })
    })

    // Run in terminal button (only for runnable languages)
    let termBtn: HTMLButtonElement | undefined
    if (isRunnable) {
      termBtn = createEl(
        "button",
        { class: "ecb-action-btn ecb-run-btn", title: `Run ${lang} in terminal`, type: "button" },
        "▶ Run",
      )
      termBtn.addEventListener("click", () => {
        postMessage({ type: "runInTerminalRequest", code, language: lang, blockId: id })
      })
    }

    toolbar.appendChild(langBadge)
    // Spacer
    const spacer = document.createElement("span")
    spacer.className = "ecb-toolbar-spacer"
    toolbar.appendChild(spacer)
    if (termBtn) toolbar.appendChild(termBtn)
    toolbar.appendChild(editorBtn)
    toolbar.appendChild(wrapBtn)
    toolbar.appendChild(copyBtn)

    // ── Collapse chrome ───────────────────────────────────────────────────────
    let expander: HTMLButtonElement | undefined
    if (collapsed) {
      pre.style.maxHeight = `${COLLAPSED_VISIBLE_LINES * 1.5}em`
      pre.style.overflow = "hidden"

      expander = createEl(
        "button",
        { class: "ecb-expander", type: "button" },
        `Show ${lineCount - COLLAPSED_VISIBLE_LINES} more lines`,
      )
      expander.addEventListener("click", () => {
        collapsed = false
        pre.style.maxHeight = ""
        pre.style.overflow = ""
        expander!.remove()
        expander = undefined
      })
    }

    // ── Diff colouring ────────────────────────────────────────────────────────
    if (isDiff) {
      applyDiffColours(pre)
    }

    // ── Assemble ──────────────────────────────────────────────────────────────
    pre.parentNode?.insertBefore(wrapper, pre)
    wrapper.appendChild(toolbar)
    wrapper.appendChild(pre)
    if (expander) wrapper.appendChild(expander)
  })
}
