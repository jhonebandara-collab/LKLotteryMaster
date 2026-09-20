import React from 'react';
import { X, Shield, FileText, RefreshCw, Heart, Sparkles, CheckCircle2 } from 'lucide-react';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'about' | 'privacy' | 'refund';
  lang: 'si' | 'en';
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  onClose,
  type,
  lang
}) => {
  const isSinhala = lang === 'si';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              {type === 'about' && <Heart className="w-4 h-4 text-rose-400" />}
              {type === 'privacy' && <Shield className="w-4 h-4 text-emerald-400" />}
              {type === 'refund' && <RefreshCw className="w-4 h-4 text-blue-400" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {type === 'about' && (isSinhala ? 'අප ගැන (About Us)' : 'About LK Lottery Master')}
                {type === 'privacy' && (isSinhala ? 'පෞද්ගලිකත්ව ප්‍රතිපත්තිය (Privacy Policy)' : 'Privacy Policy')}
                {type === 'refund' && (isSinhala ? 'මුදල් ආපසු ගෙවීමේ ප්‍රතිපත්තිය (Refund Policy)' : 'Refund Policy')}
              </h2>
              <p className="text-xs text-slate-400">LK Lottery Master Official Documentation</p>
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {type === 'about' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">LK Lottery Master පිළිබඳව</h3>
              <p>
                {isSinhala 
                  ? 'LK Lottery Master යනු ශ්‍රී ලංකාවේ ජාතික ලොතරැයි මණ්ඩලය (NLB) සහ සංවර්ධන ලොතරැයි මණ්ඩලය (DLB) විසින් නිකුත් කරනු ලබන සියලුම ලොතරැයි පත් ක්ෂණිකව, නිවැරදිව සහ පහසුවෙන් පරීක්ෂා කරගැනීම සඳහා නිර්මාණය කරන ලද නවීනතම තාක්ෂණික යෙදුමකි.' 
                  : 'LK Lottery Master is Sri Lanka’s premier digital assistant designed to verify, scan, and archive results from both National Lotteries Board (NLB) and Development Lotteries Board (DLB).'}
              </p>
              <h4 className="font-bold text-amber-400 pt-1">ප්‍රධාන පහසුකම්:</h4>
              <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                <li>Micro-QR Code Scanning (මිලිතත්පර 200ක අතිශය වේගවත් ස්කෑන් තාක්ෂණය)</li>
                <li>Gemini Vision AI මඟින් හානි වූ / බොඳ වූ ටිකට්පත් කියවීම</li>
                <li>මාස 6ක සම්පූර්ණ නිල ප්‍රතිඵල ලේඛනාගාරය (Archive)</li>
                <li>AI Lucky Guess මඟින් ඊළඟට මිලදී ගැනීමට හොඳම අංක අනුමානය</li>
                <li>දිනුම් ඇදීම සිදුනොවූ (Pending) ටිකට්පත් සුරැකීමේ හැකියාව</li>
              </ul>
            </div>
          )}

          {type === 'privacy' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">පෞද්ගලිකත්ව ප්‍රතිපත්තිය</h3>
              <p>
                {isSinhala 
                  ? 'ඔබගේ පුද්ගලික තොරතුරුවල ආරක්ෂාව අපගේ ඉහළම ප්‍රමුඛතාවයයි. මෙම යෙදුම මඟින් ඔබ ස්කෑන් කරන ටිකට්පත් ඡායාරූප හෝ ඔබගේ පුද්ගලික දත්ත කිසිදු තෙවන පාර්ශවයකට විකුණනු හෝ බෙදාහදා ගනු නොලැබේ.' 
                  : 'We respect your privacy. Scanned images and personal ticket records are processed securely and never sold or shared with third parties.'}
              </p>
              <h4 className="font-bold text-amber-400 pt-1">දත්ත එකතු කිරීම සහ භාවිතය:</h4>
              <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                <li><strong>කැමරා අවසර (Camera):</strong> QR කේතය කියවීම සඳහා පමණක් තාවකාලිකව භාවිතා වේ.</li>
                <li><strong>ගිණුම් දත්ත (Account Data):</strong> ඔබ Google හෝ Email මඟින් ලොග් වූ විට නම සහ ඊමේල් ලිපිනය පැකේජ සක්‍රියතාව තහවුරු කිරීමට පමණක් භාවිතා වේ.</li>
                <li><strong>නෛතික වාර්තා:</strong> වගකීම් ප්‍රකාශයට ඔබ එකඟ වූ බවට වන Audit Log එක නීතිමය සුරක්ෂිතභාවය වෙනුවෙන් සුරැකේ.</li>
              </ul>
            </div>
          )}

          {type === 'refund' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">මුදල් ආපසු ගෙවීමේ ප්‍රතිපත්තිය</h3>
              <p>
                {isSinhala 
                  ? 'LK Lottery Master හි Starter (Rs. 300), Pro (Rs. 450) සහ Master (Rs. 700) පැකේජ මිලදී ගත් මොහොතේ සිට දින 30ක කාලයක් සඳහා අදාළ සෙවුම් සීමාවන් සමඟ ක්‍රියාත්මක වේ.' 
                  : 'Subscription passes are activated immediately upon payment and remain valid for 30 consecutive calendar days.'}
              </p>
              <h4 className="font-bold text-amber-400 pt-1">මුදල් ආපසු ලබාදීමේ කොන්දේසි:</h4>
              <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                <li>ගෙවීම් දෝෂයක් හේතුවෙන් දෙවරක් මුදල් කැපී ගියහොත් (Duplicate Payment), පැය 48ක් ඇතුළත අමතර මුදල 100% ක් ආපසු බැර කෙරේ.</li>
                <li>පැකේජය සක්‍රිය වී කිසිදු සෙවුමක් සිදු නොකළ අවස්ථාවක, පැය 24ක් තුළ ඉල්ලීමක් ඉදිරිපත් කිරීමෙන් සම්පූර්ණ මුදල ආපසු ලබාගත හැක.</li>
                <li>පැකේජය භාවිත කිරීමෙන් පසු අඩක් අවලංගු කළ නොහැක.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs sm:text-sm transition"
          >
            {isSinhala ? 'වසන්න (Close)' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
