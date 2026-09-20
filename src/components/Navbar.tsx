import React from 'react';
import { QrCode, ShieldCheck, User, Sparkles, AlertCircle, Info } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: 'si' | 'en';
  setLang: (lang: 'si' | 'en') => void;
  onOpenScanner: () => void;
  onOpenDisclaimer: () => void;
  onOpenPolicy: (type: 'about' | 'privacy' | 'refund') => void;
  onOpenSubscription: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  lang,
  setLang,
  onOpenScanner,
  onOpenDisclaimer,
  onOpenPolicy,
  onOpenSubscription
}) => {
  const isSinhala = lang === 'si';

  const planBadgeClasses = {
    free: 'bg-slate-800 text-slate-300 border-slate-700',
    starter: 'bg-amber-950/80 text-amber-300 border-amber-500/50',
    pro: 'bg-blue-950/80 text-blue-300 border-blue-500/50',
    master: 'bg-purple-950/80 text-purple-300 border-purple-500/50',
  }[user.plan] || 'bg-slate-800 text-slate-300 border-slate-700';

  const planLabels = {
    free: isSinhala ? 'නොමිලේ (Free)' : 'Free Plan',
    starter: 'Starter (300 QR)',
    pro: 'Pro (500 QR)',
    master: 'Master Pass (VIP)',
  }[user.plan];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('check')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="text-xl">🎟️</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  LK Lottery <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">Master</span>
                </h1>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {isSinhala ? 'ශ්‍රී ලංකා NLB & DLB නිල ප්‍රතිඵල සහ Smart QR පරීක්ෂාව' : 'Sri Lanka NLB & DLB Smart Ticket Hub'}
              </p>
            </div>
          </div>

          {/* Center / Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick QR Scan Action Button */}
            <button
              id="nav-quick-scan-btn"
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 text-xs sm:text-sm"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden xs:inline">{isSinhala ? 'Scan කරන්න' : 'Scan QR'}</span>
            </button>

            {/* Plan Button */}
            <button
              onClick={onOpenSubscription}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${planBadgeClasses}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{planLabels}</span>
            </button>

            {/* Language Switcher */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-bold">
              <button
                onClick={() => setLang('si')}
                className={`px-2 py-1 rounded transition-all ${isSinhala ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                සිං
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded transition-all ${!isSinhala ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                EN
              </button>
            </div>

            {/* Disclaimer Status */}
            <button
              onClick={onOpenDisclaimer}
              title={isSinhala ? 'නෛතික වගකීම් ප්‍රකාශය' : 'Legal Disclaimer & Waiver'}
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded-lg transition-colors border border-slate-800/80"
            >
              {user.disclaimerAccepted ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex items-center gap-1 mt-3 overflow-x-auto no-scrollbar pt-1 border-t border-slate-900 text-xs sm:text-sm font-semibold">
          {[
            { id: 'check', label: isSinhala ? '✍️ අතින් පරීක්ෂාව' : '✍️ Manual Check' },
            { id: 'guess', label: isSinhala ? '🍀 මගේ වාසනාව (AI Guess)' : '🍀 AI Lucky Guess' },
            { id: 'results', label: isSinhala ? '📋 මාස 6ක ප්‍රතිඵල (Archive)' : '📋 All Results (6-Mo)' },
            { id: 'account', label: isSinhala ? '👤 මගේ ගිණුම' : '👤 My Account' },
            { id: 'admin', label: isSinhala ? '🛠️ පරිපාලනය (Admin)' : '🛠️ Admin Panel' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
