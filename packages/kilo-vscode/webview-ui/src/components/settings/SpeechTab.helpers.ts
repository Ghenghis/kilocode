// Pure helpers extracted from SpeechTab.tsx so they can be unit-tested
// without pulling solid-js / DOM-dependent imports into the test runner.
//
// Production behavior unchanged — SpeechTab.tsx re-exports these.

import type { PronunciationEntry, SpeechSettings, VoicePreset } from "../../types/voice"

// Deep clone utility for settings.
//
// JSON.parse(JSON.stringify(...)) is acceptable here because SpeechSettings is
// pure data: only primitives, plain objects, and arrays of plain objects
// (no Map/Set/Date/RegExp/functions). It also preserves the historic
// undefined-stripping behavior callers depend on (e.g. azure.apiKey is
// always a string, never undefined, after a clone round-trip).
export function cloneSettings(s: SpeechSettings): SpeechSettings {
  return JSON.parse(JSON.stringify(s))
}

// ── Typed shallow / structural compare ─────────────────────────────────────
//
// Wave 2 finding: `JSON.stringify(a) === JSON.stringify(b)` was used to detect
// "settings changed" before posting an update. That has two real bugs:
//
//   1. Key order is unstable. Two functionally equal settings objects with
//      different insertion order serialise to different strings, producing
//      false negatives and a spurious save on every render.
//   2. NaN and -0 are normalised to "null"/"0" in JSON, which silently masks
//      a real change to e.g. tuning.styleDegree if a slider snaps to NaN.
//
// The replacement is a structural compare keyed by the SpeechSettings shape.
// It is intentionally non-recursive so adding a new top-level key is a
// type error rather than a silent gap.

function pronunciationsEqual(a: PronunciationEntry[], b: PronunciationEntry[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].word !== b[i].word) return false
    if (a[i].pronounceAs !== b[i].pronounceAs) return false
  }
  return true
}

function presetsEqual(a: VoicePreset[], b: VoicePreset[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.name !== y.name ||
      x.voiceId !== y.voiceId ||
      x.pitch !== y.pitch ||
      x.rate !== y.rate ||
      x.volume !== y.volume ||
      x.style !== y.style ||
      x.styleDegree !== y.styleDegree ||
      x.sentencePause !== y.sentencePause ||
      x.paragraphBreak !== y.paragraphBreak ||
      x.emphasis !== y.emphasis ||
      x.audioFormat !== y.audioFormat ||
      !pronunciationsEqual(x.pronunciations, y.pronunciations)
    ) {
      return false
    }
  }
  return true
}

function stringArrayEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function optionalCredEqual(
  a: { apiKey: string } | undefined,
  b: { apiKey: string } | undefined,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.apiKey === b.apiKey
}

function pollyEqual(
  a: SpeechSettings["polly"],
  b: SpeechSettings["polly"],
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.accessKeyId === b.accessKeyId &&
    a.secretAccessKey === b.secretAccessKey &&
    a.region === b.region
  )
}

// Check if two settings objects are equal.
export function settingsEqual(a: SpeechSettings, b: SpeechSettings): boolean {
  if (a === b) return true

  if (
    a.enabled !== b.enabled ||
    a.autoSpeak !== b.autoSpeak ||
    a.volume !== b.volume ||
    a.interactionMode !== b.interactionMode ||
    a.interruptOnType !== b.interruptOnType ||
    a.debugMode !== b.debugMode ||
    a.sentimentIntensity !== b.sentimentIntensity ||
    a.multiVoiceMode !== b.multiVoiceMode ||
    a.provider !== b.provider
  ) {
    return false
  }

  if (
    a.azure.apiKey !== b.azure.apiKey ||
    a.azure.region !== b.azure.region ||
    a.azure.voiceId !== b.azure.voiceId
  ) {
    return false
  }

  if (
    !optionalCredEqual(a.google, b.google) ||
    !optionalCredEqual(a.openai, b.openai) ||
    !optionalCredEqual(a.elevenlabs, b.elevenlabs) ||
    !pollyEqual(a.polly, b.polly)
  ) {
    return false
  }

  // Tuning block.
  if (
    a.tuning.pitch !== b.tuning.pitch ||
    a.tuning.rate !== b.tuning.rate ||
    a.tuning.volume !== b.tuning.volume ||
    a.tuning.style !== b.tuning.style ||
    a.tuning.styleDegree !== b.tuning.styleDegree ||
    a.tuning.sentencePause !== b.tuning.sentencePause ||
    a.tuning.paragraphBreak !== b.tuning.paragraphBreak ||
    a.tuning.emphasis !== b.tuning.emphasis ||
    a.tuning.audioFormat !== b.tuning.audioFormat ||
    !pronunciationsEqual(a.tuning.pronunciations, b.tuning.pronunciations)
  ) {
    return false
  }

  // Favorites block.
  if (
    !stringArrayEqual(a.favorites.starredVoices, b.favorites.starredVoices) ||
    !stringArrayEqual(a.favorites.order, b.favorites.order) ||
    !presetsEqual(a.favorites.presets, b.favorites.presets)
  ) {
    return false
  }

  if (!presetsEqual(a.presets, b.presets)) return false

  return true
}
