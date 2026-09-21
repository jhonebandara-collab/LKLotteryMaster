import React, { useState } from 'react';
import { User, ShieldCheck, CreditCard, Sparkles, Check, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { Language } from '../types/lottery';

interface AccountAndLegalViewProps {
  language: Language;
  scansLeft: number;
  onAddScans: (count: number) => void;
  disclaimerAccepted: boolean;
  onAcceptDisclaimer: (accepted: boolean) => void;
}

export const AccountAndLegalView: React.FC<AccountAndLegalViewProps> = ({
  language,
  scansLeft,
  onAddScans,
  disclaimerAccepted,
  onAcceptDisclaimer
}) => {
  const [activePolicyTab, setActivePolicyTab] = useState<'about' | 'privacy' | 'terms' | 'refund'>('about');
  const [userName, setUserName] = useState<string>('Lottery Player (Pro)');
  const [userEmail, setUserEmail] = useState<string>('player@lklottery.lk');
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  const t = {
    en: {
      title: 'My Account & Packages',
      sub: 'Manage your scanning quota, packages, and view official compliance policies.',
      profileCard: 'User Account Details',
      scansAvailable: 'Scans Balance',
      activeTier: 'Active Plan',
      upgradePackages: 'Upgrade Scan Packages',
      buyNow: 'Top-Up Scans',
      legalDisclaimer: 'Statutory Disclaimer & Compliance',
      accepted: 'I accept the Terms and verify that I am at least 18 years old.',
      policies: 'App Policies & Information',
      aboutTab: 'About LK Lottery Master',
      privacyTab: 'Privacy Policy',
      termsTab: 'Terms of Service',
      refundTab: 'Refund Policy'
    },
    si: {
      title: 'මගේ ගිණුම හා පැකේජ',
      subtitle: 'ඔබේ ස්කෑන් ඉතිරිය, පැකේජ කළමනාකරණය හා නිල නෛතික තොරතුරු.',
      profileCard: 'පරිශීලක ගිණුම් විස්තර',
      scansAvailable: 'ඉතිරි ස්කෑන් ගණන',
      activeTier: 'ක්‍රියාකාරී සැලැස්ම',
      upgradePackages: 'ස්කෑන් පැකේජ මිලදී ගන්න',
      buyNow: 'දැන් ලබාගන්න',
      legalDisclaimer: 'නෛතික වගකීම් සහතික කිරීම',
      accepted: 'මම වයස අවුරුදු 18ට වැඩි බවත් නීති රීතිවලට එකඟ වන බවත් තහවුරු කරමි.',
      policies: 'ප්‍රතිපත්ති හා තොරතුරු',
      aboutTab: 'LK Lottery Master ගැන',
      privacyTab: 'පෞද්ගලිකත්ව ප්‍රතිපත්තිය',
      termsTab: 'සේවා කොන්දේසි',
      refundTab: 'මුදල් ආපසු ගෙවීම් ප්‍රතිපත්තිය'
    },
    ta: {
      title: 'எனது கணக்கு மற்றும் தொகுப்புகள்',
      subtitle: 'உங்கள் ஸ்கேன் இருப்பு மற்றும் தொகுப்புகளை நிர்வகிக்கவும்.',
      profileCard: 'கணக்கு விவரங்கள்',
      scansAvailable: 'மீதமுள்ள ஸ்கேன்',
      activeTier: 'செயலில் உள்ள திட்டம்',
      upgradePackages: 'தொகுப்புகள் மேம்படுத்தல்',
      buyNow: 'டாப்-அப் செய்யவும்',
      legalDisclaimer: 'சட்டப்பூர்வ பொறுப்புத்துறப்பு',
      accepted: 'விதிமுறைகளை ஏற்றுக்கொள்கிறேன், எனக்கு 18 வயது நிறைவடைந்துள்ளது.',
      policies: 'விதிமுறைகள் மற்றும் கொள்கைகள்',
      aboutTab: 'எங்களைப் பற்றி',
      privacyTab: 'தனியுரிமைக் கொள்கை',
      termsTab: 'சேவை விதிமுறைகள்',
      refundTab: 'பணம் திரும்பப்பெறும் கொள்கை'
    }
  }[language];

  const packages = [
    {
      id: 'pkg_300',
      name: 'Starter Pack',
      scans: 300,
      priceRs: 499,
      features: ['300 High-Speed QR Scans', 'AI Vision Damaged Ticket Reader', 'Speech Audio Announcements', 'Full Draw History']
    },
    {
      id: 'pkg_500',
      name: 'Pro Value Pack',
      scans: 500,
      priceRs: 799,
      popular: true,
      features: ['500 High-Speed QR Scans', 'AI Predictions & Hot/Cold Balls', 'No Ad Interruptions', 'Priority Camera Stream']
    },
    {
      id: 'pkg_1000',
      name: 'Retailer Ultimate',
      scans: 1000,
      priceRs: 1399,
      features: ['1000 High-Speed QR Scans', 'Batch Ticket Processing', 'CSV Export & History Storage', 'Lifetime VIP Updates']
    }
  ];

  const handlePurchase = (pkg: typeof packages[0]) => {
    onAddScans(pkg.scans);
    setPurchaseSuccess(`Successfully activated ${pkg.name}! Added ${pkg.scans} scans to your balance.`);
    setTimeout(() => setPurchaseSuccess(null), 4000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-8">
      {/* Top Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg flex-shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <User className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">{userName}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                PREMIUM
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{userEmail}</p>
            <p className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Google Verified Account</span>
            </p>
          </div>
        </div>

        {/* Scans Quota Badge */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center space-x-6">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">{t.scansAvailable}</span>
            <div className="text-3xl font-black text-amber-400 tracking-tight">{scansLeft}</div>
          </div>
          <button
            onClick={() => onAddScans(25)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Free Daily Bonus"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>+25 Free Bonus</span>
          </button>
        </div>
      </div>

      {purchaseSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{purchaseSuccess}</span>
        </div>
      )}

      {/* Package Pricing Tiers */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" />
            {t.upgradePackages}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Flexible packages tailored for daily lottery players and retail ticket agents in Sri Lanka.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-slate-900 rounded-2xl p-5 border flex flex-col justify-between shadow-xl transition-all hover:scale-[1.01] ${
                pkg.popular
                  ? 'border-amber-500/60 shadow-amber-500/10'
                  : 'border-slate-800'
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-[10px] uppercase rounded-full shadow-md">
                  Most Popular
                </span>
              )}

              <div>
                <h4 className="font-bold text-white text-base">{pkg.name}</h4>
                <div className="my-3">
                  <span className="text-3xl font-black text-white">Rs. {pkg.priceRs}</span>
                  <span className="text-xs text-slate-400 ml-1">/ one-time</span>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold text-amber-400 mb-4 text-center">
                  {pkg.scans} High-Speed Scans
                </div>

                <ul className="space-y-2 mb-6">
                  {pkg.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center text-xs text-slate-300 gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handlePurchase(pkg)}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                  pkg.popular
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                {t.buyNow}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Statutory Disclaimer & Legal Acknowledgment */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          {t.legalDisclaimer}
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          LK Lottery Master is an independent technological tool created to assist ticket holders in verifying official Sri Lankan lottery outcomes. We are not officially affiliated with or endorsed by the National Lotteries Board (NLB) or Development Lotteries Board (DLB). Official prize claims are subject strictly to original physical ticket presentation and state board validation rules under the laws of the Democratic Socialist Republic of Sri Lanka.
        </p>

        <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={disclaimerAccepted}
            onChange={(e) => onAcceptDisclaimer(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-700 bg-slate-900"
          />
          <span className="text-xs font-semibold text-slate-200">{t.accepted}</span>
        </label>
      </div>

      {/* Legal Policies Modal Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex border-b border-slate-800 pb-3 gap-2 overflow-x-auto no-scrollbar">
          <PolicyTabBtn
            active={activePolicyTab === 'about'}
            onClick={() => setActivePolicyTab('about')}
            label={t.aboutTab}
          />
          <PolicyTabBtn
            active={activePolicyTab === 'privacy'}
            onClick={() => setActivePolicyTab('privacy')}
            label={t.privacyTab}
          />
          <PolicyTabBtn
            active={activePolicyTab === 'terms'}
            onClick={() => setActivePolicyTab('terms')}
            label={t.termsTab}
          />
          <PolicyTabBtn
            active={activePolicyTab === 'refund'}
            onClick={() => setActivePolicyTab('refund')}
            label={t.refundTab}
          />
        </div>

        <div className="pt-4 text-xs text-slate-300 leading-relaxed space-y-3">
          {activePolicyTab === 'about' && (
            <div>
              <h4 className="font-bold text-white text-sm mb-1">About LK Lottery Master</h4>
              <p>
                LK Lottery Master is Sri Lanka&apos;s premier high-speed QR and AI lottery verification platform. Built specifically to eliminate manual calculation errors, cross-check draws instantaneously against official NLB & DLB records, and provide clear voice readouts with exact prize tiers.
              </p>
              <p className="mt-2 text-slate-400">
                Engineered with modern WebAssembly/canvas QR decoders and Gemini Vision AI for damaged ticket reading.
              </p>
            </div>
          )}

          {activePolicyTab === 'privacy' && (
            <div>
              <h4 className="font-bold text-white text-sm mb-1">Privacy & Data Security Policy</h4>
              <p>
                Your privacy is paramount. Camera video frames scanned locally in your browser are never stored on external servers. Photos uploaded for AI scanning are processed transiently in high-security memory solely to read ticket characters and are immediately discarded.
              </p>
            </div>
          )}

          {activePolicyTab === 'terms' && (
            <div>
              <h4 className="font-bold text-white text-sm mb-1">Terms of Service</h4>
              <p>
                1. Players must be at least 18 years of age in accordance with Sri Lankan law.<br />
                2. Results shown are verified from official draw sheets, but the original physical printed lottery ticket is the sole legal instrument for claiming prizes from NLB or DLB offices.<br />
                3. The service is provided as-is with best efforts for accuracy.
              </p>
            </div>
          )}

          {activePolicyTab === 'refund' && (
            <div>
              <h4 className="font-bold text-white text-sm mb-1">Refund & Cancellation Policy</h4>
              <p>
                Scan packages are digital consumable services. Unused scan quota may be refunded within 7 days of initial purchase upon contacting support at support@lklottery.lk.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PolicyTabBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'bg-amber-500 text-slate-950 font-bold'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  );
};
