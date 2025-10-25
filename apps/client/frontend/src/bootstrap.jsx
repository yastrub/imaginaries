// Bootstrap entry to enforce cache busting and SW purge before loading the app
// BUILD_ID is injected at build time via Vite define (__BUILD_ID__)

const BUILD_ID = (typeof __BUILD_ID__ !== 'undefined' && __BUILD_ID__) || new Date().toISOString();

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
  // If celebrate=1 is present, set anon pending flags immediately (before any purge or app load)
  try {
    if (params.get('celebrate') === '1') {
      const anonKey = 'upgrade_pending_modal_anon';
      localStorage.setItem(anonKey, '1');
      sessionStorage.setItem(anonKey, '1');
    }
  } catch {}
  const needPurge = params.has('purge') || (localStorage.getItem('BUILD_ID') !== BUILD_ID);
  if (needPurge) {
    await purgeCachesAndReload();
    return;
  }
  try { localStorage.setItem('BUILD_ID', BUILD_ID); } catch (e) {}
  // Load the app (static specifier to satisfy Vite's dynamic import constraints)
  await import('./main.jsx');
})();
