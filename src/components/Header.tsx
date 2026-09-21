import React from 'react';
import { Sparkles, QrCode, Search, Trophy, History, User, Volume2, VolumeX, ShieldCheck } from 'lucide-react';
import { Language } from '../types/lottery';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  scansLeft: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  soundEnabled,
  setSoundEnabled,
  scansLeft
}) => {
  const t = {
    en: {
      title: 'LK Lottery Master',
      subtitle: 'NLB & DLB Official Scanner & Results',
      scanner: 'Scanner',
      manual: 'Manual Check',
      results: 'All Results',
      predictions: 'AI Predict',
      history: 'History',
      account: 'Account',
      admin: 'Admin',
      scans: 'scans left'
    },
    si: {
      title: 'LK ලොතරැයි මාස්ටර්',
      subtitle: 'ජාතික හා සංවර්ධන ලොතරැයි ස්කෑනරය',
      scanner: 'ස්කෑනරය',
      manual: 'අතින් පරීක්ෂාව',
      results: 'සියලු ප්‍රතිඵල',
      predictions: 'AI අනාවැකි',
      history: 'ඉතිහාසය',
      account: 'ගිණුම',
      admin: 'පරිපාලක',
      scans: 'ස්කෑන් ඉතිරිය'
    },
    ta: {
      title: 'LK லாட்டரி மாஸ்டர்',
      subtitle: 'அதிகாரப்பூர்வ முடிவுகள் மற்றும் ஸ்கேனர்',
      scanner: 'ஸ்கேனர்',
      manual: 'கைமுறை',
      results: 'முடிவுகள்',
      predictions: 'AI கணிப்பு',
      history: 'வரலாறு',
      account: 'கணக்கு',
      admin: 'நிர்வாகம்',
      scans: 'மீதமுள்ள ஸ்கேன்'
    }
  }[language];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-lg backdrop-blur-md">
      {/* Top Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('scanner')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-emerald-500 p-0.5 shadow-md flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                {t.title}
                <span className="text-[10px] px-1.5 py-0.5 font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  PRO
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">{t.subtitle}</p>
          </div>
        </div>

        {/* Right action controls */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Remaining Scans Badge */}
          <div
            onClick={() => setActiveTab('account')}
            className="cursor-pointer hidden xs:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-xs text-slate-300 hover:border-amber-500/50 transition-colors"
            title="Scan quota available"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-white">{scansLeft}</span>
            <span className="text-slate-400 text-[11px]">{t.scans}</span>
          </div>

          {/* Sound Toggle */}
          <button
            id="sound-toggle-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border transition-colors ${
              soundEnabled
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title={soundEnabled ? 'Mute Speech & Audio' : 'Unmute Speech & Audio'}
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Language Switcher */}
          <div className="relative">
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 font-medium focus:ring-1 focus:ring-amber-400 focus:outline-none cursor-pointer"
            >
              <option value="en">English (EN)</option>
              <option value="si">සිංහල (SI)</option>
              <option value="ta">தமிழ் (TA)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 flex overflow-x-auto no-scrollbar border-t border-slate-800/80">
        <div className="flex space-x-1 py-1.5 min-w-full sm:min-w-0">
          <NavButton
            id="tab-scanner"
            active={activeTab === 'scanner'}
            onClick={() => setActiveTab('scanner')}
            icon={<QrCode className="w-4 h-4" />}
            label={t.scanner}
          />
          <NavButton
            id="tab-manual"
            active={activeTab === 'manual'}
            onClick={() => setActiveTab('manual')}
            icon={<Search className="w-4 h-4" />}
            label={t.manual}
          />
          <NavButton
            id="tab-results"
            active={activeTab === 'results'}
            onClick={() => setActiveTab('results')}
            icon={<Trophy className="w-4 h-4" />}
            label={t.results}
          />
          <NavButton
            id="tab-predictions"
            active={activeTab === 'predictions'}
            onClick={() => setActiveTab('predictions')}
            icon={<Sparkles className="w-4 h-4" />}
            label={t.predictions}
          />
          <NavButton
            id="tab-history"
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            icon={<History className="w-4 h-4" />}
            label={t.history}
          />
          <NavButton
            id="tab-account"
            active={activeTab === 'account'}
            onClick={() => setActiveTab('account')}
            icon={<User className="w-4 h-4" />}
            label={t.account}
          />
          <NavButton
            id="tab-admin"
            active={activeTab === 'admin'}
            onClick={() => setActiveTab('admin')}
            icon={<ShieldCheck className="w-4 h-4" />}
            label={t.admin}
          />
        </div>
      </div>
    </header>
  );
};

const NavButton: React.FC<{
  id: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ id, active, onClick, icon, label }) => {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
        active
          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
