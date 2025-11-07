import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Sparkles } from 'lucide-react';

export function ReimagineModal({ isOpen, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(() => new Set());
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const ver = (typeof window !== 'undefined' && window.__BUILD_ID__) ? window.__BUILD_ID__ : Date.now();
        const resp = await fetch(`/images/reimagine/manifest.json?v=${ver}`, { cache: 'no-store' });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || 'Failed to load');
        if (!mounted) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => it.title.toLowerCase().includes(q));
  }, [items, query]);

  const onPick = (it) => {
    try {
      const prompt = it.title || '';
      // Important: fire reimagine-set first, then set the prompt, so any prompt-clearing logic runs before we set the title
      window.dispatchEvent(new CustomEvent('reimagine-set', { detail: { url: it.url } }));
      window.dispatchEvent(new CustomEvent('prompt-reused', { detail: { prompt } }));
    } catch {}
    try { navigate('/imagine'); } catch { window.location.href = '/imagine'; }
    try { onClose && onClose(); } catch {}
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reimagine Gifts" className="max-w-5xl">
      <div className="overflow-y-auto max-h-[70vh] pr-2">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates..."
              className="flex-1 px-4 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-zinc-600 transition-colors"
            />
          </div>
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/60">
                  <div className="aspect-square relative overflow-hidden">
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-zinc-800 to-zinc-700" />
                  </div>
                  <div className="px-3 py-2">
                    <div className="h-3 w-3/4 bg-zinc-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="text-red-400">{error}</div>
          )}
          {!loading && !error && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((it) => (
                <div key={it.url} className="group rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600 bg-zinc-900/60">
                  <div className="aspect-square bg-zinc-800 relative overflow-hidden">
                    {!loaded.has(it.url) && (
                      <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-zinc-800 to-zinc-700" />
                    )}
                    <img
                      src={it.url}
                      alt={it.title}
                      loading="lazy"
                      onLoad={() => setLoaded((prev) => {
                        const next = new Set(prev);
                        next.add(it.url);
                        return next;
                      })}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${loaded.has(it.url) ? 'opacity-100' : 'opacity-0'}`}
                    />
                  </div>
                  <div className="px-3 py-2 text-left flex items-center justify-between gap-2">
                    <div className="text-sm text-zinc-200 truncate">{it.title}</div>
                    <button
                      onClick={() => onPick(it)}
                      className="py-1 pl-1 pr-0 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 focus:outline-none focus:ring-0"
                      aria-label="Reimagine"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-zinc-500">No items found</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
