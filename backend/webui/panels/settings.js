import hub from './core.js';

let _state = {};
let _questions = [];
let _audit = [];
let _sync = {};
let _validation = null; // { valid, errors: [{key, message, severity, fix}] }

const _sevColors = { error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

function _sevBadge(severity) {
  const c = _sevColors[severity] || _sevColors.info;
  return `<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;background:${c}20;color:${c};border:1px solid ${c}40">${severity}</span>`;
}

export default {
  id: 'settings',
  label: 'Settings',
  icon: '⚙️',
  section: 'System',
  order: 80,

  async init(h) {
    hub.on('settings.sync.kilocode', () => { if (document.getElementById('panel-settings')) this.refresh(); });
    hub.on('settings.sync.webui', () => { if (document.getElementById('panel-settings')) this.refresh(); });
    hub.on('settings.changed', () => { if (document.getElementById('panel-settings')) this.refresh(); });
    hub.on('maintenance.window.opened', () => { if (document.getElementById('panel-settings')) this.refresh(); });
    hub.on('maintenance.window.closed', () => { if (document.getElementById('panel-settings')) this.refresh(); });
  },

  async refresh() {
    const [state, questions, audit, sync] = await Promise.all([
      hub.get('/api/settings/state'),
      hub.get('/api/settings/questions'),
      hub.get('/api/settings/audit'),
      hub.get('/api/settings/sync'),
    ]);
    _state = state;
    _questions = questions.questions || [];
    _audit = audit.audit || audit.entries || [];
    _sync = sync;
    const el = document.getElementById('panel-settings');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const unanswered = _questions.filter(q => !q.answered);
    const mw = _state.maintenance_window;

    // Completeness
    const answered = _questions.filter(q => q.answered).length;
    const total = _questions.length;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 100;

    // Validation results
    const vErrors = (_validation && _validation.errors) || [];
    const hasErrors = vErrors.some(e => e.severity === 'error');
    const hasWarnings = vErrors.some(e => e.severity === 'warning');

    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">⚙️ Settings</div>
          <button class="hub-btn" onclick="window._hub_panels.settings.refresh()">↻</button>
          <button class="hub-btn hub-btn-primary" onclick="window._settings_autofill()">🔍 Auto-fill</button>
          <button class="hub-btn" onclick="window._settings_repair()">🔧 Repair</button>
          <button class="hub-btn" onclick="window._settings_validate()">✓ Validate</button>
        </div>

        <!-- Completeness Indicator -->
        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:12px;font-weight:600">${answered}/${total} required keys set</span>
            <span style="font-size:11px;color:var(--muted)">${pct}%</span>
          </div>
          <div style="width:100%;max-width:400px;height:6px;background:#1f2937;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${pct === 100 ? '#22c55e' : pct > 60 ? '#f59e0b' : '#ef4444'};border-radius:3px;transition:width .3s"></div>
          </div>
        </div>

        <!-- Validation Results (Phase 3: per-key validation with severity + fix) -->
        ${_validation ? `
          <div class="hub-card" style="margin-bottom:12px;border:1px solid ${hasErrors ? '#ef444440' : hasWarnings ? '#f59e0b40' : '#22c55e40'}">
            <div class="hub-card-title" style="color:${hasErrors ? '#ef4444' : hasWarnings ? '#f59e0b' : '#22c55e'}">
              ${_validation.valid ? '✓ All settings valid' : `✗ ${vErrors.length} issue${vErrors.length !== 1 ? 's' : ''} found`}
            </div>
            ${vErrors.map(e => `
              <div style="margin-top:8px;padding:8px;background:#0d111780;border-radius:4px;border-left:3px solid ${_sevColors[e.severity] || '#6b7280'}">
                <div style="display:flex;align-items:center;gap:6px">
                  ${_sevBadge(e.severity)}
                  <span style="font-size:12px;font-weight:600;font-family:monospace">${e.key}</span>
                </div>
                <div style="font-size:11px;color:var(--muted);margin-top:4px">${e.message}</div>
                ${e.fix ? `
                  <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
                    <span style="font-size:10px;color:var(--muted)">Fix: ${e.fix}</span>
                    <button class="hub-btn hub-btn-primary" style="font-size:10px;padding:1px 8px" onclick="window._settings_autofix_key('${e.key}')">Auto-fix</button>
                  </div>` : ''}
              </div>`).join('')}
          </div>` : ''}

        ${unanswered.length > 0 ? `
          <div class="hub-card" style="margin-bottom:12px;border:1px solid #f59e0b40">
            <div class="hub-card-title" style="color:#f59e0b">⚠️ ${unanswered.length} Unanswered Question${unanswered.length > 1 ? 's' : ''}</div>
            ${unanswered.map(q => `
              <div style="margin-top:6px;padding:6px 0;border-bottom:1px solid #1f2937">
                <div style="font-size:12px;font-weight:600">${q.label}</div>
                <div style="font-size:11px;color:var(--muted)">${q.hint || ''}</div>
                <button class="hub-btn" style="margin-top:4px;font-size:10px" onclick="window._settings_answer('${q.id}','${q.type}')">Answer</button>
              </div>`).join('')}
          </div>` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div class="hub-card">
            <div class="hub-card-title">Cross-Surface Sync</div>
            <div style="margin-top:6px;font-size:12px">
              <div>KiloCode: ${hub.badge(_sync.kilocode_synced ? 'ok' : 'offline')} ${_sync.last_kilocode_sync ? `<span style="font-size:10px;color:var(--muted)">${hub.reltime(_sync.last_kilocode_sync)}</span>` : ''}</div>
              <div>Open WebUI: ${hub.badge(_sync.webui_synced ? 'ok' : 'offline')} ${_sync.last_webui_sync ? `<span style="font-size:10px;color:var(--muted)">${hub.reltime(_sync.last_webui_sync)}</span>` : ''}</div>
              <div style="margin-top:4px;font-size:10px;color:var(--muted)">Last sync: ${_sync.last_sync ? hub.reltime(_sync.last_sync) : '—'}</div>
            </div>
          </div>
          <div class="hub-card">
            <div class="hub-card-title">Maintenance Window</div>
            <div style="margin-top:6px;font-size:12px">
              <div>${hub.badge(mw ? 'open' : 'closed')}</div>
              ${mw ? `<div style="margin-top:4px;color:var(--muted)">${mw.reason || 'No reason'}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;margin-top:8px">
              ${!mw
                ? `<button class="hub-btn hub-btn-primary" style="font-size:10px" onclick="window._settings_open_mw()">Open Window</button>`
                : `<button class="hub-btn hub-btn-warn" style="font-size:10px" onclick="window._settings_close_mw()">Close Window</button>`}
            </div>
          </div>
        </div>

        <div class="hub-card">
          <div class="hub-card-title">Recent Audit Trail</div>
          <div style="max-height:200px;overflow-y:auto;margin-top:6px">
            ${_audit.length === 0 ? '<div style="font-size:11px;color:var(--muted)">No audit entries</div>' : ''}
            ${_audit.slice(0, 20).map(a => `
              <div style="padding:3px 0;border-bottom:1px solid #1f2937;font-size:11px">
                <span style="color:var(--muted)">${hub.reltime(a.timestamp)}</span>
                <span style="margin-left:6px;color:#60a5fa">${a.subsystem}</span>
                <span style="margin-left:6px;color:var(--muted)">${a.changed_by}</span>
                <span style="margin-left:6px">${(a.changed_fields || []).join(', ')}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  },
};

window._settings_autofill = async () => {
  const r = await hub.post('/api/settings/auto-fill');
  alert(r.message || r.error || JSON.stringify(r));
  window._hub_panels.settings.refresh();
};
window._settings_repair = async () => {
  const r = await hub.post('/api/settings/repair');
  alert(r.message || r.error || JSON.stringify(r));
  window._hub_panels.settings.refresh();
};
window._settings_validate = async () => {
  const r = await hub.post('/api/settings/validate');
  _validation = r;
  const el = document.getElementById('panel-settings');
  if (el) el.innerHTML = window._hub_panels.settings.render();
};
window._settings_autofix_key = async (key) => {
  const r = await hub.post('/api/settings/auto-fill', { keys: [key], changed_by: 'user:autofix' });
  alert(r.message || r.error || `Auto-fix applied for ${key}`);
  // Re-validate after fix
  const v = await hub.post('/api/settings/validate');
  _validation = v;
  window._hub_panels.settings.refresh();
};
window._settings_answer = async (id, type) => {
  const val = prompt(`Answer for: ${id}`);
  if (val === null) return;
  await hub.post(`/api/settings/questions/${id}/answer`, { value: val, changed_by: 'user' });
  window._hub_panels.settings.refresh();
};
window._settings_open_mw = async () => {
  const reason = prompt('Maintenance reason:', 'Planned maintenance');
  const mins = parseInt(prompt('Duration (minutes):', '15') || '15');
  await hub.post('/api/settings/maintenance', { reason, duration_minutes: mins });
  window._hub_panels.settings.refresh();
};
window._settings_close_mw = async () => {
  await hub.del('/api/settings/maintenance');
  window._hub_panels.settings.refresh();
};
