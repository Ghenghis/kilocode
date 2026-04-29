/**
 * Hub v2 — core.js
 * Shared API client, SSE event bus, and auth header injection.
 * Loaded by shell.html before any panel module.
 * All panels receive this object as their `hub` argument in init().
 */

const HUB_BASE = window.HUB_BASE || '';

/** Auth token — set via hub.setToken() or HUB_TOKEN env injected by shell */
let _token = window.HUB_TOKEN || localStorage.getItem('hub_token') || '';

const _listeners = {};
let _evtSource = null;

/** Connect to the SSE event bus */
function _connectSSE() {
  if (_evtSource) return;
  _evtSource = new EventSource(`${HUB_BASE}/events`);
  _evtSource.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      const cbs = _listeners[msg.type] || [];
      cbs.forEach(cb => { try { cb(msg.payload, msg); } catch (_) {} });
      const all = _listeners['*'] || [];
      all.forEach(cb => { try { cb(msg.payload, msg); } catch (_) {} });
    } catch (_) {}
  };
  _evtSource.onerror = () => {
    _evtSource.close();
    _evtSource = null;
    setTimeout(_connectSSE, 5000); // reconnect after 5s
  };
}

/** Global Hub API client */
export const hub = {
  base: HUB_BASE,

  /** Register an SSE event listener */
  on(eventType, callback) {
    _listeners[eventType] = _listeners[eventType] || [];
    _listeners[eventType].push(callback);
  },

  /** Remove an SSE event listener */
  off(eventType, callback) {
    _listeners[eventType] = (_listeners[eventType] || []).filter(cb => cb !== callback);
  },

  /** Set the bearer auth token */
  setToken(token) {
    _token = token;
    localStorage.setItem('hub_token', token);
  },

  /** GET request */
  async get(path) {
    const r = await fetch(`${HUB_BASE}${path}`, { headers: _authHeaders() });
    return r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  },

  /** POST request */
  async post(path, body = {}) {
    const r = await fetch(`${HUB_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._authHeaders() },
      body: JSON.stringify(body),
    });
    return r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  },

  /** DELETE request */
  async del(path) {
    const r = await fetch(`${HUB_BASE}${path}`, {
      method: 'DELETE',
      headers: _authHeaders(),
    });
    return r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  },

  /** Connect SSE bus (idempotent) */
  connect() { _connectSSE(); },

  /** Utility: format ISO timestamp to local time string */
  reltime(ts) {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    return d.toLocaleTimeString();
  },

  /** Utility: status badge HTML */
  badge(status) {
    const colors = {
      online: '#22c55e', ok: '#22c55e', idle: '#6b7280', active: '#3b82f6',
      busy: '#f59e0b', offline: '#ef4444', error: '#ef4444', open: '#ef4444',
      closed: '#22c55e', 'half-open': '#f59e0b', running: '#3b82f6',
      completed: '#22c55e', failed: '#ef4444', pending: '#6b7280',
      cancelled: '#9ca3af',
    };
    const color = colors[status] || '#6b7280';
    return `<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;background:${color}20;color:${color};border:1px solid ${color}40">${status}</span>`;
  },

  /** Utility: loading spinner HTML */
  spinner() {
    return `<span style="display:inline-block;width:14px;height:14px;border:2px solid #555;border-top-color:#aaa;border-radius:50%;animation:hub-spin 0.7s linear infinite"></span>`;
  },
};

function _authHeaders() {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}

// Inject spinner keyframe once
const _style = document.createElement('style');
_style.textContent = '@keyframes hub-spin{to{transform:rotate(360deg)}}';
document.head.appendChild(_style);

// Auto-connect SSE on load
hub.connect();

export default hub;
