import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { CameraCapture } from './CameraCapture';
import { MERCH_PRESETS, DEFAULT_MERCH_PRESET } from '../config/merchPresets';
import { Camera, RefreshCcw, Sparkles, ShoppingBag, Trash2 } from 'lucide-react';
import { MerchOrderModal } from './MerchOrderModal';
import { showQrModal } from '../lib/qr';
import { ConfirmDialog } from './ConfirmDialog';

export function MerchDemo() {
  const isTerminalApp = useSelector((state) => state?.env?.isTerminalApp);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selfieDataUrl, setSelfieDataUrl] = useState(null);
  const [preset, setPreset] = useState(DEFAULT_MERCH_PRESET);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [activeLoaded, setActiveLoaded] = useState(false);
  const [portalGifUrl, setPortalGifUrl] = useState('/images/portal-animation.gif');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTechMode, setIsTechMode] = useState(false);

  const containerRef = useRef(null);
  const titleTapCountRef = useRef(0);
  const titleTapTimerRef = useRef(null);

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

  const loadList = useCallback(async (brand) => {
    try {
      const b = (brand || (isTechMode ? 'TECHTUESDAYS' : 'ARTIFICIAL'));
      const resp = await fetch(`/api/merch/list?brand=${encodeURIComponent(b)}&_=${Date.now()}`, {
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
  }, [isTechMode]);

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
      // Only use client-provided logo for ARTIFICIAL; TECHTUESDAYS handled on backend
      const logoDataUrl = isTechMode ? null : await fetchLogoAsDataUrl();
      const resp = await fetch('/api/merch/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ selfieDataUrl, logoDataUrl, preset, brand: isTechMode ? 'TECHTUESDAYS' : 'ARTIFICIAL' })
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
  }, [selfieDataUrl, preset, fetchLogoAsDataUrl, isTechMode]);

  // Gallery disabled: always show the latest item (index 0)
  useEffect(() => { setActiveIndex(0); }, [items.length]);

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
          <div
            className="text-white font-medium select-none"
            onClick={() => {
              if (!titleTapTimerRef.current) {
                titleTapTimerRef.current = setTimeout(() => {
                  titleTapCountRef.current = 0;
                  try { clearTimeout(titleTapTimerRef.current); } catch {}
                  titleTapTimerRef.current = null;
                }, 600);
              }
              titleTapCountRef.current += 1;
              if (titleTapCountRef.current >= 3) {
                titleTapCountRef.current = 0;
                try { clearTimeout(titleTapTimerRef.current); } catch {}
                titleTapTimerRef.current = null;
                const next = !isTechMode;
                setIsTechMode(next);
                // Reload list for the selected brand
                loadList(next ? 'TECHTUESDAYS' : 'ARTIFICIAL');
              }
            }}
          >
            {isTechMode ? 'TECHTUESDAYS Merch' : 'ART*FICIAL Merch'}
          </div>
          <button
            className="px-3 py-2 rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
            onClick={() => { loadList(); }}
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
                <button
                  className="text-sm text-zinc-400 hover:text-white"
                  onClick={() => { setSelfieDataUrl(null); setIsCameraOpen(true); }}
                >
                  Retake
                </button>
              </div>
            )}
          </div>

          {/* Middle: presets */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="text-white font-medium mb-3">2. Preset</div>
            {(() => {
              const all = MERCH_PRESETS;
              const count = all.length;
              if (count >= 4) {
                return (
                  <div className="grid grid-cols-4 gap-2">
                    {all.map((p) => (
                      <button
                        key={p.key}
                        className={`w-full px-3 py-2 rounded-md border text-center ${preset===p.key? 'border-indigo-500 text-white bg-indigo-500/10':'border-zinc-700 text-zinc-200 hover:bg-zinc-800'}`}
                        onClick={() => setPreset(p.key)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-2 gap-2">
                  {all.map((p) => (
                    <button
                      key={p.key}
                      className={`w-full px-3 py-2 rounded-md border text-center ${preset===p.key? 'border-indigo-500 text-white bg-indigo-500/10':'border-zinc-700 text-zinc-200 hover:bg-zinc-800'}`}
                      onClick={() => setPreset(p.key)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              );
            })()}
            <div className="mt-6">
              <button
                disabled={!selfieDataUrl || isGenerating}
                onClick={handleGenerate}
                className="w-full px-4 py-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Generating...</span>
                ) : (
                  <span className="flex items-center gap-2"><Sparkles className="w-4 h-4"/> Generate Poster</span>
                )}
              </button>
              {error && <div className="mt-2 text-sm text-red-400">{error}</div>}
            </div>
          </div>

          {/* Right: result */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4" ref={containerRef}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-medium">3. Result</div>
              <button
                className="p-2 rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                title="Delete this poster from Cloudinary"
                disabled={!activeItem || activeItem.isPlaceholder || !(activeItem.url || '').includes('/upload/')}
                onClick={() => { if (activeItem && !activeItem.isPlaceholder && (activeItem.url || '').includes('/upload/')) setShowDeleteConfirm(true); }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <div className="aspect-[3/4] rounded-md bg-zinc-800 flex items-center justify-center overflow-hidden">
                {activeItem ? (
                  <img
                    src={activeItem.url}
                    alt="Poster"
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
              {/* Actions */}
              <div className="mt-4 flex justify-center gap-3">
                <button
                  disabled={!activeItem}
                  onClick={() => setIsOrderOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black hover:bg-zinc-100 disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4"/> Order T-Shirt
                </button>
                <button
                  disabled={!activeItem}
                  onClick={() => {
                    if (!activeItem?.url) return;
                    showQrModal({ url: activeItem.url, title: 'Get this Poster', subtitle: 'Scan to open the poster on your phone', showLink: false, size: 420 });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Get this Poster
                </button>
              </div>
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

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Poster"
          message="Are you sure you want to delete this image? This action cannot be undone."
          confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
          cancelLabel="Cancel"
          onConfirm={async () => {
            if (!activeItem || isDeleting) return;
            try {
              setIsDeleting(true);
              let ok = false;
              const resp = await fetch('/api/merch/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ url: activeItem.url })
              });
              const data = await resp.json().catch(() => ({}));
              if (!resp.ok || data.ok !== true) throw new Error(data.error || 'Delete failed');
              ok = true;
              // Reload list to previous item or placeholder
              await loadList();
            } catch (e) {
              console.error('Delete failed', e);
              // Show inline error under controls; no native prompts
              setError(e?.message || 'Failed to delete');
            } finally {
              setIsDeleting(false);
              // Close dialog only on success; keep open to allow retry on error
              if (ok) {
                setShowDeleteConfirm(false);
                setError(null);
              }
            }
          }}
          onCancel={() => { if (!isDeleting) setShowDeleteConfirm(false); }}
        />
      )}
    </div>
  );
}
