import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { showQrModal } from '../lib/qr';

const SIZES = ['XS','S','M','L','XL','XXL'];

export function MerchOrderModal({ isOpen, onClose, posterUrl }) {
  const [color, setColor] = useState('white'); // 'white' | 'black'
  const [size, setSize] = useState('L');
  const [qty, setQty] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const price = { amount: 160, currency: 'AED' };

  const shirtSrc = useMemo(() => {
    return color === 'black'
      ? '/images/t-shirt-oversized-black.jpg'
      : '/images/t-shirt-oversized-white.jpg';
  }, [color]);

  const handleContinue = async () => {
    if (!posterUrl) return;
    try {
      setIsSubmitting(true);
      // Create a draft merch order so we can copy the image to merch/orders and have a stable link
      const resp = await fetch('/api/merch-orders/orders/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceImageUrl: posterUrl,
          merchType: 'T-SHIRT',
          details: { size, color },
          price,
          qty
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed to start order');
      const url = data?.url || `/merch/order/${data?.id}`;
      const base = `${window.location.origin}${url}`;
      const u = new URL(base);
      u.searchParams.set('qty', String(Math.max(1, Number(qty) || 1)));
      const full = u.toString();
      showQrModal({ url: full, title: 'Continue on your phone', subtitle: 'Scan to complete your order', showLink: false });
    } catch (e) {
      console.error('QR open failed', e);
      alert('Failed to open QR. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Order T-Shirt" className="max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product mockup */}
        <div>
          <div className="relative bg-white rounded-lg overflow-hidden border border-zinc-700">
            <div className="relative w-full aspect-square bg-white">
              {/* Base shirt */}
              <img src={shirtSrc} alt={`${color} shirt`} className="absolute inset-0 w-full h-full object-contain" />
              {/* Poster overlay */}
              {posterUrl && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src={posterUrl}
                    alt="Poster"
                    className="object-contain"
                    style={{
                      width: '33%',
                      aspectRatio: '3 / 4',
                      position: 'absolute',
                      top: '25%',
                      left: '50%',
                      transform: 'translate(-50%, 0)',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="text-zinc-200 text-xl font-semibold mb-1">Oversized Unisex T-Shirt</div>
            <div className="text-zinc-400">Price {price.amount} {price.currency}</div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm text-zinc-400 mb-2">Color</div>
              <div className="inline-flex rounded-lg overflow-hidden border border-zinc-700">
                <button onClick={() => setColor('white')} className={`px-4 py-2 ${color==='white'?'bg-zinc-800 text-white':'bg-zinc-900 text-zinc-300'} border-r border-zinc-700`}>White</button>
                <button onClick={() => setColor('black')} className={`px-4 py-2 ${color==='black'?'bg-zinc-800 text-white':'bg-zinc-900 text-zinc-300'}`}>Black</button>
              </div>
            </div>
            <div className="flex-none">
              <div className="text-sm text-zinc-400 mb-2 text-right">Quantity</div>
              <div className="inline-flex items-center rounded-lg border border-zinc-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, (Number(q)||1) - 1))}
                  className="px-3 py-2 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 text-center px-2 py-2 bg-zinc-900 text-white outline-none"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, (Number(q)||1) + 1))}
                  className="px-3 py-2 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-2">Size</div>
            <div className="grid grid-cols-6 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`px-3 py-2 text-sm rounded-md border ${size===s?'border-white text-white bg-zinc-800':'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
                >{s}</button>
              ))}
            </div>
          </div>



          <div className="pt-2">
            <button
              className="w-full h-12 rounded-md bg-white text-black font-semibold hover:bg-zinc-100 disabled:opacity-50"
              onClick={handleContinue}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Starting…' : 'Continue'}
            </button>
            <div className="text-xs text-zinc-500 mt-2">
              You will scan a QR code to continue on your phone and complete the order.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
