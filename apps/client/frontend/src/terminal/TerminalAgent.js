// TerminalAgent: applies terminal policies and reports health to server
// - Stores terminal_id from URL (?tid or ?terminal_id) or localStorage
// - Sends heartbeat every 60s to /api/terminals/heartbeat
// - Polls /api/terminals/config?tid=... every 60s for remote-config
// - Applies: fullscreen (best-effort), wake lock (keep screen on), disable pinch-zoom/overscroll

const LS_KEY_TID = 'terminal_id';
const CFG_CACHE = { value: null, etag: null };
let wakeLock = null;
let started = false;

function getTerminalId() {
  try {
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = sp.get('tid') || sp.get('terminal_id');
    if (fromUrl && /^[0-9a-f\-]{36}$/i.test(fromUrl)) {
      localStorage.setItem(LS_KEY_TID, fromUrl);
      // Clean the URL param for a clean UI
      try {
        sp.delete('tid');
        sp.delete('terminal_id');
        const qs = sp.toString();
        const clean = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
        window.history.replaceState({}, document.title, clean);
      } catch {}
      return fromUrl;
    }
    const stored = localStorage.getItem(LS_KEY_TID);
    return stored || null;
  } catch {
    return null;
  }
}

function applyViewportPolicies({ disablePinchZoom = true, overscrollBehavior = 'none' } = {}) {
  try {
    if (disablePinchZoom) {
      let meta = document.querySelector('meta[name="viewport"]');
      const base = 'width=device-width, initial-scale=1.0';
      const extras = 'maximum-scale=1.0, user-scalable=no';
      const content = `${base}, ${extras}`;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    }
    if (overscrollBehavior) {
      const val = String(overscrollBehavior);
      document.documentElement.style.overscrollBehavior = val;
      document.body && (document.body.style.overscrollBehavior = val);
      document.body && (document.body.style.touchAction = 'manipulation');
    }
  } catch {}
}

async function requestWakeLock(keepAwake) {
  if (!keepAwake) return;
  try {
    if ('wakeLock' in navigator && navigator.wakeLock?.request) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => {
        // try to reacquire later
      });
    }
  } catch {}
}

function setupWakeLockReacquire(keepAwake) {
  if (!keepAwake) return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock(true);
  });
}

function setupFullscreenOnGesture(enabled) {
  if (!enabled) return;
  const handler = async () => {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch {}
    window.removeEventListener('pointerdown', handler, { capture: true });
  };
  // one-time best effort
  window.addEventListener('pointerdown', handler, { capture: true, once: true });
}

async function sendHeartbeat(tid, appVersion) {
  try {
    const osVersion = navigator.userAgent || 'unknown';
    await fetch('/api/terminals/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ terminal_id: tid, app_version: appVersion, os_version: osVersion })
    });
  } catch {}
}

async function fetchConfig(tid) {
  try {
    const headers = CFG_CACHE.etag ? { 'If-None-Match': CFG_CACHE.etag } : {};
    const res = await fetch(`/api/terminals/config?tid=${encodeURIComponent(tid)}`, { headers, credentials: 'include' });
    if (res.status === 304) return CFG_CACHE.value || {};
    if (!res.ok) return CFG_CACHE.value || {};
    const etag = res.headers.get('ETag') || null;
    const json = await res.json().catch(() => ({}));
    CFG_CACHE.value = json || {};
    CFG_CACHE.etag = etag;
    return CFG_CACHE.value;
  } catch {
    return CFG_CACHE.value || {};
  }
}

export function startTerminalAgent({ appVersion = 'web' } = {}) {
  if (started) return; started = true;
  const tid = getTerminalId();
  if (!tid) return; // only activate on terminals

  // Initial policies (will be refined by config once fetched)
  applyViewportPolicies({ disablePinchZoom: true, overscrollBehavior: 'none' });
  requestWakeLock(true);
  setupWakeLockReacquire(true);
  setupFullscreenOnGesture(true);

  // Periodic tasks
  const loop = async () => {
    const cfg = await fetchConfig(tid);
    // Apply policies from config if present
    applyViewportPolicies({
      disablePinchZoom: cfg.disablePinchZoom !== false,
      overscrollBehavior: cfg.overscrollBehavior || 'none',
    });
    if (cfg.keepAwake !== false) await requestWakeLock(true);
    if (cfg.fullscreen) setupFullscreenOnGesture(true);

    await sendHeartbeat(tid, appVersion);
  };

  // Run immediately and then every 60s
  loop();
  setInterval(loop, 60 * 1000);
}
