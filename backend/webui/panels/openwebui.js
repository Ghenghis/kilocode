import hub from './core.js';

let _status = {};
let _pipelines = [];

export default {
  id: 'openwebui',
  label: 'Open WebUI',
  icon: '🌐',
  section: 'Pipelines',
  order: 15,

  async init(h) {
    hub.on('openwebui.pipelines.reloaded', () => { if (document.getElementById('panel-openwebui')) this.refresh(); });
    hub.on('settings.sync.webui', () => { if (document.getElementById('panel-openwebui')) this.refresh(); });
  },

  async refresh() {
    const [s, p] = await Promise.all([
      hub.get('/api/openwebui/status'),
      hub.get('/api/openwebui/pipelines'),
    ]);
    _status = s;
    _pipelines = p.data || [];
    const el = document.getElementById('panel-openwebui');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const s = _status;
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🌐 Open WebUI</div>
          <div>${hub.badge(s.ok ? 'online' : 'offline')}</div>
          <button class="hub-btn" onclick="window._hub_panels.openwebui.refresh()">↻</button>
          <button class="hub-btn hub-btn-primary" onclick="window._owui_reload()">↺ Reload Pipelines</button>
          <button class="hub-btn" onclick="window._owui_sync_webui()">🔄 Sync State</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div class="hub-card">
            <div class="hub-card-title">Connection</div>
            <div style="margin-top:6px;font-size:12px">
              <div>Status: ${hub.badge(s.ok ? 'online' : 'offline')}</div>
              <div style="margin-top:4px;color:var(--muted)">${s.url || ''}</div>
            </div>
          </div>
          <div class="hub-card">
            <div class="hub-card-title">Models &amp; Pipelines</div>
            <div style="margin-top:6px;font-size:12px">
              <div>Models: <strong>${s.model_count || 0}</strong></div>
              <div>Pipelines: <strong>${s.pipeline_count || 0}</strong></div>
            </div>
          </div>
        </div>
        <div class="hub-card">
          <div class="hub-card-title">Installed Pipelines</div>
          <div style="margin-top:6px">
            ${_pipelines.length === 0
              ? '<div style="color:var(--muted);font-size:11px">No pipelines found or service offline</div>'
              : _pipelines.map(p => `
                  <div style="padding:4px 0;border-bottom:1px solid #1f2937;font-size:12px">
                    <span style="font-weight:600">${p.id || p.name || '?'}</span>
                    ${p.type ? `<span style="color:var(--muted);margin-left:6px">${p.type}</span>` : ''}
                  </div>`).join('')}
          </div>
        </div>
        <div style="margin-top:12px;padding:10px;background:#0f172a;border-radius:6px;font-size:11px;color:var(--muted)">
          MCP config: <code style="color:#60a5fa">{ "mcpServers": { "hub": { "url": "http://localhost:8095/mcp" } } }</code>
        </div>
      </div>`;
  },
};

window._owui_reload = async () => {
  const r = await hub.post('/api/openwebui/pipelines/reload');
  alert(r.error ? `Error: ${r.error}` : 'Pipelines reloaded');
  window._hub_panels.openwebui.refresh();
};
window._owui_sync_webui = async () => {
  await hub.post('/api/settings/sync/webui');
  window._hub_panels.openwebui.refresh();
};
