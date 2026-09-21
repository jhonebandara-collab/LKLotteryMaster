import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck, Ban, ScrollText, UserCheck, AlertTriangle } from 'lucide-react';
import { Language } from '../types/lottery';

export const DISCLAIMER_VERSION = '2026-09-21-v1';
export const DISCLAIMER_STORAGE_KEY = 'lk_lottery_disclaimer_v1';

export interface DisclaimerRecord {
  id: string;
  acceptedAt: string;
  version: string;
  language: Language;
  device: string;
  platform: string;
  userAgent: string;
  screen: string;
  timezone: string;
  appUrl: string;
  userName?: string;
}

interface DisclaimerModalProps {
  language: Language;
  onAccept: (record: DisclaimerRecord) => void;
  /** Rendered instead of the app while the user has not accepted. */
  onDecline: () => void;
}

export const buildDisclaimerRecord = (language: Language, userName?: string): DisclaimerRecord => ({
  id: `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  acceptedAt: new Date().toISOString(),
  version: DISCLAIMER_VERSION,
  language,
  device: navigator.userAgent.includes('Android')
    ? 'Android'
    : /iPhone|iPad|iPod/.test(navigator.userAgent)
    ? 'iOS'
    : navigator.userAgent.includes('Windows')
    ? 'Windows'
    : navigator.userAgent.includes('Mac')
    ? 'macOS'
    : navigator.userAgent.includes('Linux')
    ? 'Linux'
    : 'Unknown',
  platform: navigator.platform || 'unknown',
  userAgent: navigator.userAgent,
  screen: `${window.screen.width}x${window.screen.height}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
  appUrl: window.location.href,
  userName
});

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ language, onAccept, onDecline }) => {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [name, setName] = useState('');
  const [declined, setDeclined] = useState(false);

  const t = useMemo(
    () =>
      ({
        en: {
          title: 'Terms of Use & Disclaimer',
          subtitle: 'Please read and accept before using the scanner',
          accept: 'I have read and I accept',
          decline: 'Decline and exit',
          yourName: 'Your name (optional, stored with the acceptance record)',
          namePlaceholder: 'e.g. K. Perera',
          scrollHint: 'Scroll to the end of the terms to enable the accept button.',
          declinedTitle: 'Access declined',
          declinedMsg:
            'You must accept the terms of use to use the lottery ticket scanner. Reload the page if you change your mind.',
          points: [
            'This app is an independent ticket-checking tool. It is NOT affiliated with, endorsed by, or connected to the National Lotteries Board (NLB), the Development Lotteries Board (DLB) or the Government of Sri Lanka.',
            'Winning results are read from publicly available draw information and are provided for personal reference only. They are not an official confirmation of a prize.',
            'Only the official ticket and the lottery board can confirm a win. Always verify a winning ticket at an authorised NLB / DLB agent or branch before making any claim.',
            'The camera reads the QR code / printed numbers of a ticket. If a result cannot be read reliably the app will say so instead of guessing.',
            'Lottery play involves financial risk and can be addictive. This app does not sell tickets, does not accept bets, does not pay prizes and does not encourage gambling. You must be 18 years or older.',
            'Your acceptance of these terms, together with basic device information (browser, screen size, time zone), is recorded for audit purposes.',
            'The app is provided "as is", without warranty of any kind. The developer is not liable for any loss arising from its use.'
          ]
        },
        si: {
          title: 'භාවිත කොන්දේසි සහ වගකීම් ප්‍රතික්ෂේප කිරීම',
          subtitle: 'ස්කෑනරය භාවිත කිරීමට පෙර කියවා අනුමත කරන්න',
          accept: 'මම කියවා අනුමත කරමි',
          decline: 'ප්‍රතික්ෂේප කර පිටවන්න',
          yourName: 'ඔබේ නම (විකල්ප — අනුමැති වාර්තාව සමඟ සුරැකේ)',
          namePlaceholder: 'උදා: කේ. පෙරේරා',
          scrollHint: 'කොන්දේසි අවසානය දක්වා අනුචලනය කරන්න.',
          declinedTitle: 'ප්‍රවේශය ප්‍රතික්ෂේප විය',
          declinedMsg: 'ලොතරැයි ස්කෑනරය භාවිත කිරීමට කොන්දේසි අනුමත කළ යුතුය. නැවත උත්සාහ කිරීමට පිටුව නැවත පූරණය කරන්න.',
          points: [
            'මෙය ස්වාධීන ටිකට් පරීක්ෂා කිරීමේ මෙවලමකි. ජාතික ලොතරැයි මණ්ඩලය (NLB), සංවර්ධන ලොතරැයි මණ්ඩලය (DLB) හෝ ශ්‍රී ලංකා රජය සමඟ කිසිදු සම්බන්ධයක් නොමැත.',
            'ජයග්‍රාහී ප්‍රතිඵල පොදුවේ ලබාගත හැකි දත්ත වලින් ලබාගත් අතර ඒවා පෞද්ගලික යොමුව සඳහා පමණි. ඒවා ත්‍යාගයක් ලැබීමේ නිල තහවුරු කිරීමක් නොවේ.',
            'දිනුමක් තහවුරු කළ හැක්කේ නිල ටිකට් පතට හා ලොතරැයි මණ්ඩලයට පමණි. ඉල්ලීමක් කිරීමට පෙර සෑම විටම අවසර ලත් NLB / DLB නියෝජිතයෙකු හමුවේ ටිකට් පත තහවුරු කරගන්න.',
            'කැමරාව ටිකට් පතේ QR කේතය / මුද්‍රිත අංක කියවයි. විශ්වාසදායක ලෙස කියවීමට නොහැකි වූ විට යෙදුම අනුමාන නොකර එය පැහැදිලිව දන්වයි.',
            'ලොතරැයි ක්‍රීඩාව මූල්‍ය අවදානමක් ගෙන දෙන අතර ඇබ්බැහි වීමේ අවදානමක් ඇත. මෙම යෙදුම ටිකට් විකුණන්නේ නැත, ඔට්ටු ගන්නේ නැත, ත්‍යාග ගෙවන්නේ නැත. ඔබට වයස අවුරුදු 18ට වැඩි විය යුතුය.',
            'ඔබේ අනුමැතිය සහ මූලික උපාංග තොරතුරු (බ්‍රව්සරය, තිර ප්‍රමාණය, වේලා කලාපය) විගණන අරමුණු සඳහා වාර්තා කෙරේ.',
            'යෙදුම "තිබෙන ආකාරයටම" සපයා ඇත. භාවිතයෙන් සිදුවන කිසිදු අලාභයක් සඳහා සංවර්ධකයා වගකීමක් නොගනී.'
          ]
        },
        ta: {
          title: 'பயன்பாட்டு விதிமுறைகள் & மறுப்பு',
          subtitle: 'ஸ்கேனரைப் பயன்படுத்தும் முன் படித்து ஏற்கவும்',
          accept: 'படித்து ஏற்கிறேன்',
          decline: 'மறுத்து வெளியேறு',
          yourName: 'உங்கள் பெயர் (விருப்பம்)',
          namePlaceholder: 'எ.கா. க. பெரேரா',
          scrollHint: 'விதிமுறைகளை இறுதிவரை உருட்டவும்.',
          declinedTitle: 'அணுகல் மறுக்கப்பட்டது',
          declinedMsg: 'ஸ்கேனரைப் பயன்படுத்த விதிமுறைகளை ஏற்க வேண்டும். மீண்டும் முயற்சிக்க பக்கத்தை புதுப்பிக்கவும்.',
          points: [
            'இது ஒரு சுயாதீன டிக்கெட் சரிபார்ப்புக் கருவி. NLB, DLB அல்லது இலங்கை அரசுடன் எந்தத் தொடர்பும் இல்லை.',
            'வெற்றி முடிவுகள் பொதுவில் கிடைக்கும் தகவல்களிலிருந்து பெறப்படுகின்றன; அவை தனிப்பட்ட குறிப்புக்கு மட்டுமே.',
            'வெற்றியை உறுதிப்படுத்த முடியும் அதிகாரப்பூர்வ டிக்கெட் மற்றும் லாட்டரி சபை மட்டுமே. கோரிக்கை விடுப்பதற்கு முன் அதிகாரம் பெற்ற முகவரிடம் சரிபார்க்கவும்.',
            'கேமரா QR / அச்சிடப்பட்ட எண்களைப் படிக்கிறது. நம்பகமாகப் படிக்க முடியாதபோது ஊகிக்காமல் தெரிவிக்கும்.',
            'லாட்டரி விளையாட்டு நிதி ஆபத்தையும் அடிமைத்தனத்தையும் ஏற்படுத்தலாம். இந்த செயலி டிக்கெட் விற்காது, பந்தயம் ஏற்காது, பரிசு வழங்காது. 18 வயது நிரம்பியிருக்க வேண்டும்.',
            'உங்கள் ஒப்புதல் மற்றும் அடிப்படை சாதன தகவல் தணிக்கை நோக்கத்திற்காகப் பதிவு செய்யப்படும்.',
            'செயலி "உள்ளபடியே" வழங்கப்படுகிறது; எந்த உத்தரவாதமும் இல்லை.'
          ]
        }
      }[language]),
    [language]
  );

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-amber-500/15 via-slate-900 to-emerald-500/10">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center flex-shrink-0">
              <ScrollText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">{t.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{t.subtitle}</p>
            </div>
          </div>
        </div>

        {declined ? (
          <div className="p-6 text-center">
            <Ban className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="text-white font-bold mb-1">{t.declinedTitle}</h3>
            <p className="text-sm text-slate-400">{t.declinedMsg}</p>
            <button
              onClick={() => setDeclined(false)}
              className="mt-5 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold"
            >
              ← {t.title}
            </button>
          </div>
        ) : (
          <>
            {/* Terms */}
            <div
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolledToEnd(true);
              }}
            >
              {t.points.map((point, index) => (
                <div key={index} className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-bold text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-slate-300">{point}</p>
                </div>
              ))}

              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11.5px] leading-relaxed text-rose-100">
                  {language === 'si'
                    ? 'වගකීමකින් තොරව ලොතරැයි ක්‍රීඩා නොකරන්න. දිනුම් ලැබීමට කිසිදු සහතිකයක් නොමැත.'
                    : language === 'ta'
                    ? 'பொறுப்புடன் விளையாடுங்கள். வெற்றிக்கு எந்த உத்தரவாதமும் இல்லை.'
                    : 'Play responsibly. There is no guarantee of winning any prize.'}
                </p>
              </div>

              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  {t.yourName}
                </label>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-slate-500" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-500 font-mono">
                v{DISCLAIMER_VERSION} • {navigator.platform} • {window.screen.width}×{window.screen.height}
              </p>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-900">
              {!scrolledToEnd && (
                <p className="text-[11px] text-amber-300/90 mb-2 text-center">{t.scrollHint}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  id="btn-accept-disclaimer"
                  disabled={!scrolledToEnd}
                  onClick={() => onAccept(buildDisclaimerRecord(language, name.trim() || undefined))}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {t.accept}
                </button>
                <button
                  id="btn-decline-disclaimer"
                  onClick={() => setDeclined(true)}
                  className="sm:w-44 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  {t.decline}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/** Small badge shown in the account tab when the disclaimer has been accepted. */
export const DisclaimerBadge: React.FC<{ record: DisclaimerRecord | null; onReview: () => void }> = ({
  record,
  onReview
}) => (
  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
    <div className="flex items-center gap-2.5">
      <ShieldCheck className="w-4 h-4 text-emerald-400" />
      <div>
        <div className="text-xs font-semibold text-emerald-200">Terms accepted</div>
        <div className="text-[10px] text-emerald-300/70">
          {record ? `${new Date(record.acceptedAt).toLocaleString()} • v${record.version}` : '—'}
        </div>
      </div>
    </div>
    <button onClick={onReview} className="text-[11px] font-semibold text-emerald-300 underline">
      Review
    </button>
  </div>
);

/** Warns when the disclaimer has not been accepted (used inside the app shell). */
export const DisclaimerWarning: React.FC = () => (
  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-100">
    <ShieldAlert className="w-4 h-4 text-amber-400" />
    Terms of use have not been accepted yet.
  </div>
);
