/**
 * Cross-browser QR decoding.
 *
 * Engines, in the order they are tried:
 *   1. `BarcodeDetector` — native + hardware accelerated (Chrome / Edge / Android).
 *   2. `ZXing`           — pure JS, most tolerant of blur / angle / low contrast.
 *   3. `jsQR`            — small pure JS fallback that also reads inverted codes.
 *
 * IMPORTANT: nothing in this file may throw. A single uncaught exception used to
 * escape into the camera loop and silently kill scanning, so every public
 * function is defensive and returns `null` instead of throwing.
 */

import jsQR from 'jsqr';

export type DecodeEngine = 'barcode-detector' | 'zxing' | 'jsqr' | 'pipeline';

export interface DecodeHit {
  text: string;
  engine: DecodeEngine;
}

/** createImageData via canvas — works on every browser, including old Safari. */
export function createImageDataSafe(width: number, height: number): ImageData | null {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) return ctx.createImageData(width, height);
  } catch {
    /* ignore */
  }
  try {
    return new ImageData(width, height);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Native BarcodeDetector                                             */
/* ------------------------------------------------------------------ */

let barcodeDetector: any = null;
let barcodeDetectorInitDone = false;

export async function initNativeDetector(): Promise<boolean> {
  if (barcodeDetectorInitDone) return Boolean(barcodeDetector);
  barcodeDetectorInitDone = true;
  try {
    const BD = (globalThis as any).BarcodeDetector;
    if (!BD) return false;
    if (typeof BD.getSupportedFormats === 'function') {
      const formats: string[] = await BD.getSupportedFormats();
      if (!formats.includes('qr_code')) return false;
    }
    barcodeDetector = new BD({ formats: ['qr_code'] });
    return true;
  } catch {
    barcodeDetector = null;
    return false;
  }
}

export function hasNativeDetector(): boolean {
  return Boolean(barcodeDetector);
}

export async function decodeWithNative(source: CanvasImageSource): Promise<DecodeHit | null> {
  if (!barcodeDetector) return null;
  try {
    const codes = await barcodeDetector.detect(source);
    if (Array.isArray(codes) && codes.length > 0) {
      const raw = codes[0].rawValue ?? codes[0].displayValue;
      if (raw) return { text: String(raw), engine: 'barcode-detector' };
    }
  } catch {
    /* frame not ready or unsupported source — ignore */
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* ZXing (lazy — biggest dependency, so it is code-split)             */
/* ------------------------------------------------------------------ */

interface ZxingBundle {
  MultiFormatReader: any;
  BarcodeFormat: any;
  DecodeHintType: any;
  RGBLuminanceSource: any;
  HybridBinarizer: any;
  BinaryBitmap: any;
}

let zxing: ZxingBundle | null = null;
let zxingLoading: Promise<void> | null = null;
let zxingReader: any = null;
let zxingHints: any = null;
let zxingFailed = false;

/**
 * Loads ZXing in the background. The scanner calls this when the camera
 * starts; jsQR and the native detector keep working meanwhile, so a slow
 * download never blocks scanning.
 */
export function warmUpDecoders(): Promise<void> {
  if (zxing || zxingFailed) return Promise.resolve();
  if (zxingLoading) return zxingLoading;

  zxingLoading = import('@zxing/library')
    .then((mod: any) => {
      zxing = {
        MultiFormatReader: mod.MultiFormatReader,
        BarcodeFormat: mod.BarcodeFormat,
        DecodeHintType: mod.DecodeHintType,
        RGBLuminanceSource: mod.RGBLuminanceSource,
        HybridBinarizer: mod.HybridBinarizer,
        BinaryBitmap: mod.BinaryBitmap
      };
    })
    .catch((err) => {
      zxingFailed = true;
      console.warn('ZXing could not be loaded; jsQR will handle decoding.', err);
    });

  return zxingLoading;
}

export function isZxingReady(): boolean {
  return Boolean(zxing);
}

function getZxing(): { reader: any; hints: any; bundle: ZxingBundle } | null {
  if (!zxing) {
    void warmUpDecoders();
    return null;
  }
  try {
    if (!zxingReader) zxingReader = new zxing.MultiFormatReader();
    if (!zxingHints) {
      zxingHints = new Map<any, any>();
      zxingHints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.QR_CODE]);
      zxingHints.set(zxing.DecodeHintType.TRY_HARDER, true);
      zxingHints.set(zxing.DecodeHintType.CHARACTER_SET, 'UTF-8');
    }
    return { reader: zxingReader, hints: zxingHints, bundle: zxing };
  } catch {
    return null;
  }
}

function toLuminance(imageData: ImageData, invert = false): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    let lum = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
    if (invert) lum = 255 - lum;
    out[i] = lum;
  }
  return out;
}

function zxingDecodeFromLuminance(lum: Uint8ClampedArray, width: number, height: number): string | null {
  const z = getZxing();
  if (!z) return null;
  try {
    const source = new z.bundle.RGBLuminanceSource(lum, width, height);
    const bitmap = new z.bundle.BinaryBitmap(new z.bundle.HybridBinarizer(source));
    const result = z.reader.decode(bitmap, z.hints);
    const text = result?.getText?.();
    return text ? String(text) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Fast pass used inside the live camera loop. Never throws. */
export function decodeFast(imageData: ImageData, allowInvert = false): DecodeHit | null {
  if (!imageData || !imageData.data || imageData.width < 8 || imageData.height < 8) return null;

  if (zxing) {
    try {
      const lum = toLuminance(imageData);
      const text = zxingDecodeFromLuminance(lum, imageData.width, imageData.height);
      if (text) return { text, engine: 'zxing' };
      if (allowInvert) {
        const inverted = toLuminance(imageData, true);
        const invText = zxingDecodeFromLuminance(inverted, imageData.width, imageData.height);
        if (invText) return { text: invText, engine: 'zxing' };
      }
    } catch {
      /* fall through to jsQR */
    }
  }

  try {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: allowInvert ? 'attemptBoth' : 'dontInvert'
    });
    if (code?.data) return { text: code.data, engine: 'jsqr' };
  } catch {
    /* ignore */
  }

  return null;
}

/** jsQR-only pass — used while ZXing is still downloading. */
export function decodeWithJsQrOnly(imageData: ImageData, allowInvert = true): DecodeHit | null {
  try {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: allowInvert ? 'attemptBoth' : 'dontInvert'
    });
    if (code?.data) return { text: code.data, engine: 'jsqr' };
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Thorough pass for still images (gallery upload, AI capture).
 * Runs all rotations and both polarities. Never throws.
 */
export function decodeThorough(imageData: ImageData): DecodeHit | null {
  if (!imageData) return null;

  const rotations = [0, 90, 180, 270];
  for (const rotation of rotations) {
    try {
      const frame = rotation === 0 ? imageData : rotateImageData(imageData, rotation);
      if (!frame) continue;
      const hit = decodeFast(frame, rotation === 0);
      if (hit) return hit;
    } catch {
      /* try the next rotation */
    }
  }

  try {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });
    if (code?.data) return { text: code.data, engine: 'jsqr' };
  } catch {
    /* ignore */
  }
  return null;
}

function rotateImageData(src: ImageData, degrees: number): ImageData | null {
  const { width, height, data } = src;
  const swap = degrees === 90 || degrees === 270;
  const outW = swap ? height : width;
  const outH = swap ? width : height;

  const out = createImageDataSafe(outW, outH);
  if (!out) return null;

  const dst = out.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      let dx: number;
      let dy: number;
      if (degrees === 90) {
        dx = height - 1 - y;
        dy = x;
      } else if (degrees === 180) {
        dx = width - 1 - x;
        dy = height - 1 - y;
      } else {
        dx = y;
        dy = width - 1 - x;
      }
      const di = (dy * outW + dx) * 4;
      dst[di] = data[si];
      dst[di + 1] = data[si + 1];
      dst[di + 2] = data[si + 2];
      dst[di + 3] = 255;
    }
  }
  return out;
}

/**
 * Reads an ImageData from any canvas-like source. Used by the gallery / AI
 * paths so those never depend on an ImageData constructor either.
 */
export function imageDataFrom(source: CanvasImageSource, width: number, height: number): ImageData | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source as any, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } catch {
    return null;
  }
}


/* ------------------------------------------------------------------ */
/* Ticket QR pipeline (LKMQR)                                          */
/* ------------------------------------------------------------------ */
/*
 * The ticket QR on Sri Lankan lottery tickets is TINY. Feeding a full camera
 * frame to jsQR/BarcodeDetector leaves ~1-2 pixels per QR module, so nothing
 * decodes and the scanner looks like it is "not focusing".
 *
 * `public/qr-decode.js` (LKMQR) solves this properly:
 *   - locateFinders()      : finds the 1:1:3:1:1 finder pattern -> measures how
 *                            many pixels one QR module currently occupies
 *   - preprocessVariants() : contrast stretch + unsharp + otsu/adaptive
 *                            binarisation, both polarities
 *   - decodeLattice()      : tries a lattice of SCALES x VARIANTS, which is the
 *                            real fix — jsQR only succeeds when one module is
 *                            roughly 3-10 px, so images that are too small AND
 *                            too large are both rescaled before decoding.
 *
 * It is loaded from /qr-decode.js (see index.html) and needs window.jsQR.
 */

let lkmLinked = false;

function linkLkmGlobals(): any {
  const win = window as any;
  if (!lkmLinked) {
    try {
      win.jsQR = jsQR;
    } catch {
      /* ignore */
    }
    lkmLinked = true;
  }
  return win.LKMQR;
}

export function isTicketPipelineReady(): boolean {
  const api = linkLkmGlobals();
  return Boolean(api && typeof api.decodeLattice === 'function');
}

export function pipelineHasNativeDetector(): boolean {
  const api = linkLkmGlobals();
  try {
    return Boolean(api?.hasDetector?.());
  } catch {
    return false;
  }
}

export interface TicketFrameOptions {
  roi?: { x: number; y: number; w: number; h: number };
  deep?: boolean;
  budgetMs?: number;
  maxSide?: number;
  hintModulePx?: number;
}

/** Full preprocessing-lattice decode. Async, never throws. */
export async function decodeTicketFrame(
  source: CanvasImageSource,
  options: TicketFrameOptions = {}
): Promise<DecodeHit | null> {
  const api = linkLkmGlobals();
  if (!api || typeof api.decodeLattice !== 'function') return null;

  try {
    const result = await api.decodeLattice(source as any, {
      roi: options.roi,
      deep: options.deep ?? false,
      budgetMs: options.budgetMs ?? 300,
      maxSide: options.maxSide ?? 900,
      hintModulePx: options.hintModulePx
    });
    const text = result?.text ? String(result.text) : null;
    if (text) return { text, engine: 'pipeline' };
  } catch {
    /* never let a decoder error reach the camera loop */
  }
  return null;
}

/**
 * Measures the QR currently visible in a frame: how many pixels one module
 * occupies. Used to give the user real "move closer / move back" feedback.
 */
export function measureTicketQR(imageData: ImageData): { modulePx: number; found: number } | null {
  const api = linkLkmGlobals();
  if (!api || typeof api.rgbaToGray !== 'function') return null;
  try {
    const gray = api.rgbaToGray(imageData.data, imageData.width, imageData.height);
    const located = api.locateFinders(gray, imageData.width, imageData.height);
    if (!located) return null;
    return { modulePx: Number(located.modulePx) || 0, found: Number(located.found) || 0 };
  } catch {
    return null;
  }
}
