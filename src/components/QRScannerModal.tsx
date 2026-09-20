import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Image, RefreshCw, Zap, Sparkles, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import jsQR from 'jsqr';
import { parseLotteryQR, DecodedQRResult } from '../data/qrParser';
import { scanTicketWithGemini } from '../services/geminiService';
import { TicketCheckInput } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (result: DecodedQRResult, rawTicket: TicketCheckInput) => void;
  lang: 'si' | 'en';
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
  lang
}) => {
  const isSinhala = lang === 'si';
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);

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
      setIsScanning(false);
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

    setIsScanning(false);
  };

  const triggerSuccessBeep = () => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([80, 40, 80]);
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio autoplay restrictions
    }
  };

  const handleDecodedText = (codeData: string) => {
    const decoded = parseLotteryQR(codeData);
    if (decoded) {
      triggerSuccessBeep();
      stopCamera();
      onScanComplete(decoded, decoded.parsed);
      onClose();
    }
  };

  const startFrameProcessing = () => {
    const tick = () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
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

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan full frame with jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          handleDecodedText(code.data);
          return; // Stop scanning once found
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  // Image Upload handler (detect QR code or damaged ticket with Gemini)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiProcessing(true);
    setAiError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;

      // 1. Try to decode QR from uploaded image first using canvas & jsQR
      const img = new window.Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(imgData.data, imgData.width, imgData.height);
          if (qr && qr.data) {
            handleDecodedText(qr.data);
            setIsAiProcessing(false);
            return;
          }
        }

        // 2. If no clear QR found, pass to Gemini AI Vision (handles damaged, scratched, or blurred tickets!)
        const base64Clean = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const aiScan = await scanTicketWithGemini(base64Clean, file.type || 'image/jpeg');

        if (aiScan.success && aiScan.numbers && aiScan.numbers.length > 0) {
          triggerSuccessBeep();
          const parsedTicket: TicketCheckInput = {
            slug: aiScan.lotterySlug || 'mahajana-sampatha',
            drawNo: aiScan.drawNo || '6314',
            date: aiScan.date || new Date().toISOString().slice(0, 10),
            letter: aiScan.letter,
            zodiac: aiScan.zodiac,
            superNumber: aiScan.superNumber,
            numbers: aiScan.numbers
          };

          const syntheticQR: DecodedQRResult = {
            raw: 'AI_VISION_OCR_READING',
            parsed: parsedTicket,
            lotteryName: aiScan.lotterySlug ? aiScan.lotterySlug.replace(/-/g, ' ').toUpperCase() : 'Lottery Ticket',
            lotteryNameSi: 'ස්කෑන් කළ ලොතරැයිය',
            isDrawPending: false,
            notes: 'Gemini AI Vision මඟින් හානි වූ / අපැහැදිලි ටිකට්පත කියවන ලදී.'
          };

          stopCamera();
          onScanComplete(syntheticQR, parsedTicket);
          onClose();
        } else {
          setAiError(
            isSinhala 
              ? 'QR කේතය හෝ ටිකට්පත් අංක හඳුනාගැනීමට නොහැකි විය. කරුණාකර පැහැදිලි ඡායාරූපයක් ලබා දෙන්න.' 
              : 'Could not detect valid QR or numbers. Please provide a clearer photo.'
          );
        }
        setIsAiProcessing(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {isSinhala ? 'ලොතරැයි QR & AI Scanner' : 'Micro-QR & AI Scanner'}
              </h2>
              <p className="text-xs text-slate-400">
                {isSinhala ? 'ලොතරැයි පත්‍රිකාවේ QR කේතය හෝ ටිකට්පත ස්කෑන් කරන්න' : 'Scan ticket Micro-QR or damaged ticket photo'}
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

        {/* Scanner Viewport */}
        <div className="relative flex-1 bg-black min-h-[320px] sm:min-h-[380px] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Overlay Box */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 border-dashed border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                {/* Animated Laser Scanning Line */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-[bounce_2.5s_infinite]" />

                <div className="absolute bottom-3 text-center px-2 py-1 bg-slate-950/80 rounded-md text-[11px] font-semibold text-amber-200">
                  {isSinhala ? 'QR කේතය හෝ ටිකට් අංක මෙතනට ලං කරන්න' : 'Align Micro-QR or ticket here'}
                </div>
              </div>
            </div>
          )}

          {/* Fallback Camera Error / Disabled */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200 mb-4 max-w-xs">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                {isSinhala ? 'නැවත උත්සාහ කරන්න' : 'Retry Camera'}
              </button>
            </div>
          )}

          {/* AI Processing Overlay */}
          {isAiProcessing && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-4 animate-pulse">
                <Sparkles className="w-7 h-7 animate-spin" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                {isSinhala ? 'AI එකෙන් ටිකට්පත කියවමින් පවතී...' : 'Reading Damaged Ticket via AI...'}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs">
                {isSinhala 
                  ? 'හානි වූ හෝ බොඳ වූ ටිකට්පත් අංක Gemini Vision මඟින් විශ්ලේෂණය කරයි.' 
                  : 'Analyzing numbers, letters & draw code using Gemini Vision.'}
              </p>
            </div>
          )}
        </div>

        {/* Error message banner */}
        {aiError && (
          <div className="p-3 bg-red-950/80 border-t border-red-800/80 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* Action Controls Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 text-center sm:text-left">
            <span className="font-semibold text-slate-300">💡 Tip:</span>{' '}
            {isSinhala 
              ? 'ටිකට්පත ආලෝකමත් තැනක තබා QR කේතය කැමරාවට ලං කරන්න.' 
              : 'Hold steady under good light; camera autofocuses automatically.'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* File Upload Button */}
            <label className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer transition active:scale-95">
              <Image className="w-4 h-4 text-amber-400" />
              <span>{isSinhala ? 'Photo එකක් තෝරන්න' : 'Upload Ticket Photo'}</span>
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
