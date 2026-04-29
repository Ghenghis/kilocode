import hub from './core.js';

let _agents = [];
let _agentOutput = {}; // agent_id -> {type, content, metadata}
let _collapsedOutputs = new Set(); // Track collapsed long outputs

// ── Phase 7: Diff Rendering Helpers ────────────────────────────────────────

function _escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function _detectLanguage(code, filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  const langMap = {
    'py': 'python', 'js': 'javascript', 'ts': 'typescript', 'jsx': 'jsx', 'tsx': 'tsx',
    'html': 'html', 'css': 'css', 'scss': 'scss', 'json': 'json', 'md': 'markdown',
    'yaml': 'yaml', 'yml': 'yaml', 'sh': 'bash', 'bash': 'bash', 'go': 'go',
    'rs': 'rust', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'h': 'c',
    'cs': 'csharp', 'php': 'php', 'rb': 'ruby', 'sql': 'sql',
  };
  if (langMap[ext]) return langMap[ext];
  
  // Content-based detection
  if (code.includes('def ') && code.includes(':')) return 'python';
  if (code.includes('function') || code.includes('const ') || code.includes('let ')) return 'javascript';
  if (code.includes('interface ') || code.includes(': ')) return 'typescript';
  if (code.includes('<div') || code.includes('<!DOCTYPE')) return 'html';
  return 'plaintext';
}

function _renderDiff(diffLines) {
  // Simple line-by-line diff rendering
  const lines = diffLines.map(line => {
    const type = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : line.startsWith('@@') ? 'info' : 'ctx';
    const color = { add: '#22c55e', del: '#ef4444', info: '#f59e0b', ctx: 'inherit' }[type];
    const bg = { add: '#22c55e10', del: '#ef444410', info: '#f59e0b10', ctx: 'transparent' }[type];
    return `<div style="font-family:monospace;font-size:12px;line-height:1.4;padding:0 4px;background:${bg};color:${color}">${_escapeHtml(line)}</div>`;
  }).join('');
  
  return `<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;background:#1a1a1a">${lines}</div>`;
}

function _renderCodeBlock(code, filename = '', collapsible = false) {
  const lang = _detectLanguage(code, filename);
  const lines = code.split('\n');
  const isLong = lines.length > 20;
  const shouldCollapse = collapsible && isLong;
  const displayCode = shouldCollapse ? lines.slice(0, 20).join('\n') + '\n...' : code;
  const outputId = 'code-' + Math.random().toString(36).slice(2, 9);
  
  return `
    <div style="position:relative;margin:8px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:#2a2a2a;border:1px solid var(--border);border-bottom:none;border-radius:6px 6px 0 0">
        <span style="font-size:11px;color:var(--muted)">${lang}${filename ? ` · ${filename}` : ''}</span>
        <button class="hub-btn" style="font-size:10px;padding:2px 8px" onclick="window._copyCode('${outputId}')">📋 Copy</button>
      </div>
      <pre id="${outputId}" style="margin:0;padding:12px;background:#1a1a1a;border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px;overflow-x:auto;font-size:12px;line-height:1.4;max-height:${shouldCollapse ? '400px' : 'none'};overflow-y:auto">${_escapeHtml(displayCode)}</pre>
      ${shouldCollapse ? `<button class="hub-btn" style="width:100%;font-size:10px;margin-top:4px" onclick="window._toggleExpand('${outputId}', '${_escapeHtml(code).replace(/'/g, "\\'")}')">Expand ${lines.length - 20} more lines</button>` : ''}
    </div>`;
}

function _renderToolResult(toolName, result, metadata = {}) {
  const { filePath, command, searchQuery } = metadata;
  let content = '';
  
  if (toolName === 'read_file' && filePath) {
    content = `
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">📄 ${_escapeHtml(filePath)}</div>
      ${_renderCodeBlock(result, filePath, true)}`;
  } else if (toolName === 'execute_command' && command) {
    content = `
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">$ ${_escapeHtml(command)}</div>
      <pre style="margin:0;padding:8px;background:#1a1a1a;border:1px solid var(--border);border-radius:6px;font-size:11px;color:#a0a0a0;max-height:200px;overflow:auto">${_escapeHtml(result)}</pre>`;
  } else if (toolName === 'search' && searchQuery) {
    content = `
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">🔍 "${_escapeHtml(searchQuery)}"</div>
      <div style="font-size:11px">${_escapeHtml(result)} matches found</div>`;
  } else {
    content = `<pre style="margin:0;padding:8px;background:#1a1a1a;border:1px solid var(--border);border-radius:6px;font-size:11px">${_escapeHtml(String(result))}</pre>`;
  }
  
  return `
    <div style="border:1px solid var(--border);border-radius:6px;padding:8px;margin:8px 0;background:var(--card-bg)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:11px;font-weight:600">🔧 ${_escapeHtml(toolName)}</span>
        <span style="font-size:10px;color:var(--muted)">${new Date().toLocaleTimeString()}</span>
      </div>
      ${content}
    </div>`;
}

// ── Panel Export ───────────────────────────────────────────────────────────

export default {
  id: 'agents',
  label: 'Agents',
  icon: '🤖',
  section: 'KiloCode',
  order: 50,

  async init(h) {
    hub.on('agent.assigned', () => { if (document.getElementById('panel-agents')) this.refresh(); });
    hub.on('agent.released', () => { if (document.getElementById('panel-agents')) this.refresh(); });
    hub.on('agent.config.updated', () => { if (document.getElementById('panel-agents')) this.refresh(); });
    hub.on('agent.output', (e) => {
      _agentOutput[e.agent_id] = { type: e.type, content: e.content, metadata: e.metadata, ts: Date.now() };
      if (document.getElementById('panel-agents')) this.refresh();
    });
  },

  async refresh() {
    let r = await hub.get('/api/agents/kilo/status');
    if (r.error || !r.connected) {
      r = await hub.get('/api/agents');
    }
    _agents = r.agents || [];
    const el = document.getElementById('panel-agents');
    if (el) el.innerHTML = this.render();
  },

  render() {
    const busy = _agents.filter(a => a.status === 'busy');
    const idle = _agents.filter(a => a.status === 'idle');
    
    return `
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="font-size:20px">🤖 Agents</div>
          <span style="font-size:12px;color:var(--muted)">${busy.length} busy · ${idle.length} idle</span>
          <button class="hub-btn" onclick="window._hub_panels.agents.refresh()">↻</button>
        </div>
        
        <!-- Agent Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:8px;margin-bottom:16px">
          ${_agents.map(a => `
            <div class="hub-card" style="padding:8px" data-agent-id="${a.id}">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:600;font-size:11px">${a.id}</div>
                <div>${hub.badge(a.status)}</div>
              </div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${a.role}</div>
              ${a.current_task ? `<div style="font-size:10px;margin-top:3px;color:#f59e0b" title="${a.current_task}">${a.current_task.slice(0,40)}…</div>` : ''}
              <div style="display:flex;gap:4px;margin-top:6px">
                <button class="hub-btn" style="font-size:9px;padding:1px 6px" onclick="window._agent_assign('${a.id}')">Assign</button>
                ${a.status==='busy' ? `<button class="hub-btn" style="font-size:9px;padding:1px 6px" onclick="window._agent_release('${a.id}')">Release</button>` : ''}
              </div>
            </div>`).join('')}
        </div>
        
        <!-- Phase 7: Agent Output / Diff / Tool Results -->
        ${Object.entries(_agentOutput).map(([agentId, output]) => {
          const agent = _agents.find(a => a.id === agentId);
          if (!agent) return '';
          
          let rendered = '';
          if (output.type === 'diff') {
            rendered = _renderDiff(output.content.split('\n'));
          } else if (output.type === 'code') {
            rendered = _renderCodeBlock(output.content, output.metadata?.filename, true);
          } else if (output.type === 'tool') {
            rendered = _renderToolResult(output.metadata?.toolName || 'tool', output.content, output.metadata);
          } else {
            rendered = `<pre style="margin:0;padding:8px;background:#1a1a1a;border:1px solid var(--border);border-radius:6px;font-size:11px;max-height:300px;overflow:auto">${_escapeHtml(output.content)}</pre>`;
          }
          
          return `
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px;background:var(--card-bg)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="font-weight:600;font-size:12px">${agent.id} · ${output.type}</div>
                <button class="hub-btn" style="font-size:9px;padding:2px 8px" onclick="window._clearOutput('${agentId}')">Clear</button>
              </div>
              ${rendered}
            </div>`;
        }).join('')}
      </div>`;
  },
};

// ── Window Helpers ─────────────────────────────────────────────────────────

window._agent_assign = async (id) => {
  const task = prompt(`Assign task to ${id}:`);
  if (!task) return;
  let r = await hub.post(`/api/agents/kilo/${id}/assign`, { task });
  if (r.error) r = await hub.post(`/api/agents/${id}/assign`, { task });
  window._hub_panels.agents.refresh();
};

window._agent_release = async (id) => {
  let r = await hub.post(`/api/agents/kilo/${id}/release`);
  if (r.error) r = await hub.post(`/api/agents/${id}/release`);
  window._hub_panels.agents.refresh();
};

window._copyCode = (elementId) => {
  const el = document.getElementById(elementId);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    // Show brief feedback
    const btn = el.previousElementSibling?.querySelector('button');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied';
      setTimeout(() => btn.textContent = orig, 1500);
    }
  });
};

window._toggleExpand = (elementId, fullCode) => {
  const el = document.getElementById(elementId);
  if (!el) return;
  const isExpanded = el.dataset.expanded === 'true';
  if (isExpanded) {
    // Collapse - show first 20 lines
    const lines = fullCode.split('\n');
    el.textContent = lines.slice(0, 20).join('\n') + '\n...';
    el.dataset.expanded = 'false';
    el.style.maxHeight = '400px';
    el.nextElementSibling.textContent = `Expand ${lines.length - 20} more lines`;
  } else {
    // Expand - show full
    el.innerHTML = fullCode;
    el.dataset.expanded = 'true';
    el.style.maxHeight = 'none';
    el.nextElementSibling.textContent = 'Collapse';
  }
};

window._clearOutput = (agentId) => {
  delete _agentOutput[agentId];
  window._hub_panels.agents.refresh();
};
