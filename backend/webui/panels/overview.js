import hub from './core.js';

let _data = {};
let _vm = {};

const _toneColors = {
  positive: '#22c55e', warning: '#f59e0b', critical: '#ef4444', neutral: '#6b7280',
};

function _toneBadge(tone, value) {
  const c = _toneColors[tone] || _toneColors.neutral;
  return `<span style="display:inline-block;padding:2px 10px;border-radius:9px;font-size:12px;font-weight:600;background:${c}18;color:${c};border:1px solid ${c}30">${value}</span>`;
}

export default {
  id: 'overview',
  label: 'Overview',
  icon: '🏠',
  section: 'Hub',
  order: 0,

  async init(h) {
    hub.on('*', () => { if (document.getElementById('panel-overview')) this.refresh(); });
  },

  async refresh() {
    const [health, vm, owui] = await Promise.all([
      hub.get('/health'),
      hub.get('/api/overview'),
      hub.get('/api/openwebui/status'),
    ]);
    _data = { health, owui };
    _vm = vm || {};
    const el = document.getElementById('panel-overview');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const h = _data.health || {};
    const ow = _data.owui || {};
    const badges = _vm.headerBadges || [];
    const cards = _vm.summaryCards || [];
    const kc = _vm.kilocode || {};

    return `
      <div style="padding:16px">
        <!-- Header Badges (ported from OpenClaude ControlCenter ViewModel) -->
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
          ${badges.map(b => `
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">${b.label}:</span>
              ${_toneBadge(b.tone, b.value)}
            </div>
          `).join('')}
          <div style="margin-left:auto;font-size:11px;color:var(--muted)">
            ${hub.badge(h.status || 'unknown')} Hub v${h.version || '?'} · Auth: ${h.auth || '?'}
          </div>
        </div>

        <!-- Summary Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:16px">
          ${cards.map(c => `
            <div class="hub-card">
              <div class="hub-card-title">${c.label}</div>
              <div style="font-size:13px;font-weight:600" title="${c.full || c.value || ''}">${c.value || '—'}</div>
            </div>`).join('')}
          <div class="hub-card">
            <div class="hub-card-title">KiloCode</div>
            <div style="font-size:13px;font-weight:600">${kc.synced ? '✓ synced' : '⚠ not synced'}</div>
            ${kc.version ? `<div style="font-size:11px;color:var(--muted)">v${kc.version}</div>` : ''}
            ${kc.last_sync ? `<div style="font-size:10px;color:var(--muted)">Last sync: ${hub.reltime(kc.last_sync)}</div>` : ''}
          </div>
        </div>

        <!-- Service Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
          <div class="hub-card">
            <div class="hub-card-title">Open WebUI</div>
            <div>${hub.badge(ow.ok ? 'online' : 'offline')}</div>
            <div style="margin-top:4px;font-size:11px;color:var(--muted)">${ow.model_count || 0} models · ${ow.pipeline_count || 0} pipelines</div>
            ${(ow.pipelines || []).length > 0 ? `<div style="margin-top:4px;font-size:10px;color:var(--muted)">Pipelines: ${ow.pipelines.join(', ')}</div>` : ''}
          </div>
          <div class="hub-card">
            <div class="hub-card-title">Providers</div>
            <div style="font-size:22px;font-weight:700">${_vm.providers?.online || 0}/${_vm.providers?.total || 0}</div>
            <div style="font-size:11px;color:var(--muted)">online · ${_toneBadge(_vm.providers?.tone || 'neutral', _vm.providers?.tone || '?')}</div>
          </div>
          <div class="hub-card">
            <div class="hub-card-title">Quick Links</div>
            <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">
              <a href="/docs" target="_blank" style="font-size:12px">📄 API Docs</a>
              <a href="/mcp" target="_blank" style="font-size:12px">🔌 MCP Endpoint</a>
              <a href="/events" target="_blank" style="font-size:12px">📡 SSE Stream</a>
              <a href="/panels/manifest.json" target="_blank" style="font-size:12px">🗂 Panel Manifest</a>
            </div>
          </div>
        </div>
      </div>`;
  },
};
