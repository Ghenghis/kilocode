// Pure helpers extracted from SpeechTab.tsx so they can be unit-tested
// without pulling solid-js / DOM-dependent imports into the test runner.
//
// Production behavior unchanged — SpeechTab.tsx re-exports these.

import type { SpeechSettings } from "../../types/voice"

// Deep clone utility for settings.
export function cloneSettings(s: SpeechSettings): SpeechSettings {
  return JSON.parse(JSON.stringify(s))
}

// Check if two settings objects are equal.
export function settingsEqual(a: SpeechSettings, b: SpeechSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
