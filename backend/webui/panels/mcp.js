import hub from './core.js';

let _servers = [];
let _tools = [];
let _logs = [];
let _selectedServer = null;

const _approvalColors = {
  approved: '#22c55e',
  pending: '#f59e0b',
  denied: '#ef4444',
};

export default {
  id: 'mcp',
  label: 'MCP',
  icon: '🔌',
  section: 'Infrastructure',
  order: 35,

  async init(h) {
    hub.on('mcp.server.enabled', () => this.refresh());
    hub.on('mcp.server.disabled', () => this.refresh());
    hub.on('mcp.tool.approved', () => this.refresh());
    hub.on('mcp.tool.denied', () => this.refresh());
    hub.on('mcp.log', (e) => {
      _logs.unshift(e);
      if (_logs.length > 100) _logs.pop();
      if (document.getElementById('panel-mcp')) this.refresh();
    });
  },

  async refresh() {
    const [serversR, toolsR, logsR] = await Promise.all([
      hub.get('/api/mcp/servers'),
      hub.get('/api/mcp/tools'),
      hub.get('/api/mcp/logs?limit=50'),
    ]);
    _servers = serversR.servers || [];
    _tools = toolsR.tools || [];
    _logs = logsR.logs || [];
    const el = document.getElementById('panel-mcp');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const healthy = _servers.filter(s => s.status === 'healthy').length;
    const total = _servers.length;
    
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🔌 MCP</div>
          <span style="font-size:12px;color:var(--muted)">${healthy}/${total} healthy</span>
          <button class="hub-btn" onclick="window._hub_panels.mcp.refresh()">↻</button>
        </div>

        <!-- Servers Grid -->
        <div style="margin-bottom:18px">
          <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Servers</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
            ${_servers.map(s => `
              <div class="hub-card" style="padding:10px;${s.enabled ? '' : 'opacity:0.6'}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div style="font-weight:600;font-size:14px">${s.name}</div>
                  <div>${hub.badge(s.status)}</div>
                </div>
                <div style="font-size:11px;color:var(--muted);margin-top:4px">${s.tool_count} tools · ${s.last_check_rel}</div>
                <div style="display:flex;gap:6px;margin-top:8px">
                  ${s.enabled 
                    ? `<button class="hub-btn hub-btn-warn" style="font-size:10px;padding:2px 8px" onclick="window._mcp_disable('${s.id}')">Disable</button>`
                    : `<button class="hub-btn" style="font-size:10px;padding:2px 8px" onclick="window._mcp_enable('${s.id}')">Enable</button>`
                  }
                  <button class="hub-btn" style="font-size:10px;padding:2px 8px" onclick="window._mcp_select('${s.id}')">Tools</button>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Tools Section -->
        ${_selectedServer ? this._renderTools() : this._renderAllTools()}

        <!-- Logs Stream -->
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Recent Logs</div>
          <div style="border:1px solid var(--border);border-radius:6px;max-height:200px;overflow-y:auto;background:#1a1a1a;padding:8px;font-family:monospace;font-size:11px">
            ${_logs.map(l => `
              <div style="display:flex;gap:8px;padding:2px 0;border-bottom:1px solid #333">
                <span style="color:var(--muted);white-space:nowrap">${new Date(l.ts * 1000).toLocaleTimeString()}</span>
                <span style="color:${_levelColor(l.level)};text-transform:uppercase;font-size:10px;width:40px">${l.level}</span>
                <span>${l.message}</span>
              </div>`).join('')}
            ${_logs.length === 0 ? '<div style="color:var(--muted)">No recent MCP logs</div>' : ''}
          </div>
        </div>
      </div>`;
  },

  _renderAllTools() {
    const summary = { approved: 0, pending: 0, denied: 0 };
    _tools.forEach(t => summary[t.approval]++);
    
    return `
      <div style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Tools</div>
          <div style="font-size:11px">
            <span style="color:#22c55e">● ${summary.approved} approved</span>
            <span style="color:#f59e0b;margin-left:8px">● ${summary.pending} pending</span>
            <span style="color:#ef4444;margin-left:8px">● ${summary.denied} denied</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
          ${_tools.map(t => `
            <div class="hub-card" style="padding:8px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:600;font-size:12px">${t.name}</div>
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${_approvalColors[t.approval]}"></span>
              </div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${t.server}</div>
              <div style="font-size:10px;color:var(--muted)">${t.usage_count} uses</div>
              <div style="display:flex;gap:4px;margin-top:6px">
                ${t.approval !== 'approved' ? `<button class="hub-btn" style="font-size:9px;padding:1px 6px" onclick="window._mcp_approve('${t.id}')">Approve</button>` : ''}
                ${t.approval !== 'denied' ? `<button class="hub-btn hub-btn-warn" style="font-size:9px;padding:1px 6px" onclick="window._mcp_deny('${t.id}')">Deny</button>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  _renderTools() {
    const serverTools = _tools.filter(t => t.server === _selectedServer);
    const server = _servers.find(s => s.id === _selectedServer);
    
    return `
      <div style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">
            Tools: ${server?.name || _selectedServer}
            <button class="hub-btn" style="font-size:10px;padding:2px 8px;margin-left:8px" onclick="window._mcp_clear_select()">Show All</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
          ${serverTools.map(t => `
            <div class="hub-card" style="padding:8px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:600;font-size:12px">${t.name}</div>
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${_approvalColors[t.approval]}"></span>
              </div>
              <div style="font-size:10px;color:var(--muted)">${t.usage_count} uses</div>
              <div style="display:flex;gap:4px;margin-top:6px">
                ${t.approval !== 'approved' ? `<button class="hub-btn" style="font-size:9px;padding:1px 6px" onclick="window._mcp_approve('${t.id}')">Approve</button>` : ''}
                ${t.approval !== 'denied' ? `<button class="hub-btn hub-btn-warn" style="font-size:9px;padding:1px 6px" onclick="window._mcp_deny('${t.id}')">Deny</button>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  },
};

function _levelColor(level) {
  const colors = {
    info: '#3b82f6',
    warning: '#f59e0b',
    error: '#ef4444',
  };
  return colors[level] || 'var(--muted)';
}

window._mcp_enable = async (id) => {
  await hub.post(`/api/mcp/servers/${id}/enable`);
  window._hub_panels.mcp.refresh();
};

window._mcp_disable = async (id) => {
  await hub.post(`/api/mcp/servers/${id}/disable`);
  window._hub_panels.mcp.refresh();
};

window._mcp_select = (id) => {
  _selectedServer = id;
  window._hub_panels.mcp.refresh();
};

window._mcp_clear_select = () => {
  _selectedServer = null;
  window._hub_panels.mcp.refresh();
};

window._mcp_approve = async (toolId) => {
  await hub.post(`/api/mcp/tools/${toolId}/approve`, { approved_by: 'hub_user' });
  window._hub_panels.mcp.refresh();
};

window._mcp_deny = async (toolId) => {
  await hub.post(`/api/mcp/tools/${toolId}/deny`, { denied_by: 'hub_user' });
  window._hub_panels.mcp.refresh();
};
