import hub from './core.js';

let _roadmap = null;
let _summary = null;

const _statusColors = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  not_started: '#6b7280',
};

const _statusIcons = {
  completed: '✓',
  in_progress: '●',
  not_started: '○',
};

export default {
  id: 'roadmap',
  label: 'Roadmap',
  icon: '🗺️',
  section: 'Hub',
  order: 5,

  async init(h) {
    hub.on('roadmap.task.toggled', () => this.refresh());
    hub.on('roadmap.task.assigned', () => this.refresh());
  },

  async refresh() {
    const [roadmapR, summaryR] = await Promise.all([
      hub.get('/api/roadmap/'),
      hub.get('/api/roadmap/summary'),
    ]);
    _roadmap = roadmapR.roadmap;
    _summary = summaryR;
    const el = document.getElementById('panel-roadmap');
    if (el) el.innerHTML = this.render();
  },

  render() {
    if (!_roadmap || !_summary) {
      return `<div style="padding:16px"><div class="hub-card">Loading roadmap...</div></div>`;
    }

    const phases = _roadmap.phases || [];
    
    return `
      <div style="padding:16px">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🗺️ Roadmap</div>
          <span style="font-size:12px;color:var(--muted)">
            ${_summary.completed_phases}/${_summary.total_phases} phases · 
            ${_summary.overall_progress}% complete
          </span>
          <button class="hub-btn" onclick="window._hub_panels.roadmap.refresh()">↻</button>
        </div>

        <!-- Progress Bar -->
        <div style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">
            <span>Overall Progress</span>
            <span>${_summary.overall_progress}%</span>
          </div>
          <div style="background:#2a2a2a;border-radius:8px;height:12px;overflow:hidden">
            <div style="background:linear-gradient(90deg,#22c55e,#3b82f6);height:100%;width:${_summary.overall_progress}%;transition:width 0.3s"></div>
          </div>
        </div>

        <!-- Phase Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
          ${phases.map(p => this._renderPhase(p)).join('')}
        </div>
      </div>`;
  },

  _renderPhase(phase) {
    const doneCount = phase.tasks.filter(t => t.done).length;
    const totalCount = phase.tasks.length;
    
    return `
      <div class="hub-card" style="padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="color:${_statusColors[phase.status]}">${_statusIcons[phase.status]}</span>
            <span style="font-weight:600;font-size:14px">Phase ${phase.number}</span>
          </div>
          <span style="font-size:11px;color:var(--muted)">${doneCount}/${totalCount}</span>
        </div>
        
        <div style="font-size:13px;font-weight:500;margin-bottom:8px">${phase.name}</div>
        
        <!-- Phase Progress Bar -->
        <div style="background:#2a2a2a;border-radius:4px;height:6px;overflow:hidden;margin-bottom:12px">
          <div style="background:${_statusColors[phase.status]};height:100%;width:${phase.progress}%"></div>
        </div>
        
        <!-- Task List -->
        <div style="display:flex;flex-direction:column;gap:4px">
          ${phase.tasks.map(t => `
            <div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:#1a1a1a;border-radius:4px;font-size:11px">
              <input 
                type="checkbox" 
                ${t.done ? 'checked' : ''} 
                onchange="window._roadmap_toggle('${t.id}')"
                style="cursor:pointer"
              />
              <span style="${t.done ? 'text-decoration:line-through;opacity:0.6' : ''};flex:1">${t.text}</span>
              <span style="color:var(--muted);font-size:10px">${t.owner}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  },
};

window._roadmap_toggle = async (taskId) => {
  await hub.post(`/api/roadmap/tasks/${taskId}/toggle`, { by: 'hub_user' });
  window._hub_panels.roadmap.refresh();
};
