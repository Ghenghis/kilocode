import { Component, Show, createSignal, onCleanup, onMount } from "solid-js"
import { Switch } from "@kilocode/kilo-ui/switch"
import { Select } from "@kilocode/kilo-ui/select"
import { Card } from "@kilocode/kilo-ui/card"
import { Button } from "@kilocode/kilo-ui/button"
import { useVSCode } from "../../context/vscode"
import { useLanguage } from "../../context/language"
import type { ExtensionMessage, TestNotificationChannel } from "../../types/messages"
import SettingsRow from "./SettingsRow"

interface SoundOption {
  value: string
  labelKey: string
}

const SOUND_OPTIONS: SoundOption[] = [
  { value: "default", labelKey: "settings.notifications.sound.default" },
  { value: "none", labelKey: "settings.notifications.sound.none" },
]

const NotificationsTab: Component = () => {
  const vscode = useVSCode()
  const language = useLanguage()

  const [agentNotify, setAgentNotify] = createSignal(true)
  const [permNotify, setPermNotify] = createSignal(true)
  const [errorNotify, setErrorNotify] = createSignal(true)
  const [agentSound, setAgentSound] = createSignal("default")
  const [permSound, setPermSound] = createSignal("default")
  const [errorSound, setErrorSound] = createSignal("default")
  const [testStatus, setTestStatus] = createSignal<string | null>(null)
  const [testing, setTesting] = createSignal(false)

  const unsubscribe = vscode.onMessage((message: ExtensionMessage) => {
    if (message.type === "notificationSettingsLoaded") {
      const s = message.settings
      setAgentNotify(s.notifyAgent)
      setPermNotify(s.notifyPermissions)
      setErrorNotify(s.notifyErrors)
      setAgentSound(s.soundAgent)
      setPermSound(s.soundPermissions)
      setErrorSound(s.soundErrors)
      return
    }
    if (message.type === "testNotificationResult") {
      setTesting(false)
      setTestStatus(message.ok ? `Sent to ${message.channel}` : `Failed: ${message.error ?? "unknown"}`)
    }
  })

  onCleanup(unsubscribe)
  onMount(() => vscode.postMessage({ type: "requestNotificationSettings" }))

  const sendTestNotification = (channel: TestNotificationChannel) => {
    setTesting(true)
    setTestStatus(null)
    vscode.postMessage({ type: "testNotification", channel })
  }

  const save = (key: string, value: unknown) => {
    vscode.postMessage({ type: "updateSetting", key, value })
  }

  return (
    <div>
      <Card>
        <SettingsRow
          title={language.t("settings.notifications.agent.title")}
          description={language.t("settings.notifications.agent.description")}
        >
          <Switch
            checked={agentNotify()}
            onChange={(checked) => {
              setAgentNotify(checked)
              save("notifications.agent", checked)
            }}
            hideLabel
          >
            {language.t("settings.notifications.agent.title")}
          </Switch>
        </SettingsRow>
        <SettingsRow
          title={language.t("settings.notifications.permissions.title")}
          description={language.t("settings.notifications.permissions.description")}
        >
          <Switch
            checked={permNotify()}
            onChange={(checked) => {
              setPermNotify(checked)
              save("notifications.permissions", checked)
            }}
            hideLabel
          >
            {language.t("settings.notifications.permissions.title")}
          </Switch>
        </SettingsRow>
        <SettingsRow
          title={language.t("settings.notifications.errors.title")}
          description={language.t("settings.notifications.errors.description")}
          last
        >
          <Switch
            checked={errorNotify()}
            onChange={(checked) => {
              setErrorNotify(checked)
              save("notifications.errors", checked)
            }}
            hideLabel
          >
            {language.t("settings.notifications.errors.title")}
          </Switch>
        </SettingsRow>
      </Card>

      <h4 style={{ "margin-top": "16px", "margin-bottom": "8px" }}>Test notifications</h4>
      <Card>
        <SettingsRow
          title="Send test notification"
          description="Verify your notification channel is working."
          last
        >
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <Button
              variant="secondary"
              size="small"
              disabled={testing()}
              onClick={() => sendTestNotification("popup")}
            >
              Popup
            </Button>
            <Button
              variant="secondary"
              size="small"
              disabled={testing()}
              onClick={() => sendTestNotification("log")}
            >
              Log
            </Button>
            <Show when={testStatus()}>
              <span
                style={{
                  "font-size": "12px",
                  color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
                }}
              >
                {testStatus()}
              </span>
            </Show>
          </div>
        </SettingsRow>
      </Card>

      <h4 style={{ "margin-top": "16px", "margin-bottom": "8px" }}>{language.t("settings.notifications.sounds")}</h4>
      <Card>
        <SettingsRow
          title={language.t("settings.notifications.agentSound.title")}
          description={language.t("settings.notifications.agentSound.description")}
        >
          <Select
            options={SOUND_OPTIONS}
            current={SOUND_OPTIONS.find((o) => o.value === agentSound())}
            value={(o) => o.value}
            label={(o) => language.t(o.labelKey)}
            onSelect={(o) => {
              if (o) {
                setAgentSound(o.value)
                save("sounds.agent", o.value)
              }
            }}
            variant="secondary"
            size="small"
            triggerVariant="settings"
          />
        </SettingsRow>
        <SettingsRow
          title={language.t("settings.notifications.permSound.title")}
          description={language.t("settings.notifications.permSound.description")}
        >
          <Select
            options={SOUND_OPTIONS}
            current={SOUND_OPTIONS.find((o) => o.value === permSound())}
            value={(o) => o.value}
            label={(o) => language.t(o.labelKey)}
            onSelect={(o) => {
              if (o) {
                setPermSound(o.value)
                save("sounds.permissions", o.value)
              }
            }}
            variant="secondary"
            size="small"
            triggerVariant="settings"
          />
        </SettingsRow>
        <SettingsRow
          title={language.t("settings.notifications.errorSound.title")}
          description={language.t("settings.notifications.errorSound.description")}
          last
        >
          <Select
            options={SOUND_OPTIONS}
            current={SOUND_OPTIONS.find((o) => o.value === errorSound())}
            value={(o) => o.value}
            label={(o) => language.t(o.labelKey)}
            onSelect={(o) => {
              if (o) {
                setErrorSound(o.value)
                save("sounds.errors", o.value)
              }
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

export default NotificationsTab
