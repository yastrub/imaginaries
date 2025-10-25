import React from 'react';
import { Modal } from './Modal';
import { BadgeCheck, Crown, Zap, Rocket } from 'lucide-react';

export default function UpgradeCongratsModal({ isOpen, onClose, planLabel = 'Pro' }) {
  return (
    <Modal isOpen={!!isOpen} onClose={onClose} className="max-w-2xl">
      <div className="relative flex flex-col items-center text-center gap-6">
        {/* Background glow */}
        <div className="pointer-events-none absolute -inset-10 -z-10">
          <div className="mx-auto h-64 w-64 rounded-full bg-gradient-to-tr from-emerald-500/25 to-green-400/10 blur-3xl opacity-70" />
        </div>

        {/* Epic badge-check with animated ring */}
        <div className="relative grid place-items-center">
          <div className="grid place-items-center rounded-full w-28 h-28 bg-emerald-500/10 ring-4 ring-emerald-400/30 shadow-[0_0_40px_rgba(34,197,94,0.35)]">
            <BadgeCheck className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_30px_rgba(34,197,94,0.7)]" />
          </div>
          {/* spinning halo */}
          <div className="pointer-events-none absolute -inset-1 rounded-full border-4 border-transparent animate-spin [animation-duration:5s]" style={{
            borderTopColor: 'rgba(34,197,94,0.55)',
            borderRightColor: 'transparent',
            borderBottomColor: 'rgba(34,197,94,0.25)',
            borderLeftColor: 'transparent',
          }} />
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-300 via-white to-emerald-300 bg-clip-text text-transparent">
            You’re Upgraded!
          </h2>
          <p className="text-zinc-300/95 text-base md:text-lg">
            Welcome to <span className="text-emerald-400 font-semibold uppercase">{planLabel}</span>. Your creative horsepower just leveled up.
          </p>
        </div>

        {/* Perks row */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-sm">
            <Crown className="w-4 h-4" /> Premium quality
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-sm">
            <Zap className="w-4 h-4" /> Faster generations
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-sm">
            <Rocket className="w-4 h-4" /> Priority features
          </span>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-6">
          <div className="text-xs text-zinc-700">
            You can change plans anytime from your account.
          </div>
          <button
            onClick={onClose}
            className="group relative inline-flex items-center justify-center rounded-lg px-6 py-3 text-white font-semibold tracking-wide
                       bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400
                       shadow-[0_10px_30px_-10px_rgba(34,197,94,0.65)] ring-1 ring-emerald-400/30 transition-all"
          >
            <span className="mr-2">Awesome</span>
            <span className="opacity-80 group-hover:opacity-100">— Let’s go</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
