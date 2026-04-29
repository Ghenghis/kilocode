/**
 * Unit tests for AgentRegistry. Runner: `bun test`.
 *
 * Tests are hermetic: we copy the real `.kilo/agents/` fixtures into
 * os.tmpdir() so the registry sees a frozen 21-agent snapshot regardless of
 * where the tests run from.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import { AgentRegistry } from "../AgentRegistry"

const REPO_AGENTS_DIR = path.resolve(__dirname, "..", "..", "..", "..", "..", "..", ".kilo", "agents")

let tmpDir: string

async function copyAllAgents(): Promise<void> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kilo-agent-registry-"))
  const ids = ["kc-main", ...Array.from({ length: 20 }, (_, i) => `kc-${String(i + 1).padStart(2, "0")}`)]
  for (const id of ids) {
    const src = path.join(REPO_AGENTS_DIR, `${id}.md`)
    const content = await fs.readFile(src, "utf8")
    await fs.writeFile(path.join(tmpDir, `${id}.md`), content, "utf8")
  }
}

describe("AgentRegistry", () => {
  beforeAll(async () => {
    await copyAllAgents()
  })

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    AgentRegistry.__resetForTests()
  })

  it("getAll returns all 21 agents after init", async () => {
    const reg = AgentRegistry.getInstance()
    await reg.init(tmpDir)
    const all = reg.getAll()
    expect(all).toHaveLength(21)
    const ids = all.map((a) => a.id).sort()
    expect(ids).toContain("kc-main")
    expect(ids).toContain("kc-01")
    expect(ids).toContain("kc-20")
  })

  it("getById returns the right agent", async () => {
    const reg = AgentRegistry.getInstance()
    await reg.init(tmpDir)
    const kc01 = reg.getById("kc-01")
    expect(kc01).toBeDefined()
    expect(kc01?.description).toContain("Integration")
    expect(reg.getById("kc-does-not-exist")).toBeUndefined()
  })

  it("suggest matches obvious testing keyword to kc-08", async () => {
    const reg = AgentRegistry.getInstance()
    await reg.init(tmpDir)
    const hit = reg.suggest("write some tests for the auth module")
    expect(hit?.id).toBe("kc-08")
  })

  it("suggest matches security keyword to kc-12", async () => {
    const reg = AgentRegistry.getInstance()
    await reg.init(tmpDir)
    expect(reg.suggest("audit security vulnerability in login")?.id).toBe("kc-07")
    expect(reg.suggest("look for any vulnerability")?.id).toBe("kc-12")
  })

  it("suggest matches refactor keyword to kc-10", async () => {
    const reg = AgentRegistry.getInstance()
    await reg.init(tmpDir)
    expect(reg.suggest("refactor this module")?.id).toBe("kc-10")
  })

  it("suggest falls back to kc-main when no keyword matches", async () => {
    const reg = AgentRegistry.getInstance()
    await reg.init(tmpDir)
    const hit = reg.suggest("xyzzy plugh frobnicate")
    expect(hit?.id).toBe("kc-main")
  })

  it("suggest returns undefined when no agents are loaded", async () => {
    const reg = AgentRegistry.getInstance()
    expect(reg.suggest("anything")).toBeUndefined()
  })

  it("reload picks up newly added files", async () => {
    const reg = AgentRegistry.getInstance()
    await reg.init(tmpDir)
    expect(reg.getAll()).toHaveLength(21)

    const extraPath = path.join(tmpDir, "kc-extra.md")
    await fs.writeFile(
      extraPath,
      `---
name: kc-extra
description: "Extra Agent - Test reload"
model: null
mode: subagent
color: "#123456"
steps: 5
---
body
`,
      "utf8",
    )
    try {
      await reg.reload()
      expect(reg.getAll()).toHaveLength(22)
      expect(reg.getById("kc-extra")?.color).toBe("#123456")
    } finally {
      await fs.rm(extraPath, { force: true })
    }
  })

  it("getInstance returns the same singleton", () => {
    const a = AgentRegistry.getInstance()
    const b = AgentRegistry.getInstance()
    expect(a).toBe(b)
  })
})
