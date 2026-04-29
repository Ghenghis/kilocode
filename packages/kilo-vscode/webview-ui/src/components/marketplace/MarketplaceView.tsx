import { createSignal, createMemo, createEffect, on, onCleanup, onMount, Show } from "solid-js"
import { Tabs } from "@kilocode/kilo-ui/tabs"
import { Card } from "@kilocode/kilo-ui/card"
import { Button } from "@kilocode/kilo-ui/button"
import { useVSCode } from "../../context/vscode"
import { useServer } from "../../context/server"
import { useLanguage } from "../../context/language"
import { useDialog } from "@kilocode/kilo-ui/context/dialog"
import type {
  MarketplaceItem,
  McpMarketplaceItem,
  ModeMarketplaceItem,
  SkillMarketplaceItem,
  MarketplaceInstalledMetadata,
} from "../../types/marketplace"
import { TelemetryEventName } from "../../../../src/services/telemetry/types"
import { MarketplaceListView } from "./MarketplaceListView"
import { InstallModal } from "./InstallModal"
import { RemoveDialog } from "./RemoveDialog"
import "./marketplace.css"

const EMPTY_METADATA: MarketplaceInstalledMetadata = { project: {}, global: {} }

export const MarketplaceView = () => {
  const vscode = useVSCode()
  const server = useServer()
  const { t } = useLanguage()
  const dialog = useDialog()

  const [items, setItems] = createSignal<MarketplaceItem[]>([])
  const [metadata, setMetadata] = createSignal<MarketplaceInstalledMetadata>(EMPTY_METADATA)
  const [fetching, setFetching] = createSignal(true)
  const [errors, setErrors] = createSignal<string[]>([])
  const [tab, setTab] = createSignal("mcp")
  const [pending, setPending] = createSignal<{ item: MarketplaceItem; scope: "project" | "global" } | null>(null)

  const skills = createMemo(() => items().filter((i): i is SkillMarketplaceItem => i.type === "skill"))
  const mcps = createMemo(() => items().filter((i): i is McpMarketplaceItem => i.type === "mcp"))
  const modes = createMemo(() => items().filter((i): i is ModeMarketplaceItem => i.type === "mode"))

  // Track which workspace dir we last fetched for, so re-mounting the tab
  // (Kobalte unmounts/remounts on every click) doesn't re-send the multi-MB
  // fetchMarketplaceData round-trip when we already have a fresh catalog.
  let lastFetchedDir: string | undefined
  // Watchdog timer: clears the "fetching" spinner if the extension never replies.
  let fetchWatchdog: ReturnType<typeof setTimeout> | undefined

  const fetchData = (force = false) => {
    setFetching(true)
    lastFetchedDir = server.workspaceDirectory()
    vscode.postMessage({ type: "fetchMarketplaceData" })
    // 10 s safety net — if the extension host is busy and never replies,
    // unblock the UI instead of leaving the spinner up indefinitely.
    clearTimeout(fetchWatchdog)
    fetchWatchdog = setTimeout(() => setFetching(false), 10_000)
  }

  const telemetry = (event: string, properties?: Record<string, unknown>) => {
    vscode.postMessage({ type: "telemetry", event, properties: properties ?? {} })
  }

  onMount(() => {
    // Register the message listener once, after DOM attach. Using onMount
    // rather than a bare createEffect prevents the subscription from being
    // re-registered whenever a reactive dep inside the callback changes.
    const unsub = vscode.onMessage((msg) => {
      if (msg.type === "marketplaceData") {
        clearTimeout(fetchWatchdog)
        setItems(msg.marketplaceItems ?? [])
        setMetadata(msg.marketplaceInstalledMetadata ?? EMPTY_METADATA)
        setErrors(msg.errors ?? [])
        setFetching(false)
      }
      if (msg.type === "marketplaceRemoveResult") {
        const removed = pending()
        setPending(null)
        if (msg.success) {
          if (removed) {
            telemetry(TelemetryEventName.MARKETPLACE_ITEM_REMOVED, {
              itemId: removed.item.id,
              itemType: removed.item.type,
              itemName: removed.item.name,
              target: removed.scope,
            })
          }
          fetchData(true)
        } else {
          setErrors((prev) => [...prev, msg.error ?? t("marketplace.remove.failed", { name: msg.slug })])
        }
      }
    })
    onCleanup(() => {
      unsub()
      clearTimeout(fetchWatchdog)
    })

    telemetry(TelemetryEventName.MARKETPLACE_TAB_VIEWED)

    // Initial fetch on first mount — only if we don't already have data for
    // this workspace (handles rapid tab-click remounts cleanly).
    if (items().length === 0 || server.workspaceDirectory() !== lastFetchedDir) {
      fetchData()
    }
  })

  // Re-fetch when the workspace directory changes AFTER the initial mount.
  // { defer: true } skips the first run — onMount already handles that.
  createEffect(
    on(() => server.workspaceDirectory(), (dir) => {
      if (dir !== lastFetchedDir) fetchData()
    }, { defer: true }),
  )

  const handleInstall = (item: MarketplaceItem) => {
    telemetry(TelemetryEventName.MARKETPLACE_INSTALL_BUTTON_CLICKED, {
      itemId: item.id,
      itemType: item.type,
      itemName: item.name,
    })
    dialog.show(() => (
      <InstallModal
        item={item}
        onClose={() => dialog.close()}
        onInstallResult={(success, scope, extra) => {
          if (success) {
            telemetry(TelemetryEventName.MARKETPLACE_ITEM_INSTALLED, {
              itemId: item.id,
              itemType: item.type,
              itemName: item.name,
              target: scope,
              ...(extra?.hasParameters && { hasParameters: true }),
              ...(extra?.installationMethodName && { installationMethodName: extra.installationMethodName }),
            })
            dialog.close()
            fetchData(true)
          }
        }}
      />
    ))
  }

  const handleRemove = (item: MarketplaceItem, scope: "project" | "global") => {
    dialog.show(() => (
      <RemoveDialog
        item={item}
        scope={scope}
        onClose={() => dialog.close()}
        onConfirm={() => {
          setPending({ item, scope })
          vscode.postMessage({
            type: "removeInstalledMarketplaceItem",
            mpItem: item,
            mpInstallOptions: { target: scope },
          })
          dialog.close()
        }}
      />
    ))
  }

  const dismissError = (idx: number) => {
    setErrors((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div class="marketplace-view">
      <Show when={errors().length > 0}>
        {errors().map((err, idx) => (
          <Card variant="error" class="marketplace-error-banner">
            <span>{err}</span>
            <Button variant="ghost" size="small" onClick={() => dismissError(idx)}>
              {t("marketplace.error.dismiss")}
            </Button>
          </Card>
        ))}
      </Show>

      <Tabs value={tab()} onChange={setTab} class="marketplace-tabs-root">
        <Tabs.List>
          <Tabs.Trigger value="mcp">{t("marketplace.tab.mcp")}</Tabs.Trigger>
          <Tabs.Trigger value="mode">{t("marketplace.tab.modes")}</Tabs.Trigger>
          <Tabs.Trigger value="skill">{t("marketplace.tab.skills")}</Tabs.Trigger>
        </Tabs.List>

        <div class="marketplace-content">
          <Tabs.Content value="mcp">
            <MarketplaceListView
              items={mcps()}
              metadata={metadata()}
              fetching={fetching()}
              type="mcp"
              searchPlaceholder={t("marketplace.search")}
              emptyMessage={t("marketplace.empty")}
              onInstall={handleInstall}
              onRemove={handleRemove}
            />
          </Tabs.Content>

          <Tabs.Content value="mode">
            <MarketplaceListView
              items={modes()}
              metadata={metadata()}
              fetching={fetching()}
              type="mode"
              searchPlaceholder={t("marketplace.search")}
              emptyMessage={t("marketplace.empty")}
              onInstall={handleInstall}
              onRemove={handleRemove}
            />
          </Tabs.Content>

          <Tabs.Content value="skill">
            <MarketplaceListView
              items={skills()}
              metadata={metadata()}
              fetching={fetching()}
              type="skill"
              searchPlaceholder={t("marketplace.search")}
              emptyMessage={t("marketplace.empty")}
              onInstall={handleInstall}
              onRemove={handleRemove}
            />
          </Tabs.Content>
        </div>
      </Tabs>
    </div>
  )
}
