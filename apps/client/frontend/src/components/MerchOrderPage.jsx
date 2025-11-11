import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';

const SIZES = ['XS','S','M','L','XL','XXL'];

export function MerchOrderPage() {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        if (id) {
          const resp = await fetch(`/api/merch-orders/orders/${id}`, { credentials: 'include', cache: 'no-store' });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data?.error || 'Failed to load order');
          if (!mounted) return;
          setOrder(data.order);
          const od = data.order?.order_details || {};
          if (od.first_name) setFirstName(od.first_name);
          if (od.last_name) setLastName(od.last_name);
          if (od.phone) setPhone(od.phone);
          if (od.email) setEmail(od.email);
          // Prefer qty from order, but allow explicit override via QR param
          const sp = new URLSearchParams(location.search);
          const qrQty = Number(sp.get('qty'));
          if (Number.isFinite(qrQty) && qrQty > 0) {
            setQty(qrQty);
          } else {
            setQty(Number.isFinite(Number(data.order?.qty)) ? Number(data.order.qty) : 1);
          }
        } else {
          // Query-based flow: src, color, size, amount, currency
          const sp = new URLSearchParams(location.search);
          const src = sp.get('src');
          const color = (sp.get('color') || 'white').toLowerCase();
          const size = (sp.get('size') || 'L').toUpperCase();
          const amount = Number(sp.get('amount') || '160');
          const currency = sp.get('currency') || 'AED';
          if (!src) throw new Error('Missing poster image');
          const now = new Date().toISOString();
          setOrder({
            id: 'new',
            status: 'draft',
            merch_type: 'T-SHIRT',
            source_image: src,
            merch_details: { size, color },
            merch_price: { amount, currency },
            created_at: now,
            updated_at: now
          });
          const q = Number(sp.get('qty'));
          setQty(Number.isFinite(q) && q > 0 ? q : 1);
        }
      } catch (e) {
        if (!mounted) return;
        setError(e.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, location.search]);

  const posterUrl = order?.source_image;
  const color = order?.merch_details?.color || 'white';
  const size = order?.merch_details?.size || 'L';
  const price = order?.merch_price || { amount: 160, currency: 'AED' };

  const shirtSrc = useMemo(() => (
    color === 'black' ? '/images/t-shirt-oversized-black.jpg' : '/images/t-shirt-oversized-white.jpg'
  ), [color]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!order) return;
    try {
      setSubmitting(true);
      if (id) {
        const resp = await fetch(`/api/merch-orders/orders/${id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ firstName, lastName, phone, email, comments, qty })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || 'Failed to submit order');
      } else {
        // Create draft then submit
        const draftResp = await fetch('/api/merch-orders/orders/draft', {
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
        const draftData = await draftResp.json();
        if (!draftResp.ok) throw new Error(draftData?.error || 'Failed to create order');
        const newId = draftData.id;
        const submitResp = await fetch(`/api/merch-orders/orders/${newId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ firstName, lastName, phone, email, comments, qty })
        });
        const submitData = await submitResp.json();
        if (!submitResp.ok) throw new Error(submitData?.error || 'Failed to submit order');
      }
      setSubmitted(true);
    } catch (e) {
      alert(e.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-xl font-semibold">Merch Checkout</div>
          <div />
        </div>
        {loading && (
          <div className="text-zinc-400">Loading order…</div>
        )}
        {error && (
          <div className="text-red-400">{error}</div>
        )}
        {order && !submitted && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Preview */}
            <div>
              <div className="relative bg-white rounded-lg overflow-hidden border border-zinc-700">
                <div className="relative w-full aspect-[1/1] sm:aspect-[4/5] bg-white">
                  <img src={shirtSrc} alt={`${color} shirt`} className="absolute inset-0 w-full h-full object-contain" />
                  {posterUrl && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <img
                        src={posterUrl}
                        alt="Poster"
                        className="object-contain"
                        style={{ width: '33%', aspectRatio: '3 / 4', position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%, 0)' }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 text-sm text-zinc-400">
                Color: <span className="text-zinc-200">{color}</span> · Size: <span className="text-zinc-200">{size}</span> · Qty: <span className="text-zinc-200">{qty}</span>
              </div>
              <div className="text-sm text-zinc-400">Price: <span className="text-zinc-200">{price.amount} {price.currency}</span></div>
            </div>

            {/* Form */}
            <div>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="text-lg font-semibold">Complete Order</div>
                <div className="text-sm text-zinc-400 -mt-1">We will contact you to confirm and provide payment information.</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">First Name</label>
                    <input className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-600" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Last Name</label>
                    <input className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-600" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Phone</label>
                  <input className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-600" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Email</label>
                  <input type="email" className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-600" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                {/* Quantity is preselected on terminal; show under image only, not editable here */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Comments</label>
                  <textarea rows={4} className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-600" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Anything we should know?" />
                </div>
                <button type="submit" disabled={submitting} className="w-full h-12 rounded-md bg-white text-black font-semibold hover:bg-zinc-100 disabled:opacity-50">
                  {submitting ? 'Placing Order…' : 'Place Order'}
                </button>
                <div className="text-xs text-zinc-500">By placing order you agree with our terms.</div>
              </form>
            </div>
          </div>
        )}
        {order && submitted && (
          <div className="max-w-md mx-auto text-center py-20">
            <div className="text-2xl font-semibold mb-3">Thank you!</div>
            <div className="text-zinc-400 mb-6">Your order has been placed. We will contact you shortly.</div>
            <div className="text-sm text-zinc-500">Order ID</div>
            <div className="text-sm text-zinc-300 mb-8 break-all">{order.id}</div>
            <Link to="/merch" className="px-5 py-3 rounded-md bg-white text-black font-semibold hover:bg-zinc-100">Back to Merch</Link>
          </div>
        )}
      </div>
    </div>
  );
}
