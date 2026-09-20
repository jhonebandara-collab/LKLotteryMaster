import React, { useState } from 'react';
import { X, Check, Zap, CreditCard, Smartphone, Building, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { SUBSCRIPTION_PLANS, activateUserPlan } from '../services/storageService';
import { UserProfile, SubscriptionPlan } from '../types';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onPlanActivated: (updated: UserProfile) => void;
  lang: 'si' | 'en';
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  user,
  onPlanActivated,
  lang
}) => {
  const isSinhala = lang === 'si';
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'master'>('pro');
  const [paymentMethod, setPaymentMethod] = useState<'payhere' | 'mobile' | 'bank'>('payhere');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentPlanObj = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan) || SUBSCRIPTION_PLANS[1];

  const handlePayNow = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const updatedUser = activateUserPlan(selectedPlan);
      setIsProcessing(false);
      setPaymentSuccess(true);
      onPlanActivated(updatedUser);
      setTimeout(() => {
        setPaymentSuccess(false);
        onClose();
      }, 1800);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {isSinhala ? 'Ad-Free QR Searches පැකේජ' : 'Ad-Free QR Search Passes'}
              </h2>
              <p className="text-xs text-slate-400">
                {isSinhala ? 'සක්‍රිය කළ දිනයේ සිට දින 30ක් වලංගු වේ' : 'Valid for 30 days from activation date'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {paymentSuccess ? (
            <div className="py-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-white">
                {isSinhala ? 'ගෙවීම සාර්ථකයි! පැකේජය සක්‍රිය විය!' : 'Payment Success! Plan Activated!'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300">
                {isSinhala 
                  ? `ඔබගේ ${currentPlanObj.nameSi} (Searches ${currentPlanObj.searches}) අද සිට දින 30ක් පුරා වලංගු වේ.` 
                  : `Your ${currentPlanObj.name} has been activated for 30 days.`}
              </p>
            </div>
          ) : (
            <>
              {/* Plans Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SUBSCRIPTION_PLANS.map(plan => {
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative rounded-2xl p-4 cursor-pointer transition border flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gradient-to-b from-amber-500/20 to-slate-950 border-amber-400 shadow-xl shadow-amber-500/10 scale-[1.02]'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {plan.id === 'pro' && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black uppercase rounded-full tracking-wider shadow">
                          POPULAR
                        </div>
                      )}

                      <div>
                        <div className="text-xs font-bold text-slate-300">{plan.name}</div>
                        <div className="text-xl font-black text-white mt-1">
                          Rs. {plan.priceRs}
                        </div>
                        <div className="text-[11px] text-amber-400 font-bold mt-0.5">
                          {plan.searches} Searches / 30 Days
                        </div>
                      </div>

                      <ul className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                        {plan.features.slice(0, 2).map((f, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {/* Payment Gateway Options */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {isSinhala ? 'ගෙවීම් ක්‍රමය තෝරන්න (Select Payment Gateway):' : 'Select Payment Gateway:'}
                </label>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('payhere')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition ${
                      paymentMethod === 'payhere'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>PayHere / Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mobile')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition ${
                      paymentMethod === 'mobile'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>eZ Cash / mCash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition ${
                      paymentMethod === 'bank'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Building className="w-5 h-5" />
                    <span>Bank Transfer</span>
                  </button>
                </div>
              </div>

              {/* Secure guarantee */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-2.5 text-xs text-slate-400">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  {isSinhala 
                    ? '100% ආරක්ෂිත ශ්‍රී ලාංකීය ගෙවීම් පද්ධතිය. ගෙවූ සැණින් පැකේජය ක්‍රියාත්මක වේ.' 
                    : '100% Secure Payment processing via PayHere with instant plan activation.'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!paymentSuccess && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="text-slate-400">Total: </span>
              <span className="text-base font-black text-white">Rs. {currentPlanObj.priceRs}.00</span>
            </div>

            <button
              onClick={handlePayNow}
              disabled={isProcessing}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition shadow-lg shadow-amber-500/25 active:scale-95 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>{isSinhala ? 'සැකසෙමින් පවතී...' : 'Processing...'}</span>
                </>
              ) : (
                <span>{isSinhala ? 'ගෙවා සක්‍රිය කරන්න' : 'Pay & Activate Plan'}</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
