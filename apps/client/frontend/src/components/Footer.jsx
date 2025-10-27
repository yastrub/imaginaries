import React from 'react';
import { useLocation } from 'react-router-dom';
// Bug report moved to Account menu in Header

export function Footer({ isAuthenticated }) {
  const location = useLocation();
  if (location?.pathname?.startsWith('/share')) return null;
  return (
    <footer className="mt-auto py-4 px-6">
      <div className="flex justify-between items-center">
        <div className="text-zinc-600 text-sm">© OCTADIAM FZCO</div>
      </div>
    </footer>
  );
}
