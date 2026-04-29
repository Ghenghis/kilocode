import hub from './core.js';

let _status = {};

export default {
  id: 'memory',
  label: 'Memory',
  icon: '🧠',
  section: 'Pipelines',
  order: 30,

  async init(h) {},

  async refresh() {
    const r = await hub.get('/api/settings/kilocode/memory');
    _status = r;
    const el = document.getElementById('panel-memory');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const s = _status;
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🧠 Shiba Memory</div>
          <div>${hub.badge(s.enabled ? 'online' : 'offline')}</div>
          <button class="hub-btn" onclick="window._hub_panels.memory.refresh()">↻</button>
        </div>
        <div class="hub-card">
          <div class="hub-card-title">Configuration</div>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:4px;font-size:12px;margin-top:6px">
            <span style="color:var(--muted)">Endpoint</span>
            <span>${s.endpoint || 'http://localhost:18789'}</span>
            <span style="color:var(--muted)">Enabled</span>
            <span>${hub.badge(s.enabled ? 'ok' : 'offline')}</span>
            <span style="color:var(--muted)">Training</span>
            <span>${hub.badge(s.trainingEnabled ? 'ok' : 'offline')}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="hub-btn hub-btn-primary" onclick="window._mem_recall()">🔍 Recall</button>
          <button class="hub-btn" onclick="window._mem_ping()">📡 Ping</button>
        </div>
        <div id="mem-result" style="margin-top:10px;font-size:11px;color:var(--muted)"></div>
      </div>`;
  },
};

window._mem_recall = async () => {
  const q = prompt('Memory recall query:');
  if (!q) return;
  const r = await hub.get(`/api/settings/kilocode/memory?q=${encodeURIComponent(q)}`);
  const el = document.getElementById('mem-result');
  if (el) el.textContent = JSON.stringify(r, null, 2);
};
window._mem_ping = async () => {
  const r = await hub.get('/api/settings/kilocode/memory');
  const el = document.getElementById('mem-result');
  if (el) el.textContent = r.endpoint ? `Endpoint: ${r.endpoint} — ${r.enabled ? 'enabled' : 'disabled'}` : JSON.stringify(r);
};
