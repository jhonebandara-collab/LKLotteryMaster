import React, { useState, useMemo } from 'react';
import { Search, Sparkles, Trophy, Calendar, Hash, ArrowRight, RefreshCw, CheckCircle } from 'lucide-react';
import { ALL_LOTTERIES, getLotteryBySlug, ZODIAC_SIGNS } from '../data/lotteriesData';
import { LotteryInfo, LotteryDraw, Language } from '../types/lottery';
import { evaluateLotteryPrize, formatRs } from '../utils/prizeCalculator';
import { speakResult, playWinCelebrationSound, playLoseTone } from '../utils/audioFeedback';

interface ManualCheckViewProps {
  language: Language;
  soundEnabled: boolean;
  onRecordHistory: (record: any) => void;
}

export const ManualCheckView: React.FC<ManualCheckViewProps> = ({
  language,
  soundEnabled,
  onRecordHistory
}) => {
  const [selectedSlug, setSelectedSlug] = useState<string>('govisetha');
  const [selectedDrawIndex, setSelectedDrawIndex] = useState<number>(0);
  const [letter, setLetter] = useState<string>('W');
  const [zodiac, setZodiac] = useState<string>('ARIES');
  const [superNumber, setSuperNumber] = useState<string>('15');
  const [numbers, setNumbers] = useState<string[]>(['03', '32', '36', '62']);
  const [subGameIdx, setSubGameIdx] = useState<number>(0);
  const [evaluatedResult, setEvaluatedResult] = useState<any | null>(null);

  const lottery: LotteryInfo = useMemo(() => {
    return getLotteryBySlug(selectedSlug) || ALL_LOTTERIES[0];
  }, [selectedSlug]);

  const currentDraw: LotteryDraw | undefined = useMemo(() => {
    return lottery.draws[selectedDrawIndex] || lottery.draws[0];
  }, [lottery, selectedDrawIndex]);

  // Handle lottery selection change
  const handleLotteryChange = (slug: string) => {
    setSelectedSlug(slug);
    setSelectedDrawIndex(0);
    setEvaluatedResult(null);

    const lot = getLotteryBySlug(slug) || ALL_LOTTERIES[0];
    const firstDraw = lot.draws[0] as LotteryDraw | undefined;

    // A lottery with no downloaded draws (e.g. Waasi) must not crash the view.
    if (!firstDraw) {
      setLetter('A');
      setZodiac('ARIES');
      setSuperNumber('10');
      setNumbers(['01', '02', '03', '04']);
      return;
    }

    // Seed defaults based on lottery format
    setLetter(firstDraw.letter || 'A');
    setZodiac(firstDraw.zodiac || 'ARIES');
    setSuperNumber(firstDraw.superNumber ? String(firstDraw.superNumber) : '10');

    const ballCount = lot.ballCount || 4;
    const sampleBalls = firstDraw.numbers.slice(0, ballCount);
    while (sampleBalls.length < ballCount) sampleBalls.push('01');
    setNumbers(sampleBalls);
  };

  const handleNumberChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    const updated = [...numbers];
    updated[index] = clean;
    setNumbers(updated);
  };

  const handleCheck = () => {
    if (!currentDraw) return;
    const evalRes = evaluateLotteryPrize(
      lottery.slug,
      currentDraw,
      {
        letter: lottery.hasLetter ? letter.toUpperCase() : null,
        zodiac: lottery.hasZodiac ? zodiac.toUpperCase() : null,
        superNumber: lottery.hasSuperNumber ? superNumber : null,
        numbers: numbers.map((n) => n.padStart(2, '0'))
      },
      subGameIdx
    );

    setEvaluatedResult(evalRes);

    if (evalRes.won) {
      if (soundEnabled) playWinCelebrationSound();
    } else {
      if (soundEnabled) playLoseTone();
    }

    if (soundEnabled) {
      speakResult(
        evalRes.won,
        lottery.name,
        evalRes.prizeLabel,
        evalRes.prizeAmountFormatted,
        language
      );
    }

    // Save to history
    onRecordHistory({
      id: 'manual_' + Date.now(),
      timestamp: Date.now(),
      lotterySlug: lottery.slug,
      lotteryName: lottery.name,
      provider: lottery.provider,
      drawNo: currentDraw.drawNo,
      date: currentDraw.date,
      scannedNumbers: numbers.map((n) => n.padStart(2, '0')),
      scannedLetter: lottery.hasLetter ? letter.toUpperCase() : null,
      scannedZodiac: lottery.hasZodiac ? zodiac.toUpperCase() : null,
      scannedSuperNumber: lottery.hasSuperNumber ? superNumber : null,
      officialDraw: currentDraw,
      prizeEvaluation: evalRes,
      scanMethod: 'manual'
    });
  };

  const t = {
    en: {
      heading: 'Manual Ticket Verification',
      sub: 'Select lottery, draw number, and enter ticket values to calculate your winnings.',
      selectLottery: 'Select Lottery',
      selectDraw: 'Select Draw',
      drawNo: 'Draw #',
      date: 'Date',
      letter: 'English Letter',
      zodiac: 'Zodiac Sign',
      superNumber: 'Super Number',
      ticketNumbers: 'Ticket Ball Numbers',
      checkBtn: 'Calculate Prize & Check Result',
      resultHeader: 'Verification Result',
      officialWinning: 'Official Winning Numbers',
      matched: 'Matched Balls',
      prize: 'Prize Won'
    },
    si: {
      heading: 'අතින් ලොතරැයි පරීක්ෂාව',
      sub: 'ලොතරැයිය සහ දිනුම් වාරය තෝරා, ඔබගේ ටිකට්පත් අංක ඇතුළත් කර ක්ෂණිකව ජයග්‍රහණ පරීක්ෂා කරන්න.',
      selectLottery: 'ලොතරැයිය තෝරන්න',
      selectDraw: 'දිනුම් වාරය තෝරන්න',
      drawNo: 'දිනුම් වාරය',
      date: 'දිනය',
      letter: 'ඉංග්‍රීසි අකුර',
      zodiac: 'ලග්නය',
      superNumber: 'සුපිරි අංකය',
      ticketNumbers: 'ටිකට්පතේ අංක',
      checkBtn: 'ප්‍රතිඵලය පරීක්ෂා කරන්න',
      resultHeader: 'ප්‍රතිඵල විස්තරය',
      officialWinning: 'නිල ජයග්‍රාහී අංක',
      matched: 'ගැලපුණු අංක',
      prize: 'දිනාගත් ත්‍යාගය'
    },
    ta: {
      heading: 'கைமுறை லாட்டரி சரிபார்ப்பு',
      sub: 'லாட்டரியைத் தேர்ந்தெடுத்து உங்கள் டிக்கெட் எண்களை உள்ளிட்டு வெற்றியைச் சரிபார்க்கவும்.',
      selectLottery: 'லாட்டரியைத் தேர்ந்தெடுக்கவும்',
      selectDraw: 'குலுக்கல் எண்',
      drawNo: 'குலுக்கல் #',
      date: 'தேதி',
      letter: 'ஆங்கில எழுத்து',
      zodiac: 'ராசி',
      superNumber: 'சூப்பர் எண்',
      ticketNumbers: 'டிக்கெட் எண்கள்',
      checkBtn: 'முடிவைச் சரிபார்க்கவும்',
      resultHeader: 'சரிபார்ப்பு முடிவு',
      officialWinning: 'வெற்றி எண்கள்',
      matched: 'பொருந்திய எண்கள்',
      prize: 'பரிசு தொகை'
    }
  }[language];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">{t.heading}</h2>
            <p className="text-xs text-slate-400">{t.sub}</p>
          </div>
        </div>

        {/* Lottery Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Lottery Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              {t.selectLottery}
            </label>
            <select
              id="select-lottery-dropdown"
              value={selectedSlug}
              onChange={(e) => handleLotteryChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-amber-400 focus:outline-none"
            >
              <optgroup label="National Lotteries Board (NLB)">
                {ALL_LOTTERIES.filter((l) => l.provider === 'NLB').map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Development Lotteries Board (DLB)">
                {ALL_LOTTERIES.filter((l) => l.provider === 'DLB').map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Draw Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              {t.selectDraw}
            </label>
            <select
              id="select-draw-dropdown"
              value={selectedDrawIndex}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setSelectedDrawIndex(idx);
                setEvaluatedResult(null);
              }}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-amber-400 focus:outline-none"
            >
              {lottery.draws.map((d, i) => (
                <option key={d.drawNo} value={i}>
                  {t.drawNo}: {d.drawNo} ({d.date}) — Jackpot: {formatRs(d.jackpotAmount || null)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input Controls for Ticket Components */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 mb-6 space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* English Letter */}
            {lottery.hasLetter && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  {t.letter}
                </label>
                <input
                  id="ticket-letter-input"
                  type="text"
                  maxLength={1}
                  value={letter}
                  onChange={(e) => setLetter(e.target.value.toUpperCase())}
                  className="w-14 h-12 bg-slate-900 border border-slate-700 rounded-xl text-center text-lg font-bold text-amber-400 uppercase focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>
            )}

            {/* Zodiac Sign */}
            {lottery.hasZodiac && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  {t.zodiac}
                </label>
                <select
                  id="ticket-zodiac-select"
                  value={zodiac}
                  onChange={(e) => setZodiac(e.target.value)}
                  className="h-12 bg-slate-900 border border-slate-700 rounded-xl px-3 text-sm font-bold text-purple-300 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                >
                  {ZODIAC_SIGNS.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Super Number */}
            {lottery.hasSuperNumber && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  {t.superNumber}
                </label>
                <input
                  id="ticket-super-input"
                  type="text"
                  maxLength={2}
                  value={superNumber}
                  onChange={(e) => setSuperNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-14 h-12 bg-slate-900 border border-amber-500/40 rounded-xl text-center text-lg font-bold text-amber-300 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>
            )}

            {/* Ball Numbers */}
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                {t.ticketNumbers} ({lottery.ballCount} numbers)
              </label>
              <div className="flex flex-wrap gap-2">
                {numbers.map((num, i) => (
                  <input
                    key={i}
                    id={`ticket-ball-${i}`}
                    type="text"
                    maxLength={2}
                    value={num}
                    onChange={(e) => handleNumberChange(i, e.target.value)}
                    className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-xl text-center text-base font-bold font-mono text-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    placeholder="00"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Subgame selector if Ada Sampatha or Suba Dawasak */}
          {currentDraw?.subGames && (
            <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">Sub Game:</span>
              {currentDraw.subGames.map((sg, idx) => (
                <button
                  key={idx}
                  onClick={() => setSubGameIdx(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    subGameIdx === idx
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {sg.title || `Game ${idx + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Check Button */}
        {!currentDraw && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-100">
            No official draw results are downloaded for this lottery yet, so it cannot be scored automatically.
            Download fresh results or use the QR scanner once the results are available.
          </div>
        )}

        <button
          id="btn-manual-check"
          onClick={handleCheck}
          disabled={!currentDraw}
          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 hover:from-amber-400 to-emerald-500 hover:to-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          <span>{t.checkBtn}</span>
        </button>

        {/* Evaluation Output Card */}
        {evaluatedResult && (
          <div
            className={`mt-6 p-5 rounded-2xl border transition-all ${
              evaluatedResult.won
                ? 'bg-gradient-to-b from-emerald-950/40 to-slate-900 border-emerald-500/40 shadow-xl'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Trophy
                  className={`w-6 h-6 ${
                    evaluatedResult.won ? 'text-amber-400 animate-bounce' : 'text-slate-500'
                  }`}
                />
                <h3 className="font-bold text-base text-white">
                  {evaluatedResult.won ? evaluatedResult.prizeLabel : 'No Winning Combinations'}
                </h3>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  evaluatedResult.won
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {evaluatedResult.won ? 'WINNER' : 'NO WIN'}
              </span>
            </div>

            {/* Prize amount */}
            {evaluatedResult.won && (
              <div className="mb-4 p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-center">
                <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                  {t.prize}
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                  {evaluatedResult.prizeAmountFormatted}
                </div>
              </div>
            )}

            {/* Comparison */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">{t.officialWinning}:</span>
                <div className="flex items-center gap-1.5">
                  {currentDraw.letter && (
                    <span className="w-6 h-6 rounded bg-slate-800 text-amber-400 font-bold flex items-center justify-center">
                      {currentDraw.letter}
                    </span>
                  )}
                  {currentDraw.zodiac && (
                    <span className="px-2 h-6 rounded bg-purple-900/60 text-purple-300 font-bold flex items-center justify-center text-[10px]">
                      {currentDraw.zodiac}
                    </span>
                  )}
                  {currentDraw.superNumber && (
                    <span className="w-6 h-6 rounded bg-amber-900/50 text-amber-300 font-bold flex items-center justify-center text-[11px]">
                      ★{currentDraw.superNumber}
                    </span>
                  )}
                  {currentDraw.numbers.map((n, i) => (
                    <span
                      key={i}
                      className="w-6 h-6 rounded bg-slate-800 text-white font-mono font-bold flex items-center justify-center text-[11px]"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t.matched}:</span>
                <div className="flex items-center gap-1.5">
                  {evaluatedResult.matchedNumbers.length > 0 ? (
                    evaluatedResult.matchedNumbers.map((n: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold font-mono text-xs"
                      >
                        {n}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">None</span>
                  )}
                  {evaluatedResult.letterMatch && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      Letter Match
                    </span>
                  )}
                  {evaluatedResult.zodiacMatch && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                      Zodiac Match
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
