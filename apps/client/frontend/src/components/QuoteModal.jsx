import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, BadgeCheck } from 'lucide-react';
import { Button } from './ui/button';
import { useReduxAuth } from '../hooks/useReduxAuth';
import { useToast } from './ui/use-toast';
import { triggerConfetti, CONFETTI_EVENTS } from './GlobalConfetti';
import { openAuthModal } from './CompletelyIsolatedAuth';

export function QuoteModal({ image, onClose, fromSharePage = false }) {
  const { user, isAuthenticated, isEmailConfirmed } = useReduxAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Estimation, 2: Form (non-authed), 3: Success
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(null); // expected CSV: a,b,c,d
  const [parsedPrices, setParsedPrices] = useState(null); // [n1, n2, n3, n4]
  const [selectedIdx, setSelectedIdx] = useState(null);
  const OPTION_LABELS = [
    'Sterling Silver + Moissanites',
    'Gold Vermeil + Moissanites',
    '18K Gold + Lab Diamonds',
    '18K Gold + Natural Diamonds',
  ];
  
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    message: '',
    estimatedCost: '',
  });

  // Fetch price estimation when the modal opens
  useEffect(() => {
    // Gate by auth: if not authenticated or not confirmed, open auth and close modal
    if (!isAuthenticated || !isEmailConfirmed) {
      openAuthModal();
      onClose();
      return;
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
          setSelectedIdx(null);
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
      // CRITICAL FIX: Ensure all required fields are included for the email template
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
          image: {
            id: image.id,
            prompt: image.prompt,
            url: image.image_url || image.watermarked_url || image.url, // Ensure imageUrl is provided
            createdAt: image.created_at || new Date().toISOString(),
            metadata: image.metadata || {},
            estimatedCost: formData.estimatedCost || estimatedCost || 'Not available'
          }
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send quote request');
      }

      toast({
        title: "Quote request sent",
        description: "We'll get back to you soon!",
      });

      onClose();
    } catch (error) {
      setError(error.message);
      toast({
        title: "Failed to send quote request",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatUSD = (n) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); } catch { return `$${Math.round(n).toLocaleString('en-US')}`; }
  };

  const handleOrder = async (idx) => {
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
          notes: '',
          estimatedPriceText: estimatedCost || formData.estimatedCost || null,
          selectedOption: option,
          selectedPriceCents: Math.round(price * 100),
        })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to place order');
      }
      triggerConfetti(CONFETTI_EVENTS.PRICE_ESTIMATION);
      setStep(3);
    } catch (e) {
      setError(e.message);
      toast({ title: 'Order failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrderSelected = async () => {
    if (selectedIdx == null) return;
    await handleOrder(selectedIdx);
  };
  
  // Handle backdrop click to close modal
  const handleBackdropClick = (e) => {
    // Only close if clicking directly on the backdrop
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal content */}
      <div className="bg-zinc-900 rounded-xl w-full max-w-lg overflow-hidden shadow-xl relative z-[101]">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {step === 1 ? "Jewelry Price Estimation" : step === 2 ? "Request a Quote (Order)" : "Order Placed"}
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
        
        <div className="p-6">
          <div className="flex gap-4 mb-6">
            <div className="w-1/3">
              <img
                src={image.image_url || image.url}
                alt={image.prompt}
                className="w-full aspect-square object-cover rounded-lg"
              />
            </div>
            <div className="w-2/3 flex flex-col">
              {!fromSharePage && image.prompt && (
                <div className="max-h-[120px] overflow-y-auto pr-2 mb-2 scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent scrollbar-track-rounded-md scrollbar-thumb-rounded-md">
                  <p className="text-zinc-300 text-sm">{image.prompt}</p>
                </div>
              )}
              {/* Only show date if it exists and is a valid date */}
              {!fromSharePage && (() => {
                // Get the date value, if any
                const dateValue = image.created_at || image.createdAt;
                
                // Check if it exists and is a valid date
                if (dateValue && !isNaN(new Date(dateValue).getTime())) {
                  return (
                    <p className="text-zinc-500 text-xs mt-auto">
                      Created on {new Date(dateValue).toLocaleDateString()}
                    </p>
                  );
                }
                
                // Return null if no valid date
                return null;
              })()}
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
                        return (
                          <label key={idx} className={`flex items-center justify-between gap-4 rounded-md border p-4 cursor-pointer transition-colors ${active ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-700/70 bg-zinc-900/70 hover:border-zinc-600'}`}
                                 onClick={() => setSelectedIdx(idx)}>
                            <input
                              type="radio"
                              name="quote-option"
                              className="sr-only"
                              checked={active}
                              onChange={() => setSelectedIdx(idx)}
                              aria-label={label}
                            />
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 ${active ? 'border-amber-400' : 'border-zinc-600'}`}>
                                <span className={`block w-3 h-3 rounded-full ${active ? 'bg-amber-400' : 'bg-transparent'}`}></span>
                              </span>
                              <div className="text-zinc-200 text-sm leading-tight">{label}</div>
                            </div>
                            <div className="text-amber-300 font-semibold">{formatUSD(parsedPrices[idx])}</div>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-4">
                      <Button className="w-full" disabled={selectedIdx == null || isSubmitting} onClick={handleOrderSelected}>
                        Order Selected
                      </Button>
                    </div>
                    <p className="text-zinc-500 text-xs mt-3 text-center">Final pricing may vary based on precise materials, sizing, and customization. Production by <strong>OCTADIAM</strong>, Dubai, UAE.</p>
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
                    <Button className="w-full max-w-xs" disabled>Order Selected</Button>
                  </div>
                </div>
              )}
            </div>
          ) : step === 2 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {estimatedCost && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-amber-400 text-sm font-medium">Estimated Price Range:</p>
                  <p className="text-amber-300 text-lg font-bold">{estimatedCost} USD</p>
                </div>
              )}
              
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-zinc-400 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1">
                  Your Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={user?.email || ''}
                  readOnly
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-zinc-400 mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white resize-none"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send a Request'
                  )}
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
