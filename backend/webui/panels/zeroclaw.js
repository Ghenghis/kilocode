import hub from './core.js';

let _tasks = [];

export default {
  id: 'zeroclaw',
  label: 'ZeroClaw',
  icon: '⚡',
  section: 'Pipelines',
  order: 20,

  async init(h) {
    hub.on('kom.session.started', () => { if (document.getElementById('panel-zeroclaw')) this.refresh(); });
  },

  async refresh() {
    const r = await hub.get('/api/settings/kilocode/zeroclaw/tasks');
    _tasks = r.tasks || [];
    const el = document.getElementById('panel-zeroclaw');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const active = _tasks.filter(t => ['pending','running','waiting_approval'].includes(t.status));
    const done = _tasks.filter(t => ['completed','done'].includes(t.status));
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">⚡ ZeroClaw</div>
          <span style="font-size:12px;color:var(--muted)">${active.length} active · ${done.length} completed</span>
          <button class="hub-btn" onclick="window._hub_panels.zeroclaw.refresh()">↻</button>
          <button class="hub-btn hub-btn-primary" onclick="window._zc_submit()">+ New Task</button>
        </div>
        ${active.length === 0 ? '<div style="color:var(--muted);font-size:12px">No active tasks</div>' : ''}
        ${active.map(t => `
          <div class="hub-card" style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-weight:600;font-size:12px">${t.id}</div>
              <div>${hub.badge(t.status)}</div>
            </div>
            <div style="font-size:11px;margin-top:4px;color:var(--muted)">${t.description || ''}</div>
            <div style="display:flex;gap:6px;margin-top:6px">
              ${t.status === 'waiting_approval'
                ? `<button class="hub-btn hub-btn-primary" onclick="window._zc_approve('${t.id}')">✓ Approve</button>
                   <button class="hub-btn hub-btn-warn" onclick="window._zc_reject('${t.id}')">✗ Reject</button>`
                : `<button class="hub-btn hub-btn-warn" onclick="window._zc_cancel('${t.id}')">✗ Cancel</button>`
              }
            </div>
          </div>`).join('')}
        ${done.length > 0 ? `<div style="margin-top:12px;font-size:11px;color:var(--muted)">${done.length} completed tasks (not shown)</div>` : ''}
      </div>`;
  },
};

window._zc_submit = async () => {
  const desc = prompt('ZeroClaw task description:');
  if (!desc) return;
  await hub.post('/api/settings/kilocode/zeroclaw/tasks', { description: desc });
  window._hub_panels.zeroclaw.refresh();
};
window._zc_approve = async (id) => {
  await hub.post(`/api/settings/kilocode/zeroclaw/tasks/${id}/approve`);
  window._hub_panels.zeroclaw.refresh();
};
window._zc_reject = async (id) => {
  await hub.post(`/api/settings/kilocode/zeroclaw/tasks/${id}/reject`);
  window._hub_panels.zeroclaw.refresh();
};
window._zc_cancel = async (id) => {
  await hub.post(`/api/settings/kilocode/zeroclaw/tasks/${id}/cancel`);
  window._hub_panels.zeroclaw.refresh();
};
