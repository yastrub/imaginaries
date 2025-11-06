import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { CameraCapture } from './CameraCapture';
import { MERCH_PRESETS, DEFAULT_MERCH_PRESET } from '../config/merchPresets';
import { ChevronLeft, ChevronRight, Camera, RefreshCcw, Sparkles, ShoppingBag } from 'lucide-react';
import { MerchOrderModal } from './MerchOrderModal';

export function MerchDemo() {
  const isTerminalApp = useSelector((state) => state?.env?.isTerminalApp);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selfieDataUrl, setSelfieDataUrl] = useState(null);
  const [preset, setPreset] = useState(DEFAULT_MERCH_PRESET);
  const [keepPoses, setKeepPoses] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [activeLoaded, setActiveLoaded] = useState(false);
  const [portalGifUrl, setPortalGifUrl] = useState('/images/portal-animation.gif');

  const containerRef = useRef(null);

  const fetchLogoAsDataUrl = useCallback(async () => {
    try {
      const res = await fetch('/images/artificial-logo-square.png', { credentials: 'include' });
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Failed to load logo image', e);
      return null;
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const resp = await fetch(`/api/merch/list?_=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await resp.json();
      if (data && Array.isArray(data.items)) {
        setItems(data.items);
        setActiveIndex(0);
      }
    } catch (e) {
      console.error('Failed to load merch list', e);
    }
  }, []);

  useEffect(() => {
    // Load existing magazines on mount
    loadList();
  }, [loadList]);

  // Preload heavy portal animation gif
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/version', { cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        const buildId = data?.buildId || Math.floor(Date.now() / 1000);
        const url = `/images/portal-animation.gif?v=${buildId}`;
        if (!cancelled) setPortalGifUrl(url);
      } catch {
        // keep default
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = portalGifUrl;
  }, [portalGifUrl]);

  const handleGenerate = useCallback(async () => {
    if (!selfieDataUrl) {
      setError('Please take a selfie first');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      // Insert skeleton placeholder and scroll to gallery
      const placeholderId = `placeholder-${Date.now()}`;
      const placeholder = { url: portalGifUrl, created_at: new Date().toISOString(), public_id: placeholderId, isPlaceholder: true };
      setItems((prev) => [placeholder, ...prev]);
      setActiveIndex(0);
      setTimeout(() => { try { containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} }, 0);

      const logoDataUrl = await fetchLogoAsDataUrl();
      const resp = await fetch('/api/merch/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ selfieDataUrl, logoDataUrl, preset, keepPoses })
      });
      if (!resp.ok) {
        throw new Error('Failed to generate');
      }
      const data = await resp.json();
      if (data?.url) {
        // Preload final image then gently swap
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve; img.onerror = resolve;
          img.src = data.url;
        });
        const finalId = `local-${Date.now()}`;
        setItems((prev) => prev.map(it => it.public_id === placeholderId ? { url: data.url, created_at: new Date().toISOString(), public_id: finalId } : it));
        setActiveIndex(0);
      }
    } catch (e) {
      console.error('Generate error', e);
      setError(e?.message || 'Failed to generate');
      // remove placeholder if present
      setItems((prev) => prev.filter(it => !it.isPlaceholder));
    } finally {
      setIsGenerating(false);
    }
  }, [selfieDataUrl, preset, keepPoses, fetchLogoAsDataUrl]);

  // Simple swipe support
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX = null;
    let startY = null;
    const onTouchStart = (e) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
    };
    const onTouchEnd = (e) => {
      if (startX == null || startY == null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX; const dy = t.clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx < 0) setActiveIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
        else setActiveIndex((i) => Math.max(0, i - 1));
      }
      startX = null; startY = null;
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [items.length]);

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < items.length - 1;

  const activeItem = items[activeIndex] || null;

  // Keep fade stable; do not reset on URL change to avoid flicker

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-black/60 backdrop-blur border-b border-zinc-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <button
            className="px-4 py-2 rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            onClick={() => { window.location.href = '/imagine'; }}
          >
            Imagine
          </button>
          <div className="text-white font-medium">ART*FICIAL Merch</div>
          <button
            className="px-3 py-2 rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
            onClick={() => {
              // Force refetch and, as a fallback, hard reload
              loadList();
            }}
            title="Reload"
          >
            <RefreshCcw className="w-4 h-4" /> Reload
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-24 pb-10">
        {!isTerminalApp ? (
          <div className="max-w-xl mx-auto text-center py-20 text-zinc-400">
            <div className="text-2xl text-white font-semibold mb-3">Merch is available on the Terminal only</div>
            <div>Use the QR from the T‑Shirt modal to complete your order on your phone.</div>
          </div>
        ) : (
        /* Controls */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: selfie */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-medium">1. Take a Selfie</div>
              <button
                className="px-3 py-2 rounded-md bg-white text-black hover:bg-zinc-100 flex items-center gap-2"
                onClick={() => setIsCameraOpen(true)}
              >
                <Camera className="w-4 h-4"/> Take Selfie
              </button>
            </div>
            <div className="aspect-[3/4] rounded-md bg-zinc-800 flex items-center justify-center overflow-hidden">
              {selfieDataUrl ? (
                <img src={selfieDataUrl} alt="Selfie" className="w-full h-full object-contain" />
              ) : (
                <div className="text-zinc-500">No selfie yet</div>
              )}
            </div>
            {selfieDataUrl && (
              <div className="mt-2 text-right">
                <button className="text-sm text-zinc-400 hover:text-white" onClick={() => setSelfieDataUrl(null)}>Retake</button>
              </div>
            )}
          </div>

          {/* Middle: presets */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="text-white font-medium mb-3">2. Preset</div>
            <div className="grid grid-cols-2 gap-2">
              {MERCH_PRESETS.map((p) => (
                <button
                  key={p.key}
                  className={`px-3 py-2 rounded-md border ${preset===p.key? 'border-indigo-500 text-white bg-indigo-500/10':'border-zinc-700 text-zinc-200 hover:bg-zinc-800'}`}
                  onClick={() => setPreset(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-5 text-white font-medium mb-2">3. Poses</div>
            <div className="flex gap-2">
              <button
                className={`flex-1 px-3 py-2 rounded-md border ${keepPoses? 'border-indigo-500 text-white bg-indigo-500/10':'border-zinc-700 text-zinc-200 hover:bg-zinc-800'}`}
                onClick={() => setKeepPoses(true)}
              >
                Keep Poses
              </button>
              <button
                className={`flex-1 px-3 py-2 rounded-md border ${!keepPoses? 'border-indigo-500 text-white bg-indigo-500/10':'border-zinc-700 text-zinc-200 hover:bg-zinc-800'}`}
                onClick={() => setKeepPoses(false)}
              >
                Change Poses
              </button>
            </div>
            <div className="mt-6">
              <button
                disabled={!selfieDataUrl || isGenerating}
                onClick={handleGenerate}
                className="w-full px-4 py-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Generating...</span>
                ) : (
                  <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Generate Magazine</span>
                )}
              </button>
              {error && <div className="mt-2 text-sm text-red-400">{error}</div>}
            </div>
          </div>

          {/* Right: carousel */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4" ref={containerRef}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-medium">4. Gallery</div>
              <div className="text-sm text-zinc-400">{items.length} items</div>
            </div>
            <div className="relative">
              <div className="aspect-[3/4] rounded-md bg-zinc-800 flex items-center justify-center overflow-hidden">
                {activeItem ? (
                  <img
                    src={activeItem.url}
                    alt="Magazine"
                    className={
                      activeItem.isPlaceholder
                        ? 'w-full h-full object-cover opacity-100'
                        : `w-full h-full object-cover transition-opacity duration-500 ${activeLoaded ? 'opacity-100' : 'opacity-0'}`
                    }
                    onLoad={() => setActiveLoaded(true)}
                  />
                ) : (
                  <div className="text-zinc-500">No items yet</div>
                )}
              </div>
              {/* Order CTA */}
              <div className="mt-4 flex justify-center">
                <button
                  disabled={!activeItem}
                  onClick={() => setIsOrderOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black hover:bg-zinc-100 disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4"/> Order T-Shirt
                </button>
              </div>
              {/* Nav */}
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30"
                onClick={() => setActiveIndex((i) => Math.max(0, i-1))}
                disabled={!canPrev}
                aria-label="Prev"
              >
                <ChevronLeft className="w-6 h-6"/>
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30"
                onClick={() => setActiveIndex((i) => Math.min(items.length-1, i+1))}
                disabled={!canNext}
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6"/>
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      <MerchOrderModal
        isOpen={isOrderOpen}
        onClose={() => setIsOrderOpen(false)}
        posterUrl={activeItem?.url}
      />

      {isCameraOpen && (
        <CameraCapture
          onCapture={(d) => { setSelfieDataUrl(d); setIsCameraOpen(false); }}
          onCancel={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
}
