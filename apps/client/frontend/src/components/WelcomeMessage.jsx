import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useSelector } from 'react-redux';

// Create a stable random number generator with a fixed seed
function seededRandom(seed) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Create a memoized version of the component to prevent re-renders
const WelcomeMessageComponent = () => {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = useSelector((state) => !!state?.auth?.isAuthenticated);
  const [authedHint, setAuthedHint] = useState(false);
  useEffect(() => {
    let mounted = true;
    const fetchQuotaOnce = async () => {
      try {
        setLoading(true);
        const qr = await fetch('/api/generate/quota', { credentials: 'include', cache: 'no-store' });
        if (!mounted) return false;
        if (qr.ok) {
          const data = await qr.json();
          setQuota(data);
          return true;
        } else {
          setQuota(null);
          return false;
        }
      } catch {
        if (mounted) setQuota(null);
        return false;
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const fetchQuotaWithRetry = async (retries = 3, waitMs = 400) => {
      for (let i = 0; i < retries; i++) {
        const ok = await fetchQuotaOnce();
        if (!mounted) return;
        if (ok) return;
        await delay(waitMs);
      }
    };

    // initial fetch
    fetchQuotaWithRetry(2, 300);

    // listen for auth changes (setUser/logout dispatches this event)
    const onAuthChanged = (e) => {
      const d = (e && e.detail) || {};
      const authed = !!(d.isAuthenticated ?? d.authenticated ?? d.user);
      if (authed) {
        setAuthedHint(true);
        // Retry a few times to allow auth cookie to propagate
        fetchQuotaWithRetry(3, 400);
        // Schedule a follow-up fetch in case of slow cookie propagation
        setTimeout(() => { if (mounted) fetchQuotaWithRetry(1, 0); }, 1500);
      } else {
        setAuthedHint(false);
        setQuota(null);
      }
    };
    window.addEventListener('auth-state-changed', onAuthChanged);

    // Refresh when window gains focus (after auth flows)
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchQuotaWithRetry(2, 300);
      }
    };
    window.addEventListener('focus', onFocus);

    const onQuotaRefresh = () => {
      fetchQuotaWithRetry(3, 300);
    };
    window.addEventListener('quota-refresh', onQuotaRefresh);

    return () => {
      mounted = false;
      window.removeEventListener('auth-state-changed', onAuthChanged);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('quota-refresh', onQuotaRefresh);
    };
  }, []);

  // Also react to Redux auth state changes directly
  useEffect(() => {
    let mounted = true;
    const fetchAfterAuth = async () => {
      if (!isAuthenticated) { setQuota(null); return; }
      // quick retry loop
      for (let i = 0; i < 3; i++) {
        try {
          const qr = await fetch('/api/generate/quota', { credentials: 'include' });
          if (!mounted) return;
          if (qr.ok) {
            const data = await qr.json();
            setQuota(data);
            return;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 300));
      }
    };
    fetchAfterAuth();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  // Short-lived polling after auth to avoid manual reloads
  useEffect(() => {
    if (!isAuthenticated || quota) return;
    let mounted = true;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const resp = await fetch('/api/generate/quota', { credentials: 'include', cache: 'no-store' });
        if (!mounted) return;
        if (resp.ok) {
          const data = await resp.json();
          setQuota(data);
          clearInterval(timer);
        }
      } catch {}
      if (attempts >= 10) {
        clearInterval(timer);
      }
    }, 600);
    return () => { mounted = false; clearInterval(timer); };
  }, [isAuthenticated, quota]);

  // Fallback polling regardless of auth state to catch modal login without store updates
  useEffect(() => {
    if (quota) return;
    let mounted = true;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const resp = await fetch('/api/generate/quota', { credentials: 'include', cache: 'no-store' });
        if (!mounted) return;
        if (resp.ok) {
          const data = await resp.json();
          setQuota(data);
          clearInterval(timer);
        }
      } catch {}
      if (attempts >= 20) {
        clearInterval(timer);
      }
    }, 1500);
    return () => { mounted = false; clearInterval(timer); };
  }, [quota]);
  // The text to animate
  const text = "What would you like to imagine?";

  // Use useMemo to ensure these calculations only happen once
  const { charElements, styleContent } = useMemo(() => {
    // Split the text into characters (including spaces)
    const chars = text.split('').map((char, index) => ({
      char,
      index: index + 1, // Start at 1 to match :nth-child
    }));

    const elements = chars.map(({ char, index }) => (
      <span key={index} className="char">
        {char}
      </span>
    ));

    // Calculate the total number of characters (including spaces)
    const totalChars = text.length;

    // Generate staggered delays dynamically
    const animationElementsCount = 100;
    const delayBetweenLetters = 0.45;
    const totalDelayTime = animationElementsCount * delayBetweenLetters;
    let delayStyles = '';

    // Apply delays to all characters sequentially (including spaces)
    for (let i = 1; i <= totalChars; i++) {
      const delay = (i * delayBetweenLetters) - totalDelayTime;
      delayStyles += `
        .anim-text-flow .char:nth-child(${i}) {
          animation-delay: ${delay}s;
        }
      `;
    }

    // Create a stable random number generator with a fixed seed
    const random = seededRandom(12345); // Fixed seed for consistent colors

    // Generate keyframes with stable random hues
    const animationSteps = 20;
    let keyframeStyles = '';

    for (let i = 0; i <= animationSteps; i++) {
      const percentage = (i * (100 / animationSteps)).toFixed(2);
      const randomHue = Math.floor(random() * 365);
      keyframeStyles += `
        ${percentage}% {
          color: hsla(${randomHue}, 60%, 60%, 1);
        }
      `;
    }

    // Create the complete style content
    const content = `
      .anim-text-flow {
        display: inline-block;
        white-space: pre-wrap;
      }

      .anim-text-flow .char {
        animation: anim-text-flow-keys 50s infinite alternate;
      }

      @keyframes anim-text-flow-keys {
        ${keyframeStyles}
      }

      ${delayStyles}
    `;

    return { charElements: elements, styleContent: content };
  }, []); // Empty dependency array ensures this only runs once

  return (
    <>
      <style>{styleContent}</style>

      <div className="mb-4 flex justify-center min-h-[28px]">
        {(quota || isAuthenticated || authedHint) ? (
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border text-xs ${quota
              ? (quota.limit === null
                  ? 'border-zinc-700 text-zinc-300'
                  : ((quota.remaining ?? 0) === 0 ? 'border-red-600 text-red-400' : 'border-zinc-700 text-zinc-300'))
              : 'border-zinc-700 text-zinc-300'}`}
            title="Monthly image quota"
          >
            <span>Images left:</span>
            <span>
              {quota ? (quota.limit === null ? '∞' : Math.max(0, quota.remaining ?? 0)) : '…'}
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center justify-center h-[28px] text-zinc-400">
            <Sparkles className="w-5 h-5" />
          </div>
        )}
      </div>

      <h1 className="text-[4.0rem] leading-[1] font-extralight text-center mb-6 tracking-normal">
        <span className="anim-text-flow">
          {charElements}
        </span>
      </h1>
      <p className="text-1xl text-zinc-500 text-center mb-8">
        Create your dream jewelry using the prompt below:
      </p>
    </>
  );
};

// Wrap in React.memo to prevent re-renders
export const WelcomeMessage = React.memo(WelcomeMessageComponent);