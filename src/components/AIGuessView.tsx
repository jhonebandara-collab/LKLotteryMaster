import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Clock, Flame, ShieldAlert, BookmarkPlus, RefreshCw, Layers } from 'lucide-react';
import { ALL_LOTTERIES, getLotteryBySlug } from '../data/lotteries';
import { generateStrategicLotteryGuess } from '../services/geminiService';
import { saveTicketToUser } from '../services/storageService';
import { AIGuessResult, LotteryDefinition } from '../types';

interface AIGuessViewProps {
  lang: 'si' | 'en';
  onOpenSubscription: () => void;
}

export const AIGuessView: React.FC<AIGuessViewProps> = ({
  lang,
  onOpenSubscription
}) => {
  const isSinhala = lang === 'si';
  const [selectedSlug, setSelectedSlug] = useState<string>('mahajana-sampatha');
  const [guess, setGuess] = useState<AIGuessResult | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const currentLottery = getLotteryBySlug(selectedSlug) || ALL_LOTTERIES[0];

  useEffect(() => {
    updateGuessForLottery(currentLottery);
  }, [selectedSlug]);

  const updateGuessForLottery = (lot: LotteryDefinition) => {
    setIsGenerating(true);
    setTimeout(() => {
      const g = generateStrategicLotteryGuess(lot);
      setGuess(g);
      setIsGenerating(false);
    }, 200);
  };

  const handleSaveRecommendation = () => {
    if (!guess) return;
    saveTicketToUser({
      slug: currentLottery.slug,
      drawNo: 'Next Draw',
      drawDate: new Date().toISOString().slice(0, 10),
      letter: guess.recommendedLetter,
      zodiac: guess.recommendedZodiac,
      superNumber: guess.recommendedSuperNumber,
      numbers: guess.recommendedNumbers,
      status: 'pending'
    });
    alert(isSinhala ? 'අනුමාන අංක ඔබගේ ගිණුමේ සාර්ථකව සුරකින ලදී!' : 'Recommended numbers saved to My Account!');
  };

  return (
    <div className="space-y-6">
      {/* Header card with disclaimer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                {isSinhala ? '🍀 මගේ වාසනාව (AI Lottery Prediction Engine)' : 'AI Strategic Lottery Predictor'}
              </h2>
              <p className="text-xs text-slate-400">
                {isSinhala 
                  ? 'ඊළඟට මිලදී ගැනීමට වඩාත්ම සම්භාවිතාව ඇති හොඳම අංක ලොතරැයි අනුව ලබාගන්න' 
                  : 'Lottery-wise next buy strategic recommendations powered by historical analytics'}
              </p>
            </div>
          </div>

          <button
            onClick={() => updateGuessForLottery(currentLottery)}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin text-amber-400' : ''}`} />
            <span>{isSinhala ? 'අලුත් අනුමානයක් හදන්න' : 'Regenerate'}</span>
          </button>
        </div>

        {/* Lottery-wise Selector Tabs */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            {isSinhala ? 'ලොතරැයිය තෝරන්න (Select Lottery for Best Guess):' : 'Select Lottery for Best Buy Guess:'}
          </label>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {ALL_LOTTERIES.map(lot => (
              <button
                key={lot.slug}
                onClick={() => setSelectedSlug(lot.slug)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  selectedSlug === lot.slug
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isSinhala ? lot.nameSi : lot.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Prediction Details for Selected Lottery */}
      {guess && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Recommended Numbers Card */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {currentLottery.provider} Official
                </span>
                <h3 className="text-xl font-black text-white mt-1">
                  {isSinhala ? currentLottery.nameSi : currentLottery.name}
                </h3>
              </div>

              {/* Confidence Meter */}
              <div className="text-right">
                <div className="text-[11px] font-semibold text-slate-400">
                  {isSinhala ? 'සංඛ්‍යාන ගැලපීම' : 'Alignment Score'}
                </div>
                <div className="text-lg font-black text-emerald-400">
                  {guess.confidence}% High
                </div>
              </div>
            </div>

            {/* Recommended Digits Display */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/30 space-y-2">
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSinhala ? 'ඊළඟ Draw එකට මිලදී ගැනීමට හොඳම අනුමානය:' : 'Top Recommended Ticket Combo:'}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {guess.recommendedLetter && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-bold mb-1">{isSinhala ? 'අකුර' : 'Letter'}</span>
                    <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shadow-amber-500/30 border border-amber-300">
                      {guess.recommendedLetter}
                    </div>
                  </div>
                )}

                {guess.recommendedZodiac && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-bold mb-1">{isSinhala ? 'රාශිය' : 'Zodiac'}</span>
                    <div className="h-12 px-3 rounded-xl bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-lg shadow-amber-500/30 border border-amber-300">
                      {guess.recommendedZodiac}
                    </div>
                  </div>
                )}

                {guess.recommendedSuperNumber && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-bold mb-1">Super #</span>
                    <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center shadow-lg shadow-amber-500/30 border border-amber-300">
                      {guess.recommendedSuperNumber}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {guess.recommendedNumbers.map((num, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 font-bold mb-1">#{i + 1}</span>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 font-mono font-black text-lg flex items-center justify-center shadow-lg shadow-amber-500/25">
                        {num}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Analysis Rationale */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {isSinhala ? 'විශ්ලේෂණ පදනම (AI Statistical Rationale):' : 'Statistical Rationale:'}
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {guess.analysisReasoningSi}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSaveRecommendation}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition shadow-md shadow-amber-500/20 active:scale-95"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>{isSinhala ? 'මෙම අංක මගේ ගිණුමට සුරකින්න' : 'Save Recommended Numbers'}</span>
              </button>

              <span className="text-xs text-slate-400">
                {currentLottery.superPrizeStarting}
              </span>
            </div>
          </div>

          {/* Side Statistics (Hot & Overdue Numbers) */}
          <div className="space-y-4">
            {/* Hot Numbers */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Flame className="w-4 h-4" />
                <span>{isSinhala ? 'නිතර පැමිණි අංක (Hot Numbers)' : 'Hot Frequency Numbers'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {guess.hotNumbers.map((h, i) => (
                  <div key={i} className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <div className="text-base font-mono font-black text-rose-300">{h.number}</div>
                    <div className="text-[10px] text-slate-400">{h.frequency}x draws</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue Numbers */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Clock className="w-4 h-4" />
                <span>{isSinhala ? 'දිගු කලක් නොපැමිණි (Overdue)' : 'Overdue Numbers'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {guess.overdueNumbers.map((o, i) => (
                  <div key={i} className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <div className="text-base font-mono font-black text-cyan-300">{o.number}</div>
                    <div className="text-[10px] text-slate-400">{o.drawsAgo} draws ago</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal Notice Box */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-bold text-amber-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isSinhala ? 'වගකීම් ප්‍රකාශය:' : 'Disclaimer:'}</span>
              </div>
              <p>
                {isSinhala 
                  ? 'මෙය පසුගිය ප්‍රතිඵල මත පදනම් වූ සංඛ්‍යානමය විශ්ලේෂණයක් පමණි. දිනුම් සහතික නොවේ.' 
                  : 'Purely informational statistical guidance. Does not guarantee winning.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
