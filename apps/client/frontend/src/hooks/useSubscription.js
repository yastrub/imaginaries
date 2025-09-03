import { useState, useEffect } from 'react';
import { getPlanConfig } from '@/config/plans';

export function useSubscription(userId) {
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch subscription');
        }

        const data = await response.json();
        const planConfig = getPlanConfig(data.subscription_plan);
        setPlan(planConfig);
      } catch (err) {
        console.error('Error fetching subscription:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [userId]);

  return { plan, isLoading, error };
}