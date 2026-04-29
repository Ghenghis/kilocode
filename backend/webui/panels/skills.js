import { hub } from './core.js';

let _data = { registry: { skills: {} }, marketplace: { catalog: [] }, health: {} };
let _busy = false;
let _selected = null;

const _verdictColor = (v) => ({
  PASS: '#22c55e',
  PASS_REQUIRES_APPROVAL: '#f59e0b',
  QUARANTINE: '#ef4444',
  FAIL: '#ef4444',
}[v] || '#6b7280');

const _badge = (text, color) => `<span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:${color}18;color:${color};border:1px solid ${color}40">${text}</span>`;

async function _refresh() {
  _busy = true; _render();
  try {
    const [reg, mkt, h] = await Promise.all([
      hub.get('/api/skills/registry'),
      hub.get('/api/skills/marketplace'),
      hub.get('/api/skills/health'),
    ]);
    _data.registry = reg?.registry || { skills: {} };
    _data.marketplace = mkt || { catalog: [] };
    _data.health = h || {};
  } finally {
    _busy = false; _render();
  }
}

async function _installFromCatalog(item) {
  const manifest = {
    id: item.id,
    name: item.name,
    version: '1.0.0',
    description: `Built-in skill: ${item.name}`,
    permissions: item.permissions || [],
    executor: 'zeroclaw',
    entrypoint: `${item.id}.run`,
    category: item.category,
    source: item.source,
    quarantine: !!item.quarantine,
  };
  await hub.post('/api/skills/install', { manifest });
  await _refresh();
}

async function _audit(id) { await hub.post(`/api/skills/${id}/audit`); await _refresh(); }
async function _approve(id, approved) {
  await fetch(hub.base + `/api/skills/${id}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved }),
  });
  await _refresh();
}
async function _execute(id) {
  const r = await hub.post(`/api/skills/${id}/execute`, { args: {} });
  hub.toast?.(`Run ${r?.run_id}: ${r?.status}`);
  await _refresh();
}

async function _showRuntime(id) {
  const r = await hub.get(`/api/skills/${id}/runtime`);
  alert(`Skill ${id}\nVerdict: ${r.verdict}\nRuns: ${r.use_count} (✓${r.success_count} ✗${r.failure_count})\nEvidence files: ${r.evidence_count}`);
}

function _render() {
  const el = document.getElementById('panel-skills');
  if (!el) return;
  const skills = Object.values(_data.registry.skills || {});
  const t = _data.health.totals || { skills: 0, active: 0, requires_approval: 0, quarantined: 0, failed: 0 };

  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <h2 style="margin:0">Skills System</h2>
        <span style="color:var(--muted);font-size:12px">${t.skills} skills · ${t.active} active · ${t.requires_approval} need approval · ${t.quarantined} quarantined · ${t.failed} failed</span>
        <span style="margin-left:auto"></span>
        <button id="sk-refresh" ${_busy ? 'disabled' : ''} style="padding:6px 12px">Refresh</button>
      </div>

      <h3 style="margin:18px 0 8px">Installed Registry (${skills.length})</h3>
      ${skills.length === 0 ? '<p style="color:var(--muted);font-size:13px">No skills installed yet. Install one from the marketplace below.</p>' : `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;background:var(--bg-soft);border-bottom:1px solid var(--border)">
          <th style="padding:8px">ID</th><th style="padding:8px">Name</th>
          <th style="padding:8px">Verdict</th><th style="padding:8px">Dangerous</th>
          <th style="padding:8px">Approved</th><th style="padding:8px">Permissions</th>
          <th style="padding:8px">Use</th><th style="padding:8px">Actions</th>
        </tr></thead>
        <tbody>
        ${skills.map(s => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:8px"><code>${s.manifest?.id || ''}</code></td>
            <td style="padding:8px">${s.manifest?.name || ''}</td>
            <td style="padding:8px">${_badge(s.verdict, _verdictColor(s.verdict))}</td>
            <td style="padding:8px">${s.dangerous ? _badge('YES', '#ef4444') : _badge('no', '#6b7280')}</td>
            <td style="padding:8px">${s.approved ? _badge('approved', '#22c55e') : _badge('pending', '#f59e0b')}</td>
            <td style="padding:8px;font-size:11px;color:var(--muted)">${(s.permissions || []).join(', ')}</td>
            <td style="padding:8px;color:var(--muted)">${s.use_count || 0} (✓${s.success_count || 0} ✗${s.failure_count || 0})</td>
            <td style="padding:8px">
              <button data-skill="${s.manifest?.id}" data-act="audit" style="padding:3px 8px;font-size:11px">Audit</button>
              ${s.dangerous ? `<button data-skill="${s.manifest?.id}" data-act="${s.approved ? 'revoke' : 'approve'}" style="padding:3px 8px;font-size:11px">${s.approved ? 'Revoke' : 'Approve'}</button>` : ''}
              <button data-skill="${s.manifest?.id}" data-act="execute" style="padding:3px 8px;font-size:11px">Execute</button>
              <button data-skill="${s.manifest?.id}" data-act="runtime" style="padding:3px 8px;font-size:11px">Logs</button>
            </td>
          </tr>
        `).join('')}
        </tbody>
      </table>`}

      <h3 style="margin:24px 0 8px">Marketplace</h3>
      <p style="font-size:11px;color:var(--muted);margin:0 0 8px">All skills are audited before activation. Quarantined skills cannot be installed for production use.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;background:var(--bg-soft);border-bottom:1px solid var(--border)">
          <th style="padding:8px">ID</th><th style="padding:8px">Name</th><th style="padding:8px">Category</th>
          <th style="padding:8px">Permissions</th><th style="padding:8px">Source</th><th style="padding:8px">Action</th>
        </tr></thead>
        <tbody>
        ${(_data.marketplace.catalog || []).map(c => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:8px"><code>${c.id}</code></td>
            <td style="padding:8px">${c.name}${c.quarantine ? ' ' + _badge('QUARANTINE', '#ef4444') : ''}</td>
            <td style="padding:8px">${c.category}</td>
            <td style="padding:8px;font-size:11px;color:var(--muted)">${(c.permissions || []).join(', ')}</td>
            <td style="padding:8px">${c.source}</td>
            <td style="padding:8px">
              <button data-install="${c.id}" ${c.quarantine ? 'disabled title="Cannot install quarantined skill"' : ''} style="padding:3px 8px;font-size:11px">Install</button>
            </td>
          </tr>
        `).join('')}
        </tbody>
      </table>

      <p style="margin-top:18px;font-size:11px;color:var(--muted)">
        Skills root: <code>${_data.health.skills_root || '?'}</code> · Registry exists: ${_data.health.registry_exists ? '✓' : '✗'}
      </p>
    </div>
  `;

  document.getElementById('sk-refresh')?.addEventListener('click', _refresh);

  el.querySelectorAll('button[data-skill]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-skill');
      const act = b.getAttribute('data-act');
      if (!id) return;
      if (act === 'audit') _audit(id);
      else if (act === 'approve') _approve(id, true);
      else if (act === 'revoke') _approve(id, false);
      else if (act === 'execute') _execute(id);
      else if (act === 'runtime') _showRuntime(id);
    });
  });
  el.querySelectorAll('button[data-install]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-install');
      const item = (_data.marketplace.catalog || []).find(c => c.id === id);
      if (item) _installFromCatalog(item);
    });
  });
}

export default {
  id: 'skills',
  label: 'Skills',
  icon: '🧠',
  section: 'Hub',
  order: 2,
  async init() {
    hub.on('skill.installed', _refresh);
    hub.on('skill.audited', _refresh);
    hub.on('skill.executed', _refresh);
    hub.on('skill.permissions.updated', _refresh);
    hub.on('skill.learned', _refresh);
    await _refresh();
  },
  async refresh() { await _refresh(); },
  render() { return '<div id="panel-skills">Loading skills…</div>'; },
};
