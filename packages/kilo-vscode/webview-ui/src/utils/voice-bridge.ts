/**
 * Voice Bridge — ensures voice output works identically regardless of active backend.
 *
 * When the backend switches (Kilo Native → OpenHands → Goose), speech settings are
 * untouched. This module reads speech state exclusively from VS Code settings (via the
 * `speechSettingsLoaded` message) and never writes to it. Backend switching MUST NOT
 * affect voice settings — this file is intentionally backend-agnostic.
 *
 * Consumers:
 *   - App.tsx auto-speak effect (already wired; this module is a re-export layer +
 *     public API for future callers and tests).
 *   - Any component that needs to fire TTS imperatively.
 */

import type { SpeechSettings } from "../types/voice"
import { DEFAULT_SPEECH_SETTINGS } from "../types/voice"
import { SpeechProviderRegistry } from "../data/speech-providers"
import { speak, stop as stopSpeech, ensureAudioReady } from "./speech-playback"
import { filterTextForSpeech, detectSentiment } from "./speech-text-filter"

// ─── VoiceState ──────────────────────────────────────────────────────────────
//
// A slim, backend-agnostic view of the current TTS configuration.
// It is derived from SpeechSettings (which is the full VS Code settings object)
// and never contains any backend-specific fields.

export interface VoiceState {
  /** Azure voice ID, e.g. "en-GB-MaisieNeural" (also shown as "Maisie (UK)" in UI) */
  activeVoice: string
  /** Which TTS provider is currently selected */
  provider: "azure" | "browser" | "openai" | "elevenlabs" | "none"
  /** Master enabled flag (kilo-code.new.speech.enabled) */
  enabled: boolean
  /** If true, every assistant response is automatically spoken */
  autoSpeak: boolean
  /** Playback rate — 0.5–2.0 */
  speed: number
  /** Master volume — 0–1 (normalised from the 0–100 VS Code setting) */
  volume: number
}

// ─── Module-level state ──────────────────────────────────────────────────────

/** Last full SpeechSettings received from the extension host. Never reset on backend change. */
let _currentSettings: SpeechSettings = DEFAULT_SPEECH_SETTINGS

/** Subscribers notified whenever _currentSettings is updated. */
const _subscribers = new Set<(state: VoiceState) => void>()

// ─── Internal helpers ────────────────────────────────────────────────────────

function settingsToVoiceState(s: SpeechSettings): VoiceState {
  const provider = s.provider as VoiceState["provider"]
  return {
    activeVoice: s.azure?.voiceId ?? "en-GB-MaisieNeural",
    provider: (["azure", "browser", "openai", "elevenlabs"].includes(provider) ? provider : "none") as VoiceState["provider"],
    enabled: s.enabled ?? true,
    autoSpeak: s.autoSpeak ?? true,
    speed: s.tuning?.rate ?? 1.0,
    volume: (s.volume ?? 80) / 100,
  }
}

function getApiKey(s: SpeechSettings, pid: string): string {
  if (pid === "azure") return s.azure?.apiKey ?? ""
  if (pid === "google") return s.google?.apiKey ?? ""
  if (pid === "openai") return s.openai?.apiKey ?? ""
  if (pid === "elevenlabs") return s.elevenlabs?.apiKey ?? ""
  if (pid === "polly") return s.polly?.accessKeyId ?? ""
  return ""
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Called from App.tsx (or any listener) whenever `speechSettingsLoaded` arrives.
 * This is the ONLY place where the internal settings cache is updated.
 *
 * IMPORTANT: This must never be called from backend-switching code paths.
 */
export function updateVoiceSettings(settings: SpeechSettings): void {
  _currentSettings = settings
  const state = settingsToVoiceState(settings)
  for (const cb of _subscribers) {
    try { cb(state) } catch { /* guard against misbehaving subscribers */ }
  }
}

/**
 * Returns a snapshot of the current voice state.
 * Safe to call at any time; returns defaults if settings have not loaded yet.
 */
export function getVoiceState(): VoiceState {
  return settingsToVoiceState(_currentSettings)
}

/**
 * Speak `text` using the currently configured TTS provider and voice.
 *
 * Backend-agnostic: this function does not read any backend state.
 *
 * @param text    The raw text to speak (will be filtered via filterTextForSpeech).
 * @param options.force  If true, bypasses the autoSpeak gate (useful for explicit speak buttons).
 */
export function speakAgentResponse(text: string, options?: { force?: boolean }): void {
  const settings = _currentSettings

  if (!settings.enabled) return
  if (!options?.force && !settings.autoSpeak) return

  const provider = SpeechProviderRegistry.get(settings.provider ?? "browser")
  if (!provider) return
  if (provider.requiresApiKey && !getApiKey(settings, provider.id)) return

  const filtered = filterTextForSpeech(text)
  if (!filtered) return

  const sentiment = detectSentiment(filtered)

  ensureAudioReady()
  speak(filtered, provider, {
    region: settings.azure?.region,
    apiKey: getApiKey(settings, provider.id),
    voiceId: settings.azure.voiceId,
    pitch: settings.tuning.pitch + sentiment.pitchModifier,
    rate: settings.tuning.rate * sentiment.rateModifier,
    volume: settings.tuning.volume ?? undefined,
    style: settings.tuning.style,
    styleDegree: settings.tuning.styleDegree,
    emphasis: settings.tuning.emphasis,
    pronunciations: settings.tuning.pronunciations,
    audioFormat: settings.tuning.audioFormat,
    globalVolume: settings.volume,
  }).catch((err) => console.error("[VoiceBridge] speakAgentResponse failed:", err))
}

/**
 * Stop any ongoing TTS playback.
 */
export { stopSpeech as stopVoice }

/**
 * Called when the active backend changes (e.g. Kilo → OpenHands → Goose).
 *
 * CONTRACT: This function MUST NOT read or write any voice/speech settings.
 * It exists purely as an explicit no-op hook so callers can document the
 * backend-change event without accidentally coupling to voice state.
 *
 * If you are tempted to add `setVoice(...)` or similar inside this function,
 * that is a contract violation.
 */
export function onBackendChanged(newBackend: string): void {
  // Intentional no-op: voice state is managed independently of backend selection.
  // Speech settings live in VS Code workspace/user settings under `kilo-code.new.speech.*`
  // and are loaded once via `requestSpeechSettings`. Switching backends does not reload
  // or modify those settings.
  if (typeof newBackend !== "string") return // type guard only
}

/**
 * Subscribe to voice state changes.
 * Returns an unsubscribe function.
 *
 * The callback fires whenever `updateVoiceSettings` is called (i.e. whenever
 * the extension host sends a fresh `speechSettingsLoaded` message).
 */
export function subscribeVoiceState(cb: (state: VoiceState) => void): () => void {
  _subscribers.add(cb)
  // Immediately emit current state to the new subscriber
  try { cb(settingsToVoiceState(_currentSettings)) } catch { /* ignore */ }
  return () => { _subscribers.delete(cb) }
}
