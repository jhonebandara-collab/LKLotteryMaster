/**
 * Camera helpers that keep behaviour consistent across Chrome, Edge, Firefox,
 * Safari (iOS + macOS) and Samsung Internet.
 *
 * Key cross-browser facts encoded here:
 *  - `navigator.mediaDevices` only exists in a *secure context*. Over plain
 *    HTTP on a LAN IP Chrome / Edge / Safari hide the API completely, while
 *    Firefox shows a more confusing error. We detect this up front and tell
 *    the user exactly what to do instead of failing silently.
 *  - Safari needs `playsinline` + `muted` *before* `srcObject` is assigned.
 *  - `facingMode: {exact: 'environment'}` throws on desktop webcams, so we
 *    always fall back through progressively simpler constraints.
 *  - `torch` / `zoom` / `focusMode` are Chromium-only capabilities; the
 *    helpers expose what the current device actually supports.
 */

export interface BrowserInfo {
  name: string;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isChromium: boolean;
}

export function detectBrowser(): BrowserInfo {
  if (typeof navigator === 'undefined') {
    return { name: 'Unknown', isIOS: false, isAndroid: false, isSafari: false, isFirefox: false, isChromium: false };
  }
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isOpera = /OPR\//.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isChrome = /Chrome|CriOS/i.test(ua) && !isEdge && !isOpera && !isSamsung;
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Android/i.test(ua);

  let name = 'Browser';
  if (isSamsung) name = 'Samsung Internet';
  else if (isEdge) name = 'Edge';
  else if (isOpera) name = 'Opera';
  else if (isChrome) name = 'Chrome';
  else if (isFirefox) name = 'Firefox';
  else if (isSafari) name = 'Safari';

  return {
    name,
    isIOS,
    isAndroid,
    isSafari,
    isFirefox,
    isChromium: isChrome || isEdge || isOpera || isSamsung
  };
}

export function hasMediaDevices(): boolean {
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export interface SecureContextInfo {
  ok: boolean;
  isSecureContext: boolean;
  protocol: string;
  host: string;
  reason?: string;
}

export function checkSecureContext(): SecureContextInfo {
  if (typeof window === 'undefined') {
    return { ok: false, isSecureContext: false, protocol: '', host: '', reason: 'No browser context' };
  }
  const protocol = window.location.protocol;
  const host = window.location.host;
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
  const secure = window.isSecureContext || protocol === 'https:' || isLocalhost;

  if (!secure) {
    return {
      ok: false,
      isSecureContext: Boolean(window.isSecureContext),
      protocol,
      host,
      reason:
        'The camera API is disabled on insecure (http://) pages. Open the app over https:// or from localhost.'
    };
  }
  if (!hasMediaDevices()) {
    return {
      ok: false,
      isSecureContext: true,
      protocol,
      host,
      reason: 'This browser does not expose navigator.mediaDevices.getUserMedia.'
    };
  }
  return { ok: true, isSecureContext: true, protocol, host };
}

/** Constraint ladder — first entry is the best experience. */
export function buildConstraintAttempts(deviceId?: string): MediaStreamConstraints[] {
  const attempts: MediaStreamConstraints[] = [];

  if (deviceId) {
    attempts.push({
      audio: false,
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 }
      }
    });
    attempts.push({
      audio: false,
      video: {
        deviceId: { ideal: deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
  }

  attempts.push({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 60 },
      // Asking for autofocus up-front matters: on Android many devices only
      // enable continuous AF when it is part of the initial request.
      advanced: [{ focusMode: 'continuous' } as any]
    } as any
  });
  attempts.push({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  });
  attempts.push({
    audio: false,
    video: { facingMode: 'environment' }
  });
  attempts.push({ audio: false, video: true });

  return attempts;
}

export async function openCamera(constraintsList: MediaStreamConstraints[]): Promise<MediaStream> {
  let lastError: unknown = null;
  for (const constraints of constraintsList) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream && stream.getVideoTracks().length > 0) return stream;
      stream?.getTracks().forEach((t) => t.stop());
    } catch (err) {
      lastError = err;
      const name = (err as DOMException)?.name;
      // Permission problems will not be fixed by retrying other constraints.
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        throw err;
      }
    }
  }
  throw lastError || new Error('Unable to start the camera on this device.');
}

export function waitForVideoMetadata(video: HTMLVideoElement, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && video.videoWidth > 0) {
      resolve();
      return;
    }
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Camera stream did not produce any frames in time.'));
    }, timeoutMs);

    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('canplay', onLoaded);
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('canplay', onLoaded);
  });
}

/** Apply soft, non-fatal camera tuning that improves QR readability. */
export async function tuneTrack(track: MediaStreamTrack): Promise<void> {
  const capabilities: any = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};

  // Continuous autofocus keeps small QR modules sharp while the user moves.
  if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
    } catch {
      /* not fatal */
    }
  }

  if (capabilities.exposureMode && Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes('continuous')) {
    try {
      await track.applyConstraints({ advanced: [{ exposureMode: 'continuous' } as any] });
    } catch {
      /* not fatal */
    }
  }

  // NOTE: no default digital zoom. Digital zoom is a crop + upscale, which
  // makes a QR code look "out of focus" on most phones. The zoom slider is
  // available for the user, but the camera starts at optical 1x.
  if (capabilities.zoom && typeof capabilities.zoom.min === 'number') {
    try {
      await track.applyConstraints({ advanced: [{ zoom: capabilities.zoom.min } as any] });
    } catch {
      /* not fatal */
    }
  }
}

export function hasTorch(track: MediaStreamTrack | null | undefined): boolean {
  if (!track || typeof track.getCapabilities !== 'function') return false;
  try {
    const caps: any = track.getCapabilities();
    return Boolean(caps.torch);
  } catch {
    return false;
  }
}

export async function setTorch(track: MediaStreamTrack | null | undefined, on: boolean): Promise<boolean> {
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as any] });
    return true;
  } catch {
    return false;
  }
}

export interface ZoomRange {
  min: number;
  max: number;
  step: number;
}

export function getZoomRange(track: MediaStreamTrack | null | undefined): ZoomRange | null {
  if (!track || typeof track.getCapabilities !== 'function') return null;
  try {
    const caps: any = track.getCapabilities();
    if (!caps.zoom || typeof caps.zoom.max !== 'number' || caps.zoom.max <= 1) return null;
    return {
      min: typeof caps.zoom.min === 'number' ? caps.zoom.min : 1,
      max: caps.zoom.max,
      step: typeof caps.zoom.step === 'number' && caps.zoom.step > 0 ? caps.zoom.step : 0.1
    };
  } catch {
    return null;
  }
}

export async function setZoom(track: MediaStreamTrack | null | undefined, value: number): Promise<boolean> {
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ zoom: value } as any] });
    return true;
  } catch {
    return false;
  }
}

/** Tap-to-focus (Chromium). Silently ignored elsewhere. */
export async function focusAtPoint(
  track: MediaStreamTrack | null | undefined,
  x: number,
  y: number
): Promise<void> {
  if (!track || typeof track.getCapabilities !== 'function') return;
  try {
    const caps: any = track.getCapabilities();
    if (!Array.isArray(caps.pointsOfInterest)) return;
    await track.applyConstraints({ advanced: [{ pointsOfInterest: [{ x, y }], focusMode: 'single-shot' } as any] });
  } catch {
    /* not fatal */
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  });
}

/** Grab a still frame as a JPEG data URL — used by the AI ticket reader. */
export function captureFrameDataUrl(
  video: HTMLVideoElement,
  options: { maxWidth?: number; quality?: number } = {}
): string | null {
  const maxWidth = options.maxWidth ?? 1600;
  const quality = options.quality ?? 0.92;
  if (!video || !video.videoWidth || !video.videoHeight) return null;

  const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Higher resolution still when the platform exposes ImageCapture. */
export async function captureHighResDataUrl(
  track: MediaStreamTrack | null | undefined,
  fallback: () => string | null
): Promise<string | null> {
  const ImageCaptureCtor = (globalThis as any).ImageCapture;
  if (track && typeof ImageCaptureCtor === 'function') {
    try {
      const capture = new ImageCaptureCtor(track);
      const blob: Blob = await capture.takePhoto();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      /* fall through to canvas capture */
    }
  }
  return fallback();
}

export function describeCameraError(err: unknown, browser: BrowserInfo): string {
  const name = (err as DOMException)?.name;
  const raw = (err as Error)?.message || String(err);

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return browser.isIOS
        ? 'Camera permission was denied. Open Settings → Safari → Camera and allow access, then reload.'
        : 'Camera permission was denied. Allow camera access for this site in the address bar, then tap Retry.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another app or tab. Close it and tap Retry.';
    case 'OverconstrainedError':
      return 'This device cannot satisfy the requested camera settings. Tap Retry to use default settings.';
    case 'SecurityError':
      return 'Blocked for security reasons. The page must be served over https://.';
    default:
      return raw || 'Unable to start the camera.';
  }
}

/** True when the stream is still alive and producing frames. */
export function isStreamLive(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  const tracks = stream.getVideoTracks();
  if (tracks.length === 0) return false;
  return tracks.some((t) => t.readyState === 'live');
}
