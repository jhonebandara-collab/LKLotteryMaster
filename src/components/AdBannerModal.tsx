import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Sparkles } from 'lucide-react';

interface AdBannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'si' | 'ta';
}

export const AdBannerModal: React.FC<AdBannerModalProps> = ({ isOpen, onClose, language }) => {
  const [countdown, setCountdown] = useState<number>(3);

  useEffect(() => {
    if (!isOpen) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden p-5 text-center">
        {/* Ad Marker */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">
          <span>Sponsored Ad</span>
          <span>Ad 1 of 1</span>
        </div>

        {/* Ad Content Banner */}
        <div className="p-4 bg-gradient-to-br from-amber-500/20 via-slate-800 to-emerald-500/20 rounded-xl border border-slate-700 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center mx-auto mb-2 text-xl shadow-lg">
            LK
          </div>
          <h4 className="text-white font-bold text-base leading-tight">
            Dialog & Mobitel Quick Recharges
          </h4>
          <p className="text-xs text-slate-300 mt-1">
            Top up your mobile or DTH instantly with 10% cash bonus rewards in Sri Lanka!
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
            <span>Visit Partner Site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Close / Skip button */}
        <button
          onClick={() => {
            if (countdown === 0) onClose();
          }}
          disabled={countdown > 0}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all ${
            countdown === 0
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          {countdown > 0 ? `Skip Ad in ${countdown}s` : 'Skip / Close Ad'}
        </button>
      </div>
    </div>
  );
};
