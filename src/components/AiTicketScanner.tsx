import React, { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  Upload,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
  Zap,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Language } from '../types/lottery';
import { ParsedTicketQR, parsedFromAi } from '../utils/qrParser';

interface AiTicketScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketParsed: (parsed: ParsedTicketQR, rawPayload: string) => void;
  language: Language;
  /** Still-frame capture from the already running scanner camera. */
  captureFromCamera: (() => Promise<string | null>) | null;
}

interface HealthInfo {
  configuredKeys?: number;
  activeModel?: string | null;
  hasKeys?: boolean;
  lastError?: string | null;
}

export const AiTicketScanner: React.FC<AiTicketScannerProps> = ({
  isOpen,
  onClose,
  onTicketParsed,
  language,
  captureFromCamera
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [attemptLog, setAttemptLog] = useState<string[]>([]);

  const t = {
    en: {
      title: 'AI Ticket Reader',
      tag: 'AI vision fallback',
      description:
        'Use this when the QR code will not scan: the AI reads the printed ticket numbers, then the app matches them against the official draw exactly as the QR scanner does.',
      liveCapture: 'Capture from live camera',
      liveCaptureHint: 'Uses the camera that is already running — no need to go back.',
      takePhoto: 'Take a photo',
      chooseGallery: 'Choose from gallery',
      analyzing: 'AI is reading the ticket…',
      analyzingSub: 'Rotating API keys and verifying the ticket against NLB / DLB records.',
      cannotReadTitle: 'Cannot read this ticket',
      cannotReadMsg:
        'The image was too blurry or the numbers were unclear. Try again with better lighting, or enter the numbers manually.',
      cancel: 'Close',
      retry: 'Try another photo',
      keysReady: 'API keys ready',
      keysMissing: 'No API key configured',
      model: 'Model',
      noCameraCapture: 'Live camera is not running. Tap the scanner tab and start the camera first, or take a photo.',
      keyRotation: 'Key rotation',
      attempt: 'Attempt'
    },
    si: {
      title: 'AI ටිකට් කියවන යන්ත්‍රය',
      tag: 'AI දෘශ්‍ය විකල්පය',
      description:
        'QR කේතය ස්කෑන් නොවන විට මෙය භාවිත කරන්න: AI මගින් ටිකට් පතේ මුද්‍රිත අංක කියවා, QR ස්කෑනරය මෙන්ම නිල ප්‍රතිඵලය සමඟ සසඳා ප්‍රතිඵලය පෙන්වයි.',
      liveCapture: 'සක්‍රීය කැමරාවෙන් ඡායාරූපයක් ගන්න',
      liveCaptureHint: 'දැනටමත් ක්‍රියාත්මක කැමරාව භාවිත කරයි — නැවත යාමට අවශ්‍ය නැත.',
      takePhoto: 'ඡායාරූපයක් ගන්න',
      chooseGallery: 'ගැලරියෙන් තෝරන්න',
      analyzing: 'AI මගින් ටිකට් පත කියවමින්…',
      analyzingSub: 'API යතුරු මාරු කරමින් NLB / DLB වාර්තා සමඟ සසඳමින්.',
      cannotReadTitle: 'මෙම ටිකට් පත කියවිය නොහැක',
      cannotReadMsg: 'ඡායාරූපය අපැහැදිලිය. හොඳ ආලෝකයක් සමඟ නැවත උත්සාහ කරන්න, නැතහොත් අංක අතින් ඇතුළත් කරන්න.',
      cancel: 'වසන්න',
      retry: 'වෙනත් ඡායාරූපයක්',
      keysReady: 'API යතුරු සූදානම්',
      keysMissing: 'API යතුරක් සකසා නැත',
      model: 'ආකෘතිය',
      noCameraCapture: 'සජීවී කැමරාව ක්‍රියාත්මක නැත. පළමුව ස්කෑනරය තුළින් කැමරාව සක්‍රීය කරන්න.',
      keyRotation: 'යතුරු මාරුව',
      attempt: 'උත්සාහය'
    },
    ta: {
      title: 'AI டிக்கெட் வாசிப்பான்',
      tag: 'AI பார்வை மாற்று',
      description:
        'QR ஸ்கேன் ஆகாதபோது இதைப் பயன்படுத்தவும்: AI அச்சிடப்பட்ட எண்களைப் படித்து, QR ஸ்கேனர் போலவே அதிகாரப்பூர்வ முடிவுடன் ஒப்பிடும்.',
      liveCapture: 'நேரடி கேமராவில் இருந்து படம்',
      liveCaptureHint: 'ஏற்கனவே இயங்கும் கேமராவைப் பயன்படுத்தும்.',
      takePhoto: 'புகைப்படம் எடுக்கவும்',
      chooseGallery: 'கேலரியில் தேர்வு',
      analyzing: 'AI டிக்கெட்டைப் படிக்கிறது…',
      analyzingSub: 'API விசைகளை சுழற்றி NLB / DLB பதிவுகளுடன் சரிபார்க்கிறது.',
      cannotReadTitle: 'இந்த டிக்கெட்டைப் படிக்க முடியவில்லை',
      cannotReadMsg: 'படம் தெளிவற்றது. நல்ல வெளிச்சத்தில் மீண்டும் முயற்சிக்கவும்.',
      cancel: 'மூடு',
      retry: 'மற்றொரு படம்',
      keysReady: 'API விசைகள் தயார்',
      keysMissing: 'API விசை இல்லை',
      model: 'மாடல்',
      noCameraCapture: 'நேரடி கேமரா இயங்கவில்லை. முதலில் ஸ்கேனரில் கேமராவைத் தொடங்கவும்.',
      keyRotation: 'விசை சுழற்சி',
      attempt: 'முயற்சி'
    }
  }[language];

  useEffect(() => {
    if (!isOpen) {
      setPreview(null);
      setError(null);
      setIsAnalyzing(false);
      setAttemptLog([]);
      return;
    }
    let cancelled = false;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setHealth(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const analyse = useCallback(
    async (dataUrl: string, mimeType: string) => {
      setIsAnalyzing(true);
      setError(null);
      setAttemptLog([]);

      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl, mimeType })
        });

        const data = await response.json().catch(() => null);

        if (data?.attemptLog && Array.isArray(data.attemptLog)) {
          setAttemptLog(data.attemptLog.map((line: any) => String(line)));
        }

        if (!response.ok || !data || data.cannotRead || !data.scanResult) {
          setError(data?.message || t.cannotReadMsg);
          setIsAnalyzing(false);
          return;
        }

        const res = data.scanResult;
        const parsed = parsedFromAi({
          lotterySlug: res.lotterySlug,
          lotteryName: res.lotteryName,
          drawNo: res.drawNo,
          date: res.date,
          letter: res.letter,
          zodiac: res.zodiac,
          superNumber: res.superNumber,
          numbers: res.numbers || [],
          confidence: res.confidence,
          rawText: res.rawText
        });

        setIsAnalyzing(false);
        onClose();
        onTicketParsed(parsed, `AI_SCAN:${JSON.stringify(res)}`);
      } catch (err: any) {
        setError(err?.message || t.cannotReadMsg);
        setIsAnalyzing(false);
      }
    },
    [onClose, onTicketParsed, t.cannotReadMsg]
  );

  const handleLiveCapture = useCallback(async () => {
    if (!captureFromCamera) {
      setError(t.noCameraCapture);
      return;
    }
    const dataUrl = await captureFromCamera();
    if (!dataUrl) {
      setError(t.noCameraCapture);
      return;
    }
    setPreview(dataUrl);
    void analyse(dataUrl, 'image/jpeg');
  }, [analyse, captureFromCamera, t.noCameraCapture]);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPreview(dataUrl);
      void analyse(dataUrl, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 my-auto animate-pop-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 transition-colors"
          aria-label={t.cancel}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">{t.title}</h3>
            <span className="text-[10px] font-semibold text-emerald-400 tracking-wide uppercase">{t.tag}</span>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">{t.description}</p>

        {/* Key pool status */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px]">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${
              health && (health.configuredKeys ?? 0) > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {health && (health.configuredKeys ?? 0) > 0 ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {health && (health.configuredKeys ?? 0) > 0
              ? `${t.keysReady} (${health.configuredKeys})`
              : t.keysMissing}
          </span>
          {health?.activeModel && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              <Zap className="w-3 h-3 text-amber-400" />
              {t.model}: <strong className="text-white">{health.activeModel}</strong>
            </span>
          )}
        </div>

        {/* Preview */}
        <div className="w-full aspect-[16/10] bg-slate-950 rounded-xl border border-dashed border-slate-700 flex items-center justify-center overflow-hidden relative mb-4">
          {preview ? (
            <img src={preview} alt="Ticket preview" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center p-4 text-center">
              <Camera className="w-10 h-10 text-slate-500 mb-2" />
              <p className="text-xs text-slate-400 font-medium">
                {captureFromCamera ? t.liveCaptureHint : t.noCameraCapture}
              </p>
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-950/92 flex flex-col items-center justify-center p-4 text-center">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
              <p className="text-sm font-semibold text-white">{t.analyzing}</p>
              <p className="text-[11px] text-slate-400 mt-1">{t.analyzingSub}</p>
              {attemptLog.length > 0 && (
                <div className="mt-3 w-full max-h-24 overflow-y-auto text-left">
                  {attemptLog.slice(-4).map((line, i) => (
                    <div key={i} className="text-[10px] text-slate-400 font-mono">
                      {t.attempt} {i + 1}: {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3.5 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-rose-300">{t.cannotReadTitle}</div>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Hidden inputs */}
        <input
          id="ai-camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <input id="ai-gallery-input" type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            id="btn-ai-live-capture"
            disabled={isAnalyzing}
            onClick={() => void handleLiveCapture()}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            <span>{t.liveCapture}</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              id="btn-take-photo"
              disabled={isAnalyzing}
              onClick={() => document.getElementById('ai-camera-input')?.click()}
              className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-600 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              <span>{error ? t.retry : t.takePhoto}</span>
            </button>

            <button
              id="btn-upload-gallery"
              disabled={isAnalyzing}
              onClick={() => document.getElementById('ai-gallery-input')?.click()}
              className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-600 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Upload className="w-4 h-4 text-slate-300" />
              <span>{t.chooseGallery}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};
