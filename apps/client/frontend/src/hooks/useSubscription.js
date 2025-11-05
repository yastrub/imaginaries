import { useState, useEffect } from 'react';

// Simple module-level cache to dedupe concurrent requests and throttle frequency
const SUBSCRIPTION_CACHE = {
  userId: null,
  data: null,
  meta: { effective_limit: 0, monthly_generation_count: 0, next_reset_at: null },
  error: null,
  updatedAt: 0,
  pending: null, // Promise
};

const TTL_MS = 60 * 1000; // cache for 60s

export function useSubscription(userId) {
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ effective_limit: 0, monthly_generation_count: 0, next_reset_at: null });

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const now = Date.now();
    const isSameUser = SUBSCRIPTION_CACHE.userId === userId;
    const isFresh = isSameUser && (now - SUBSCRIPTION_CACHE.updatedAt) < TTL_MS && SUBSCRIPTION_CACHE.data;

    // If we have fresh cached data, use it immediately
    if (isFresh) {
      setPlan(SUBSCRIPTION_CACHE.data?.plan_details || null);
      setMeta(SUBSCRIPTION_CACHE.meta || { effective_limit: 0, monthly_generation_count: 0, next_reset_at: null });
      setError(null);
      setIsLoading(false);
      return;
    }

    // If a request is in flight for this user, attach to it
    if (SUBSCRIPTION_CACHE.pending && isSameUser) {
      SUBSCRIPTION_CACHE.pending
        .then((data) => {
          setPlan(data?.plan_details || null);
          setMeta({
            effective_limit: data?.effective_limit ?? 0,
            monthly_generation_count: data?.monthly_generation_count ?? 0,
            next_reset_at: data?.next_reset_at ?? null,
          });
          setError(null);
        })
        .catch((err) => {
          console.error('Error fetching subscription:', err);
          setError(err?.message || 'Failed to fetch subscription');
        })
        .finally(() => setIsLoading(false));
      return;
    }

    // Otherwise start a new request and share it
    SUBSCRIPTION_CACHE.userId = userId;
    setIsLoading(true);
    SUBSCRIPTION_CACHE.pending = fetch(`/api/users/me`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch subscription');
        }
        const data = await response.json();
        SUBSCRIPTION_CACHE.data = data;
        SUBSCRIPTION_CACHE.meta = {
          effective_limit: data.effective_limit ?? 0,
          monthly_generation_count: data.monthly_generation_count ?? 0,
          next_reset_at: data.next_reset_at ?? null,
        };
        SUBSCRIPTION_CACHE.error = null;
        SUBSCRIPTION_CACHE.updatedAt = Date.now();
        return data;
      })
      .catch((err) => {
        SUBSCRIPTION_CACHE.error = err;
        throw err;
      })
      .finally(() => {
        SUBSCRIPTION_CACHE.pending = null;
      });

    SUBSCRIPTION_CACHE.pending
      .then((data) => {
        setPlan(data?.plan_details || null);
        setMeta(SUBSCRIPTION_CACHE.meta);
        setError(null);
      })
      .catch((err) => {
        console.error('Error fetching subscription:', err);
        setError(err?.message || 'Failed to fetch subscription');
      })
      .finally(() => setIsLoading(false));
  }, [userId]);

  return { plan, isLoading, error, meta };
}