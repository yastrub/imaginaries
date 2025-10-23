import React from 'react';
import { Sparkles } from 'lucide-react';
import { useSelector } from 'react-redux';

export function QuotaBadge({ isAuthenticated: isAuthenticatedProp }) {
  const isAuthenticatedFromStore = useSelector((state) => !!state?.auth?.isAuthenticated);
  const isAuthenticated = isAuthenticatedProp ?? isAuthenticatedFromStore;
  const quota = useSelector((state) => state?.quota ? { limit: state.quota.limit, remaining: state.quota.remaining, status: state.quota.status } : { limit: null, remaining: null, status: 'idle' });
  const loading = quota.status === 'loading';

  return (
    <div className="mb-4 flex justify-center min-h-[28px]">
      {(typeof quota.remaining === 'number' || isAuthenticated) ? (
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border text-xs ${
            typeof quota.remaining === 'number'
              ? (quota.limit === null
                  ? 'border-zinc-700 text-zinc-300'
                  : ((quota.remaining ?? 0) === 0 ? 'border-red-600 text-red-400' : 'border-zinc-700 text-zinc-300'))
              : 'border-zinc-700 text-zinc-300'}`}
          title="Monthly image quota"
        >
          <span>Images left:</span>
          <span>
            {loading ? '…' : (typeof quota.remaining === 'number' ? (quota.limit === null ? '∞' : Math.max(0, quota.remaining ?? 0)) : '…')}
          </span>
        </div>
      ) : (
        <div className="inline-flex items-center justify-center h-[28px] text-zinc-400">
          <Sparkles className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
