/**
 * detect-framework — sniff a scaffolded project to figure out which test
 * runner to invoke. Pure file-system inspection, no side effects.
 *
 * Detection priority:
 *   1. playwright.config.{ts,js,mjs,cjs}                       → playwright
 *   2. vitest.config.{ts,js,mjs,cjs} OR vitest in devDeps      → vitest
 *   3. pyproject.toml with [tool.pytest] section OR pytest.ini → pytest
 *   4. Cargo.toml                                              → cargo
 *   5. fall-through                                            → shell
 *
 * Playwright wins over vitest because Playwright projects often also pull in
 * vitest for unit tests; we want the e2e runner to be the default for cases
 * that don't specify their own `run.kind`.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { RunnerKind } from "./runner"

export interface FrameworkDetection {
	kind: RunnerKind
	reason: string
}

const PLAYWRIGHT_CONFIGS = [
	"playwright.config.ts",
	"playwright.config.js",
	"playwright.config.mjs",
	"playwright.config.cjs",
]

const VITEST_CONFIGS = ["vitest.config.ts", "vitest.config.js", "vitest.config.mjs", "vitest.config.cjs"]

function readPackageJson(root: string): { devDependencies?: Record<string, string>; dependencies?: Record<string, string> } | null {
	const p = join(root, "package.json")
	if (!existsSync(p)) return null
	try {
		return JSON.parse(readFileSync(p, "utf-8"))
	} catch {
		return null
	}
}

function hasFile(root: string, names: string[]): string | null {
	for (const n of names) {
		if (existsSync(join(root, n))) return n
	}
	return null
}

function pyprojectHasPytest(root: string): boolean {
	const p = join(root, "pyproject.toml")
	if (!existsSync(p)) return false
	try {
		const text = readFileSync(p, "utf-8")
		return /\[tool\.pytest(?:\.[A-Za-z0-9_-]+)*\]/.test(text)
	} catch {
		return false
	}
}

export function detectFramework(projectRoot: string): FrameworkDetection {
	// 1. Playwright
	const pw = hasFile(projectRoot, PLAYWRIGHT_CONFIGS)
	if (pw) return { kind: "playwright", reason: `found ${pw}` }

	// 2. Vitest
	const vt = hasFile(projectRoot, VITEST_CONFIGS)
	if (vt) return { kind: "vitest", reason: `found ${vt}` }
	const pkg = readPackageJson(projectRoot)
	if (pkg) {
		const inDev = pkg.devDependencies && Object.prototype.hasOwnProperty.call(pkg.devDependencies, "vitest")
		const inProd = pkg.dependencies && Object.prototype.hasOwnProperty.call(pkg.dependencies, "vitest")
		if (inDev || inProd) {
			return { kind: "vitest", reason: "vitest listed in package.json dependencies" }
		}
	}

	// 3. pytest
	if (pyprojectHasPytest(projectRoot)) {
		return { kind: "pytest", reason: "[tool.pytest] section in pyproject.toml" }
	}
	if (existsSync(join(projectRoot, "pytest.ini"))) {
		return { kind: "pytest", reason: "found pytest.ini" }
	}

	// 4. cargo
	if (existsSync(join(projectRoot, "Cargo.toml"))) {
		return { kind: "cargo", reason: "found Cargo.toml" }
	}

	// 5. fall-through
	return { kind: "shell", reason: "no known test runner detected" }
}
