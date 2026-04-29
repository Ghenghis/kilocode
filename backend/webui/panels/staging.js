import hub from './core.js';

let _status = {};
let _history = [];

export default {
  id: 'staging',
  label: 'Staging / Promote',
  icon: '🚀',
  section: 'System',
  order: 90,

  async init(h) {
    hub.on('staging.promoted', () => { if (document.getElementById('panel-staging')) this.refresh(); });
    hub.on('staging.rolled_back', () => { if (document.getElementById('panel-staging')) this.refresh(); });
    hub.on('staging.validation.complete', () => { if (document.getElementById('panel-staging')) this.refresh(); });
    hub.on('maintenance.window.opened', () => { if (document.getElementById('panel-staging')) this.refresh(); });
    hub.on('maintenance.window.closed', () => { if (document.getElementById('panel-staging')) this.refresh(); });
  },

  async refresh() {
    const [s, h] = await Promise.all([
      hub.get('/api/staging/status'),
      hub.get('/api/staging/history'),
    ]);
    _status = s;
    _history = h.history || [];
    const el = document.getElementById('panel-staging');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const s = _status;
    const canPromote = s.promote_allowed;
    const canRollback = s.previous_port != null;
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🚀 Staging / Promote</div>
          <div>${hub.badge(s.status || 'idle')}</div>
          <button class="hub-btn" onclick="window._hub_panels.staging.refresh()">↻</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          <div class="hub-card" style="text-align:center">
            <div style="font-size:11px;color:var(--muted)">Staging Port</div>
            <div style="font-size:22px;font-weight:700;color:#60a5fa">${s.staging_port || '—'}</div>
          </div>
          <div class="hub-card" style="text-align:center">
            <div style="font-size:11px;color:var(--muted)">Live Port</div>
            <div style="font-size:22px;font-weight:700;color:#22c55e">${s.live_port || '—'}</div>
          </div>
          <div class="hub-card" style="text-align:center">
            <div style="font-size:11px;color:var(--muted)">Validation</div>
            <div style="margin-top:4px">${hub.badge(s.validation_passed ? 'ok' : 'pending')}</div>
            ${s.validation_expires_in != null ? `<div style="font-size:10px;color:var(--muted)">expires ${s.validation_expires_in}s</div>` : ''}
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
          <button class="hub-btn hub-btn-primary" onclick="window._stage_validate()">✓ Validate</button>
          <button class="hub-btn ${canPromote ? 'hub-btn-primary' : ''}" ${!canPromote ? 'disabled style="opacity:0.4"' : ''} onclick="window._stage_promote()">🚀 Promote</button>
          <button class="hub-btn hub-btn-warn" ${!canRollback ? 'disabled style="opacity:0.4"' : ''} onclick="window._stage_rollback()">↩ Rollback</button>
        </div>

        ${!canPromote ? '<div style="font-size:11px;color:#f59e0b;margin-bottom:10px">⚠ Run validation first. Promote requires a passed validation + maintenance window.</div>' : ''}

        <div class="hub-card">
          <div class="hub-card-title">Promotion History</div>
          <div style="max-height:200px;overflow-y:auto;margin-top:6px">
            ${_history.length === 0 ? '<div style="color:var(--muted);font-size:11px">No history</div>' : ''}
            ${_history.map(e => `
              <div style="padding:4px 0;border-bottom:1px solid #1f2937;font-size:11px">
                <span style="color:var(--muted)">${hub.reltime(e.ts)}</span>
                <span style="margin-left:6px">${hub.badge(e.type)}</span>
                ${e.from_port ? `<span style="margin-left:6px;color:var(--muted)">${e.from_port} → ${e.to_port}</span>` : ''}
                ${e.passed != null ? `<span style="margin-left:6px">${hub.badge(e.passed ? 'ok' : 'failed')}</span>` : ''}
                <span style="margin-left:6px;font-size:10px;color:#4b5563">${e.evidence_id}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  },
};

window._stage_validate = async () => {
  const r = await hub.post('/api/staging/validate');
  window._hub_panels.staging.refresh();
  if (!r.passed) alert(`Validation failed:\n${JSON.stringify(r.checks, null, 2)}`);
};
window._stage_promote = async () => {
  if (!confirm('Promote staging → live? This requires a maintenance window.')) return;
  const r = await hub.post('/api/staging/promote');
  if (r.error) alert(`Error: ${r.error}`);
  window._hub_panels.staging.refresh();
};
window._stage_rollback = async () => {
  if (!confirm('Rollback live → previous? This requires a maintenance window.')) return;
  const r = await hub.post('/api/staging/rollback');
  if (r.error) alert(`Error: ${r.error}`);
  window._hub_panels.staging.refresh();
};
