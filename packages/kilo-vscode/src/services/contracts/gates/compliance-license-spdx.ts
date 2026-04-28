/**
 * compliance-license-spdx — if the doc references OSS dependencies or
 * mentions licenses, every "License: …" or "SPDX-License-Identifier: …"
 * occurrence must use a valid SPDX id from the allowlist below.
 *
 * The allowlist is the SPDX top-30 (covers >99% of real OSS licenses
 * users encounter); we deliberately do not bundle the full 500-entry
 * SPDX catalog.
 */

import type { Gate, GateIssue } from "../RubricCritic"

const SPDX_ALLOWLIST = new Set<string>([
	"MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC",
	"GPL-2.0-only", "GPL-2.0-or-later", "GPL-3.0-only", "GPL-3.0-or-later",
	"LGPL-2.1-only", "LGPL-2.1-or-later", "LGPL-3.0-only", "LGPL-3.0-or-later",
	"AGPL-3.0-only", "AGPL-3.0-or-later",
	"MPL-2.0", "EPL-1.0", "EPL-2.0", "CDDL-1.0", "CDDL-1.1",
	"Unlicense", "CC0-1.0", "0BSD",
	"Artistic-2.0", "BSL-1.0", "Zlib", "Python-2.0",
	"CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-NC-4.0",
	"WTFPL", "BlueOak-1.0.0",
])

const SPDX_LINE_RE = /(?:SPDX-License-Identifier|License)\s*[:=]\s*([A-Za-z0-9.+-]+)/g
const TRIGGER_RE = /\b(license|licence|spdx|open[- ]source|oss)\b/i

function findLine(doc: string, idx: number): number {
	return doc.slice(0, idx).split("\n").length
}

export const complianceLicenseSpdx: Gate = {
	id: "compliance-license-spdx",
	name: "License SPDX ids are valid",
	description: "If license-related text is present, every SPDX id must be on the SPDX allowlist.",
	category: "compliance",
	severity: "warn",
	docTypes: "*",
	async validate(doc: string): Promise<GateIssue[] | null> {
		if (!TRIGGER_RE.test(doc)) return null
		const issues: GateIssue[] = []
		let m: RegExpExecArray | null
		SPDX_LINE_RE.lastIndex = 0
		while ((m = SPDX_LINE_RE.exec(doc)) !== null) {
			const id = (m[1] ?? "").trim()
			if (!id) continue
			if (!SPDX_ALLOWLIST.has(id)) {
				issues.push({
					line: findLine(doc, m.index),
					severity: "warn",
					message: `License "${id}" is not a recognised SPDX id.`,
					suggestion: `Use one of: ${["MIT", "Apache-2.0", "BSD-3-Clause", "ISC"].join(", ")}, …`,
				})
			}
		}
		return issues.length ? issues : null
	},
}

export default complianceLicenseSpdx
