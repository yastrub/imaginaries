import React from 'react';
import { useLocation } from 'react-router-dom';
import { TermsOfUseModal } from './TermsOfUseModal';
import { RefundPolicyModal } from './RefundPolicyModal';
// Bug report moved to Account menu in Header

export function Footer({ isAuthenticated }) {
  const location = useLocation();
  if (location?.pathname?.startsWith('/share')) return null;
  const [openTerms, setOpenTerms] = React.useState(false);
  const [openRefund, setOpenRefund] = React.useState(false);
  return (
    <footer className="mt-auto py-4 px-6 relative">
      <div className="flex justify-between items-center">
        <div className="text-zinc-600 text-sm">© OCTADIAM FZCO</div>
        <div className="text-xs text-zinc-500 space-x-4">
          <button className="hover:text-zinc-300 underline underline-offset-4" onClick={() => setOpenTerms(true)}>
            Terms of Service
          </button>
          <span className="text-zinc-500 opacity-60 select-none" aria-hidden="true">|</span>
          <button className="hover:text-zinc-300 underline underline-offset-4" onClick={() => setOpenRefund(true)}>
            Refund Policy
          </button>
        </div>
      </div>
      {openTerms && <TermsOfUseModal onClose={() => setOpenTerms(false)} />}
      {openRefund && <RefundPolicyModal onClose={() => setOpenRefund(false)} />}
    </footer>
  );
}
