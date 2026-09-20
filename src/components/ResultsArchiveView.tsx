import React, { useState } from 'react';
import { ALL_LOTTERIES, getLotteryBySlug } from '../data/lotteries';
import { Calendar, Search, Filter, ArrowUpDown, ChevronRight } from 'lucide-react';
import { LotteryDraw } from '../types';

interface ResultsArchiveViewProps {
  lang: 'si' | 'en';
  onSelectDrawForCheck: (slug: string, draw: LotteryDraw) => void;
}

export const ResultsArchiveView: React.FC<ResultsArchiveViewProps> = ({
  lang,
  onSelectDrawForCheck
}) => {
  const isSinhala = lang === 'si';

  const [selectedSlug, setSelectedSlug] = useState<string>('mahajana-sampatha');
  const [filterDrawNo, setFilterDrawNo] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('2026-03-01');
  const [filterDateTo, setFilterDateTo] = useState<string>('2026-09-20');

  const currentLottery = getLotteryBySlug(selectedSlug) || ALL_LOTTERIES[0];

  // Filter draws
  const filteredDraws = currentLottery.draws.filter(d => {
    if (filterDrawNo && !d.drawNo.includes(filterDrawNo)) return false;
    if (filterDateFrom && d.date < filterDateFrom) return false;
    if (filterDateTo && d.date > filterDateTo) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>📋</span> {isSinhala ? 'මාස 6ක සම්පූර්ණ ප්‍රතිඵල ලේඛනාගාරය' : '6-Month Historical Results Archive'}
            </h2>
            <p className="text-xs text-slate-400">
              {isSinhala 
                ? 'ශ්‍රී ලංකාවේ සියලුම ලොතරැයි සඳහා පසුගිය මාස 6ක නිල ප්‍රතිඵල සහ ඉතිහාසය' 
                : 'Complete historical official draws covering past 6 months across all 16 lotteries'}
            </p>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold self-start sm:self-auto">
            {currentLottery.draws.length} Draws in Archive
          </div>
        </div>

        {/* Lottery Selector Tabs */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            {isSinhala ? 'ලොතරැයිය තෝරන්න (Select Lottery):' : 'Select Lottery:'}
          </label>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {ALL_LOTTERIES.map(lot => (
              <button
                key={lot.slug}
                onClick={() => setSelectedSlug(lot.slug)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  selectedSlug === lot.slug
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isSinhala ? lot.nameSi : lot.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar (Date Range & Draw Search) */}
        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              {isSinhala ? 'සිට (From Date):' : 'From Date:'}
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              {isSinhala ? 'දක්වා (To Date):' : 'To Date:'}
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              {isSinhala ? 'Draw අංකයෙන් සොයන්න:' : 'Search Draw #:'}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 6314"
                value={filterDrawNo}
                onChange={(e) => setFilterDrawNo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white font-mono"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {filteredDraws.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-sm">
            {isSinhala ? 'තෝරාගත් දින පරාසය තුළ ප්‍රතිඵල හමු නොවීය.' : 'No results found for the selected filter.'}
          </div>
        ) : (
          filteredDraws.map((draw) => (
            <div
              key={draw.drawNo}
              className="bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono font-black text-amber-400 text-base">
                    #{draw.drawNo}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-xs font-semibold text-slate-300">
                    {draw.dateText || draw.date}
                  </span>
                </div>

                {/* Drawn numbers */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
                  {draw.letter && (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center shadow-md">
                      {draw.letter}
                    </div>
                  )}

                  {draw.zodiac && (
                    <div className="h-9 sm:h-10 px-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shadow-md">
                      {draw.zodiac}
                    </div>
                  )}

                  {draw.superNumber && (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center shadow-md">
                      SN:{draw.superNumber}
                    </div>
                  )}

                  {draw.numbers.map((n, i) => (
                    <div
                      key={i}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm sm:text-base flex items-center justify-center"
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => onSelectDrawForCheck(currentLottery.slug, draw)}
                className="self-end sm:self-center px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-bold transition flex items-center gap-1 shrink-0"
              >
                <span>{isSinhala ? 'මෙම Draw එක පරීක්ෂා කරන්න' : 'Check Against Draw'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
