import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { X, Loader2, DollarSign, BadgeCheck, Info } from 'lucide-react';
import { Button } from './ui/button';
import { useReduxAuth } from '../hooks/useReduxAuth';
import { useToast } from './ui/use-toast';
import { triggerConfetti, CONFETTI_EVENTS } from './GlobalConfetti';
import { showQrModal } from '../lib/qr';
import { openAuthModal } from './CompletelyIsolatedAuth';
import { useViewportOverlay } from '../hooks/useViewportOverlay';

export function QuoteModal({ image, onClose, fromSharePage = false }) {
  const { user, isAuthenticated, isEmailConfirmed } = useReduxAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Estimation, 2: Order Details, 3: Success
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(null); // expected CSV: a,b,c,d
  const [parsedPrices, setParsedPrices] = useState(null); // [n1, n2, n3, n4]
  const overlayStyle = useViewportOverlay();
  const [selectedIdx, setSelectedIdx] = useState(null);
  const initialPriceIdxRef = useRef(null);
  const isTerminalApp = useSelector((state) => state?.env?.isTerminalApp);
  const [showFactoryVideo, setShowFactoryVideo] = useState(false);
  const OPTION_LABELS = [
    'Sterling Silver + Moissanites',
    'Gold Vermeil + Moissanites',
    '18K Gold + Lab Diamonds',
    '18K Gold + Natural Diamonds',
  ];
  
  const [formData, setFormData] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    phone: user?.phone || '',
    notes: '',
    email: user?.email || '',
    estimatedCost: '',
  });

  // Fetch price estimation when the modal opens
  useEffect(() => {
    // Read desired preselected option from URL (if coming from QR)
    try {
      const sp = new URLSearchParams(window.location.search);
      const pi = sp.get('priceIdx');
      const n = pi != null ? Number(pi) : null;
      if (Number.isInteger(n) && n >= 0 && n < 4) {
        initialPriceIdxRef.current = n;
      }
    } catch {}
    // In Terminal app, allow QR flow without auth gating
    if (!isTerminalApp) {
      // Gate by auth: if not authenticated or not confirmed, open auth and close modal
      if (!isAuthenticated || !isEmailConfirmed) {
        openAuthModal();
        onClose();
        return;
      }
    }
    if (step === 1) {
      fetchEstimation();
    }
  }, []);

  const fetchEstimation = async () => {
    setIsEstimating(true);
    setError(null);

    try {
      console.log('QuoteModal: Fetching estimation for image:', image);
      
      // Only use cached estimatedCost if explicitly instructed
      // For shared images, we always want to make a fresh API call
      const useCache = image.useCache === true;
      if (useCache && image.estimatedCost) {
        console.log('QuoteModal: Using cached estimation:', image.estimatedCost);
        setEstimatedCost(image.estimatedCost);
        setFormData(prev => ({ ...prev, estimatedCost: image.estimatedCost }));
        setIsEstimating(false);
        return;
      }

      // Request estimation from the server
      console.log('QuoteModal: Making API call to get estimation for image ID:', image.id);
      const response = await fetch(`/api/generate/estimate/${image.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageId: image.id }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get price estimation');
      }

      const data = await response.json();
      console.log('QuoteModal: Received estimation data:', data);

      const legacy = data.estimatedCost || data.estimated_cost || 'N/A';
      setEstimatedCost(legacy);
      setFormData(prev => ({ ...prev, estimatedCost: legacy }));

      // Parse CSV into 4 numbers and reset selection
      if (typeof legacy === 'string') {
        const parts = legacy.split(',').map(s => s.trim()).filter(Boolean);
        const nums = parts.map(p => Number(String(p).replace(/[^0-9.]/g, ''))).filter(n => Number.isFinite(n));
        if (nums.length >= 4) {
          setParsedPrices(nums.slice(0,4));
          // Apply preselected index from URL if valid
          const pre = initialPriceIdxRef.current;
          if (Number.isInteger(pre) && pre >= 0 && pre < 4) {
            setSelectedIdx(pre);
          } else {
            setSelectedIdx(null);
          }
        } else {
          setParsedPrices(null);
          setSelectedIdx(null);
        }
      } else {
        setParsedPrices(null);
        setSelectedIdx(null);
      }
      
      // Trigger global confetti effect when we get the price
      triggerConfetti(CONFETTI_EVENTS.PRICE_ESTIMATION);
    } catch (error) {
      setError(error.message);
      toast({
        title: "Failed to get price estimation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      const fn = (formData.firstName || '').trim();
      const ln = (formData.lastName || '').trim();
      const ph = (formData.phone || '').trim();
      const em = (user?.email || '').trim();
      if (!fn || !ln || !ph || !em) {
        throw new Error('Please fill in first name, last name, phone number, and email');
      }
      // Submit order with details
      await handleOrder(selectedIdx, {
        firstName: fn,
        lastName: ln,
        phone: ph,
        notes: (formData.notes || '').trim(),
      });
      setStep(3);
    } catch (error) {
      setError(error.message);
      toast({ title: 'Order failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatUSD = (n) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); } catch { return `$${Math.round(n).toLocaleString('en-US')}`; }
  };

  const handleOrder = async (idx, details = {}) => {
    if (!Array.isArray(parsedPrices) || parsedPrices.length < 4) return;
    if (!isAuthenticated || !isEmailConfirmed) {
      openAuthModal();
      return;
    }
    const price = Number(parsedPrices[idx]) || 0;
    const option = OPTION_LABELS[idx];
    try {
      setIsSubmitting(true);
      setError(null);
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          imageId: image.id,
          notes: details.notes || '',
          estimatedPriceText: estimatedCost || formData.estimatedCost || null,
          selectedOption: option,
          selectedPriceCents: Math.round(price * 100),
          firstName: details.firstName || undefined,
          lastName: details.lastName || undefined,
          phone: details.phone || undefined,
        })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to place order');
      }
      triggerConfetti(CONFETTI_EVENTS.PRICE_ESTIMATION);
      // step set handled by caller (submit)
    } catch (e) {
      setError(e.message);
      toast({ title: 'Order failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrderSelected = async () => {
    if (isTerminalApp) {
      const sp = new URLSearchParams({ quote: '1' });
      if (selectedIdx != null) sp.set('priceIdx', String(selectedIdx));
      const shareUrl = `${window.location.origin}/share/${image.id}?${sp.toString()}`;
      showQrModal({ url: shareUrl, title: 'Continue on your phone', subtitle: 'Scan to open order page for this design', showLink: false });
      return;
    }
    if (selectedIdx == null) return;
    // Move to order details form
    setStep(2);
  };
  
  // Handle backdrop click to close modal
  const handleBackdropClick = (e) => {
    // Only close if clicking directly on the backdrop
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed flex items-center justify-center z-[100] p-4" style={overlayStyle}>
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal content */}
      <div className="bg-zinc-900 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-xl relative z-[101]">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {step === 1 ? "Jewelry Price Estimation" : step === 2 ? "Order Details" : "Order Placed"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      {showFactoryVideo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowFactoryVideo(false)} />
          <div className="relative bg-zinc-900 rounded-xl w-full max-w-3xl mx-4 overflow-hidden shadow-2xl border border-zinc-800">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-white text-base font-medium">OctaDiam Factory</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFactoryVideo(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/M_hpIZYApOY?autoplay=1&rel=0&modestbranding=1&playsinline=1&color=white"
                title="OctaDiam Factory"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
        
        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          <div className="flex gap-4 mb-6">
            <div className="w-24 sm:w-28 md:w-32 flex-shrink-0">
              <img
                src={image.image_url || image.url}
                alt={image.prompt}
                className="w-full aspect-square object-cover rounded-lg"
              />
            </div>
            <div className="flex-1 flex flex-col">
              {!fromSharePage && image.prompt && (
                <div className="max-h-[120px] overflow-y-auto pr-2 mb-2 scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent scrollbar-track-rounded-md scrollbar-thumb-rounded-md">
                  <p className="text-zinc-100 text-base sm:text-lg font-medium leading-snug">{image.prompt}</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-6">
              {isEstimating ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                  <p className="text-zinc-300 text-center">Estimating your jewelry price...</p>
                  <p className="text-zinc-500 text-sm text-center mt-2">This may take a moment</p>
                </div>
              ) : Array.isArray(parsedPrices) && parsedPrices.length >= 4 ? (
                <div className="space-y-6">
                  <div className="rounded-lg p-4 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-zinc-700/60">
                    <div className="flex items-center gap-2 mb-3 pl-2.5">
                      <BadgeCheck className="w-5 h-5 text-amber-400" />
                      <h3 className="text-zinc-200 text-sm">Select a material & stone configuration</h3>
                    </div>
                    <div role="radiogroup" className="space-y-1.5">
                      {OPTION_LABELS.map((label, idx) => {
                        const active = selectedIdx === idx;
                        const price = Number(parsedPrices[idx]) || 0;
                        const disabled = price < 100; // disable options under $100
                        return (
                          <label
                            key={idx}
                            className={`flex items-center justify-between gap-4 rounded-md border p-4 transition-colors ${
                              disabled
                                ? 'border-zinc-700/50 bg-zinc-900/40 opacity-50 cursor-not-allowed'
                                : active
                                  ? 'border-amber-400 bg-amber-500/10 cursor-pointer'
                                  : 'border-zinc-700/70 bg-zinc-900/70 hover:border-zinc-600 cursor-pointer'
                            }`}
                            onClick={() => { if (!disabled) setSelectedIdx(idx); }}
                            aria-disabled={disabled}
                          >
                            <input
                              type="radio"
                              name="quote-option"
                              className="sr-only"
                              checked={active}
                              onChange={() => { if (!disabled) setSelectedIdx(idx); }}
                              aria-label={label}
                              disabled={disabled}
                            />
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 ${
                                disabled ? 'border-zinc-700' : active ? 'border-amber-400' : 'border-zinc-600'
                              }`}>
                                <span className={`block w-3 h-3 rounded-full ${
                                  disabled ? 'bg-transparent' : active ? 'bg-amber-400' : 'bg-transparent'
                                }`}></span>
                              </span>
                              <div className="text-zinc-200 text-sm leading-tight">{label}</div>
                            </div>
                            <div className={`${disabled ? 'text-zinc-400' : 'text-amber-300'} font-semibold`}>{formatUSD(price)}</div>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-4">
                      <Button className="w-full" disabled={!isTerminalApp && (selectedIdx == null || isSubmitting)} onClick={handleOrderSelected}>
                        {isTerminalApp ? 'Continue' : 'Order Selected'}
                      </Button>
                    </div>
                    <div className="text-zinc-500 text-xs mt-3 flex items-center justify-between gap-2">
                      <span>Final pricing may vary based on precise materials, sizing, and customization. Production by <strong>OCTADIAM</strong>, Dubai, UAE.</span>
                      <button
                        type="button"
                        aria-label="About OctaDiam factory"
                        title="About OctaDiam factory"
                        onClick={() => setShowFactoryVideo(true)}
                        className="p-1 rounded-full border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6">
                    <div className="flex items-center justify-center mb-3">
                      <DollarSign className="w-8 h-8 text-amber-400" />
                    </div>
                    <h3 className="text-center text-lg font-medium text-amber-400 mb-2">Estimated Price</h3>
                    <p className="text-center text-2xl font-bold text-amber-300 mb-4">{estimatedCost ? `${estimatedCost} USD` : 'N/A'}</p>
                    <p className="text-justify text-zinc-300 text-xs">We could not compute all four options automatically. Please refresh estimation later or contact support. Ordering is disabled until a valid estimate is available.</p>
                  </div>
                  <div className="flex justify-center">
                    {isTerminalApp ? (
                      <Button className="w-full max-w-xs" onClick={() => showQrModal({ url: `${window.location.origin}/share/${image.id}?quote=1`, title: 'Continue on your phone', subtitle: 'Scan to open order page for this design', showLink: false })}>
                        Continue
                      </Button>
                    ) : (
                      <Button className="w-full max-w-xs" disabled>Order Selected</Button>
                    )}
                  </div>
                  <div className="text-zinc-500 text-xs mt-3 flex items-center justify-between gap-2">
                    <span>Final pricing may vary based on precise materials, sizing, and customization. Production by <strong>OCTADIAM</strong>, Dubai, UAE.</span>
                    <button
                      type="button"
                      aria-label="About OctaDiam factory"
                      title="About OctaDiam factory"
                      onClick={() => setShowFactoryVideo(true)}
                      className="p-1 rounded-full border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : step === 2 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {(() => {
                if (selectedIdx != null && Array.isArray(parsedPrices) && parsedPrices.length >= 4) {
                  const price = Number(parsedPrices[selectedIdx]) || 0;
                  const label = OPTION_LABELS[selectedIdx];
                  return (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-amber-400 text-sm font-medium">Selected Option:</p>
                      <p className="text-amber-300 text-lg font-bold">{label} — {formatUSD(price)}</p>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-zinc-400 mb-1">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-zinc-400 mb-1">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-zinc-400 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g., +971 50 123 4567"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1">Email *</label>
                <input
                  type="email"
                  id="email"
                  value={user?.email || ''}
                  readOnly
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-zinc-400 mb-1">Notes (optional)</label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white resize-none"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={isSubmitting}>Back</Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" />Placing order...</>) : 'Place Order'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
                Your order has been received! Our team will contact you at <span className="font-medium">{user?.email}</span> shortly.
              </div>
              <div className="flex justify-end">
                <Button onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
