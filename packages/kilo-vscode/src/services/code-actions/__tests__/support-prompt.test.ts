/**
 * Unit tests for createPrompt — runner: `bun test`.
 *
 * `support-prompt.ts` is the only pure module in services/code-actions: it has
 * no `vscode` dependency, so we can exercise its template substitution
 * hermetically. The other files in this folder (code-action-provider,
 * editor-utils, register-*) are thin glue around `vscode.window` /
 * `vscode.languages` and are not unit-testable without a full extension host;
 * see TODO in __tests__/code-action-provider.smoke.test.ts.
 */
import { describe, it, expect } from "bun:test"

import { createPrompt } from "../support-prompt"

const baseParams = {
  filePath: "src/foo.ts",
  startLine: "10",
  endLine: "20",
  selectedText: "const x = 1",
  userInput: "",
}

describe("createPrompt", () => {
  it("substitutes filePath / line range / selectedText into the EXPLAIN template", () => {
    const out = createPrompt("EXPLAIN", baseParams)
    expect(out).toContain("src/foo.ts:10-20")
    expect(out).toContain("const x = 1")
    expect(out).toContain("clear and concise explanation")
  })

  it("renders diagnostic bullets when diagnostics are supplied for FIX", () => {
    const out = createPrompt("FIX", {
      ...baseParams,
      diagnostics: [
        { source: "ts", message: "Type 'string' is not assignable", code: 2322 },
        { source: undefined, message: "Unused var" },
      ],
    })
    expect(out).toContain("Current problems detected:")
    expect(out).toContain("- [ts] Type 'string' is not assignable (2322)")
    // Falls back to the literal "Error" when source is missing.
    expect(out).toContain("- [Error] Unused var")
  })

  it("emits no diagnostic block when the diagnostics array is empty or missing", () => {
    const withEmpty = createPrompt("FIX", { ...baseParams, diagnostics: [] })
    const withoutKey = createPrompt("FIX", baseParams)
    expect(withEmpty).not.toContain("Current problems detected:")
    expect(withoutKey).not.toContain("Current problems detected:")
  })

  it("replaces unknown ${...} placeholders with empty strings instead of leaking the syntax", () => {
    // The terminal templates reference ${terminalContent} / ${userInput};
    // omitting them must not surface "${terminalContent}" in the output.
    const out = createPrompt("TERMINAL_FIX", { userInput: "what does this do?" })
    expect(out).not.toMatch(/\$\{[a-zA-Z]+\}/)
    expect(out).toContain("what does this do?")
    expect(out).toContain("Fix this terminal command:")
  })

  it("ADD_TO_CONTEXT renders a minimal file-path + code-fence block", () => {
    const out = createPrompt("ADD_TO_CONTEXT", baseParams)
    // Must start with the path:line ref and contain exactly one fenced block.
    expect(out.startsWith("src/foo.ts:10-20")).toBe(true)
    expect(out.match(/```/g)?.length).toBe(2)
    expect(out).toContain("const x = 1")
  })
})
