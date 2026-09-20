import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Image, RefreshCw, Zap, Sparkles, AlertTriangle, 
  CheckCircle2, Volume2, ArrowRight, Play, Pause
} from 'lucide-react';
import jsQR from 'jsqr';
import { parseLotteryQR, DecodedQRResult } from '../data/qrParser';
import { scanTicketWithGemini } from '../services/geminiService';
import { evaluateLotteryPrize } from '../data/prizes';
import { getLotteryBySlug } from '../data/lotteries';
import { speakLotteryResult } from '../services/audioService';
import { TicketCheckInput, PrizeEvaluationResult } from '../types';

interface ContinuousScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'qr' | 'ai';
  onScanResultFound?: (result: PrizeEvaluationResult, ticket: TicketCheckInput) => void;
  lang: 'si' | 'en';
}

export const ContinuousScannerModal: React.FC<ContinuousScannerModalProps> = ({
  isOpen,
  onClose,
  mode,
  onScanResultFound,
  lang
}) => {
  const isSinhala = lang === 'si';

  // Scanner states
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isPausedBetweenScans, setIsPausedBetweenScans] = useState<boolean>(false);
  const [countdownSec, setCountdownSec] = useState<number>(5);

  // Active result card displayed inside scanner during 5s pause
  const [currentResult, setCurrentResult] = useState<{
    result: PrizeEvaluationResult;
    ticket: TicketCheckInput;
    lotteryName: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<any>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      resetScanDisplay();
    }
    return () => {
      stopCamera();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isOpen, mode]);

  const resetScanDisplay = () => {
    setCurrentResult(null);
    setIsPausedBetweenScans(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  };

  const startCamera = async () => {
    setCameraError(null);
    setAiError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        startFrameProcessing();
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setHasCamera(false);
      setCameraError(
        isSinhala 
          ? 'කැමරාව ආරම්භ කිරීමට නොහැකි විය. කරුණාකර Camera Permission ලබාදෙන්න හෝ ඡායාරූපයක් උඩුගත කරන්න.' 
          : 'Could not access camera. Please allow camera permissions or upload an image.'
      );
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Sound beep
  const triggerSuccessBeep = () => {
    try {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  // Evaluate and display result for 5 seconds, then resume
  const processFoundTicket = (ticket: TicketCheckInput) => {
    triggerSuccessBeep();
    const lot = getLotteryBySlug(ticket.slug);
    const draw = lot?.draws.find(d => 
      (ticket.drawNo && d.drawNo === ticket.drawNo) || 
      (ticket.date && d.date === ticket.date)
    ) || lot?.draws[0];

    const evaluation = (draw && lot) 
      ? evaluateLotteryPrize(lot.slug, draw, ticket)
      : {
          won: false,
          tier: null,
          prizeLabel: 'ටිකට්පත් අංක කියවන ලදී',
          prizeAmountRs: 0,
          prizeAmountFormatted: 'Rs. 0.00'
        };

    const lotteryName = isSinhala ? (lot?.nameSi || lot?.name || 'ලොතරැයිය') : (lot?.name || 'Lottery');

    // 1. Voice audio with Rupees pronunciation
    speakLotteryResult(evaluation.won, evaluation.prizeLabel, evaluation.prizeAmountRs, isSinhala);

    // 2. Set current display
    setCurrentResult({
      result: evaluation,
      ticket,
      lotteryName
    });

    if (onScanResultFound) {
      onScanResultFound(evaluation, ticket);
    }

    // 3. Pause scanning for 5 seconds with countdown, then resume automatically!
    setIsPausedBetweenScans(true);
    setCountdownSec(5);

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    let remaining = 5;

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdownSec(remaining);

      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        setCurrentResult(null);
        setIsPausedBetweenScans(false);
        lastScannedTimeRef.current = Date.now();
      }
    }, 1000);
  };

  // Continuous frame scanner
  const startFrameProcessing = () => {
    const tick = () => {
      if (
        !videoRef.current || 
        !canvasRef.current || 
        videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA
      ) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      // If paused showing the 5-sec result, do not scan next ticket yet
      if (isPausedBetweenScans || isAiProcessing) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // In QR mode, auto-decode QR in real-time
        if (mode === 'qr') {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (code && code.data) {
            const now = Date.now();
            // Prevent immediate duplicate re-trigger of same code within 6s
            if (code.data !== lastScannedCodeRef.current || now - lastScannedTimeRef.current > 6000) {
              lastScannedCodeRef.current = code.data;
              lastScannedTimeRef.current = now;

              const decoded = parseLotteryQR(code.data);
              if (decoded) {
                processFoundTicket(decoded.parsed);
              }
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  // Instant snapshot trigger for AI Damage Scan
  const captureAndScanWithAi = async () => {
    if (!videoRef.current || !canvasRef.current || isAiProcessing) return;

    setIsAiProcessing(true);
    setAiError(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsAiProcessing(false);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

    const aiScan = await scanTicketWithGemini(base64, 'image/jpeg');

    if (aiScan.success && aiScan.numbers && aiScan.numbers.length > 0) {
      const parsedTicket: TicketCheckInput = {
        slug: aiScan.lotterySlug || 'mahajana-sampatha',
        drawNo: aiScan.drawNo || '6314',
        date: aiScan.date || new Date().toISOString().slice(0, 10),
        letter: aiScan.letter,
        zodiac: aiScan.zodiac,
        superNumber: aiScan.superNumber,
        numbers: aiScan.numbers
      };
      processFoundTicket(parsedTicket);
    } else {
      setAiError(
        isSinhala 
          ? 'ටිකට්පත් අංක පැහැදිලිව කියවීමට නොහැකි විය. කරුණාකර ටිකට්පත ආලෝකමත් ස්ථානයක තබා කැමරාවට ලං කර නැවත "Scan Now" ඔබන්න.' 
          : 'Could not read ticket numbers. Please steady the ticket under good light and try again.'
      );
    }

    setIsAiProcessing(false);
  };

  // Upload image handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiProcessing(true);
    setAiError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = async () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, c.width, c.height);
          const qr = jsQR(imgData.data, imgData.width, imgData.height);
          if (qr && qr.data) {
            const decoded = parseLotteryQR(qr.data);
            if (decoded) {
              processFoundTicket(decoded.parsed);
              setIsAiProcessing(false);
              return;
            }
          }
        }

        // Pass to AI OCR
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const aiScan = await scanTicketWithGemini(base64, file.type || 'image/jpeg');
        if (aiScan.success && aiScan.numbers && aiScan.numbers.length > 0) {
          processFoundTicket({
            slug: aiScan.lotterySlug || 'mahajana-sampatha',
            drawNo: aiScan.drawNo || '6314',
            date: aiScan.date || new Date().toISOString().slice(0, 10),
            letter: aiScan.letter,
            zodiac: aiScan.zodiac,
            superNumber: aiScan.superNumber,
            numbers: aiScan.numbers
          });
        } else {
          setAiError(
            isSinhala 
              ? 'ඡායාරූපයෙන් අංක කියවීමට නොහැකි විය. කරුණාකර පැහැදිලි ඡායාරූපයක් එක් කරන්න.' 
              : 'Could not read ticket from image.'
          );
        }
        setIsAiProcessing(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleManualResume = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCurrentResult(null);
    setIsPausedBetweenScans(false);
    lastScannedTimeRef.current = Date.now();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-md ${
              mode === 'qr' ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'
            }`}>
              {mode === 'qr' ? <Camera className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>{mode === 'qr' ? (isSinhala ? 'නොනවතින Micro-QR Scanner' : 'Continuous QR Scanner') : (isSinhala ? 'AI හානි වූ ටිකට්පත් Scanner' : 'AI Damaged Ticket Scanner')}</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full animate-pulse">
                  ● LIVE
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'qr' 
                  ? (isSinhala ? 'එක දිගට ටිකට්පත් ස්කෑන් කරන්න (තත්පර 5න් ඊළඟ ටිකට්පත)' : 'Auto-advances every 5 seconds for continuous scanning')
                  : (isSinhala ? 'QR මැකී ගිය හෝ හානි වූ ටිකට්පත් AI මඟින් කියවීම' : 'AI camera reading for blurred or damaged tickets')}
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

        {/* Viewport Box */}
        <div className="relative flex-1 bg-black min-h-[320px] sm:min-h-[380px] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Real-time Target Box when Active */}
          {!isPausedBetweenScans && !isAiProcessing && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 border-dashed border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                {/* Corner accents */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                {/* Laser animation */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-[bounce_2s_infinite]" />

                <div className="absolute bottom-3 text-center px-2 py-1 bg-slate-950/85 rounded-md text-[11px] font-bold text-amber-200">
                  {mode === 'qr' 
                    ? (isSinhala ? 'QR කේතය මෙතනට ලං කරන්න' : 'Align Micro-QR here')
                    : (isSinhala ? 'ටිකට්පත් අංක මෙතනට ලං කරන්න' : 'Frame ticket numbers here')}
                </div>
              </div>
            </div>
          )}

          {/* 5-SECOND RESULT DISPLAY CARD OVERLAY */}
          {isPausedBetweenScans && currentResult && (
            <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200 z-20">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-3 shadow-xl">
                <CheckCircle2 className="w-9 h-9 animate-bounce" />
              </div>

              <span className="px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs uppercase rounded-full tracking-wider mb-2">
                {currentResult.result.won 
                  ? (isSinhala ? '🎉 ඔබ දිනුම්!' : '🎉 YOU WON!') 
                  : (isSinhala ? 'මෙම වාරයේ දිනුමක් නොමැත' : 'NO PRIZE THIS TIME')}
              </span>

              <h3 className="text-base sm:text-lg font-bold text-slate-200">
                {currentResult.lotteryName}
              </h3>

              <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                {currentResult.result.prizeAmountFormatted || 'Rs. 0.00'}
              </div>

              <p className="text-xs font-semibold text-amber-300 mt-0.5">
                {currentResult.result.prizeLabel}
              </p>

              {/* Countdown progress ring to next ticket */}
              <div className="mt-5 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 w-full max-w-xs flex items-center justify-between">
                <div className="text-left">
                  <div className="text-[11px] text-slate-400 font-semibold">
                    {isSinhala ? 'ඊළඟ ටිකට්පත ස්කෑන් කිරීම:' : 'Next ticket scan in:'}
                  </div>
                  <div className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>{countdownSec} {isSinhala ? 'තත්පරයකින් ස්වයංක්‍රීයව...' : 'seconds...'}</span>
                  </div>
                </div>

                <button
                  onClick={handleManualResume}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition active:scale-95"
                >
                  {isSinhala ? 'දැන්ම ස්කෑන් කරන්න' : 'Scan Now'}
                </button>
              </div>
            </div>
          )}

          {/* AI Busy Processing */}
          {isAiProcessing && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mb-3 animate-pulse">
                <Sparkles className="w-7 h-7 animate-spin" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                {isSinhala ? 'AI එකෙන් ටිකට්පත කියවමින් පවතී...' : 'Analyzing ticket via Gemini Vision...'}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs">
                {isSinhala ? 'හානි වූ හෝ බොඳ වූ අංක තත්පරයකින් තහවුරු කරයි' : 'Reading damaged numbers and verifying prize structure'}
              </p>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-sm text-slate-300 font-semibold mb-3 max-w-xs">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700"
              >
                {isSinhala ? 'නැවත අරඹන්න' : 'Retry'}
              </button>
            </div>
          )}
        </div>

        {/* AI Error Alert */}
        {aiError && (
          <div className="p-3 bg-red-950/80 border-t border-red-800/80 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* Controls Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 text-center sm:text-left flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isSinhala 
                ? 'හඬ සහය ක්‍රියාත්මකයි (Audio plays: Rupees amount)' 
                : 'Audio pronunciation: Rupees'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {mode === 'ai' && (
              <button
                onClick={captureAndScanWithAi}
                disabled={isAiProcessing}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-purple-600/20 active:scale-95 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSinhala ? 'දැන්ම AI Scan කරන්න' : 'Scan Ticket Now'}</span>
              </button>
            )}

            <label className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer transition active:scale-95">
              <Image className="w-4 h-4 text-amber-400" />
              <span>{isSinhala ? 'Photo එකක්' : 'Upload'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isAiProcessing}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
