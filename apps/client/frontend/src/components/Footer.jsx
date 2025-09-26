import React from 'react';
// Bug report moved to Account menu in Header

export function Footer({ isAuthenticated }) {
  return (
    <footer className="mt-auto py-4 px-6">
      <div className="flex justify-between items-center">
        <div className="text-zinc-600 text-sm">© OCTADIAM FZCO</div>
      </div>
    </footer>
  );
}
