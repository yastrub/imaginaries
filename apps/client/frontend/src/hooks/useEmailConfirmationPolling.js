import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

export function useEmailConfirmationPolling(enabled = false) {
  const [isPolling, setIsPolling] = useState(false);
  const { toast } = useToast();
  
  const checkConfirmationStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok && data.user?.email_confirmed) {
        setIsPolling(false);
        toast({
          title: "Email Confirmed",
          description: "Your email has been confirmed successfully!",
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking confirmation status:', error);
      return false;
    }
  }, [toast]);

  useEffect(() => {
    if (!enabled) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    let intervalId;

    const startPolling = () => {
      // Check immediately
      checkConfirmationStatus().then(confirmed => {
        if (confirmed) {
          if (intervalId) {
            clearInterval(intervalId);
          }
          return;
        }

        // If not confirmed, start polling every 5 seconds
        intervalId = setInterval(async () => {
          const confirmed = await checkConfirmationStatus();
          if (confirmed && intervalId) {
            clearInterval(intervalId);
          }
        }, 5000);
      });
    };

    startPolling();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIsPolling(false);
    };
  }, [enabled, checkConfirmationStatus]);

  return { isPolling };
}