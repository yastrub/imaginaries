import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Check, ArrowRight, BadgePercent, Loader2 } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { Button } from './ui/button';
import { useReduxAuth } from '@/hooks/useReduxAuth';

const ANNUAL_DISCOUNT = 0.2; // 20% off annually

// Default descriptions if none provided by backend
const DEFAULT_PLAN_DESCRIPTIONS = {
  free: 'Start imagining—free forever.',
  pro: 'No watermarks. All yours.',
  business: 'Scale your visuals with confidence.',
};

function formatPrice(value) {
  if (value === 0) return '0';
  return value.toFixed(2);
}

export function UpgradePage() {
  const { toast } = useToast();
  const { isAuthenticated, user } = useReduxAuth();
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkingOutPlan, setCheckingOutPlan] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/plans', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load plans');
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        // Ensure sorted by sortOrder then id on the client as well
        list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        if (mounted) setPlans(list);
        // Auto-select free if exists
        if (mounted && list.some(p => p.key === 'free')) setSelectedPlan('free');
      } catch (e) {
        console.error(e);
        if (mounted) setError(e?.message || 'Failed to load plans');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const computedPlans = useMemo(() => {
    return plans.map((p) => {
      const monthly = (p.priceCents ?? 0) / 100;
      const annualExplicit = p.annualPriceCents ? p.annualPriceCents / 100 : null;
      const annual = annualExplicit != null
        ? +annualExplicit.toFixed(2)
        : +((monthly * 12) * (1 - ANNUAL_DISCOUNT)).toFixed(2);
      const savings = +((monthly * 12) - annual).toFixed(2);
      return {
        ...p,
        monthly,
        annual,
        savings,
      };
    });
  }, [plans]);

  const onSubscribe = async (planKey) => {
    const planToUse = planKey || selectedPlan;
    if (planToUse === 'free') return;
    try {
      setIsCheckingOut(true);
      setCheckingOutPlan(planToUse);
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: planToUse, cycle: billingCycle })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      toast({
        title: 'Almost there',
        description: data?.error || 'We could not open checkout automatically. Our team will get you upgraded shortly.',
      });
    } catch (e) {
      toast({
        title: 'Upgrade',
        description: isAuthenticated ? 'Redirecting you to a secure checkout soon.' : 'Please sign in to continue to checkout.',
      });
    } finally {
      setIsCheckingOut(false);
      setCheckingOutPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] pt-24 pb-16">
        <section className="container mx-auto px-4 text-center text-zinc-400">Loading plans…</section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] pt-24 pb-16">
        <section className="container mx-auto px-4 text-center text-red-400">{String(error)}</section>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] pt-24 pb-16">
      <section className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-10 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-600/10 text-purple-300 border border-purple-600/30 mb-4">
            <BadgePercent className="w-4 h-4" />
            <span>Save {Math.round(ANNUAL_DISCOUNT * 100)}% with annual billing</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold text-white mb-4">
            Unlock your creativity with Pro features
          </h1>
          <p className="text-zinc-400">
            Choose a plan that scales with you. Transparent pricing. No hidden fees.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-1 inline-flex">
            <button
              className={`px-4 py-2 rounded-md text-sm ${billingCycle === 'monthly' ? 'bg-purple-600 text-white' : 'text-zinc-300 hover:text-white'}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm ${billingCycle === 'annual' ? 'bg-purple-600 text-white' : 'text-zinc-300 hover:text-white'}`}
              onClick={() => setBillingCycle('annual')}
            >
              Annual - Save {Math.round(ANNUAL_DISCOUNT * 100)}%
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {computedPlans.map((p) => {
            const isSelected = selectedPlan === p.key;
            const price = billingCycle === 'monthly' ? p.monthly : p.annual;
            const suffix = billingCycle === 'monthly' ? '/mo' : '/yr';
            const isFree = p.key === 'free';

            return (
              <div
                key={p.key}
                className={`relative rounded-2xl border ${isSelected ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-zinc-700'} bg-zinc-900/60 backdrop-blur p-6 flex flex-col gap-4`}
                onClick={() => setSelectedPlan(p.key)}
                role="button"
              >
                {/* Badge */}
                {p.key === 'business' && (
                  <div className="absolute -top-3 left-6 text-xs px-3 py-1 rounded-full bg-purple-600 text-white">Most popular</div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{p.name}</h3>
                    {(p.description || DEFAULT_PLAN_DESCRIPTIONS[p.key]) && (
                      <p className="text-sm text-zinc-400 mt-1">
                        {p.description || DEFAULT_PLAN_DESCRIPTIONS[p.key]}
                      </p>
                    )}
                  </div>
                  {isSelected && <Crown className="w-5 h-5 text-purple-400" />}
                </div>

                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-white">${formatPrice(price)}</span>
                  <span className="text-sm text-zinc-400">{suffix}</span>
                </div>

                {billingCycle === 'annual' && !isFree && (
                  <div className="text-xs text-green-400">Save ${formatPrice(p.savings)} per year</div>
                )}

                <ul className="text-sm text-zinc-300 space-y-2 mt-2">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> {p.maxGenerationsPerMonthEffective && p.maxGenerationsPerMonthEffective > 0 ? `${p.maxGenerationsPerMonthEffective} generations per month` : 'Unlimited generations'}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> High-res generations</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> {p.allowPrivateImages ? 'Private galleries' : 'Public gallery only'}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> {p.requiresWatermark ? 'Watermark enabled' : 'No watermark'}</li>
                </ul>

                <div className="mt-auto pt-2">
                  <Button
                    className={`w-full gap-2 ${isFree ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                    disabled={isFree || isCheckingOut}
                    onClick={(e) => { e.stopPropagation(); setSelectedPlan(p.key); if (!isFree) onSubscribe(p.key); }}
                  >
                    {isFree ? (
                      'Current Plan'
                    ) : (
                      <>
                        {isCheckingOut && checkingOutPlan === p.key ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        {isCheckingOut && checkingOutPlan === p.key ? 'Redirecting…' : 'Upgrade now'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="max-w-3xl mx-auto text-center mt-12">
          <div className="bg-gradient-to-r from-purple-600/20 via-fuchsia-600/20 to-purple-600/20 border border-purple-600/30 rounded-2xl p-6">
            <h3 className="text-xl md:text-2xl text-white font-semibold mb-2">Ready to craft stunning jewelry designs?</h3>
            <p className="text-zinc-300 mb-4">Join thousands of creators generating professional-grade visuals with Imaginaries.</p>
            <Button
              className="bg-purple-600 hover:bg-purple-500 text-white gap-2"
              disabled={selectedPlan === 'free' || isCheckingOut}
              onClick={() => onSubscribe()}
            >
              {isCheckingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Crown className="w-4 h-4" />
              )}
              {isCheckingOut ? 'Redirecting…' : 'Continue to checkout'}
            </Button>
            {selectedPlan === 'free' && (
              <p className="text-xs text-zinc-500 mt-2">Select Pro or Business to continue</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default UpgradePage;
