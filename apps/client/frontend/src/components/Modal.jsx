import React from 'react';

export function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-zinc-900 rounded-xl w-full max-w-lg mx-4 overflow-hidden shadow-xl transform transition-all">
        <div className="relative max-h-[80vh] overflow-y-auto">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}