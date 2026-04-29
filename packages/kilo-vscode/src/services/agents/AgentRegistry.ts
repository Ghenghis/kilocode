/**
 * Singleton registry wrapping the on-disk agent loader.
 *
 * Hermes (backend) does the real routing/selection. This registry exists so
 * the VS Code UI can list the 21 kc-* agents, show their colors/descriptions
 * in dropdowns, and pass an *optional* hint (`agentIdHint`) along with each
 * task. Hermes is free to ignore the hint.
 */

import { loadAgentsFromDisk, type AgentDefinition } from "./AgentLoader"

const FALLBACK_ID = "kc-main"

interface KeywordMap {
  /** Lowercased keyword → agent id. First matching keyword wins. */
  [keyword: string]: string
}

const KEYWORD_HINTS: KeywordMap = {
  integration: "kc-01",
  integrate: "kc-01",
  brainstorm: "kc-02",
  ideate: "kc-02",
  creative: "kc-02",
  architect: "kc-03",
  architecture: "kc-03",
  scalability: "kc-03",
  triage: "kc-04",
  bug: "kc-04",
  issue: "kc-04",
  "root cause": "kc-05",
  rca: "kc-05",
  generate: "kc-06",
  scaffold: "kc-06",
  review: "kc-07",
  audit: "kc-07",
  test: "kc-08",
  qa: "kc-08",
  testing: "kc-08",
  debug: "kc-09",
  diagnose: "kc-09",
  refactor: "kc-10",
  cleanup: "kc-10",
  document: "kc-11",
  docs: "kc-11",
  documentation: "kc-11",
  security: "kc-12",
  vulnerability: "kc-12",
  cve: "kc-12",
  performance: "kc-13",
  benchmark: "kc-13",
  optimize: "kc-13",
  api: "kc-14",
  rest: "kc-14",
  database: "kc-15",
  sql: "kc-15",
  query: "kc-15",
  deploy: "kc-16",
  devops: "kc-16",
  "ci/cd": "kc-16",
  pipeline: "kc-16",
  frontend: "kc-17",
  ui: "kc-17",
  ux: "kc-17",
  backend: "kc-18",
  server: "kc-18",
  research: "kc-19",
  analyze: "kc-19",
  prompt: "kc-20",
  llm: "kc-20",
}

export class AgentRegistry {
  private static instance: AgentRegistry | undefined

  private agents: AgentDefinition[] = []
  private byId = new Map<string, AgentDefinition>()
  private agentsDir: string | undefined

  private constructor() {}

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) AgentRegistry.instance = new AgentRegistry()
    return AgentRegistry.instance
  }

  /** Reset the singleton — for tests only. */
  static __resetForTests(): void {
    AgentRegistry.instance = undefined
  }

  async init(agentsDir: string): Promise<void> {
    this.agentsDir = agentsDir
    await this.load()
  }

  async reload(): Promise<void> {
    if (!this.agentsDir) return
    await this.load()
  }

  getAll(): AgentDefinition[] {
    return [...this.agents]
  }

  getById(id: string): AgentDefinition | undefined {
    return this.byId.get(id)
  }

  /**
   * Best-effort keyword match against the task description. This is only a
   * UI hint — Hermes makes the real routing decision. Falls back to kc-main
   * when no keyword matches (or kc-main itself isn't registered, the first
   * available agent).
   */
  suggest(taskDescription: string): AgentDefinition | undefined {
    if (this.agents.length === 0) return undefined
    const text = taskDescription.toLowerCase()
    for (const [keyword, id] of Object.entries(KEYWORD_HINTS)) {
      if (text.includes(keyword)) {
        const hit = this.byId.get(id)
        if (hit) return hit
      }
    }
    return this.byId.get(FALLBACK_ID) ?? this.agents[0]
  }

  private async load(): Promise<void> {
    if (!this.agentsDir) return
    const list = await loadAgentsFromDisk(this.agentsDir)
    this.agents = list
    this.byId = new Map(list.map((a) => [a.id, a]))
  }
}

export const agentRegistry = AgentRegistry.getInstance()
