import React, { useState, useEffect } from 'react';
import { Calendar, Hash, CheckCircle, Search, RefreshCw, Sparkles, QrCode, AlertCircle } from 'lucide-react';
import { ALL_LOTTERIES, getLotteryBySlug } from '../data/lotteries';
import { evaluateLotteryPrize } from '../data/prizes';
import { LotteryDefinition, PrizeEvaluationResult, TicketCheckInput, ZodiacSign } from '../types';
import { incrementCheckCounter } from '../services/storageService';

interface ManualCheckViewProps {
  lang: 'si' | 'en';
  onCheckFinished: (result: PrizeEvaluationResult, ticket: TicketCheckInput) => void;
  onOpenScanner: (mode?: 'qr' | 'ai') => void;
  onRequestAd: () => void;
}

const ZODIAC_LIST: ZodiacSign[] = [
  'ARIES', 'TAURUS', 'GEMINI', 'CANCER', 
  'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 
  'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'
];

export const ManualCheckView: React.FC<ManualCheckViewProps> = ({
  lang,
  onCheckFinished,
  onOpenScanner,
  onRequestAd
}) => {
  const isSinhala = lang === 'si';

  const [selectedSlug, setSelectedSlug] = useState<string>('mahajana-sampatha');
  const [searchMode, setSearchMode] = useState<'date' | 'drawNo'>('date');
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-18');
  const [selectedDrawNo, setSelectedDrawNo] = useState<string>('6314');

  const [ticketLetter, setTicketLetter] = useState<string>('J');
  const [ticketZodiac, setTicketZodiac] = useState<string>('LEO');
  const [ticketSuperNumber, setTicketSuperNumber] = useState<string>('12');
  const [ticketNumbers, setTicketNumbers] = useState<string[]>(['3', '5', '9', '0', '8', '1']);

  const currentLottery = getLotteryBySlug(selectedSlug) || ALL_LOTTERIES[0];

  // Whenever lottery changes, reinitialize numbers
  useEffect(() => {
    const lot = getLotteryBySlug(selectedSlug) || ALL_LOTTERIES[0];
    const latest = lot.draws[0];

    if (latest) {
      setSelectedDate(latest.date);
      setSelectedDrawNo(latest.drawNo);
      setTicketLetter(latest.letter || 'A');
      setTicketZodiac(latest.zodiac || 'LEO');
      setTicketSuperNumber(latest.superNumber || '10');
      setTicketNumbers(latest.numbers ? [...latest.numbers] : Array(lot.numberCount).fill('0'));
    } else {
      setTicketNumbers(Array(lot.numberCount).fill('0'));
    }
  }, [selectedSlug]);

  const handleNumberChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, currentLottery.digitWidth);
    const updated = [...ticketNumbers];
    updated[index] = clean;
    setTicketNumbers(updated);

    // Auto-advance focus to next input
    if (clean.length === currentLottery.digitWidth && index < currentLottery.numberCount - 1) {
      const nextInput = document.getElementById(`digit-box-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handlePerformCheck = () => {
    // Check ad trigger (every 3rd free check)
    const { shouldShowAd } = incrementCheckCounter();
    if (shouldShowAd) {
      onRequestAd();
    }

    // Find the relevant draw by date or drawNo
    let matchedDraw = currentLottery.draws.find(d => 
      searchMode === 'date' ? d.date === selectedDate : d.drawNo === selectedDrawNo
    );

    const now = new Date();
    const currentIsoDate = now.toISOString().slice(0, 10);

    // Check if draw is pending
    const isFuture = searchMode === 'date' 
      ? selectedDate > currentIsoDate || (selectedDate === currentIsoDate && now.getHours() < 21)
      : Number(selectedDrawNo) > Number(currentLottery.draws[0]?.drawNo || '0');

    if (!matchedDraw) {
      if (isFuture) {
        const pendingResult: PrizeEvaluationResult = {
          won: false,
          isDrawPending: true,
          drawPendingDate: selectedDate,
          tier: null,
          prizeLabel: null,
          prizeAmountRs: 0,
          prizeAmountFormatted: null,
          note: `දිනුම් ඇදීම තවම සිදු වී නොමැත. ${selectedDate} දින රාත්‍රී 9:30 ට නිල ප්‍රතිඵල නිකුත් වූ පසු පරීක්ෂා කළ හැක.`
        };

        onCheckFinished(pendingResult, {
          slug: currentLottery.slug,
          date: selectedDate,
          drawNo: selectedDrawNo,
          letter: currentLottery.hasLetter ? ticketLetter : undefined,
          zodiac: currentLottery.hasZodiac ? ticketZodiac : undefined,
          superNumber: currentLottery.hasSuperNumber ? ticketSuperNumber : undefined,
          numbers: ticketNumbers
        });
        return;
      }

      // If past draw not in archive, fallback to latest
      matchedDraw = currentLottery.draws[0];
    }

    const ticketInput: TicketCheckInput = {
      slug: currentLottery.slug,
      date: selectedDate,
      drawNo: selectedDrawNo,
      letter: currentLottery.hasLetter ? ticketLetter : undefined,
      zodiac: currentLottery.hasZodiac ? ticketZodiac : undefined,
      superNumber: currentLottery.hasSuperNumber ? ticketSuperNumber : undefined,
      numbers: ticketNumbers
    };

    const evaluation = evaluateLotteryPrize(currentLottery.slug, matchedDraw, ticketInput);
    onCheckFinished(evaluation, ticketInput);
  };

  return (
    <div className="space-y-6">
      {/* Dual Scanner Buttons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Quick QR Continuous Camera Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 p-4 sm:p-5 text-slate-950 shadow-xl shadow-amber-500/10 flex flex-col justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">
                  {isSinhala ? 'නොනවතින Micro-QR Scanner' : 'Continuous QR Scanner'}
                </h3>
                <span className="px-2 py-0.5 bg-slate-950 text-amber-300 font-bold text-[10px] rounded-full">
                  0.2s Fast
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-900/85 mt-1 leading-snug">
                {isSinhala 
                  ? 'එක දිගට ටිකට්පත් ස්කෑන් කරන්න. එක් ටිකට්පතක් ස්කෑන් වූ පසු තත්පර 5ක් ප්‍රතිඵලය පෙන්වා ස්වයංක්‍රීයව ඊළඟ ටිකට්පත කියවයි.' 
                  : 'Scans continuously! Displays result for 5s with Rupees audio and automatically advances to the next ticket.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenScanner('qr')}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-amber-300 font-black rounded-xl text-xs sm:text-sm transition shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>{isSinhala ? 'QR Scanner අරඹන්න' : 'Launch QR Scanner'}</span>
          </button>
        </div>

        {/* 2. Lottery Scan (AI Camera for Damaged/Blurred Tickets) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-4 sm:p-5 border border-purple-500/40 text-white shadow-xl flex flex-col justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-purple-200">
                  {isSinhala ? 'Lottery Scan (AI Vision)' : 'Lottery Scan (AI Vision)'}
                </h3>
                <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 font-bold text-[10px] rounded-full border border-purple-500/40">
                  Gemini AI
                </span>
              </div>
              {/* Important user-requested note */}
              <div className="mt-1.5 p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] font-medium text-amber-200 leading-tight">
                <span className="font-bold">⚠️ {isSinhala ? 'විශේෂ සටහන:' : 'Special Note:'}</span>{' '}
                {isSinhala 
                  ? 'QR කේතය ක්‍රියා නොකරන්නේ නම් හෝ ලොතරැයි පත හානි වී (Damaged/Blurred) ඇත්නම් පමණක් මෙය භාවිතා කරන්න. කැමරාවෙන් ඡායාරූපය ගත් වහාම AI මඟින් අංක කියවා නිල දිනුම පෙන්වයි.' 
                  : 'Use this only if the QR code fails or the ticket is damaged. Camera captures and reads ticket via Gemini Vision in seconds.'}
              </div>
            </div>
          </div>

          <button
            onClick={() => onOpenScanner('ai')}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs sm:text-sm transition shadow-lg shadow-purple-600/30 active:scale-95 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSinhala ? 'Lottery Scan (AI) අරඹන්න' : 'Launch Lottery Scan (AI)'}</span>
          </button>
        </div>
      </div>

      {/* Manual Check Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>✍️</span> {isSinhala ? 'අතින් අංක දමා පරීක්ෂා කිරීම' : 'Manual Ticket Verification'}
            </h2>
            <p className="text-xs text-slate-400">
              {isSinhala ? 'ලොතරැයිය සහ දිනය හෝ Draw අංකය තෝරා අංක ඇතුළත් කරන්න' : 'Select lottery, pick calendar date or draw number'}
            </p>
          </div>

          {/* Search Mode Toggle (Calendar vs Draw No) */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto text-xs font-bold">
            <button
              onClick={() => setSearchMode('date')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                searchMode === 'date' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{isSinhala ? 'දිනය අනුව (Calendar)' : 'By Date'}</span>
            </button>
            <button
              onClick={() => setSearchMode('drawNo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                searchMode === 'drawNo' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>{isSinhala ? 'Draw අංකය අනුව' : 'By Draw #'}</span>
            </button>
          </div>
        </div>

        {/* Lottery Selection & Date/Draw Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Lottery Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              {isSinhala ? '1. ලොතරැයිය තෝරන්න (Select Lottery):' : '1. Select Lottery:'}
            </label>
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-400"
            >
              <optgroup label="ජාතික ලොතරැයි මණ්ඩලය (NLB)">
                {ALL_LOTTERIES.filter(l => l.provider === 'NLB').map(lot => (
                  <option key={lot.slug} value={lot.slug}>
                    {isSinhala ? lot.nameSi : lot.name} ({lot.provider})
                  </option>
                ))}
              </optgroup>
              <optgroup label="සංවර්ධන ලොතරැයි මණ්ඩලය (DLB)">
                {ALL_LOTTERIES.filter(l => l.provider === 'DLB').map(lot => (
                  <option key={lot.slug} value={lot.slug}>
                    {isSinhala ? lot.nameSi : lot.name} ({lot.provider})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Calendar Date OR Draw Number Input */}
          <div>
            {searchMode === 'date' ? (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>{isSinhala ? '2. දිනය තෝරන්න (Calendar Date):' : '2. Pick Draw Date:'}</span>
                  <span className="text-[10px] text-amber-400 font-normal">
                    {isSinhala ? 'පසුගිය මාස 6ම ඇතුළත්' : 'Full 6-mo archive'}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    max="2026-12-31"
                    min="2026-01-01"
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      const found = currentLottery.draws.find(d => d.date === e.target.value);
                      if (found) setSelectedDrawNo(found.drawNo);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>{isSinhala ? '2. Draw අංකය (Draw Number):' : '2. Draw Number:'}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    නවතම: #{currentLottery.draws[0]?.drawNo}
                  </span>
                </label>
                <input
                  type="text"
                  value={selectedDrawNo}
                  onChange={(e) => {
                    setSelectedDrawNo(e.target.value);
                    const found = currentLottery.draws.find(d => d.drawNo === e.target.value);
                    if (found) setSelectedDate(found.date);
                  }}
                  placeholder="Draw No (e.g. 6314)"
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold focus:outline-none focus:border-amber-400"
                />
              </div>
            )}
          </div>
        </div>

        {/* Input Boxes for Ticket Numbers */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {isSinhala ? '3. ඔබගේ ප්‍රවේශපත්‍ර අංක ඇතුළත් කරන්න:' : '3. Enter Your Ticket Numbers:'}
            </span>
            <span className="text-[11px] text-slate-400">
              {currentLottery.numberCount} Numbers ({currentLottery.digitWidth === 1 ? 'Single Digits' : '2-Digit Numbers'})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Letter input box if lottery has letter */}
            {currentLottery.hasLetter && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-amber-400 mb-1">
                  {isSinhala ? 'අකුර' : 'Letter'}
                </span>
                <input
                  type="text"
                  maxLength={1}
                  value={ticketLetter}
                  onChange={(e) => setTicketLetter(e.target.value.toUpperCase().slice(0, 1))}
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 border-2 border-amber-500/60 focus:border-amber-400 text-white font-black text-center text-lg sm:text-xl rounded-xl focus:outline-none shadow-inner"
                />
              </div>
            )}

            {/* Zodiac selector if lottery has zodiac */}
            {currentLottery.hasZodiac && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-amber-400 mb-1">
                  {isSinhala ? 'රාශිය' : 'Zodiac'}
                </span>
                <select
                  value={ticketZodiac}
                  onChange={(e) => setTicketZodiac(e.target.value)}
                  className="h-12 sm:h-14 bg-slate-900 border-2 border-amber-500/60 focus:border-amber-400 text-white font-bold text-xs sm:text-sm px-2 rounded-xl focus:outline-none"
                >
                  {ZODIAC_LIST.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Super Number input if lottery has super number */}
            {currentLottery.hasSuperNumber && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-amber-400 mb-1">Super #</span>
                <input
                  type="text"
                  maxLength={2}
                  value={ticketSuperNumber}
                  onChange={(e) => setTicketSuperNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-900 border-2 border-amber-500/60 focus:border-amber-400 text-white font-black text-center text-base sm:text-lg rounded-xl focus:outline-none"
                />
              </div>
            )}

            {/* Number boxes */}
            <div className="flex flex-wrap items-center gap-2">
              {ticketNumbers.map((val, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1">#{idx + 1}</span>
                  <input
                    id={`digit-box-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={currentLottery.digitWidth}
                    value={val}
                    onChange={(e) => handleNumberChange(idx, e.target.value)}
                    className="w-11 h-12 sm:w-13 sm:h-14 bg-slate-900 border border-slate-700 focus:border-amber-400 text-amber-300 font-mono font-black text-center text-base sm:text-lg rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handlePerformCheck}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-base transition shadow-lg shadow-amber-500/25 active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-5 h-5" />
          <span>{isSinhala ? 'දිනුම් ප්‍රතිඵලය පරීක්ෂා කරන්න (Check Prize)' : 'Check Prize Now'}</span>
        </button>
      </div>
    </div>
  );
};
