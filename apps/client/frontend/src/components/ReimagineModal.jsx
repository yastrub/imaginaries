import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';

export function ReimagineModal({ isOpen, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
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
            <div className="text-zinc-400">Loading…</div>
          )}
          {error && (
            <div className="text-red-400">{error}</div>
          )}
          {!loading && !error && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((it) => (
                <button key={it.url} onClick={() => onPick(it)} className="group rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600 bg-zinc-900/60">
                  <div className="aspect-square bg-zinc-800">
                    <img src={it.url} alt={it.title} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                  </div>
                  <div className="px-3 py-2 text-left">
                    <div className="text-sm text-zinc-200 truncate">{it.title}</div>
                  </div>
                </button>
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
