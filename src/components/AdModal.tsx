import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, Shield, ArrowRight, X } from 'lucide-react';

interface AdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubscription: () => void;
  lang: 'si' | 'en';
}

export const AdModal: React.FC<AdModalProps> = ({
  isOpen,
  onClose,
  onOpenSubscription,
  lang
}) => {
  const isSinhala = lang === 'si';
  const [secondsRemaining, setSecondsRemaining] = useState<number>(5);

  useEffect(() => {
    let timer: any;
    if (isOpen) {
      setSecondsRemaining(5);
      timer = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-lg">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-center p-6 space-y-5">
        {/* Top Timer Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Sponsored Partner Ad (3rd Check)
          </span>

          <div className="px-2.5 py-1 rounded-full bg-slate-800 text-amber-300 font-mono font-black text-xs">
            {secondsRemaining > 0 ? `Skip in ${secondsRemaining}s` : '✓ Ready to Skip'}
          </div>
        </div>

        {/* Ad Body Content */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-600/20 via-slate-950 to-slate-950 border border-amber-500/30 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center mx-auto shadow-xl">
            <Zap className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              PRO LOTTERY UPGRADE
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white mt-2">
              {isSinhala ? 'දැන්වීම් නැතුව වේගයෙන් QR Scan කරන්න' : '100% Ad-Free Fast QR Scanning'}
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {isSinhala 
                ? 'QR Searches 300ක් රු. 300කට, 500ක් රු. 450කට සහ 1,000ක් (Unlimited) රු. 700කට මාසයක් පුරා Ads නොමැතිව ලබාගන්න!' 
                : 'Get 300 searches for Rs. 300, 500 for Rs. 450, or 1,000 searches for Rs. 700. Valid for 1 full month.'}
            </p>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenSubscription();
            }}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <span>{isSinhala ? 'රු. 300 සිට පැකේජ බලන්න' : 'View Ad-Free Plans from Rs. 300'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Countdown and Skip Button */}
        <div className="pt-2">
          {secondsRemaining > 0 ? (
            <div className="w-full py-2.5 bg-slate-800 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed">
              {isSinhala ? `තත්පර ${secondsRemaining} කින් මඟහැරිය හැක (Wait ${secondsRemaining}s)...` : `Skip available in ${secondsRemaining}s...`}
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition active:scale-95"
            >
              {isSinhala ? 'දැන්වීම මඟහරින්න (Skip Ad & Continue)' : 'Skip Ad & Continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
