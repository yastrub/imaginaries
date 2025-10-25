import React from 'react';
import { Modal } from './Modal';
import { BadgeCheck } from 'lucide-react';

export default function UpgradeCongratsModal({ isOpen, onClose, planLabel = 'Pro' }) {
  return (
    <Modal isOpen={!!isOpen} onClose={onClose} className="max-w-xl">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl opacity-40 bg-green-500/30 rounded-full animate-pulse" />
          <BadgeCheck className="w-24 h-24 text-green-400 drop-shadow-[0_0_30px_rgba(34,197,94,0.65)] animate-bounce" />
        </div>
        <h2 className="text-2xl md:text-3xl font-semibold text-white">
          Congratulations on upgrading!
        </h2>
        <p className="text-zinc-300">
          Your account has been upgraded to <span className="text-green-400 font-semibold">{planLabel}</span>.
          Enjoy faster generations, premium quality, and more.
        </p>
        <div className="mt-2 text-zinc-400 text-sm">
          Tip: You can start creating right away on the Imagine page.
        </div>
        <button
          onClick={onClose}
          className="mt-2 inline-flex items-center justify-center rounded-md bg-green-600 hover:bg-green-500 text-white px-5 py-2 transition-colors"
        >
          Awesome!
        </button>
      </div>
    </Modal>
  );
}
