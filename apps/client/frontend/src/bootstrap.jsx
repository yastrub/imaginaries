// Bootstrap entry to enforce cache busting and SW purge before loading the app
// BUILD_ID is injected at build time via Vite define (__BUILD_ID__). Ensure string type for reliable comparisons.
const RAW_BUILD_ID = (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : Date.now());
const BUILD_ID = String(RAW_BUILD_ID);
try { window.__BUILD_ID__ = BUILD_ID; } catch {}

async function purgeCachesAndReload() {
  try { localStorage.setItem('BUILD_ID', BUILD_ID); } catch (e) {}
  // Unregister any service workers
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => {})));
    }
  } catch {}
  // Clear Cache API
  try {
    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
    }
  } catch {}
  // Reload to same path with version param; preserve existing params (e.g., celebrate=1), remove only 'purge'
  const params = new URLSearchParams(location.search);
  params.delete('purge');
  params.set('v', BUILD_ID);
  const qs = params.toString();
  const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  location.replace(url);
}

(async function start() {
  const params = new URLSearchParams(location.search);
  const needPurge = params.has('purge') || (localStorage.getItem('BUILD_ID') !== BUILD_ID);
  if (needPurge) {
    await purgeCachesAndReload();
    return;
  }
  try { localStorage.setItem('BUILD_ID', BUILD_ID); } catch (e) {}
  // Clean up version param from the address bar for a magical UX
  try {
    if (params.has('v')) {
      params.delete('v');
      const qs = params.toString();
      const cleanUrl = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch {}
  // Start TerminalAgent (best-effort) before app loads
  try {
    const mod = await import('./terminal/TerminalAgent.js');
    if (mod && typeof mod.startTerminalAgent === 'function') {
      mod.startTerminalAgent({ appVersion: BUILD_ID });
    }
  } catch {}
  // Load the app (static specifier to satisfy Vite's dynamic import constraints)
  await import('./main.jsx');
})();
