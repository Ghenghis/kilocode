import { hub } from './core.js';

let _data = { services: [], summary: {} };
let _busy = false;

const _statusBadge = (probe, required) => {
  const ok = probe?.healthy;
  const c = ok ? '#22c55e' : (required ? '#ef4444' : '#f59e0b');
  const label = ok ? 'UP' : (probe?.reason ? probe.reason.toUpperCase() : 'DOWN');
  return `<span style="display:inline-block;padding:2px 10px;border-radius:9px;font-size:11px;font-weight:700;background:${c}18;color:${c};border:1px solid ${c}40">${label}</span>`;
};

const _kindBadge = (kind) => {
  const map = { local: '#3b82f6', remote: '#a855f7', provider: '#06b6d4' };
  const c = map[kind] || '#6b7280';
  return `<span style="display:inline-block;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:600;background:${c}18;color:${c};border:1px solid ${c}40">${kind}</span>`;
};

async function _refresh(probe = false) {
  _busy = true;
  _render();
  try {
    const list = await hub.get('/api/services');
    _data.services = list?.services || [];
    if (probe) {
      const s = await hub.get('/api/services/status');
      _data.summary = s || {};
      // splice probe results back
      for (const sv of _data.services) {
        sv.last_probe = (s?.results || {})[sv.id] || sv.last_probe || {};
      }
    } else {
      _data.summary = list?.cached_summary || {};
    }
  } catch (err) {
    _data.error = String(err);
  } finally {
    _busy = false;
    _render();
  }
}

async function _ensure() {
  _busy = true; _render();
  try {
    const r = await hub.post('/api/services/ensure');
    hub.toast?.(`Ensure complete: started=${(r?.started || []).length}, failed=${(r?.failed || []).length}`);
  } catch (err) {
    hub.toast?.(`Ensure failed: ${err}`);
  }
  await _refresh(true);
}

async function _action(id, action) {
  _busy = true; _render();
  try {
    const r = await hub.post(`/api/services/${id}/${action}`);
    hub.toast?.(`${id}: ${r?.action || (r?.ok ? 'ok' : 'noop')}`);
  } catch (err) {
    hub.toast?.(`${action} ${id} failed: ${err}`);
  }
  await _refresh(true);
}

function _render() {
  const el = document.getElementById('panel-services');
  if (!el) return;
  const s = _data.summary || {};
  const total = _data.services.length;
  const healthy = (_data.services.filter(x => x.last_probe?.healthy)).length;
  const downReq = _data.services.filter(x => x.required && !x.last_probe?.healthy);
  const downOpt = _data.services.filter(x => !x.required && !x.last_probe?.healthy);

  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <h2 style="margin:0">Service Lifecycle</h2>
        <span style="color:var(--muted);font-size:12px">${total} services · ${healthy} up · ${downReq.length} required down · ${downOpt.length} optional down</span>
        <span style="margin-left:auto"></span>
        <button id="svc-refresh" ${_busy ? 'disabled' : ''} style="padding:6px 12px">Probe now</button>
        <button id="svc-ensure" ${_busy ? 'disabled' : ''} style="padding:6px 12px;background:#22c55e;color:white;border:0;border-radius:4px;font-weight:600">Ensure all (auto-start)</button>
      </div>

      ${downReq.length ? `<div style="background:#ef444418;border:1px solid #ef444440;border-radius:6px;padding:10px;margin-bottom:12px;color:#ef4444;font-size:13px">⚠ ${downReq.length} required service(s) down: <strong>${downReq.map(x => x.id).join(', ')}</strong></div>` : ''}

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="text-align:left;background:var(--bg-soft);border-bottom:1px solid var(--border)">
            <th style="padding:8px">ID</th>
            <th style="padding:8px">Name</th>
            <th style="padding:8px">Kind</th>
            <th style="padding:8px">Status</th>
            <th style="padding:8px">Latency</th>
            <th style="padding:8px">Auto-start</th>
            <th style="padding:8px">Notes</th>
            <th style="padding:8px">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${_data.services.map(s => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px"><code>${s.id}</code></td>
              <td style="padding:8px">${s.name}${s.required ? ' <span style="color:#ef4444;font-weight:600">*</span>' : ''}</td>
              <td style="padding:8px">${_kindBadge(s.kind)}</td>
              <td style="padding:8px">${_statusBadge(s.last_probe, s.required)}</td>
              <td style="padding:8px;color:var(--muted)">${s.last_probe?.latency_ms ?? '—'}ms</td>
              <td style="padding:8px">${s.auto_startable ? '✓' : '—'}</td>
              <td style="padding:8px;font-size:11px;color:var(--muted);max-width:280px">${s.notes || ''}</td>
              <td style="padding:8px">
                <button data-id="${s.id}" data-action="start" style="padding:3px 8px;font-size:11px">Start</button>
                <button data-id="${s.id}" data-action="stop" style="padding:3px 8px;font-size:11px">Stop</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="margin-top:14px;font-size:11px;color:var(--muted)">
        <strong>*</strong> required = blocks PASS_AGENTIC_TRUTH if down. The Hub auto-starts startable services on boot, on KiloCode activation, and on every refresh of this page.
      </p>
    </div>
  `;

  document.getElementById('svc-refresh')?.addEventListener('click', () => _refresh(true));
  document.getElementById('svc-ensure')?.addEventListener('click', () => _ensure());
  el.querySelectorAll('button[data-id]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-id');
      const action = b.getAttribute('data-action');
      if (id && action) _action(id, action);
    });
  });
}

export default {
  id: 'services',
  label: 'Services',
  icon: '🩺',
  section: 'Hub',
  order: 1,
  async init() {
    hub.on('services.probed', () => _refresh(false));
    hub.on('services.ensured', () => _refresh(true));
    hub.on('service.started', () => _refresh(true));
    hub.on('service.stopped', () => _refresh(true));
    // First load triggers a probe so refreshing the WebUI = service health pulse.
    await _refresh(true);
  },
  async refresh() { await _refresh(true); },
  render() {
    const el = document.getElementById('panel-services');
    if (el) _render();
    return '<div id="panel-services">Loading services…</div>';
  },
};
