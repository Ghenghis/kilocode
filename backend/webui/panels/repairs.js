import hub from './core.js';

let _repairs = [];
let _summary = {};

const _sevColors = { critical: '#ef4444', error: '#f97316', warning: '#f59e0b', info: '#3b82f6' };
const _sevIcons = { critical: '🔴', error: '🟠', warning: '🟡', info: '🔵' };
const _stageColors = {
  detected: '#ef4444', diagnosed: '#f59e0b', fix_proposed: '#a78bfa',
  fix_applied: '#3b82f6', verified: '#22c55e', closed: '#6b7280',
};
const _catIcons = {
  config: '⚙️', code: '💻', dependency: '📦', runtime: '🔄',
  security: '🔒', performance: '⚡', other: '📌',
};

function _sevBadge(sev) {
  const c = _sevColors[sev] || '#6b7280';
  return `<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;background:${c}20;color:${c};border:1px solid ${c}40">${sev}</span>`;
}

function _stageBar(repair) {
  const stages = ['detected','diagnosed','fix_proposed','fix_applied','verified','closed'];
  const idx = stages.indexOf(repair.stage);
  return `<div style="display:flex;gap:2px;margin-top:6px">
    ${stages.map((s, i) => {
      const active = i === idx;
      const passed = i < idx;
      const c = active ? _stageColors[s] : passed ? '#22c55e60' : '#1f293780';
      return `<div style="flex:1;height:3px;background:${c};border-radius:2px" title="${s}"></div>`;
    }).join('')}
  </div>`;
}

export default {
  id: 'repairs',
  label: 'Repairs',
  icon: '🔧',
  section: 'Core',
  order: 40,

  async init(h) {
    hub.on('repair.created', () => this._autoRefresh());
    hub.on('repair.stage.changed', () => this._autoRefresh());
    hub.on('repair.auto_fix.applied', () => this._autoRefresh());
    hub.on('repair.deleted', () => this._autoRefresh());
    hub.on('repair.scan.complete', () => this._autoRefresh());
  },

  _autoRefresh() {
    if (document.getElementById('panel-repairs')) this.refresh();
  },

  async refresh() {
    const r = await hub.get('/api/repairs');
    _repairs = r.repairs || [];
    _summary = r.summary || {};
    const el = document.getElementById('panel-repairs');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const s = _summary;
    const open = _repairs.filter(r => !['verified','closed'].includes(r.stage));
    const fixed = _repairs.filter(r => ['verified','closed'].includes(r.stage));

    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🔧 Repairs</div>
          <button class="hub-btn" onclick="window._hub_panels.repairs.refresh()">↻</button>
          <button class="hub-btn hub-btn-primary" onclick="window._repair_scan()">🔍 Auto-Scan</button>
          <button class="hub-btn" onclick="window._repair_create()">+ New Repair</button>
        </div>

        <!-- Summary -->
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">
          ${[{l:'Critical',v:s.critical||0,c:'#ef4444'},{l:'Error',v:s.error||0,c:'#f97316'},
             {l:'Warning',v:s.warning||0,c:'#f59e0b'},{l:'Open',v:s.open||0,c:'#3b82f6'},
             {l:'Fixed',v:s.fixed||0,c:'#22c55e'}].map(x => `
            <div class="hub-card" style="text-align:center;padding:8px;border-top:2px solid ${x.c}">
              <div style="font-size:20px;font-weight:700">${x.v}</div>
              <div style="font-size:10px;color:var(--muted)">${x.l}</div>
            </div>`).join('')}
        </div>

        <!-- Open Repairs Timeline -->
        <div class="hub-card" style="margin-bottom:12px">
          <div class="hub-card-title">Open Repairs (${open.length})</div>
          <div style="max-height:400px;overflow-y:auto;margin-top:6px">
            ${open.length === 0 ? '<div style="font-size:11px;color:#22c55e">✓ No open repairs</div>' : ''}
            ${open.map(r => `
              <div style="padding:10px;margin-bottom:8px;background:#0d111780;border-radius:6px;border-left:3px solid ${_sevColors[r.severity]}">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span style="font-size:14px">${_sevIcons[r.severity]}</span>
                  ${_sevBadge(r.severity)}
                  <span style="font-size:12px;font-weight:600">${r.title}</span>
                  <span style="font-size:10px;color:${_stageColors[r.stage]}">${r.stage}</span>
                  <span style="font-size:10px;color:var(--muted)">${_catIcons[r.category] || ''} ${r.category}</span>
                  ${r.agent ? `<span style="font-size:10px;color:#60a5fa">${r.agent}</span>` : ''}
                </div>
                ${r.description ? `<div style="font-size:10px;color:var(--muted);margin-top:3px">${r.description.slice(0,150)}</div>` : ''}
                ${r.file ? `<div style="font-size:10px;margin-top:2px;font-family:monospace;color:#60a5fa">${r.file}${r.line ? ':' + r.line : ''}</div>` : ''}
                ${_stageBar(r)}

                <!-- Fix suggestion -->
                ${r.fix_suggestion ? `
                  <div style="margin-top:6px;padding:6px;background:#1e293b;border-radius:4px;font-size:10px">
                    <span style="color:#22c55e">💡 Fix:</span> <span style="color:var(--muted)">${r.fix_suggestion}</span>
                    ${r.auto_fixable ? `<button class="hub-btn hub-btn-primary" style="font-size:9px;margin-left:8px" onclick="window._repair_autofix('${r.id}')">⚡ Auto-fix</button>` : ''}
                  </div>` : ''}

                <!-- Timeline -->
                <div style="margin-top:6px">
                  ${r.timeline.slice(-3).map(t => `
                    <div style="font-size:9px;color:var(--muted);padding:1px 0">
                      ${hub.reltime(t.ts)} · <span style="color:${_stageColors[t.stage]}">${t.stage}</span> · ${t.by} ${t.detail ? '· ' + t.detail.slice(0,60) : ''}
                    </div>`).join('')}
                </div>

                <!-- Actions -->
                <div style="display:flex;gap:4px;margin-top:6px">
                  ${r.stage === 'detected' ? `<button class="hub-btn" style="font-size:9px" onclick="window._repair_advance('${r.id}','diagnosed')">→ Diagnosed</button>` : ''}
                  ${r.stage === 'diagnosed' ? `<button class="hub-btn" style="font-size:9px" onclick="window._repair_advance('${r.id}','fix_proposed')">→ Fix Proposed</button>` : ''}
                  ${r.stage === 'fix_proposed' ? `<button class="hub-btn" style="font-size:9px" onclick="window._repair_advance('${r.id}','fix_applied')">→ Fix Applied</button>` : ''}
                  ${r.stage === 'fix_applied' ? `<button class="hub-btn hub-btn-primary" style="font-size:9px" onclick="window._repair_advance('${r.id}','verified')">✓ Verified</button>` : ''}
                  <button class="hub-btn" style="font-size:9px" onclick="window._repair_advance('${r.id}','closed')">Close</button>
                  <button class="hub-btn" style="font-size:9px" onclick="window._repair_delete('${r.id}')">🗑</button>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Fixed / Closed -->
        ${fixed.length > 0 ? `
          <div class="hub-card">
            <div class="hub-card-title">Resolved (${fixed.length})</div>
            <div style="max-height:140px;overflow-y:auto;margin-top:6px">
              ${fixed.slice(0, 20).map(r => `
                <div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #1f2937;font-size:11px;opacity:0.6">
                  <span>${_sevIcons[r.severity]}</span>
                  <span>${r.title}</span>
                  <span style="color:${_stageColors[r.stage]}">${r.stage}</span>
                  <span style="margin-left:auto;color:var(--muted)">${hub.reltime(r.closed_at || r.updated_at)}</span>
                  <button class="hub-btn" style="font-size:8px;padding:1px 4px" onclick="window._repair_delete('${r.id}')">🗑</button>
                </div>`).join('')}
            </div>
          </div>` : ''}
      </div>`;
  },
};

window._repair_scan = async () => {
  const r = await hub.post('/api/repairs/scan');
  alert(`Scan complete: ${r.found || 0} issues found`);
  window._hub_panels.repairs.refresh();
};
window._repair_create = async () => {
  const title = prompt('Repair title:');
  if (!title) return;
  const sev = prompt('Severity (critical/error/warning/info):', 'warning');
  const cat = prompt('Category (config/code/dependency/runtime/security/performance):', 'config');
  const desc = prompt('Description:', '');
  const fix = prompt('Fix suggestion (optional):', '');
  const body = { title, severity: sev || 'warning', category: cat || 'other', description: desc || '' };
  if (fix) { body.fix_suggestion = fix; body.auto_fixable = false; }
  await hub.post('/api/repairs', body);
  window._hub_panels.repairs.refresh();
};
window._repair_advance = async (id, stage) => {
  const detail = prompt(`Detail for stage "${stage}" (optional):`, '');
  await hub.post(`/api/repairs/${id}/stage`, { stage, by: 'user', detail: detail || '' });
  window._hub_panels.repairs.refresh();
};
window._repair_autofix = async (id) => {
  if (!confirm('Apply auto-fix for this repair?')) return;
  await hub.post(`/api/repairs/${id}/auto-fix`);
  window._hub_panels.repairs.refresh();
};
window._repair_delete = async (id) => {
  if (!confirm('Delete this repair?')) return;
  await hub.del(`/api/repairs/${id}`);
  window._hub_panels.repairs.refresh();
};
