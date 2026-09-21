import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Zap,
  ZapOff,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
  Play,
  Pause,
  Focus,
  ShieldAlert,
  Activity,
  ChevronDown,
  ChevronUp,
  ScanLine,
  Wifi
} from 'lucide-react';
import {
  vibratePhone,
  playQrDetectedBeep,
  primeAudio,
  isAudioPrimed
} from '../utils/audioFeedback';
import {
  buildConstraintAttempts,
  captureFrameDataUrl,
  checkSecureContext,
  describeCameraError,
  detectBrowser,
  focusAtPoint,
  getZoomRange,
  hasTorch,
  isStreamLive,
  openCamera,
  setTorch,
  setZoom,
  stopStream,
  tuneTrack,
  waitForVideoMetadata,
  ZoomRange
} from '../utils/cameraUtils';
import {
  decodeFast,
  decodeThorough,
  decodeWithNative,
  decodeWithJsQrOnly,
  initNativeDetector,
  warmUpDecoders,
  isZxingReady,
  imageDataFrom,
  decodeTicketFrame,
  isTicketPipelineReady,
  measureTicketQR,
  DecodeHit
} from '../utils/decoders';
import { Language } from '../types/lottery';

export type ScannerState = 'idle' | 'starting' | 'running' | 'error' | 'unsupported';

export interface ScannerDiagnostics {
  browser: string;
  state: ScannerState;
  engineNative: boolean;
  engineLast: string | null;
  decodeFps: number;
  secureContextOk: boolean;
  torch: boolean;
  zoom: boolean;
  vibration: boolean;
  error: string | null;
  lastRawPayload: string | null;
}

interface QRScannerProps {
  onScan: (rawData: string) => void;
  isPaused: boolean;
  onOpenAiScan: () => void;
  language: Language;
  /** Lets the parent grab a still frame from the live camera (used by AI scan). */
  onCaptureReady?: (capture: (() => Promise<string | null>) | null) => void;
  onDiagnostics?: (info: ScannerDiagnostics) => void;
}

const DECODE_INTERVAL_MS = 70;
const FULL_FRAME_MAX_WIDTH = 960;
const ROI_RATIO = 0.78;

export const QRScanner: React.FC<QRScannerProps> = ({
  onScan,
  isPaused,
  onOpenAiScan,
  language,
  onCaptureReady,
  onDiagnostics
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopStopRef = useRef<boolean>(false);
  const sessionRef = useRef<number>(0);

  const lastTickRef = useRef<number>(0);
  const tickCounterRef = useRef<number>(0);
  const lastAcceptedRef = useRef<{ text: string; at: number } | null>(null);
  const absentSinceRef = useRef<number>(0);
  const pausedRef = useRef<boolean>(isPaused);
  const resumeGraceUntilRef = useRef<number>(0);
  const fpsWindowRef = useRef<number[]>([]);
  const engineLastRef = useRef<string | null>(null);
  const zxingReadyRef = useRef<boolean>(false);
  const lastHitAtRef = useRef<number>(Date.now());
  const lastRefocusAtRef = useRef<number>(0);

  const [state, setState] = useState<ScannerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoomValue, setZoomValue] = useState<number>(1);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [lastRawPayload, setLastRawPayload] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [flash, setFlash] = useState<boolean>(false);
  const [audioPrimed, setAudioPrimed] = useState<boolean>(isAudioPrimed());
  const [hint, setHint] = useState<string | null>(null);
  const [decodeRate, setDecodeRate] = useState<number>(0);
  const [scanning, setScanning] = useState<boolean>(false);
  const [modulePx, setModulePx] = useState<number | null>(null);
  const [pipelineReady, setPipelineReady] = useState<boolean>(false);

  const browser = useMemo(() => detectBrowser(), []);
  const secure = useMemo(() => checkSecureContext(), []);
  const nativeSupportedRef = useRef<boolean>(false);

  const labels = {
    en: {
      title: 'Live QR Scanner',
      instruction: 'Point the camera at the ticket QR code',
      torch: 'Flash',
      switchCam: 'Switch camera',
      paused: 'Paused — showing result',
      aiBtn: 'AI Scan (read ticket with AI)',
      aiSub: 'Use this if the QR code is damaged, scratched or will not scan.',
      upload: 'Upload a QR photo',
      noCamera: 'Camera is not available',
      retry: 'Retry',
      startCamera: 'Start camera & start scanning',
      startHint: 'Tap once to allow the camera and enable the win/lose sounds.',
      running: 'Camera live — scanning',
      idle: 'Camera idle',
      error: 'Camera error',
      galleryFailed: 'No QR code was found in that image. Try a sharper photo or use AI Scan.',
      insecureTitle: 'Camera blocked on this connection',
      insecureMsg:
        'Browsers only allow the camera on https:// pages (or localhost). Open this app with https:// to enable QR scanning on Chrome, Edge, Firefox and Safari.',
      inspector: 'QR payload inspector',
      lastPayload: 'Last decoded payload',
      none: 'None yet',
      engine: 'Decode engine',
      browserLabel: 'Browser',
      vibration: 'Vibration',
      supported: 'supported',
      notSupported: 'not supported',
      focusBtn: 'Focus',
      moveCloser: 'move closer',
      moveBack: 'move back',
      holdStill: 'hold still',
      zoom: 'Zoom',
      brightness: 'Silent mode',
      barcodeNative: 'Native detector',
      quickTip: 'Hold the phone steady about 10–15 cm above the QR code.',
      keepAlive: 'The camera stays on between scans — no need to go back.'
    },
    si: {
      title: 'සජීවී QR ස්කෑනරය',
      instruction: 'ටිකට්පතේ QR කේතය කැමරාවට යොමු කරන්න',
      torch: 'ෆ්ලෑෂ්',
      switchCam: 'කැමරාව මාරු කරන්න',
      paused: 'නවතා ඇත — ප්‍රතිඵලය පෙන්වයි',
      aiBtn: 'AI ස්කෑනය (AI මගින් ටිකට්පත කියවන්න)',
      aiSub: 'QR කේතය හානිවී, සීරී ගොස් හෝ ස්කෑන් නොවන්නේ නම් මෙය භාවිත කරන්න.',
      upload: 'QR පින්තූරයක් උඩුගත කරන්න',
      noCamera: 'කැමරාව භාවිත කළ නොහැක',
      retry: 'නැවත උත්සාහ කරන්න',
      startCamera: 'කැමරාව සක්‍රීය කර ස්කෑන් කිරීම අරඹන්න',
      startHint: 'එක් වරක් ස්පර්ශ කරන්න — කැමරාව සහ ජයග්‍රහණ ශබ්දය සක්‍රීය වේ.',
      running: 'කැමරාව සක්‍රීයයි — ස්කෑන් වෙමින්',
      idle: 'කැමරාව නිශ්චලයි',
      error: 'කැමරා දෝෂයක්',
      galleryFailed: 'එම පින්තූරයේ QR කේතයක් හමු නොවිණි. පැහැදිලි ඡායාරූපයක් උත්සාහ කරන්න හෝ AI ස්කෑනය භාවිත කරන්න.',
      insecureTitle: 'මෙම සම්බන්ධතාවයේදී කැමරාව අවහිර කර ඇත',
      insecureMsg:
        'බ්‍රව්සර මගින් කැමරාව අවසර දෙන්නේ https:// පිටු සඳහා පමණි. Chrome, Edge, Firefox සහ Safari හි QR ස්කෑන් කිරීම සක්‍රීය කිරීමට මෙම යෙදුම https:// හරහා විවෘත කරන්න.',
      inspector: 'QR දත්ත පරීක්ෂකය',
      lastPayload: 'අවසන් වරට කියවූ දත්ත',
      none: 'තවම නැත',
      engine: 'කියවීමේ එන්ජිම',
      browserLabel: 'බ්‍රව්සරය',
      vibration: 'කම්පනය',
      supported: 'ක්‍රියාත්මකයි',
      notSupported: 'ක්‍රියාත්මක නැත',
      focusBtn: 'නාභිගත',
      moveCloser: 'තව ළඟට යන්න',
      moveBack: 'ටිකක් ඈතට',
      holdStill: 'නොසෙල්වී තියාගන්න',
      zoom: 'විශාලනය',
      brightness: 'නිශ්ශබ්ද ආකාරය',
      barcodeNative: 'දේශීය හඳුනාගැනීම',
      quickTip: 'දුරකථනය QR කේතයට සෙන්ටිමීටර 10–15 ක් ඉහළින් ස්ථිරව තබාගන්න.',
      keepAlive: 'ස්කෑන් අතරතුරද කැමරාව ක්‍රියාත්මකයි — නැවත එන අවශ්‍යතාවක් නැත.'
    },
    ta: {
      title: 'நேரடி QR ஸ்கேனர்',
      instruction: 'டிக்கெட்டின் QR குறியீட்டை கேமராவை நோக்கி வைக்கவும்',
      torch: 'ஃபிளாஷ்',
      switchCam: 'கேமராவை மாற்று',
      paused: 'இடைநிறுத்தப்பட்டது — முடிவு காட்டப்படுகிறது',
      aiBtn: 'AI ஸ்கேன் (AI மூலம் டிக்கெட் படிக்கவும்)',
      aiSub: 'QR குறியீடு சேதமடைந்தால் அல்லது ஸ்கேன் ஆகவில்லை என்றால் இதைப் பயன்படுத்தவும்.',
      upload: 'QR புகைப்படத்தை பதிவேற்றவும்',
      noCamera: 'கேமரா கிடைக்கவில்லை',
      retry: 'மீண்டும் முயற்சி',
      startCamera: 'கேமராவைத் தொடங்கி ஸ்கேன் செய்யவும்',
      startHint: 'ஒருமுறை தட்டவும் — கேமரா மற்றும் வெற்றி ஒலி இயக்கப்படும்.',
      running: 'கேமரா இயங்குகிறது — ஸ்கேன் செய்கிறது',
      idle: 'கேமரா நிலையாக உள்ளது',
      error: 'கேமரா பிழை',
      galleryFailed: 'அந்தப் படத்தில் QR குறியீடு இல்லை. தெளிவான படத்தை முயற்சிக்கவும்.',
      insecureTitle: 'இந்த இணைப்பில் கேமரா தடுக்கப்பட்டுள்ளது',
      insecureMsg:
        'கேமரா https:// பக்கங்களில் மட்டுமே அனுமதிக்கப்படும். QR ஸ்கேனிங்கிற்கு https:// மூலம் திறக்கவும்.',
      inspector: 'QR தரவு பரிசோதனை',
      lastPayload: 'கடைசியாக படித்த தரவு',
      none: 'இன்னும் இல்லை',
      engine: 'டிகோட் இன்ஜின்',
      browserLabel: 'உலாவி',
      vibration: 'அதிர்வு',
      supported: 'ஆதரவு',
      notSupported: 'ஆதரவு இல்லை',
      focusBtn: 'குவி',
      moveCloser: 'இன்னும் அருகில்',
      moveBack: 'சற்று தூரம்',
      holdStill: 'அசையாமல் பிடிக்கவும்',
      zoom: 'பெரிதாக்கு',
      brightness: 'அமைதி முறை',
      barcodeNative: 'இயல்பான கண்டறிதல்',
      quickTip: 'QR குறியீட்டிற்கு 10–15 செ.மீ மேலே நிலையாகப் பிடிக்கவும்.',
      keepAlive: 'ஸ்கேன்களுக்கு இடையிலும் கேமரா இயங்கும்.'
    }
  }[language];

  pausedRef.current = isPaused;

  /* ------------------------------------------------------------------ */
  /* Diagnostics to the parent                                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    onDiagnostics?.({
      browser: browser.name,
      state,
      engineNative: nativeSupportedRef.current,
      engineLast: engineLastRef.current,
      decodeFps: Math.round(decodeRate),
      secureContextOk: secure.ok,
      torch: torchSupported,
      zoom: Boolean(zoomRange),
      vibration: typeof navigator !== 'undefined' && 'vibrate' in navigator,
      error: errorMessage,
      lastRawPayload
    });
  }, [
    onDiagnostics,
    browser.name,
    state,
    decodeRate,
    secure.ok,
    torchSupported,
    zoomRange,
    errorMessage,
    lastRawPayload
  ]);

  /* ------------------------------------------------------------------ */
  /* Audio + vibration priming on first gesture                          */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (audioPrimed) return;
    const handler = () => {
      primeAudio();
      setAudioPrimed(true);
    };
    window.addEventListener('pointerdown', handler, { once: true, passive: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [audioPrimed]);

  /* ------------------------------------------------------------------ */
  /* Camera lifecycle                                                    */
  /* ------------------------------------------------------------------ */
  const stopTracks = useCallback(() => {
    sessionRef.current += 1;
    loopStopRef.current = true;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        /* ignore */
      }
    }
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopTracks();
      loopStopRef.current = false;
      const session = ++sessionRef.current;

      setState('starting');
      setErrorMessage(null);

      if (!secure.ok) {
        setState('unsupported');
        setErrorMessage(secure.reason || labels.insecureMsg);
        return;
      }

      try {
        const stream = await openCamera(buildConstraintAttempts(deviceId));
        if (sessionRef.current !== session) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          stopStream(stream);
          streamRef.current = null;
          return;
        }

        // Attach the stream FIRST. iOS Safari only treats the element as
        // user-gesture initiated when srcObject + play() happen right after
        // getUserMedia resolves, without other awaits in between.
        // iOS/Safari also need these attributes set before srcObject.
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('muted', 'true');
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.srcObject = stream;

        const playPromise = video.play().catch((playErr: any) => {
          if (playErr?.name !== 'AbortError') {
            console.warn('video.play() deferred:', playErr?.name);
          }
        });

        // Remember the device actually in use, then apply soft tuning.
        const track = stream.getVideoTracks()[0];
        if (track) {
          const settings: any = typeof track.getSettings === 'function' ? track.getSettings() : {};
          if (settings.deviceId) setSelectedDeviceId(settings.deviceId);
          await tuneTrack(track);
          setTorchSupported(hasTorch(track));
          setTorchOn(false);
          const range = getZoomRange(track);
          setZoomRange(range);
          if (range) {
            const caps: any = track.getCapabilities();
            setZoomValue(typeof caps.zoom === 'number' ? caps.zoom : range.min);
          }

          // Keep the UI honest if the OS kills the stream.
          track.addEventListener('ended', () => {
            if (sessionRef.current === session) {
              setState('error');
              setErrorMessage('The camera stream stopped. Tap Retry to restart it.');
            }
          });
        }

        // Enumerate devices only after permission so labels are populated.
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (sessionRef.current === session) {
            setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
          }
        } catch {
          /* ignore */
        }

        await initNativeDetector().then((ok) => {
          nativeSupportedRef.current = ok;
        });

        // ZXing is code-split; it loads in the background while jsQR already
        // handles decoding, so the first scan is never blocked.
        void warmUpDecoders();
        setPipelineReady(isTicketPipelineReady());

        await waitForVideoMetadata(video).catch(() => undefined);
        await playPromise;

        if (sessionRef.current !== session) return;

        setState('running');
      } catch (err) {
        if (sessionRef.current !== session) return;
        stopStream(streamRef.current);
        streamRef.current = null;
        setState('error');
        setErrorMessage(describeCameraError(err, browser));
      }
    },
    [browser, labels.insecureMsg, secure, stopTracks]
  );

  /* ------------------------------------------------------------------ */
  /* Decode loop                                                         */
  /* ------------------------------------------------------------------ */
  const acceptPayload = useCallback(
    (text: string) => {
      lastAcceptedRef.current = { text, at: Date.now() };
      absentSinceRef.current = 0;
      setLastRawPayload(text);
      vibratePhone([120, 60, 120]);
      playQrDetectedBeep();
      setFlash(true);
      window.setTimeout(() => setFlash(false), 220);
      resumeGraceUntilRef.current = Date.now() + 900;
      onScan(text);
    },
    [onScan]
  );

  const considerPayload = useCallback(
    (text: string) => {
      const now = Date.now();

      if (now < resumeGraceUntilRef.current) return;

      const last = lastAcceptedRef.current;
      if (last && last.text === text) {
        // Re-accept the same ticket only after it left the frame and came back.
        if (absentSinceRef.current === 0 || now - absentSinceRef.current < 500) return;
      }

      // A QR decode is checksum protected, so a successful decode is trusted
      // and delivered immediately — speed is what makes the scanner feel
      // "native". Everything that could not be read is refused later, during
      // draw resolution, instead of being guessed.
      acceptPayload(text);
    },
    [acceptPayload]
  );

  useEffect(() => {
    if (state !== 'running') return;

    let stopped = false;
    let rafId: number | null = null;
    let errors = 0;

    /**
     * requestAnimationFrame is used instead of requestVideoFrameCallback on
     * purpose: rVFC callbacks stop arriving when the video element is not being
     * composited (hidden tab, display:none) and the loop would then die
     * silently. rAF always fires while the page is visible.
     */
    const scheduleNext = () => {
      if (stopped || loopStopRef.current) return;
      rafId = window.requestAnimationFrame(() => {
        runTick();
        scheduleNext();
      });
    };

    /**
     * Draw the frame the browser's own scaler (fast + GPU accelerated).
     * `source` selects the central ROI or the whole frame.
     */
    const grabFrame = (mode: 'roi' | 'full' | 'native'): ImageData | null => {
      const video = videoRef.current;
      const canvas = workCanvasRef.current;
      if (!video || !canvas) return null;
      if (!video.videoWidth || !video.videoHeight) return null;
      if (video.readyState < 2) return null;

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      let sx = 0;
      let sy = 0;
      let sw = vw;
      let sh = vh;
      let maxWidth = FULL_FRAME_MAX_WIDTH;

      if (mode === 'roi') {
        sw = Math.round(vw * ROI_RATIO);
        sh = Math.round(vh * ROI_RATIO);
        sx = Math.round((vw - sw) / 2);
        sy = Math.round((vh - sh) / 2);
      } else if (mode === 'full') {
        maxWidth = 720;
      }

      const scale = sw > maxWidth ? maxWidth / sw : 1;
      const dw = Math.max(8, Math.round(sw * scale));
      const dh = Math.max(8, Math.round(sh * scale));

      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
      return ctx.getImageData(0, 0, dw, dh);
    };

    const runTick = () => {
      if (stopped || loopStopRef.current) return;

      try {
        if (pausedRef.current) {
          absentSinceRef.current = 0;
          return;
        }

        const now = performance.now();
        if (now - lastTickRef.current < DECODE_INTERVAL_MS) return;
        lastTickRef.current = now;
        tickCounterRef.current += 1;

        const video = videoRef.current;

        // Self-heal: some browsers pause the element after a permission prompt
        // or a tab switch; without this the preview looks alive but never scans.
        if (video && video.paused && !pausedRef.current) {
          void video.play().catch(() => undefined);
        }

        // Engine 1: native BarcodeDetector on the live video element.
        if (video && nativeSupportedRef.current) {
          void decodeWithNative(video)
            .then((hit) => {
              if (hit?.text) {
                engineLastRef.current = hit.engine;
                considerPayload(hit.text);
              }
            })
            .catch(() => undefined);
        }

        const step = tickCounterRef.current % 4;
        const mode: 'roi' | 'full' | 'native' =
          step === 1 ? 'roi' : step === 2 || step === 3 ? 'full' : 'native';
        const frame = grabFrame(mode);
        if (!frame) return;

        // Step 3: the full preprocessing lattice. This is what actually makes
        // the tiny ticket QR readable — it rescales the image so that one QR
        // module occupies ~3-10 px, which is the only range jsQR works in.
        if (step === 3 && isTicketPipelineReady()) {
          void decodeTicketFrame(video as any, { deep: false, budgetMs: 260, maxSide: 900 })
            .then((result) => {
              if (result?.text) {
                engineLastRef.current = 'pipeline';
                considerPayload(result.text);
                absentSinceRef.current = 0;
                lastHitAtRef.current = Date.now();
              }
            })
            .catch(() => undefined);
        }

        // Real measurement of how big the QR currently looks, so the user gets
        // "move closer / move back" advice instead of a silent failure.
        if (step % 2 === 0) {
          const measured = measureTicketQR(frame);
          setModulePx(measured ? Math.round(measured.modulePx * 10) / 10 : null);
          setPipelineReady(isTicketPipelineReady());
        }

        let hit: DecodeHit | null = null;
        zxingReadyRef.current = isZxingReady();
        if (zxingReadyRef.current) {
          hit = decodeFast(frame, mode !== 'native');
        } else {
          // jsQR alone until ZXing finishes downloading.
          hit = decodeWithJsQrOnly(frame, true);
        }

        if (hit?.text) {
          engineLastRef.current = `${hit.engine} (${mode})`;
          considerPayload(hit.text);
          absentSinceRef.current = 0;
          lastHitAtRef.current = Date.now();
        } else if (absentSinceRef.current === 0) {
          absentSinceRef.current = Date.now();
        }

        // Native-app style re-focus: if nothing has been found for a while,
        // ask the camera for a single-shot focus sweep.
        if (Date.now() - lastHitAtRef.current > 2500 && Date.now() - lastRefocusAtRef.current > 2500) {
          lastRefocusAtRef.current = Date.now();
          const track = streamRef.current?.getVideoTracks()[0];
          if (track) {
            try {
              void track
                .applyConstraints({ advanced: [{ focusMode: 'single-shot' } as any] })
                .then(() =>
                  track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => undefined)
                )
                .catch(() => undefined);
            } catch {
              /* not supported */
            }
          }
        }

        // Decode-rate sampling for the diagnostic pill.
        const rateWindow = fpsWindowRef.current;
        rateWindow.push(performance.now());
        while (rateWindow.length > 0 && performance.now() - rateWindow[0] > 2000) rateWindow.shift();
        if (rateWindow.length > 0 && tickCounterRef.current % 15 === 0) {
          setDecodeRate(rateWindow.length / 2);
        }
        setScanning(true);
      } catch (error) {
        // A single bad frame must NEVER kill the decode loop.
        errors += 1;
        if (errors <= 5) console.warn('QR decode tick error (recovered):', error);
      }
    };

    scheduleNext();

    // Watchdog: if the animation frame loop ever stalls (some browsers throttle
    // hidden/occluded pages aggressively), restart it instead of dying silently.
    const watchdog = window.setInterval(() => {
      if (stopped || loopStopRef.current) return;
      const stalled = performance.now() - lastTickRef.current > 3000;
      if (stalled) {
        if (rafId !== null) window.cancelAnimationFrame(rafId);
        scheduleNext();
      }
    }, 2000);

    return () => {
      stopped = true;
      window.clearInterval(watchdog);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [state, considerPayload]);

  /* ------------------------------------------------------------------ */
  /* Resume-safe behaviour                                              */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (isPaused) return;
    // When the result modal closes the camera is already warm; only make sure
    // the element is still playing and give a short anti-duplicate grace.
    resumeGraceUntilRef.current = Date.now() + 900;
    const video = videoRef.current;
    if (video && video.paused) {
      void video.play().catch(() => undefined);
    }
    if (streamRef.current && !isStreamLive(streamRef.current)) {
      // The OS killed the track while we were away — bring it back silently.
      void startCamera(selectedDeviceId || undefined);
    }
  }, [isPaused, selectedDeviceId, startCamera]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && state === 'running') {
        const video = videoRef.current;
        if (video && video.paused) void video.play().catch(() => undefined);
        if (streamRef.current && !isStreamLive(streamRef.current)) {
          void startCamera(selectedDeviceId || undefined);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [selectedDeviceId, startCamera, state]);

  /* ------------------------------------------------------------------ */
  /* Capture function exposed to the parent (AI scan)                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!onCaptureReady) return;
    if (state !== 'running') {
      onCaptureReady(null);
      return;
    }
    onCaptureReady(async () => {
      const video = videoRef.current;
      if (!video) return null;
      // Make sure the frame is fresh before grabbing it.
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const track = streamRef.current?.getVideoTracks()[0] || null;
      if (track && typeof track.getCapabilities === 'function') {
        try {
          const caps: any = track.getCapabilities();
          if (Array.isArray(caps.pointsOfInterest)) {
            await track.applyConstraints({
              advanced: [{ pointsOfInterest: [{ x: 0.5, y: 0.5 }], focusMode: 'single-shot' } as any]
            });
            await new Promise((resolve) => window.setTimeout(resolve, 350));
          }
        } catch {
          /* ignore */
        }
      }
      return captureFrameDataUrl(video, { maxWidth: 1600, quality: 0.92 });
    });
    return () => onCaptureReady(null);
  }, [onCaptureReady, state]);

  useEffect(() => () => stopTracks(), [stopTracks]);

  /* ------------------------------------------------------------------ */
  /* Controls                                                           */
  /* ------------------------------------------------------------------ */
  const handleStart = () => {
    primeAudio();
    setAudioPrimed(true);
    void startCamera(selectedDeviceId || undefined);
  };

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0] || null;
    if (!track) return;
    const next = !torchOn;
    const ok = await setTorch(track, next);
    if (ok) setTorchOn(next);
  };

  const handleSwitchCamera = () => {
    if (videoDevices.length < 2) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    setSelectedDeviceId(nextDevice.deviceId);
    void startCamera(nextDevice.deviceId);
  };

  const handleZoom = async (value: number) => {
    setZoomValue(value);
    const track = streamRef.current?.getVideoTracks()[0] || null;
    await setZoom(track, value);
  };

  const handleFocus = () => {
    const track = streamRef.current?.getVideoTracks()[0] || null;
    void focusAtPoint(track, 0.5, 0.5);
    setHint(labels.focusBtn + '…');
    window.setTimeout(() => setHint(null), 1200);
  };

  const handleGalleryUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const maxWidth = 2400;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const smaller = imageDataFrom(canvas, Math.round(canvas.width * 0.6), Math.round(canvas.height * 0.6));

        // The preprocessing lattice is the reliable path for stills: it walks
        // scale x binarisation x polarity instead of relying on one attempt.
        let hit: DecodeHit | null = await decodeTicketFrame(canvas, {
          deep: true,
          budgetMs: 2500,
          maxSide: 1400
        });
        if (!hit) hit = decodeFast(imageData, true);
        if (!hit && smaller) hit = decodeThorough(smaller);
        if (!hit) hit = decodeThorough(imageData);

        if (hit?.text) {
          engineLastRef.current = `${hit.engine} (gallery)`;
          acceptPayload(hit.text);
        } else {
          setHint(labels.galleryFailed);
          window.setTimeout(() => setHint(null), 4000);
        }
      };
      img.onerror = () => {
        setHint(labels.galleryFailed);
        window.setTimeout(() => setHint(null), 4000);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const statusPill = (() => {
    switch (state) {
      case 'running':
        return {
          text: labels.running,
          className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
        };
      case 'starting':
        return { text: '…', className: 'bg-amber-500/15 text-amber-300 border-amber-500/40' };
      case 'error':
      case 'unsupported':
        return { text: labels.error, className: 'bg-rose-500/15 text-rose-300 border-rose-500/40' };
      default:
        return { text: labels.idle, className: 'bg-slate-700/40 text-slate-300 border-slate-600' };
    }
  })();

  const canStart = state === 'idle' || state === 'error' || state === 'unsupported';

  return (
    <div className="w-full flex flex-col items-center">
      {/* Secure-context blocker (explains why Chrome/Edge/Safari refuse the camera) */}
      {!secure.ok && (
        <div className="w-full max-w-md mb-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-100">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-rose-200">{labels.insecureTitle}</div>
              <p className="mt-1 leading-relaxed text-rose-100/90">{labels.insecureMsg}</p>
              <p className="mt-1 text-[11px] text-rose-200/70 font-mono">
                {secure.protocol}//{secure.host}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Viewport */}
      <div className="relative w-full max-w-md aspect-[3/4] sm:aspect-square bg-black rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl">
        <canvas ref={workCanvasRef} className="hidden" />

        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            isPaused ? 'opacity-40 blur-[1px]' : 'opacity-100'
          }`}
          muted
          playsInline
          autoPlay
          onClick={handleFocus}
        />

        {/* Detection flash */}
        {flash && <div className="absolute inset-0 bg-emerald-400/40 pointer-events-none" />}

        {/* Viewfinder overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
          <div
            className={`relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-dashed rounded-2xl flex items-center justify-center transition-colors ${
              isPaused ? 'border-slate-500/70' : 'border-amber-400/80 shadow-[0_0_24px_rgba(245,158,11,0.25)]'
            }`}
          >
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

            {!isPaused && state === 'running' && (
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-scan-line" />
            )}

            <p className="text-[11px] font-medium text-amber-200 text-center px-4 drop-shadow">
              {isPaused ? labels.paused : labels.instruction}
            </p>
          </div>

          {state === 'running' && !isPaused && (
            <p className="mt-3 text-[10px] text-slate-300/90 bg-slate-950/60 px-2 py-1 rounded-full">
              {labels.quickTip}
            </p>
          )}
        </div>

        {/* Top status bar */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold backdrop-blur-md ${statusPill.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${state === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-current'}`} />
            <span>{statusPill.text}</span>
          </div>

          <div className="flex items-center space-x-2">
            {torchSupported && (
              <button
                id="torch-toggle-btn"
                onClick={handleToggleTorch}
                className={`p-2.5 rounded-full backdrop-blur-md border shadow-lg transition-transform active:scale-95 ${
                  torchOn
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-900/80 text-white border-slate-700'
                }`}
                title={labels.torch}
                aria-label={labels.torch}
              >
                {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
              </button>
            )}
            {videoDevices.length > 1 && (
              <button
                id="switch-camera-btn"
                onClick={handleSwitchCamera}
                className="p-2.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white border border-slate-700 shadow-lg active:scale-95"
                title={labels.switchCam}
                aria-label={labels.switchCam}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom controls (zoom + focus) */}
        {state === 'running' && (
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-slate-950/90 to-transparent flex items-center gap-3 z-10">
            {zoomRange ? (
              <div className="flex-1 flex items-center gap-2">
                <span className="text-[10px] text-slate-300 font-semibold">{labels.zoom}</span>
                <input
                  type="range"
                  min={zoomRange.min}
                  max={zoomRange.max}
                  step={zoomRange.step}
                  value={zoomValue}
                  onChange={(e) => void handleZoom(Number(e.target.value))}
                  className="flex-1 accent-amber-400"
                  aria-label={labels.zoom}
                />
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <button
              onClick={handleFocus}
              className="px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 active:scale-95"
            >
              <Focus className="w-3.5 h-3.5 text-amber-400" />
              {labels.focusBtn}
            </button>
          </div>
        )}

        {/* Hint toast */}
        {hint && (
          <div className="absolute bottom-14 left-3 right-3 z-20 p-2.5 rounded-xl bg-slate-900/95 border border-amber-500/40 text-[11px] text-amber-100">
            {hint}
          </div>
        )}

        {/*
          Live QR size meter. The ticket QR fails to decode when one module is
          smaller than ~2.5 px OR much larger than ~11 px, so the user is told
          in real measurements which way to move the phone.
        */}
        {state === 'running' && !isPaused && modulePx !== null && (
          <div
            className={`absolute top-2 left-3 right-3 z-20 px-3 py-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
              modulePx >= 2.5 && modulePx <= 11
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-100'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-100'
            }`}
          >
            <span className="font-semibold">
              QR: {modulePx} px/module
            </span>
            <span className="opacity-90">
              {modulePx < 2.5
                ? labels.moveCloser
                : modulePx > 11
                ? labels.moveBack
                : labels.holdStill}
            </span>
          </div>
        )}

        {/* Start button (also performs the audio unlock gesture) */}
        {canStart && (
          <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            {state === 'error' || state === 'unsupported' ? (
              <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
            ) : (
              <Camera className="w-12 h-12 text-amber-400 mb-3" />
            )}
            <h3 className="text-white font-bold text-base mb-1">
              {state === 'error' || state === 'unsupported' ? labels.noCamera : labels.startCamera}
            </h3>
            {errorMessage && <p className="text-slate-300 text-xs mb-4 leading-relaxed">{errorMessage}</p>}
            <p className="text-[11px] text-slate-400 mb-4 max-w-xs">{labels.startHint}</p>
            <button
              id="btn-start-camera"
              onClick={handleStart}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              {state === 'idle' ? labels.startCamera : labels.retry}
            </button>
            <button
              onClick={onOpenAiScan}
              className="mt-3 text-xs text-emerald-300 underline-offset-2 hover:underline"
            >
              {labels.aiBtn}
            </button>
          </div>
        )}
      </div>

      {/* Secondary controls */}
      <div className="w-full max-w-md mt-3 grid grid-cols-2 gap-2">
        <label
          htmlFor="qr-file-input"
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-medium cursor-pointer transition-colors"
        >
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          <span>{labels.upload}</span>
          <input id="qr-file-input" type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} />
        </label>

        <button
          onClick={state === 'running' && !isPaused ? () => setShowInspector((v) => !v) : () => setShowInspector((v) => !v)}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-medium transition-colors"
        >
          <Activity className="w-4 h-4 text-sky-400" />
          <span>{labels.inspector}</span>
          {showInspector ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Inspector */}
      {showInspector && (
        <div className="w-full max-w-md mt-2 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-[11px] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5 text-slate-300">
              <ScanLine className="w-3.5 h-3.5 text-amber-400" />
              <span>{labels.browserLabel}:</span>
              <strong className="text-white">{browser.name}</strong>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>{labels.engine}:</span>
              <strong className="text-white">{engineLastRef.current || '—'}</strong>
            </div>
            <div className="text-slate-300">
              {labels.barcodeNative}:{' '}
              <strong className={nativeSupportedRef.current ? 'text-emerald-400' : 'text-slate-400'}>
                {nativeSupportedRef.current ? labels.supported : labels.notSupported}
              </strong>
            </div>
            <div className="text-slate-300">
              ZXing:{' '}
              <strong className={isZxingReady() ? 'text-emerald-400' : 'text-amber-400'}>
                {isZxingReady() ? labels.supported : 'loading…'}
              </strong>
            </div>
            <div className="text-slate-300">
              {labels.vibration}:{' '}
              <strong
                className={
                  typeof navigator !== 'undefined' && 'vibrate' in navigator ? 'text-emerald-400' : 'text-slate-400'
                }
              >
                {typeof navigator !== 'undefined' && 'vibrate' in navigator
                  ? labels.supported
                  : labels.notSupported}
              </strong>
            </div>
            <div className="text-slate-300">
              Decode rate: <strong className="text-white">{decodeRate.toFixed(1)}/s</strong>
            </div>
            <div className="text-slate-300">
              Audio: <strong className={audioPrimed ? 'text-emerald-400' : 'text-amber-400'}>
                {audioPrimed ? 'primed' : 'waiting for tap'}
              </strong>
            </div>
          </div>

          <div>
            <div className="text-slate-400 font-semibold uppercase tracking-wider mb-1">{labels.lastPayload}</div>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px] text-emerald-300 font-mono">
              {lastRawPayload || labels.none}
            </pre>
          </div>
        </div>
      )}

      {/* Keep-alive note */}
      <p className="w-full max-w-md mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
        <Pause className="w-3 h-3 text-slate-600" />
        {labels.keepAlive}
      </p>

      {/* AI Scan button (below the QR scanner, as required) */}
      <div className="w-full max-w-md mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-amber-500/10 border border-amber-500/30 shadow-lg">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
              {labels.aiBtn}
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-400 text-slate-950 font-bold rounded-full uppercase tracking-wider">
                AI Vision
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{labels.aiSub}</p>
          </div>
        </div>

        <button
          id="open-ai-scan-btn"
          onClick={onOpenAiScan}
          className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all"
        >
          <Camera className="w-4 h-4" />
          <span>{labels.aiBtn}</span>
        </button>
      </div>
    </div>
  );
};
