import React from 'react';
import { useViewportOverlay } from '../hooks/useViewportOverlay';

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) {

  return (
    <div className="fixed bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[100]" style={useViewportOverlay()}>
      <div className="bg-zinc-900 rounded-xl w-full max-w-md mx-4 p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
        <p className="text-zinc-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            {cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}