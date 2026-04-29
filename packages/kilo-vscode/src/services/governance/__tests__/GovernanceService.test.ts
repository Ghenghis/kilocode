/**
 * Unit tests for GovernanceService memory caps — runner: `bun test`.
 *
 * Verifies the bounded-growth fix on the two arrays that are persisted to
 * `.kilo/governance.json` via persistNow(): `releaseVerdicts` (cap 200)
 * and `dangerousActions` (cap 500). Without these caps the JSON state
 * file grew indefinitely across restarts (memory + disk leak).
 *
 * The vscode module is stubbed via the shared preload mock
 * (tests/setup/vscode-mock.ts, registered in bunfig.toml).
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { GovernanceService } from "../GovernanceService"

function makeTempWorkspace(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "governance-cap-"))
}

function cleanup(root: string): void {
	try {
		fs.rmSync(root, { recursive: true, force: true })
	} catch {
		// ignore — best-effort cleanup of OS temp dirs
	}
}

describe("GovernanceService.createReleaseVerdict — releaseVerdicts cap", () => {
	let workspace: string
	let svc: GovernanceService

	beforeEach(() => {
		workspace = makeTempWorkspace()
		svc = new GovernanceService(workspace)
	})

	afterEach(() => {
		svc.dispose()
		cleanup(workspace)
	})

	it("caps releaseVerdicts at 200 after 250 calls", () => {
		for (let i = 0; i < 250; i++) {
			svc.createReleaseVerdict(
				`scope-${i}`,
				0,
				0,
				`risk summary ${i}`,
				`rollback plan ${i}`,
				"pass",
			)
		}

		const verdicts = svc.getReleaseVerdicts()
		expect(verdicts.length).toBe(200)
	})

	it("keeps the most recent verdict after the cap kicks in", () => {
		for (let i = 0; i < 250; i++) {
			svc.createReleaseVerdict(
				`scope-${i}`,
				0,
				0,
				`risk summary ${i}`,
				`rollback plan ${i}`,
				"pass",
			)
		}

		const verdicts = svc.getReleaseVerdicts()
		// Most recent push wins → last element is iteration 249.
		expect(verdicts[verdicts.length - 1].scope).toBe("scope-249")
		// getLatestVerdict() is what isRollbackReady() relies on.
		expect(svc.getLatestVerdict()?.scope).toBe("scope-249")
	})

	it("evicts oldest entries first (FIFO) — entries beyond the cap are gone", () => {
		for (let i = 0; i < 250; i++) {
			svc.createReleaseVerdict(
				`scope-${i}`,
				0,
				0,
				`risk summary ${i}`,
				`rollback plan ${i}`,
				"pass",
			)
		}

		const verdicts = svc.getReleaseVerdicts()
		const scopes = new Set(verdicts.map((v) => v.scope))

		// First 50 (0..49) should be evicted; last 200 (50..249) should remain.
		for (let i = 0; i < 50; i++) {
			expect(scopes.has(`scope-${i}`)).toBe(false)
		}
		for (let i = 50; i < 250; i++) {
			expect(scopes.has(`scope-${i}`)).toBe(true)
		}
		// Order preserved: index 0 of the capped array is the oldest survivor.
		expect(verdicts[0].scope).toBe("scope-50")
	})

	it("does not cap when below the limit", () => {
		for (let i = 0; i < 50; i++) {
			svc.createReleaseVerdict(`scope-${i}`, 0, 0, "rs", "rp", "pass")
		}
		expect(svc.getReleaseVerdicts().length).toBe(50)
	})
})

describe("GovernanceService.addDangerousAction — dangerousActions cap", () => {
	let workspace: string
	let svc: GovernanceService

	beforeEach(() => {
		workspace = makeTempWorkspace()
		svc = new GovernanceService(workspace)
	})

	afterEach(() => {
		svc.dispose()
		cleanup(workspace)
	})

	it("caps dangerousActions at 500 after 600 calls", () => {
		for (let i = 0; i < 600; i++) {
			svc.addDangerousAction({
				name: `action-${i}`,
				description: `desc-${i}`,
				severity: "warning",
				minimumTier: "operator",
				requiresApproval: false,
				blocked: false,
			})
		}

		expect(svc.getDangerousActions().length).toBe(500)
	})

	it("keeps the most recent dangerous action after the cap kicks in", () => {
		for (let i = 0; i < 600; i++) {
			svc.addDangerousAction({
				name: `action-${i}`,
				description: `desc-${i}`,
				severity: "warning",
				minimumTier: "operator",
				requiresApproval: false,
				blocked: false,
			})
		}

		const actions = svc.getDangerousActions()
		// Most recent push wins → last element is iteration 599.
		expect(actions[actions.length - 1].name).toBe("action-599")
	})

	it("evicts oldest entries first (FIFO), including seeded defaults", () => {
		// The constructor seeds ~16 default dangerous actions. Adding 600
		// custom entries pushes the total to ~616 before the cap, so the
		// oldest defaults get evicted along with the earliest custom ones.
		for (let i = 0; i < 600; i++) {
			svc.addDangerousAction({
				name: `action-${i}`,
				description: `desc-${i}`,
				severity: "warning",
				minimumTier: "operator",
				requiresApproval: false,
				blocked: false,
			})
		}

		const actions = svc.getDangerousActions()
		expect(actions.length).toBe(500)

		const names = new Set(actions.map((a) => a.name))
		// Earliest custom entries (those pushed before the eviction window)
		// must be gone; recent ones must remain.
		expect(names.has("action-0")).toBe(false)
		expect(names.has("action-99")).toBe(false)
		expect(names.has("action-599")).toBe(true)
		expect(names.has("action-500")).toBe(true)
	})

	it("does not cap when below the limit", () => {
		const before = svc.getDangerousActions().length
		svc.addDangerousAction({
			name: "one-more",
			description: "d",
			severity: "warning",
			minimumTier: "operator",
			requiresApproval: false,
			blocked: false,
		})
		expect(svc.getDangerousActions().length).toBe(before + 1)
	})
})
