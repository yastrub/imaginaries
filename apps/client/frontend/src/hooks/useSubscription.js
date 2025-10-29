import { useState, useEffect } from 'react';

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

    const fetchSubscription = async () => {
      try {
        const response = await fetch(`/api/users/me`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch subscription');
        }

        const data = await response.json();
        // Use DB-backed plan_details directly
        setPlan(data.plan_details || null);
        setMeta({
          effective_limit: data.effective_limit ?? 0,
          monthly_generation_count: data.monthly_generation_count ?? 0,
          next_reset_at: data.next_reset_at ?? null,
        });
      } catch (err) {
        console.error('Error fetching subscription:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [userId]);

  return { plan, isLoading, error, meta };
}