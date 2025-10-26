// TerminalAgent: applies terminal policies and reports health to server
// - Stores terminal_id from URL (?tid or ?terminal_id) or localStorage
// - Sends heartbeat every 60s to /api/terminals/heartbeat
// - Polls /api/terminals/config?tid=... every 60s for remote-config
// - Applies: fullscreen (best-effort), wake lock (keep screen on), disable pinch-zoom/overscroll

const LS_KEY_TID = 'terminal_id';
const LS_KEY_PAIR_CODE = 'terminal_pairing_code';
const CFG_CACHE = { value: null, etag: null };
let wakeLock = null;
let started = false;
let pairingModalEl = null;
let UPDATE_ETAG = null;
let UPDATE_SIG = null; // SHA-256 hex of last index.html content
let updatingInProgress = false;
let SERVER_VERSION_ETAG = null;
let SERVER_BUILD_SEEN = null;

function isTerminalApp() {
  try {
    if (document.referrer?.startsWith('android-app://com.octadiam.imaginarium')) {
      return true;
    }
    const sp = new URLSearchParams(location.search);
    if (sp.get('terminal') === '1') return true;
  } catch {}
  return false;
}

async function checkServerVersion() {
  if (updatingInProgress) return;
  try {
    const headers = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    if (SERVER_VERSION_ETAG) headers['If-None-Match'] = SERVER_VERSION_ETAG;
    const res = await fetch(`/api/version`, { method: 'GET', cache: 'no-store', headers, credentials: 'include' });
    if (res.status === 304) return;
    if (!res.ok) return;
    const et = res.headers.get('ETag') || res.headers.get('etag') || res.headers.get('Etag');
    if (et && !SERVER_VERSION_ETAG) { SERVER_VERSION_ETAG = et; }
    const json = await res.json().catch(() => ({}));
    const buildId = json?.buildId ?? et ?? null;
    const bstr = buildId != null ? String(buildId) : null;
    if (!bstr || !/^\d+$/.test(bstr)) { return; }
    if (!SERVER_BUILD_SEEN) { SERVER_BUILD_SEEN = bstr; return; }
    if (String(bstr) !== String(SERVER_BUILD_SEEN)) {
      SERVER_BUILD_SEEN = bstr;
      return purgeCachesAndReloadWithOverlay();
    }
  } catch {}
}

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

function ensurePairingModal(code) {
  // Create a minimal, styled modal without React
  if (pairingModalEl) return pairingModalEl;
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.6)';
  overlay.style.backdropFilter = 'blur(4px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '99999';

  const panel = document.createElement('div');
  panel.style.background = '#0b0b0f';
  panel.style.border = '1px solid #27272a';
  panel.style.borderRadius = '16px';
  panel.style.width = 'min(92vw, 480px)';
  panel.style.padding = '24px';
  panel.style.color = '#e4e4e7';
  panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';

  const title = document.createElement('h2');
  title.textContent = 'Terminal Pairing';
  title.style.fontSize = '20px';
  title.style.margin = '0 0 8px 0';

  const desc = document.createElement('p');
  desc.textContent = 'Enter this code into Admin > Terminals (pairing_code), then tap Pair.';
  desc.style.opacity = '0.8';
  desc.style.margin = '0 0 16px 0';

  const codeBox = document.createElement('div');
  codeBox.textContent = code;
  codeBox.style.fontSize = '36px';
  codeBox.style.letterSpacing = '6px';
  codeBox.style.textAlign = 'center';
  codeBox.style.padding = '16px';
  codeBox.style.margin = '8px 0 16px 0';
  codeBox.style.background = '#111114';
  codeBox.style.border = '1px solid #27272a';
  codeBox.style.borderRadius = '12px';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '12px';
  row.style.marginTop = '8px';

  const pairBtn = document.createElement('button');
  pairBtn.textContent = 'Pair';
  pairBtn.style.flex = '1';
  pairBtn.style.height = '44px';
  pairBtn.style.borderRadius = '10px';
  pairBtn.style.border = '1px solid #3f3f46';
  pairBtn.style.background = '#18181b';
  pairBtn.style.color = '#fff';
  pairBtn.style.fontWeight = '600';

  const regenBtn = document.createElement('button');
  regenBtn.textContent = 'New Code';
  regenBtn.style.flex = '1';
  regenBtn.style.height = '44px';
  regenBtn.style.borderRadius = '10px';
  regenBtn.style.border = '1px solid #3f3f46';
  regenBtn.style.background = '#0e7490';
  regenBtn.style.color = '#fff';
  regenBtn.style.fontWeight = '600';

  row.appendChild(pairBtn);
  row.appendChild(regenBtn);

  panel.appendChild(title);
  panel.appendChild(desc);
  panel.appendChild(codeBox);
  panel.appendChild(row);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  pairingModalEl = { overlay, codeBox, pairBtn, regenBtn };
  return pairingModalEl;
}

function generateCode() {
  // 6-digit numeric code; leading zeros allowed
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

function ensureUpdateOverlay() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'radial-gradient(1200px 600px at 50% -20%, rgba(88,28,135,0.35), transparent), rgba(0,0,0,0.85)';
  overlay.style.backdropFilter = 'blur(6px)';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '100000';

  const title = document.createElement('div');
  title.textContent = 'Updating application';
  title.style.fontSize = '22px';
  title.style.fontWeight = '700';
  title.style.letterSpacing = '0.5px';
  title.style.color = '#fafafa';
  title.style.marginBottom = '10px';

  const subtitle = document.createElement('div');
  subtitle.textContent = 'NASA-grade rollout in progress';
  subtitle.style.color = '#a1a1aa';
  subtitle.style.marginBottom = '20px';

  const barWrap = document.createElement('div');
  barWrap.style.width = 'min(90vw, 520px)';
  barWrap.style.height = '14px';
  barWrap.style.border = '1px solid #3f3f46';
  barWrap.style.borderRadius = '999px';
  barWrap.style.background = 'linear-gradient(180deg, #0b0b0f, #0e0e12)';
  barWrap.style.overflow = 'hidden';

  const bar = document.createElement('div');
  bar.style.height = '100%';
  bar.style.width = '0%';
  bar.style.background = 'linear-gradient(90deg, #7c3aed, #22d3ee)';
  bar.style.boxShadow = '0 0 20px rgba(124,58,237,0.4)';
  bar.style.transition = 'width 300ms ease';
  barWrap.appendChild(bar);

  const step = document.createElement('div');
  step.style.marginTop = '12px';
  step.style.color = '#d4d4d8';
  step.style.fontSize = '13px';

  overlay.appendChild(title);
  overlay.appendChild(subtitle);
  overlay.appendChild(barWrap);
  overlay.appendChild(step);
  document.body.appendChild(overlay);

  return {
    setProgress(pct, text) {
      try { bar.style.width = `${Math.max(0, Math.min(100, pct))}%`; } catch {}
      if (text) step.textContent = text;
    },
    remove() { try { overlay.remove(); } catch {} },
  };
}

async function purgeCachesAndReloadWithOverlay() {
  if (updatingInProgress) return; updatingInProgress = true;
  const ui = ensureUpdateOverlay();
  ui.setProgress(5, 'Checking resources');
  try {
    ui.setProgress(20, 'Unregistering service workers');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister().catch(() => {})));
      }
    } catch {}

    ui.setProgress(55, 'Purging caches');
    try {
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
      }
    } catch {}

    ui.setProgress(80, 'Preparing fresh launch');
    // Small delay for UX polish
    await new Promise(r => setTimeout(r, 250));

    ui.setProgress(100, 'Reloading');
    const sp = new URLSearchParams(location.search);
    sp.set('v', String(Date.now()));
    const qs = sp.toString();
    const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
    location.replace(url);
  } catch {
    // As a last resort, hard reload
    location.reload();
  }
}

async function checkForSelfUpdate() {
  if (updatingInProgress) return;
  try {
    const headers = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    if (UPDATE_ETAG) headers['If-None-Match'] = UPDATE_ETAG;
    const cb = encodeURIComponent(UPDATE_ETAG || UPDATE_SIG || Date.now());
    const res = await fetch(`/index.html?ping=${cb}`, { method: 'GET', cache: 'no-store', headers, credentials: 'include' });
    if (res.status === 304) return;
    if (!res.ok) return;
    const et = res.headers.get('ETag') || res.headers.get('etag') || res.headers.get('Etag');
    if (et) {
      if (!UPDATE_ETAG) { UPDATE_ETAG = et; return; }
      if (UPDATE_ETAG && et !== UPDATE_ETAG) { UPDATE_ETAG = et; return purgeCachesAndReloadWithOverlay(); }
      return; // same etag
    }
    // Fallback: compute a strong signature from content when ETag is missing
    const text = await res.text();
    const sig = await sha256(text);
    if (!UPDATE_SIG) { UPDATE_SIG = sig; return; }
    if (UPDATE_SIG !== sig) { UPDATE_SIG = sig; return purgeCachesAndReloadWithOverlay(); }
  } catch {}
}

async function sha256(text) {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(buf);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      const h = bytes[i].toString(16).padStart(2, '0');
      hex += h;
    }
    return hex;
  } catch {
    // Fallback to length-based weak signature if crypto is unavailable
    const len = (text || '').length;
    return `len-${len}`;
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

async function sendHeartbeat(tid) {
  try {
    const osVersion = navigator.userAgent || 'unknown';
    // Prefer server-provided unix build id if available and numeric
    let appVersion = null;
    try {
      if (SERVER_BUILD_SEEN && /^\d+$/.test(String(SERVER_BUILD_SEEN))) {
        appVersion = String(SERVER_BUILD_SEEN);
      } else if (typeof window !== 'undefined' && window.__BUILD_ID__ != null) {
        const local = String(window.__BUILD_ID__);
        if (/^\d+$/.test(local)) appVersion = local;
      }
    } catch {}
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
  const terminalEnv = isTerminalApp();

  // Initial policies for terminals only
  if (terminalEnv) {
    applyViewportPolicies({ disablePinchZoom: true, overscrollBehavior: 'none' });
    requestWakeLock(true);
    setupWakeLockReacquire(true);
    setupFullscreenOnGesture(true);
  }

  if (!tid) {
    // Only show pairing for terminal app; skip on web/PWA
    if (!terminalEnv) return;

    let pairCode = null;
    try { pairCode = localStorage.getItem(LS_KEY_PAIR_CODE); } catch {}
    if (!pairCode) {
      pairCode = generateCode();
      try { localStorage.setItem(LS_KEY_PAIR_CODE, pairCode); } catch {}
    }

    const modal = ensurePairingModal(pairCode);
    // New code generation
    modal.regenBtn.onclick = () => {
      const fresh = generateCode();
      modal.codeBox.textContent = fresh;
      try { localStorage.setItem(LS_KEY_PAIR_CODE, fresh); } catch {}
    };
    // Pair action
    modal.pairBtn.onclick = async () => {
      const current = (modal.codeBox.textContent || '').trim();
      if (!current) return;
      try {
        const res = await fetch('/api/terminals/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code: current }),
        });
        if (!res.ok) {
          // brief visual feedback
          modal.pairBtn.textContent = 'Invalid Code';
          setTimeout(() => { modal.pairBtn.textContent = 'Pair'; }, 1200);
          return;
        }
        const json = await res.json().catch(() => ({}));
        const newTid = json?.terminal_id;
        if (newTid && /^[0-9a-f\-]{36}$/i.test(newTid)) {
          localStorage.setItem(LS_KEY_TID, newTid);
          localStorage.removeItem(LS_KEY_PAIR_CODE);
          // Dismiss modal
          try { modal.overlay.remove(); } catch {}
          pairingModalEl = null;
          // Start loops now that we have a terminal id
          startLoops(newTid, appVersion);
        }
      } catch {}
    };
    // Start update monitor even while unpaired, so app can refresh
    setInterval(() => { checkServerVersion(); checkForSelfUpdate(); }, 60 * 1000);
    // Trigger an immediate check now
    checkServerVersion();
    checkForSelfUpdate();
    // Do not proceed to loops until paired
    return;
  }

  // Already have a terminal id
  startLoops(tid, appVersion);
}

function startLoops(tid, appVersion) {
  // Periodic tasks
  const loop = async () => {
    // First, detect server version so heartbeat reports the latest numeric build id
    await checkServerVersion();
    const cfg = await fetchConfig(tid);
    // Apply policies from config if present
    applyViewportPolicies({
      disablePinchZoom: cfg.disablePinchZoom !== false,
      overscrollBehavior: cfg.overscrollBehavior || 'none',
    });
    if (cfg.keepAwake !== false) await requestWakeLock(true);
    if (cfg.fullscreen) setupFullscreenOnGesture(true);

    await sendHeartbeat(tid);
    // Check for self-update (server version is primary)
    await checkForSelfUpdate();
  };
  loop();
  setInterval(loop, 60 * 1000);
}
