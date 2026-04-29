import { describe, it, expect } from "bun:test"
import { cloneSettings, settingsEqual } from "../SpeechTab.helpers"
import type { SpeechSettings, VoicePreset, PronunciationEntry } from "../../../types/voice"
import { DEFAULT_SPEECH_SETTINGS } from "../../../types/voice"

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makePronunciation(word: string, pronounceAs: string): PronunciationEntry {
  return { word, pronounceAs }
}

function makePreset(name: string, voiceId: string): VoicePreset {
  return {
    name,
    voiceId,
    pitch: 0,
    rate: 1.0,
    volume: null,
    style: "default",
    styleDegree: 1.0,
    sentencePause: 250,
    paragraphBreak: 500,
    emphasis: "moderate",
    pronunciations: [makePronunciation("kilo", "kee-low")],
    audioFormat: "audio-24khz-48kbitrate-mono-mp3",
  }
}

function makeSettings(): SpeechSettings {
  // Start from DEFAULTS but populate every nested shape so tests have realistic input.
  return {
    ...DEFAULT_SPEECH_SETTINGS,
    azure: {
      apiKey: "azure-key-123",
      region: "westus",
      voiceId: "en-GB-MaisieNeural",
    },
    google: { apiKey: "google-key" },
    openai: { apiKey: "openai-key" },
    elevenlabs: { apiKey: "el-key" },
    polly: { accessKeyId: "AKIA-test", secretAccessKey: "secret-test", region: "us-east-1" },
    tuning: {
      pitch: 5,
      rate: 1.2,
      volume: 90,
      style: "cheerful",
      styleDegree: 1.5,
      sentencePause: 300,
      paragraphBreak: 600,
      emphasis: "strong",
      pronunciations: [makePronunciation("foo", "fu"), makePronunciation("bar", "bahr")],
      audioFormat: "audio-48khz-96kbitrate-mono-mp3",
    },
    favorites: {
      starredVoices: ["en-GB-MaisieNeural", "en-US-JennyNeural"],
      presets: [makePreset("Friendly", "en-GB-MaisieNeural")],
      order: ["en-GB-MaisieNeural", "en-US-JennyNeural"],
    },
    presets: [makePreset("Default", "en-GB-MaisieNeural"), makePreset("Energetic", "en-US-JennyNeural")],
  }
}

// ---------------------------------------------------------------------------
// cloneSettings
// ---------------------------------------------------------------------------

describe("cloneSettings", () => {
  it("returns a structurally-equal but distinct object reference", () => {
    const original = makeSettings()
    const cloned = cloneSettings(original)

    expect(cloned).not.toBe(original)
    expect(cloned).toEqual(original)
  })

  it("deep-clones nested objects so mutating the clone does not affect the original", () => {
    const original = makeSettings()
    const cloned = cloneSettings(original)

    // Mutate nested azure config on the clone.
    cloned.azure.apiKey = "mutated-key"
    cloned.azure.region = "eastus"

    expect(original.azure.apiKey).toBe("azure-key-123")
    expect(original.azure.region).toBe("westus")
    // The clone's nested object should be a different reference.
    expect(cloned.azure).not.toBe(original.azure)
  })

  it("deep-clones the tuning sub-object", () => {
    const original = makeSettings()
    const cloned = cloneSettings(original)

    cloned.tuning.pitch = 99
    cloned.tuning.style = "angry"

    expect(original.tuning.pitch).toBe(5)
    expect(original.tuning.style).toBe("cheerful")
    expect(cloned.tuning).not.toBe(original.tuning)
  })

  it("deep-clones nested arrays (favorites.starredVoices, favorites.order)", () => {
    const original = makeSettings()
    const cloned = cloneSettings(original)

    cloned.favorites.starredVoices.push("en-AU-NatashaNeural")
    cloned.favorites.order.pop()

    expect(original.favorites.starredVoices).toHaveLength(2)
    expect(original.favorites.starredVoices).toEqual(["en-GB-MaisieNeural", "en-US-JennyNeural"])
    expect(original.favorites.order).toHaveLength(2)
    expect(cloned.favorites.starredVoices).not.toBe(original.favorites.starredVoices)
  })

  it("deep-clones the presets array including nested preset objects and pronunciations", () => {
    const original = makeSettings()
    const cloned = cloneSettings(original)

    // Mutate a nested preset object.
    cloned.presets[0].name = "Renamed"
    cloned.presets[0].pronunciations.push(makePronunciation("new", "noo"))
    cloned.presets.push(makePreset("Extra", "en-AU-NatashaNeural"))

    expect(original.presets[0].name).toBe("Default")
    expect(original.presets[0].pronunciations).toHaveLength(1)
    expect(original.presets).toHaveLength(2)
    expect(cloned.presets[0]).not.toBe(original.presets[0])
    expect(cloned.presets[0].pronunciations).not.toBe(original.presets[0].pronunciations)
  })

  it("deep-clones tuning.pronunciations entries", () => {
    const original = makeSettings()
    const cloned = cloneSettings(original)

    cloned.tuning.pronunciations[0].pronounceAs = "MUTATED"

    expect(original.tuning.pronunciations[0].pronounceAs).toBe("fu")
    expect(cloned.tuning.pronunciations).not.toBe(original.tuning.pronunciations)
    expect(cloned.tuning.pronunciations[0]).not.toBe(original.tuning.pronunciations[0])
  })
})

// ---------------------------------------------------------------------------
// settingsEqual
// ---------------------------------------------------------------------------

describe("settingsEqual", () => {
  it("returns true for two structurally-identical objects", () => {
    const a = makeSettings()
    const b = makeSettings()
    expect(settingsEqual(a, b)).toBe(true)
  })

  it("returns true for an object compared against its clone", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    expect(settingsEqual(a, b)).toBe(true)
  })

  it("returns false when a top-level primitive field changes (volume)", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.volume = a.volume + 1
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns false when a tuning primitive field changes (pitch)", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.tuning.pitch = a.tuning.pitch + 1
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns false when a tuning primitive field changes (rate)", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.tuning.rate = a.tuning.rate + 0.1
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns false when an array length differs (favorites.starredVoices)", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.favorites.starredVoices.push("en-AU-NatashaNeural")
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns false when an array length differs (presets)", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.presets.pop()
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns false when an array element differs at the same index", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.favorites.starredVoices[0] = "en-AU-NatashaNeural"
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns false when a nested object key differs (azure.apiKey)", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.azure.apiKey = "different-key"
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns false when a nested object key differs (azure.region)", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.azure.region = "eastus"
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns false when a deeply-nested preset field differs", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.presets[1].pitch = 42
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns false when a pronunciation entry differs inside a preset", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    b.presets[0].pronunciations[0].pronounceAs = "different"
    expect(settingsEqual(a, b)).toBe(false)
  })

  it("returns true when arrays have the same elements in the same order", () => {
    const a = makeSettings()
    const b = cloneSettings(a)
    // Rebuild the arrays with fresh references but identical contents.
    b.favorites.starredVoices = [...a.favorites.starredVoices]
    b.favorites.order = [...a.favorites.order]
    b.presets = a.presets.map((p) => ({ ...p, pronunciations: p.pronunciations.map((x) => ({ ...x })) }))
    expect(settingsEqual(a, b)).toBe(true)
  })

  it("returns true when nullable tuning.volume is null on both sides", () => {
    const a = makeSettings()
    a.tuning.volume = null
    const b = cloneSettings(a)
    expect(settingsEqual(a, b)).toBe(true)
  })

  it("returns false when tuning.volume changes from null to a number", () => {
    const a = makeSettings()
    a.tuning.volume = null
    const b = cloneSettings(a)
    b.tuning.volume = 50
    expect(settingsEqual(a, b)).toBe(false)
  })
})
