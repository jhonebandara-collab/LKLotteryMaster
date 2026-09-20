import React, { useEffect } from 'react';
import { X, Trophy, AlertCircle, Clock, BookmarkPlus, ArrowRight, Share2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PrizeEvaluationResult, TicketCheckInput, LotteryDefinition } from '../types';
import { getLotteryBySlug } from '../data/lotteries';
import { saveTicketToUser } from '../services/storageService';
import { speakLotteryResult } from '../services/audioService';

interface TicketCheckResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PrizeEvaluationResult | null;
  ticket: TicketCheckInput | null;
  lang: 'si' | 'en';
  onNavigateToGuess?: () => void;
}

export const TicketCheckResultModal: React.FC<TicketCheckResultModalProps> = ({
  isOpen,
  onClose,
  result,
  ticket,
  lang,
  onNavigateToGuess
}) => {
  const isSinhala = lang === 'si';

  useEffect(() => {
    if (isOpen && result) {
      if (result.won) {
        // Fire celebratory confetti!
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ec4899']
        });
      }

      // Voice result with "Rupees" pronunciation
      if (!result.isDrawPending) {
        speakLotteryResult(result.won, result.prizeLabel, result.prizeAmountRs, isSinhala);
      }
    }
  }, [isOpen, result]);

  if (!isOpen || !result || !ticket) return null;

  const lottery = getLotteryBySlug(ticket.slug);
  const matchedSet = new Set(result.matchedNumbers || []);

  const handleSaveTicket = () => {
    saveTicketToUser({
      slug: ticket.slug,
      drawNo: ticket.drawNo,
      drawDate: ticket.date,
      letter: ticket.letter,
      zodiac: ticket.zodiac,
      superNumber: ticket.superNumber,
      numbers: ticket.numbers,
      status: result.isDrawPending ? 'pending' : (result.won ? 'won' : 'lost'),
      prizeAmountRs: result.prizeAmountRs
    });
    alert(isSinhala ? 'ටිකට්පත ඔබගේ ගිණුමේ සාර්ථකව සුරකින ලදී!' : 'Ticket successfully saved to My Account!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎟️</span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {isSinhala ? lottery?.nameSi || lottery?.name : lottery?.name}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {ticket.drawNo ? `Draw #${ticket.drawNo}` : ''} {ticket.date ? `• ${ticket.date}` : ''}
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* CASE 1: DRAW IS PENDING (Future / Tonight's Draw) */}
          {result.isDrawPending ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-amber-200">
                {isSinhala ? 'දිනුම් ඇදීම තවම සිදු වී නොමැත' : 'Draw Result Pending'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
                {result.note || (isSinhala 
                  ? 'මෙම ප්‍රවේශපත්‍රයේ දිනුම් ඇදීමේ නිල ප්‍රතිඵල තවම නිකුත් කර නොමැත. අද රාත්‍රී 9:30 ට ප්‍රතිඵල නිකුත් වූ පසු මෙහි දිනුම් මුදල පරීක්ෂා කළ හැක.' 
                  : 'The official draw for this ticket has not taken place yet. Official results are announced at 9:30 PM.')}
              </p>
              <div className="pt-2">
                <button
                  onClick={handleSaveTicket}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition shadow-lg shadow-amber-500/20"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  {isSinhala ? 'මගේ ටිකට්පත් වලට සුරකින්න' : 'Save to My Tickets'}
                </button>
              </div>
            </div>
          ) : result.won ? (
            /* CASE 2: TICKET WON! */
            <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-950 border border-amber-500/40 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20">
                <Trophy className="w-9 h-9 animate-bounce" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 text-xs font-black uppercase tracking-wider bg-amber-500 text-slate-950 rounded-full mb-1">
                  🎉 {isSinhala ? 'සුබ පැතුම්! ඔබ දිනුම්!' : 'CONGRATULATIONS! YOU WON!'}
                </span>
                <div className="text-2xl sm:text-4xl font-black tracking-tight text-white mt-1">
                  {result.prizeAmountFormatted || `Rs. ${result.prizeAmountRs.toLocaleString()}`}
                </div>
                <div className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5">
                  {result.prizeLabel || result.tier}
                </div>
              </div>
            </div>
          ) : (
            /* CASE 3: NO WIN */
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-200">
                  {isSinhala ? 'මෙම වාරයේ දිනුමක් නොමැත' : 'No Win This Time'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {isSinhala 
                    ? 'මෙම ප්‍රවේශපත්‍රය සඳහා කිසිදු ත්‍යාග මට්ටමක් ගැලපී නොමැත.' 
                    : 'This ticket did not match any winning prize tiers for this draw.'}
                </p>
              </div>
            </div>
          )}

          {/* Ticket Numbers vs Official Comparison Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {isSinhala ? 'ඔබගේ ටිකට්පත් අංක (Your Ticket Numbers):' : 'Your Ticket Numbers:'}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ticket.letter && (
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${
                  result.letterMatched 
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' 
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}>
                  {ticket.letter}
                </div>
              )}

              {ticket.zodiac && (
                <div className={`px-2.5 h-10 rounded-xl flex items-center justify-center font-bold text-xs border ${
                  result.zodiacMatched 
                    ? 'bg-amber-500 text-slate-950 border-amber-400' 
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}>
                  {ticket.zodiac}
                </div>
              )}

              {ticket.superNumber && (
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${
                  result.superNumberMatched 
                    ? 'bg-amber-500 text-slate-950 border-amber-400' 
                    : 'bg-slate-900 text-slate-300 border-slate-700'
                }`}>
                  SN:{ticket.superNumber}
                </div>
              )}

              {ticket.numbers.map((num, i) => {
                const isMatched = matchedSet.has(num);
                return (
                  <div
                    key={i}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-sm border ${
                      isMatched 
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 scale-105' 
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legal Disclaimer Footer Note */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-300">⚠️ {isSinhala ? 'නෛතික වගකීම් ප්‍රකාශය:' : 'Legal Notice:'}</span>{' '}
            {isSinhala 
              ? 'මෙම ප්‍රතිඵල පරිශීලක පහසුව සඳහා පමණක් වන අතර, ත්‍යාග හිමිකම් පෑමට පෙර ජාතික ලොතරැයි මණ්ඩලයේ (NLB) හෝ සංවර්ධන ලොතරැයි මණ්ඩලයේ (DLB) නිල ගැසට් පත්‍රය සමඟ සැසඳිය යුතුය.'
              : 'Official winning claims must strictly be validated against NLB/DLB official gazette results.'}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handleSaveTicket}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-700 transition"
          >
            <BookmarkPlus className="w-4 h-4 text-amber-400" />
            <span>{isSinhala ? 'සුරකින්න' : 'Save'}</span>
          </button>

          <div className="flex items-center gap-2">
            {onNavigateToGuess && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToGuess();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-950/80 border border-amber-500/40 rounded-xl transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSinhala ? 'ඊළඟ අනුමානය බලන්න' : 'AI Next Guess'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold rounded-xl transition shadow-md shadow-amber-500/20"
            >
              {isSinhala ? 'හරි' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
