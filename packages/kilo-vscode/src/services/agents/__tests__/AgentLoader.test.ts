/**
 * Unit tests for AgentLoader. Runner: `bun test`.
 * Hermetic — fixtures are written into os.tmpdir() per-test.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import { loadAgentsFromDisk } from "../AgentLoader"

const KC_01_FIXTURE = `---
name: kc-01
description: "Integration Lead - Manages project integration and coordination"
model: null
mode: subagent
color: "#FF6B6B"
steps: 5
---

You are kc-01, the Integration Lead. You specialize in:
- Project integration and coordination
- System architecture integration
`

async function makeTmpDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "kilo-agent-loader-"))
}

describe("loadAgentsFromDisk", () => {
  let dir: string

  beforeEach(async () => {
    dir = await makeTmpDir()
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it("returns empty array for empty dir", async () => {
    const result = await loadAgentsFromDisk(dir)
    expect(result).toEqual([])
  })

  it("returns empty array when dir does not exist", async () => {
    const missing = path.join(dir, "does-not-exist")
    const result = await loadAgentsFromDisk(missing)
    expect(result).toEqual([])
  })

  it("parses kc-01.md correctly", async () => {
    await fs.writeFile(path.join(dir, "kc-01.md"), KC_01_FIXTURE, "utf8")
    const [agent, ...rest] = await loadAgentsFromDisk(dir)
    expect(rest).toHaveLength(0)
    expect(agent).toBeDefined()
    expect(agent.id).toBe("kc-01")
    expect(agent.name).toBe("kc-01")
    expect(agent.description).toBe("Integration Lead - Manages project integration and coordination")
    expect(agent.model).toBeNull()
    expect(agent.mode).toBe("subagent")
    expect(agent.color).toBe("#FF6B6B")
    expect(agent.steps).toBe(5)
    expect(agent.body).toContain("You are kc-01, the Integration Lead")
  })

  it("skips non-md files", async () => {
    await fs.writeFile(path.join(dir, "kc-01.md"), KC_01_FIXTURE, "utf8")
    await fs.writeFile(path.join(dir, "README.txt"), "not an agent", "utf8")
    await fs.writeFile(path.join(dir, "config.json"), "{}", "utf8")
    const result = await loadAgentsFromDisk(dir)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("kc-01")
  })

  it("skips files with missing frontmatter without throwing", async () => {
    await fs.writeFile(path.join(dir, "kc-01.md"), KC_01_FIXTURE, "utf8")
    await fs.writeFile(path.join(dir, "broken.md"), "no frontmatter here\n\njust text", "utf8")
    const result = await loadAgentsFromDisk(dir)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("kc-01")
  })

  it("skips files with invalid YAML", async () => {
    await fs.writeFile(path.join(dir, "kc-01.md"), KC_01_FIXTURE, "utf8")
    await fs.writeFile(
      path.join(dir, "bad-yaml.md"),
      "---\n: : : not valid: yaml :\n---\nbody\n",
      "utf8",
    )
    const result = await loadAgentsFromDisk(dir)
    expect(result.map((a) => a.id)).toEqual(["kc-01"])
  })

  it("returns agents sorted by id", async () => {
    const mk = (name: string) => `---
name: ${name}
description: "desc for ${name}"
model: null
mode: subagent
color: "#000000"
steps: 5
---
body
`
    await fs.writeFile(path.join(dir, "kc-03.md"), mk("kc-03"), "utf8")
    await fs.writeFile(path.join(dir, "kc-01.md"), mk("kc-01"), "utf8")
    await fs.writeFile(path.join(dir, "kc-main.md"), mk("kc-main"), "utf8")
    const ids = (await loadAgentsFromDisk(dir)).map((a) => a.id)
    expect(ids).toEqual(["kc-01", "kc-03", "kc-main"])
  })

  it("skips agents missing required description field", async () => {
    const noDesc = `---
name: kc-99
model: null
mode: subagent
color: "#000000"
steps: 5
---
body
`
    await fs.writeFile(path.join(dir, "kc-99.md"), noDesc, "utf8")
    const result = await loadAgentsFromDisk(dir)
    expect(result).toEqual([])
  })
})
