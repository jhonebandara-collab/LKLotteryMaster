# LK Lottery Master PRO

Sri Lankan lottery (NLB + DLB) ticket checker: QR scanner, AI ticket reader, official prize
calculator and scan history.

---

## Quick start

```bash
npm install
cp .env.example .env      # add your Gemini API keys
npm run dev               # http://localhost:3000
```

### Running it on a phone (important for the QR scanner)

Browsers only expose the camera (`navigator.mediaDevices.getUserMedia`) on **https://**
pages or on **localhost**. If you open the app on a phone over plain `http://192.168.x.x`
the camera is blocked by Chrome, Edge, Safari and Firefox alike — the app now detects this
and tells the user instead of failing silently.

```bash
npm run dev:https         # generates a self-signed cert (certs/) and serves over https
```

Then open `https://<your-computer-LAN-IP>:3000` on the phone and accept the certificate
warning once.

Useful commands:

| Command | What it does |
|---|---|
| `npm run dev` | Development server (http://localhost:3000) |
| `npm run dev:https` | Generates certs + development server over https (needed for phones) |
| `npm run cert` | Only generate the self-signed certificate |
| `npm test` | Parser / draw resolver / prize calculator self-test (57 checks) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build (`dist/`) |
| `npm start` | Run the production build |

---

## Configuration (`.env`)

```env
GEMINI_API_KEY=""
GEMINI_API_KEY_1=""
GEMINI_API_KEY_2=""
GEMINI_API_KEY_3=""
GEMINI_API_KEY_4=""
GEMINI_API_KEY_5=""
```

* All keys are combined into a **key pool**. They are used round-robin.
* When a key returns a rate-limit / quota error it is put on an exponential cooldown
  (60 s → 2 min → 4 min … capped at 15 min) and the next key is used automatically —
  the user never sees an interruption and no restart is needed.
* An invalid key is parked for 6 hours.
* If every key is cooling down the API answers with a clear message telling you to retry
  shortly, and the app shows which keys are cooling and for how long.
* `GEMINI_MODELS` (optional) overrides the model chain; the default is
  `gemini-3.8-flash` then `gemini-3.6-flash`. Model-not-found errors roll to the next model
  with the same key, key errors roll to the next key.

`GET /api/health` reports the pool state (`configuredKeys`, `models`, per-key cooldowns).

---

## What this version fixes

### 1. QR scanning now works on Firefox, Chrome, Edge and Safari

* **Secure-context detection.** If the camera API is unavailable (http:// origin, unsupported
  browser) the scanner explains exactly why and what to do, instead of showing a dead view.
* **Three decode engines, automatically selected:**
  1. native `BarcodeDetector` (Chrome / Edge / Android, hardware accelerated),
  2. `ZXing` (most tolerant with blurry, angled and low-contrast codes — code-split so it
     does not slow the first page load),
  3. `jsQR` (small pure-JS fallback that also reads inverted codes).
* **Frame strategy tuned for speed:** every tick runs the central region at full resolution
  (fastest when the ticket is held in the guide box) and cycles a full-frame downscaled pass
  with inversion, so a code anywhere in view is picked up quickly.
* **iOS Safari specifics:** `playsinline` + `muted` are set *before* `srcObject`, and
  `play()` is called immediately after `getUserMedia` resolves so the element counts as
  user-gesture initiated.
* **Continuous autofocus**, optional torch, camera switch, zoom slider and tap-to-focus
  (used when the platform supports them; silently skipped when it does not).
* **Constraint ladder:** 1920×1080 → 1280×720 → facingMode only → any camera, so desktop
  webcams and multi-camera phones both start.

### 2. The camera stays on

* The scanner component is **never unmounted** when you switch tabs (History, Manual Check…);
  it is only hidden, so the stream is not torn down and restarted.
* The result of a scan only **pauses decoding**; the stream keeps running.
* Coming back from the background re-checks the stream and silently re-acquires it if the OS
  killed the track.

### 3. Win notice audio actually plays

The old code created the `AudioContext` outside a user gesture, so browsers kept it
`suspended` and every sound (including the win chime) was dropped.

* Audio is **primed on the first tap anywhere**: the context is resumed, a silent buffer is
  played (the documented unlock signal), speech synthesis is unlocked, and an `<audio>`
  element is primed as well.
* The scanner's **Start camera** button performs the unlock explicitly.
* Every sound (win chime, lose tone, QR beep) runs through `ensureAudioRunning()` and falls
  back to a generated WAV played by the primed `<audio>` element if WebAudio is still
  blocked.
* If a browser still refuses, the result modal replays the sound on the first tap inside it.
* Speech announces the result, pronouncing `Rs.` as "Rupees" (Sinhala/Tamil variants included).

### 4. Vibrate on QR detection, 5 second result, automatic next scan

* Phone vibrates the moment a QR is decoded, plus a short beep and a green screen flash.
* The result is shown for **5 seconds** with a countdown ring, then the scanner resumes by
  itself, ready for the next ticket (pause/extend is available).
* The same ticket never re-triggers while it is still in front of the camera.

### 5. Ticket vs official result, side by side

The result modal shows **"Numbers read from YOUR ticket"** and **"Official winning result"**
as two separate rows, with every matching ball, letter, zodiac sign and super number
highlighted, plus the matched-number summary and the matched prize tier.

### 6. History with per-lottery and date-range statistics

* Filters: lottery (or all), result (won / no win / all), date range (with Today / 7 days /
  30 days / All time shortcuts).
* Date basis switch: filter by **scan time** or by **draw date**.
* Stat tiles: tickets checked, wins, no-win, win rate, total winnings, biggest win.
* **Per-lottery breakdown table** (checked / wins / no-win / total won) for the selected
  period, clickable to drill into one lottery.
* Full record list with the ticket numbers, official numbers and the matched ones.
* CSV export of the filtered set and clear-history.

### 7. AI Scan button below the QR scanner

When a QR will not scan (damaged, scratched, wet, folded) the AI reader:

* can capture a still **directly from the camera that is already running** (no need to go
  back to a menu),
* also supports taking a photo or picking one from the gallery,
* returns the same parsed shape as the QR scanner, so the result is scored, displayed and
  recorded identically (win / no win, prize tier, history entry),
* never invents data: if the AI cannot read the ticket it says so
  (`cannotRead` → "Cannot read this ticket") instead of guessing.

### 8. Govisetha date-matching bug — fixed

This was the most dangerous bug: a ticket could be scored against an unrelated official draw.

The new rule set:

* The **draw number is the only authoritative key**. A date on the ticket never selects a draw
  on its own while a draw number was read.
* If the ticket's printed date disagrees with the matched draw's date, the draw number still
  wins and a warning is shown.
* If the draw number cannot be found in the downloaded results, the ticket is **not scored**.
  The app says so, explains it and offers the nearest draws so the user can verify manually.
* The date is only used as a fallback when **no draw number could be read at all**, and that
  match is clearly labelled "matched by: date".
* The date digits are stripped from the payload before ball numbers are extracted, so a date
  can never leak into the number list.
* Numbers and letters are never fabricated from the official draw (the old code filled missing
  values with official numbers / `'W'` / `'17'`, which produced guaranteed false "wins").

### 9. Correct handling of Sri Lankan ticket formats

* 1-digit lotteries keep 1-digit balls (Mahajana Sampatha, NLB Jaya, Supiri Dhana Sampatha,
  Jaya Sampatha, Ada Sampatha); 2-digit lotteries keep 2-digit balls.
* Glued barcode digits are split correctly (`03182170` → `03-18-21-70`).
* Draw numbers are compared with leading zeros normalised (`0890` = `890`).
* Serial numbers, barcodes, ticket prices and dates are excluded from the ball list.
* Payload formats supported: JSON, URLs with query parameters, `key=value` strings,
  delimiter strings (`GS/4557/W/03-32-36-62/19092026`), base64-wrapped text.
* The QR **payload inspector** in the scanner shows the raw decoded string, the engine that
  decoded it, the decode rate, the browser and the detected flags — useful if a ticket
  format ever needs reviewing.

---

## Prize structures implemented

Verified against the official NLB / DLB structures:

| Lottery | Notable rules |
|---|---|
| Govisetha | Letter + 4 → Rs 60M; 4 → 2M; letter+3 → 250,000; 3 → 5,000; letter+2 → 2,000; 2 → 200; letter+1 → 200; 1 → 40; letter → 40 |
| Dhana Nidhanaya | Letter + 4 → Rs 80M; 4 → 2M; letter+3 → 200,000; 3 → 6,000; letter+2 → 2,000; 2 → 200; letter+1 → 120; 1 → 40; letter → 40 |
| Mega Power | Letter + super + 4 → Rs 150M; letter+4 → 10M; super+4 → motor car; 4 → 2M; letter+3 → 200,000; 3 → 5,000; letter+2 → 2,000; 2 → 200; letter+1 → 200; 1 → 40; letter → 40; super → 40 |
| Handahana | Zodiac + 4 → Rs 3M; 4 → 1M; zodiac+3 → 25,000; 3 → 2,000; zodiac+2 → 500; 2 → 200; zodiac+1 → 120; 1 → 40; zodiac → 40 |
| Mahajana Sampatha | Letter + 6 → Rs 20M; 6 → 2.5M; last/first 5 → 100,000; last 4 → 15,000; first 4 → 2,000; last 3 → 2,000; first 3 → 200; last 2 → 200; first 2 → 80; last/first 1 → 40; letter → 40 |
| Ada Sampatha | 2 → 1,000; 3 → 4,000; 4 → 50,000; 4 + letter → 250,000; letter → 80 |
| NLB Jaya | Letter + 4 → 500,000; 4 → 50,000; last 3 → 2,000; first 3 → 200; last 2 → 200; first 2 → 80; last/first 1 → 40; letter → 40 |
| Suba Dawasak | Zodiac + 3 → 500,000; 3 → 50,000; zodiac+2 → 2,500; 2 → 1,000; zodiac+1 → 200; 1 → 40; zodiac → 40 |
| Ada Kotipathi / Shanida | 4 + letter → 50M; 4 → 2M; 3 + letter → 200,000; 3 → 4,000; 2 + letter → 2,000; 2 → 200; 1 + letter → 200; 1 → 40; letter → 40 |
| Lagna Wasana | 4 + zodiac → 3M; 4 → 1M; 3 + zodiac → 20,000; 3 → 2,000; 2 + zodiac → 400; 2 → 200; 1 + zodiac → 120; 1 → 40; zodiac → 40 |
| Supiri Dhana Sampatha | 6 + letter → 20M; 6 → 2.5M; last 5/first 5 → 100,000; last 4 → 20,000; first 4 → 2,000; last 3 → 2,000; first 3 → 200; last 2 → 200; first 2 → 120; last/first 1 → 40; letter → 40; all 6 any order → 500 |
| Super Ball | 4 + letter → 50M; 4 → 2M; 3 + letter → 200,000; 3 → 4,000; 2 + letter → 2,000; 2 → 200; 1 + letter → 200; 1 → 40; letter → 40 |
| Kapruka | 4 + letter + super → 150M; 4 + letter → 10M; 4 + super → 10M; 4 → 2M; 3 + letter → 200,000; 3 → 4,000; 2 + letter → 2,000; 2 → 200; 1 + letter → 200; 1 → 40; letter → 40; super → 40 |
| Waasi | 2 + letter + super → 1M; 2 + letter → 500,000; 2 + super → 50,000; 2 → 25,000; 1 + super + letter → 1,000; 1 + letter → 500; 1 + super → 500; super + letter → 120; 1 → 40; letter → 40; super → 40 |
| Sasiri | 3 → 200,000; 2 → 400; 1 → 40 |
| Jaya Sampatha | 4 back-to-forward + letter → 250,000; 4 → 50,000; 3 → 4,000; 2 → 1,000; letter → 80 |

`npm test` asserts the most important of these end to end.

---

## Project layout

```
server.ts                     Express + Vite server, Gemini key pool, /api/scan, /api/health
src/App.tsx                   Scan pipeline: parse → resolve draw → evaluate → present → history
src/components/QRScanner.tsx  Live camera scanner (start gate, torch, zoom, AI button, inspector)
src/components/ScanResultModal.tsx
src/components/AiTicketScanner.tsx
src/components/HistoryView.tsx
src/utils/qrParser.ts         Multi-format QR payload parser (never invents data)
src/utils/drawResolver.ts     Binds a ticket to an official draw — refuses to guess
src/utils/decoders.ts         BarcodeDetector + ZXing + jsQR, ROI/downscale helpers
src/utils/cameraUtils.ts      Cross-browser camera constraints, torch, zoom, focus, capture
src/utils/audioFeedback.ts    Audio unlock, tones, vibration, speech
src/utils/prizeCalculator.ts  Official prize rules
src/data/rawLotteriesData.json Official draw results
scripts/self-test.ts          57 assertions (npm test)
scripts/make-cert.mjs         Self-signed certificate generator
```

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Camera blocked on this connection" | The page is http:// — run `npm run dev:https` (or use localhost). |
| Camera works in Firefox but not Chrome/Edge/Safari | Same secure-context rule; Chrome/Edge/Safari hide the API entirely on http://. |
| Camera permission denied | Re-allow it in the browser's site settings (iOS: Settings → Safari → Camera), then Retry. |
| "The camera is already in use" | Another tab/app holds the camera — close it and tap Retry. |
| Scanning is slow | Check the decode rate in the QR payload inspector (4–15/s is normal). Use the zoom slider or the flash on glossy tickets. |
| No sound on a win | Tap anywhere once — that unlocks audio on iOS/Chrome; the setting persists for the session. Check the speaker toggle in the header. |
| iPhone does not vibrate | iOS Safari does not implement the vibration API. The camera flash + beep + on-screen result are the feedback there. |
| "Cannot read this ticket" | The AI refused rather than guessed. Retake the photo with more light, or use Manual Check. |
| Every AI scan says keys are cooling down | All keys are rate-limited; wait for the cooldown shown in `/api/health`, or add more keys. |
| A ticket says "not scored / pick the draw" | The ticket's draw number is not in the downloaded results. Pick the draw manually in the result modal — the ticket is deliberately not scored against a wrong draw. |
```

---

## Why the ticket QR is hard to scan (and how it is solved)

The QR printed on a Sri Lankan lottery ticket is **tiny**. Feeding a full camera
frame straight to jsQR / BarcodeDetector leaves roughly **1-2 pixels per QR
module**, and no decoder on earth can read that. This looked like "the camera
will not focus / the image is blurry", but it was a pixel-density problem.

`public/qr-decode.js` (exposed as `window.LKMQR`) is a purpose-built pipeline:

| Step | Function | What it does |
|---|---|---|
| 1 | `locateFinders()` | Finds the 1:1:3:1:1 finder pattern and **measures how many pixels one QR module currently occupies** |
| 2 | `preprocessVariants()` | Percentile contrast stretch + unsharp mask + Otsu / adaptive (Bradley) binarisation, both polarities |
| 3 | `decodeLattice()` | Tries a lattice of **scales x variants x polarity**. jsQR only succeeds when a module is ~3-10 px, so images are rescaled both up and down before decoding |
| 4 | `stackAverage()` | Averages several aligned frames to cut noise ("super-resolution lite") |

The scanner therefore runs four strategies in rotation every tick:

1. native `BarcodeDetector` on the live video element
2. central ROI at native resolution (`decodeFast`)
3. whole frame downscaled (`decodeFast`)
4. **the full LKMQR lattice** — the one that actually reads the small ticket QR

The measured `px/module` value is shown live above the viewfinder with real
advice ("move closer" / "move back" / "hold still"), so a failed scan always has
a visible reason.

### Testing

See **[TESTING-SI.md](TESTING-SI.md)** for the full step-by-step test plan
(Sinhala), including the HTTPS requirement, the colour-coded QR size meter, the
admin panel checks and the results-import checks.
