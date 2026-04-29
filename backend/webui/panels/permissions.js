import hub from './core.js';

let _queue = [];
let _pendingCount = 0;
let _capabilities = [];
let _capRisk = {};
let _audit = [];

const _riskColors = { safe: '#22c55e', moderate: '#f59e0b', elevated: '#f97316', disruptive: '#ef4444' };

function _riskBadge(risk) {
  const c = _riskColors[risk] || '#6b7280';
  return `<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;background:${c}20;color:${c};border:1px solid ${c}40">${risk}</span>`;
}

export default {
  id: 'permissions',
  label: 'Permissions',
  icon: '🔐',
  section: 'Core',
  order: 35,

  async init(h) {
    hub.on('permission.approval.requested', () => this._autoRefresh());
    hub.on('permission.approved', () => this._autoRefresh());
    hub.on('permission.denied', () => this._autoRefresh());
    hub.on('permission.policy.updated', () => this._autoRefresh());
  },

  _autoRefresh() {
    if (document.getElementById('panel-permissions')) this.refresh();
  },

  async refresh() {
    const [capRes, queueRes, auditRes] = await Promise.all([
      hub.get('/api/permissions/capabilities'),
      hub.get('/api/permissions/queue'),
      hub.get('/api/permissions/audit?limit=20'),
    ]);
    _capabilities = capRes.capabilities || [];
    _capRisk = capRes.capability_risk || {};
    _queue = queueRes.queue || [];
    _pendingCount = queueRes.pending || 0;
    _audit = auditRes.audit || [];
    const el = document.getElementById('panel-permissions');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const pending = _queue.filter(r => r.status === 'pending');
    const decided = _queue.filter(r => r.status !== 'pending');

    // Group capabilities by risk
    const byRisk = {};
    for (const cap of _capabilities) {
      const risk = _capRisk[cap] || 'moderate';
      if (!byRisk[risk]) byRisk[risk] = [];
      byRisk[risk].push(cap);
    }

    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🔐 Permissions & Safety</div>
          ${_pendingCount > 0 ? `<span style="background:#ef4444;color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">${_pendingCount} pending</span>` : ''}
          <button class="hub-btn" onclick="window._hub_panels.permissions.refresh()">↻</button>
          <button class="hub-btn" onclick="window._perm_check()">🔍 Check Permission</button>
        </div>

        <!-- Pending Approvals -->
        ${pending.length > 0 ? `
          <div class="hub-card" style="margin-bottom:12px;border:1px solid #ef444440">
            <div class="hub-card-title" style="color:#ef4444">⚠️ Pending Approvals (${pending.length})</div>
            ${pending.map(r => `
              <div style="padding:8px;margin-top:6px;background:#0d111780;border-radius:4px;border-left:3px solid ${_riskColors[r.risk] || '#6b7280'}">
                <div style="display:flex;align-items:center;gap:6px">
                  ${_riskBadge(r.risk)}
                  <span style="font-size:12px;font-weight:600">${r.agent_id}</span>
                  <span style="font-size:11px;color:var(--muted)">→</span>
                  <span style="font-size:11px;font-family:monospace;color:#60a5fa">${r.capability}</span>
                </div>
                ${r.description ? `<div style="font-size:10px;color:var(--muted);margin-top:3px">${r.description}</div>` : ''}
                <div style="display:flex;gap:4px;margin-top:6px">
                  <button class="hub-btn hub-btn-primary" style="font-size:10px" onclick="window._perm_approve('${r.id}')">✓ Approve</button>
                  <button class="hub-btn hub-btn-warn" style="font-size:10px" onclick="window._perm_deny('${r.id}')">✗ Deny</button>
                </div>
              </div>`).join('')}
          </div>` : `
          <div class="hub-card" style="margin-bottom:12px;border:1px solid #22c55e40">
            <div style="font-size:12px;color:#22c55e;padding:4px">✓ No pending approvals</div>
          </div>`}

        <!-- Capability Matrix -->
        <div class="hub-card" style="margin-bottom:12px">
          <div class="hub-card-title">Capability Risk Matrix</div>
          <div style="margin-top:8px">
            ${['disruptive','elevated','moderate','safe'].map(risk => {
              const caps = byRisk[risk] || [];
              if (caps.length === 0) return '';
              return `
                <div style="margin-bottom:8px">
                  <div style="margin-bottom:4px">${_riskBadge(risk)} <span style="font-size:10px;color:var(--muted)">${caps.length} capabilities</span></div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px">
                    ${caps.map(cap => `<span style="font-size:10px;font-family:monospace;padding:2px 6px;background:#1f2937;border-radius:4px;color:var(--muted)">${cap}</span>`).join('')}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Recent Decisions -->
        ${decided.length > 0 ? `
          <div class="hub-card" style="margin-bottom:12px">
            <div class="hub-card-title">Recent Decisions</div>
            <div style="max-height:140px;overflow-y:auto;margin-top:6px">
              ${decided.slice(0, 15).map(r => `
                <div style="padding:3px 0;border-bottom:1px solid #1f2937;font-size:11px;display:flex;align-items:center;gap:6px">
                  <span style="color:${r.status === 'approved' ? '#22c55e' : '#ef4444'}">${r.status === 'approved' ? '✓' : '✗'}</span>
                  <span style="color:#60a5fa">${r.agent_id}</span>
                  <span style="font-family:monospace;color:var(--muted)">${r.capability}</span>
                  ${_riskBadge(r.risk)}
                  <span style="margin-left:auto;color:var(--muted)">${r.decided_by || ''} ${hub.reltime(r.decided_at)}</span>
                </div>`).join('')}
            </div>
          </div>` : ''}

        <!-- Audit Log -->
        <div class="hub-card">
          <div class="hub-card-title">Permission Audit</div>
          <div style="max-height:140px;overflow-y:auto;margin-top:6px">
            ${_audit.length === 0 ? '<div style="font-size:11px;color:var(--muted)">No audit entries</div>' : ''}
            ${_audit.map(a => `
              <div style="padding:2px 0;border-bottom:1px solid #1f2937;font-size:10px">
                <span style="color:var(--muted)">${hub.reltime(a.ts)}</span>
                <span style="margin-left:4px;color:#60a5fa">${a.action}</span>
                <span style="margin-left:4px">${a.agent_id}</span>
                <span style="margin-left:4px;color:var(--muted)">${a.detail}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  },
};

window._perm_approve = async (id) => {
  await hub.post(`/api/permissions/approve/${id}`, { by: 'user' });
  window._hub_panels.permissions.refresh();
};
window._perm_deny = async (id) => {
  const reason = prompt('Denial reason:', 'Denied by user');
  await hub.post(`/api/permissions/deny/${id}`, { by: 'user', reason: reason || 'Denied' });
  window._hub_panels.permissions.refresh();
};
window._perm_check = async () => {
  const agent = prompt('Agent ID (e.g. kc-main, kc-06):', 'kc-main');
  if (!agent) return;
  const cap = prompt(`Capability to check:\n${['code_write','shell_exec','docker_exec','git_push','db_migrate','file_delete'].join(', ')}`, 'shell_exec');
  if (!cap) return;
  const r = await hub.post('/api/permissions/check', { agent_id: agent, capability: cap });
  alert(`${r.allowed ? '✓ ALLOWED' : '✗ DENIED'}\nReason: ${r.reason}\nRisk: ${r.risk}${r.needs_approval ? '\n⚠ Requires approval' : ''}${r.needs_maintenance ? '\n⚠ Requires maintenance window' : ''}`);
};
