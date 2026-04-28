# KiloCode Settings Architecture Overview
> canary-9 release — generated 2026-04-27

---

## Overview

KiloCode's settings system is a multi-layer configuration surface exposed through a 24-tab vertical sidebar in VS Code's webview panel. It is built with SolidJS, uses lazy-loaded tab modules, a keep-alive DOM cache, a command-palette (Ctrl+K), and a draft-accumulation pattern that batches writes before flushing to disk.

Three distinct storage backends are used depending on the tab:

| Backend | Where stored | Written by | Tabs |
|---|---|---|---|
| **Config (kilo.json)** | `$XDG_CONFIG_HOME/kilo/kilo.json` on disk | `KiloProvider.handleUpdateConfig()` → CLI `Config.updateGlobal()` | models, providers, routing, training, agentBehaviour, autoApprove, autocomplete*, checkpoints, context, display, commitMessage, experimental, language* |
| **VS Code globalState / workspace config** | VS Code extension host memory | `KiloProvider.handleUpdateSetting()` → `workspace.getConfiguration().update()` | browser, autocomplete, notifications, speech, display* |
| **V4 Services** | In-memory service classes (SSHService, VPSService, etc.) | `KiloProvider.__daveExtensions.handleV4Message()` | ssh, vps, hermes, zeroclaw, memory, governance, hub |

---

## 1. Tab Map — All 24 Tabs in Four Groups

The following SVG shows all 24 settings tabs arranged in their four sidebar groups with navigation flow.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 720" font-family="ui-monospace, 'Cascadia Code', Consolas, monospace" font-size="11">

  <!-- Background -->
  <rect width="900" height="720" fill="#1e1e2e" rx="8"/>

  <!-- Title -->
  <text x="450" y="30" text-anchor="middle" fill="#cdd6f4" font-size="16" font-weight="700">KiloCode Settings — Tab Map (canary-9)</text>

  <!-- ═══════════════════════════════ AI MODELS GROUP ═══════════════════════════════ -->
  <!-- Group header -->
  <rect x="20" y="50" width="190" height="24" fill="#313244" rx="4"/>
  <text x="115" y="67" text-anchor="middle" fill="#89b4fa" font-size="10" font-weight="700" letter-spacing="1">AI MODELS</text>

  <!-- models -->
  <rect x="20" y="82" width="190" height="28" fill="#4a9eff" rx="4"/>
  <text x="115" y="101" text-anchor="middle" fill="white" font-size="11">models — Models</text>

  <!-- providers -->
  <rect x="20" y="116" width="190" height="28" fill="#4a9eff" rx="4"/>
  <text x="115" y="135" text-anchor="middle" fill="white" font-size="11">providers — Providers</text>

  <!-- routing -->
  <rect x="20" y="150" width="190" height="28" fill="#4a9eff" rx="4"/>
  <text x="115" y="169" text-anchor="middle" fill="white" font-size="11">routing — Provider Routing</text>

  <!-- training -->
  <rect x="20" y="184" width="190" height="28" fill="#4a9eff" rx="4"/>
  <text x="115" y="203" text-anchor="middle" fill="white" font-size="11">training — Training &amp; GPU</text>

  <!-- ═══════════════════════════════ WORKFLOW GROUP ═══════════════════════════════ -->
  <rect x="240" y="50" width="190" height="24" fill="#313244" rx="4"/>
  <text x="335" y="67" text-anchor="middle" fill="#a6e3a1" font-size="10" font-weight="700" letter-spacing="1">WORKFLOW</text>

  <!-- agentBehaviour -->
  <rect x="240" y="82" width="190" height="28" fill="#40a070" rx="4"/>
  <text x="335" y="101" text-anchor="middle" fill="white" font-size="11">agentBehaviour</text>

  <!-- autoApprove -->
  <rect x="240" y="116" width="190" height="28" fill="#40a070" rx="4"/>
  <text x="335" y="135" text-anchor="middle" fill="white" font-size="11">autoApprove — Auto Approve</text>

  <!-- autocomplete -->
  <rect x="240" y="150" width="190" height="28" fill="#40a070" rx="4"/>
  <text x="335" y="169" text-anchor="middle" fill="white" font-size="11">autocomplete</text>

  <!-- commitMessage -->
  <rect x="240" y="184" width="190" height="28" fill="#40a070" rx="4"/>
  <text x="335" y="203" text-anchor="middle" fill="white" font-size="11">commitMessage</text>

  <!-- checkpoints -->
  <rect x="240" y="218" width="190" height="28" fill="#40a070" rx="4"/>
  <text x="335" y="237" text-anchor="middle" fill="white" font-size="11">checkpoints</text>

  <!-- memory -->
  <rect x="240" y="252" width="190" height="28" fill="#40a070" rx="4"/>
  <text x="335" y="271" text-anchor="middle" fill="white" font-size="11">memory — Memory (Shiba)</text>

  <!-- ═══════════════════════════════ INTEGRATIONS GROUP ═══════════════════════════════ -->
  <rect x="460" y="50" width="190" height="24" fill="#313244" rx="4"/>
  <text x="555" y="67" text-anchor="middle" fill="#fab387" font-size="10" font-weight="700" letter-spacing="1">INTEGRATIONS</text>

  <!-- browser -->
  <rect x="460" y="82" width="190" height="28" fill="#c07030" rx="4"/>
  <text x="555" y="101" text-anchor="middle" fill="white" font-size="11">browser — Browser</text>

  <!-- ssh -->
  <rect x="460" y="116" width="190" height="28" fill="#c07030" rx="4"/>
  <text x="555" y="135" text-anchor="middle" fill="white" font-size="11">ssh — SSH &amp; Remote</text>

  <!-- vps -->
  <rect x="460" y="150" width="190" height="28" fill="#c07030" rx="4"/>
  <text x="555" y="169" text-anchor="middle" fill="white" font-size="11">vps — VPS &amp; Infra</text>

  <!-- hermes -->
  <rect x="460" y="184" width="190" height="28" fill="#c07030" rx="4"/>
  <text x="555" y="203" text-anchor="middle" fill="white" font-size="11">hermes — Hermes Pipeline</text>

  <!-- zeroclaw -->
  <rect x="460" y="218" width="190" height="28" fill="#c07030" rx="4"/>
  <text x="555" y="237" text-anchor="middle" fill="white" font-size="11">zeroclaw — ZeroClaw</text>

  <!-- hub -->
  <rect x="460" y="252" width="190" height="28" fill="#c07030" rx="4"/>
  <text x="555" y="271" text-anchor="middle" fill="white" font-size="11">hub — Hub</text>

  <!-- notifications -->
  <rect x="460" y="286" width="190" height="28" fill="#c07030" rx="4"/>
  <text x="555" y="305" text-anchor="middle" fill="white" font-size="11">notifications</text>

  <!-- speech -->
  <rect x="460" y="320" width="190" height="28" fill="#c07030" rx="4"/>
  <text x="555" y="339" text-anchor="middle" fill="white" font-size="11">speech — Speech</text>

  <!-- ═══════════════════════════════ SYSTEM GROUP ═══════════════════════════════ -->
  <rect x="680" y="50" width="190" height="24" fill="#313244" rx="4"/>
  <text x="775" y="67" text-anchor="middle" fill="#cba6f7" font-size="10" font-weight="700" letter-spacing="1">SYSTEM</text>

  <!-- context -->
  <rect x="680" y="82" width="190" height="28" fill="#8060c0" rx="4"/>
  <text x="775" y="101" text-anchor="middle" fill="white" font-size="11">context — Context</text>

  <!-- display -->
  <rect x="680" y="116" width="190" height="28" fill="#8060c0" rx="4"/>
  <text x="775" y="135" text-anchor="middle" fill="white" font-size="11">display — Display</text>

  <!-- governance -->
  <rect x="680" y="150" width="190" height="28" fill="#8060c0" rx="4"/>
  <text x="775" y="169" text-anchor="middle" fill="white" font-size="11">governance — Governance</text>

  <!-- language -->
  <rect x="680" y="184" width="190" height="28" fill="#8060c0" rx="4"/>
  <text x="775" y="203" text-anchor="middle" fill="white" font-size="11">language — Language</text>

  <!-- experimental -->
  <rect x="680" y="218" width="190" height="28" fill="#8060c0" rx="4"/>
  <text x="775" y="237" text-anchor="middle" fill="white" font-size="11">experimental</text>

  <!-- aboutKiloCode -->
  <rect x="680" y="252" width="190" height="28" fill="#8060c0" rx="4"/>
  <text x="775" y="271" text-anchor="middle" fill="white" font-size="11">aboutKiloCode — About</text>

  <!-- ═══════════════════════════════ NAVIGATION FEATURES ═══════════════════════════════ -->
  <rect x="20" y="400" width="860" height="90" fill="#181825" rx="6" stroke="#45475a" stroke-width="1"/>
  <text x="450" y="420" text-anchor="middle" fill="#6c7086" font-size="10" font-weight="700" letter-spacing="1">NAVIGATION FEATURES</text>

  <!-- Command Palette -->
  <rect x="35" y="430" width="170" height="48" fill="#313244" rx="4"/>
  <text x="120" y="449" text-anchor="middle" fill="#89b4fa" font-size="10" font-weight="700">Command Palette</text>
  <text x="120" y="465" text-anchor="middle" fill="#cdd6f4" font-size="9">Ctrl+K  fuzzy search</text>
  <text x="120" y="477" text-anchor="middle" fill="#585b70" font-size="9">all 24 tabs</text>

  <!-- Tab Filter -->
  <rect x="215" y="430" width="170" height="48" fill="#313244" rx="4"/>
  <text x="300" y="449" text-anchor="middle" fill="#a6e3a1" font-size="10" font-weight="700">Tab Filter Bar</text>
  <text x="300" y="465" text-anchor="middle" fill="#cdd6f4" font-size="9">substring search</text>
  <text x="300" y="477" text-anchor="middle" fill="#585b70" font-size="9">hides non-matching tabs</text>

  <!-- Recent Tabs -->
  <rect x="395" y="430" width="170" height="48" fill="#313244" rx="4"/>
  <text x="480" y="449" text-anchor="middle" fill="#fab387" font-size="10" font-weight="700">Recent Tabs</text>
  <text x="480" y="465" text-anchor="middle" fill="#cdd6f4" font-size="9">last 3 visited</text>
  <text x="480" y="477" text-anchor="middle" fill="#585b70" font-size="9">pinned at top of list</text>

  <!-- Keep-alive cache -->
  <rect x="575" y="430" width="170" height="48" fill="#313244" rx="4"/>
  <text x="660" y="449" text-anchor="middle" fill="#cba6f7" font-size="10" font-weight="700">Keep-Alive Cache</text>
  <text x="660" y="465" text-anchor="middle" fill="#cdd6f4" font-size="9">visited tabs stay mounted</text>
  <text x="660" y="477" text-anchor="middle" fill="#585b70" font-size="9">display:none (no remount)</text>

  <!-- Save Bar -->
  <rect x="755" y="430" width="115" height="48" fill="#313244" rx="4"/>
  <text x="812" y="449" text-anchor="middle" fill="#f38ba8" font-size="10" font-weight="700">Save Bar</text>
  <text x="812" y="465" text-anchor="middle" fill="#cdd6f4" font-size="9">Ctrl+S save</text>
  <text x="812" y="477" text-anchor="middle" fill="#585b70" font-size="9">Esc discard</text>

  <!-- ═══════════════════════════════ LEGEND ═══════════════════════════════ -->
  <rect x="20" y="510" width="860" height="46" fill="#181825" rx="6" stroke="#45475a" stroke-width="1"/>
  <text x="450" y="527" text-anchor="middle" fill="#6c7086" font-size="10" font-weight="700" letter-spacing="1">LEGEND — STORAGE BACKEND</text>
  <rect x="35" y="533" width="12" height="12" fill="#4a9eff" rx="2"/>
  <text x="54" y="543" fill="#cdd6f4" font-size="10">kilo.json (Config)</text>
  <rect x="200" y="533" width="12" height="12" fill="#40a070" rx="2"/>
  <text x="219" y="543" fill="#cdd6f4" font-size="10">kilo.json + VS Code</text>
  <rect x="390" y="533" width="12" height="12" fill="#c07030" rx="2"/>
  <text x="409" y="543" fill="#cdd6f4" font-size="10">VS Code globalState / V4 Services</text>
  <rect x="640" y="533" width="12" height="12" fill="#8060c0" rx="2"/>
  <text x="659" y="543" fill="#cdd6f4" font-size="10">System (mixed / read-only)</text>

  <!-- ═══════════════════════════════ AGENT BEHAVIOUR SUB-TABS ═══════════════════════════════ -->
  <rect x="20" y="572" width="860" height="90" fill="#181825" rx="6" stroke="#45475a" stroke-width="1"/>
  <text x="450" y="590" text-anchor="middle" fill="#6c7086" font-size="10" font-weight="700" letter-spacing="1">AGENT BEHAVIOUR SUB-TABS (nested inside agentBehaviour tab)</text>

  <rect x="35" y="598" width="120" height="28" fill="#40a070" rx="4"/>
  <text x="95" y="617" text-anchor="middle" fill="white" font-size="10">agents</text>

  <rect x="165" y="598" width="120" height="28" fill="#40a070" rx="4"/>
  <text x="225" y="617" text-anchor="middle" fill="white" font-size="10">mcpServers</text>

  <rect x="295" y="598" width="120" height="28" fill="#40a070" rx="4"/>
  <text x="355" y="617" text-anchor="middle" fill="white" font-size="10">rules</text>

  <rect x="425" y="598" width="120" height="28" fill="#40a070" rx="4"/>
  <text x="485" y="617" text-anchor="middle" fill="white" font-size="10">workflows</text>

  <rect x="555" y="598" width="120" height="28" fill="#40a070" rx="4"/>
  <text x="615" y="617" text-anchor="middle" fill="white" font-size="10">skills</text>

  <rect x="685" y="598" width="120" height="28" fill="#40a070" rx="4"/>
  <text x="745" y="617" text-anchor="middle" fill="white" font-size="10">presets</text>

  <!-- Count badge -->
  <text x="450" y="678" text-anchor="middle" fill="#585b70" font-size="10">24 top-level tabs + 6 agentBehaviour sub-tabs = 30 total settings surfaces</text>

</svg>
```

---

## 2. Settings Data Flow Diagram

The following SVG illustrates the full round-trip for a Config (kilo.json) change and separately the VS Code extension-settings path.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 640" font-family="ui-monospace, 'Cascadia Code', Consolas, monospace" font-size="11">

  <!-- Background -->
  <rect width="900" height="640" fill="#1e1e2e" rx="8"/>

  <!-- Title -->
  <text x="450" y="26" text-anchor="middle" fill="#cdd6f4" font-size="14" font-weight="700">KiloCode Settings — Data Flow (Config path + VS Code path)</text>

  <!-- ════════════ LEFT SIDE: CONFIG (kilo.json) PATH ════════════ -->
  <text x="220" y="54" text-anchor="middle" fill="#89b4fa" font-size="11" font-weight="700">CONFIG PATH  (kilo.json)</text>

  <!-- 1. Webview UI (Tab Component) -->
  <rect x="60" y="65" width="320" height="44" fill="#313244" rx="6" stroke="#89b4fa" stroke-width="1.5"/>
  <text x="220" y="84" text-anchor="middle" fill="#cdd6f4" font-size="11" font-weight="600">Webview Tab Component</text>
  <text x="220" y="99" text-anchor="middle" fill="#6c7086" font-size="9">e.g. ModelsTab, ContextTab, ExperimentalTab</text>

  <!-- arrow down -->
  <line x1="220" y1="109" x2="220" y2="133" stroke="#89b4fa" stroke-width="1.5" marker-end="url(#arrowBlue)"/>
  <text x="290" y="124" fill="#6c7086" font-size="9">updateConfig(partial)</text>

  <!-- 2. ConfigContext (config.tsx) -->
  <rect x="60" y="134" width="320" height="52" fill="#313244" rx="6" stroke="#89b4fa" stroke-width="1.5"/>
  <text x="220" y="153" text-anchor="middle" fill="#cdd6f4" font-size="11" font-weight="600">ConfigContext  (config.tsx)</text>
  <text x="220" y="166" text-anchor="middle" fill="#6c7086" font-size="9">deepMerge into draft signal  ·  setIsDirty(true)</text>
  <text x="220" y="178" text-anchor="middle" fill="#6c7086" font-size="9">optimistic UI update of config() signal</text>

  <!-- arrow down -->
  <line x1="220" y1="186" x2="220" y2="210" stroke="#89b4fa" stroke-width="1.5" marker-end="url(#arrowBlue)"/>
  <text x="300" y="202" fill="#6c7086" font-size="9">user clicks Save / Ctrl+S</text>

  <!-- 3. postMessage -->
  <rect x="60" y="211" width="320" height="36" fill="#45475a" rx="6" stroke="#89b4fa" stroke-width="1"/>
  <text x="220" y="226" text-anchor="middle" fill="#cdd6f4" font-size="11">postMessage</text>
  <text x="220" y="241" text-anchor="middle" fill="#6c7086" font-size="9">{ type: "updateConfig", config: draft }</text>

  <!-- arrow down -->
  <line x1="220" y1="247" x2="220" y2="268" stroke="#89b4fa" stroke-width="1.5" marker-end="url(#arrowBlue)"/>
  <text x="296" y="261" fill="#6c7086" font-size="9">VS Code IPC boundary</text>

  <!-- 4. KiloProvider.ts -->
  <rect x="60" y="269" width="320" height="52" fill="#313244" rx="6" stroke="#89b4fa" stroke-width="1.5"/>
  <text x="220" y="287" text-anchor="middle" fill="#cdd6f4" font-size="11" font-weight="600">KiloProvider.ts</text>
  <text x="220" y="301" text-anchor="middle" fill="#6c7086" font-size="9">handleUpdateConfig(partial)  ·  pending++</text>
  <text x="220" y="313" text-anchor="middle" fill="#6c7086" font-size="9">client.global.config.update({ config: partial })</text>

  <!-- arrow down -->
  <line x1="220" y1="321" x2="220" y2="345" stroke="#89b4fa" stroke-width="1.5" marker-end="url(#arrowBlue)"/>
  <text x="296" y="338" fill="#6c7086" font-size="9">tRPC / UNIX socket</text>

  <!-- 5. CLI Backend -->
  <rect x="60" y="346" width="320" height="52" fill="#313244" rx="6" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="220" y="364" text-anchor="middle" fill="#a6e3a1" font-size="11" font-weight="600">CLI Backend  (config.ts)</text>
  <text x="220" y="378" text-anchor="middle" fill="#6c7086" font-size="9">Config.updateGlobal(config)</text>
  <text x="220" y="390" text-anchor="middle" fill="#6c7086" font-size="9">patchJsonc()  →  write kilo.json to disk</text>

  <!-- arrow right/up to globalState -->
  <line x1="220" y1="398" x2="220" y2="422" stroke="#a6e3a1" stroke-width="1.5" marker-end="url(#arrowGreen)"/>
  <text x="296" y="414" fill="#6c7086" font-size="9">config.get() → merged Config</text>

  <!-- 6. configUpdated feedback -->
  <rect x="60" y="423" width="320" height="44" fill="#313244" rx="6" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="220" y="442" text-anchor="middle" fill="#cdd6f4" font-size="11" font-weight="600">KiloProvider → postMessage back</text>
  <text x="220" y="456" text-anchor="middle" fill="#6c7086" font-size="9">{ type: "configUpdated", config: merged }  ·  pending--</text>

  <!-- arrow back up to ConfigContext — shown as right-side loop -->
  <path d="M 380 445 Q 430 445 430 155 Q 430 135 380 135" fill="none" stroke="#a6e3a1" stroke-width="1.5" stroke-dasharray="5 3" marker-end="url(#arrowGreen)"/>
  <text x="440" y="305" fill="#6c7086" font-size="9" transform="rotate(-90 440 305)">setDraft({})  ·  setIsDirty(false)</text>

  <!-- ════════════ RIGHT SIDE: VS CODE SETTINGS PATH ════════════ -->
  <text x="690" y="54" text-anchor="middle" fill="#fab387" font-size="11" font-weight="700">VSCODE SETTINGS PATH  (immediate)</text>

  <!-- 1. Tab Component -->
  <rect x="530" y="65" width="330" height="44" fill="#313244" rx="6" stroke="#fab387" stroke-width="1.5"/>
  <text x="695" y="84" text-anchor="middle" fill="#cdd6f4" font-size="11" font-weight="600">Webview Tab Component</text>
  <text x="695" y="99" text-anchor="middle" fill="#6c7086" font-size="9">BrowserTab, AutocompleteTab, NotificationsTab, SpeechTab</text>

  <!-- arrow down -->
  <line x1="695" y1="109" x2="695" y2="140" stroke="#fab387" stroke-width="1.5" marker-end="url(#arrowOrange)"/>
  <text x="720" y="128" fill="#6c7086" font-size="9">postMessage</text>

  <!-- 2. postMessage updateSetting -->
  <rect x="530" y="141" width="330" height="36" fill="#45475a" rx="6" stroke="#fab387" stroke-width="1"/>
  <text x="695" y="156" text-anchor="middle" fill="#cdd6f4" font-size="11">postMessage</text>
  <text x="695" y="171" text-anchor="middle" fill="#6c7086" font-size="9">{ type: "updateSetting", key, value }</text>

  <!-- arrow down -->
  <line x1="695" y1="177" x2="695" y2="205" stroke="#fab387" stroke-width="1.5" marker-end="url(#arrowOrange)"/>

  <!-- 3. KiloProvider -->
  <rect x="530" y="206" width="330" height="52" fill="#313244" rx="6" stroke="#fab387" stroke-width="1.5"/>
  <text x="695" y="224" text-anchor="middle" fill="#cdd6f4" font-size="11" font-weight="600">KiloProvider.ts</text>
  <text x="695" y="238" text-anchor="middle" fill="#6c7086" font-size="9">handleUpdateSetting(key, value)</text>
  <text x="695" y="250" text-anchor="middle" fill="#6c7086" font-size="9">no draft accumulation — immediate write</text>

  <!-- arrow down -->
  <line x1="695" y1="258" x2="695" y2="283" stroke="#fab387" stroke-width="1.5" marker-end="url(#arrowOrange)"/>

  <!-- 4. VS Code API -->
  <rect x="530" y="284" width="330" height="52" fill="#313244" rx="6" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="695" y="302" text-anchor="middle" fill="#cdd6f4" font-size="11" font-weight="600">VS Code API</text>
  <text x="695" y="316" text-anchor="middle" fill="#6c7086" font-size="9">workspace.getConfiguration("kilo-code.new.X")</text>
  <text x="695" y="328" text-anchor="middle" fill="#6c7086" font-size="9">.update(key, value, ConfigurationTarget.Global)</text>

  <!-- No configUpdated sent note -->
  <rect x="530" y="352" width="330" height="36" fill="#181825" rx="4" stroke="#585b70" stroke-width="1" stroke-dasharray="4 2"/>
  <text x="695" y="368" text-anchor="middle" fill="#6c7086" font-size="10" font-style="italic">No "configUpdated" postMessage sent back.</text>
  <text x="695" y="382" text-anchor="middle" fill="#6c7086" font-size="10" font-style="italic">Tab reads value directly from its own local signal.</text>

  <!-- ════════════ V4 SERVICES PATH ════════════ -->
  <rect x="60" y="510" width="820" height="80" fill="#181825" rx="6" stroke="#45475a" stroke-width="1"/>
  <text x="450" y="530" text-anchor="middle" fill="#6c7086" font-size="10" font-weight="700" letter-spacing="1">V4 SERVICES PATH  (ssh, vps, hermes, zeroclaw, routing, memory, training, governance, hub)</text>

  <!-- Tab -->
  <rect x="75" y="538" width="140" height="40" fill="#313244" rx="4" stroke="#cba6f7" stroke-width="1"/>
  <text x="145" y="555" text-anchor="middle" fill="#cdd6f4" font-size="10">V4 Tab Component</text>
  <text x="145" y="569" text-anchor="middle" fill="#6c7086" font-size="9">e.g. VPSTab, HermesTab</text>

  <!-- arrow -->
  <line x1="215" y1="558" x2="260" y2="558" stroke="#cba6f7" stroke-width="1.5" marker-end="url(#arrowPurple)"/>

  <!-- postMessage v4 -->
  <rect x="261" y="538" width="170" height="40" fill="#313244" rx="4" stroke="#cba6f7" stroke-width="1"/>
  <text x="346" y="555" text-anchor="middle" fill="#cdd6f4" font-size="10">postMessage</text>
  <text x="346" y="569" text-anchor="middle" fill="#6c7086" font-size="9">{ type: "v4SubsystemRequest" }</text>

  <!-- arrow -->
  <line x1="431" y1="558" x2="476" y2="558" stroke="#cba6f7" stroke-width="1.5" marker-end="url(#arrowPurple)"/>

  <!-- KiloProvider v4 -->
  <rect x="477" y="538" width="170" height="40" fill="#313244" rx="4" stroke="#cba6f7" stroke-width="1"/>
  <text x="562" y="555" text-anchor="middle" fill="#cdd6f4" font-size="10">KiloProvider</text>
  <text x="562" y="569" text-anchor="middle" fill="#6c7086" font-size="9">__daveExtensions.handleV4Message()</text>

  <!-- arrow -->
  <line x1="647" y1="558" x2="692" y2="558" stroke="#cba6f7" stroke-width="1.5" marker-end="url(#arrowPurple)"/>

  <!-- V4 Service -->
  <rect x="693" y="538" width="170" height="40" fill="#313244" rx="4" stroke="#cba6f7" stroke-width="1"/>
  <text x="778" y="555" text-anchor="middle" fill="#cdd6f4" font-size="10">V4 Service Class</text>
  <text x="778" y="569" text-anchor="middle" fill="#6c7086" font-size="9">SSHService / VPSService / …</text>

  <!-- Arrow markers -->
  <defs>
    <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#89b4fa"/>
    </marker>
    <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#a6e3a1"/>
    </marker>
    <marker id="arrowOrange" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#fab387"/>
    </marker>
    <marker id="arrowPurple" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#cba6f7"/>
    </marker>
  </defs>

</svg>
```

---

## 3. Tab Enhancement Summary (canary-9)

The following table summarises new functionality present in each tab as found in the canary-9 codebase. Tabs that are wholesale additions in canary-9 are marked **NEW**.

| Tab | New features in canary-9 | Key interactions |
|---|---|---|
| `models` | Per-agent model selectors; `small_model` nullable sentinel; variant-selection persistence (`persistVariant`) | Reads `model`, `small_model`, `agent.<n>.model`; writes Config draft |
| `providers` | Custom provider dialog (`CustomProviderDialog.tsx`); custom model card (`CustomProviderModelCard.tsx`); `ProviderConnectDialog`, `ProviderSelectDialog` | Writes `provider.*`, `disabled_providers`, `enabled_providers`; postMessage `customProvider*` messages |
| `routing` | **NEW** — Provider Routing tab with circuit-breaker display, role-based routing config, fallback chain, route-trace log, sparkline latencies | V4 RoutingService; `v4SubsystemRequest` messages; `recentLatencies[]` per provider |
| `training` | **NEW** — Training & GPU tab; HuggingFace token storage; VS Code secret `kilo-training-huggingface`; GPU job submission | VS Code secret store; `kilo-code.new.training.huggingface.token` |
| `agentBehaviour` | Presets sub-tab (`PresetsTab.tsx`); Workflows sub-tab (`WorkflowsTab.tsx`); 6 sub-tabs total; `claudeCodeCompat` toggle | Writes `agent.*`, `mcp.*`, `instructions`, `skills.*`; VS Code `claudeCodeCompat` |
| `autoApprove` | Pattern-level overrides per tool (`PermissionRule` object form); `null` delete-sentinel support | Writes `permission.*`; `patchJsonc()` strips nulls from disk |
| `autocomplete` | Smart inline-task keybinding toggle; chat autocomplete toggle | Writes `kilo-code.new.autocomplete.enableSmartInlineTaskKeybinding`, `.enableChatAutocomplete` |
| `commitMessage` | **NEW** — Custom commit-message prompt editor | Writes `commit_message.prompt` via Config draft |
| `checkpoints` | Simple snapshot on/off toggle | Writes `snapshot` boolean in Config |
| `memory` | **NEW** — Memory (Shiba) tab; scope filters (global/project/task); recall query UI; token-usage graph; connection health display | V4 MemoryService; `MemoryEntry`, `RecallResult` types; `v4SubsystemRequest` messages |
| `browser` | `useSystemChrome` and `headless` options added | Writes `kilo-code.new.browserAutomation.*`; no Config involvement |
| `ssh` | **NEW** — SSH & Remote tab; SSH profile management | V4 SSHService |
| `vps` | **NEW** — VPS & Infra tab; multi-server inventory; live CPU/RAM/disk metrics; Docker container list; deploy log with rollback; sparkline health monitor | V4 VPSService; `VPSServer`, `VPSMetrics`, `DockerContainer`, `DeployEntry` types |
| `hermes` | **NEW** — Hermes Pipeline tab; enable/disable toggle; bridge URL; approval mode selector; live health ping; API key store; agent-assist panel; active task tracker; channel inspector; message trace | V4 HermesStatusService / HermesClient; `HermesStatus`, `AgentTask`, `ChannelInfo`, `MessageTraceEntry` types |
| `zeroclaw` | **NEW** — ZeroClaw Execution tab; risk-level sandbox config; network/write policy selectors; task queue with status machine; approval records; task templates; circuit breaker display | V4 ZeroClawService; `ZeroClawTask`, `ApprovalRecord`, `TaskTemplate` types; `RiskLevel`, `CircuitState` |
| `hub` | **NEW** — Hub Operations Surface tab | V4 Hub service |
| `notifications` | Sound toggles per event type (agent/permissions/errors) | Writes `kilo-code.new.sounds.*` alongside `notifications.*` |
| `speech` | **NEW** — Multi-provider TTS (Azure, Google, OpenAI, ElevenLabs, AWS Polly) with per-provider API key fields | Writes `kilo-code.new.speech.*`; sensitive keys stored in VS Code secrets |
| `context` | Compaction auto/prune toggles; watcher ignore-paths list; `compaction.reserved` field | Writes `compaction.*`, `watcher.ignore` |
| `display` | `showTaskTimeline` sidebar toggle; density options | Writes `username`, `layout`; VS Code `kilo-code.new.showTaskTimeline` |
| `governance` | **NEW** — Governance & Approvals tab; authority tier management (observer/operator/admin/superadmin); approval queue; dangerous-action registry; audit log; release-verdict view | V4 GovernanceService; `AuthorityTier`, `ApprovalRecord`, `DangerousAction`, `AuditEntry`, `ReleaseVerdict` types |
| `language` | UI locale selection; persisted via `kilo-code.new.language` VS Code config | Writes VS Code `language`; optionally `langModelMap` in Config for routing |
| `experimental` | `codebase_search` flag; `openTelemetry` flag (default=true); `remote_control`; `batch_tool`; per-tool enable/disable map | Writes `experimental.*`, `remote_control`, `share`, `formatter`, `lsp`, `tools.*` |
| `aboutKiloCode` | Displays extension version, server port, connection state; migration trigger | Read-only; sends `openExternalUrl`, `onMigrateClick` |

---

## 4. New Message Types (canary-9 session)

The following table lists WebviewMessage and ExtensionMessage types introduced or confirmed in this session's codebase exploration.

| Message type | Direction | Payload shape | Purpose |
|---|---|---|---|
| `updateConfig` | Webview → Extension | `{ type: "updateConfig", config: Partial<Config> }` | Flush accumulated draft to KiloProvider for write to kilo.json |
| `configUpdated` | Extension → Webview | `{ type: "configUpdated", config: Config }` | Broadcast merged Config back to webview after successful write |
| `updateSetting` | Webview → Extension | `{ type: "updateSetting", key: string, value: unknown }` | Immediate write of a VS Code workspace/global configuration key |
| `settingsTabChanged` | Webview → Extension | `{ type: "settingsTabChanged", tab: string }` | Notify extension host which settings tab is now active |
| `settingsBack` | Webview → Extension | `{ type: "settingsBack" }` | Escape key with no palette open — signal panel to close/revert |
| `v4SubsystemRequest` | Webview → Extension | `{ type: "v4SubsystemRequest", subsystem: string, action: string, payload: unknown }` | Route a request to a named V4 service (ssh/vps/hermes/zeroclaw/routing/memory/training/governance/hub) |
| `v4SubsystemResponse` | Extension → Webview | `{ type: "v4SubsystemResponse", subsystem: string, requestId: string, data: unknown, error?: string }` | Return value / error from a V4 service call |
| `persistVariant` | Webview → Extension | `{ type: "persistVariant", providerId: string, modelId: string, variant: string }` | Save model variant selection to globalState |
| `persistRecents` | Webview → Extension | `{ type: "persistRecents", models: unknown[] }` | Save recently-used models list to globalState |
| `toggleFavorite` | Webview → Extension | `{ type: "toggleFavorite", providerId: string, modelId: string }` | Toggle starred model in `favoriteModels` globalState array |
| `hermesHealthCheck` | Webview → Extension | `{ type: "hermesHealthCheck" }` | Trigger a live ping to the Hermes bridge URL |
| `hermesHealthResult` | Extension → Webview | `{ type: "hermesHealthResult", reachable: boolean, latency_ms: number, error?: string }` | Return Hermes ping result to HermesTab |
| `hermesStoreKey` | Webview → Extension | `{ type: "hermesStoreKey", key: string }` | Store Hermes API key in VS Code SecretStorage |
| `hermesClearKey` | Webview → Extension | `{ type: "hermesClearKey" }` | Clear stored Hermes API key |
| `openExternalUrl` | Webview → Extension | `{ type: "openExternalUrl", url: string }` | Open a URL in the system browser (used by About tab) |
| `setLanguage` | Webview → Extension | `{ type: "setLanguage", language: string }` | Write `kilo-code.new.language` VS Code config key |

---

## 5. Key File Reference

| File path | Role |
|---|---|
| `packages/kilo-vscode/webview-ui/src/components/settings/Settings.tsx` | Root settings component — tab group definitions, keep-alive, command palette, save bar, breadcrumb |
| `packages/kilo-vscode/webview-ui/src/context/config.tsx` | ConfigContext — draft accumulation, `saveConfig()`, `discardConfig()`, `isDirty` signal |
| `packages/kilo-vscode/src/KiloProvider.ts` | All webview message handlers; globalState writes; `handleUpdateConfig`; `handleUpdateSetting`; V4 dispatch |
| `packages/opencode/src/config/config.ts` | `Info` zod schema; `Config.updateGlobal()`; `patchJsonc()`; `globalConfigFile()` |
| `packages/opencode/src/global/index.ts` | `Global.Path.config` — XDG config dir resolution with `app = "kilo"` |
| `packages/kilo-vscode/webview-ui/src/components/settings/VPSTab.tsx` | V4 tab — VPS server inventory, metrics, Docker, deploy log, health sparklines |
| `packages/kilo-vscode/webview-ui/src/components/settings/HermesTab.tsx` | V4 tab — Hermes pipeline config, health, API key, agent-assist, task tracker, channel/message trace |
| `packages/kilo-vscode/webview-ui/src/components/settings/ZeroClawTab.tsx` | V4 tab — ZeroClaw sandboxed execution, risk levels, circuit breaker, approval records |
| `packages/kilo-vscode/webview-ui/src/components/settings/GovernanceTab.tsx` | V4 tab — Authority tiers, approval queue, dangerous actions, audit log, release verdicts |
| `packages/kilo-vscode/webview-ui/src/components/settings/RoutingTab.tsx` | V4 tab — Provider circuit breakers, role routing, fallback chains, route-trace log |
| `packages/kilo-vscode/webview-ui/src/components/settings/MemoryTab.tsx` | V4 tab — Memory (Shiba) CRUD, recall queries, token graph, connection health |
| `packages/kilo-vscode/webview-ui/src/components/settings/agent-behaviour/PresetsTab.tsx` | AgentBehaviour sub-tab — agent preset management |
| `packages/kilo-vscode/webview-ui/src/components/settings/agent-behaviour/WorkflowsTab.tsx` | AgentBehaviour sub-tab — custom workflow definitions |
| `packages/kilo-vscode/webview-ui/src/components/settings/SettingsCommandPalette.tsx` | Ctrl+K fuzzy-search overlay across all 24 tabs |
| `packages/kilo-vscode/webview-ui/src/components/settings/settings-io.ts` | `KNOWN_KEYS` list; `buildExport()`; `parseImport()` for config import/export |
