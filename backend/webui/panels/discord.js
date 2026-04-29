import hub from './core.js';

let _bots = [];

export default {
  id: 'discord',
  label: 'Discord',
  icon: '💬',
  section: 'Infrastructure',
  order: 65,

  async init(h) {},

  async refresh() {
    const r = await hub.get('/api/runtime/discord/bots');
    _bots = r.bots || [];
    const el = document.getElementById('panel-discord');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const online = _bots.filter(b => b.status === 'online').length;
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">💬 Discord Bots</div>
          <span style="font-size:12px;color:var(--muted)">${online}/${_bots.length} online</span>
          <button class="hub-btn" onclick="window._hub_panels.discord.refresh()">↻</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:12px">
          ${_bots.map(b => `
            <div class="hub-card" style="padding:10px">
              <div style="font-weight:600;font-size:13px">${b.bot}</div>
              <div>${hub.badge(b.status)} <span style="font-size:10px;color:var(--muted)">${b.channel}</span></div>
              <div style="font-size:10px;color:var(--muted);margin-top:3px">${b.role}</div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <button class="hub-btn hub-btn-primary" onclick="window._dc_broadcast()">📢 Broadcast</button>
          <button class="hub-btn" onclick="window._dc_audit()">🔍 Audit</button>
        </div>
      </div>`;
  },
};

window._dc_broadcast = async () => {
  const msg = prompt('Broadcast message:');
  if (!msg) return;
  const r = await hub.post('/api/runtime/discord/broadcast', { message: msg });
  alert(r.note || JSON.stringify(r));
};
window._dc_audit = async () => {
  const r = await hub.post('/api/runtime/discord/audit');
  alert(r.note || JSON.stringify(r));
};
