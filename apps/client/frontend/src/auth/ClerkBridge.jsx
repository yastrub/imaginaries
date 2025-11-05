import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';

export function ClerkBridge() {
  const { isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const exchangingRef = useRef(false);
  const lastUserIdRef = useRef(null);

  useEffect(() => {
    const sync = async () => {
      if (isSignedIn) {
        const clerkId = user?.id || null;
        if (clerkId && lastUserIdRef.current === clerkId) return;
        if (exchangingRef.current) return;
        exchangingRef.current = true;
        try {
          const token = await getToken();
          const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || null;
          const firstName = user?.firstName || null;
          const lastName = user?.lastName || null;
          const res = await fetch('/api/auth/clerk/exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token, email, firstName, lastName })
          });
          if (!res.ok) {
            // If our exchange failed, ensure Clerk signs out to avoid mismatch
            try { await signOut(); } catch {}
          } else {
            lastUserIdRef.current = clerkId;
          }
        } catch {
          try { await signOut(); } catch {}
        } finally {
          exchangingRef.current = false;
        }
      } else {
        // If user signed out in Clerk, clear our cookie
        try {
          await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
        } catch {}
        lastUserIdRef.current = null;
      }
    };
    sync();
  }, [isSignedIn, getToken, user, signOut]);

  return null;
}
