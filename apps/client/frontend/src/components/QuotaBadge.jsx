import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useSelector } from 'react-redux';

export function QuotaBadge() {
  const isAuthenticated = useSelector((state) => !!state?.auth?.isAuthenticated);
  const [authedHint, setAuthedHint] = useState(false);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchOnce = async () => {
      try {
        setLoading(true);
        const resp = await fetch('/api/generate/quota', { credentials: 'include', cache: 'no-store' });
        if (!mounted) return false;
        if (resp.ok) {
          const data = await resp.json();
          setQuota(data);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const fetchWithRetry = async (retries = 3, waitMs = 350) => {
      for (let i = 0; i < retries; i++) {
        const ok = await fetchOnce();
        if (!mounted) return;
        if (ok) return;
        await delay(waitMs);
      }
    };

    // initial attempt
    fetchWithRetry(2, 250);

    const onAuthChanged = (e) => {
      const d = (e && e.detail) || {};
      const authed = !!(d.isAuthenticated ?? d.authenticated ?? d.user);
      if (authed) {
        setAuthedHint(true);
        fetchWithRetry(3, 350);
        setTimeout(() => { if (mounted) fetchWithRetry(1, 0); }, 1200);
      } else {
        setAuthedHint(false);
        setQuota(null);
      }
    };
    window.addEventListener('auth-state-changed', onAuthChanged);

    const onQuotaRefresh = () => { fetchWithRetry(3, 300); };
    window.addEventListener('quota-refresh', onQuotaRefresh);

    const onFocus = () => {
      if (document.visibilityState === 'visible') fetchWithRetry(2, 250);
    };
    window.addEventListener('focus', onFocus);

    // short-lived polling after auth if badge not yet loaded
    let attempts = 0;
    let timer = null;
    if ((isAuthenticated || authedHint) && !quota) {
      timer = setInterval(async () => {
        attempts++;
        const ok = await fetchOnce();
        if (ok || attempts >= 8) {
          clearInterval(timer);
        }
      }, 600);
    }

    return () => {
      mounted = false;
      window.removeEventListener('auth-state-changed', onAuthChanged);
      window.removeEventListener('quota-refresh', onQuotaRefresh);
      window.removeEventListener('focus', onFocus);
      if (timer) clearInterval(timer);
    };
  }, [isAuthenticated, authedHint]);

  return (
    <div className="mb-4 flex justify-center min-h-[28px]">
      {(quota || isAuthenticated || authedHint) ? (
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border text-xs ${quota
            ? (quota.limit === null
                ? 'border-zinc-700 text-zinc-300'
                : ((quota.remaining ?? 0) === 0 ? 'border-red-600 text-red-400' : 'border-zinc-700 text-zinc-300'))
            : 'border-zinc-700 text-zinc-300'}`}
          title="Monthly image quota"
        >
          <span>Images left:</span>
          <span>
            {loading ? '…' : (quota ? (quota.limit === null ? '∞' : Math.max(0, quota.remaining ?? 0)) : '…')}
          </span>
        </div>
      ) : (
        <div className="inline-flex items-center justify-center h-[28px] text-zinc-400">
          <Sparkles className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
