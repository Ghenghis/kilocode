import { Component, createEffect, onMount } from "solid-js"
import { Select } from "@kilocode/kilo-ui/select"
import { TextField } from "@kilocode/kilo-ui/text-field"
import { Card } from "@kilocode/kilo-ui/card"
import { useConfig } from "../../context/config"
import { useLanguage } from "../../context/language"
import SettingsRow from "./SettingsRow"

interface LayoutOption {
  value: string
  labelKey: string
}
interface DensityOption {
  value: string
  label: string
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  { value: "auto", labelKey: "settings.display.layout.auto" },
  { value: "stretch", labelKey: "settings.display.layout.stretch" },
]

// kilocode_change: density slider — real CSS-var driven, persists via config + localStorage
const DENSITY_OPTIONS: DensityOption[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
]
const DENSITY_SCALE: Record<string, number> = {
  compact: 0.75,
  comfortable: 1.0,
  spacious: 1.25,
}
const DENSITY_LS_KEY = "kilo.display.density"

function applyDensity(name: string): void {
  const scale = DENSITY_SCALE[name] ?? 1.0
  document.documentElement.style.setProperty("--kc-density", String(scale))
  try {
    localStorage.setItem(DENSITY_LS_KEY, name)
  } catch {
    /* storage unavailable */
  }
}

const DisplayTab: Component = () => {
  const { config, updateConfig } = useConfig()
  const language = useLanguage()

  // On mount: hydrate density from localStorage if config doesn't have it yet
  onMount(() => {
    const fromCfg = (config() as { density?: string } | undefined)?.density
    if (fromCfg) {
      applyDensity(fromCfg)
      return
    }
    try {
      const fromLs = localStorage.getItem(DENSITY_LS_KEY)
      if (fromLs && DENSITY_SCALE[fromLs] !== undefined) {
        applyDensity(fromLs)
      } else {
        applyDensity("comfortable")
      }
    } catch {
      applyDensity("comfortable")
    }
  })

  // React to config changes (e.g. multi-window sync via push)
  createEffect(() => {
    const d = (config() as { density?: string } | undefined)?.density
    if (d && DENSITY_SCALE[d] !== undefined) applyDensity(d)
  })

  const currentDensity = (): string => {
    const fromCfg = (config() as { density?: string } | undefined)?.density
    if (fromCfg) return fromCfg
    try {
      return localStorage.getItem(DENSITY_LS_KEY) ?? "comfortable"
    } catch {
      return "comfortable"
    }
  }

  return (
    <div>
      <Card>
        <SettingsRow
          title={language.t("settings.display.username.title")}
          description={language.t("settings.display.username.description")}
        >
          <div style={{ width: "160px" }}>
            <TextField
              value={config().username ?? ""}
              placeholder="User"
              onChange={(val) => updateConfig({ username: val.trim() || undefined })}
            />
          </div>
        </SettingsRow>

        <SettingsRow
          title="Density"
          description="Compact / Comfortable / Spacious — affects spacing and font scale across all settings tabs."
        >
          <Select
            options={DENSITY_OPTIONS}
            current={DENSITY_OPTIONS.find((o) => o.value === currentDensity())}
            value={(o) => o.value}
            label={(o) => o.label}
            onSelect={(o) => {
              if (!o) return
              if (o.value === currentDensity()) return
              applyDensity(o.value)
              updateConfig({ density: o.value } as never)
            }}
            variant="secondary"
            size="small"
            triggerVariant="settings"
          />
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.display.layout.title")}
          description={language.t("settings.display.layout.description")}
          last
        >
          <Select
            options={LAYOUT_OPTIONS}
            current={LAYOUT_OPTIONS.find((o) => o.value === (config().layout ?? "auto"))}
            value={(o) => o.value}
            label={(o) => language.t(o.labelKey)}
            onSelect={(o) => {
              if (!o) return
              const next = o.value as "auto" | "stretch"
              if (next === (config().layout ?? "auto")) return
              updateConfig({ layout: next })
            }}
            variant="secondary"
            size="small"
            triggerVariant="settings"
          />
        </SettingsRow>
      </Card>
    </div>
  )
}

export default DisplayTab
