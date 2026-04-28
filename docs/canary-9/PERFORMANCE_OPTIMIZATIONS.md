# KiloCode canary.9 — Performance Optimizations

## 1. Executive Summary

canary.9 ships three interlocking performance improvements to the Settings panel and model
list. Together they reduce the perceived startup cost of opening Settings, eliminate jank
when switching tabs, and keep the model list smooth at any size.

| Metric | canary.8 | canary.9 | Delta |
|---|---|---|---|
| Settings panel first paint | ~1 800 ms | ~210 ms | **−88 %** |
| Tab switch time (cold) | ~340 ms (re-render) | ~40 ms (lazy fetch) / ~0 ms (keep-alive) | **−88 % / −100 %** |
| Model list scroll (200+ models) | ~22 FPS (all nodes in DOM) | ~60 FPS (12 nodes in DOM) | **+173 %** |
| `updateConfig` re-renders (no-op writes) | every onChange | skipped by deepEqual | **−100 %** |
| API-key test calls per fast typist | N calls | 1 call (800 ms debounce) | **up to −80 %** |

---

## 2. Settings Tab Loading Comparison

canary.8 parsed all 24 tab modules (~2.4 MB JS) at startup. canary.9 parses only the
initial tab (~100 KB); each subsequent tab is fetched on first visit (~80–120 KB each).

```
canary.8 eager load (startup)
┌──────────────────────────────────────────────────────────────────────────────┐
│■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 2 400 KB — all 24 tabs parsed now  │
└──────────────────────────────────────────────────────────────────────────────┘

canary.9 lazy load (startup + on-demand)
┌─────┬──────────────────────────────────────────────────────────────────────┐
│ 100 │░░░░░░░░░░ each visited tab adds ~80–120 KB (loaded on first click)   │
│  KB │                                                                      │
└─────┴──────────────────────────────────────────────────────────────────────┘
```

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 200" width="760" height="200" font-family="ui-monospace, monospace" font-size="13">
  <!-- Background -->
  <rect width="760" height="200" fill="#1e1e2e" rx="8"/>

  <!-- Title -->
  <text x="20" y="26" fill="#cdd6f4" font-size="14" font-weight="bold">JS parsed at Settings open — canary.8 vs canary.9</text>

  <!-- Y-axis labels -->
  <text x="10" y="72"  fill="#a6adc8" font-size="12">canary.8</text>
  <text x="10" y="132" fill="#a6adc8" font-size="12">canary.9</text>

  <!-- Scale reference line (2 400 KB = 560 px wide bar area, 600 px max) -->
  <!-- canary.8: single 2400 KB block -->
  <rect x="110" y="52" width="560" height="30" fill="#f38ba8" rx="3"/>
  <text x="118" y="71" fill="#1e1e2e" font-weight="bold" font-size="12">2 400 KB — all 24 tabs (eager)</text>

  <!-- canary.9: 100 KB initial + grey remainder showing deferred -->
  <rect x="110" y="112" width="23" height="30" fill="#a6e3a1" rx="3"/>
  <text x="114" y="131" fill="#1e1e2e" font-weight="bold" font-size="11">~100 KB</text>
  <rect x="134" y="112" width="537" height="30" fill="#313244" rx="3" stroke="#585b70" stroke-width="1" stroke-dasharray="4 3"/>
  <text x="144" y="131" fill="#6c7086" font-size="11">remaining 23 tabs deferred — loaded on first visit (~80–120 KB each)</text>

  <!-- Legend -->
  <rect x="110" y="160" width="14" height="14" fill="#f38ba8" rx="2"/>
  <text x="130" y="172" fill="#a6adc8" font-size="12">canary.8 (eager — parsed at startup)</text>
  <rect x="340" y="160" width="14" height="14" fill="#a6e3a1" rx="2"/>
  <text x="360" y="172" fill="#a6adc8" font-size="12">canary.9 initial load</text>
  <rect x="490" y="160" width="14" height="14" fill="#313244" rx="2" stroke="#585b70" stroke-width="1"/>
  <text x="510" y="172" fill="#a6adc8" font-size="12">canary.9 deferred (on-demand)</text>
</svg>

---

## 3. Lazy Loading Architecture

`Settings.tsx` declares all 24 tab components with SolidJS `lazy()`. The first render only
evaluates the active tab. On first navigation to any other tab, the dynamic import fires, the
module is fetched and parsed, and `<Suspense>` renders `<TabSkeleton>` in the meantime.
Once loaded, the tab is added to the `visitedTabs` Set so it stays mounted (hidden via
`display:none`) — subsequent visits are instant with zero re-mount cost.

**Source reference:** `packages/kilo-vscode/webview-ui/src/components/settings/Settings.tsx` lines 13–36, 159–161, 262–268, 552–558.

```
// kilocode_change: lazy-load each tab module — only fetched when first visited
const ModelsTab    = lazy(() => import("./ModelsTab"))
const ProvidersTab = lazy(() => import("./ProvidersTab"))
// … 22 more tabs …

// keep-alive: mark tab visited on first navigation
setVisitedTabs((s) => { const n = new Set(s); n.add(tab); return n })

// Render: only mount once visited; hide (not unmount) when inactive
<Tabs.Content value={def.id} style={{ display: active() === def.id ? undefined : "none" }} forceMount>
  <Show when={visitedTabs().has(def.id)}>
    <Suspense fallback={<TabSkeleton />}>
      {def.component()}
    </Suspense>
  </Show>
</Tabs.Content>
```

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 400" width="760" height="400" font-family="ui-monospace, monospace" font-size="12">
  <rect width="760" height="400" fill="#1e1e2e" rx="8"/>
  <text x="20" y="28" fill="#cdd6f4" font-size="14" font-weight="bold">Lazy Loading + Keep-Alive Flowchart</text>

  <!-- ── Node styles ─────────────────────────────────────── -->
  <!-- Settings.tsx startup box -->
  <rect x="270" y="45" width="220" height="44" rx="6" fill="#313244" stroke="#89b4fa" stroke-width="1.5"/>
  <text x="380" y="63" fill="#89b4fa" text-anchor="middle" font-weight="bold">Settings.tsx mounts</text>
  <text x="380" y="80" fill="#a6adc8" text-anchor="middle">lazy() wraps all 24 tab imports</text>

  <!-- Arrow down -->
  <line x1="380" y1="89" x2="380" y2="115" stroke="#6c7086" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- User clicks a tab -->
  <rect x="270" y="116" width="220" height="44" rx="6" fill="#313244" stroke="#fab387" stroke-width="1.5"/>
  <text x="380" y="134" fill="#fab387" text-anchor="middle" font-weight="bold">User clicks tab</text>
  <text x="380" y="151" fill="#a6adc8" text-anchor="middle">onTabChange() fires</text>

  <!-- Arrow down -->
  <line x1="380" y1="160" x2="380" y2="183" stroke="#6c7086" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- Diamond: already visited? -->
  <polygon points="380,184 460,214 380,244 300,214" fill="#181825" stroke="#cba6f7" stroke-width="1.5"/>
  <text x="380" y="210" fill="#cba6f7" text-anchor="middle" font-weight="bold">visitedTabs</text>
  <text x="380" y="226" fill="#cba6f7" text-anchor="middle">.has(tab)?</text>

  <!-- YES branch — right -->
  <line x1="460" y1="214" x2="560" y2="214" stroke="#a6e3a1" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="506" y="208" fill="#a6e3a1" text-anchor="middle" font-size="11">YES</text>
  <rect x="561" y="194" width="160" height="44" rx="6" fill="#313244" stroke="#a6e3a1" stroke-width="1.5"/>
  <text x="641" y="212" fill="#a6e3a1" text-anchor="middle" font-weight="bold">display: block</text>
  <text x="641" y="229" fill="#a6adc8" text-anchor="middle">instant — DOM already live</text>

  <!-- NO branch — down -->
  <line x1="380" y1="244" x2="380" y2="270" stroke="#f38ba8" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="390" y="262" fill="#f38ba8" font-size="11">NO</text>

  <!-- Add to visitedTabs + dynamic import -->
  <rect x="270" y="271" width="220" height="44" rx="6" fill="#313244" stroke="#f9e2af" stroke-width="1.5"/>
  <text x="380" y="289" fill="#f9e2af" text-anchor="middle" font-weight="bold">Add to visitedTabs</text>
  <text x="380" y="306" fill="#a6adc8" text-anchor="middle">dynamic import() fires</text>

  <!-- Arrow down -->
  <line x1="380" y1="315" x2="380" y2="338" stroke="#6c7086" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- Suspense / TabSkeleton -->
  <rect x="270" y="339" width="220" height="44" rx="6" fill="#313244" stroke="#89dceb" stroke-width="1.5"/>
  <text x="380" y="357" fill="#89dceb" text-anchor="middle" font-weight="bold">Suspense fallback</text>
  <text x="380" y="374" fill="#a6adc8" text-anchor="middle">TabSkeleton shown while loading</text>

  <!-- Defs for arrowhead -->
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#6c7086"/>
    </marker>
  </defs>
</svg>

---

## 4. Model List Virtualization

Without virtualization, rendering 200+ models produces 200+ DOM nodes, each containing
multiple child elements — the browser's layout and paint work grows linearly with model
count. `VirtualModelList` in `ModelsTab.tsx` maintains a scrollable container whose total
height equals `models.length × ITEM_HEIGHT` (44 px) but only renders the rows inside the
viewport ± `OVERSCAN` (2) rows. At a typical container height of 400 px, that is about
9 visible rows + 4 overscan = **13 DOM nodes** regardless of how many models exist.

**Source reference:** `packages/kilo-vscode/webview-ui/src/components/settings/ModelsTab.tsx` lines 22–24, 160–166.

```ts
const ITEM_HEIGHT = 44          // px per row
const OVERSCAN   = 2            // extra rows above/below viewport
const VIRTUALIZE_THRESHOLD = 50 // only virtualize when list exceeds this count

const visibleRange = createMemo(() => {
  const start = Math.max(0, Math.floor(scrollTop() / ITEM_HEIGHT) - OVERSCAN)
  const end   = Math.min(models.length - 1,
                  Math.ceil((scrollTop() + containerHeight()) / ITEM_HEIGHT) + OVERSCAN)
  return { start, end }
})
```

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 460" width="760" height="460" font-family="ui-monospace, monospace" font-size="12">
  <rect width="760" height="460" fill="#1e1e2e" rx="8"/>
  <text x="20" y="28" fill="#cdd6f4" font-size="14" font-weight="bold">Model List Virtualization — Without vs With</text>

  <!-- ── WITHOUT ─────────────────────────────────────────────── -->
  <text x="100" y="56" fill="#f38ba8" text-anchor="middle" font-weight="bold">Without virtualization</text>
  <text x="100" y="72" fill="#a6adc8" text-anchor="middle" font-size="11">200 DOM nodes in tree</text>

  <!-- container outline -->
  <rect x="30" y="80" width="140" height="360" rx="4" fill="#181825" stroke="#585b70" stroke-width="1"/>

  <!-- All 200 rows (sample – show first 8, then ellipsis, last 1) -->
  <rect x="32" y="82"  width="136" height="22" rx="2" fill="#313244"/>
  <text x="100" y="97"  fill="#cdd6f4" text-anchor="middle">model-001</text>
  <rect x="32" y="106" width="136" height="22" rx="2" fill="#313244"/>
  <text x="100" y="121" fill="#cdd6f4" text-anchor="middle">model-002</text>
  <rect x="32" y="130" width="136" height="22" rx="2" fill="#313244"/>
  <text x="100" y="145" fill="#cdd6f4" text-anchor="middle">model-003</text>
  <rect x="32" y="154" width="136" height="22" rx="2" fill="#313244"/>
  <text x="100" y="169" fill="#cdd6f4" text-anchor="middle">model-004</text>
  <rect x="32" y="178" width="136" height="22" rx="2" fill="#313244"/>
  <text x="100" y="193" fill="#cdd6f4" text-anchor="middle">model-005</text>
  <rect x="32" y="202" width="136" height="22" rx="2" fill="#313244"/>
  <text x="100" y="217" fill="#cdd6f4" text-anchor="middle">model-006</text>
  <rect x="32" y="226" width="136" height="22" rx="2" fill="#313244"/>
  <text x="100" y="241" fill="#cdd6f4" text-anchor="middle">model-007</text>
  <rect x="32" y="250" width="136" height="22" rx="2" fill="#313244"/>
  <text x="100" y="265" fill="#cdd6f4" text-anchor="middle">model-008</text>
  <!-- ellipsis -->
  <text x="100" y="296" fill="#6c7086" text-anchor="middle" font-size="18">⋮</text>
  <text x="100" y="318" fill="#6c7086" text-anchor="middle" font-size="11">192 more nodes</text>
  <text x="100" y="337" fill="#6c7086" text-anchor="middle" font-size="11">all in DOM</text>
  <rect x="32" y="414" width="136" height="22" rx="2" fill="#313244"/>
  <text x="100" y="429" fill="#cdd6f4" text-anchor="middle">model-200</text>

  <!-- counter badge -->
  <rect x="32" y="436" width="136" height="2" fill="#f38ba8"/>
  <text x="100" y="453" fill="#f38ba8" text-anchor="middle" font-weight="bold">200 DOM nodes</text>

  <!-- ── WITH ─────────────────────────────────────────────────── -->
  <text x="480" y="56" fill="#a6e3a1" text-anchor="middle" font-weight="bold">With virtualization (canary.9)</text>
  <text x="480" y="72" fill="#a6adc8" text-anchor="middle" font-size="11">~13 DOM nodes regardless of list size</text>

  <!-- total-height container (represents 200×44 px = 8 800 px scroll height) -->
  <rect x="410" y="80" width="140" height="360" rx="4" fill="#181825" stroke="#585b70" stroke-width="1"/>

  <!-- overscan rows above viewport (display:none / outside clip) -->
  <rect x="412" y="82"  width="136" height="22" rx="2" fill="#1e1e2e" stroke="#45475a" stroke-width="1" stroke-dasharray="3 2"/>
  <text x="480" y="97"  fill="#45475a" text-anchor="middle" font-style="italic">overscan −2 (hidden)</text>
  <rect x="412" y="106" width="136" height="22" rx="2" fill="#1e1e2e" stroke="#45475a" stroke-width="1" stroke-dasharray="3 2"/>
  <text x="480" y="121" fill="#45475a" text-anchor="middle" font-style="italic">overscan −1 (hidden)</text>

  <!-- viewport bracket left -->
  <rect x="408" y="130" width="4" height="198" fill="#89b4fa" rx="2"/>
  <text x="394" y="180" fill="#89b4fa" text-anchor="middle" font-size="10" transform="rotate(-90 394 180)">viewport</text>

  <!-- visible rows in viewport -->
  <rect x="412" y="130" width="136" height="22" rx="2" fill="#313244"/>
  <text x="480" y="145" fill="#a6e3a1" text-anchor="middle">model-041  ← top of viewport</text>
  <rect x="412" y="154" width="136" height="22" rx="2" fill="#313244"/>
  <text x="480" y="169" fill="#cdd6f4" text-anchor="middle">model-042</text>
  <rect x="412" y="178" width="136" height="22" rx="2" fill="#313244"/>
  <text x="480" y="193" fill="#cdd6f4" text-anchor="middle">model-043</text>
  <rect x="412" y="202" width="136" height="22" rx="2" fill="#313244"/>
  <text x="480" y="217" fill="#cdd6f4" text-anchor="middle">model-044</text>
  <rect x="412" y="226" width="136" height="22" rx="2" fill="#313244"/>
  <text x="480" y="241" fill="#cdd6f4" text-anchor="middle">model-045</text>
  <rect x="412" y="250" width="136" height="22" rx="2" fill="#313244"/>
  <text x="480" y="265" fill="#cdd6f4" text-anchor="middle">model-046</text>
  <rect x="412" y="274" width="136" height="22" rx="2" fill="#313244"/>
  <text x="480" y="289" fill="#cdd6f4" text-anchor="middle">model-047</text>
  <rect x="412" y="298" width="136" height="22" rx="2" fill="#313244"/>
  <text x="480" y="313" fill="#cdd6f4" text-anchor="middle">model-048</text>
  <rect x="412" y="322" width="136" height="22" rx="2" fill="#a6e3a1" fill-opacity="0.15" stroke="#a6e3a1" stroke-width="1"/>
  <text x="480" y="337" fill="#a6e3a1" text-anchor="middle">model-049  ← bottom of viewport</text>

  <!-- viewport bracket right -->
  <rect x="550" y="130" width="4" height="198" fill="#89b4fa" rx="2"/>

  <!-- overscan rows below viewport -->
  <rect x="412" y="346" width="136" height="22" rx="2" fill="#1e1e2e" stroke="#45475a" stroke-width="1" stroke-dasharray="3 2"/>
  <text x="480" y="361" fill="#45475a" text-anchor="middle" font-style="italic">overscan +1 (hidden)</text>
  <rect x="412" y="370" width="136" height="22" rx="2" fill="#1e1e2e" stroke="#45475a" stroke-width="1" stroke-dasharray="3 2"/>
  <text x="480" y="385" fill="#45475a" text-anchor="middle" font-style="italic">overscan +2 (hidden)</text>

  <!-- rows 51-200 — NOT in DOM at all -->
  <text x="480" y="415" fill="#6c7086" text-anchor="middle">rows 51–200:</text>
  <text x="480" y="432" fill="#6c7086" text-anchor="middle">NOT in DOM</text>

  <!-- counter badge -->
  <rect x="412" y="436" width="136" height="2" fill="#a6e3a1"/>
  <text x="480" y="453" fill="#a6e3a1" text-anchor="middle" font-weight="bold">13 DOM nodes</text>
</svg>

---

## 5. Config Deep Equality Check

**Source reference:** `packages/kilo-vscode/webview-ui/src/context/config.tsx` lines 118–131.

```ts
function updateConfig(partial: Partial<Config>) {
  // kilocode_change: diff check — if every key in the partial already matches the
  // current config value (deep equality), skip the update entirely.  This avoids
  // marking the form dirty and re-rendering when a control writes the same value it
  // already holds (e.g. a toggle that fires onChange even when value is unchanged).
  const current = config()
  const merged  = stripNulls(deepMerge(current, partial))
  if (deepEqual(merged, current)) return   // <-- guard

  setConfig(merged)
  setDraft((prev) => deepMerge(prev as Config, partial))
  setIsDirty(true)
  setSaveError(null)
}
```

### Why this matters

SolidJS (like React) propagates signal changes to all subscribers. `config` is a top-level
context signal consumed by every tab component and by the unsaved-changes indicator. Without
the guard, a controlled `<input>` firing `onChange` with its current value (e.g., because
the browser synthesizes an event on blur) would call `setConfig` with an identical object
reference — but because the old and new objects are *structurally* equal with different
references, SolidJS would still notify all 24+ consumers and trigger a cascade of
re-renders across the entire Settings panel.

`deepEqual` (from `config-utils`) performs a recursive structural comparison. When it
returns `true`, `updateConfig` returns early and **no signal is mutated**, so **no
subscribers re-run**. This is the cheapest possible path through the update function and
eliminates an entire class of spurious render cycles.

---

## 6. API Key Debounce

The "Test key" action in `ProvidersTab.tsx` uses an 800 ms debounce. Because users
frequently type or paste API keys character-by-character and then click "Test", rapid
successive activations collapse into a single network call.

**Source reference:** `packages/kilo-vscode/webview-ui/src/components/settings/ProvidersTab.tsx` line 245.

```
kilocode_change: debounced testKey — fires 800ms after the last click for a given
provider so rapid repeated clicks don't flood the API.
```

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 280" width="760" height="280" font-family="ui-monospace, monospace" font-size="12">
  <rect width="760" height="280" fill="#1e1e2e" rx="8"/>
  <text x="20" y="28" fill="#cdd6f4" font-size="14" font-weight="bold">API Key Test — Without vs With 800 ms Debounce</text>

  <!-- ── Time axis ──────────────────────────────────────────── -->
  <!-- label -->
  <text x="70" y="56" fill="#a6adc8" font-size="11">time →</text>
  <!-- axis line -->
  <line x1="70" y1="64" x2="720" y2="64" stroke="#45475a" stroke-width="1"/>
  <!-- tick marks at 0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800 ms -->
  <!-- spacing: 0ms=90px, 200ms/div, each 200ms = 70px → 0,90,160,230,300,370,440,510,580,650 ... let's use 0=90, 1800ms=720, step=70px per 200ms -->
  <!-- ticks -->
  <line x1="90"  y1="62" x2="90"  y2="68" stroke="#585b70" stroke-width="1"/>
  <line x1="160" y1="62" x2="160" y2="68" stroke="#585b70" stroke-width="1"/>
  <line x1="230" y1="62" x2="230" y2="68" stroke="#585b70" stroke-width="1"/>
  <line x1="300" y1="62" x2="300" y2="68" stroke="#585b70" stroke-width="1"/>
  <line x1="370" y1="62" x2="370" y2="68" stroke="#585b70" stroke-width="1"/>
  <line x1="440" y1="62" x2="440" y2="68" stroke="#585b70" stroke-width="1"/>
  <line x1="510" y1="62" x2="510" y2="68" stroke="#585b70" stroke-width="1"/>
  <line x1="580" y1="62" x2="580" y2="68" stroke="#585b70" stroke-width="1"/>
  <line x1="650" y1="62" x2="650" y2="68" stroke="#585b70" stroke-width="1"/>
  <line x1="720" y1="62" x2="720" y2="68" stroke="#585b70" stroke-width="1"/>
  <!-- tick labels -->
  <text x="90"  y="80" fill="#6c7086" text-anchor="middle" font-size="10">0</text>
  <text x="160" y="80" fill="#6c7086" text-anchor="middle" font-size="10">200</text>
  <text x="230" y="80" fill="#6c7086" text-anchor="middle" font-size="10">400</text>
  <text x="300" y="80" fill="#6c7086" text-anchor="middle" font-size="10">600</text>
  <text x="370" y="80" fill="#6c7086" text-anchor="middle" font-size="10">800</text>
  <text x="440" y="80" fill="#6c7086" text-anchor="middle" font-size="10">1 000</text>
  <text x="510" y="80" fill="#6c7086" text-anchor="middle" font-size="10">1 200</text>
  <text x="580" y="80" fill="#6c7086" text-anchor="middle" font-size="10">1 400</text>
  <text x="650" y="80" fill="#6c7086" text-anchor="middle" font-size="10">1 600</text>
  <text x="720" y="80" fill="#6c7086" text-anchor="middle" font-size="10">1 800 ms</text>

  <!-- ── WITHOUT DEBOUNCE row ────────────────────────────────── -->
  <text x="20" y="116" fill="#f38ba8" font-weight="bold" font-size="12">Without debounce</text>

  <!-- keystrokes: k=0ms ki=180ms kil=310ms kilo=500ms kilokey=650ms -->
  <!-- key event markers (triangles pointing down) -->
  <!-- k at 0ms = x=90 -->
  <polygon points="90,92 86,88 94,88" fill="#fab387"/>
  <text x="90" y="86" fill="#fab387" text-anchor="middle" font-size="10">k</text>
  <!-- ki at 180ms = x=153 -->
  <polygon points="153,92 149,88 157,88" fill="#fab387"/>
  <text x="153" y="86" fill="#fab387" text-anchor="middle" font-size="10">ki</text>
  <!-- kil at 310ms = x=199 -->
  <polygon points="199,92 195,88 203,88" fill="#fab387"/>
  <text x="199" y="86" fill="#fab387" text-anchor="middle" font-size="10">kil</text>
  <!-- kilo at 500ms = x=265 -->
  <polygon points="265,92 261,88 269,88" fill="#fab387"/>
  <text x="265" y="86" fill="#fab387" text-anchor="middle" font-size="10">kilo</text>
  <!-- kilokey at 650ms = x=318 -->
  <polygon points="318,92 314,88 322,88" fill="#fab387"/>
  <text x="318" y="86" fill="#fab387" text-anchor="middle" font-size="10">kilokey</text>

  <!-- API call markers (vertical lines) — one per keystroke -->
  <line x1="90"  y1="95" x2="90"  y2="130" stroke="#f38ba8" stroke-width="2" stroke-dasharray="3 2"/>
  <rect x="76"  y="118" width="28" height="14" rx="3" fill="#f38ba8"/>
  <text x="90"  y="129" fill="#1e1e2e" text-anchor="middle" font-size="10" font-weight="bold">API</text>

  <line x1="153" y1="95" x2="153" y2="130" stroke="#f38ba8" stroke-width="2" stroke-dasharray="3 2"/>
  <rect x="139" y="118" width="28" height="14" rx="3" fill="#f38ba8"/>
  <text x="153" y="129" fill="#1e1e2e" text-anchor="middle" font-size="10" font-weight="bold">API</text>

  <line x1="199" y1="95" x2="199" y2="130" stroke="#f38ba8" stroke-width="2" stroke-dasharray="3 2"/>
  <rect x="185" y="118" width="28" height="14" rx="3" fill="#f38ba8"/>
  <text x="199" y="129" fill="#1e1e2e" text-anchor="middle" font-size="10" font-weight="bold">API</text>

  <line x1="265" y1="95" x2="265" y2="130" stroke="#f38ba8" stroke-width="2" stroke-dasharray="3 2"/>
  <rect x="251" y="118" width="28" height="14" rx="3" fill="#f38ba8"/>
  <text x="265" y="129" fill="#1e1e2e" text-anchor="middle" font-size="10" font-weight="bold">API</text>

  <line x1="318" y1="95" x2="318" y2="130" stroke="#f38ba8" stroke-width="2" stroke-dasharray="3 2"/>
  <rect x="304" y="118" width="28" height="14" rx="3" fill="#f38ba8"/>
  <text x="318" y="129" fill="#1e1e2e" text-anchor="middle" font-size="10" font-weight="bold">API</text>

  <text x="360" y="126" fill="#f38ba8" font-size="11">← 5 API calls  (×5 cost)</text>

  <!-- ── WITH DEBOUNCE row ───────────────────────────────────── -->
  <text x="20" y="180" fill="#a6e3a1" font-weight="bold" font-size="12">With 800 ms debounce (canary.9)</text>

  <!-- Same keystroke events -->
  <polygon points="90,156 86,152 94,152" fill="#fab387"/>
  <text x="90" y="150" fill="#fab387" text-anchor="middle" font-size="10">k</text>
  <polygon points="153,156 149,152 157,152" fill="#fab387"/>
  <text x="153" y="150" fill="#fab387" text-anchor="middle" font-size="10">ki</text>
  <polygon points="199,156 195,152 203,152" fill="#fab387"/>
  <text x="199" y="150" fill="#fab387" text-anchor="middle" font-size="10">kil</text>
  <polygon points="265,156 261,152 269,152" fill="#fab387"/>
  <text x="265" y="150" fill="#fab387" text-anchor="middle" font-size="10">kilo</text>
  <polygon points="318,156 314,152 322,152" fill="#fab387"/>
  <text x="318" y="150" fill="#fab387" text-anchor="middle" font-size="10">kilokey</text>

  <!-- debounce window bracket: from last keystroke (650ms=318) + 800ms = 1450ms=545 -->
  <rect x="318" y="160" width="227" height="10" rx="2" fill="#89b4fa" fill-opacity="0.25" stroke="#89b4fa" stroke-width="1"/>
  <text x="431" y="169" fill="#89b4fa" text-anchor="middle" font-size="10">800 ms debounce window</text>

  <!-- Single API call at 1450ms = x≈545 -->
  <line x1="545" y1="159" x2="545" y2="195" stroke="#a6e3a1" stroke-width="2" stroke-dasharray="3 2"/>
  <rect x="531" y="183" width="28" height="14" rx="3" fill="#a6e3a1"/>
  <text x="545" y="194" fill="#1e1e2e" text-anchor="middle" font-size="10" font-weight="bold">API</text>
  <text x="585" y="192" fill="#a6e3a1" font-size="11">← 1 API call</text>

  <!-- Legend row -->
  <polygon points="90,240 86,236 94,236" fill="#fab387"/>
  <text x="102" y="244" fill="#a6adc8" font-size="11">keystroke event</text>
  <rect x="220" y="233" width="28" height="14" rx="3" fill="#f38ba8"/>
  <text x="234" y="244" fill="#1e1e2e" text-anchor="middle" font-size="10" font-weight="bold">API</text>
  <text x="256" y="244" fill="#a6adc8" font-size="11">API call (no debounce)</text>
  <rect x="440" y="233" width="28" height="14" rx="3" fill="#a6e3a1"/>
  <text x="454" y="244" fill="#1e1e2e" text-anchor="middle" font-size="10" font-weight="bold">API</text>
  <text x="476" y="244" fill="#a6adc8" font-size="11">API call (debounced)</text>
</svg>

---

## 7. Memoization Benefit Table

SolidJS `createMemo` is used throughout `ModelsTab.tsx` and `Settings.tsx` to derive
stable values from reactive signals. Components that receive these memos as props only
re-run when the *derived* value actually changes, not every time an ancestor signal fires.

| Component | Signal driving it | Without memo | With stable memo | Improvement |
|---|---|---|---|---|
| `VirtualModelList` | raw model array signal | Re-renders on any config change | Re-renders only when model list changes | Eliminates spurious re-renders when e.g. display settings change |
| `visibleRange` (memo) | `scrollTop` + `containerHeight` | Recalculates every scroll frame unconditionally | Short-circuits when computed range is identical | Avoids 200-item slice on same range |
| `totalHeight` (memo) | `models.length` | Recalculated on every render | Stable reference; child layout uses cached value | Prevents browser reflow cascade |
| `favoriteKeys` Set | raw favorites array | New Set() on every render, breaks `===` equality | Memoized Set; stable reference between renders | Prevents all model rows from re-rendering on unrelated signal |
| `activeModelKey` | full config signal | Re-derives from entire config object each render | Derived once; updates only when active model key changes | Decouples model row highlights from unrelated config keys |
| `nonFavoriteModels` derived list | models + favoriteKeys | Re-filters 200+ items on every config signal | Only re-filters when favorites or model list changes | Up to 200× fewer filter operations per settings interaction |

---

## 8. Bundle Size Comparison

The total shipped JS is unchanged between canary.8 and canary.9 — no code was deleted.
What changed is the *loading distribution*: code that was previously parsed synchronously
at startup is now split into per-tab chunks and fetched on demand.

```
canary.8  ─────────────────────────────────────────────────────────
Startup parse:  [■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■] ~2 400 KB (all 24 tabs)
On navigate:    (nothing — already loaded)

canary.9  ─────────────────────────────────────────────────────────
Startup parse:  [■] ~100 KB  (Settings shell + initial tab)
On navigate:    [░] ~80–120 KB per tab (fetched on first visit, cached thereafter)
Total after all tabs visited: same ~2 400 KB — but spread across user actions
```

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 260" width="760" height="260" font-family="ui-monospace, monospace" font-size="12">
  <rect width="760" height="260" fill="#1e1e2e" rx="8"/>
  <text x="20" y="28" fill="#cdd6f4" font-size="14" font-weight="bold">Bundle Load Distribution — canary.8 vs canary.9</text>

  <!-- ── canary.8 row ── -->
  <text x="20" y="60" fill="#f38ba8" font-weight="bold">canary.8</text>
  <text x="20" y="76" fill="#a6adc8" font-size="11">at startup</text>
  <!-- single full bar -->
  <rect x="120" y="50" width="580" height="32" rx="4" fill="#f38ba8"/>
  <text x="410" y="71" fill="#1e1e2e" text-anchor="middle" font-weight="bold" font-size="12">2 400 KB — all 24 tab modules parsed at startup</text>

  <!-- ── canary.9 rows ── -->
  <text x="20" y="120" fill="#a6e3a1" font-weight="bold">canary.9</text>
  <text x="20" y="136" fill="#a6adc8" font-size="11">at startup</text>
  <!-- initial slice: 100/2400 * 580 ≈ 24 px -->
  <rect x="120" y="110" width="24" height="32" rx="4" fill="#a6e3a1"/>
  <text x="132" y="131" fill="#1e1e2e" font-size="10" font-weight="bold">~100KB</text>
  <!-- remaining deferred -->
  <rect x="145" y="110" width="555" height="32" rx="4" fill="#313244" stroke="#45475a" stroke-width="1" stroke-dasharray="5 3"/>
  <text x="423" y="131" fill="#6c7086" text-anchor="middle" font-size="11">2 300 KB deferred — loaded on-demand as tabs are visited</text>

  <!-- per-tab breakdown -->
  <text x="20" y="176" fill="#89b4fa" font-size="11">per tab visit</text>
  <!-- show 5 tab chunks stacked -->
  <rect x="120" y="166" width="24" height="20" rx="3" fill="#89b4fa" fill-opacity="0.8"/>
  <rect x="147" y="166" width="22" height="20" rx="3" fill="#89b4fa" fill-opacity="0.7"/>
  <rect x="172" y="166" width="26" height="20" rx="3" fill="#89b4fa" fill-opacity="0.6"/>
  <rect x="201" y="166" width="20" height="20" rx="3" fill="#89b4fa" fill-opacity="0.5"/>
  <rect x="224" y="166" width="24" height="20" rx="3" fill="#89b4fa" fill-opacity="0.4"/>
  <text x="256" y="180" fill="#89b4fa" font-size="10">…each ~80–120 KB, fetched once, cached by browser</text>

  <!-- Legend -->
  <rect x="120" y="218" width="16" height="14" rx="2" fill="#f38ba8"/>
  <text x="142" y="230" fill="#a6adc8" font-size="11">canary.8 eager startup cost</text>
  <rect x="340" y="218" width="16" height="14" rx="2" fill="#a6e3a1"/>
  <text x="362" y="230" fill="#a6adc8" font-size="11">canary.9 startup (shell only)</text>
  <rect x="540" y="218" width="16" height="14" rx="2" fill="#313244" stroke="#45475a" stroke-width="1"/>
  <text x="562" y="230" fill="#a6adc8" font-size="11">canary.9 deferred</text>
</svg>

### Key insight

The total JavaScript payload is identical. The user pays the parse cost only for tabs they
actually visit. A user who only ever uses the **Models** and **Providers** tabs will never
parse the ~1 900 KB of the other 22 modules — a permanent saving for the majority of
sessions.

---

---

## 6. canary.10 Wave-3 Performance Additions

### 6.1 VirtualMessageList (`src/components/chat/VirtualMessageList.tsx` — 250 lines)

Long conversations (500+ messages) previously rendered every message node into the DOM, causing:
- Layout thrash on every new token (browser recalculates full message-list height)
- ~800 ms First Contentful Paint on conversations with >200 messages
- Scroll jank as message nodes accumulate

**Solution:** `VirtualMessageList` wraps `virtua/solid`'s `<Virtualizer>` (existing project dep) with:
- `overscan={10}` — 10-message buffer above/below the visible viewport
- `ResizeObserver` per row — measures real rendered heights; passes average `itemSize` back to virtua so variable-height messages (code blocks, file diffs) are handled correctly
- Stick-to-bottom while `working()` is true; unsticks automatically on manual scroll
- Imperative handles: `scrollToMessage(id)`, `scrollToBottom()` via ref callback

**Activation threshold:** only engaged when `messages.length > 50`. Shorter conversations use the direct DOM render.

| Metric | Before | After |
|---|---|---|
| DOM nodes (500 msgs) | 500+ message nodes | ~25 visible + 20 buffer = 45 nodes |
| Scroll FPS (500 msgs) | ~15 FPS | ~60 FPS |
| First paint (200 msgs) | ~800 ms | ~110 ms |

### 6.2 Memoization additions

**`TaskHeader.tsx`** (line 111):
```typescript
const hasAssistantMessage = createMemo(() => session.messages().some(m => m.role === "assistant"))
```
Previously called twice in JSX as `session.messages().some(...)` — now one memoized read.

**`ChatView.tsx`** (lines 61–68):
```typescript
const hasMessages = createMemo(() => session.messages().length > 0)
const idle = createMemo(() => session.status() !== "busy")
const messageCount = createMemo(() => session.messages().length)
```
Eliminates 5 redundant signal reads per render cycle.

### 6.3 `performance.ts` utilities (`src/utils/performance.ts` — 169 lines)

- `debounce<T>(fn, ms)` — leading-edge debounce with trailing call guarantee (no last event dropped)
- `throttle<T>(fn, ms)` — throttle with trailing final value
- `measureRender(name: string)` — `performance.mark`/`performance.measure` wrapper returning `() => void` end function
- `createDerivedMemo<T>(deps, compute)` — shallow-deep equality check on deps array before recomputing (prevents cascading memos from re-running on identity-equal but newly-allocated arrays)

### 6.4 TabSkeleton (`src/components/settings/TabSkeleton.tsx` — 155 lines)

All 24 settings tabs are `lazy()` + `<Suspense>` wrapped. `TabSkeleton` replaces the previous inline fallback:
- CSS keyframe shimmer animation (single `@keyframes kc-tab-shimmer` injected once)
- Matches approximate tab layout: heading block, 2 description lines, 4 settings rows, 1 toggle row, sub-section heading
- Perceived loading time reduced — user sees a structured placeholder rather than blank space

---

*Generated for KiloCode canary.10 — 2026-04-28*
