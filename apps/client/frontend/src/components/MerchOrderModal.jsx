import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { showQrModal } from '../lib/qr';

const SIZES = ['XS','S','M','L','XL','XXL'];

export function MerchOrderModal({ isOpen, onClose, posterUrl }) {
  const [color, setColor] = useState('white'); // 'white' | 'black'
  const [size, setSize] = useState('L');
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
      const resp = await fetch('/api/merch-orders/orders/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceImageUrl: posterUrl,
          merchType: 'T-SHIRT',
          details: { size, color },
          price
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed to create order');
      const url = (data && data.url) ? data.url : `/merch/order/${data.id}`;
      const full = `${window.location.origin}${url}`;
      showQrModal({ url: full, title: 'Continue on your phone', subtitle: 'Scan to complete your order' });
      // keep modal open so user can scan again; also allow close
    } catch (e) {
      console.error('Order draft failed', e);
      alert('Failed to start order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Oversized Unisex T-Shirt" className="max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product mockup */}
        <div>
          <div className="relative bg-white rounded-lg overflow-hidden border border-zinc-700">
            <div className="relative w-full aspect-[1/1] sm:aspect-[4/5] bg-white">
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
                      width: '56%',
                      aspectRatio: '3 / 4',
                      top: '14%',
                      transform: 'translateY(6%)',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 text-sm text-zinc-400">
            Mockup preview. Final print uses your selected poster.
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="text-zinc-200 text-xl font-semibold mb-1">Oversized Unisex T-Shirt</div>
            <div className="text-zinc-400">Price {price.amount} {price.currency}</div>
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-2">Color</div>
            <div className="inline-flex rounded-lg overflow-hidden border border-zinc-700">
              <button onClick={() => setColor('white')} className={`px-4 py-2 ${color==='white'?'bg-zinc-800 text-white':'bg-zinc-900 text-zinc-300'} border-r border-zinc-700`}>White</button>
              <button onClick={() => setColor('black')} className={`px-4 py-2 ${color==='black'?'bg-zinc-800 text-white':'bg-zinc-900 text-zinc-300'}`}>Black</button>
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
