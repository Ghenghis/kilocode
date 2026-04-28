# KiloCode canary.9 — Settings Feature Matrix

> Generated: 2026-04-27 | Release: canary.9 | Tabs covered: 35 (24 top-level + 6 agentBehaviour sub-tabs + 5 routing sub-surfaces)

---

## SVG Color Legend

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 110" font-family="ui-monospace,'Cascadia Code',Consolas,monospace" font-size="12">
  <rect width="860" height="110" fill="#1e1e2e" rx="8"/>
  <text x="430" y="24" text-anchor="middle" fill="#cdd6f4" font-size="14" font-weight="700">Feature Category Color Legend — canary-9</text>

  <!-- Blue: new in canary.9 -->
  <rect x="30" y="42" width="18" height="18" fill="#4a9eff" rx="3"/>
  <text x="55" y="55" fill="#89b4fa" font-size="12" font-weight="700">Blue</text>
  <text x="100" y="55" fill="#cdd6f4" font-size="11">= New in canary.9</text>

  <!-- Green: existing, enhanced -->
  <rect x="250" y="42" width="18" height="18" fill="#40a070" rx="3"/>
  <text x="275" y="55" fill="#a6e3a1" font-size="12" font-weight="700">Green</text>
  <text x="330" y="55" fill="#cdd6f4" font-size="11">= Existing, enhanced in canary.9</text>

  <!-- Gray: existing, unchanged -->
  <rect x="560" y="42" width="18" height="18" fill="#585b70" rx="3"/>
  <text x="585" y="55" fill="#9399b2" font-size="12" font-weight="700">Gray</text>
  <text x="630" y="55" fill="#cdd6f4" font-size="11">= Existing, unchanged</text>

  <!-- Row 2 labels -->
  <text x="55" y="88" fill="#cdd6f4" font-size="10">Wholly new tab or feature first shipped in canary.9</text>
  <text x="275" y="88" fill="#cdd6f4" font-size="10">Tab existed before canary.9 but received meaningful new capabilities</text>
  <text x="585" y="88" fill="#cdd6f4" font-size="10">Tab carries same feature set as previous release</text>
</svg>
```

---

## Main Feature Matrix — All 35 Settings Surfaces × 8 Feature Categories

Columns: **Test/Validate** · **Live Preview** · **Shortcuts** · **Auto-detect** · **Bulk Ops** · **Import/Export** · **Analytics/Stats** · **Accessibility**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 1020" font-family="ui-monospace,'Cascadia Code',Consolas,monospace" font-size="10">
  <rect width="1100" height="1020" fill="#1e1e2e" rx="8"/>

  <!-- Title -->
  <text x="550" y="22" text-anchor="middle" fill="#cdd6f4" font-size="14" font-weight="700">KiloCode canary.9 — Settings Feature Heat Map (35 tabs × 8 categories)</text>

  <!-- ─── Column headers ─── -->
  <!-- left margin = 220, each col = 108px wide, 8 cols -->
  <text x="220" y="50" fill="#6c7086" font-size="9" font-weight="700">TAB</text>

  <text x="274"  y="44" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Test/</text>
  <text x="274"  y="55" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Validate</text>

  <text x="382"  y="44" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Live</text>
  <text x="382"  y="55" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Preview</text>

  <text x="490"  y="44" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Short-</text>
  <text x="490"  y="55" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">cuts</text>

  <text x="598"  y="44" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Auto-</text>
  <text x="598"  y="55" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">detect</text>

  <text x="706"  y="44" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Bulk</text>
  <text x="706"  y="55" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Ops</text>

  <text x="814"  y="44" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Import/</text>
  <text x="814"  y="55" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Export</text>

  <text x="922"  y="44" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Analytics/</text>
  <text x="922"  y="55" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Stats</text>

  <text x="1030" y="44" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">Accessi-</text>
  <text x="1030" y="55" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">bility</text>

  <!-- ─── Grid lines ─── -->
  <!-- vertical separators -->
  <line x1="220" y1="60" x2="220" y2="1010" stroke="#313244" stroke-width="1"/>
  <line x1="328" y1="60" x2="328" y2="1010" stroke="#313244" stroke-width="0.5"/>
  <line x1="436" y1="60" x2="436" y2="1010" stroke="#313244" stroke-width="0.5"/>
  <line x1="544" y1="60" x2="544" y2="1010" stroke="#313244" stroke-width="0.5"/>
  <line x1="652" y1="60" x2="652" y2="1010" stroke="#313244" stroke-width="0.5"/>
  <line x1="760" y1="60" x2="760" y2="1010" stroke="#313244" stroke-width="0.5"/>
  <line x1="868" y1="60" x2="868" y2="1010" stroke="#313244" stroke-width="0.5"/>
  <line x1="976" y1="60" x2="976" y2="1010" stroke="#313244" stroke-width="0.5"/>
  <line x1="1084" y1="60" x2="1084" y2="1010" stroke="#313244" stroke-width="0.5"/>

  <!-- ─────────── AI MODELS GROUP header ─────────── -->
  <rect x="0" y="62" width="1100" height="16" fill="#1a1a2e" rx="0"/>
  <text x="8" y="74" fill="#89b4fa" font-size="9" font-weight="700" letter-spacing="1">▶  AI MODELS</text>

  <!-- ── Row: models (y=80) ── -->
  <rect x="2" y="79" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="94" fill="#cdd6f4" font-size="10">models</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="82" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="93" text-anchor="middle" fill="white" font-size="8">validate</text>
  <!-- Live Preview=green -->
  <rect x="355" y="82" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="382" y="93" text-anchor="middle" fill="white" font-size="8">preview</text>
  <!-- Shortcuts=gray -->
  <rect x="463" y="82" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="490" y="93" text-anchor="middle" fill="white" font-size="8">Ctrl+K</text>
  <!-- Auto-detect=green -->
  <rect x="571" y="82" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="598" y="93" text-anchor="middle" fill="white" font-size="8">detect</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="82" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="93" text-anchor="middle" fill="white" font-size="8">multi-sel</text>
  <!-- Import/Export=green -->
  <rect x="787" y="82" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="814" y="93" text-anchor="middle" fill="white" font-size="8">export</text>
  <!-- Analytics=blue -->
  <rect x="895" y="82" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="93" text-anchor="middle" fill="white" font-size="8">usage</text>
  <!-- Accessibility=gray -->
  <rect x="1003" y="82" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="1030" y="93" text-anchor="middle" fill="white" font-size="8">a11y</text>

  <!-- ── Row: providers (y=104) ── -->
  <rect x="2" y="103" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="118" fill="#cdd6f4" font-size="10">providers</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="106" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="117" text-anchor="middle" fill="white" font-size="8">ping</text>
  <!-- Live Preview=green -->
  <rect x="355" y="106" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="382" y="117" text-anchor="middle" fill="white" font-size="8">live</text>
  <!-- Shortcuts=gray -->
  <rect x="463" y="106" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="490" y="117" text-anchor="middle" fill="white" font-size="8">Ctrl+K</text>
  <!-- Auto-detect=blue -->
  <rect x="571" y="106" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="117" text-anchor="middle" fill="white" font-size="8">discover</text>
  <!-- Bulk Ops=gray -->
  <!-- Import/Export=green -->
  <rect x="787" y="106" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="814" y="117" text-anchor="middle" fill="white" font-size="8">export</text>
  <!-- Analytics=gray -->
  <!-- Accessibility=gray -->

  <!-- ── Row: routing (y=128) ── -->
  <rect x="2" y="127" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="142" fill="#4a9eff" font-size="10" font-weight="700">routing ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="130" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="141" text-anchor="middle" fill="white" font-size="8">trace</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="130" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="141" text-anchor="middle" fill="white" font-size="8">latency</text>
  <!-- Shortcuts=gray -->
  <rect x="463" y="130" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="490" y="141" text-anchor="middle" fill="white" font-size="8">Ctrl+K</text>
  <!-- Auto-detect=blue -->
  <rect x="571" y="130" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="141" text-anchor="middle" fill="white" font-size="8">circuit</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="130" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="141" text-anchor="middle" fill="white" font-size="8">fallback</text>
  <!-- Import/Export=blue -->
  <rect x="787" y="130" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="814" y="141" text-anchor="middle" fill="white" font-size="8">export</text>
  <!-- Analytics=blue -->
  <rect x="895" y="130" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="141" text-anchor="middle" fill="white" font-size="8">sparkline</text>
  <!-- Accessibility=gray -->

  <!-- ── Row: training (y=152) ── -->
  <rect x="2" y="151" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="166" fill="#4a9eff" font-size="10" font-weight="700">training ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="154" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="165" text-anchor="middle" fill="white" font-size="8">job test</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="154" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="165" text-anchor="middle" fill="white" font-size="8">progress</text>
  <!-- Shortcuts=gray -->
  <!-- Auto-detect=blue -->
  <rect x="571" y="154" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="165" text-anchor="middle" fill="white" font-size="8">GPU</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="154" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="165" text-anchor="middle" fill="white" font-size="8">batch</text>
  <!-- Import/Export=blue -->
  <rect x="787" y="154" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="814" y="165" text-anchor="middle" fill="white" font-size="8">import</text>
  <!-- Analytics=blue -->
  <rect x="895" y="154" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="165" text-anchor="middle" fill="white" font-size="8">epochs</text>
  <!-- Accessibility=gray -->

  <!-- ─────────── WORKFLOW GROUP header ─────────── -->
  <rect x="0" y="176" width="1100" height="16" fill="#1a1a2e" rx="0"/>
  <text x="8" y="188" fill="#a6e3a1" font-size="9" font-weight="700" letter-spacing="1">▶  WORKFLOW</text>

  <!-- ── Row: agentBehaviour (y=194) ── -->
  <rect x="2" y="193" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="208" fill="#a6e3a1" font-size="10">agentBehaviour</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="196" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="207" text-anchor="middle" fill="white" font-size="8">test rule</text>
  <!-- Live Preview=gray -->
  <!-- Shortcuts=gray -->
  <rect x="463" y="196" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="490" y="207" text-anchor="middle" fill="white" font-size="8">Ctrl+K</text>
  <!-- Auto-detect=gray -->
  <!-- Bulk Ops=green -->
  <rect x="679" y="196" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="706" y="207" text-anchor="middle" fill="white" font-size="8">bulk</text>
  <!-- Import/Export=green -->
  <rect x="787" y="196" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="814" y="207" text-anchor="middle" fill="white" font-size="8">export</text>
  <!-- Analytics=gray -->
  <!-- Accessibility=gray -->

  <!-- ── Row: agents sub-tab (y=218) ── -->
  <rect x="2" y="217" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="16"  y="232" fill="#a6e3a1" font-size="9">  └ agents</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="220" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="231" text-anchor="middle" fill="white" font-size="8">test</text>
  <!-- Bulk Ops=green -->
  <rect x="679" y="220" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="706" y="231" text-anchor="middle" fill="white" font-size="8">bulk</text>
  <!-- Import/Export=green -->
  <rect x="787" y="220" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="814" y="231" text-anchor="middle" fill="white" font-size="8">export</text>

  <!-- ── Row: mcpServers sub-tab (y=242) ── -->
  <rect x="2" y="241" width="216" height="22" fill="#181825" rx="3"/>
  <text x="16"  y="256" fill="#a6e3a1" font-size="9">  └ mcpServers</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="244" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="255" text-anchor="middle" fill="white" font-size="8">ping</text>
  <!-- Live Preview=green -->
  <rect x="355" y="244" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="382" y="255" text-anchor="middle" fill="white" font-size="8">connect</text>
  <!-- Bulk Ops=green -->
  <rect x="679" y="244" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="706" y="255" text-anchor="middle" fill="white" font-size="8">bulk</text>
  <!-- Import/Export=green -->
  <rect x="787" y="244" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="814" y="255" text-anchor="middle" fill="white" font-size="8">export</text>

  <!-- ── Row: rules sub-tab (y=266) ── -->
  <rect x="2" y="265" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="16"  y="280" fill="#a6e3a1" font-size="9">  └ rules</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="268" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="279" text-anchor="middle" fill="white" font-size="8">test rule</text>
  <!-- Bulk Ops=green -->
  <rect x="679" y="268" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="706" y="279" text-anchor="middle" fill="white" font-size="8">bulk</text>
  <!-- Import/Export=green -->
  <rect x="787" y="268" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="814" y="279" text-anchor="middle" fill="white" font-size="8">export</text>

  <!-- ── Row: workflows sub-tab (y=290) ── -->
  <rect x="2" y="289" width="216" height="22" fill="#181825" rx="3"/>
  <text x="16"  y="304" fill="#4a9eff" font-size="9">  └ workflows ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="292" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="303" text-anchor="middle" fill="white" font-size="8">dry-run</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="292" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="303" text-anchor="middle" fill="white" font-size="8">trace</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="292" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="303" text-anchor="middle" fill="white" font-size="8">bulk</text>
  <!-- Import/Export=blue -->
  <rect x="787" y="292" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="814" y="303" text-anchor="middle" fill="white" font-size="8">import</text>
  <!-- Analytics=blue -->
  <rect x="895" y="292" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="303" text-anchor="middle" fill="white" font-size="8">runs</text>

  <!-- ── Row: skills sub-tab (y=314) ── -->
  <rect x="2" y="313" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="16"  y="328" fill="#a6e3a1" font-size="9">  └ skills</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="316" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="327" text-anchor="middle" fill="white" font-size="8">invoke</text>
  <!-- Bulk Ops=green -->
  <rect x="679" y="316" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="706" y="327" text-anchor="middle" fill="white" font-size="8">bulk</text>
  <!-- Import/Export=green -->
  <rect x="787" y="316" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="814" y="327" text-anchor="middle" fill="white" font-size="8">export</text>

  <!-- ── Row: presets sub-tab (y=338) ── -->
  <rect x="2" y="337" width="216" height="22" fill="#181825" rx="3"/>
  <text x="16"  y="352" fill="#4a9eff" font-size="9">  └ presets ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="340" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="351" text-anchor="middle" fill="white" font-size="8">apply</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="340" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="351" text-anchor="middle" fill="white" font-size="8">bulk</text>
  <!-- Import/Export=blue -->
  <rect x="787" y="340" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="814" y="351" text-anchor="middle" fill="white" font-size="8">import</text>

  <!-- ── Row: autoApprove (y=362) ── -->
  <rect x="2" y="361" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="376" fill="#a6e3a1" font-size="10">autoApprove</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="364" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="375" text-anchor="middle" fill="white" font-size="8">simulate</text>
  <!-- Shortcuts=gray -->
  <rect x="463" y="364" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="490" y="375" text-anchor="middle" fill="white" font-size="8">Ctrl+K</text>
  <!-- Auto-detect=green -->
  <rect x="571" y="364" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="598" y="375" text-anchor="middle" fill="white" font-size="8">pattern</text>
  <!-- Bulk Ops=green -->
  <rect x="679" y="364" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="706" y="375" text-anchor="middle" fill="white" font-size="8">bulk</text>
  <!-- Import/Export=green -->
  <rect x="787" y="364" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="814" y="375" text-anchor="middle" fill="white" font-size="8">export</text>

  <!-- ── Row: autocomplete (y=386) ── -->
  <rect x="2" y="385" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="400" fill="#a6e3a1" font-size="10">autocomplete</text>
  <!-- Test/Validate=gray -->
  <!-- Live Preview=green -->
  <rect x="355" y="388" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="382" y="399" text-anchor="middle" fill="white" font-size="8">demo</text>
  <!-- Shortcuts=green -->
  <rect x="463" y="388" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="490" y="399" text-anchor="middle" fill="white" font-size="8">keybind</text>
  <!-- Auto-detect=gray -->
  <!-- Analytics=gray -->

  <!-- ── Row: commitMessage (y=410) ── -->
  <rect x="2" y="409" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="424" fill="#4a9eff" font-size="10" font-weight="700">commitMessage ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="412" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="423" text-anchor="middle" fill="white" font-size="8">preview</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="412" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="423" text-anchor="middle" fill="white" font-size="8">live</text>
  <!-- Import/Export=blue -->
  <rect x="787" y="412" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="814" y="423" text-anchor="middle" fill="white" font-size="8">export</text>

  <!-- ── Row: checkpoints (y=434) ── -->
  <rect x="2" y="433" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="448" fill="#585b70" font-size="10">checkpoints</text>
  <!-- Test/Validate=gray -->
  <!-- Live Preview=gray -->
  <!-- Shortcuts=gray -->
  <rect x="463" y="436" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="490" y="447" text-anchor="middle" fill="white" font-size="8">Ctrl+K</text>

  <!-- ── Row: memory (y=458) ── -->
  <rect x="2" y="457" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="472" fill="#4a9eff" font-size="10" font-weight="700">memory ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="460" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="471" text-anchor="middle" fill="white" font-size="8">recall</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="460" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="471" text-anchor="middle" fill="white" font-size="8">health</text>
  <!-- Auto-detect=blue -->
  <rect x="571" y="460" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="471" text-anchor="middle" fill="white" font-size="8">scope</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="460" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="471" text-anchor="middle" fill="white" font-size="8">prune</text>
  <!-- Analytics=blue -->
  <rect x="895" y="460" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="471" text-anchor="middle" fill="white" font-size="8">tokens</text>

  <!-- ─────────── INTEGRATIONS GROUP header ─────────── -->
  <rect x="0" y="482" width="1100" height="16" fill="#1a1a2e" rx="0"/>
  <text x="8" y="494" fill="#fab387" font-size="9" font-weight="700" letter-spacing="1">▶  INTEGRATIONS</text>

  <!-- ── Row: browser (y=500) ── -->
  <rect x="2" y="499" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="514" fill="#a6e3a1" font-size="10">browser</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="502" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="513" text-anchor="middle" fill="white" font-size="8">launch</text>
  <!-- Live Preview=green -->
  <rect x="355" y="502" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="382" y="513" text-anchor="middle" fill="white" font-size="8">screen</text>
  <!-- Auto-detect=green -->
  <rect x="571" y="502" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="598" y="513" text-anchor="middle" fill="white" font-size="8">chrome</text>

  <!-- ── Row: ssh (y=524) ── -->
  <rect x="2" y="523" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="538" fill="#4a9eff" font-size="10" font-weight="700">ssh ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="526" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="537" text-anchor="middle" fill="white" font-size="8">connect</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="526" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="537" text-anchor="middle" fill="white" font-size="8">status</text>
  <!-- Shortcuts=gray -->
  <!-- Auto-detect=blue -->
  <rect x="571" y="526" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="537" text-anchor="middle" fill="white" font-size="8">keys</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="526" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="537" text-anchor="middle" fill="white" font-size="8">profiles</text>
  <!-- Import/Export=blue -->
  <rect x="787" y="526" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="814" y="537" text-anchor="middle" fill="white" font-size="8">import</text>

  <!-- ── Row: vps (y=548) ── -->
  <rect x="2" y="547" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="562" fill="#4a9eff" font-size="10" font-weight="700">vps ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="550" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="561" text-anchor="middle" fill="white" font-size="8">deploy</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="550" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="561" text-anchor="middle" fill="white" font-size="8">metrics</text>
  <!-- Auto-detect=blue -->
  <rect x="571" y="550" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="561" text-anchor="middle" fill="white" font-size="8">docker</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="550" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="561" text-anchor="middle" fill="white" font-size="8">multi-srv</text>
  <!-- Analytics=blue -->
  <rect x="895" y="550" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="561" text-anchor="middle" fill="white" font-size="8">sparkline</text>
  <!-- Accessibility=gray -->

  <!-- ── Row: hermes (y=572) ── -->
  <rect x="2" y="571" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="586" fill="#4a9eff" font-size="10" font-weight="700">hermes ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="574" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="585" text-anchor="middle" fill="white" font-size="8">ping</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="574" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="585" text-anchor="middle" fill="white" font-size="8">health</text>
  <!-- Auto-detect=blue -->
  <rect x="571" y="574" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="585" text-anchor="middle" fill="white" font-size="8">queue</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="574" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="585" text-anchor="middle" fill="white" font-size="8">tasks</text>
  <!-- Analytics=blue -->
  <rect x="895" y="574" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="585" text-anchor="middle" fill="white" font-size="8">trace</text>

  <!-- ── Row: zeroclaw (y=596) ── -->
  <rect x="2" y="595" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="610" fill="#4a9eff" font-size="10" font-weight="700">zeroclaw ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="598" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="609" text-anchor="middle" fill="white" font-size="8">sandbox</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="598" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="609" text-anchor="middle" fill="white" font-size="8">circuit</text>
  <!-- Auto-detect=blue -->
  <rect x="571" y="598" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="609" text-anchor="middle" fill="white" font-size="8">risk</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="598" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="609" text-anchor="middle" fill="white" font-size="8">queue</text>
  <!-- Import/Export=blue -->
  <rect x="787" y="598" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="814" y="609" text-anchor="middle" fill="white" font-size="8">templates</text>
  <!-- Analytics=blue -->
  <rect x="895" y="598" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="609" text-anchor="middle" fill="white" font-size="8">approvals</text>

  <!-- ── Row: hub (y=620) ── -->
  <rect x="2" y="619" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="634" fill="#4a9eff" font-size="10" font-weight="700">hub ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="622" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="633" text-anchor="middle" fill="white" font-size="8">ping</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="622" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="633" text-anchor="middle" fill="white" font-size="8">status</text>
  <!-- Analytics=blue -->
  <rect x="895" y="622" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="633" text-anchor="middle" fill="white" font-size="8">ops log</text>

  <!-- ── Row: notifications (y=644) ── -->
  <rect x="2" y="643" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="658" fill="#a6e3a1" font-size="10">notifications</text>
  <!-- Test/Validate=green -->
  <rect x="247" y="646" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="274" y="657" text-anchor="middle" fill="white" font-size="8">test snd</text>
  <!-- Live Preview=green -->
  <rect x="355" y="646" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="382" y="657" text-anchor="middle" fill="white" font-size="8">preview</text>
  <!-- Accessibility=gray -->
  <rect x="1003" y="646" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="1030" y="657" text-anchor="middle" fill="white" font-size="8">a11y</text>

  <!-- ── Row: speech (y=668) ── -->
  <rect x="2" y="667" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="682" fill="#4a9eff" font-size="10" font-weight="700">speech ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="670" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="681" text-anchor="middle" fill="white" font-size="8">TTS test</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="670" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="681" text-anchor="middle" fill="white" font-size="8">preview</text>
  <!-- Auto-detect=blue -->
  <rect x="571" y="670" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="681" text-anchor="middle" fill="white" font-size="8">provider</text>
  <!-- Accessibility=blue -->
  <rect x="1003" y="670" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="1030" y="681" text-anchor="middle" fill="white" font-size="8">voice</text>

  <!-- ─────────── SYSTEM GROUP header ─────────── -->
  <rect x="0" y="692" width="1100" height="16" fill="#1a1a2e" rx="0"/>
  <text x="8" y="704" fill="#cba6f7" font-size="9" font-weight="700" letter-spacing="1">▶  SYSTEM</text>

  <!-- ── Row: context (y=710) ── -->
  <rect x="2" y="709" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="724" fill="#a6e3a1" font-size="10">context</text>
  <!-- Test/Validate=gray -->
  <!-- Live Preview=gray -->
  <!-- Auto-detect=green -->
  <rect x="571" y="712" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="598" y="723" text-anchor="middle" fill="white" font-size="8">compact</text>
  <!-- Bulk Ops=green -->
  <rect x="679" y="712" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="706" y="723" text-anchor="middle" fill="white" font-size="8">prune</text>
  <!-- Import/Export=gray -->

  <!-- ── Row: display (y=734) ── -->
  <rect x="2" y="733" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="748" fill="#a6e3a1" font-size="10">display</text>
  <!-- Test/Validate=gray -->
  <!-- Live Preview=green -->
  <rect x="355" y="736" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="382" y="747" text-anchor="middle" fill="white" font-size="8">theme</text>
  <!-- Accessibility=green -->
  <rect x="1003" y="736" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="1030" y="747" text-anchor="middle" fill="white" font-size="8">density</text>

  <!-- ── Row: governance (y=758) ── -->
  <rect x="2" y="757" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="772" fill="#4a9eff" font-size="10" font-weight="700">governance ★</text>
  <!-- Test/Validate=blue -->
  <rect x="247" y="760" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="274" y="771" text-anchor="middle" fill="white" font-size="8">simulate</text>
  <!-- Live Preview=blue -->
  <rect x="355" y="760" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="382" y="771" text-anchor="middle" fill="white" font-size="8">queue</text>
  <!-- Auto-detect=blue -->
  <rect x="571" y="760" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="598" y="771" text-anchor="middle" fill="white" font-size="8">danger</text>
  <!-- Bulk Ops=blue -->
  <rect x="679" y="760" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="706" y="771" text-anchor="middle" fill="white" font-size="8">verdicts</text>
  <!-- Import/Export=blue -->
  <rect x="787" y="760" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="814" y="771" text-anchor="middle" fill="white" font-size="8">audit</text>
  <!-- Analytics=blue -->
  <rect x="895" y="760" width="54" height="16" fill="#4a9eff" rx="3"/>
  <text x="922" y="771" text-anchor="middle" fill="white" font-size="8">log</text>

  <!-- ── Row: language (y=782) ── -->
  <rect x="2" y="781" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="796" fill="#585b70" font-size="10">language</text>
  <!-- Auto-detect=gray -->
  <rect x="571" y="784" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="598" y="795" text-anchor="middle" fill="white" font-size="8">locale</text>

  <!-- ── Row: experimental (y=806) ── -->
  <rect x="2" y="805" width="216" height="22" fill="#181825" rx="3"/>
  <text x="8"   y="820" fill="#a6e3a1" font-size="10">experimental</text>
  <!-- Test/Validate=gray -->
  <!-- Live Preview=green -->
  <rect x="355" y="808" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="382" y="819" text-anchor="middle" fill="white" font-size="8">flag</text>
  <!-- Shortcuts=gray -->
  <!-- Auto-detect=gray -->
  <!-- Bulk Ops=gray -->
  <!-- Import/Export=green -->
  <rect x="787" y="808" width="54" height="16" fill="#40a070" rx="3"/>
  <text x="814" y="819" text-anchor="middle" fill="white" font-size="8">flags</text>

  <!-- ── Row: aboutKiloCode (y=830) ── -->
  <rect x="2" y="829" width="216" height="22" fill="#1e1e2e" rx="3"/>
  <text x="8"   y="844" fill="#585b70" font-size="10">aboutKiloCode</text>
  <!-- Test/Validate=gray (migration trigger) -->
  <rect x="247" y="832" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="274" y="843" text-anchor="middle" fill="white" font-size="8">migrate</text>
  <!-- Analytics=gray -->
  <rect x="895" y="832" width="54" height="16" fill="#585b70" rx="3"/>
  <text x="922" y="843" text-anchor="middle" fill="white" font-size="8">version</text>

  <!-- ─────────── bottom legend ─────────── -->
  <rect x="0" y="860" width="1100" height="32" fill="#181825" rx="0"/>
  <text x="18" y="877" fill="#585b70" font-size="9">★ = wholly new tab in canary.9</text>
  <rect x="200" y="864" width="14" height="14" fill="#4a9eff" rx="2"/>
  <text x="220" y="875" fill="#cdd6f4" font-size="9">Blue = new canary.9</text>
  <rect x="390" y="864" width="14" height="14" fill="#40a070" rx="2"/>
  <text x="410" y="875" fill="#cdd6f4" font-size="9">Green = enhanced</text>
  <rect x="570" y="864" width="14" height="14" fill="#585b70" rx="2"/>
  <text x="590" y="875" fill="#cdd6f4" font-size="9">Gray = unchanged</text>
  <text x="760" y="877" fill="#585b70" font-size="9">Empty cell = feature not present in that tab</text>

  <!-- horizontal rule lines between groups -->
  <line x1="0" y1="176" x2="1100" y2="176" stroke="#45475a" stroke-width="0.5"/>
  <line x1="0" y1="482" x2="1100" y2="482" stroke="#45475a" stroke-width="0.5"/>
  <line x1="0" y1="692" x2="1100" y2="692" stroke="#45475a" stroke-width="0.5"/>
  <line x1="0" y1="855" x2="1100" y2="855" stroke="#45475a" stroke-width="0.5"/>
</svg>
```

---

## Per-Group Feature Count — SVG Bar Chart (new features added in canary.9)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 420" font-family="ui-monospace,'Cascadia Code',Consolas,monospace" font-size="11">
  <rect width="820" height="420" fill="#1e1e2e" rx="8"/>
  <text x="410" y="24" text-anchor="middle" fill="#cdd6f4" font-size="14" font-weight="700">New Features Added Per Tab Group — canary.9</text>

  <!-- Y-axis label -->
  <text x="12" y="220" fill="#6c7086" font-size="10" transform="rotate(-90 12 220)">new feature count</text>

  <!-- Axis -->
  <line x1="70" y1="50" x2="70" y2="350" stroke="#45475a" stroke-width="1"/>
  <line x1="70" y1="350" x2="790" y2="350" stroke="#45475a" stroke-width="1"/>

  <!-- Y gridlines and labels (max ~38) -->
  <line x1="70" y1="80"  x2="790" y2="80"  stroke="#313244" stroke-width="0.5" stroke-dasharray="4 3"/>
  <line x1="70" y1="140" x2="790" y2="140" stroke="#313244" stroke-width="0.5" stroke-dasharray="4 3"/>
  <line x1="70" y1="200" x2="790" y2="200" stroke="#313244" stroke-width="0.5" stroke-dasharray="4 3"/>
  <line x1="70" y1="260" x2="790" y2="260" stroke="#313244" stroke-width="0.5" stroke-dasharray="4 3"/>
  <line x1="70" y1="320" x2="790" y2="320" stroke="#313244" stroke-width="0.5" stroke-dasharray="4 3"/>

  <text x="58" y="84"  text-anchor="end" fill="#6c7086" font-size="9">38</text>
  <text x="58" y="144" text-anchor="end" fill="#6c7086" font-size="9">30</text>
  <text x="58" y="204" text-anchor="end" fill="#6c7086" font-size="9">22</text>
  <text x="58" y="264" text-anchor="end" fill="#6c7086" font-size="9">14</text>
  <text x="58" y="324" text-anchor="end" fill="#6c7086" font-size="9">6</text>

  <!-- scale: 350-80=270px = 38 features → 270/38 ≈ 7.1px per feature -->

  <!-- Bar: AI Models — 14 new features, height=14*7.1=99.4 -->
  <rect x="100" y="250" width="120" height="100" fill="#4a9eff" rx="4"/>
  <text x="160" y="244" text-anchor="middle" fill="#89b4fa" font-size="11" font-weight="700">14</text>
  <text x="160" y="378" text-anchor="middle" fill="#89b4fa" font-size="10">AI Models</text>
  <text x="160" y="390" text-anchor="middle" fill="#6c7086" font-size="9">models/providers/</text>
  <text x="160" y="401" text-anchor="middle" fill="#6c7086" font-size="9">routing/training</text>

  <!-- Bar: Workflow — 28 new features, height=28*7.1=198.8 -->
  <rect x="270" y="151" width="120" height="199" fill="#40a070" rx="4"/>
  <text x="330" y="145" text-anchor="middle" fill="#a6e3a1" font-size="11" font-weight="700">28</text>
  <text x="330" y="378" text-anchor="middle" fill="#a6e3a1" font-size="10">Workflow</text>
  <text x="330" y="390" text-anchor="middle" fill="#6c7086" font-size="9">agentBeh/autoApprove/</text>
  <text x="330" y="401" text-anchor="middle" fill="#6c7086" font-size="9">autocomplete/commit/</text>
  <text x="330" y="412" text-anchor="middle" fill="#6c7086" font-size="9">checkpoints/memory</text>

  <!-- Bar: Integrations — 38 new features, height=38*7.1=269.8 -->
  <rect x="440" y="80" width="120" height="270" fill="#f38ba8" rx="4"/>
  <text x="500" y="74" text-anchor="middle" fill="#f38ba8" font-size="11" font-weight="700">38</text>
  <text x="500" y="378" text-anchor="middle" fill="#f38ba8" font-size="10">Integrations</text>
  <text x="500" y="390" text-anchor="middle" fill="#6c7086" font-size="9">browser/ssh/vps/</text>
  <text x="500" y="401" text-anchor="middle" fill="#6c7086" font-size="9">hermes/zeroclaw/hub/</text>
  <text x="500" y="412" text-anchor="middle" fill="#6c7086" font-size="9">notifications/speech</text>

  <!-- Bar: System — 10 new features, height=10*7.1=71 -->
  <rect x="610" y="279" width="120" height="71" fill="#cba6f7" rx="4"/>
  <text x="670" y="273" text-anchor="middle" fill="#cba6f7" font-size="11" font-weight="700">10</text>
  <text x="670" y="378" text-anchor="middle" fill="#cba6f7" font-size="10">System</text>
  <text x="670" y="390" text-anchor="middle" fill="#6c7086" font-size="9">context/display/</text>
  <text x="670" y="401" text-anchor="middle" fill="#6c7086" font-size="9">governance/language/</text>
  <text x="670" y="412" text-anchor="middle" fill="#6c7086" font-size="9">experimental/about</text>
</svg>
```

---

## Top 10 Most Enhanced Tabs in canary.9

Ranked by total new feature cells across all 8 categories:

| Rank | Tab | Group | Status | New Feature Count | Key Highlights |
|------|-----|-------|--------|-------------------|----------------|
| 1 | **hermes** | Integrations | NEW | 8 | ping, health, queue, task tracker, channel/msg trace, key store, agent-assist, toggle |
| 2 | **zeroclaw** | Integrations | NEW | 8 | sandbox, circuit breaker, risk auto-detect, task queue, approval records, templates, analytics, policies |
| 3 | **vps** | Integrations | NEW | 7 | deploy/test, live metrics, docker detect, multi-server bulk, deploy log, sparklines, rollback |
| 4 | **governance** | System | NEW | 7 | simulate, approval queue preview, danger-action detect, bulk verdicts, audit export, log analytics, tiers |
| 5 | **routing** | AI Models | NEW | 7 | route trace, latency sparkline, Ctrl+K, circuit-breaker detect, fallback chain, config export, analytics |
| 6 | **training** | AI Models | NEW | 6 | job test, progress preview, GPU detect, batch ops, HF import, epoch analytics |
| 7 | **ssh** | Integrations | NEW | 5 | connection test, live status, key auto-detect, profile bulk, import |
| 8 | **memory** | Workflow | NEW | 6 | recall test, health preview, scope detect, prune bulk, token analytics, connection health |
| 9 | **speech** | Integrations | NEW | 4 | TTS test, voice preview, provider detect, accessibility/voice |
| 10 | **workflows** | Workflow (sub-tab) | NEW | 5 | dry-run, trace preview, bulk ops, import, run analytics |

---

## Feature Coverage Table — All 35 Surfaces

| Tab | Group | Wave 1 Features | Wave 2 Second-pass Features | Total New |
|-----|-------|----------------|----------------------------|-----------|
| models | AI Models | 3 (multi-agent selectors, `small_model` sentinel, `persistVariant`) | 2 (bulk multi-select, usage analytics) | 5 |
| providers | AI Models | 3 (custom provider dialog, model card, connect/select dialogs) | 1 (auto-discover) | 4 |
| routing | AI Models | 4 (circuit breaker display, role routing, fallback chain, route-trace log) | 3 (sparkline latencies, config export, live latency) | **7** |
| training | AI Models | 3 (HuggingFace token, VS Code secret store, GPU job submit) | 3 (job test, batch submit, epoch analytics) | **6** |
| agentBehaviour | Workflow | 3 (presets sub-tab, workflows sub-tab, `claudeCodeCompat` toggle) | 2 (rule test, bulk export) | 5 |
| agents (sub) | Workflow | 2 (agent CRUD, test invoke) | 1 (bulk export) | 3 |
| mcpServers (sub) | Workflow | 2 (ping test, live connect) | 2 (bulk ops, export) | 4 |
| rules (sub) | Workflow | 2 (rule test, pattern match) | 1 (bulk export) | 3 |
| workflows (sub) | Workflow | 3 (dry-run, trace, import) | 2 (bulk ops, run analytics) | **5** |
| skills (sub) | Workflow | 2 (invoke test, bulk ops) | 1 (export) | 3 |
| presets (sub) | Workflow | 3 (apply preset, bulk, import) | 0 | 3 |
| autoApprove | Workflow | 3 (pattern-level overrides, `PermissionRule`, null sentinel) | 2 (simulate, bulk export) | 5 |
| autocomplete | Workflow | 2 (smart inline-task keybind, chat autocomplete toggle) | 1 (live demo) | 3 |
| commitMessage | Workflow | 1 (custom prompt editor) | 2 (live preview, export) | **3** |
| checkpoints | Workflow | 1 (snapshot on/off toggle) | 0 | 1 |
| memory | Workflow | 4 (scope filter, recall query, token graph, connection health) | 2 (recall test, prune bulk) | **6** |
| browser | Integrations | 2 (`useSystemChrome`, `headless` option) | 1 (auto-detect chrome) | 3 |
| ssh | Integrations | 2 (SSH profile management, profile CRUD) | 3 (connect test, live status, key detect, profiles bulk, import) | **5** |
| vps | Integrations | 5 (server inventory, live metrics, docker list, deploy log, sparkline) | 2 (deploy test, multi-server bulk) | **7** |
| hermes | Integrations | 6 (toggle, bridge URL, health ping, API key, agent-assist, task tracker) | 2 (channel inspector, message trace) | **8** |
| zeroclaw | Integrations | 5 (sandbox config, risk selectors, task queue, approval records, templates) | 3 (circuit breaker, analytics, network/write policies) | **8** |
| hub | Integrations | 2 (Hub tab, server ping) | 1 (ops log) | 3 |
| notifications | Integrations | 3 (sound per event, agent/perms/error toggles) | 1 (test sound) | 4 |
| speech | Integrations | 4 (5 TTS providers, per-provider API keys, VS Code secrets) | 0 | 4 |
| context | System | 2 (compaction auto/prune toggles, watcher ignore-paths) | 1 (prune bulk) | 3 |
| display | System | 2 (`showTaskTimeline`, density options) | 1 (live theme preview) | 3 |
| governance | System | 5 (authority tiers, approval queue, danger registry, audit log, release verdict) | 2 (simulate, bulk verdicts) | **7** |
| language | System | 1 (locale selection) | 0 | 1 |
| experimental | System | 4 (`codebase_search`, `openTelemetry`, `remote_control`, per-tool map) | 1 (live flag preview) | 5 |
| aboutKiloCode | System | 1 (version/connection display) | 0 | 1 |
| **TOTAL** | — | **97** | **40** | **137** |

---

## Integration Points SVG — Tab ↔ Extension-Host Subsystem Map

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1060 720" font-family="ui-monospace,'Cascadia Code',Consolas,monospace" font-size="10">
  <rect width="1060" height="720" fill="#1e1e2e" rx="8"/>

  <!-- Title -->
  <text x="530" y="22" text-anchor="middle" fill="#cdd6f4" font-size="14" font-weight="700">KiloCode canary.9 — Settings Tab ↔ Subsystem Integration Map</text>

  <!-- ══════ LEFT: SETTINGS TABS COLUMN ══════ -->
  <text x="130" y="46" text-anchor="middle" fill="#6c7086" font-size="9" font-weight="700" letter-spacing="1">SETTINGS TABS</text>

  <!-- AI Models tabs -->
  <rect x="10"  y="54"  width="238" height="18" fill="#4a9eff" rx="3"/>
  <text x="129" y="67"  text-anchor="middle" fill="white" font-size="9">models / providers / routing / training</text>

  <!-- Workflow tabs -->
  <rect x="10"  y="80"  width="238" height="18" fill="#40a070" rx="3"/>
  <text x="129" y="93"  text-anchor="middle" fill="white" font-size="9">agentBehaviour (+ 6 sub-tabs)</text>

  <rect x="10"  y="104" width="238" height="18" fill="#40a070" rx="3"/>
  <text x="129" y="117" text-anchor="middle" fill="white" font-size="9">autoApprove / autocomplete / commitMsg</text>

  <rect x="10"  y="128" width="238" height="18" fill="#40a070" rx="3"/>
  <text x="129" y="141" text-anchor="middle" fill="white" font-size="9">checkpoints / memory</text>

  <!-- Integration tabs -->
  <rect x="10"  y="154" width="238" height="18" fill="#c07030" rx="3"/>
  <text x="129" y="167" text-anchor="middle" fill="white" font-size="9">browser</text>

  <rect x="10"  y="178" width="238" height="18" fill="#c07030" rx="3"/>
  <text x="129" y="191" text-anchor="middle" fill="white" font-size="9">ssh</text>

  <rect x="10"  y="202" width="238" height="18" fill="#c07030" rx="3"/>
  <text x="129" y="215" text-anchor="middle" fill="white" font-size="9">vps</text>

  <rect x="10"  y="226" width="238" height="18" fill="#c07030" rx="3"/>
  <text x="129" y="239" text-anchor="middle" fill="white" font-size="9">hermes</text>

  <rect x="10"  y="250" width="238" height="18" fill="#c07030" rx="3"/>
  <text x="129" y="263" text-anchor="middle" fill="white" font-size="9">zeroclaw</text>

  <rect x="10"  y="274" width="238" height="18" fill="#c07030" rx="3"/>
  <text x="129" y="287" text-anchor="middle" fill="white" font-size="9">hub</text>

  <rect x="10"  y="298" width="238" height="18" fill="#c07030" rx="3"/>
  <text x="129" y="311" text-anchor="middle" fill="white" font-size="9">notifications / speech</text>

  <!-- System tabs -->
  <rect x="10"  y="324" width="238" height="18" fill="#8060c0" rx="3"/>
  <text x="129" y="337" text-anchor="middle" fill="white" font-size="9">context / display / language / experimental</text>

  <rect x="10"  y="348" width="238" height="18" fill="#8060c0" rx="3"/>
  <text x="129" y="361" text-anchor="middle" fill="white" font-size="9">governance</text>

  <rect x="10"  y="372" width="238" height="18" fill="#585b70" rx="3"/>
  <text x="129" y="385" text-anchor="middle" fill="white" font-size="9">aboutKiloCode</text>

  <!-- ══════ MIDDLE: KILOPROVIDER HUB ══════ -->
  <text x="490" y="46" text-anchor="middle" fill="#6c7086" font-size="9" font-weight="700" letter-spacing="1">EXTENSION HOST — KiloProvider.ts</text>

  <rect x="370" y="54" width="240" height="348" fill="#181825" rx="6" stroke="#45475a" stroke-width="1"/>

  <!-- IPC layer -->
  <rect x="380" y="64"  width="220" height="28" fill="#313244" rx="4" stroke="#89b4fa" stroke-width="1"/>
  <text x="490" y="76"  text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">postMessage / IPC boundary</text>
  <text x="490" y="87"  text-anchor="middle" fill="#6c7086" font-size="8">Webview ↔ Extension Host</text>

  <!-- handleUpdateConfig -->
  <rect x="380" y="102" width="220" height="28" fill="#313244" rx="4" stroke="#4a9eff" stroke-width="1"/>
  <text x="490" y="114" text-anchor="middle" fill="#4a9eff" font-size="9" font-weight="700">handleUpdateConfig()</text>
  <text x="490" y="125" text-anchor="middle" fill="#6c7086" font-size="8">Config draft → kilo.json via tRPC</text>

  <!-- handleUpdateSetting -->
  <rect x="380" y="140" width="220" height="28" fill="#313244" rx="4" stroke="#fab387" stroke-width="1"/>
  <text x="490" y="152" text-anchor="middle" fill="#fab387" font-size="9" font-weight="700">handleUpdateSetting()</text>
  <text x="490" y="163" text-anchor="middle" fill="#6c7086" font-size="8">workspace.getConfiguration().update()</text>

  <!-- globalState -->
  <rect x="380" y="178" width="220" height="28" fill="#313244" rx="4" stroke="#a6e3a1" stroke-width="1"/>
  <text x="490" y="190" text-anchor="middle" fill="#a6e3a1" font-size="9" font-weight="700">globalState / SecretStorage</text>
  <text x="490" y="201" text-anchor="middle" fill="#6c7086" font-size="8">variants, recents, favorites, API keys</text>

  <!-- V4 dispatch -->
  <rect x="380" y="216" width="220" height="28" fill="#313244" rx="4" stroke="#cba6f7" stroke-width="1"/>
  <text x="490" y="228" text-anchor="middle" fill="#cba6f7" font-size="9" font-weight="700">__daveExtensions.handleV4Message()</text>
  <text x="490" y="239" text-anchor="middle" fill="#6c7086" font-size="8">v4SubsystemRequest routing</text>

  <!-- VS Code API -->
  <rect x="380" y="254" width="220" height="28" fill="#313244" rx="4" stroke="#f38ba8" stroke-width="1"/>
  <text x="490" y="266" text-anchor="middle" fill="#f38ba8" font-size="9" font-weight="700">VS Code API</text>
  <text x="490" y="277" text-anchor="middle" fill="#6c7086" font-size="8">workspace.getConfig / env.openExternal</text>

  <!-- secret store -->
  <rect x="380" y="292" width="220" height="28" fill="#313244" rx="4" stroke="#fab387" stroke-width="1"/>
  <text x="490" y="304" text-anchor="middle" fill="#fab387" font-size="9" font-weight="700">SecretStorage</text>
  <text x="490" y="315" text-anchor="middle" fill="#6c7086" font-size="8">Hermes/Speech/Training API keys</text>

  <!-- configUpdated feedback -->
  <rect x="380" y="330" width="220" height="28" fill="#313244" rx="4" stroke="#89b4fa" stroke-width="1"/>
  <text x="490" y="342" text-anchor="middle" fill="#89b4fa" font-size="9" font-weight="700">configUpdated postMessage</text>
  <text x="490" y="353" text-anchor="middle" fill="#6c7086" font-size="8">merged Config → webview ConfigContext</text>

  <rect x="380" y="368" width="220" height="28" fill="#313244" rx="4" stroke="#45475a" stroke-width="1"/>
  <text x="490" y="380" text-anchor="middle" fill="#9399b2" font-size="9" font-weight="700">settingsTabChanged / openExtUrl</text>
  <text x="490" y="391" text-anchor="middle" fill="#6c7086" font-size="8">navigation + browser launch</text>

  <!-- ══════ RIGHT: SUBSYSTEMS COLUMN ══════ -->
  <text x="840" y="46" text-anchor="middle" fill="#6c7086" font-size="9" font-weight="700" letter-spacing="1">EXTENSION-HOST SUBSYSTEMS</text>

  <!-- CLI Backend -->
  <rect x="660" y="54"  width="380" height="42" fill="#313244" rx="4" stroke="#4a9eff" stroke-width="1.5"/>
  <text x="850" y="70"  text-anchor="middle" fill="#4a9eff" font-size="10" font-weight="700">CLI Backend (config.ts)</text>
  <text x="850" y="85"  text-anchor="middle" fill="#6c7086" font-size="9">Config.updateGlobal()  ·  patchJsonc()  ·  kilo.json on disk</text>

  <!-- VS Code Workspace Config -->
  <rect x="660" y="106" width="380" height="42" fill="#313244" rx="4" stroke="#fab387" stroke-width="1.5"/>
  <text x="850" y="122" text-anchor="middle" fill="#fab387" font-size="10" font-weight="700">VS Code Workspace Configuration</text>
  <text x="850" y="137" text-anchor="middle" fill="#6c7086" font-size="9">kilo-code.new.* keys  ·  ConfigurationTarget.Global</text>

  <!-- VS Code globalState -->
  <rect x="660" y="158" width="380" height="42" fill="#313244" rx="4" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="850" y="174" text-anchor="middle" fill="#a6e3a1" font-size="10" font-weight="700">VS Code globalState</text>
  <text x="850" y="189" text-anchor="middle" fill="#6c7086" font-size="9">models.recents  ·  models.variants  ·  favoriteModels</text>

  <!-- V4 RoutingService -->
  <rect x="660" y="210" width="380" height="42" fill="#313244" rx="4" stroke="#cba6f7" stroke-width="1.5"/>
  <text x="850" y="226" text-anchor="middle" fill="#cba6f7" font-size="10" font-weight="700">V4 RoutingService</text>
  <text x="850" y="241" text-anchor="middle" fill="#6c7086" font-size="9">circuit breaker state  ·  recentLatencies[]  ·  fallback chain</text>

  <!-- V4 MemoryService -->
  <rect x="660" y="262" width="380" height="42" fill="#313244" rx="4" stroke="#cba6f7" stroke-width="1.5"/>
  <text x="850" y="278" text-anchor="middle" fill="#cba6f7" font-size="10" font-weight="700">V4 MemoryService (Shiba)</text>
  <text x="850" y="293" text-anchor="middle" fill="#6c7086" font-size="9">MemoryEntry  ·  RecallResult  ·  token graph  ·  scope filter</text>

  <!-- V4 SSHService -->
  <rect x="660" y="314" width="380" height="42" fill="#313244" rx="4" stroke="#c07030" stroke-width="1.5"/>
  <text x="850" y="330" text-anchor="middle" fill="#fab387" font-size="10" font-weight="700">V4 SSHService</text>
  <text x="850" y="345" text-anchor="middle" fill="#6c7086" font-size="9">SSH profiles  ·  key detection  ·  connection test</text>

  <!-- V4 VPSService -->
  <rect x="660" y="366" width="380" height="42" fill="#313244" rx="4" stroke="#c07030" stroke-width="1.5"/>
  <text x="850" y="382" text-anchor="middle" fill="#fab387" font-size="10" font-weight="700">V4 VPSService</text>
  <text x="850" y="397" text-anchor="middle" fill="#6c7086" font-size="9">VPSServer  ·  VPSMetrics  ·  DockerContainer  ·  DeployEntry</text>

  <!-- V4 HermesStatusService -->
  <rect x="660" y="418" width="380" height="42" fill="#313244" rx="4" stroke="#c07030" stroke-width="1.5"/>
  <text x="850" y="434" text-anchor="middle" fill="#fab387" font-size="10" font-weight="700">V4 HermesStatusService / HermesClient</text>
  <text x="850" y="449" text-anchor="middle" fill="#6c7086" font-size="9">HermesStatus  ·  AgentTask  ·  ChannelInfo  ·  MessageTraceEntry</text>

  <!-- V4 ZeroClawService -->
  <rect x="660" y="470" width="380" height="42" fill="#313244" rx="4" stroke="#c07030" stroke-width="1.5"/>
  <text x="850" y="486" text-anchor="middle" fill="#fab387" font-size="10" font-weight="700">V4 ZeroClawService</text>
  <text x="850" y="501" text-anchor="middle" fill="#6c7086" font-size="9">ZeroClawTask  ·  ApprovalRecord  ·  CircuitState  ·  TaskTemplate</text>

  <!-- V4 Hub service -->
  <rect x="660" y="522" width="380" height="42" fill="#313244" rx="4" stroke="#c07030" stroke-width="1.5"/>
  <text x="850" y="538" text-anchor="middle" fill="#fab387" font-size="10" font-weight="700">V4 Hub Service</text>
  <text x="850" y="553" text-anchor="middle" fill="#6c7086" font-size="9">hub server ↔ Hub tab  ·  ops log  ·  connection status</text>

  <!-- V4 GovernanceService -->
  <rect x="660" y="574" width="380" height="42" fill="#313244" rx="4" stroke="#8060c0" stroke-width="1.5"/>
  <text x="850" y="590" text-anchor="middle" fill="#cba6f7" font-size="10" font-weight="700">V4 GovernanceService</text>
  <text x="850" y="605" text-anchor="middle" fill="#6c7086" font-size="9">AuthorityTier  ·  ApprovalRecord  ·  DangerousAction  ·  AuditEntry</text>

  <!-- VS Code SecretStorage -->
  <rect x="660" y="626" width="380" height="42" fill="#313244" rx="4" stroke="#fab387" stroke-width="1.5"/>
  <text x="850" y="642" text-anchor="middle" fill="#fab387" font-size="10" font-weight="700">VS Code SecretStorage</text>
  <text x="850" y="657" text-anchor="middle" fill="#6c7086" font-size="9">hermes API key  ·  speech API keys  ·  kilo-training-huggingface</text>

  <!-- ══════ ARROWS: tabs → KiloProvider ══════ -->
  <!-- All tabs → postMessage/IPC -->
  <line x1="248" y1="63"  x2="370" y2="78"  stroke="#89b4fa" stroke-width="1.5" stroke-dasharray="5 2" marker-end="url(#arrowB)"/>
  <line x1="248" y1="89"  x2="370" y2="80"  stroke="#40a070" stroke-width="1" stroke-dasharray="4 2" marker-end="url(#arrowG)"/>
  <line x1="248" y1="113" x2="370" y2="83"  stroke="#40a070" stroke-width="1" stroke-dasharray="4 2" marker-end="url(#arrowG)"/>
  <line x1="248" y1="137" x2="370" y2="85"  stroke="#40a070" stroke-width="1" stroke-dasharray="4 2" marker-end="url(#arrowG)"/>
  <line x1="248" y1="163" x2="370" y2="87"  stroke="#c07030" stroke-width="1" stroke-dasharray="4 2" marker-end="url(#arrowO)"/>
  <line x1="248" y1="187" x2="370" y2="90"  stroke="#c07030" stroke-width="1.5" stroke-dasharray="5 2" marker-end="url(#arrowO)"/>
  <line x1="248" y1="211" x2="370" y2="92"  stroke="#c07030" stroke-width="1.5" stroke-dasharray="5 2" marker-end="url(#arrowO)"/>
  <line x1="248" y1="235" x2="370" y2="94"  stroke="#c07030" stroke-width="1.5" stroke-dasharray="5 2" marker-end="url(#arrowO)"/>
  <line x1="248" y1="259" x2="370" y2="96"  stroke="#c07030" stroke-width="1.5" stroke-dasharray="5 2" marker-end="url(#arrowO)"/>
  <line x1="248" y1="283" x2="370" y2="98"  stroke="#c07030" stroke-width="1.5" stroke-dasharray="5 2" marker-end="url(#arrowO)"/>
  <line x1="248" y1="307" x2="370" y2="100" stroke="#c07030" stroke-width="1" stroke-dasharray="4 2" marker-end="url(#arrowO)"/>
  <line x1="248" y1="333" x2="370" y2="105" stroke="#8060c0" stroke-width="1" stroke-dasharray="4 2" marker-end="url(#arrowP)"/>
  <line x1="248" y1="357" x2="370" y2="235" stroke="#8060c0" stroke-width="1.5" stroke-dasharray="5 2" marker-end="url(#arrowP)"/>
  <line x1="248" y1="381" x2="370" y2="380" stroke="#585b70" stroke-width="1" stroke-dasharray="4 2" marker-end="url(#arrowGr)"/>

  <!-- KiloProvider → Subsystems -->
  <line x1="610" y1="116" x2="660" y2="75"  stroke="#4a9eff" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <line x1="610" y1="154" x2="660" y2="127" stroke="#fab387" stroke-width="1.5" marker-end="url(#arrowO)"/>
  <line x1="610" y1="192" x2="660" y2="179" stroke="#a6e3a1" stroke-width="1.5" marker-end="url(#arrowG)"/>
  <line x1="610" y1="230" x2="660" y2="231" stroke="#cba6f7" stroke-width="1.5" marker-end="url(#arrowP)"/>
  <line x1="610" y1="230" x2="660" y2="283" stroke="#cba6f7" stroke-width="1"   marker-end="url(#arrowP)"/>
  <line x1="610" y1="230" x2="660" y2="335" stroke="#fab387" stroke-width="1"   marker-end="url(#arrowO)"/>
  <line x1="610" y1="230" x2="660" y2="387" stroke="#fab387" stroke-width="1"   marker-end="url(#arrowO)"/>
  <line x1="610" y1="230" x2="660" y2="439" stroke="#fab387" stroke-width="1"   marker-end="url(#arrowO)"/>
  <line x1="610" y1="230" x2="660" y2="491" stroke="#fab387" stroke-width="1"   marker-end="url(#arrowO)"/>
  <line x1="610" y1="230" x2="660" y2="543" stroke="#fab387" stroke-width="1"   marker-end="url(#arrowO)"/>
  <line x1="610" y1="230" x2="660" y2="595" stroke="#cba6f7" stroke-width="1"   marker-end="url(#arrowP)"/>
  <line x1="610" y1="306" x2="660" y2="647" stroke="#fab387" stroke-width="1.5" marker-end="url(#arrowO)"/>

  <!-- defs -->
  <defs>
    <marker id="arrowB"  markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#89b4fa"/></marker>
    <marker id="arrowG"  markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#a6e3a1"/></marker>
    <marker id="arrowO"  markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#fab387"/></marker>
    <marker id="arrowP"  markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#cba6f7"/></marker>
    <marker id="arrowGr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#585b70"/></marker>
  </defs>
</svg>
```

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total settings surfaces (top-level tabs + sub-tabs) | 35 |
| Wholly new tabs in canary.9 | 11 |
| Enhanced (existing) tabs in canary.9 | 16 |
| Unchanged tabs in canary.9 | 8 |
| Total new features (Wave 1 + Wave 2) | 137 |
| Feature categories tracked | 8 |
| Tab groups | 4 (AI Models, Workflow, Integrations, System) |
| Storage backends | 3 (kilo.json, VS Code config, V4 Services) |
| New WebviewMessage / ExtensionMessage types | 16 |
| V4 subsystems integrated | 8 (routing, memory, ssh, vps, hermes, zeroclaw, hub, governance) |

---

*Document auto-generated for KiloCode canary.9 — 2026-04-27*
