import hub from './core.js';

let _status = {};
let _events = [];

export default {
  id: 'pipeline',
  label: 'Pipeline',
  icon: '🔀',
  section: 'Pipelines',
  order: 25,

  async init(h) {
    hub.on('kom.session.started', () => { if (document.getElementById('panel-pipeline')) this.refresh(); });
    hub.on('kom.session.completed', () => { if (document.getElementById('panel-pipeline')) this.refresh(); });
    hub.on('agent.assigned', () => { if (document.getElementById('panel-pipeline')) this.refresh(); });
  },

  async refresh() {
    const [s, e] = await Promise.all([
      hub.get('/api/pipeline/status'),
      hub.get('/api/pipeline/events?limit=30'),
    ]);
    _status = s;
    _events = e.events || [];
    const el = document.getElementById('panel-pipeline');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const s = _status;
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🔀 Pipeline</div>
          <button class="hub-btn" onclick="window._hub_panels.pipeline.refresh()">↻</button>
          <button class="hub-btn hub-btn-primary" onclick="window._kom_start()">+ KOM Session</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
          <div class="hub-card" style="text-align:center">
            <div style="font-size:20px;font-weight:700">${s.zeroclaw_queue || 0}</div>
            <div style="font-size:10px;color:var(--muted)">ZC Queue</div>
          </div>
          <div class="hub-card" style="text-align:center">
            <div style="font-size:20px;font-weight:700">${s.zeroclaw_active || 0}</div>
            <div style="font-size:10px;color:var(--muted)">ZC Active</div>
          </div>
          <div class="hub-card" style="text-align:center">
            <div style="font-size:20px;font-weight:700">${s.events_buffered || 0}</div>
            <div style="font-size:10px;color:var(--muted)">Events</div>
          </div>
          <div class="hub-card" style="text-align:center">
            <div style="font-size:20px;font-weight:700">${s.services ? Object.values(s.services).filter(Boolean).length : 0}/${s.services ? Object.keys(s.services).length : 0}</div>
            <div style="font-size:10px;color:var(--muted)">Services</div>
          </div>
        </div>
        <div class="hub-card">
          <div class="hub-card-title">Recent Events</div>
          <div style="max-height:240px;overflow-y:auto;margin-top:6px">
            ${_events.length === 0 ? '<div style="color:var(--muted);font-size:11px">No events</div>' : ''}
            ${_events.map(e => `
              <div style="display:flex;gap:8px;font-size:11px;padding:3px 0;border-bottom:1px solid #1f2937">
                <span style="color:var(--muted);flex-shrink:0">${hub.reltime(e.ts)}</span>
                <span style="color:#60a5fa;flex-shrink:0">${e.agent || 'sys'}</span>
                <span style="color:#a78bfa;flex-shrink:0">${e.type}</span>
                <span style="color:var(--muted)">${e.detail || ''}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  },
};

window._kom_start = async () => {
  const goal = prompt('KOM session goal:');
  if (!goal) return;
  const modes = ['custom','codebase_audit','project_kickoff'];
  const mode = prompt(`Mode (${modes.join('/')}):`, 'custom');
  await hub.post('/api/kom/sessions', { goal, mode: mode || 'custom' });
  window._hub_panels.pipeline.refresh();
};
