import hub from './core.js';

let _providers = [];
let _detected = [];
let _profiles = [];

const _toneColors = {
  positive: '#22c55e', warning: '#f59e0b', critical: '#ef4444', neutral: '#6b7280',
};

function _toneBadge(tone, label) {
  const c = _toneColors[tone] || _toneColors.neutral;
  return `<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;background:${c}20;color:${c};border:1px solid ${c}40">${label}</span>`;
}

export default {
  id: 'providers',
  label: 'Providers',
  icon: '⚙️',
  section: 'Infrastructure',
  order: 40,

  async init(h) {
    hub.on('provider.circuit.reset', () => { if (document.getElementById('panel-providers')) this.refresh(); });
    hub.on('provider.failover.forced', () => { if (document.getElementById('panel-providers')) this.refresh(); });
    hub.on('provider.profile.saved', () => { if (document.getElementById('panel-providers')) this.refresh(); });
    hub.on('provider.profile.deleted', () => { if (document.getElementById('panel-providers')) this.refresh(); });
  },

  async refresh() {
    const [statusR, detectR, profilesR] = await Promise.all([
      hub.get('/api/providers/status'),
      hub.get('/api/providers/detect'),
      hub.get('/api/providers/profiles'),
    ]);
    _providers = statusR.providers || [];
    _detected = detectR.detected || [];
    _profiles = profilesR.profiles || [];
    const el = document.getElementById('panel-providers');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const online = _providers.filter(p => p.ok).length;
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">⚙️ Providers</div>
          <span style="font-size:12px;color:var(--muted)">${online}/${_providers.length} online</span>
          <button class="hub-btn" onclick="window._hub_panels.providers.refresh()">↻ Refresh</button>
        </div>

        <!-- Auto-Detected Providers -->
        <div style="margin-bottom:18px">
          <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Auto-Detected</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
            ${_detected.map(d => `
              <div class="hub-card">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div style="font-weight:600;font-size:14px">${d.label}</div>
                  ${_toneBadge(d.tone, d.tone)}
                </div>
                <div style="margin-top:4px;font-size:11px;color:var(--muted)">${d.detail || ''}</div>
                ${d.baseUrl ? `<div style="margin-top:2px;font-size:10px;color:var(--muted)"><code>${d.baseUrl}</code></div>` : ''}
                ${d.model ? `<div style="font-size:10px;color:var(--muted)">Model: ${d.model}</div>` : ''}
                <div style="font-size:10px;color:var(--muted);margin-top:2px">Source: ${d.source}${d.env_key ? ` (${d.env_key})` : ''}${d.provider_id ? ` · ID: ${d.provider_id}` : ''}</div>
              </div>`).join('')}
            ${_detected.length === 0 ? '<div style="font-size:12px;color:var(--muted)">No providers auto-detected from env/config.</div>' : ''}
          </div>
        </div>

        <!-- Health Status -->
        <div style="margin-bottom:18px">
          <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Health & Circuits</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
            ${_providers.map(p => `
              <div class="hub-card">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div style="font-weight:600;font-size:13px">${p.provider}</div>
                  <div>${hub.badge(p.ok ? 'ok' : 'error')}</div>
                </div>
                <div style="margin-top:4px;font-size:11px;color:var(--muted)">
                  Circuit: ${hub.badge(p.circuit)}
                  ${p.latency_ms != null ? `· ${p.latency_ms}ms` : ''}
                </div>
                ${p.last_ok ? `<div style="font-size:10px;color:var(--muted)">Last ok: ${hub.reltime(p.last_ok)}</div>` : ''}
                <div style="display:flex;gap:6px;margin-top:8px">
                  <button class="hub-btn" style="font-size:10px;padding:2px 8px" onclick="window._prov_reset('${p.provider}')">Reset Circuit</button>
                  <button class="hub-btn hub-btn-warn" style="font-size:10px;padding:2px 8px" onclick="window._prov_failover('${p.provider}')">Failover</button>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Saved Profiles -->
        <div style="margin-bottom:18px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Saved Profiles</div>
            <button class="hub-btn" style="font-size:10px;padding:2px 8px" onclick="window._prov_showAddProfile()">+ Add</button>
          </div>
          <div id="prov-add-form" style="display:none;margin-bottom:10px">
            <div class="hub-card" style="display:flex;flex-direction:column;gap:6px;max-width:400px">
              <input id="prov-name" placeholder="Profile name" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:12px">
              <input id="prov-url" placeholder="Base URL (e.g. https://api.minimaxi.chat/v1)" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:12px">
              <input id="prov-model" placeholder="Model (optional)" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:12px">
              <input id="prov-key" placeholder="API Key (optional)" type="password" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:12px">
              <div style="display:flex;gap:6px">
                <button class="hub-btn hub-btn-primary" style="font-size:11px" onclick="window._prov_saveProfile()">Save</button>
                <button class="hub-btn" style="font-size:11px" onclick="document.getElementById('prov-add-form').style.display='none'">Cancel</button>
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
            ${_profiles.map(p => `
              <div class="hub-card">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div style="font-weight:600;font-size:13px">${p.name}</div>
                  ${_toneBadge(p.tone || 'neutral', p.label || 'Unknown')}
                </div>
                <div style="margin-top:4px;font-size:10px;color:var(--muted)"><code>${p.baseUrl || '—'}</code></div>
                ${p.model ? `<div style="font-size:10px;color:var(--muted)">Model: ${p.model}</div>` : ''}
                <div style="font-size:10px;color:var(--muted)">Created: ${hub.reltime(p.created_at)}</div>
                <button class="hub-btn hub-btn-warn" style="font-size:10px;padding:2px 8px;margin-top:6px" onclick="window._prov_deleteProfile('${p.id}')">Delete</button>
              </div>`).join('')}
            ${_profiles.length === 0 ? '<div style="font-size:12px;color:var(--muted)">No saved profiles.</div>' : ''}
          </div>
        </div>
      </div>`;
  },
};

window._prov_reset = async (pid) => {
  await hub.post(`/api/providers/${pid}/reset`);
  window._hub_panels.providers.refresh();
};
window._prov_failover = async (pid) => {
  if (!confirm(`Force failover for ${pid}?`)) return;
  await hub.post(`/api/providers/${pid}/failover`);
  window._hub_panels.providers.refresh();
};
window._prov_showAddProfile = () => {
  document.getElementById('prov-add-form').style.display = 'block';
};
window._prov_saveProfile = async () => {
  const name = document.getElementById('prov-name').value.trim();
  const baseUrl = document.getElementById('prov-url').value.trim();
  const model = document.getElementById('prov-model').value.trim();
  const apiKey = document.getElementById('prov-key').value.trim();
  if (!name || !baseUrl) { alert('Name and Base URL required'); return; }
  await hub.post('/api/providers/profiles', { name, baseUrl, model, apiKey });
  document.getElementById('prov-add-form').style.display = 'none';
  window._hub_panels.providers.refresh();
};
window._prov_deleteProfile = async (id) => {
  if (!confirm('Delete this profile?')) return;
  await hub.del(`/api/providers/profiles/${id}`);
  window._hub_panels.providers.refresh();
};
