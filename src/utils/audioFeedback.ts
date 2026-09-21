/**
 * Audio + haptics.
 *
 * Why the old implementation stayed silent
 * ----------------------------------------
 * Mobile browsers (iOS Safari especially, but Chrome/Android too) create an
 * `AudioContext` in the "suspended" state unless it is created — or resumed —
 * inside a real user gesture. The result modal opens from the camera loop,
 * which is NOT a gesture, so every tone was dropped and the win sound never
 * played.
 *
 * The fix implemented here:
 *   1. `primeAudio()` is attached to the first pointer/touch/key event and
 *      starts + resumes the context, plays a silent buffer (the documented
 *      unlock signal) and primes an <audio> element as a fallback.
 *   2. Every playback helper awaits `ensureAudioRunning()` and falls back to
 *      the primed <audio> element (a generated WAV data URI) if WebAudio is
 *      still not allowed to run.
 *   3. Speech synthesis is unlocked with an empty utterance in the same
 *      gesture, and voices are loaded via the `voiceschanged` event.
 */

import { Language } from '../types/lottery';

let audioCtx: AudioContext | null = null;
let primed = false;
let unlockListenersAttached = false;
let fallbackAudio: HTMLAudioElement | null = null;
let voicesLoaded = false;
let cachedVoices: SpeechSynthesisVoice[] = [];

const WAV_CACHE = new Map<string, string>();

/* ------------------------------------------------------------------ */
/* Context management                                                  */
/* ------------------------------------------------------------------ */

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      audioCtx = null;
    }
  }
  return audioCtx;
}

export async function ensureAudioRunning(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if ((ctx.state as string) === 'running') return true;
  try {
    await ctx.resume();
  } catch {
    /* ignore */
  }
  return (ctx.state as string) === 'running';
}

/**
 * MUST be called from inside a user-gesture handler (click / touch).
 * Safe to call repeatedly.
 */
export function primeAudio(): void {
  if (typeof window === 'undefined') return;

  const ctx = getAudioContext();
  if (ctx) {
    try {
      void ctx.resume();
      // Playing a zero-length buffer is the canonical "unlock" signal.
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      /* ignore */
    }
  }

  // Prime an <audio> element too — used when WebAudio is unavailable/blocked.
  try {
    if (!fallbackAudio) {
      fallbackAudio = new Audio();
      fallbackAudio.setAttribute('playsinline', 'true');
      fallbackAudio.preload = 'auto';
    }
    const silent = getWavDataUri('silent');
    if (silent) {
      fallbackAudio.src = silent;
      const playPromise = fallbackAudio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            fallbackAudio?.pause();
          })
          .catch(() => {
            /* ignore */
          });
      }
    }
  } catch {
    /* ignore */
  }

  // Unlock speech synthesis (iOS requires at least one speak() inside a gesture).
  try {
    if ('speechSynthesis' in window) {
      const warmup = new SpeechSynthesisUtterance('');
      warmup.volume = 0;
      window.speechSynthesis.speak(warmup);
      loadVoices();
    }
  } catch {
    /* ignore */
  }

  primed = true;
}

/** Attach the unlock handlers exactly once, on the first user interaction. */
export function installGlobalAudioUnlock(): () => void {
  if (typeof window === 'undefined' || unlockListenersAttached) return () => {};
  unlockListenersAttached = true;

  const handler = () => {
    primeAudio();
    remove();
  };
  const remove = () => {
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('touchstart', handler);
    window.removeEventListener('mousedown', handler);
    window.removeEventListener('keydown', handler);
  };

  window.addEventListener('pointerdown', handler, { passive: true });
  window.addEventListener('touchstart', handler, { passive: true });
  window.addEventListener('mousedown', handler);
  window.addEventListener('keydown', handler);

  return remove;
}

export function isAudioPrimed(): boolean {
  return primed;
}

export interface AudioDiagnostics {
  webAudioSupported: boolean;
  contextState: string | null;
  speechSupported: boolean;
  vibrateSupported: boolean;
  primed: boolean;
}

export function getAudioDiagnostics(): AudioDiagnostics {
  const ctx = getAudioContext();
  return {
    webAudioSupported: Boolean(ctx),
    contextState: ctx ? ctx.state : null,
    speechSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    vibrateSupported: typeof navigator !== 'undefined' && 'vibrate' in navigator,
    primed
  };
}

/* ------------------------------------------------------------------ */
/* WAV fallback generator                                              */
/* ------------------------------------------------------------------ */

type ToneName = 'silent' | 'win' | 'lose' | 'beep';

const TONE_RECIPES: Record<ToneName, { freq: number; ms: number; gain: number }[]> = {
  silent: [{ freq: 440, ms: 20, gain: 0 }],
  beep: [
    { freq: 880, ms: 90, gain: 0.5 },
    { freq: 1320, ms: 110, gain: 0.5 }
  ],
  win: [
    { freq: 523.25, ms: 140, gain: 0.5 },
    { freq: 659.25, ms: 140, gain: 0.5 },
    { freq: 783.99, ms: 140, gain: 0.5 },
    { freq: 1046.5, ms: 380, gain: 0.55 }
  ],
  lose: [
    { freq: 392, ms: 180, gain: 0.4 },
    { freq: 294, ms: 300, gain: 0.4 }
  ]
};

function getWavDataUri(name: ToneName): string {
  const cached = WAV_CACHE.get(name);
  if (cached) return cached;

  const sampleRate = 22050;
  const recipe = TONE_RECIPES[name];
  const totalSamples = recipe.reduce((sum, t) => sum + Math.round((t.ms / 1000) * sampleRate), 0);
  const samples = new Float32Array(totalSamples);

  let offset = 0;
  for (const tone of recipe) {
    const count = Math.round((tone.ms / 1000) * sampleRate);
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate;
      // Simple attack/decay envelope avoids clicks.
      const env = Math.min(1, i / (sampleRate * 0.01)) * Math.exp(-3 * (i / count));
      samples[offset + i] = Math.sin(2 * Math.PI * tone.freq * t) * tone.gain * env;
    }
    offset += count;
  }

  // 16-bit mono PCM WAV
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let p = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(p, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    p += 2;
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  const uri = 'data:audio/wav;base64,' + btoa(binary);
  WAV_CACHE.set(name, uri);
  return uri;
}

/** Play through the primed <audio> element (works when WebAudio is blocked). */
async function playViaElement(name: ToneName): Promise<void> {
  try {
    if (!fallbackAudio) {
      fallbackAudio = new Audio();
      fallbackAudio.setAttribute('playsinline', 'true');
    }
    fallbackAudio.src = getWavDataUri(name);
    fallbackAudio.currentTime = 0;
    fallbackAudio.volume = 1;
    await fallbackAudio.play();
  } catch {
    /* autoplay still blocked — nothing else we can do */
  }
}

/* ------------------------------------------------------------------ */
/* WebAudio tone playback                                              */
/* ------------------------------------------------------------------ */

function scheduleTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  type: OscillatorType,
  peakGain: number,
  glideTo?: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, startAt + duration);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + Math.min(0.02, duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

async function playTones(
  tones: { freq: number; start: number; duration: number; type: OscillatorType; gain: number; glideTo?: number }[],
  fallbackName: ToneName
): Promise<boolean> {
  const running = await ensureAudioRunning();
  const ctx = getAudioContext();
  if (!running || !ctx) {
    await playViaElement(fallbackName);
    return false;
  }
  try {
    const now = ctx.currentTime + 0.01;
    for (const tone of tones) {
      scheduleTone(ctx, tone.freq, now + tone.start, tone.duration, tone.type, tone.gain, tone.glideTo);
    }
    return true;
  } catch {
    await playViaElement(fallbackName);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Public sound effects                                                */
/* ------------------------------------------------------------------ */

export function playQrDetectedBeep(): void {
  void playTones(
    [
      { freq: 1000, start: 0, duration: 0.09, type: 'sine', gain: 0.22 },
      { freq: 1500, start: 0.09, duration: 0.12, type: 'sine', gain: 0.22 }
    ],
    'beep'
  );
}

export function playWinCelebrationSound(): void {
  void playTones(
    [
      { freq: 523.25, start: 0, duration: 0.16, type: 'triangle', gain: 0.28 },
      { freq: 659.25, start: 0.14, duration: 0.16, type: 'triangle', gain: 0.28 },
      { freq: 783.99, start: 0.28, duration: 0.16, type: 'triangle', gain: 0.28 },
      { freq: 1046.5, start: 0.42, duration: 0.42, type: 'triangle', gain: 0.32 },
      // A second shimmer makes the win unmistakable on phone speakers.
      { freq: 1567.98, start: 0.58, duration: 0.3, type: 'sine', gain: 0.2 }
    ],
    'win'
  );
}

export function playLoseTone(): void {
  void playTones(
    [
      { freq: 440, start: 0, duration: 0.22, type: 'sine', gain: 0.16, glideTo: 330 },
      { freq: 294, start: 0.22, duration: 0.28, type: 'sine', gain: 0.14 }
    ],
    'lose'
  );
}

/* ------------------------------------------------------------------ */
/* Haptics                                                             */
/* ------------------------------------------------------------------ */

export function vibratePhone(pattern: number[] | number = [120, 60, 120]): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as any;
  try {
    if (typeof nav.vibrate === 'function') {
      return Boolean(nav.vibrate(pattern));
    }
    if (typeof nav.webkitVibrate === 'function') {
      return Boolean(nav.webkitVibrate(pattern));
    }
    if (typeof nav.mozVibrate === 'function') {
      return Boolean(nav.mozVibrate(pattern));
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function vibrateWin(): void {
  vibratePhone([90, 60, 90, 60, 220]);
}

/* ------------------------------------------------------------------ */
/* Speech                                                              */
/* ------------------------------------------------------------------ */

function loadVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      cachedVoices = voices;
      voicesLoaded = true;
    }
    if (!voicesLoaded) {
      window.speechSynthesis.onvoiceschanged = () => {
        cachedVoices = window.speechSynthesis.getVoices() || [];
        voicesLoaded = cachedVoices.length > 0;
      };
    }
  } catch {
    /* ignore */
  }
}

function pickVoice(lang: Language): SpeechSynthesisVoice | undefined {
  if (cachedVoices.length === 0) loadVoices();
  const voices = cachedVoices;
  if (!voices || voices.length === 0) return undefined;

  const wants = (v: SpeechSynthesisVoice, prefixes: string[], names: string[]) =>
    prefixes.some((p) => v.lang.toLowerCase().startsWith(p)) ||
    names.some((n) => v.name.toLowerCase().includes(n));

  if (lang === 'si') {
    return voices.find((v) => wants(v, ['si'], ['sinhala', 'si-lk']));
  }
  if (lang === 'ta') {
    return voices.find((v) => wants(v, ['ta'], ['tamil']));
  }
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith('en') && /google|natural|samantha|zira/i.test(v.name)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en'))
  );
}

export interface SpeechResultInput {
  won: boolean;
  lotteryName: string;
  prizeLabel: string | null;
  prizeAmountFormatted: string | null;
  language: Language;
}

export function speakResult(
  won: boolean,
  lotteryName: string,
  prizeLabel: string | null,
  prizeAmountFormatted: string | null,
  lang: Language = 'en'
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();
    loadVoices();

    const cleanPrize = (prizeAmountFormatted || '')
      .replace(/Rs\.?/gi, lang === 'si' ? 'රුපියල්' : lang === 'ta' ? 'ரூபாய்' : 'Rupees')
      .replace(/\.00\b/g, '')
      .trim();

    let text = '';
    if (won) {
      if (lang === 'si') {
        text = `සුබ පැතුම්! ඔබ ${lotteryName} ලොතරැයියෙන් ${cleanPrize || 'ත්‍යාගයක්'} දිනා ඇත!`;
      } else if (lang === 'ta') {
        text = `வாழ்த்துக்கள்! ${lotteryName} குலுக்கலில் நீங்கள் ${cleanPrize} வென்றுள்ளீர்கள்!`;
      } else {
        text = `Congratulations! You won ${cleanPrize || 'a prize'} in ${lotteryName}!`;
      }
    } else {
      if (lang === 'si') {
        text = 'මෙම ටිකට් පතට දිනුමක් නොමැත. ඊළඟ වාරයේ ජය පතමු!';
      } else if (lang === 'ta') {
        text = 'வெற்றி இல்லை. அடுத்த முறை முயற்சி செய்யவும்!';
      } else {
        text = 'No win on this ticket. Better luck next time!';
      }
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    const voice = pickVoice(lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = lang === 'si' ? 'si-LK' : lang === 'ta' ? 'ta-LK' : 'en-US';
    }

    // Some Android builds drop the first utterance right after an unlock.
    window.speechSynthesis.speak(utterance);
  } catch {
    /* ignore */
  }
}

export function stopSpeech(): void {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    /* ignore */
  }
}
