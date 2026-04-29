import hub from './core.js';

let _data = {};

export default {
  id: 'hermes',
  label: 'Hermes',
  icon: '🤖',
  section: 'Pipelines',
  order: 10,

  async init(h) {
    hub.on('kilocode.synced', () => { if (document.getElementById('panel-hermes')) this.refresh(); });
  },

  async refresh() {
    const [status, bots] = await Promise.all([
      hub.get('/api/hermes/health').catch(() => ({})),
      hub.get('/api/runtime/discord/bots'),
    ]);
    _data = { status, bots };
    const el = document.getElementById('panel-hermes');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const s = _data.status || {};
    const bots = _data.bots?.bots || [];
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="font-size:20px">🤖 Hermes</div>
          <div>${hub.badge(s.status || (s.error ? 'offline' : 'unknown'))}</div>
          <button class="hub-btn" onclick="window._hub_panels.hermes.refresh()">↻ Refresh</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:16px">
          ${bots.map(b => `
            <div class="hub-card" style="padding:10px">
              <div style="font-weight:600;font-size:12px">${b.bot}</div>
              <div>${hub.badge(b.status)} <span style="font-size:10px;color:var(--muted)">${b.channel}</span></div>
              <div style="font-size:10px;color:var(--muted);margin-top:3px">${b.role}</div>
              ${b.last_activity ? `<div style="font-size:10px;color:var(--muted)">${hub.reltime(b.last_activity)}</div>` : ''}
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <button class="hub-btn" onclick="window._hub_broadcast()">📢 Broadcast</button>
          <button class="hub-btn hub-btn-warn" onclick="window._hub_iptables()">🔧 Fix iptables</button>
        </div>
      </div>`;
  },
};

window._hub_broadcast = async () => {
  const msg = prompt('Broadcast message to all Hermes bots:');
  if (!msg) return;
  await hub.post('/api/runtime/discord/broadcast', { message: msg });
  alert('Broadcast queued');
};

window._hub_iptables = async () => {
  if (!confirm('Apply iptables fix for Shiba port 18789? Requires maintenance window.')) return;
  const r = await hub.post('/api/runtime/discord/iptables-fix');
  alert(r.note || r.error || JSON.stringify(r));
};
