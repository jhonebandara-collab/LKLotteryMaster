import React, { useState, useMemo } from 'react';
import { Trophy, Calendar, Search, Filter, Sparkles, Building2, ExternalLink } from 'lucide-react';
import { ALL_LOTTERIES, getLotteriesByProvider } from '../data/lotteriesData';
import { LotteryInfo, Language, LotteryDraw } from '../types/lottery';
import { formatRs } from '../utils/prizeCalculator';

interface AllResultsViewProps {
  language: Language;
}

export const AllResultsView: React.FC<AllResultsViewProps> = ({ language }) => {
  const [providerFilter, setProviderFilter] = useState<'ALL' | 'NLB' | 'DLB'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLotterySlug, setSelectedLotterySlug] = useState<string>('all');

  const t = {
    en: {
      title: 'Official Lottery Results (Last 6 Months)',
      sub: 'Verified draw records direct from National Lotteries Board & Development Lotteries Board.',
      allProviders: 'All Boards',
      nlbOnly: 'NLB Lotteries',
      dlbOnly: 'DLB Lotteries',
      searchPlaceholder: 'Search by draw number or date (e.g. 4557, 2026-09)...',
      allLotteries: 'All Lotteries',
      drawNo: 'Draw No',
      date: 'Date',
      jackpot: 'Estimated Jackpot',
      noResults: 'No draw results match your search criteria.'
    },
    si: {
      title: 'නිල ලොතරැයි ප්‍රතිඵල (පසුගිය මාස 6)',
      sub: 'ජාතික ලොතරැයි මණ්ඩලය (NLB) හා සංවර්ධන ලොතරැයි මණ්ඩලයේ (DLB) නිල ප්‍රතිඵල සටහන.',
      allProviders: 'සියලු මණ්ඩල',
      nlbOnly: 'ජාතික ලොතරැයි (NLB)',
      dlbOnly: 'සංවර්ධන ලොතරැයි (DLB)',
      searchPlaceholder: 'දිනුම් වාරය හෝ දිනය සොයන්න...',
      allLotteries: 'සියලු ලොතරැයි',
      drawNo: 'දිනුම් වාරය',
      date: 'දිනය',
      jackpot: 'ජැක්පොට් ත්‍යාගය',
      noResults: 'ගැලපෙන ප්‍රතිඵල කිසිවක් හමු නොවීය.'
    },
    ta: {
      title: 'அதிகாரப்பூர்வ முடிவுகள் (கடந்த 6 மாதங்கள்)',
      sub: 'தேசிய லாட்டரி வாரியம் மற்றும் அபிவிருத்தி லாட்டரி வாரிய முடிவுகள்.',
      allProviders: 'அனைத்து வாரியங்கள்',
      nlbOnly: 'NLB லாட்டரிகள்',
      dlbOnly: 'DLB லாட்டரிகள்',
      searchPlaceholder: 'குலுக்கல் எண் அல்லது தேதியைத் தேடவும்...',
      allLotteries: 'அனைத்து லாட்டரிகள்',
      drawNo: 'குலுக்கல் எண்',
      date: 'தேதி',
      jackpot: 'ஜாக்பாட்',
      noResults: 'முடிவுகள் எதுவும் இல்லை.'
    }
  }[language];

  // Filter lotteries
  const filteredLotteries = useMemo(() => {
    return ALL_LOTTERIES.filter((l) => {
      if (providerFilter !== 'ALL' && l.provider !== providerFilter) return false;
      if (selectedLotterySlug !== 'all' && l.slug !== selectedLotterySlug) return false;
      return true;
    });
  }, [providerFilter, selectedLotterySlug]);

  // Aggregate draw cards matching search query
  const drawCards = useMemo(() => {
    const cards: { lottery: LotteryInfo; draw: LotteryDraw }[] = [];
    const q = searchQuery.trim().toLowerCase();

    for (const lot of filteredLotteries) {
      for (const draw of lot.draws) {
        if (q) {
          const matchDraw = String(draw.drawNo).toLowerCase().includes(q);
          const matchDate = draw.date.toLowerCase().includes(q);
          const matchName = lot.name.toLowerCase().includes(q);
          if (!matchDraw && !matchDate && !matchName) continue;
        }
        cards.push({ lottery: lot, draw });
      }
    }

    // Sort by date descending
    cards.sort((a, b) => new Date(b.draw.date).getTime() - new Date(a.draw.date).getTime());
    return cards;
  }, [filteredLotteries, searchQuery]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* Header & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              {t.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{t.sub}</p>
          </div>

          {/* Board Provider Switcher */}
          <div className="inline-flex p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => setProviderFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                providerFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.allProviders}
            </button>
            <button
              onClick={() => setProviderFilter('NLB')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                providerFilter === 'NLB'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.nlbOnly}
            </button>
            <button
              onClick={() => setProviderFilter('DLB')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                providerFilter === 'DLB'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.dlbOnly}
            </button>
          </div>
        </div>

        {/* Search & Lottery Dropdown Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedLotterySlug}
              onChange={(e) => setSelectedLotterySlug(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none cursor-pointer"
            >
              <option value="all">{t.allLotteries}</option>
              {ALL_LOTTERIES.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.name} ({l.provider})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Draw Cards Grid */}
      {drawCards.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm">{t.noResults}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drawCards.map(({ lottery, draw }, idx) => (
            <div
              key={`${lottery.slug}_${draw.drawNo}_${idx}`}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all group hover:translate-y-[-2px]"
            >
              <div>
                {/* Card Top: Provider Badge & Name */}
                <div className="flex items-start justify-between mb-2.5">
                  <div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        lottery.provider === 'NLB'
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {lottery.provider} • {lottery.code}
                    </span>
                    <h3 className="font-bold text-white text-base mt-1 group-hover:text-amber-400 transition-colors">
                      {lottery.name}
                    </h3>
                  </div>
                  {draw.jackpotAmount && (
                    <div className="text-right">
                      <span className="text-[10px] text-amber-400/80 font-medium uppercase">
                        Jackpot
                      </span>
                      <div className="text-xs font-extrabold text-amber-300">
                        {formatRs(draw.jackpotAmount)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Draw meta */}
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-3 pb-2.5 border-b border-slate-800">
                  <span>
                    {t.drawNo}: <strong className="text-white font-mono">{draw.drawNo}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {draw.date}
                  </span>
                </div>

                {/* Winning Balls & Letters Display */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {draw.letter && (
                    <div
                      className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-extrabold flex items-center justify-center text-xs shadow-sm"
                      title="Winning Letter"
                    >
                      {draw.letter}
                    </div>
                  )}

                  {draw.zodiac && (
                    <div
                      className="px-2 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold flex items-center justify-center text-[10px] shadow-sm"
                      title="Winning Zodiac"
                    >
                      {draw.zodiac}
                    </div>
                  )}

                  {draw.superNumber && (
                    <div
                      className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs shadow-sm"
                      title="Winning Super Number"
                    >
                      ★{draw.superNumber}
                    </div>
                  )}

                  {draw.numbers.map((n, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono font-bold flex items-center justify-center text-xs shadow-sm"
                    >
                      {n}
                    </div>
                  ))}
                </div>

                {/* Subgame display if Ada Sampatha / Suba Dawasak */}
                {draw.subGames && draw.subGames.length > 0 && (
                  <div className="p-2 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1 text-[11px] mb-2">
                    {draw.subGames.map((sg, i) => (
                      <div key={i} className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 font-medium">{sg.title}:</span>
                        <div className="flex items-center gap-1">
                          {sg.letter && <span className="font-bold text-amber-400">{sg.letter}</span>}
                          {sg.zodiac && <span className="text-purple-300 font-bold">{sg.zodiac}</span>}
                          {sg.numbers.map((num, idx) => (
                            <span key={idx} className="font-mono text-white font-bold bg-slate-800 px-1 rounded">
                              {num}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>Draw schedule: {lottery.drawDays}</span>
                <span className="text-emerald-400 font-semibold">Verified ✓</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
