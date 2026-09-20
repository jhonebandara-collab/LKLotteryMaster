import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, Check, X, FileText } from 'lucide-react';
import { recordDisclaimerAcceptance } from '../services/storageService';
import { UserProfile } from '../types';

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onAccepted: (updatedUser: UserProfile) => void;
  lang: 'si' | 'en';
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({
  isOpen,
  onClose,
  user,
  onAccepted,
  lang
}) => {
  const isSinhala = lang === 'si';
  const [hasAgreed, setHasAgreed] = useState<boolean>(user.disclaimerAccepted);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!hasAgreed) return;
    const updated = recordDisclaimerAcceptance(user);
    onAccepted(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {isSinhala ? 'නෛතික වගකීම් ප්‍රකාශය සහ එකඟතාව' : 'Legal Disclaimer & Liability Waiver'}
              </h2>
              <p className="text-xs text-slate-400">
                {isSinhala ? 'පරිශීලක වගකීම් සහ ප්‍රතිඵල නිරවද්‍යතාව පිළිබඳ නිවේදනය' : 'User responsibility and result accuracy agreement'}
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

        {/* Scrollable Terms Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-semibold">
            {isSinhala 
              ? 'කරුණාකර මෙම යෙදුම (LK Lottery Master) භාවිතා කිරීමට පෙර පහත නීතිමය කොන්දේසි හොඳින් කියවා එකඟ වන්න.' 
              : 'Please read the following terms and disclaimer carefully before proceeding.'}
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-xs">
              1. නිල නොවන ස්වාධීන යෙදුමක් වීම (Independent Service)
            </h4>
            <p className="text-slate-400">
              {isSinhala 
                ? 'මෙම යෙදුම (LK Lottery Master) ජාතික ලොතරැයි මණ්ඩලය (NLB) හෝ සංවර්ධන ලොතරැයි මණ්ඩලය (DLB) සමඟ සෘජු සම්බන්ධයක් නොමැති ස්වාධීන තොරතුරු සහායක මෙවලමකි.' 
                : 'This application is an independent digital tool and is not officially affiliated with NLB or DLB.'}
            </p>

            <h4 className="font-bold text-white uppercase tracking-wider text-xs">
              2. ප්‍රතිඵල නිරවද්‍යතාව සහ වගකීමෙන් බැහැරවීම (No Absolute Guarantee)
            </h4>
            <p className="text-slate-400">
              {isSinhala 
                ? 'Micro-QR ස්කෑන් කිරීම, කැමරා OCR හෝ අතින් ඇතුළත් කිරීම් මඟින් පෙන්වනු ලබන්නේ සහායක ප්‍රතිඵලයක් පමණි. කැමරා ආලෝකය, හානි වූ QR කේත හෝ පද්ධති දෝෂ හේතුවෙන් ප්‍රතිඵලයේ යම් වෙනසක් සිදුවිය හැක. කිසිම අවස්ථාවක ප්‍රවේශපත්‍රයේ සැබෑ දිනුම පිළිබඳ අවසන් නිගමනය මෙම යෙදුමෙන් ලබාදෙන ප්‍රතිඵලය මත පමණක් නොතැබිය යුතුය.' 
                : 'QR scanning, camera OCR, and manual checks are for informational guidance. Final win eligibility must be verified with official gazette prints.'}
            </p>

            <h4 className="font-bold text-white uppercase tracking-wider text-xs">
              3. මුදල් හිමිකම් පෑම සහ ප්‍රවේශපත්‍ර බැහැර නොකිරීම (Ticket Retention)
            </h4>
            <p className="text-slate-400">
              {isSinhala 
                ? 'ඕනෑම මුදල් ත්‍යාගයක් හිමිකම් පෑමට හෝ ප්‍රවේශපත්‍රයක් බැහැර කිරීමට පෙර, ඔබගේ මුල් ප්‍රවේශපත්‍රය ජාතික ලොතරැයි මණ්ඩලයේ හෝ සංවර්ධන ලොතරැයි මණ්ඩලයේ නිල ගැසට් පත්‍රය සමඟ පරීක්ෂා කර බැලීම පරිශීලකයාගේ පූර්ණ වගකීමකි. පරිශීලකයා විසින් සිදුකරන ඕනෑම ක්‍රියාවකට (ප්‍රවේශපත්‍ර විසි කිරීම, හිමිකම් නොපෑම) මෙම යෙදුම හෝ එහි සංවර්ධකයින් කිසිදු නෛතික හෝ මූල්‍යමය වගකීමක් භාරගනු නොලැබේ.' 
                : 'Users bear 100% full personal responsibility to retain tickets and verify with official government authorities.'}
            </p>

            <h4 className="font-bold text-white uppercase tracking-wider text-xs">
              4. AI අනුමාන සහ අනාවැකි (AI Predictions Disclaimer)
            </h4>
            <p className="text-slate-400">
              {isSinhala 
                ? 'AI Lucky Guess මඟින් ලබාදෙන්නේ අතීත දත්ත විශ්ලේෂණය කළ සම්භාවිතා මාර්ගෝපදේශයක් පමණි. ලොතරැයි දිනුම් ඇදීම් සම්පූර්ණයෙන්ම අහඹු වන බැවින් කිසිදු දිනුමක් සහතික නොකෙරේ.' 
                : 'AI guesses are purely statistical aids based on historical trends and carry no guaranteed win.'}
            </p>
          </div>

          {/* Explicit User Agreement Checkbox */}
          <div className="pt-4 border-t border-slate-800">
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-slate-700"
              />
              <span className="text-xs font-bold text-slate-200 leading-snug">
                {isSinhala 
                  ? 'මම ඉහත සඳහන් සියලුම නීතිමය කොන්දේසි සහ වගකීම් ප්‍රකාශය කියවා තේරුම් ගත් අතර, සියලු ප්‍රතිඵල නිල ගැසට් පත්‍රයෙන් තහවුරු කරගැනීමේ පූර්ණ වගකීම මම භාරගනිමි.' 
                  : 'I have read, understood, and accept all terms above. I take 100% personal responsibility to verify tickets with official sources.'}
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-500 font-mono">
            Audit Hash: v2.4-LK-LOTTERY-MASTER
          </span>

          <button
            onClick={handleConfirm}
            disabled={!hasAgreed}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 ${
              hasAgreed 
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isSinhala ? 'එකඟ වෙමි (Accept & Proceed)' : 'Accept Terms'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
