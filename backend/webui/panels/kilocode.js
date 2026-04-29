import hub from './core.js';

let _status = {};
let _sync = {};

export default {
  id: 'kilocode',
  label: 'KiloCode',
  icon: '🧩',
  section: 'KiloCode',
  order: 45,

  async init(h) {
    hub.on('kilocode.synced', () => { if (document.getElementById('panel-kilocode')) this.refresh(); });
    hub.on('settings.sync.kilocode', () => { if (document.getElementById('panel-kilocode')) this.refresh(); });
  },

  async refresh() {
    const [s, sync] = await Promise.all([
      hub.get('/api/runtime/kilocode/status'),
      hub.get('/api/settings/sync'),
    ]);
    _status = s;
    _sync = sync;
    const el = document.getElementById('panel-kilocode');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const s = _status;
    const sync = _sync;
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🧩 KiloCode</div>
          <div>${hub.badge(s.synced ? 'online' : 'offline')}</div>
          <button class="hub-btn" onclick="window._hub_panels.kilocode.refresh()">↻</button>
          <button class="hub-btn hub-btn-primary" onclick="window._kc_sync()">🔄 Sync</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div class="hub-card">
            <div class="hub-card-title">Extension Status</div>
            <div style="margin-top:6px;font-size:12px">
              <div>Synced: ${hub.badge(s.synced ? 'ok' : 'offline')}</div>
              <div style="margin-top:4px">Last sync: ${s.last_sync ? hub.reltime(s.last_sync) : '—'}</div>
              ${s.version ? `<div>Version: ${s.version}</div>` : ''}
              <div>Drift: ${s.drift || 0}</div>
            </div>
          </div>
          <div class="hub-card">
            <div class="hub-card-title">Settings Sync</div>
            <div style="margin-top:6px;font-size:12px">
              <div>KiloCode: ${hub.badge(sync.kilocode_synced ? 'ok' : 'offline')}</div>
              <div>WebUI: ${hub.badge(sync.webui_synced ? 'ok' : 'offline')}</div>
              <div style="margin-top:4px">Last: ${sync.last_sync ? hub.reltime(sync.last_sync) : '—'}</div>
            </div>
          </div>
        </div>
        <div class="hub-card">
          <div class="hub-card-title">Commands</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            ${Object.entries(s.commands || {}).map(([cmd, res]) =>
              `<button class="hub-btn" style="font-size:11px" onclick="window._kc_cmd('${cmd}')">${cmd}</button>`
            ).join('')}
          </div>
        </div>
      </div>`;
  },
};

window._kc_sync = async () => {
  await hub.post('/api/runtime/kilocode/sync');
  await hub.post('/api/settings/sync/kilocode');
  window._hub_panels.kilocode.refresh();
};
window._kc_cmd = async (cmd) => {
  const r = await hub.post('/api/runtime/kilocode/cmd', { command: cmd });
  alert(r.result || r.error || JSON.stringify(r));
};
