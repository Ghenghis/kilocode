import hub from './core.js';

let _bots = [];

export default {
  id: 'vps',
  label: 'VPS / Infra',
  icon: '🖥',
  section: 'Infrastructure',
  order: 60,

  async init(h) {},

  async refresh() {
    const r = await hub.get('/api/runtime/discord/bots');
    _bots = r.bots || [];
    const el = document.getElementById('panel-vps');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const online = _bots.filter(b => b.status === 'online').length;
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🖥 VPS / Infra</div>
          <span style="font-size:12px;color:var(--muted)">${online}/${_bots.length} bots online</span>
          <button class="hub-btn" onclick="window._hub_panels.vps.refresh()">↻</button>
        </div>
        <div class="hub-card" style="margin-bottom:12px">
          <div class="hub-card-title">VPS Host: 187.77.30.206</div>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            <button class="hub-btn" onclick="window._vps_audit()">🔍 Audit</button>
            <button class="hub-btn hub-btn-warn" onclick="window._vps_iptables()">🔧 Fix iptables (Shiba)</button>
          </div>
        </div>
        <div class="hub-card">
          <div class="hub-card-title">Hermes Bots</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">
            <tr style="color:var(--muted)"><th style="text-align:left;padding:2px 6px">Bot</th><th>Status</th><th>Channel</th><th>Role</th></tr>
            ${_bots.map(b => `
              <tr style="border-top:1px solid #1f2937">
                <td style="padding:3px 6px;font-weight:600">${b.bot}</td>
                <td style="text-align:center">${hub.badge(b.status)}</td>
                <td style="text-align:center;color:var(--muted)">${b.channel}</td>
                <td style="color:var(--muted)">${b.role}</td>
              </tr>`).join('')}
          </table>
        </div>
      </div>`;
  },
};

window._vps_audit = async () => {
  const r = await hub.post('/api/runtime/discord/audit');
  alert(r.note || JSON.stringify(r));
};
window._vps_iptables = async () => {
  if (!confirm('Apply iptables fix? Requires maintenance window.')) return;
  const r = await hub.post('/api/runtime/discord/iptables-fix');
  alert(r.note || r.error || JSON.stringify(r));
};
