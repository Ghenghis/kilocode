import hub from './core.js';

let _state = null;
let _threads = [];
let _agents = [];
let _approvals = [];
let _activity = [];
let _selectedThread = null;

const _statusColors = {
  online: '#22c55e',
  idle: '#6b7280',
  busy: '#f59e0b',
  offline: '#ef4444',
};

const _riskColors = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
};

export default {
  id: 'warroom',
  label: 'War Room',
  icon: '🏛️',
  section: 'Collaboration',
  order: 10,

  async init(h) {
    hub.on('warroom.thread.created', () => this.refresh());
    hub.on('warroom.message', () => this.refresh());
    hub.on('warroom.approval.resolved', () => this.refresh());
    hub.on('warroom.activity', () => this.refresh());
    hub.on('warroom.agent.heartbeat', () => this.refresh());
    
    // Auto-refresh every 10 seconds
    setInterval(() => {
      if (document.getElementById('panel-warroom')) {
        this.refresh();
      }
    }, 10000);
  },

  async refresh() {
    const [stateR, threadsR, agentsR, approvalsR, activityR] = await Promise.all([
      hub.get('/api/warroom/state'),
      hub.get('/api/warroom/threads?active_only=false'),
      hub.get('/api/warroom/agents'),
      hub.get('/api/warroom/approvals'),
      hub.get('/api/warroom/activity?limit=20'),
    ]);
    
    _state = stateR.state;
    _threads = threadsR.threads || [];
    _agents = agentsR.agents || [];
    _approvals = approvalsR.approvals || [];
    _activity = activityR.activity || [];
    
    const el = document.getElementById('panel-warroom');
    if (el) el.innerHTML = this.render();
  },

  render() {
    if (!_state) {
      return `<div style="padding:16px"><div class="hub-card">Loading War Room...</div></div>`;
    }

    return `
      <div style="padding:16px">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🏛️ War Room</div>
          <span style="font-size:12px;color:var(--muted)">
            ${_agents.filter(a => a.online).length}/${_agents.length} agents · 
            ${_approvals.length} pending approvals
          </span>
          <button class="hub-btn" onclick="window._hub_panels.warroom.refresh()">↻</button>
        </div>

        <!-- Dashboard Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
          <div class="hub-card" style="padding:10px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:#22c55e">${_agents.filter(a => a.online).length}</div>
            <div style="font-size:11px;color:var(--muted)">Online Agents</div>
          </div>
          <div class="hub-card" style="padding:10px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:${_approvals.length > 0 ? '#f59e0b' : '#22c55e'}">${_approvals.length}</div>
            <div style="font-size:11px;color:var(--muted)">Pending Approvals</div>
          </div>
          <div class="hub-card" style="padding:10px;text-align:center">
            <div style="font-size:22px;font-weight:700">${_threads.filter(t => !t.closed).length}</div>
            <div style="font-size:11px;color:var(--muted)">Active Threads</div>
          </div>
          <div class="hub-card" style="padding:10px;text-align:center">
            <div style="font-size:22px;font-weight:700">${_activity.length}</div>
            <div style="font-size:11px;color:var(--muted)">Recent Events</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Left Column: Agents & Approvals -->
          <div>
            <!-- Agents -->
            <div style="margin-bottom:16px">
              <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Agent Presence</div>
              <div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:4px">
                ${_agents.map(a => `
                  <div style="text-align:center;padding:6px;background:${a.online ? '#22c55e20' : '#ef444420'};border-radius:4px" title="${a.id}: ${a.status}">
                    <div style="font-size:10px;font-weight:600">${a.id}</div>
                    <div style="font-size:8px;color:var(--muted)">${a.online ? '●' : '○'}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Pending Approvals -->
            <div style="margin-bottom:16px">
              <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
                Pending Approvals (${_approvals.length})
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${_approvals.slice(0, 5).map(a => `
                  <div class="hub-card" style="padding:8px;border-left:3px solid ${_riskColors[a.risk_level]}">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                      <span style="font-size:11px;font-weight:600">${a.requester_id}</span>
                      <span style="font-size:10px;padding:1px 6px;border-radius:3px;background:${_riskColors[a.risk_level]}40;color:${_riskColors[a.risk_level]}">${a.risk_level}</span>
                    </div>
                    <div style="font-size:10px;color:var(--muted);margin-top:2px">${a.action_type} · ${a.resource_id.slice(0, 30)}</div>
                    <div style="font-size:10px;color:var(--muted)">⏱ ${Math.floor(a.time_remaining)}s remaining</div>
                    <div style="display:flex;gap:4px;margin-top:6px">
                      <button class="hub-btn" style="font-size:9px;padding:1px 6px" onclick="window._warroom_approve('${a.request_id}')">Approve</button>
                      <button class="hub-btn hub-btn-warn" style="font-size:9px;padding:1px 6px" onclick="window._warroom_deny('${a.request_id}')">Deny</button>
                    </div>
                  </div>
                `).join('')}
                ${_approvals.length === 0 ? '<div style="font-size:11px;color:var(--muted)">No pending approvals</div>' : ''}
              </div>
            </div>

            <!-- Recent Activity -->
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Activity Stream</div>
              <div style="border:1px solid var(--border);border-radius:6px;max-height:150px;overflow-y:auto;background:#1a1a1a;padding:8px">
                ${_activity.slice(0, 10).map(a => `
                  <div style="display:flex;gap:8px;padding:2px 0;border-bottom:1px solid #333;font-size:10px">
                    <span style="color:var(--muted);white-space:nowrap">${new Date(a.ts * 1000).toLocaleTimeString()}</span>
                    <span style="color:#3b82f6">${a.actor}</span>
                    <span>${a.type}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Right Column: Collaboration Threads -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Collaboration Threads</div>
              <button class="hub-btn" style="font-size:10px;padding:2px 8px" onclick="window._warroom_new_thread()">+ New</button>
            </div>
            
            ${!_selectedThread ? `
              <!-- Thread List -->
              <div style="display:flex;flex-direction:column;gap:6px">
                ${_threads.map(t => `
                  <div class="hub-card" style="padding:8px;${t.closed ? 'opacity:0.6' : ''}" onclick="window._warroom_select_thread('${t.id}')">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                      <span style="font-size:12px;font-weight:600">${t.title}</span>
                      <span style="font-size:10px;color:var(--muted)">${t.message_count} msgs</span>
                    </div>
                    <div style="font-size:10px;color:var(--muted);margin-top:2px">
                      by ${t.created_by} · ${t.participant_count} participants
                    </div>
                  </div>
                `).join('')}
                ${_threads.length === 0 ? '<div style="font-size:11px;color:var(--muted)">No threads yet</div>' : ''}
              </div>
            ` : `
              <!-- Thread View -->
              <div>
                ${this._renderThreadView()}
              </div>
            `}
          </div>
        </div>
      </div>`;
  },

  _renderThreadView() {
    const thread = _threads.find(t => t.id === _selectedThread);
    if (!thread) {
      _selectedThread = null;
      return '';
    }

    return `
      <div class="hub-card" style="padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-weight:600">${thread.title}</span>
          <button class="hub-btn" style="font-size:10px;padding:2px 8px" onclick="window._warroom_back()">← Back</button>
        </div>
        
        <!-- Messages -->
        <div style="border:1px solid var(--border);border-radius:6px;max-height:300px;overflow-y:auto;background:#1a1a1a;padding:12px;margin-bottom:12px">
          ${(thread.messages || []).map(m => `
            <div style="margin-bottom:12px;padding:8px;background:#2a2a2a;border-radius:4px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="font-size:11px;font-weight:600;color:${m.sender_type === 'agent' ? '#22c55e' : '#3b82f6'}">${m.sender}</span>
                <span style="font-size:9px;color:var(--muted)">${new Date(m.timestamp * 1000).toLocaleTimeString()}</span>
              </div>
              <div style="font-size:11px;white-space:pre-wrap">${m.content}</div>
              ${m.type !== 'text' ? `<span style="font-size:9px;color:var(--muted)">${m.type}</span>` : ''}
            </div>
          `).join('')}
          ${(thread.messages || []).length === 0 ? '<div style="font-size:11px;color:var(--muted)">No messages yet</div>' : ''}
        </div>
        
        <!-- Message Input -->
        <div style="display:flex;gap:8px">
          <input 
            type="text" 
            id="warroom-message-input" 
            placeholder="Type a message..."
            style="flex:1;padding:6px 10px;background:#2a2a2a;border:1px solid var(--border);border-radius:4px;color:inherit;font-size:12px"
            onkeypress="if(event.key==='Enter')window._warroom_send('${thread.id}')"
          />
          <button class="hub-btn" style="font-size:10px;padding:2px 12px" onclick="window._warroom_send('${thread.id}')">Send</button>
        </div>
      </div>
    `;
  },
};

window._warroom_select_thread = (id) => {
  _selectedThread = id;
  window._hub_panels.warroom.refresh();
};

window._warroom_back = () => {
  _selectedThread = null;
  window._hub_panels.warroom.refresh();
};

window._warroom_new_thread = async () => {
  const title = prompt('Thread title:');
  if (!title) return;
  
  await hub.post('/api/warroom/threads', {
    title,
    created_by: 'hub_user',
  });
  window._hub_panels.warroom.refresh();
};

window._warroom_send = async (threadId) => {
  const input = document.getElementById('warroom-message-input');
  if (!input || !input.value.trim()) return;
  
  await hub.post(`/api/warroom/threads/${threadId}/message`, {
    sender: 'hub_user',
    sender_type: 'user',
    content: input.value.trim(),
  });
  
  input.value = '';
  window._hub_panels.warroom.refresh();
};

window._warroom_approve = async (requestId) => {
  await hub.post(`/api/warroom/approvals/${requestId}/resolve`, {
    resolution: 'approved',
    resolver_id: 'hub_user',
  });
  window._hub_panels.warroom.refresh();
};

window._warroom_deny = async (requestId) => {
  const reason = prompt('Reason for denial:');
  await hub.post(`/api/warroom/approvals/${requestId}/resolve`, {
    resolution: 'denied',
    resolver_id: 'hub_user',
    reason: reason || '',
  });
  window._hub_panels.warroom.refresh();
};
