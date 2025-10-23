import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useSelector } from 'react-redux';

export function QuotaBadge({ isAuthenticated: isAuthenticatedProp }) {
  const isAuthenticatedFromStore = useSelector((state) => !!state?.auth?.isAuthenticated);
  const isAuthenticated = isAuthenticatedProp ?? isAuthenticatedFromStore;
  const [authedHint, setAuthedHint] = useState(false);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(false);
  const startedRef = useRef(false);
  const fetchingRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const lastSuccessAtRef = useRef(0);
  const timerRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const fetchOnce = async () => {
      if (fetchingRef.current) return false;
      const now = Date.now();
      // Throttle frequent calls
      if (now - lastFetchAtRef.current < 400) return false;
      // Skip if we already fetched successfully very recently
      if (lastSuccessAtRef.current && (now - lastSuccessAtRef.current < 1500)) return false;
      fetchingRef.current = true;
      lastFetchAtRef.current = now;
      try {
        setLoading(true);
        const resp = await fetch('/api/generate/quota', { credentials: 'include', cache: 'no-store' });
        if (!mounted) return false;
        if (resp.ok) {
          const data = await resp.json();
          setQuota(data);
          lastSuccessAtRef.current = Date.now();
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        if (mounted) setLoading(false);
        fetchingRef.current = false;
      }
    };

    const scheduleFetch = (delayMs = 0, withFallback = false) => {
      if (!mounted) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      timerRef.current = setTimeout(() => { fetchOnce(); }, Math.max(0, delayMs));
      if (withFallback) {
        // first fallback ~1.4s after trigger
        fallbackTimerRef.current = setTimeout(() => { if (!quota) fetchOnce(); }, Math.max(600, delayMs + 900));
        // second fallback ~2.8s after trigger to catch slow cookie propagation
        const second = setTimeout(() => { if (!quota) fetchOnce(); }, Math.max(1600, delayMs + 2300));
        // chain cleanup into fallbackTimerRef
        const prev = fallbackTimerRef.current;
        fallbackTimerRef.current = {
          clear: () => { clearTimeout(prev); clearTimeout(second); }
        };
      }
    };

    // no initial attempt; rely on events/prop to avoid duplicates on mount

    const onAuthChanged = (e) => {
      const d = (e && e.detail) || {};
      const authed = !!(d.isAuthenticated ?? d.authenticated ?? d.user);
      if (authed) {
        setAuthedHint(true);
        // Debounced single-shot fetch with one fallback
        scheduleFetch(500, true);
      } else {
        setAuthedHint(false);
        setQuota(null);
      }
    };
    window.addEventListener('auth-state-changed', onAuthChanged);

    const onQuotaRefresh = () => { scheduleFetch(0, false); };
    window.addEventListener('quota-refresh', onQuotaRefresh);

    // intentionally no focus/polling; rely on events/prop

    return () => {
      mounted = false;
      window.removeEventListener('auth-state-changed', onAuthChanged);
      window.removeEventListener('quota-refresh', onQuotaRefresh);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fallbackTimerRef.current) {
        if (typeof fallbackTimerRef.current === 'object' && fallbackTimerRef.current.clear) fallbackTimerRef.current.clear();
        else clearTimeout(fallbackTimerRef.current);
      }
    };
  }, [isAuthenticated, authedHint]);

  // Prop-driven fetch when auth flips to true (in case events are missed)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (quota) return;
    const now = Date.now();
    if (fetchingRef.current) return;
    if (now - lastFetchAtRef.current < 400) return;
    if (lastSuccessAtRef.current && (now - lastSuccessAtRef.current < 1500)) return;
    (async () => {
      try {
        fetchingRef.current = true;
        lastFetchAtRef.current = Date.now();
        setLoading(true);
        const resp = await fetch('/api/generate/quota', { credentials: 'include', cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          setQuota(data);
          lastSuccessAtRef.current = Date.now();
        }
      } catch {}
      finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    })();
  }, [isAuthenticated, quota]);

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
