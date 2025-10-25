import React from 'react';

export function Modal({ isOpen = true, onClose, children, title, className }) {
  if (isOpen === false) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className={`bg-zinc-900 rounded-xl w-full mx-4 overflow-hidden shadow-xl transform transition-all ${className || 'max-w-lg'}`}>
        <div className="relative max-h-[85vh] flex flex-col overflow-hidden">
          <div className="sticky top-0 z-10 bg-zinc-900/95">
            <button 
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 text-gray-400 hover:text-white"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
            {title && (
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-zinc-100 text-lg font-medium pr-10">{title}</h3>
              </div>
            )}
          </div>
          <div className="px-8 py-12 flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}