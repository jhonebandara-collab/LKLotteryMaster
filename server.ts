import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// The production bundle is CommonJS (esbuild), where `__dirname` exists, while
// the TS dev runtime is ESM and only has import.meta.url. Support both.
declare const __dirname: string | undefined;

const baseDir = (() => {
  if (typeof __dirname !== 'undefined' && __dirname) return __dirname;
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

const PORT = Number(process.env.PORT || 3000);

/* ------------------------------------------------------------------ */
/* Gemini API key pool with rotation + model fallback                  */
/* ------------------------------------------------------------------ */

interface KeyEntry {
  key: string;
  label: string;
  cooldownUntil: number;
  failures: number;
  successes: number;
  lastError: string | null;
}

const KEY_COOLDOWN_RATE_LIMIT_MS = 60_000;
const KEY_COOLDOWN_INVALID_MS = 6 * 60 * 60 * 1000;
const KEY_COOLDOWN_MAX_MS = 15 * 60 * 1000;

function collectKeys(): KeyEntry[] {
  const raw: string[] = [];
  const push = (value?: string | null) => {
    if (!value) return;
    for (const part of String(value).split(/[,\s;]+/)) {
      const trimmed = part.trim().replace(/^["']|["']$/g, '');
      if (trimmed && !trimmed.includes('MY_GEMINI') && !trimmed.includes('MY_API')) raw.push(trimmed);
    }
  };

  push(process.env.GEMINI_API_KEYS);
  push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 10; i++) push(process.env[`GEMINI_API_KEY_${i}`]);

  const seen = new Set<string>();
  const entries: KeyEntry[] = [];
  for (const key of raw) {
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      key,
      label: `key-${entries.length + 1}…${key.slice(-4)}`,
      cooldownUntil: 0,
      failures: 0,
      successes: 0,
      lastError: null
    });
  }
  return entries;
}

const keyPool = collectKeys();
let keyCursor = 0;

function collectModels(): string[] {
  const list = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const defaults = ['gemini-3.8-flash', 'gemini-3.6-flash'];
  return Array.from(new Set([...list, ...defaults]));
}
const MODELS = collectModels();

function availableKeys(): KeyEntry[] {
  const now = Date.now();
  const ready = keyPool.filter((k) => k.cooldownUntil <= now);
  if (ready.length === 0) return [];
  // Round-robin so no single key burns out.
  const rotated: KeyEntry[] = [];
  for (let i = 0; i < ready.length; i++) {
    rotated.push(ready[(keyCursor + i) % ready.length]);
  }
  keyCursor = (keyCursor + 1) % Math.max(1, ready.length);
  return rotated;
}

function classifyError(error: any): 'rate-limit' | 'invalid-key' | 'model' | 'transient' | 'content' {
  const message = String(error?.message || error?.toString?.() || '');
  const status = Number(error?.status || error?.code || 0);
  const upper = message.toUpperCase();

  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('RATE LIMIT') || upper.includes('QUOTA')) {
    return 'rate-limit';
  }
  if (
    status === 401 ||
    status === 403 ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('UNAUTHENTICATED')
  ) {
    return 'invalid-key';
  }
  if (status === 404 || upper.includes('NOT_FOUND') || upper.includes('NOT SUPPORTED') || upper.includes('MODEL NOT FOUND')) {
    return 'model';
  }
  if (upper.includes('SAFETY') || upper.includes('BLOCKED') || upper.includes('PROHIBITED')) {
    return 'content';
  }
  return 'transient';
}

function penaliseKey(entry: KeyEntry, kind: ReturnType<typeof classifyError>, message: string) {
  entry.failures += 1;
  entry.lastError = message.slice(0, 180);

  if (kind === 'invalid-key') {
    entry.cooldownUntil = Date.now() + KEY_COOLDOWN_INVALID_MS;
    return;
  }
  if (kind === 'rate-limit') {
    const backoff = Math.min(KEY_COOLDOWN_MAX_MS, KEY_COOLDOWN_RATE_LIMIT_MS * Math.pow(2, entry.failures - 1));
    entry.cooldownUntil = Date.now() + backoff;
    return;
  }
  // Transient errors get a short rest too, to avoid hammering.
  entry.cooldownUntil = Date.now() + 5_000;
}

function rewardKey(entry: KeyEntry) {
  entry.successes += 1;
  entry.failures = 0;
  entry.cooldownUntil = 0;
  entry.lastError = null;
}

function keyStatusSnapshot() {
  const now = Date.now();
  return keyPool.map((entry) => ({
    label: entry.label,
    coolingForMs: Math.max(0, entry.cooldownUntil - now),
    failures: entry.failures,
    successes: entry.successes,
    lastError: entry.lastError
  }));
}

/* ------------------------------------------------------------------ */
/* Ticket reading prompt                                               */
/* ------------------------------------------------------------------ */

const TICKET_SCAN_PROMPT = `You are an expert reader of Sri Lankan lottery tickets (NLB and DLB). You will be shown a photograph of ONE ticket.

Read ONLY what is actually printed on the ticket. Never guess a digit — if a digit or the lottery name is not clearly legible, set "cannotRead": true. A wrong answer is far worse than an honest failure.

Supported lotteries (use the exact slug):
- govisetha (NLB) — English letter + 4 two-digit numbers
- mahajana-sampatha (NLB) — English letter + 6 single-digit numbers
- dhana-nidhanaya (NLB) — English letter + 4 two-digit numbers (may print a second letter)
- mega-power (NLB) — English letter + super number + 4 two-digit numbers
- handahana (NLB) — zodiac sign + 4 two-digit numbers
- ada-sampatha (NLB) — 2 or 3 or 4 numbers (single digits) + letter
- nlb-jaya (NLB) — English letter + 4 single-digit numbers
- suba-dawasak (NLB) — zodiac + 3 numbers
- ada-kotipathi (DLB) — English letter + 4 two-digit numbers
- shanida (DLB) — English letter + 4 two-digit numbers
- lagna-wasana (DLB) — zodiac + 4 two-digit numbers
- supiri-dhana-sampatha (DLB) — English letter + 6 single-digit numbers
- super-ball (DLB) — English letter + 4 two-digit numbers
- kapruka (DLB) — English letter + super number + 4 two-digit numbers
- sasiri (DLB) — 3 two-digit numbers, no letter
- jaya-sampatha (DLB) — English letter + 4 single-digit numbers
- waasi (DLB) — English letter + super number + 2 numbers

Rules:
1. "numbers" must contain ONLY the lottery ball numbers of the ticket. Never include the ticket price (Rs. 20 / 40 / 50), the barcode digits, the serial number or the draw date.
2. Keep the digits exactly as printed (a 1-digit lottery stays "7", a 2-digit lottery stays "07").
3. "drawNo" is the draw number printed on the ticket (e.g. 4557).
4. "date" is the draw date printed on the ticket, formatted YYYY-MM-DD when possible.
5. "letter" is the single English letter (A–Z). Use null when the lottery has none.
6. "zodiac" is the English zodiac sign (ARIES, TAURUS, GEMINI, CANCER, LEO, VIRGO, LIBRA, SCORPIO, SAGITTARIUS, CAPRICORN, AQUARIUS, PISCES) or null.
7. "superNumber" is the super number when the lottery has one, otherwise null.
8. "rawText" should contain any other clearly printed identifying text (ticket serial etc.).

Return STRICT JSON only:
{
  "cannotRead": false,
  "lotterySlug": "govisetha",
  "lotteryName": "Govisetha",
  "drawNo": "4557",
  "date": "2026-09-19",
  "letter": "W",
  "zodiac": null,
  "superNumber": null,
  "numbers": ["03", "32", "36", "62"],
  "confidence": "high",
  "rawText": "",
  "reasoning": "short explanation"
}`;

function sanitiseAiResult(input: any) {
  if (!input || typeof input !== 'object') return null;

  const numbers = Array.isArray(input.numbers)
    ? input.numbers
        .map((n: any) => String(n).replace(/\D/g, ''))
        .filter((n: string) => n.length > 0 && n.length <= 2)
    : [];

  const letter = typeof input.letter === 'string' && /^[A-Za-z]$/.test(input.letter.trim())
    ? input.letter.trim().toUpperCase()
    : null;

  const zodiac =
    typeof input.zodiac === 'string' && input.zodiac.trim()
      ? input.zodiac.trim().toUpperCase()
      : null;

  const superNumber =
    input.superNumber === null || input.superNumber === undefined
      ? null
      : String(input.superNumber).replace(/\D/g, '').slice(0, 2) || null;

  return {
    cannotRead: Boolean(input.cannotRead),
    lotterySlug: typeof input.lotterySlug === 'string' ? input.lotterySlug.trim().toLowerCase() : null,
    lotteryName: typeof input.lotteryName === 'string' ? input.lotteryName.trim() : null,
    drawNo: input.drawNo === null || input.drawNo === undefined ? null : String(input.drawNo).replace(/\D/g, ''),
    date: typeof input.date === 'string' ? input.date.trim() : null,
    letter,
    zodiac,
    superNumber,
    numbers,
    confidence: typeof input.confidence === 'string' ? input.confidence : 'medium',
    rawText: typeof input.rawText === 'string' ? input.rawText.slice(0, 400) : '',
    reasoning: typeof input.reasoning === 'string' ? input.reasoning.slice(0, 400) : ''
  };
}


/* ------------------------------------------------------------------ */
/* Persistent storage (disclaimer audit trail + imported results)       */
/* ------------------------------------------------------------------ */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DISCLAIMER_FILE = path.join(DATA_DIR, 'disclaimer-records.json');
const RESULTS_CACHE_FILE = path.join(DATA_DIR, 'lotteries-cache.json');
const RESULTS_META_FILE = path.join(DATA_DIR, 'results-meta.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create the data directory:', err);
  }
}

function readJsonFile(file: string, fallback: any): any {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn('Could not read', file, err);
  }
  return fallback;
}

function writeJsonFile(file: string, value: any): boolean {
  try {
    ensureDataDir();
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    return true;
  } catch (err) {
    console.warn('Could not write', file, err);
    return false;
  }
}

class DisclaimerDb {
  private records: any[] = [];

  constructor() {
    const loaded = readJsonFile(DISCLAIMER_FILE, []);
    this.records = Array.isArray(loaded) ? loaded : [];
  }

  append(record: any) {
    this.records.push(record);
    writeJsonFile(DISCLAIMER_FILE, this.records);
    return record;
  }

  all() {
    return this.records;
  }

  count() {
    return this.records.length;
  }
}

const disclaimerDb = new DisclaimerDb();
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

function isAdmin(req: express.Request): boolean {
  const provided = String((req.query as any).key || req.headers['x-admin-key'] || '');
  return provided.length > 0 && provided === ADMIN_KEY;
}

/* ------------------------------------------------------------------ */
/* Results store: bundled data + imported/cached fresh draws            */
/* ------------------------------------------------------------------ */

let rawData: any = { lotteries: [] };

function normaliseDraw(input: any): any | null {
  if (!input || typeof input !== 'object') return null;
  const drawNo = String(input.drawNo ?? input.draw ?? '').replace(/\D/g, '');
  const numbers = Array.isArray(input.numbers)
    ? input.numbers.map((n: any) => String(n).replace(/\D/g, '')).filter(Boolean)
    : String(input.numbers || '').match(/\d+/g) || [];
  if (!drawNo || numbers.length === 0) return null;
  return {
    drawNo,
    date: String(input.date || '').slice(0, 40),
    dateText: input.dateText ? String(input.dateText).slice(0, 80) : undefined,
    letter: input.letter ? String(input.letter).trim().toUpperCase().slice(0, 1) : null,
    zodiac: input.zodiac ? String(input.zodiac).trim().toUpperCase().slice(0, 20) : null,
    superNumber:
      input.superNumber === null || input.superNumber === undefined || input.superNumber === ''
        ? null
        : String(input.superNumber).replace(/\D/g, '').slice(0, 2) || null,
    numbers,
    jackpotAmount: typeof input.jackpotAmount === 'number' ? input.jackpotAmount : null
  };
}

const resultsState = {
  meta: readJsonFile(RESULTS_META_FILE, {
    lastRefreshAt: null,
    lastRefreshSource: null,
    lastRefreshError: null
  }) as { lastRefreshAt: string | null; lastRefreshSource: string | null; lastRefreshError: string | null },

  sources(): string[] {
    return String(process.env.RESULT_SOURCES || '')
      .split(/[,\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  },

  persistMeta(): void {
    writeJsonFile(RESULTS_META_FILE, this.meta);
  },

  /** Merge a list of {slug, draws} objects into the in-memory dataset. */
  merge(remoteLotteries: any[]): { addedDraws: number; lotteries: number } {
    let addedDraws = 0;
    let touched = 0;

    for (const remote of remoteLotteries || []) {
      const slug = String(remote?.slug || '').trim();
      if (!slug || !Array.isArray(remote?.draws)) continue;

      const local = (rawData.lotteries || []).find((l: any) => l.slug === slug);
      if (!local) continue;

      const known = new Set((local.draws || []).map((d: any) => String(d.drawNo).replace(/^0+/, '')));
      let localAdded = 0;

      for (const candidate of remote.draws) {
        const draw = normaliseDraw(candidate);
        if (!draw) continue;
        const key = draw.drawNo.replace(/^0+/, '');
        if (known.has(key)) continue;
        known.add(key);
        local.draws.push(draw);
        localAdded += 1;
      }

      if (localAdded > 0) {
        local.draws.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
        local.draws.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
        addedDraws += localAdded;
        touched += 1;
      }
    }

    if (addedDraws > 0) {
      writeJsonFile(RESULTS_CACHE_FILE, { mergedAt: new Date().toISOString(), lotteries: rawData.lotteries });
    }
    return { addedDraws, lotteries: touched };
  },

  importPayload(payload: any) {
    const lotteries = Array.isArray(payload?.lotteries)
      ? payload.lotteries
      : Array.isArray(payload)
      ? payload
      : payload?.slug
      ? [payload]
      : null;

    if (!lotteries) {
      return { ok: false, error: 'Expected {"lotteries":[{"slug":"govisetha","draws":[...]}]}.' };
    }

    const { addedDraws, lotteries: touched } = this.merge(lotteries);
    const totalDraws = (rawData.lotteries || []).reduce((sum: number, l: any) => sum + (l.draws?.length || 0), 0);

    this.meta.lastRefreshAt = new Date().toISOString();
    this.meta.lastRefreshError = null;
    this.persistMeta();

    return { ok: true, addedDraws, lotteries: touched, draws: totalDraws };
  },

  async refreshFromSources() {
    const sources = this.sources();
    this.meta.lastRefreshSource = sources.join(', ') || null;

    if (sources.length === 0) {
      this.meta.lastRefreshError =
        'No RESULT_SOURCES configured. The official NLB / DLB pages block automated scraping, so export the results as JSON and use Import instead.';
      this.persistMeta();
      return { ok: false, error: this.meta.lastRefreshError, addedDraws: 0, sources };
    }

    let addedDraws = 0;
    let lastError: string | null = null;

    for (const source of sources) {
      try {
        const response = await fetch(source, { headers: { 'User-Agent': 'lk-lottery-master' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const result = this.importPayload(payload);
        if (result.ok) {
          addedDraws += result.addedDraws || 0;
        } else {
          lastError = result.error || 'import failed';
        }
      } catch (err: any) {
        lastError = `${source}: ${err?.message || err}`;
      }
    }

    this.meta.lastRefreshAt = new Date().toISOString();
    this.meta.lastRefreshError = lastError;
    this.persistMeta();

    return { ok: !lastError || addedDraws > 0, addedDraws, sources, error: lastError };
  },

  summary() {
    const lotteries = rawData.lotteries || [];
    const draws = lotteries.reduce((sum: number, l: any) => sum + (l.draws?.length || 0), 0);
    const newest = lotteries
      .flatMap((l: any) => (l.draws || []).map((d: any) => ({ slug: l.slug, drawNo: d.drawNo, date: d.date })))
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))[0] || null;

    return {
      lotteries: lotteries.length,
      draws,
      newestDraw: newest,
      lastRefreshAt: this.meta.lastRefreshAt,
      lastRefreshSource: this.meta.lastRefreshSource,
      lastRefreshError: this.meta.lastRefreshError,
      sources: this.sources(),
      adminKeyConfigured: ADMIN_KEY !== 'admin123',
      storagePath: DATA_DIR
    };
  }
};

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Load the official results dataset (used by the client bundle as well).
  // `rawData` is module scoped so the results store can merge fresh draws in.
  try {
    // Works from the TS sources, from dist/server.cjs and from a custom cwd.
    const candidates = [
      path.join(baseDir, 'src', 'data', 'rawLotteriesData.json'),
      path.join(baseDir, '..', 'src', 'data', 'rawLotteriesData.json'),
      path.join(process.cwd(), 'src', 'data', 'rawLotteriesData.json')
    ];
    const rawPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (rawPath) {
      rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    } else {
      console.warn('rawLotteriesData.json not found — /api/lotteries will be empty.');
    }
  } catch (err) {
    console.warn('Could not read rawLotteriesData.json', err);
  }

  // Merge anything that was imported/cached on a previous run.
  try {
    const cached = readJsonFile(RESULTS_CACHE_FILE, null);
    if (cached?.lotteries && resultsState.meta.lastRefreshAt) {
      rawData = { ...rawData, lotteries: cached.lotteries };
      console.log(`Results cache loaded (${resultsState.summary().draws} draws).`);
    }
  } catch (err) {
    console.warn('Could not load the results cache', err);
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      lotteries: rawData.lotteries?.length || 0,
      configuredKeys: keyPool.length,
      hasKeys: keyPool.length > 0,
      activeModel: MODELS[0] || null,
      models: MODELS,
      keys: keyStatusSnapshot()
    });
  });

  app.get('/api/lotteries', (_req, res) => {
    res.json({
      scrapedAt: rawData.scrapedAt,
      lotteries: rawData.lotteries || [],
      results: resultsState.summary(),
      disclaimerRecords: disclaimerDb.count()
    });
  });

  /* ------------------------------------------------------------------ */
  /* Disclaimer acceptance records (admin audit trail)                   */
  /* ------------------------------------------------------------------ */

  app.post('/api/disclaimer/accept', (req, res) => {
    try {
      const payload = req.body || {};
      const record = {
        id: typeof payload.id === 'string' ? payload.id : `disc_${Date.now()}`,
        acceptedAt: typeof payload.acceptedAt === 'string' ? payload.acceptedAt : new Date().toISOString(),
        version: typeof payload.version === 'string' ? payload.version : 'unknown',
        language: typeof payload.language === 'string' ? payload.language : 'en',
        device: String(payload.device || '').slice(0, 60),
        platform: String(payload.platform || '').slice(0, 60),
        screen: String(payload.screen || '').slice(0, 40),
        timezone: String(payload.timezone || '').slice(0, 60),
        userName: String(payload.userName || '').slice(0, 120),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 400),
        appUrl: String(payload.appUrl || '').slice(0, 300),
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
      };

      const saved = disclaimerDb.append(record);
      res.json({ ok: true, record: saved, total: disclaimerDb.count() });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error?.message || 'Could not record the acceptance.' });
    }
  });

  app.get('/api/admin/disclaimer-records', (req, res) => {
    if (!isAdmin(req)) {
      res.status(401).json({ error: 'Invalid admin key.' });
      return;
    }
    const records = disclaimerDb.all();
    res.json({ count: records.length, records: records.slice().reverse() });
  });

  /* ------------------------------------------------------------------ */
  /* Results data (import / refresh / status)                            */
  /* ------------------------------------------------------------------ */

  app.get('/api/results-status', (_req, res) => {
    res.json(resultsState.summary());
  });

  app.post('/api/results/import', (req, res) => {
    if (!isAdmin(req)) {
      res.status(401).json({ ok: false, error: 'Invalid admin key.' });
      return;
    }
    const result = resultsState.importPayload(req.body);
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/refresh', async (req, res) => {
    if (!isAdmin(req)) {
      res.status(401).json({ ok: false, error: 'Invalid admin key.' });
      return;
    }
    const result = await resultsState.refreshFromSources();
    res.status(result.ok ? 200 : 502).json(result);
  });

  app.post('/api/scan', async (req, res) => {
    const attemptLog: string[] = [];

    try {
      const { image, mimeType } = req.body || {};
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Image data is required.', attemptLog });
      }

      if (keyPool.length === 0) {
        return res.status(503).json({
          error:
            'No Gemini API key is configured. Add GEMINI_API_KEY and GEMINI_API_KEY_1..5 to your .env file, then restart the server.',
          needsSetup: true,
          attemptLog: ['no keys configured']
        });
      }

      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      const cleanMime = typeof mimeType === 'string' && mimeType ? mimeType : 'image/jpeg';

      const keys = availableKeys();
      if (keys.length === 0) {
        return res.status(429).json({
          error: 'All configured API keys are cooling down after hitting their rate limits. Please retry shortly.',
          attemptLog: keyStatusSnapshot().map((k) => `${k.label}: cooling ${Math.round(k.coolingForMs / 1000)}s`)
        });
      }

      let lastError: any = null;
      let attempts = 0;
      const maxAttempts = Math.min(6, Math.max(2, keyPool.length));

      outer: for (const entry of keys) {
        for (const model of MODELS) {
          if (attempts >= maxAttempts) break outer;
          attempts += 1;

          const startedAt = Date.now();
          attemptLog.push(`${entry.label} → ${model}`);

          try {
            const ai = new GoogleGenAI({
              apiKey: entry.key,
              httpOptions: { headers: { 'User-Agent': 'lk-lottery-master' } }
            });

            const response = await ai.models.generateContent({
              model,
              contents: [
                {
                  role: 'user',
                  parts: [
                    { inlineData: { data: base64Data, mimeType: cleanMime } },
                    { text: TICKET_SCAN_PROMPT }
                  ]
                }
              ],
              config: { responseMimeType: 'application/json', temperature: 0 }
            });

            const text = response.text || '{}';
            let parsed: any = null;
            try {
              parsed = JSON.parse(text);
            } catch {
              const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
              parsed = JSON.parse(cleaned);
            }

            const result = sanitiseAiResult(parsed);
            if (!result) throw new Error('AI returned an unusable response.');

            if (result.cannotRead || result.numbers.length === 0) {
              // A refusal is a valid outcome, not a key failure.
              rewardKey(entry);
              attemptLog.push(`read refused after ${Date.now() - startedAt}ms`);
              return res.json({
                cannotRead: true,
                message:
                  'Cannot Read — the ticket image is damaged, blurry or the numbers are not legible. Try another clear photo, or check the ticket manually.',
                attemptLog
              });
            }

            rewardKey(entry);
            attemptLog.push(`ok in ${Date.now() - startedAt}ms`);
            return res.json({ cannotRead: false, scanResult: result, attemptLog });
          } catch (error: any) {
            lastError = error;
            const kind = classifyError(error);
            const message = String(error?.message || error);

            if (kind === 'content') {
              attemptLog.push('blocked by content policy');
              return res.status(422).json({
                cannotRead: true,
                message: 'The AI refused to analyse this image. Please try another photo.',
                attemptLog
              });
            }

            if (kind === 'model') {
              attemptLog.push(`${model} unavailable — trying the next model`);
              continue;
            }

            // Everything that is not a model problem is about THIS key, so
            // stop trying other models with it and rotate straight away.
            penaliseKey(entry, kind, message);
            attemptLog.push(
              kind === 'rate-limit'
                ? `${entry.label} hit its limit — rotating to the next key`
                : `${entry.label} failed (${kind}) — rotating`
            );
            break;
          }
        }
      }

      console.error('All scan attempts failed:', lastError);
      return res.status(502).json({
        error: lastError?.message || 'All API keys and models failed for this request.',
        attemptLog
      });
    } catch (error: any) {
      console.error('Scan error in /api/scan:', error);
      return res.status(500).json({ error: error?.message || 'Unexpected error.', attemptLog });
    }
  });

  app.post('/api/predict', async (req, res) => {
    try {
      const { slug, history } = req.body || {};
      const keys = availableKeys();

      if (keys.length === 0) {
        return res.status(503).json({ error: 'No Gemini API key configured.' });
      }

      const prompt = `Analyse recent Sri Lankan lottery draw history for "${slug}":
${JSON.stringify((history || []).slice(0, 20))}

Return STRICT JSON:
{
  "recommendedNumbers": ["12", "27", "43", "61"],
  "recommendedLetter": "B",
  "recommendedZodiac": null,
  "hotNumbers": ["27", "43"],
  "coldNumbers": ["09", "70"],
  "confidence": "82%",
  "analysisSi": "…",
  "analysisEn": "…"
}
Be explicit that this is statistical entertainment, not a guarantee.`;

      let lastError: any = null;
      for (const entry of keys) {
        try {
          const ai = new GoogleGenAI({ apiKey: entry.key });
          const response = await ai.models.generateContent({
            model: MODELS[0],
            contents: prompt,
            config: { responseMimeType: 'application/json', temperature: 0.6 }
          });
          rewardKey(entry);
          return res.json(JSON.parse(response.text || '{}'));
        } catch (error: any) {
          lastError = error;
          penaliseKey(entry, classifyError(error), String(error?.message || error));
        }
      }

      return res.status(502).json({ error: lastError?.message || 'All API keys failed.' });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message });
    }
  });

  /* ---------------- Front end ---------------- */
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  /* ---------------- HTTPS (required for the camera on phones) ---------------- */
  const certDir = process.env.CERT_DIR || path.join(process.cwd(), 'certs');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  const wantsHttps = process.env.HTTPS === '1' || process.env.HTTPS === 'true';
  const hasCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);

  const listener = (protocol: string, feature: string) =>
    console.log(
      `LK Lottery Master running on ${protocol}://localhost:${PORT} (${feature})\n` +
        `  → open it on your phone from the same Wi-Fi using the machine's LAN IP.`
    );

  if (wantsHttps && hasCerts) {
    const server = https.createServer(
      { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
      app
    );
    server.listen(PORT, '0.0.0.0', () => listener('https', 'camera enabled, self-signed certificate'));
  } else {
    const server = http.createServer(app);
    server.listen(PORT, '0.0.0.0', () => {
      listener('http', 'QR camera needs https or localhost');
      if (wantsHttps && !hasCerts) {
        console.warn('  ! HTTPS was requested but certs/key.pem + certs/cert.pem were not found.');
        console.warn('  ! Run `npm run cert` to generate a self-signed certificate.');
      } else {
        console.warn('  ! On phones, browsers block the camera over plain http:// — run `npm run dev:https`.');
      }
    });
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
