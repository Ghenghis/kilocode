# KiloCode Webview UI — Component Interaction Diagram

> canary.9 edition · generated 2026-04-27
> Source: `packages/kilo-vscode/webview-ui/src/`

---

## 1. Overview — SolidJS Webview Architecture

The KiloCode webview is a **SolidJS** single-page application compiled into a VS Code webview panel. It communicates with the extension host exclusively via `postMessage` / `window.addEventListener("message")` — there is no HTTP layer inside the webview.

Key architectural properties:

- **Fine-grained reactivity** — SolidJS signals, memos, and stores update only the DOM nodes that actually read a changing value. No virtual DOM diffing.
- **Context providers as dependency injection** — global state (config, session, providers, VSCode IPC) is injected via `createContext` / `useContext`. Components never import state modules directly.
- **Flat provider stack** — all providers are composed in `App.tsx` in a fixed nesting order. Inner providers may read outer ones (e.g. `SessionProvider` reads `ConfigProvider`).
- **Lazy tab loading** — every settings tab module is loaded with `lazy(() => import(...))` and a `<Suspense>` boundary. Modules are only fetched on first visit.
- **Keep-alive tab caching** — once a settings tab is visited its component stays mounted in the DOM with `display:none` via the `visitedTabs` signal + `forceMount` prop, so re-navigation is instant.
- **DataBridge pattern** — `SessionProvider`'s Solid store is exposed to `@kilocode/kilo-ui`'s `DataProvider` through a stable object with reactive getters, preserving per-key reactivity across the boundary.

---

## 2. Main Component Tree

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 760" width="820" height="760" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="12">
  <!-- background -->
  <rect width="820" height="760" fill="#1e1e2e" rx="8"/>

  <!-- ── LEGEND ── -->
  <rect x="620" y="16" width="182" height="110" rx="6" fill="#2a2a3e" stroke="#444" stroke-width="1"/>
  <text x="630" y="32" fill="#cdd6f4" font-size="11" font-weight="bold">Legend</text>
  <rect x="630" y="40" width="12" height="12" rx="2" fill="#89b4fa"/>
  <text x="648" y="51" fill="#cdd6f4" font-size="10">Context provider</text>
  <rect x="630" y="58" width="12" height="12" rx="2" fill="#a6e3a1"/>
  <text x="648" y="69" fill="#cdd6f4" font-size="10">View / main component</text>
  <rect x="630" y="76" width="12" height="12" rx="2" fill="#f9e2af"/>
  <text x="648" y="87" fill="#cdd6f4" font-size="10">Sub-component</text>
  <rect x="630" y="94" width="12" height="12" rx="2" fill="#cba6f7"/>
  <text x="648" y="105" fill="#cdd6f4" font-size="10">UI Kit / external</text>
  <text x="630" y="120" fill="#6c7086" font-size="9">Arrows = render children</text>

  <!-- ── ROOT: App ── -->
  <rect x="310" y="16" width="140" height="30" rx="5" fill="#89b4fa" stroke="#74c7ec" stroke-width="1.5"/>
  <text x="380" y="36" text-anchor="middle" fill="#1e1e2e" font-weight="bold">App (App.tsx)</text>

  <!-- vertical stem from App -->
  <line x1="380" y1="46" x2="380" y2="66" stroke="#585b70" stroke-width="1.5"/>

  <!-- ── Provider Stack box ── -->
  <rect x="60" y="66" width="500" height="170" rx="6" fill="#1e1e2e" stroke="#89b4fa" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="76" y="82" fill="#89b4fa" font-size="10" font-weight="bold">Provider Stack (outermost → innermost)</text>

  <!-- providers listed L→R top row -->
  <rect x="72" y="88" width="100" height="24" rx="4" fill="#89b4fa"/>
  <text x="122" y="104" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">ThemeProvider</text>

  <rect x="184" y="88" width="100" height="24" rx="4" fill="#89b4fa"/>
  <text x="234" y="104" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">DialogProvider</text>

  <rect x="296" y="88" width="100" height="24" rx="4" fill="#89b4fa"/>
  <text x="346" y="104" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">VSCodeProvider</text>

  <rect x="408" y="88" width="100" height="24" rx="4" fill="#89b4fa"/>
  <text x="458" y="104" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">ServerProvider</text>

  <!-- second row -->
  <rect x="72" y="122" width="100" height="24" rx="4" fill="#89b4fa"/>
  <text x="122" y="138" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">LanguageBridge</text>

  <rect x="184" y="122" width="108" height="24" rx="4" fill="#89b4fa"/>
  <text x="238" y="138" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">MarkedProvider</text>

  <rect x="304" y="122" width="116" height="24" rx="4" fill="#cba6f7"/>
  <text x="362" y="138" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">Diff/Code/FileProviders</text>

  <rect x="432" y="122" width="116" height="24" rx="4" fill="#89b4fa"/>
  <text x="490" y="138" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">ProviderProvider</text>

  <!-- third row -->
  <rect x="130" y="156" width="108" height="24" rx="4" fill="#89b4fa"/>
  <text x="184" y="172" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">ConfigProvider</text>

  <rect x="250" y="156" width="140" height="24" rx="4" fill="#89b4fa"/>
  <text x="320" y="172" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">NotificationsProvider</text>

  <rect x="402" y="156" width="116" height="24" rx="4" fill="#89b4fa"/>
  <text x="460" y="172" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">SessionProvider</text>

  <!-- DataBridge label -->
  <rect x="260" y="194" width="100" height="24" rx="4" fill="#89b4fa" opacity="0.7"/>
  <text x="310" y="210" text-anchor="middle" fill="#1e1e2e" font-size="10">DataBridge</text>

  <!-- stem from DataBridge to AppContent -->
  <line x1="310" y1="218" x2="310" y2="256" stroke="#585b70" stroke-width="1.5"/>

  <!-- ── AppContent ── -->
  <rect x="230" y="256" width="160" height="30" rx="5" fill="#a6e3a1" stroke="#94e2d5" stroke-width="1.5"/>
  <text x="310" y="275" text-anchor="middle" fill="#1e1e2e" font-weight="bold">AppContent</text>

  <!-- stem from AppContent -->
  <line x1="310" y1="286" x2="310" y2="310" stroke="#585b70" stroke-width="1.5"/>

  <!-- Switch/Match bracket line -->
  <line x1="80" y1="310" x2="580" y2="310" stroke="#585b70" stroke-width="1.5"/>

  <!-- stems down to views -->
  <line x1="100" y1="310" x2="100" y2="334" stroke="#585b70" stroke-width="1.5"/>
  <line x1="220" y1="310" x2="220" y2="334" stroke="#585b70" stroke-width="1.5"/>
  <line x1="340" y1="310" x2="340" y2="334" stroke="#585b70" stroke-width="1.5"/>
  <line x1="460" y1="310" x2="460" y2="334" stroke="#585b70" stroke-width="1.5"/>
  <line x1="560" y1="310" x2="560" y2="334" stroke="#585b70" stroke-width="1.5"/>

  <!-- ── ChatView ── -->
  <rect x="44" y="334" width="112" height="28" rx="5" fill="#a6e3a1" stroke="#94e2d5" stroke-width="1.5"/>
  <text x="100" y="352" text-anchor="middle" fill="#1e1e2e" font-weight="bold">ChatView</text>

  <!-- ── HistoryView ── -->
  <rect x="164" y="334" width="112" height="28" rx="5" fill="#a6e3a1" stroke="#94e2d5" stroke-width="1.5"/>
  <text x="220" y="352" text-anchor="middle" fill="#1e1e2e" font-weight="bold">HistoryView</text>

  <!-- ── Settings ── -->
  <rect x="284" y="334" width="112" height="28" rx="5" fill="#a6e3a1" stroke="#94e2d5" stroke-width="1.5"/>
  <text x="340" y="352" text-anchor="middle" fill="#1e1e2e" font-weight="bold">Settings</text>

  <!-- ── MarketplaceView ── -->
  <rect x="404" y="334" width="112" height="28" rx="5" fill="#a6e3a1" stroke="#94e2d5" stroke-width="1.5"/>
  <text x="460" y="352" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">MarketplaceView</text>

  <!-- ── ProfileView ── -->
  <rect x="504" y="334" width="112" height="28" rx="5" fill="#a6e3a1" stroke="#94e2d5" stroke-width="1.5"/>
  <text x="560" y="352" text-anchor="middle" fill="#1e1e2e" font-size="10" font-weight="bold">ProfileView</text>

  <!-- ── Chat sub-tree ── -->
  <line x1="100" y1="362" x2="100" y2="386" stroke="#585b70" stroke-width="1.5"/>
  <line x1="60" y1="386" x2="140" y2="386" stroke="#585b70" stroke-width="1.5"/>
  <line x1="70" y1="386" x2="70" y2="406" stroke="#585b70" stroke-width="1.5"/>
  <line x1="130" y1="386" x2="130" y2="406" stroke="#585b70" stroke-width="1.5"/>

  <rect x="22" y="406" width="96" height="24" rx="4" fill="#f9e2af"/>
  <text x="70" y="421" text-anchor="middle" fill="#1e1e2e" font-size="10">TaskHeader</text>

  <rect x="82" y="406" width="96" height="24" rx="4" fill="#f9e2af"/>
  <text x="130" y="421" text-anchor="middle" fill="#1e1e2e" font-size="10">MessageList</text>

  <!-- MessageList → Message -->
  <line x1="130" y1="430" x2="130" y2="450" stroke="#585b70" stroke-width="1.5"/>
  <rect x="82" y="450" width="96" height="24" rx="4" fill="#f9e2af"/>
  <text x="130" y="465" text-anchor="middle" fill="#1e1e2e" font-size="10">Message</text>

  <!-- Message → ToolCallBlock -->
  <line x1="130" y1="474" x2="130" y2="494" stroke="#585b70" stroke-width="1.5"/>
  <rect x="82" y="494" width="96" height="24" rx="4" fill="#f9e2af"/>
  <text x="130" y="509" text-anchor="middle" fill="#1e1e2e" font-size="10">ToolCallBlock</text>

  <!-- Also PromptInput + PermissionDock -->
  <line x1="100" y1="386" x2="100" y2="406" stroke="#585b70" stroke-width="1.5"/>

  <!-- ── Settings sub-tree ── -->
  <line x1="340" y1="362" x2="340" y2="386" stroke="#585b70" stroke-width="1.5"/>
  <text x="340" y="400" text-anchor="middle" fill="#74c7ec" font-size="10">4 tab groups · 24 tabs (lazy)</text>

  <!-- Tab groups -->
  <line x1="240" y1="408" x2="440" y2="408" stroke="#585b70" stroke-width="1.5"/>
  <line x1="258" y1="408" x2="258" y2="428" stroke="#585b70" stroke-width="1.5"/>
  <line x1="320" y1="408" x2="320" y2="428" stroke="#585b70" stroke-width="1.5"/>
  <line x1="382" y1="408" x2="382" y2="428" stroke="#585b70" stroke-width="1.5"/>
  <line x1="422" y1="408" x2="422" y2="428" stroke="#585b70" stroke-width="1.5"/>

  <rect x="218" y="428" width="80" height="22" rx="4" fill="#f9e2af"/>
  <text x="258" y="443" text-anchor="middle" fill="#1e1e2e" font-size="9">AI Models</text>
  <text x="258" y="455" text-anchor="middle" fill="#6c7086" font-size="8">models·providers·routing·training</text>

  <rect x="280" y="428" width="80" height="22" rx="4" fill="#f9e2af"/>
  <text x="320" y="443" text-anchor="middle" fill="#1e1e2e" font-size="9">Workflow</text>
  <text x="320" y="455" text-anchor="middle" fill="#6c7086" font-size="8">agent·approve·autocomplete…</text>

  <rect x="342" y="428" width="80" height="22" rx="4" fill="#f9e2af"/>
  <text x="382" y="443" text-anchor="middle" fill="#1e1e2e" font-size="9">Integrations</text>
  <text x="382" y="455" text-anchor="middle" fill="#6c7086" font-size="8">browser·ssh·vps·hermes…</text>

  <rect x="382" y="428" width="80" height="22" rx="4" fill="#f9e2af"/>
  <text x="422" y="443" text-anchor="middle" fill="#1e1e2e" font-size="9">System</text>
  <text x="422" y="455" text-anchor="middle" fill="#6c7086" font-size="8">context·display·lang·about</text>

  <!-- History sub-tree -->
  <line x1="220" y1="362" x2="220" y2="386" stroke="#585b70" stroke-width="1.5"/>
  <rect x="164" y="386" width="112" height="22" rx="4" fill="#f9e2af"/>
  <text x="220" y="401" text-anchor="middle" fill="#1e1e2e" font-size="10">SessionList</text>
  <rect x="164" y="412" width="112" height="22" rx="4" fill="#f9e2af"/>
  <text x="220" y="427" text-anchor="middle" fill="#1e1e2e" font-size="10">CloudSessionList</text>

  <!-- MigrationWizard overlay note -->
  <rect x="560" y="260" width="200" height="40" rx="5" fill="#313244" stroke="#f38ba8" stroke-width="1.5"/>
  <text x="660" y="276" text-anchor="middle" fill="#f38ba8" font-size="10" font-weight="bold">MigrationWizard (overlay)</text>
  <text x="660" y="292" text-anchor="middle" fill="#6c7086" font-size="9">migrationNeeded() signal · state-driven</text>
  <line x1="560" y1="278" x2="390" y2="278" stroke="#f38ba8" stroke-width="1" stroke-dasharray="4,3"/>

  <!-- Title -->
  <text x="410" y="740" text-anchor="middle" fill="#6c7086" font-size="10">KiloCode Webview — Main Component Tree · canary.9</text>
</svg>
```

---

## 3. Context Provider Flow

Which context provides what data, and which components read/write each context.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 540" width="820" height="540" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">
  <rect width="820" height="540" fill="#1e1e2e" rx="8"/>

  <!-- ── VSCodeProvider ── -->
  <rect x="20" y="20" width="150" height="66" rx="6" fill="#1e1e2e" stroke="#89b4fa" stroke-width="2"/>
  <text x="95" y="38" text-anchor="middle" fill="#89b4fa" font-weight="bold">VSCodeProvider</text>
  <text x="95" y="52" text-anchor="middle" fill="#a6adc8" font-size="9">postMessage(msg)</text>
  <text x="95" y="64" text-anchor="middle" fill="#a6adc8" font-size="9">onMessage(handler) → unsub</text>
  <text x="95" y="76" text-anchor="middle" fill="#a6adc8" font-size="9">getState / setState</text>

  <!-- ── ServerProvider ── -->
  <rect x="20" y="106" width="150" height="84" rx="6" fill="#1e1e2e" stroke="#89b4fa" stroke-width="2"/>
  <text x="95" y="124" text-anchor="middle" fill="#89b4fa" font-weight="bold">ServerProvider</text>
  <text x="95" y="138" text-anchor="middle" fill="#a6adc8" font-size="9">workspaceDirectory()</text>
  <text x="95" y="150" text-anchor="middle" fill="#a6adc8" font-size="9">serverInfo() / connectionState()</text>
  <text x="95" y="162" text-anchor="middle" fill="#a6adc8" font-size="9">profileData() / deviceAuth()</text>
  <text x="95" y="174" text-anchor="middle" fill="#a6adc8" font-size="9">vscodeLanguage / languageOverride</text>

  <!-- ── ConfigProvider ── -->
  <rect x="20" y="210" width="150" height="96" rx="6" fill="#1e1e2e" stroke="#89b4fa" stroke-width="2"/>
  <text x="95" y="228" text-anchor="middle" fill="#89b4fa" font-weight="bold">ConfigProvider</text>
  <text x="95" y="242" text-anchor="middle" fill="#a6adc8" font-size="9">config() — live Config signal</text>
  <text x="95" y="254" text-anchor="middle" fill="#a6adc8" font-size="9">draft() — pending changes</text>
  <text x="95" y="266" text-anchor="middle" fill="#a6adc8" font-size="9">updateConfig(partial)</text>
  <text x="95" y="278" text-anchor="middle" fill="#a6adc8" font-size="9">saveConfig() / discardConfig()</text>
  <text x="95" y="290" text-anchor="middle" fill="#a6adc8" font-size="9">isDirty / saving / saveError</text>

  <!-- ── SessionProvider ── -->
  <rect x="20" y="326" width="150" height="108" rx="6" fill="#1e1e2e" stroke="#89b4fa" stroke-width="2"/>
  <text x="95" y="344" text-anchor="middle" fill="#89b4fa" font-weight="bold">SessionProvider</text>
  <text x="95" y="358" text-anchor="middle" fill="#a6adc8" font-size="9">sessions() / currentSessionID()</text>
  <text x="95" y="370" text-anchor="middle" fill="#a6adc8" font-size="9">messages() / status()</text>
  <text x="95" y="382" text-anchor="middle" fill="#a6adc8" font-size="9">allMessages() / allParts()</text>
  <text x="95" y="394" text-anchor="middle" fill="#a6adc8" font-size="9">permissions() / questions()</text>
  <text x="95" y="406" text-anchor="middle" fill="#a6adc8" font-size="9">agents() / selectedAgent()</text>
  <text x="95" y="418" text-anchor="middle" fill="#a6adc8" font-size="9">selectSession / sendMessage…</text>

  <!-- ── ProviderProvider ── -->
  <rect x="20" y="454" width="150" height="66" rx="6" fill="#1e1e2e" stroke="#89b4fa" stroke-width="2"/>
  <text x="95" y="472" text-anchor="middle" fill="#89b4fa" font-weight="bold">ProviderProvider</text>
  <text x="95" y="486" text-anchor="middle" fill="#a6adc8" font-size="9">providers() — catalog</text>
  <text x="95" y="498" text-anchor="middle" fill="#a6adc8" font-size="9">connected() / defaults()</text>
  <text x="95" y="510" text-anchor="middle" fill="#a6adc8" font-size="9">EnrichedModel list</text>

  <!-- ── Consumer columns ── -->

  <!-- col: AppContent -->
  <rect x="220" y="20" width="116" height="28" rx="4" fill="#313244" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="278" y="38" text-anchor="middle" fill="#a6e3a1" font-size="10">AppContent</text>
  <!-- reads VSCode, Server, Session -->
  <line x1="170" y1="53" x2="220" y2="34" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="170" y1="148" x2="220" y2="34" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="170" y1="380" x2="220" y2="34" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>

  <!-- col: Settings -->
  <rect x="220" y="68" width="116" height="28" rx="4" fill="#313244" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="278" y="86" text-anchor="middle" fill="#a6e3a1" font-size="10">Settings.tsx</text>
  <!-- reads Config, Session, Server, VSCode, Language -->
  <line x1="170" y1="258" x2="220" y2="82" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>

  <!-- col: ChatView -->
  <rect x="220" y="116" width="116" height="28" rx="4" fill="#313244" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="278" y="134" text-anchor="middle" fill="#a6e3a1" font-size="10">ChatView</text>
  <line x1="170" y1="380" x2="220" y2="130" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="170" y1="53" x2="220" y2="130" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>

  <!-- col: ModelsTab -->
  <rect x="220" y="164" width="116" height="28" rx="4" fill="#313244" stroke="#f9e2af" stroke-width="1.5"/>
  <text x="278" y="182" text-anchor="middle" fill="#f9e2af" font-size="10">ModelsTab</text>
  <line x1="170" y1="258" x2="220" y2="178" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="170" y1="490" x2="220" y2="178" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>

  <!-- col: DataBridge -->
  <rect x="220" y="212" width="116" height="28" rx="4" fill="#313244" stroke="#cba6f7" stroke-width="1.5"/>
  <text x="278" y="230" text-anchor="middle" fill="#cba6f7" font-size="10">DataBridge</text>
  <line x1="170" y1="380" x2="220" y2="226" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="170" y1="490" x2="220" y2="226" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>
  <line x1="170" y1="53" x2="220" y2="226" stroke="#89b4fa" stroke-width="1" stroke-dasharray="4,2"/>

  <!-- ── Flow direction label ── -->
  <text x="190" y="16" fill="#6c7086" font-size="9">reads via useXxx()</text>

  <!-- right column: IPC round-trip arrows -->
  <rect x="380" y="20" width="420" height="500" rx="8" fill="#181825" stroke="#313244" stroke-width="1"/>
  <text x="590" y="40" text-anchor="middle" fill="#74c7ec" font-size="11" font-weight="bold">IPC Message Round-Trip (key examples)</text>

  <!-- updateConfig flow -->
  <text x="400" y="68" fill="#a6e3a1" font-size="10" font-weight="bold">1. Config write</text>
  <text x="400" y="82" fill="#a6adc8" font-size="9">Tab calls updateConfig(partial)</text>
  <text x="400" y="94" fill="#a6adc8" font-size="9">  → draft() accumulates changes</text>
  <text x="400" y="106" fill="#a6adc8" font-size="9">Ctrl+S / Save bar → saveConfig()</text>
  <text x="400" y="118" fill="#a6adc8" font-size="9">  → postMessage({ type:"saveConfig", config })</text>
  <text x="400" y="130" fill="#a6adc8" font-size="9">Extension writes file, sends configUpdated</text>
  <text x="400" y="142" fill="#a6adc8" font-size="9">  → setSaving(false), draft cleared</text>

  <!-- session flow -->
  <text x="400" y="168" fill="#a6e3a1" font-size="10" font-weight="bold">2. Session stream</text>
  <text x="400" y="182" fill="#a6adc8" font-size="9">Extension sends sessionUpdate / partDelta</text>
  <text x="400" y="194" fill="#a6adc8" font-size="9">  → SessionProvider store.produce()</text>
  <text x="400" y="206" fill="#a6adc8" font-size="9">  → only subscribers to changed keys update</text>
  <text x="400" y="218" fill="#a6adc8" font-size="9">DataBridge getters expose store to DataProvider</text>

  <!-- navigate flow -->
  <text x="400" y="244" fill="#a6e3a1" font-size="10" font-weight="bold">3. Navigation</text>
  <text x="400" y="258" fill="#a6adc8" font-size="9">Extension posts { type:"navigate", view, tab }</text>
  <text x="400" y="270" fill="#a6adc8" font-size="9">  → AppContent handler: setCurrentView()</text>
  <text x="400" y="282" fill="#a6adc8" font-size="9">  → if tab: setSettingsTab()</text>
  <text x="400" y="294" fill="#a6adc8" font-size="9">Settings effect: on(props.tab) → setActive()</text>

  <!-- permission flow -->
  <text x="400" y="320" fill="#a6e3a1" font-size="10" font-weight="bold">4. Permission request</text>
  <text x="400" y="334" fill="#a6adc8" font-size="9">Extension: { type:"permissionRequest", ... }</text>
  <text x="400" y="346" fill="#a6adc8" font-size="9">  → upsertPermission() in session store</text>
  <text x="400" y="358" fill="#a6adc8" font-size="9">ChatView: familyPermissions() memo fires</text>
  <text x="400" y="370" fill="#a6adc8" font-size="9">PermissionDock renders with request</text>
  <text x="400" y="382" fill="#a6adc8" font-size="9">User clicks → respondToPermission()</text>
  <text x="400" y="394" fill="#a6adc8" font-size="9">  → postMessage({ type:"permissionResponse" })</text>

  <!-- speech flow -->
  <text x="400" y="420" fill="#a6e3a1" font-size="10" font-weight="bold">5. Auto-speak</text>
  <text x="400" y="434" fill="#a6adc8" font-size="9">session.status() busy → idle</text>
  <text x="400" y="446" fill="#a6adc8" font-size="9">  → createEffect(on(status)) fires</text>
  <text x="400" y="458" fill="#a6adc8" font-size="9">  → reads last assistant message parts</text>
  <text x="400" y="470" fill="#a6adc8" font-size="9">  → filterTextForSpeech + detectSentiment</text>
  <text x="400" y="482" fill="#a6adc8" font-size="9">  → SpeechProviderRegistry.speak()</text>
</svg>
```

---

## 4. State Management Patterns

| Component Area | Primitive | Purpose |
|---|---|---|
| `VSCodeProvider` | `Set<handler>` (plain JS) | Message handler registry — not reactive, handlers are called imperatively |
| `ConfigProvider` | `createSignal<Config>` | Whole config object; replaced atomically on `configLoaded` |
| `ConfigProvider` | `createSignal<Partial<Config>>` (draft) | Accumulated unsaved changes; merged onto `config()` for display |
| `SessionProvider` | `createStore(...)` + `produce()` | Per-message / per-part mutation; fine-grained reactivity via store keys |
| `SessionProvider` | `createSignal<string[]>` (sessions) | Session list; replaced wholesale |
| `SessionProvider` | `createMemo(...)` (allMessages, status) | Derived aggregates; cached until dependencies change |
| `ProviderProvider` | `createSignal<Record<id,Provider>>` | Catalog of providers from extension; replaced on reload |
| `AppContent` | `createSignal<ViewType>` | Current view; drives `<Switch>/<Match>` |
| `AppContent` | `createSignal<SpeechSettings>` | Loaded lazily; drives auto-speak effect |
| `Settings` | `createSignal<string>` (active) | Active tab id |
| `Settings` | `createSignal<Set<string>>` (visitedTabs) | Keep-alive set — see section 5 |
| `Settings` | `createSignal<string[]>` (recentTabs) | Recently visited tab list (max 3) |
| `ChatView` | `createMemo(...)` (familyPermissions) | BFS walk memoized; consumers re-run only when result changes |
| `ModelsTab` | `createMemo(filteredModels)` | Filtered + sorted model array with stable equality check |
| `ModelsTab` | `createSignal<number>` (scrollTop) | Virtualization scroll offset |

**Store vs Signal guideline** used in this codebase:
- Use `createStore` when individual array elements or object keys update independently (e.g. streaming message parts).
- Use `createSignal` when the whole value is replaced atomically (e.g. config reload, view switch).
- Use `createMemo` to derive values shared by multiple children — computed once, cached until sources change.

---

## 5. New in canary.9 — Keep-Alive Tab Caching

The `visitedTabs` signal in `Settings.tsx` implements a keep-alive pattern: once a settings tab is visited its subtree stays mounted but hidden, eliminating remount cost on re-navigation.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 360" width="780" height="360" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">
  <rect width="780" height="360" fill="#1e1e2e" rx="8"/>

  <!-- Title -->
  <text x="390" y="22" text-anchor="middle" fill="#cdd6f4" font-size="13" font-weight="bold">Keep-Alive Tab Caching — visitedTabs signal flow</text>

  <!-- Step 1: Initial state -->
  <rect x="20" y="40" width="200" height="80" rx="6" fill="#313244" stroke="#585b70" stroke-width="1.5"/>
  <text x="120" y="58" text-anchor="middle" fill="#89b4fa" font-size="10" font-weight="bold">Initial mount</text>
  <text x="120" y="72" text-anchor="middle" fill="#a6adc8" font-size="9">visitedTabs = new Set(["models"])</text>
  <text x="120" y="84" text-anchor="middle" fill="#a6adc8" font-size="9">active() = "models"</text>
  <text x="120" y="96" text-anchor="middle" fill="#a6adc8" font-size="9">Only "models" tab is rendered</text>
  <text x="120" y="108" text-anchor="middle" fill="#a6adc8" font-size="9">(Show guard + Suspense)</text>

  <!-- arrow 1→2 -->
  <line x1="220" y1="80" x2="270" y2="80" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="245" y="72" text-anchor="middle" fill="#74c7ec" font-size="9">user clicks</text>
  <text x="245" y="83" text-anchor="middle" fill="#74c7ec" font-size="9">"providers"</text>

  <!-- Step 2: onTabChange fires -->
  <rect x="270" y="40" width="220" height="80" rx="6" fill="#313244" stroke="#585b70" stroke-width="1.5"/>
  <text x="380" y="58" text-anchor="middle" fill="#89b4fa" font-size="10" font-weight="bold">onTabChange("providers")</text>
  <text x="380" y="72" text-anchor="middle" fill="#a6adc8" font-size="9">1. setRecentTabs(["models"])</text>
  <text x="380" y="84" text-anchor="middle" fill="#a6adc8" font-size="9">2. setVisitedTabs(s =&gt; s.add("providers"))</text>
  <text x="380" y="96" text-anchor="middle" fill="#a6adc8" font-size="9">3. isDirty? → navGuard toast</text>
  <text x="380" y="108" text-anchor="middle" fill="#a6adc8" font-size="9">4. setActive("providers")</text>

  <!-- arrow 2→3 -->
  <line x1="490" y1="80" x2="540" y2="80" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="515" y="72" text-anchor="middle" fill="#74c7ec" font-size="9">signal</text>
  <text x="515" y="83" text-anchor="middle" fill="#74c7ec" font-size="9">update</text>

  <!-- Step 3: DOM state -->
  <rect x="540" y="40" width="220" height="80" rx="6" fill="#313244" stroke="#585b70" stroke-width="1.5"/>
  <text x="650" y="58" text-anchor="middle" fill="#89b4fa" font-size="10" font-weight="bold">DOM after update</text>
  <text x="650" y="72" text-anchor="middle" fill="#a6adc8" font-size="9">"models" tab: display:none (mounted)</text>
  <text x="650" y="84" text-anchor="middle" fill="#a6adc8" font-size="9">"providers" tab: display:unset (visible)</text>
  <text x="650" y="96" text-anchor="middle" fill="#a6adc8" font-size="9">All other tabs: not yet in DOM</text>
  <text x="650" y="108" text-anchor="middle" fill="#a6adc8" font-size="9">(Show guard blocks render)</text>

  <!-- Code box -->
  <rect x="20" y="150" width="740" height="80" rx="6" fill="#181825" stroke="#45475a" stroke-width="1"/>
  <text x="40" y="168" fill="#74c7ec" font-size="10" font-weight="bold">Settings.tsx — keep-alive render pattern (simplified)</text>
  <text x="40" y="185" fill="#a6e3a1" font-size="10">&lt;For each={tabDefs}&gt;</text>
  <text x="40" y="198" fill="#cdd6f4" font-size="10">  &lt;Tabs.Content value={def.id} style={{ display: active() === def.id ? undefined : "none" }} forceMount&gt;</text>
  <text x="40" y="211" fill="#cdd6f4" font-size="10">    &lt;Show when={visitedTabs().has(def.id)}&gt;   {/* gate: only render once visited */}</text>
  <text x="40" y="224" fill="#cdd6f4" font-size="10">      &lt;Suspense fallback={&lt;TabSkeleton/&gt;}&gt;  {/* lazy load boundary */}</text>

  <!-- State machine diagram -->
  <rect x="20" y="252" width="740" height="90" rx="6" fill="#181825" stroke="#45475a" stroke-width="1"/>
  <text x="40" y="270" fill="#74c7ec" font-size="10" font-weight="bold">Tab lifecycle state machine</text>

  <!-- states -->
  <rect x="40" y="278" width="100" height="26" rx="4" fill="#313244" stroke="#f38ba8" stroke-width="1.5"/>
  <text x="90" y="295" text-anchor="middle" fill="#f38ba8" font-size="9">UNVISITED</text>
  <text x="90" y="307" text-anchor="middle" fill="#6c7086" font-size="8">not in DOM</text>

  <line x1="140" y1="291" x2="190" y2="291" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="165" y="285" text-anchor="middle" fill="#74c7ec" font-size="8">first click</text>

  <rect x="190" y="278" width="110" height="26" rx="4" fill="#313244" stroke="#f9e2af" stroke-width="1.5"/>
  <text x="245" y="295" text-anchor="middle" fill="#f9e2af" font-size="9">LOADING (Suspense)</text>
  <text x="245" y="307" text-anchor="middle" fill="#6c7086" font-size="8">dynamic import in-flight</text>

  <line x1="300" y1="291" x2="360" y2="291" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="330" y="285" text-anchor="middle" fill="#74c7ec" font-size="8">module ready</text>

  <rect x="360" y="278" width="110" height="26" rx="4" fill="#313244" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="415" y="295" text-anchor="middle" fill="#a6e3a1" font-size="9">ACTIVE</text>
  <text x="415" y="307" text-anchor="middle" fill="#6c7086" font-size="8">visible, display:unset</text>

  <line x1="470" y1="291" x2="530" y2="291" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="500" y="285" text-anchor="middle" fill="#74c7ec" font-size="8">navigate away</text>

  <rect x="530" y="278" width="120" height="26" rx="4" fill="#313244" stroke="#585b70" stroke-width="1.5"/>
  <text x="590" y="295" text-anchor="middle" fill="#a6adc8" font-size="9">CACHED (keep-alive)</text>
  <text x="590" y="307" text-anchor="middle" fill="#6c7086" font-size="8">mounted, display:none</text>

  <!-- back arrow cached→active -->
  <path d="M650 304 C 680 330 680 330 415 330 L 415 304" fill="none" stroke="#74c7ec" stroke-width="1" stroke-dasharray="4,2" marker-end="url(#arr)"/>
  <text x="535" y="340" text-anchor="middle" fill="#74c7ec" font-size="8">re-click: instant (no remount)</text>

  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#74c7ec"/>
    </marker>
  </defs>
</svg>
```

---

## 6. New in canary.9 — Lazy Tab Loading

Every settings tab module is loaded with `lazy(() => import(...))`. The module is only fetched the first time `visitedTabs().has(tabId)` becomes true (i.e., first navigation to that tab). Subsequent visits use the cached module.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 300" width="780" height="300" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">
  <rect width="780" height="300" fill="#1e1e2e" rx="8"/>
  <text x="390" y="22" text-anchor="middle" fill="#cdd6f4" font-size="13" font-weight="bold">Lazy Tab Loading — dynamic import chain</text>

  <!-- Column headers -->
  <text x="80"  y="44" text-anchor="middle" fill="#6c7086" font-size="9">Settings.tsx</text>
  <text x="240" y="44" text-anchor="middle" fill="#6c7086" font-size="9">SolidJS runtime</text>
  <text x="430" y="44" text-anchor="middle" fill="#6c7086" font-size="9">Browser / bundler</text>
  <text x="630" y="44" text-anchor="middle" fill="#6c7086" font-size="9">Tab component</text>

  <!-- vertical separators -->
  <line x1="160" y1="30" x2="160" y2="290" stroke="#313244" stroke-width="1" stroke-dasharray="4,3"/>
  <line x1="330" y1="30" x2="330" y2="290" stroke="#313244" stroke-width="1" stroke-dasharray="4,3"/>
  <line x1="530" y1="30" x2="530" y2="290" stroke="#313244" stroke-width="1" stroke-dasharray="4,3"/>

  <!-- Step 1 -->
  <rect x="20" y="56" width="120" height="32" rx="4" fill="#313244" stroke="#89b4fa" stroke-width="1.5"/>
  <text x="80" y="68" text-anchor="middle" fill="#89b4fa" font-size="9">const ModelsTab =</text>
  <text x="80" y="80" text-anchor="middle" fill="#89b4fa" font-size="9">lazy(() =&gt; import(…))</text>

  <!-- arrow: registration time (no fetch yet) -->
  <line x1="140" y1="72" x2="190" y2="72" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr2)"/>
  <text x="165" y="65" text-anchor="middle" fill="#74c7ec" font-size="8">registers lazy</text>

  <rect x="190" y="56" width="120" height="32" rx="4" fill="#313244" stroke="#89b4fa" stroke-width="1.5"/>
  <text x="250" y="68" text-anchor="middle" fill="#89b4fa" font-size="9">Lazy wrapper created</text>
  <text x="250" y="80" text-anchor="middle" fill="#89b4fa" font-size="9">no fetch yet</text>

  <!-- Step 2: user visits tab -->
  <rect x="20" y="114" width="120" height="40" rx="4" fill="#313244" stroke="#f9e2af" stroke-width="1.5"/>
  <text x="80" y="128" text-anchor="middle" fill="#f9e2af" font-size="9">visitedTabs().has(</text>
  <text x="80" y="140" text-anchor="middle" fill="#f9e2af" font-size="9">"models") → true</text>
  <text x="80" y="152" text-anchor="middle" fill="#6c7086" font-size="8">(Show gate opens)</text>

  <line x1="140" y1="134" x2="190" y2="134" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr2)"/>
  <text x="165" y="126" text-anchor="middle" fill="#74c7ec" font-size="8">renders</text>
  <text x="165" y="136" text-anchor="middle" fill="#74c7ec" font-size="8">&lt;ModelsTab/&gt;</text>

  <!-- Suspense fires -->
  <rect x="190" y="114" width="120" height="40" rx="4" fill="#313244" stroke="#f9e2af" stroke-width="1.5"/>
  <text x="250" y="128" text-anchor="middle" fill="#f9e2af" font-size="9">Suspense boundary</text>
  <text x="250" y="140" text-anchor="middle" fill="#f9e2af" font-size="9">shows TabSkeleton</text>
  <text x="250" y="152" text-anchor="middle" fill="#6c7086" font-size="8">while loading…</text>

  <line x1="310" y1="134" x2="360" y2="134" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr2)"/>
  <text x="335" y="126" text-anchor="middle" fill="#74c7ec" font-size="8">dynamic</text>
  <text x="335" y="136" text-anchor="middle" fill="#74c7ec" font-size="8">import()</text>

  <!-- browser fetch -->
  <rect x="360" y="114" width="150" height="40" rx="4" fill="#313244" stroke="#f9e2af" stroke-width="1.5"/>
  <text x="435" y="128" text-anchor="middle" fill="#f9e2af" font-size="9">Fetch chunk from</text>
  <text x="435" y="140" text-anchor="middle" fill="#f9e2af" font-size="9">webview bundle cache</text>
  <text x="435" y="152" text-anchor="middle" fill="#6c7086" font-size="8">(one JS chunk per tab)</text>

  <line x1="510" y1="134" x2="550" y2="134" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr2)"/>
  <text x="530" y="126" text-anchor="middle" fill="#74c7ec" font-size="8">module</text>
  <text x="530" y="136" text-anchor="middle" fill="#74c7ec" font-size="8">resolved</text>

  <rect x="550" y="114" width="200" height="40" rx="4" fill="#313244" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="650" y="128" text-anchor="middle" fill="#a6e3a1" font-size="9">ModelsTab component</text>
  <text x="650" y="140" text-anchor="middle" fill="#a6e3a1" font-size="9">mounted, Suspense clears</text>
  <text x="650" y="152" text-anchor="middle" fill="#6c7086" font-size="8">TabSkeleton removed</text>

  <!-- Step 3: subsequent visits -->
  <rect x="20" y="182" width="120" height="40" rx="4" fill="#313244" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="80" y="196" text-anchor="middle" fill="#a6e3a1" font-size="9">User navigates back</text>
  <text x="80" y="208" text-anchor="middle" fill="#a6e3a1" font-size="9">to "models"</text>
  <text x="80" y="220" text-anchor="middle" fill="#6c7086" font-size="8">(active() changes)</text>

  <line x1="140" y1="202" x2="190" y2="202" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr2)"/>

  <rect x="190" y="182" width="120" height="40" rx="4" fill="#313244" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="250" y="196" text-anchor="middle" fill="#a6e3a1" font-size="9">display:unset set</text>
  <text x="250" y="208" text-anchor="middle" fill="#a6e3a1" font-size="9">on cached pane</text>
  <text x="250" y="220" text-anchor="middle" fill="#6c7086" font-size="8">zero JS execution</text>

  <line x1="310" y1="202" x2="550" y2="202" stroke="#a6e3a1" stroke-width="1" stroke-dasharray="4,2"/>
  <text x="430" y="194" text-anchor="middle" fill="#a6e3a1" font-size="9">NO fetch, NO remount, NO Suspense</text>
  <text x="430" y="206" text-anchor="middle" fill="#6c7086" font-size="8">component tree already in DOM (keep-alive)</text>

  <!-- Code snippet at bottom -->
  <rect x="20" y="244" width="740" height="44" rx="4" fill="#181825" stroke="#45475a" stroke-width="1"/>
  <text x="40" y="260" fill="#74c7ec" font-size="9" font-weight="bold">Settings.tsx declarations (top of file):</text>
  <text x="40" y="274" fill="#a6e3a1" font-size="9">const ModelsTab = lazy(() =&gt; import("./ModelsTab"))   // kilocode_change: lazy-load each tab module</text>
  <text x="40" y="286" fill="#a6e3a1" font-size="9">const ProvidersTab = lazy(() =&gt; import("./ProvidersTab"))   // ... × 22 more tabs</text>

  <defs>
    <marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#74c7ec"/>
    </marker>
  </defs>
</svg>
```

---

## 7. SolidJS Reactivity Graph — Settings Config Flow

The full reactive chain from user interaction back to component update, tracing the favorite-model toggle as a concrete example.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 580" width="820" height="580" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">
  <rect width="820" height="580" fill="#1e1e2e" rx="8"/>
  <text x="410" y="22" text-anchor="middle" fill="#cdd6f4" font-size="13" font-weight="bold">SolidJS Reactivity Graph — config signal → ModelsTab → star button → extension → back</text>

  <!-- Node definitions -->

  <!-- 1: config() signal -->
  <ellipse cx="120" cy="70" rx="90" ry="24" fill="#313244" stroke="#89b4fa" stroke-width="2"/>
  <text x="120" y="66" text-anchor="middle" fill="#89b4fa" font-size="10" font-weight="bold">config() signal</text>
  <text x="120" y="80" text-anchor="middle" fill="#a6adc8" font-size="8">ConfigProvider · createSignal</text>

  <!-- arrow 1→2 -->
  <line x1="210" y1="70" x2="280" y2="70" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr3)"/>
  <text x="245" y="63" text-anchor="middle" fill="#74c7ec" font-size="8">read by memo</text>

  <!-- 2: createMemo(filteredModels) -->
  <rect x="280" y="50" width="160" height="40" rx="6" fill="#313244" stroke="#cba6f7" stroke-width="2"/>
  <text x="360" y="66" text-anchor="middle" fill="#cba6f7" font-size="10" font-weight="bold">createMemo</text>
  <text x="360" y="80" text-anchor="middle" fill="#a6adc8" font-size="8">(filteredModels) in ModelsTab</text>
  <text x="360" y="92" text-anchor="middle" fill="#6c7086" font-size="8">filter+sort · modelArrayEqual guard</text>

  <!-- arrow 2→3 -->
  <line x1="440" y1="70" x2="510" y2="70" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr3)"/>
  <text x="475" y="63" text-anchor="middle" fill="#74c7ec" font-size="8">stable array</text>

  <!-- 3: For loop -->
  <ellipse cx="590" cy="70" rx="90" ry="24" fill="#313244" stroke="#f9e2af" stroke-width="2"/>
  <text x="590" y="66" text-anchor="middle" fill="#f9e2af" font-size="10" font-weight="bold">&lt;For each={models}&gt;</text>
  <text x="590" y="80" text-anchor="middle" fill="#a6adc8" font-size="8">keyed by model.id</text>

  <!-- arrow 3→4 -->
  <line x1="590" y1="94" x2="590" y2="130" stroke="#74c7ec" stroke-width="1.5" marker-end="url(#arr3)"/>
  <text x="610" y="118" fill="#74c7ec" font-size="8">renders N rows</text>

  <!-- 4: ModelRow -->
  <rect x="490" y="130" width="200" height="56" rx="6" fill="#313244" stroke="#f9e2af" stroke-width="2"/>
  <text x="590" y="150" text-anchor="middle" fill="#f9e2af" font-size="10" font-weight="bold">ModelRow component</text>
  <text x="590" y="164" text-anchor="middle" fill="#a6adc8" font-size="8">reads: model.name, model.isFavorite</text>
  <text x="590" y="176" text-anchor="middle" fill="#a6adc8" font-size="8">shows: star button (☆/★)</text>

  <!-- arrow 4→5: user clicks star -->
  <line x1="490" y1="158" x2="380" y2="230" stroke="#f38ba8" stroke-width="2" marker-end="url(#arr3r)"/>
  <text x="420" y="196" fill="#f38ba8" font-size="8">onClick: user</text>
  <text x="420" y="207" fill="#f38ba8" font-size="8">clicks star ★</text>

  <!-- 5: toggleFavorite -->
  <rect x="200" y="218" width="160" height="40" rx="6" fill="#313244" stroke="#f38ba8" stroke-width="2"/>
  <text x="280" y="234" text-anchor="middle" fill="#f38ba8" font-size="10" font-weight="bold">toggleFavorite()</text>
  <text x="280" y="248" text-anchor="middle" fill="#a6adc8" font-size="8">updateConfig({ models: { [id]: { isFavorite } } })</text>

  <!-- arrow 5→6 -->
  <line x1="200" y1="238" x2="100" y2="238" stroke="#f38ba8" stroke-width="1.5" marker-end="url(#arr3r)"/>

  <!-- 6: draft() signal -->
  <ellipse cx="70" cy="280" rx="60" ry="22" fill="#313244" stroke="#f38ba8" stroke-width="2"/>
  <text x="70" y="276" text-anchor="middle" fill="#f38ba8" font-size="9" font-weight="bold">draft() signal</text>
  <text x="70" y="290" text-anchor="middle" fill="#a6adc8" font-size="8">{ models: {…} }</text>

  <!-- 6a: config() signal also updated (optimistic) -->
  <line x1="100" y1="238" x2="100" y2="280" stroke="#f38ba8" stroke-width="1.5"/>
  <line x1="100" y1="280" x2="70" y2="280" stroke="#f38ba8" stroke-width="1.5" marker-end="url(#arr3r)"/>

  <!-- setConfig optimistically merges draft -->
  <rect x="130" y="310" width="180" height="40" rx="6" fill="#313244" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="220" y="326" text-anchor="middle" fill="#a6e3a1" font-size="9" font-weight="bold">resolveConfig(saved, draft)</text>
  <text x="220" y="340" text-anchor="middle" fill="#a6adc8" font-size="8">deepMerge → new config value</text>

  <!-- arrow draft→resolveConfig -->
  <line x1="70" y1="302" x2="130" y2="330" stroke="#f38ba8" stroke-width="1.5" marker-end="url(#arr3r)"/>

  <!-- arrow resolveConfig → config() signal update -->
  <line x1="130" y1="320" x2="80" y2="70" stroke="#a6e3a1" stroke-width="1.5" stroke-dasharray="5,3" marker-end="url(#arr3g)"/>
  <text x="50" y="200" fill="#a6e3a1" font-size="8" transform="rotate(-80,50,200)">setConfig()</text>
  <text x="30" y="180" fill="#6c7086" font-size="8" transform="rotate(-80,30,180)">(optimistic)</text>

  <!-- config() signal fires → memo re-runs -->
  <text x="410" y="120" fill="#74c7ec" font-size="9" font-style="italic">filteredModels memo re-runs only if</text>
  <text x="410" y="133" fill="#74c7ec" font-size="9" font-style="italic">isFavorite changed affects sort order</text>

  <!-- Ctrl+S / Save bar path -->
  <rect x="350" y="310" width="200" height="40" rx="6" fill="#313244" stroke="#89b4fa" stroke-width="1.5"/>
  <text x="450" y="326" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="bold">saveConfig() (Ctrl+S)</text>
  <text x="450" y="340" text-anchor="middle" fill="#a6adc8" font-size="8">postMessage({ type:"saveConfig" })</text>

  <line x1="310" y1="330" x2="350" y2="330" stroke="#89b4fa" stroke-width="1.5" marker-end="url(#arr3)"/>

  <!-- Extension -->
  <rect x="580" y="300" width="200" height="60" rx="6" fill="#313244" stroke="#89b4fa" stroke-width="2"/>
  <text x="680" y="320" text-anchor="middle" fill="#89b4fa" font-size="10" font-weight="bold">VS Code Extension</text>
  <text x="680" y="334" text-anchor="middle" fill="#a6adc8" font-size="8">writes config.json to disk</text>
  <text x="680" y="348" text-anchor="middle" fill="#a6adc8" font-size="8">sends { type:"configUpdated" }</text>

  <line x1="550" y1="330" x2="580" y2="330" stroke="#89b4fa" stroke-width="1.5" marker-end="url(#arr3)"/>

  <!-- Extension → config signal (confirmation) -->
  <line x1="680" y1="360" x2="680" y2="430" stroke="#89b4fa" stroke-width="1.5"/>
  <line x1="680" y1="430" x2="120" y2="430" stroke="#89b4fa" stroke-width="1.5"/>
  <line x1="120" y1="430" x2="120" y2="94" stroke="#89b4fa" stroke-width="1.5" marker-end="url(#arr3)"/>
  <text x="400" y="445" text-anchor="middle" fill="#89b4fa" font-size="9">configUpdated → setConfig(message.config) + setSaving(false) + setDraft({})</text>

  <!-- For loop note -->
  <rect x="20" y="390" width="340" height="44" rx="4" fill="#181825" stroke="#45475a" stroke-width="1"/>
  <text x="30" y="408" fill="#74c7ec" font-size="9" font-weight="bold">SolidJS For loop keying</text>
  <text x="30" y="422" fill="#a6adc8" font-size="9">&lt;For&gt; tracks items by identity (===). If filteredModels</text>
  <text x="30" y="434" fill="#a6adc8" font-size="9">returns same refs, zero rows re-render (modelArrayEqual guard).</text>

  <!-- isFavorite note -->
  <rect x="420" y="390" width="360" height="44" rx="4" fill="#181825" stroke="#45475a" stroke-width="1"/>
  <text x="430" y="408" fill="#74c7ec" font-size="9" font-weight="bold">Fine-grained reactivity on isFavorite</text>
  <text x="430" y="422" fill="#a6adc8" font-size="9">ModelRow reads config().models[id].isFavorite directly.</text>
  <text x="430" y="434" fill="#a6adc8" font-size="9">Only that row's star icon re-renders when the flag flips.</text>

  <!-- legend -->
  <rect x="20" y="470" width="200" height="90" rx="4" fill="#181825" stroke="#45475a" stroke-width="1"/>
  <text x="30" y="486" fill="#cdd6f4" font-size="9" font-weight="bold">Arrow legend</text>
  <line x1="30" y1="500" x2="80" y2="500" stroke="#74c7ec" stroke-width="2" marker-end="url(#arr3)"/>
  <text x="90" y="504" fill="#a6adc8" font-size="9">reactive read / derives from</text>
  <line x1="30" y1="518" x2="80" y2="518" stroke="#f38ba8" stroke-width="2" marker-end="url(#arr3r)"/>
  <text x="90" y="522" fill="#a6adc8" font-size="9">user action / write</text>
  <line x1="30" y1="536" x2="80" y2="536" stroke="#a6e3a1" stroke-width="1.5" stroke-dasharray="5,3" marker-end="url(#arr3g)"/>
  <text x="90" y="540" fill="#a6adc8" font-size="9">optimistic update path</text>
  <line x1="30" y1="554" x2="80" y2="554" stroke="#89b4fa" stroke-width="1.5" marker-end="url(#arr3)"/>
  <text x="90" y="558" fill="#a6adc8" font-size="9">IPC / extension round-trip</text>

  <defs>
    <marker id="arr3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#74c7ec"/>
    </marker>
    <marker id="arr3r" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#f38ba8"/>
    </marker>
    <marker id="arr3g" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#a6e3a1"/>
    </marker>
  </defs>
</svg>
```

---

## Quick Reference — Key Files

| File | Role |
|---|---|
| `src/App.tsx` | Root component; full provider stack + AppContent + DataBridge |
| `src/context/vscode.tsx` | VSCode IPC bridge; `postMessage` + `onMessage` registry |
| `src/context/config.tsx` | Config signal, draft accumulation, save/discard flow |
| `src/context/session.tsx` | Solid store for sessions, messages, parts, permissions, agents |
| `src/context/provider.tsx` | Provider catalog; enriched model list |
| `src/context/server.tsx` | Server info, workspace directory, profile/auth data |
| `src/components/settings/Settings.tsx` | 24-tab settings shell; keep-alive + lazy loading |
| `src/components/chat/ChatView.tsx` | Main chat UI; permission/question/suggestion scoping |
| `src/components/settings/ModelsTab.tsx` | Model list with virtualization and stable memo |
| `src/components/chat/TaskToolExpanded.tsx` | Overrides upstream "task" tool renderer for VS Code sidebar |
