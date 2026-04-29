import hub from './core.js';

let _tasks = [];
let _summary = {};
let _history = [];

const _stageColors = {
  pending: '#6b7280', queued: '#3b82f6', running: '#f59e0b',
  review: '#a78bfa', done: '#22c55e', failed: '#ef4444', cancelled: '#6b7280',
};
const _stageIcons = {
  pending: '⏳', queued: '📋', running: '⚡', review: '👁️',
  done: '✅', failed: '❌', cancelled: '🚫',
};
const _prioColors = { high: '#ef4444', normal: '#f59e0b', low: '#6b7280' };

function _progressBar(pct, color) {
  return `<div style="width:100%;height:4px;background:#1f2937;border-radius:2px;overflow:hidden;margin-top:4px">
    <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width .3s"></div>
  </div>`;
}

function _stageIndicator(task) {
  const stages = ['pending','queued','running','review','done'];
  const idx = stages.indexOf(task.stage);
  return `<div style="display:flex;gap:2px;align-items:center;margin-top:6px">
    ${stages.map((s, i) => {
      const active = i === idx;
      const passed = i < idx || task.stage === 'done';
      const c = active ? _stageColors[s] : passed ? '#22c55e40' : '#1f2937';
      return `<div style="flex:1;height:3px;background:${c};border-radius:2px" title="${s}"></div>`;
    }).join('')}
  </div>`;
}

export default {
  id: 'tasks',
  label: 'Tasks',
  icon: '📋',
  section: 'Core',
  order: 30,

  async init(h) {
    hub.on('task.created', () => this._autoRefresh());
    hub.on('task.stage.changed', () => this._autoRefresh());
    hub.on('task.progress', () => this._autoRefresh());
    hub.on('task.approved', () => this._autoRefresh());
    hub.on('task.rejected', () => this._autoRefresh());
    hub.on('task.deleted', () => this._autoRefresh());
  },

  _autoRefresh() {
    if (document.getElementById('panel-tasks')) this.refresh();
  },

  async refresh() {
    const [taskRes, histRes] = await Promise.all([
      hub.get('/api/tasks'),
      hub.get('/api/tasks/history/all?limit=20'),
    ]);
    _tasks = taskRes.tasks || [];
    _summary = taskRes.summary || {};
    _history = histRes.history || [];
    const el = document.getElementById('panel-tasks');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const s = _summary;
    const needsApproval = _tasks.filter(t => t.needs_approval && !t.approved && t.stage !== 'failed');
    const active = _tasks.filter(t => ['pending','queued','running','review'].includes(t.stage));
    const completed = _tasks.filter(t => ['done','failed','cancelled'].includes(t.stage));

    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">📋 Tasks</div>
          <button class="hub-btn" onclick="window._hub_panels.tasks.refresh()">↻</button>
          <button class="hub-btn hub-btn-primary" onclick="window._task_create()">+ New Task</button>
        </div>

        <!-- Summary counters -->
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">
          ${['pending','running','review','done','failed'].map(stage => `
            <div class="hub-card" style="text-align:center;padding:8px;border-top:2px solid ${_stageColors[stage]}">
              <div style="font-size:20px;font-weight:700">${s[stage] || 0}</div>
              <div style="font-size:10px;color:var(--muted)">${_stageIcons[stage]} ${stage}</div>
            </div>`).join('')}
        </div>

        <!-- Approval Gate -->
        ${needsApproval.length > 0 ? `
          <div class="hub-card" style="margin-bottom:12px;border:1px solid #a78bfa40">
            <div class="hub-card-title" style="color:#a78bfa">🔐 Awaiting Approval (${needsApproval.length})</div>
            ${needsApproval.map(t => `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1f2937">
                <span style="font-size:12px;font-weight:600">${t.title}</span>
                <span style="font-size:10px;color:var(--muted)">${t.agent || 'unassigned'}</span>
                <span style="font-size:10px;color:${_prioColors[t.priority] || '#6b7280'}">${t.priority}</span>
                <div style="margin-left:auto;display:flex;gap:4px">
                  <button class="hub-btn hub-btn-primary" style="font-size:10px;padding:2px 8px" onclick="window._task_approve('${t.id}')">✓ Approve</button>
                  <button class="hub-btn hub-btn-warn" style="font-size:10px;padding:2px 8px" onclick="window._task_reject('${t.id}')">✗ Reject</button>
                </div>
              </div>`).join('')}
          </div>` : ''}

        <!-- Active Tasks -->
        <div class="hub-card" style="margin-bottom:12px">
          <div class="hub-card-title">Active Tasks (${active.length})</div>
          <div style="max-height:300px;overflow-y:auto;margin-top:6px">
            ${active.length === 0 ? '<div style="font-size:11px;color:var(--muted)">No active tasks</div>' : ''}
            ${active.map(t => `
              <div style="padding:8px;margin-bottom:6px;background:#0d111780;border-radius:6px;border-left:3px solid ${_stageColors[t.stage]}">
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="font-size:14px">${_stageIcons[t.stage]}</span>
                  <span style="font-size:12px;font-weight:600">${t.title}</span>
                  <span style="font-size:10px;color:${_stageColors[t.stage]}">${t.stage}</span>
                  ${t.agent ? `<span style="font-size:10px;color:#60a5fa">${t.agent}</span>` : ''}
                  <span style="font-size:10px;color:${_prioColors[t.priority]}">${t.priority}</span>
                  ${t.needs_approval ? (t.approved
                    ? '<span style="font-size:9px;color:#22c55e">✓ approved</span>'
                    : '<span style="font-size:9px;color:#f59e0b">🔒 needs approval</span>') : ''}
                  <span style="margin-left:auto;font-size:10px;color:var(--muted)">${t.progress}%</span>
                </div>
                ${t.description ? `<div style="font-size:10px;color:var(--muted);margin-top:2px">${t.description.slice(0,120)}</div>` : ''}
                ${_progressBar(t.progress, _stageColors[t.stage])}
                ${_stageIndicator(t)}
                ${t.steps && t.steps.length > 0 ? `
                  <div style="margin-top:4px;font-size:10px;color:var(--muted)">
                    Step ${(t.current_step || 0) + 1}/${t.steps.length}: ${t.steps[t.current_step] || '—'}
                  </div>` : ''}
                <div style="display:flex;gap:4px;margin-top:6px">
                  ${t.stage === 'pending' ? `<button class="hub-btn" style="font-size:9px" onclick="window._task_advance('${t.id}','queued')">→ Queue</button>` : ''}
                  ${t.stage === 'queued' ? `<button class="hub-btn" style="font-size:9px" onclick="window._task_advance('${t.id}','running')">→ Run</button>` : ''}
                  ${t.stage === 'running' ? `<button class="hub-btn" style="font-size:9px" onclick="window._task_advance('${t.id}','review')">→ Review</button>` : ''}
                  ${t.stage === 'review' ? `<button class="hub-btn hub-btn-primary" style="font-size:9px" onclick="window._task_advance('${t.id}','done')">✓ Done</button>` : ''}
                  <button class="hub-btn hub-btn-warn" style="font-size:9px" onclick="window._task_advance('${t.id}','failed')">✗ Fail</button>
                  <button class="hub-btn" style="font-size:9px" onclick="window._task_delete('${t.id}')">🗑</button>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Completed Tasks -->
        ${completed.length > 0 ? `
          <div class="hub-card" style="margin-bottom:12px">
            <div class="hub-card-title">Completed (${completed.length})</div>
            <div style="max-height:160px;overflow-y:auto;margin-top:6px">
              ${completed.slice(0, 20).map(t => `
                <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #1f2937;font-size:11px;opacity:0.7">
                  <span>${_stageIcons[t.stage]}</span>
                  <span style="font-weight:600">${t.title}</span>
                  <span style="color:${_stageColors[t.stage]}">${t.stage}</span>
                  ${t.agent ? `<span style="color:#60a5fa">${t.agent}</span>` : ''}
                  <span style="margin-left:auto;color:var(--muted)">${hub.reltime(t.completed_at || t.updated_at)}</span>
                  <button class="hub-btn" style="font-size:8px;padding:1px 4px" onclick="window._task_delete('${t.id}')">🗑</button>
                </div>`).join('')}
            </div>
          </div>` : ''}

        <!-- Task History -->
        <div class="hub-card">
          <div class="hub-card-title">Recent Activity</div>
          <div style="max-height:140px;overflow-y:auto;margin-top:6px">
            ${_history.length === 0 ? '<div style="font-size:11px;color:var(--muted)">No history</div>' : ''}
            ${_history.map(h => `
              <div style="padding:2px 0;border-bottom:1px solid #1f2937;font-size:10px">
                <span style="color:var(--muted)">${hub.reltime(h.ts)}</span>
                <span style="margin-left:4px;color:#60a5fa">${h.action}</span>
                <span style="margin-left:4px">${h.title}</span>
                ${h.detail ? `<span style="margin-left:4px;color:var(--muted)">${h.detail}</span>` : ''}
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  },
};

window._task_create = async () => {
  const title = prompt('Task title:');
  if (!title) return;
  const desc = prompt('Description (optional):', '');
  const agent = prompt('Assign to agent (optional, e.g. kc-06):', '');
  const prio = prompt('Priority (high/normal/low):', 'normal');
  const gate = confirm('Require approval before running?');
  const body = { title, description: desc || '', priority: prio || 'normal', needs_approval: gate, source: 'hub' };
  if (agent) body.agent = agent;
  await hub.post('/api/tasks', body);
  window._hub_panels.tasks.refresh();
};
window._task_advance = async (id, stage) => {
  await hub.post(`/api/tasks/${id}/stage`, { stage, by: 'user' });
  window._hub_panels.tasks.refresh();
};
window._task_approve = async (id) => {
  await hub.post(`/api/tasks/${id}/approve`, { by: 'user' });
  window._hub_panels.tasks.refresh();
};
window._task_reject = async (id) => {
  const reason = prompt('Rejection reason:', 'Rejected by user');
  await hub.post(`/api/tasks/${id}/reject`, { by: 'user', reason: reason || 'Rejected' });
  window._hub_panels.tasks.refresh();
};
window._task_delete = async (id) => {
  if (!confirm('Delete this task?')) return;
  await hub.del(`/api/tasks/${id}`);
  window._hub_panels.tasks.refresh();
};
