import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Pause,
  Play,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Ticket,
  BadgeCheck,
  HelpCircle,
  Volume2,
  VolumeX,
  Calendar,
  Hash
} from 'lucide-react';
import { DrawMatchMethod, DrawResolutionStatus, LotteryDraw, PrizeEvaluation, Language } from '../types/lottery';
import { playLoseTone, playWinCelebrationSound, primeAudio, speakResult, vibrateWin } from '../utils/audioFeedback';

export interface ScannedTicketView {
  letter?: string | null;
  zodiac?: string | null;
  superNumber?: string | null;
  numbers: string[];
}

interface ScanResultModalProps {
  isOpen: boolean;
  scanKey: string;
  onClose: () => void;
  evaluation: PrizeEvaluation | null;
  lotteryName: string;
  lotterySlug: string;
  drawNo?: string;
  officialDraw?: LotteryDraw | null;
  scannedTicket: ScannedTicketView;
  language: Language;
  soundEnabled: boolean;
  onAutoResume: () => void;
  status: DrawResolutionStatus;
  matchMethod: DrawMatchMethod;
  warnings: string[];
  rawPayload?: string | null;
  candidateDraws?: LotteryDraw[];
  onManualDrawSelect?: (draw: LotteryDraw) => void;
  printedDrawNo?: string | null;
  printedDate?: string | null;
  scanMethod?: 'qr' | 'ai' | 'manual';
}

const AUTO_RESUME_SECONDS = 5;

export const ScanResultModal: React.FC<ScanResultModalProps> = ({
  isOpen,
  scanKey,
  onClose,
  evaluation,
  lotteryName,
  lotterySlug,
  drawNo,
  officialDraw,
  scannedTicket,
  language,
  soundEnabled,
  onAutoResume,
  status,
  matchMethod,
  warnings,
  rawPayload,
  candidateDraws = [],
  onManualDrawSelect,
  printedDrawNo,
  printedDate,
  scanMethod
}) => {
  const t = {
    en: {
      congrats: 'WINNING TICKET!',
      noWin: 'No win on this ticket',
      draw: 'Draw',
      date: 'Date',
      yourTicket: 'Numbers read from YOUR ticket',
      officialNumbers: 'Official winning result',
      matched: 'Matched',
      prize: 'Prize won',
      autoResumeIn: 'Next scan starts in',
      seconds: 's',
      scanNextNow: 'Scan next ticket',
      pauseTimer: 'Pause',
      resumeTimer: 'Resume',
      close: 'Close',
      tier: 'Tier',
      unverifiedTitle: 'Could not verify this ticket automatically',
      unverifiedPick: 'Select the correct draw to score against',
      notFound: 'Draw not found in the downloaded results',
      choose: 'Verify against this draw',
      warnings: 'Notes',
      printed: 'Printed on ticket',
      audioHint: 'Tap anywhere once if you do not hear the sound.',
      reason: 'Matched by',
      byDrawNo: 'draw number',
      byDate: 'date',
      byManual: 'manual selection',
      raw: 'Raw QR payload',
      aiRead: 'Numbers read by AI',
      noNumbers: 'No ball numbers were read from this ticket.',
      matchedNumbers: 'Matched numbers',
      none: 'None'
    },
    si: {
      congrats: 'ජයග්‍රාහී ටිකට් පතක්!',
      noWin: 'මෙම ටිකට් පතට දිනුමක් නැත',
      draw: 'දිනුම් වාරය',
      date: 'දිනය',
      yourTicket: 'ඔබේ ටිකට් පතෙන් කියවූ අංක',
      officialNumbers: 'නිල ජයග්‍රාහී ප්‍රතිඵලය',
      matched: 'ගැලපුණු අංක',
      prize: 'දිනාගත් ත්‍යාගය',
      autoResumeIn: 'ඊළඟ ස්කෑනය ආරම්භ වන්නට',
      seconds: 'ත',
      scanNextNow: 'ඊළඟ ටිකට්පත ස්කෑන් කරන්න',
      pauseTimer: 'නවත්වන්න',
      resumeTimer: 'දිගටම',
      close: 'වසන්න',
      tier: 'වර්ගය',
      unverifiedTitle: 'මෙම ටිකට්පත ස්වයංක්‍රීයව තහවුරු කළ නොහැක',
      unverifiedPick: 'නිවැරදි දිනුම් වාරය තෝරන්න',
      notFound: 'බාගත කළ ප්‍රතිඵල අතර මෙම දිනුම් වාරය නොමැත',
      choose: 'මෙම වාරය සමඟ පරීක්ෂා කරන්න',
      warnings: 'සටහන්',
      printed: 'ටිකට් පතේ මුද්‍රිත',
      audioHint: 'ශබ්දය නොඇසේ නම් තිරයේ ඕනෑම තැනක් එක් වරක් ස්පර්ශ කරන්න.',
      reason: 'ගැලපවූ ක්‍රමය',
      byDrawNo: 'දිනුම් වාර අංකය',
      byDate: 'දිනය',
      byManual: 'අතින් තෝරාගැනීම',
      raw: 'QR දත්ත',
      aiRead: 'AI මගින් කියවූ අංක',
      noNumbers: 'මෙම ටිකට් පතෙන් අංක කිසිවක් කියවා නොගැනිණි.',
      matchedNumbers: 'ගැලපුණු අංක',
      none: 'නැත'
    },
    ta: {
      congrats: 'வெற்றி டிக்கெட்!',
      noWin: 'இந்த டிக்கெட்டில் வெற்றி இல்லை',
      draw: 'குலுக்கல்',
      date: 'தேதி',
      yourTicket: 'உங்கள் டிக்கெட்டில் படித்த எண்கள்',
      officialNumbers: 'அதிகாரப்பூர்வ வெற்றி முடிவு',
      matched: 'பொருந்தியவை',
      prize: 'வென்ற பரிசு',
      autoResumeIn: 'அடுத்த ஸ்கேன் தொடங்க',
      seconds: 'வி',
      scanNextNow: 'அடுத்த டிக்கெட்',
      pauseTimer: 'நிறுத்து',
      resumeTimer: 'தொடர்',
      close: 'மூடு',
      tier: 'நிலை',
      unverifiedTitle: 'இந்த டிக்கெட்டை தானாக சரிபார்க்க முடியவில்லை',
      unverifiedPick: 'சரியான குலுக்கலைத் தேர்ந்தெடுக்கவும்',
      notFound: 'பதிவிறக்கிய முடிவுகளில் இந்த குலுக்கல் இல்லை',
      choose: 'இதனுடன் சரிபார்',
      warnings: 'குறிப்புகள்',
      printed: 'டிக்கெட்டில் அச்சிடப்பட்டது',
      audioHint: 'ஒலி கேட்கவில்லை என்றால் ஒருமுறை திரையைத் தட்டவும்.',
      reason: 'பொருந்திய முறை',
      byDrawNo: 'குலுக்கல் எண்',
      byDate: 'தேதி',
      byManual: 'கைமுறை தேர்வு',
      raw: 'QR தரவு',
      aiRead: 'AI படித்த எண்கள்',
      noNumbers: 'இந்த டிக்கெட்டில் எண்கள் படிக்கப்படவில்லை.',
      matchedNumbers: 'பொருந்திய எண்கள்',
      none: 'இல்லை'
    }
  }[language];

  const [countdown, setCountdown] = useState<number>(AUTO_RESUME_SECONDS);
  const [timerPaused, setTimerPaused] = useState<boolean>(false);
  const timerPausedRef = useRef<boolean>(false);
  const finishedRef = useRef<boolean>(false);
  const winner = Boolean(evaluation?.won);
  const verified = status === 'verified';
  const autoResumeEnabled = verified && Boolean(evaluation);

  timerPausedRef.current = timerPaused;

  /* ---------------- Audio + celebration ---------------- */
  useEffect(() => {
    if (!isOpen) return;

    const play = () => {
      if (!soundEnabled) return;
      if (winner) {
        playWinCelebrationSound();
        vibrateWin();
        try {
          confetti({ particleCount: 120, spread: 78, origin: { y: 0.65 } });
          window.setTimeout(() => {
            confetti({ particleCount: 60, spread: 100, origin: { y: 0.4 } });
          }, 320);
        } catch {
          /* confetti is decorative */
        }
      } else {
        playLoseTone();
      }
      speakResult(
        winner,
        lotteryName,
        evaluation?.prizeLabel ?? null,
        evaluation?.prizeAmountFormatted ?? null,
        language
      );
    };

    // The modal opens outside a user gesture, so give the context a moment to
    // resume. If the browser still refuses, the first tap inside this modal
    // replays the sound (see onClickCapture below).
    const timer = window.setTimeout(play, 120);
    return () => window.clearTimeout(timer);
  }, [isOpen, scanKey, winner, soundEnabled, lotteryName, language, evaluation?.prizeLabel, evaluation?.prizeAmountFormatted]);

  const handleGesture = useCallback(() => {
    primeAudio();
    if (!soundEnabled) return;
    if (winner) playWinCelebrationSound();
    else playLoseTone();
  }, [soundEnabled, winner]);

  /* ---------------- Auto resume timer ---------------- */
  useEffect(() => {
    if (!isOpen) return;
    finishedRef.current = false;
    setCountdown(AUTO_RESUME_SECONDS);
    setTimerPaused(false);

    if (!autoResumeEnabled) return;

    const interval = window.setInterval(() => {
      if (timerPausedRef.current || finishedRef.current) return;
      setCountdown((prev) => {
        if (prev <= 1) {
          finishedRef.current = true;
          window.clearInterval(interval);
          onAutoResume();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isOpen, scanKey, autoResumeEnabled, onAutoResume]);

  if (!isOpen) return null;

  const handleManualNext = () => {
    finishedRef.current = true;
    onAutoResume();
  };

  const matched = evaluation?.matchedNumbers || [];
  const official = officialDraw || null;

  const renderTile = (
    value: string,
    key: string,
    options: { isMatch?: boolean; tone?: 'letter' | 'number' | 'zodiac' | 'super'; title?: string }
  ) => {
    const { isMatch, tone = 'number', title } = options;
    const base =
      'min-w-[2.25rem] h-9 px-2 rounded-lg font-bold flex items-center justify-center text-sm shadow-sm transition-colors';
    if (isMatch) return (
      <div key={key} title={title} className={`${base} bg-emerald-500 text-slate-950 ring-2 ring-emerald-300`}>
        {value}
      </div>
    );
    const toneClass =
      tone === 'zodiac'
        ? 'bg-purple-900/60 text-purple-200 border border-purple-500/40 text-[11px]'
        : tone === 'super'
        ? 'bg-amber-900/50 text-amber-200 border border-amber-500/40'
        : tone === 'letter'
        ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
        : 'bg-slate-800 text-slate-200 border border-slate-700';
    return (
      <div key={key} title={title} className={`${base} ${toneClass}`}>
        {value}
      </div>
    );
  };

  const matchReason =
    matchMethod === 'drawNo'
      ? t.byDrawNo
      : matchMethod === 'date'
      ? t.byDate
      : matchMethod === 'manual'
      ? t.byManual
      : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/88 backdrop-blur-md overflow-y-auto"
      onClickCapture={handleGesture}
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-auto animate-pop-in">
        {/* Header */}
        <div
          className={`p-4 sm:p-5 text-center ${
            !verified
              ? 'bg-slate-800/50 border-b border-slate-700'
              : winner
              ? 'bg-gradient-to-b from-amber-500/25 via-emerald-500/10 to-transparent border-b border-amber-500/30'
              : 'bg-slate-800/40 border-b border-slate-800'
          }`}
        >
          {!verified ? (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center mb-2">
                <HelpCircle className="w-7 h-7" />
              </div>
              <h2 className="text-base font-bold text-amber-200">{t.unverifiedTitle}</h2>
              <p className="text-xs text-slate-300 mt-1">{t.unverifiedPick}</p>
            </div>
          ) : winner ? (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-2">
                <Trophy className="w-8 h-8 fill-current" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight">{t.congrats}</h2>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{evaluation?.prizeLabel || 'Winning Ticket'}</span>
              </div>
              {evaluation?.prizeAmountFormatted && (
                <div className="mt-2 text-2xl sm:text-3xl font-black text-white">
                  {evaluation.prizeAmountFormatted}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-200">{t.noWin}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {evaluation?.matchedCount ?? 0} {t.matched.toLowerCase()}
              </p>
            </div>
          )}

          {/* Draw meta */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-300">
            <span className="font-bold text-white text-sm">{lotteryName}</span>
            {(drawNo || official?.drawNo) && (
              <span className="inline-flex items-center gap-1">
                <Hash className="w-3 h-3 text-slate-500" />
                {t.draw}: <strong className="text-amber-400 font-mono">{drawNo || official?.drawNo}</strong>
              </span>
            )}
            {official?.date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                {official.date}
              </span>
            )}
            {verified && matchReason && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {t.reason}: {matchReason}
              </span>
            )}
            {scanMethod && (
              <span className="text-[10px] uppercase font-bold text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
                {scanMethod}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Prize box */}
          {verified && winner && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border border-emerald-500/40 text-center">
              <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">{t.prize}</span>
              <div className="text-2xl font-black text-white tracking-tight">{evaluation?.prizeAmountFormatted}</div>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">
                {t.tier}: {evaluation?.tier || 'Prize'}
              </p>
            </div>
          )}

          {/* Scanned vs Official */}
          <div className="space-y-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            {/* Scanned */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-amber-400" />
                  {scanMethod === 'ai' ? t.aiRead : t.yourTicket}
                </span>
                <span className="text-[10px] text-slate-500">
                  {printedDrawNo ? `${t.printed}: #${printedDrawNo}` : ''}
                  {printedDate ? ` • ${printedDate}` : ''}
                </span>
              </div>

              {scannedTicket.numbers.length === 0 && !scannedTicket.letter && !scannedTicket.zodiac ? (
                <p className="text-xs text-amber-300">{t.noNumbers}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {scannedTicket.letter && renderTile(scannedTicket.letter, 'scan-letter', { isMatch: evaluation?.letterMatch, tone: 'letter', title: 'Letter' })}
                  {scannedTicket.zodiac && renderTile(scannedTicket.zodiac, 'scan-zodiac', { isMatch: evaluation?.zodiacMatch, tone: 'zodiac', title: 'Zodiac' })}
                  {scannedTicket.superNumber &&
                    renderTile(`★${scannedTicket.superNumber}`, 'scan-super', {
                      isMatch: evaluation?.superNumberMatch,
                      tone: 'super',
                      title: 'Super number'
                    })}
                  {scannedTicket.numbers.map((num, i) => renderTile(num, `scan-num-${i}`, { isMatch: matched.includes(num), title: num }))}
                </div>
              )}
            </div>

            {/* Official */}
            {official && (
              <div className="pt-2.5 border-t border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                    {t.officialNumbers}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">Official</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {official.letter && renderTile(official.letter, 'off-letter', { tone: 'letter', title: 'Official letter' })}
                  {official.zodiac && renderTile(official.zodiac, 'off-zodiac', { tone: 'zodiac', title: 'Official zodiac' })}
                  {official.superNumber && renderTile(`★${official.superNumber}`, 'off-super', { tone: 'super', title: 'Official super number' })}
                  {official.numbers.map((num, i) => renderTile(num, `off-num-${i}`, { title: num }))}
                </div>
              </div>
            )}

            {/* Matched summary */}
            <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{t.matchedNumbers}</span>
              <div className="flex items-center gap-1.5">
                {matched.length > 0 ? (
                  matched.map((n, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold font-mono">
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">{t.none}</span>
                )}
                {evaluation?.letterMatch && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    Letter
                  </span>
                )}
                {evaluation?.zodiacMatch && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                    Zodiac
                  </span>
                )}
                {evaluation?.superNumberMatch && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    Super
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="text-[11px] font-bold text-amber-200 mb-1">{t.warnings}</div>
              <ul className="space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-amber-100/90 leading-relaxed flex gap-1.5">
                    <span className="text-amber-400">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Manual draw selection when we refused to guess */}
          {!verified && candidateDraws.length > 0 && onManualDrawSelect && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] font-bold text-slate-300 mb-2">{t.unverifiedPick}</div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {candidateDraws.map((d) => (
                  <button
                    key={`${d.drawNo}-${d.date}`}
                    onClick={() => onManualDrawSelect(d)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">
                        #{d.drawNo} <span className="text-slate-400 font-normal">• {d.date}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {d.letter && (
                          <span className="w-6 h-6 rounded bg-slate-800 text-amber-300 font-bold flex items-center justify-center text-[11px]">
                            {d.letter}
                          </span>
                        )}
                        {d.zodiac && (
                          <span className="px-1.5 h-6 rounded bg-purple-900/60 text-purple-300 font-bold flex items-center justify-center text-[10px]">
                            {d.zodiac}
                          </span>
                        )}
                        {d.superNumber && (
                          <span className="w-6 h-6 rounded bg-amber-900/50 text-amber-300 font-bold flex items-center justify-center text-[10px]">
                            ★{d.superNumber}
                          </span>
                        )}
                        {d.numbers.map((n, i) => (
                          <span key={i} className="w-6 h-6 rounded bg-slate-800 text-slate-200 font-mono font-bold flex items-center justify-center text-[11px]">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Raw payload inspector */}
          {rawPayload && (
            <details className="rounded-xl bg-slate-950 border border-slate-800">
              <summary className="px-3 py-2 text-[11px] font-semibold text-slate-400 cursor-pointer">
                {t.raw}
              </summary>
              <pre className="px-3 pb-3 whitespace-pre-wrap break-all text-[10px] text-emerald-300 font-mono">
                {rawPayload}
              </pre>
            </details>
          )}

          {/* Countdown */}
          {autoResumeEnabled ? (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <svg className="w-8 h-8 transform -rotate-90">
                    <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="3" className="text-slate-800" fill="transparent" />
                    <circle
                      cx="16"
                      cy="16"
                      r="13"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-amber-400"
                      fill="transparent"
                      strokeDasharray={81.6}
                      strokeDashoffset={81.6 - (countdown / AUTO_RESUME_SECONDS) * 81.6}
                    />
                  </svg>
                  <span className="absolute font-bold text-xs text-white">{countdown}</span>
                </div>
                <span className="text-xs text-slate-300 font-medium">
                  {t.autoResumeIn} {countdown}
                  {t.seconds}
                </span>
              </div>

              <button
                onClick={() => setTimerPaused((v) => !v)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                {timerPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
                    <span>{t.resumeTimer}</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.pauseTimer}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/30 text-[11px] text-amber-100">
              {status === 'not-found' ? t.notFound : t.unverifiedPick}
            </div>
          )}

          {/* Sound status hint */}
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              {t.audioHint}
            </span>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-0.5">
            <button
              id="btn-scan-next"
              onClick={handleManualNext}
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <span>{t.scanNextNow}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <span>{t.close}</span>
            </button>
          </div>

          {!verified && (
            <p className="text-[10px] text-slate-500 text-center">
              {lotterySlug} • {scanMethod}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
