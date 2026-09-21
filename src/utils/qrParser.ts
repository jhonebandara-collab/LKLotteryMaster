import { ALL_LOTTERIES, ZODIAC_SIGNS } from '../data/lotteriesData';
import { toIsoDate } from './dateUtils';

/**
 * Sri Lankan lottery ticket QR parser.
 *
 * Design rules (learned the hard way):
 *  1. NEVER invent ticket data. If a field cannot be read, it stays empty and
 *     the caller must ask the user instead of guessing.
 *  2. The date printed on a ticket is a *soft* signal. It is reported, but it
 *     must never be the primary key used to pick an official draw record
 *     (this is what used to break Govisetha matching).
 *  3. Barcodes glue several balls together ("03323662"), some lotteries use
 *     1-digit balls (Mahajana Sampatha, NLB Jaya, Supiri Dhana Sampatha,
 *     Ada Sampatha) and some use 2-digit balls. The parser therefore returns
 *     the raw digit runs *and* a default interpretation, so the draw resolver
 *     can pick the split that matches the lottery's official format.
 */

export type QrDecodedForm = 'json' | 'url' | 'keyvalue' | 'delimited' | 'text' | 'empty';

export interface ParsedTicketQR {
  success: boolean;
  rawPayload: string;
  decodedForm: QrDecodedForm;

  lotterySlug?: string;
  lotteryName?: string;
  provider?: 'NLB' | 'DLB';

  /** Best-effort printed draw number (digits only, leading zeros kept). */
  drawNo?: string;
  /** Every plausible draw-number token found, in reading order. */
  drawNoCandidates: string[];

  /** ISO (YYYY-MM-DD) date printed on the ticket, when one was found. */
  date?: string;

  letter?: string | null;
  secondLetter?: string | null;
  zodiac?: string | null;
  superNumber?: string | null;

  /** Digit runs that may be ball numbers, in reading order. */
  numberRuns: string[];
  /** Digit runs consumed as date / serial / price — never ball numbers. */
  ignoredRuns: string[];
  /** Long numeric runs that look like a ticket serial / barcode payload. */
  serials: string[];
  /**
   * Runs that were used as the printed date but could equally be glued ball
   * numbers (e.g. "20260919" = balls 20-26-09-19). The resolver tries them as
   * balls when the primary reading does not fit the lottery's format.
   */
  ambiguousRuns: string[];

  /** Default 2-digit interpretation of `numberRuns` (needs lottery context). */
  numbers: string[];

  subGameIndex?: number;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
  warnings: string[];
  /** All raw tokens, kept for the in-app QR inspector. */
  tokens: string[];
}

export interface AiScanPayload {
  lotterySlug?: string;
  lotteryName?: string;
  drawNo?: string | null;
  date?: string | null;
  letter?: string | null;
  zodiac?: string | null;
  superNumber?: string | null;
  numbers: string[];
  confidence?: string;
  rawText?: string | null;
}

/* ------------------------------------------------------------------ */
/* Slug / keyword maps                                                 */
/* ------------------------------------------------------------------ */

/**
 * Keywords ordered longest-first so "NLBJAYA" wins over "JAYA" and
 * "JAYASAMPATHA" wins over "JAYA".
 */
const SLUG_KEYWORDS: { keyword: string; slug: string }[] = [
  // DLB
  { keyword: 'SUPIRIDHANASAMPATHA', slug: 'supiri-dhana-sampatha' },
  { keyword: 'SUPIRIDHANA', slug: 'supiri-dhana-sampatha' },
  { keyword: 'SUPIRI', slug: 'supiri-dhana-sampatha' },
  { keyword: 'LAGNAWASANA', slug: 'lagna-wasana' },
  { keyword: 'LAGNA', slug: 'lagna-wasana' },
  { keyword: 'ADAKOTIPATHI', slug: 'ada-kotipathi' },
  { keyword: 'KOTIPATHI', slug: 'ada-kotipathi' },
  { keyword: 'JAYASAMPATHA', slug: 'jaya-sampatha' },
  { keyword: 'SUPERBALL', slug: 'super-ball' },
  { keyword: 'SHANIDA', slug: 'shanida' },
  { keyword: 'KAPRUKA', slug: 'kapruka' },
  { keyword: 'SASIRI', slug: 'sasiri' },
  { keyword: 'WAASI', slug: 'waasi' },
  { keyword: 'WASI', slug: 'waasi' },
  // NLB
  { keyword: 'MAHAJANASAMPATHA', slug: 'mahajana-sampatha' },
  { keyword: 'MAHAJANA', slug: 'mahajana-sampatha' },
  { keyword: 'DHANANIDHANAYA', slug: 'dhana-nidhanaya' },
  { keyword: 'DHANANIDHANA', slug: 'dhana-nidhanaya' },
  { keyword: 'GOVISETHA', slug: 'govisetha' },
  { keyword: 'MEGAPOWER', slug: 'mega-power' },
  { keyword: 'HANDAHANA', slug: 'handahana' },
  { keyword: 'ADASAMPATHA', slug: 'ada-sampatha' },
  { keyword: 'SUBADAWASAK', slug: 'suba-dawasak' },
  { keyword: 'NLBJAYA', slug: 'nlb-jaya' },
  { keyword: 'GOVI', slug: 'govisetha' },
  { keyword: 'MEGA', slug: 'mega-power' },
  { keyword: 'SUBA', slug: 'suba-dawasak' },
  { keyword: 'DHANA', slug: 'dhana-nidhanaya' },
  { keyword: 'MAHAJANA', slug: 'mahajana-sampatha' },
  { keyword: 'HANDA', slug: 'handahana' },
  // Short codes — only honoured as standalone tokens
  { keyword: 'GS', slug: 'govisetha' },
  { keyword: 'MS', slug: 'mahajana-sampatha' },
  { keyword: 'MP', slug: 'mega-power' },
  { keyword: 'DN', slug: 'dhana-nidhanaya' },
  { keyword: 'HD', slug: 'handahana' },
  { keyword: 'AS', slug: 'ada-sampatha' },
  { keyword: 'NJ', slug: 'nlb-jaya' },
  { keyword: 'SD', slug: 'suba-dawasak' },
  { keyword: 'AK', slug: 'ada-kotipathi' },
  { keyword: 'SH', slug: 'shanida' },
  { keyword: 'LW', slug: 'lagna-wasana' },
  { keyword: 'SDS', slug: 'supiri-dhana-sampatha' },
  { keyword: 'SB', slug: 'super-ball' },
  { keyword: 'KP', slug: 'kapruka' },
  { keyword: 'SR', slug: 'sasiri' },
  { keyword: 'JS', slug: 'jaya-sampatha' },
  { keyword: 'WS', slug: 'waasi' }
].sort((a, b) => b.keyword.length - a.keyword.length);

/** Keys we recognise in JSON payloads, URLs and key/value strings. */
const KEY_ALIASES = {
  slug: ['slug', 'lottery', 'lotteryname', 'lotteryslug', 'game', 'gamename', 'code', 'product', 'name', 'lotto'],
  drawNo: ['drawno', 'draw', 'drawnumber', 'drawid', 'd', 'no', 'num', 'serial', 'drawno.', 'wl'],
  date: ['date', 'drawdate', 'dt', 'drawn', 'drawon', 'd'],
  letter: ['letter', 'l', 'ltr', 'engletter', 'englishletter', 'alphabet'],
  secondLetter: ['letter2', 'secondletter', 'specialletter', 'l2', 'extraletter'],
  zodiac: ['zodiac', 'z', 'sign', 'rashiya', 'lagna'],
  superNumber: ['super', 'supernumber', 'sn', 'superno', 's'],
  numbers: ['numbers', 'nums', 'n', 'balls', 'ballnumbers', 'winningnumbers', 'ticketnumbers', 'combination', 'result'],
  subGame: ['subgame', 'subgameindex', 'gameindex', 'set', 'part']
};

const ZODIAC_UPPER = ZODIAC_SIGNS.map((z) => z.toUpperCase());

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function digitsOnly(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function firstDefined(obj: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === alias) {
        const value = obj[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
    }
  }
  return undefined;
}

function asNumberList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : Number.isFinite(Number(v)) ? String(v) : ''))
      .map((v) => v.trim())
      .filter((v) => v !== '' && /^\d+$/.test(v));
  }
  const text = String(value);
  if (/^\d+$/.test(text) && text.length > 2 && text.length % 2 === 0) {
    // glued digits such as "03323662"
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += 2) chunks.push(text.slice(i, i + 2));
    return chunks;
  }
  return (text.match(/\d+/g) || []).filter(Boolean);
}

function tryBase64Decode(text: string): string | null {
  const compact = text.replace(/\s+/g, '');
  if (compact.length < 16 || compact.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(compact)) return null;
  // Avoid treating a plain numeric string as base64.
  if (/^\d+$/.test(compact)) return null;
  try {
    const decoded = typeof atob === 'function'
      ? atob(compact)
      : Buffer.from(compact, 'base64').toString('binary');
    const printable = decoded.replace(/[^\x20-\x7E\r\n\t]/g, '');
    if (printable.length < 6) return null;
    if ((printable.match(/\d/g) || []).length < 4) return null;
    if (printable.length / decoded.length < 0.9) return null;
    return printable;
  } catch {
    return null;
  }
}

function resolveSlugFromKeyword(token: string): string | undefined {
  const clean = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return undefined;

  for (const { keyword, slug } of SLUG_KEYWORDS) {
    // Short codes must match the whole token; long keywords may be embedded.
    if (keyword.length <= 3) {
      if (clean === keyword) return slug;
    } else if (clean === keyword) {
      return slug;
    }
  }
  // Second pass: embedded long keywords (e.g. "SS/GO/4557/...").
  for (const { keyword, slug } of SLUG_KEYWORDS) {
    if (keyword.length >= 4 && clean.includes(keyword)) return slug;
  }
  return undefined;
}

function resolveSlugFromName(name: string): string | undefined {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return undefined;
  const byName = ALL_LOTTERIES.find(
    (l) => l.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean
  );
  if (byName) return byName.slug;
  const bySlug = ALL_LOTTERIES.find((l) => l.slug.replace(/-/g, '') === clean);
  return bySlug?.slug;
}

/* ------------------------------------------------------------------ */
/* Main parser                                                         */
/* ------------------------------------------------------------------ */

function emptyResult(raw: string, decodedForm: QrDecodedForm, error?: string): ParsedTicketQR {
  return {
    success: false,
    rawPayload: raw,
    decodedForm,
    numbers: [],
    numberRuns: [],
    ignoredRuns: [],
    serials: [],
    ambiguousRuns: [],
    drawNoCandidates: [],
    confidence: 'low',
    error,
    warnings: [],
    tokens: []
  };
}

export function parseLotteryQR(raw: string): ParsedTicketQR {
  const original = (raw || '').trim();
  if (!original) return emptyResult('', 'empty', 'Empty QR code');

  // ---------------------------------------------------------------
  // 1. JSON payload
  // ---------------------------------------------------------------
  if (
    (original.startsWith('{') && original.endsWith('}')) ||
    (original.startsWith('[') && original.endsWith(']'))
  ) {
    const fromJson = parseJsonPayload(original);
    if (fromJson) return fromJson;
  }

  // ---------------------------------------------------------------
  // 2. URL payload
  // ---------------------------------------------------------------
  if (/^https?:\/\//i.test(original)) {
    const fromUrl = parseUrlPayload(original);
    if (fromUrl) return fromUrl;
  }

  // ---------------------------------------------------------------
  // 3. Base64 wrapped payload
  // ---------------------------------------------------------------
  const decodedBase64 = tryBase64Decode(original);
  if (decodedBase64 && /[A-Za-z]/.test(decodedBase64) && /\d{3,}/.test(decodedBase64)) {
    const nested = parseDelimited(decodedBase64, 'text');
    if (nested.success && nested.lotterySlug) {
      nested.rawPayload = original;
      nested.warnings.push('Base64 payload decoded before parsing.');
      return nested;
    }
  }

  // ---------------------------------------------------------------
  // 4. Delimited / free text payload (the common ticket format)
  // ---------------------------------------------------------------
  const form: QrDecodedForm = /[=|&]/.test(original) && /[A-Za-z]{2,}\s*[=|:]/.test(original)
    ? 'keyvalue'
    : 'delimited';
  return parseDelimited(original, form);
}

/* ------------------------------------------------------------------ */
/* Structured payloads                                                 */
/* ------------------------------------------------------------------ */

function parseJsonPayload(text: string): ParsedTicketQR | null {
  let obj: Record<string, unknown> | null = null;
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) obj = { numbers: json } as Record<string, unknown>;
    else if (json && typeof json === 'object') obj = json as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!obj) return null;

  // Flatten one level so {data:{...}} and {ticket:{...}} work too.
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(merged, value as Record<string, unknown>);
    } else {
      merged[key] = value;
    }
  }
  return buildFromFields(merged, text, 'json');
}

function parseUrlPayload(text: string): ParsedTicketQR | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  const fields: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    fields[key] = value;
  });

  // Some tickets put the payload in the path, e.g. /verify/GS/4557/W/03323662
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    const fromPath = parseDelimited(pathParts.join('/'), 'delimited');
    if (fromPath.success) {
      // Query parameters win over path segments.
      const merged = buildFromFields(fields, text, 'url', fromPath);
      return merged;
    }
  }

  const built = buildFromFields(fields, text, 'url');
  if (built.success) return built;
  return null;
}

function parseDelimited(text: string, form: QrDecodedForm): ParsedTicketQR {
  const fields: Record<string, unknown> = {};

  // key=value / key:value pairs
  const pairRegex = /([A-Za-z][A-Za-z0-9_.\s]{1,20})\s*[=:]\s*([^\s|&;/]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(text)) !== null) {
    const key = match[1].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key && !(key in fields)) fields[key] = match[2].trim();
  }

  return buildFromFields(fields, text, form);
}

function buildFromFields(
  fields: Record<string, unknown>,
  rawText: string,
  form: QrDecodedForm,
  seed?: ParsedTicketQR
): ParsedTicketQR {
  const result: ParsedTicketQR = seed
    ? { ...seed, rawPayload: rawText, decodedForm: form }
    : {
        ...emptyResult(rawText, form),
        numberRuns: [],
        ignoredRuns: [],
        serials: [],
        ambiguousRuns: [],
        drawNoCandidates: []
      };

  const warnings = new Set<string>(result.warnings || []);
  const runsFromFields = result.numberRuns.length;

  /* ---------------- lottery name ---------------- */
  const rawSlug = firstDefined(fields, KEY_ALIASES.slug);
  if (rawSlug !== undefined) {
    const slug = resolveSlugFromKeyword(String(rawSlug)) || resolveSlugFromName(String(rawSlug));
    if (slug) {
      const lot = ALL_LOTTERIES.find((l) => l.slug === slug);
      result.lotterySlug = slug;
      result.lotteryName = lot?.name || slug;
      result.provider = lot?.provider;
    }
  }

  /* ---------------- date ---------------- */
  const rawDate = firstDefined(fields, KEY_ALIASES.date);
  if (rawDate !== undefined) {
    const iso = toIsoDate(String(rawDate));
    if (iso) result.date = iso;
    else warnings.add(`Unrecognised date value "${rawDate}" on the ticket.`);
  }

  /* ---------------- draw number ---------------- */
  const rawDraw = firstDefined(fields, ['drawno', 'draw', 'drawnumber', 'drawid', 'wl']);
  if (rawDraw !== undefined) {
    const digits = digitsOnly(rawDraw);
    if (digits) {
      result.drawNo = digits;
      result.drawNoCandidates = [digits];
    }
  }

  /* ---------------- letter / zodiac / super ---------------- */
  const rawLetter = firstDefined(fields, KEY_ALIASES.letter);
  if (rawLetter !== undefined) {
    const letter = String(rawLetter).trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (/^[A-Z]$/.test(letter)) result.letter = letter;
  }
  const rawSecondLetter = firstDefined(fields, KEY_ALIASES.secondLetter);
  if (rawSecondLetter !== undefined) {
    const letter = String(rawSecondLetter).trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (/^[A-Z]$/.test(letter)) result.secondLetter = letter;
  }
  const rawZodiac = firstDefined(fields, KEY_ALIASES.zodiac);
  if (rawZodiac !== undefined) {
    const zodiac = String(rawZodiac).trim().toUpperCase();
    const found = ZODIAC_UPPER.find((z) => z === zodiac || z.startsWith(zodiac.slice(0, 4)));
    if (found) result.zodiac = found;
  }
  const rawSuper = firstDefined(fields, KEY_ALIASES.superNumber);
  if (rawSuper !== undefined) {
    const superDigits = digitsOnly(rawSuper);
    if (superDigits && superDigits.length <= 3) result.superNumber = superDigits;
  }

  /* ---------------- explicit numbers ---------------- */
  const rawNumbers = firstDefined(fields, KEY_ALIASES.numbers);
  if (rawNumbers !== undefined) {
    const list = asNumberList(rawNumbers);
    if (list.length > 0) {
      result.numberRuns = [...result.numberRuns, ...list];
    }
  }

  // When the payload carried structured number fields (URL query / JSON), the
  // raw-text scan must not add the same digits a second time.
  const numbersAreAuthoritative = result.numberRuns.length > runsFromFields;

  /* ---------------- token scan over the raw text ---------------- */
  const scanned = scanText(rawText, {
    hasDrawNo: result.drawNoCandidates.length > 0,
    hasDate: Boolean(result.date),
    hasSlug: Boolean(result.lotterySlug)
  });

  if (!result.lotterySlug && scanned.slug) {
    const lot = ALL_LOTTERIES.find((l) => l.slug === scanned.slug);
    result.lotterySlug = scanned.slug;
    result.lotteryName = lot?.name || scanned.slug;
    result.provider = lot?.provider;
  }
  if (!result.date && scanned.date) result.date = scanned.date;
  if (result.drawNoCandidates.length === 0 && scanned.drawNoCandidates.length > 0) {
    result.drawNo = scanned.drawNoCandidates[0];
    result.drawNoCandidates = scanned.drawNoCandidates;
  }
  if (!result.letter && scanned.letter) result.letter = scanned.letter;
  if (!result.zodiac && scanned.zodiac) result.zodiac = scanned.zodiac;

  if (!numbersAreAuthoritative) {
    result.numberRuns = [...result.numberRuns, ...scanned.numberRuns];
  } else if (result.numberRuns.length === 0) {
    result.numberRuns = scanned.numberRuns;
  }
  result.ignoredRuns = [...new Set([...result.ignoredRuns, ...scanned.ignoredRuns])];
  result.serials = [...new Set([...result.serials, ...scanned.serials])];
  result.ambiguousRuns = [...new Set([...result.ambiguousRuns, ...scanned.ambiguousRuns])];
  result.tokens = scanned.tokens;

  (scanned.warnings || []).forEach((w) => warnings.add(w));

  /* ---------------- default 2-digit interpretation ---------------- */
  result.numbers = flattenRunsToTwoDigits(result.numberRuns);

  for (const w of result.warnings) warnings.add(w);
  result.warnings = Array.from(warnings);

  /* ---------------- confidence ---------------- */
  if (result.lotterySlug && result.drawNoCandidates.length > 0 && result.numbers.length > 0) {
    result.confidence = 'high';
  } else if (result.numbers.length > 0) {
    result.confidence = 'medium';
  } else if (result.lotterySlug || result.drawNoCandidates.length > 0) {
    result.confidence = 'low';
  } else {
    result.confidence = result.date ? 'low' : 'low';
  }

  result.success = Boolean(
    (result.lotterySlug || result.drawNoCandidates.length > 0) &&
      (result.numbers.length > 0 || result.date)
  );

  if (!result.success && !result.error) {
    result.error = 'Could not recognise a Sri Lankan lottery ticket payload.';
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Free-text scanner                                                   */
/* ------------------------------------------------------------------ */

interface ScanContext {
  hasDrawNo: boolean;
  hasDate: boolean;
  hasSlug: boolean;
}

interface ScanResult {
  slug?: string;
  date?: string;
  drawNoCandidates: string[];
  numberRuns: string[];
  ignoredRuns: string[];
  serials: string[];
  ambiguousRuns: string[];
  letter?: string | null;
  zodiac?: string | null;
  tokens: string[];
  warnings: string[];
}

function scanText(input: string, context: ScanContext): ScanResult {
  const warnings: string[] = [];

  // Normalise separators so the classifier sees a consistent surface.
  let work = input
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[|;]+/g, ' ')
    .replace(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:lk|com|net|org)(?:\.[a-z]{2})?/gi, ' ')
    .trim();

  // Strip price markers (e.g. "Rs.20", "රු. 40", "PRICE 50.00")
  work = work.replace(/\b(?:rs|ru|රු|price)\s*\.?\s*\d+(?:\.\d{1,2})?\b/gi, ' ');

  const tokens = work
    .split(/[\s/,:;|#_*+()\[\]{}"'`~!?@$%^&<>=]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const ignoredRuns = new Set<string>();
  const serials = new Set<string>();
  const ambiguousRuns = new Set<string>();
  const drawNoCandidates: string[] = [];
  const numberRuns: string[] = [];

  let slug: string | undefined;
  let date: string | undefined;
  let letter: string | null = null;
  let zodiac: string | null = null;

  /* --- slug --- */
  for (const token of tokens) {
    const upper = token.toUpperCase();
    // Ignore pure zodiac words so "ARIES" never maps to a code.
    if (ZODIAC_UPPER.some((z) => z.startsWith(upper) && upper.length >= 4)) continue;
    const found = resolveSlugFromKeyword(upper);
    if (found) {
      slug = found;
      break;
    }
  }
  if (!slug) {
    for (const token of tokens) {
      if (/^[A-Za-z]{4,}$/.test(token)) {
        const found = resolveSlugFromName(token);
        if (found) {
          slug = found;
          break;
        }
      }
    }
  }

  /* --- date --- */
  // The date is removed from `runSource` so its digits are never re-read as
  // draw numbers or ball numbers (this is what used to corrupt Govisetha scans).
  let runSource = work;
  const datePatterns = [
    /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g,
    /\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/g,
    /\d{4}[-/.]?[A-Za-z]{3,9}[-/.]?\d{1,2}/g,
    /\d{1,2}[-/.]?[A-Za-z]{3,9}[-/.]?\d{4}/g,
    /[A-Za-z]{3,9}[-/. ]\d{1,2},?[-/. ]?\d{4}/g,
    /\b\d{8}\b/g
  ];
  for (const pattern of datePatterns) {
    if (date) break;
    let m: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, 'g');
    while ((m = regex.exec(work)) !== null) {
      const iso = toIsoDate(m[0]);
      if (iso) {
        const matchedText = m[0];
        date = iso;
        ignoredRuns.add(matchedText);
        runSource = runSource.split(matchedText).join(' ');
        // An 8-digit run is also a plausible "4 glued ball numbers" value,
        // e.g. 20260919 could be balls 20-26-09-19. Keep it as a fallback.
        const digits = matchedText.replace(/\D/g, '');
        if (digits.length === 8) ambiguousRuns.add(digits);
        break;
      }
    }
  }

  /* --- zodiac --- */
  for (const token of tokens) {
    const upper = token.toUpperCase().replace(/[^A-Z]/g, '');
    if (upper.length < 4) continue;
    const found = ZODIAC_UPPER.find((z) => z === upper || z.startsWith(upper) || upper.startsWith(z));
    if (found) {
      zodiac = found;
      break;
    }
  }

  /* --- numeric runs --- */
  const runRegex = /\d+/g;
  let run: RegExpExecArray | null;
  const allRuns: string[] = [];
  while ((run = runRegex.exec(runSource)) !== null) {
    allRuns.push(run[0]);
  }

  for (const value of allRuns) {
    if (ignoredRuns.has(value)) continue;

    // Long runs: serial / barcode payload, or glued ball numbers.
    if (value.length >= 6) {
      if (value.length === 8 && toIsoDate(value) === date) continue;
      if (looksLikeSerial(value)) {
        serials.add(value);
        continue;
      }
    }

    if (value.length === 1 || value.length === 2) {
      numberRuns.push(value);
      continue;
    }

    if (value.length <= 2) {
      numberRuns.push(value);
      continue;
    }

    if (value.length === 3) {
      // 3 digits: usually a draw number, but can be a 1-digit + 2-digit ball pair.
      if (!drawNoCandidates.includes(value)) drawNoCandidates.push(value);
      continue;
    }

    if (value.length <= 6) {
      // 4-6 digits: draw number candidate, or glued 2-digit balls, or both.
      if (!drawNoCandidates.includes(value)) drawNoCandidates.push(value);
      continue;
    }

    // Longer even runs with no serial characteristics: assume glued balls.
    if (value.length % 2 === 0 && value.length <= 12) {
      numberRuns.push(value);
    } else {
      serials.add(value);
    }
  }

  /* --- letter (English alphabet printed with the balls) --- */
  const ignoredKeywords = SLUG_KEYWORDS.map((k) => k.keyword);
  for (const token of tokens) {
    const bare = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!bare) continue;

    // Standalone letter, e.g. "W"
    if (/^[A-Z]$/.test(bare)) {
      if (!letter) {
        letter = bare;
        continue;
      }
    }

    // Glued letter + digits, e.g. "W0332" or "W-03"
    const glued = bare.match(/^([A-Z])(\d{2,8})$/);
    if (glued) {
      if (!letter) letter = glued[1];
      continue;
    }

    // Never let a lottery keyword be mistaken for a letter.
    if (ignoredKeywords.includes(bare)) continue;
  }

  if (!slug && !context.hasSlug) {
    warnings.push('Lottery name was not found in the QR payload.');
  }

  return {
    slug,
    date,
    drawNoCandidates,
    numberRuns,
    ignoredRuns: Array.from(ignoredRuns),
    serials: Array.from(serials),
    ambiguousRuns: Array.from(ambiguousRuns),
    letter,
    zodiac,
    tokens,
    warnings
  };
}

function looksLikeSerial(value: string): boolean {
  // Even-length short runs are almost always glued ball numbers
  // ("03323662" = 03-32-36-62), so they must not be discarded as serials.
  if (value.length >= 11) return true;
  if (value.length >= 7 && value.length % 2 === 1) return true;
  return false;
}

/** Turn digit runs into a 2-digit ball list (default interpretation). */
export function flattenRunsToTwoDigits(runs: string[]): string[] {
  const out: string[] = [];
  for (const run of runs) {
    if (run.length <= 2) {
      out.push(run.padStart(2, '0'));
      continue;
    }
    if (run.length % 2 === 0) {
      for (let i = 0; i < run.length; i += 2) out.push(run.slice(i, i + 2));
      continue;
    }
    // Odd length: "326" -> "03"?? No safe interpretation, keep raw.
    out.push(run);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* AI scan → ParsedTicketQR                                            */
/* ------------------------------------------------------------------ */

export function parsedFromAi(payload: AiScanPayload): ParsedTicketQR {
  const fields: Record<string, unknown> = {
    lottery: payload.lotterySlug || payload.lotteryName || '',
    drawNo: payload.drawNo || '',
    date: payload.date || '',
    letter: payload.letter || '',
    zodiac: payload.zodiac || '',
    super: payload.superNumber || ''
  };
  const base = buildFromFields(fields, payload.rawText || `AI_SCAN:${payload.lotterySlug || ''}`, 'json');

  const numbers = asNumberList(payload.numbers || []);
  base.numberRuns = numbers;
  base.numbers = numbers.map((n) => (n.length <= 2 ? n.padStart(2, '0') : n));
  base.confidence = (payload.confidence as ParsedTicketQR['confidence']) || 'medium';
  base.success = Boolean(base.lotterySlug || base.drawNoCandidates.length) && base.numbers.length > 0;
  if (!base.success) {
    base.error = 'AI could not read this ticket reliably.';
  }
  return base;
}

/** Pretty-print a parsed payload for the in-app QR inspector. */
export function describeParsedForDebug(parsed: ParsedTicketQR): string {
  return JSON.stringify(
    {
      form: parsed.decodedForm,
      lottery: parsed.lotterySlug || null,
      printedDrawNo: parsed.drawNo || null,
      printedDate: parsed.date || null,
      letter: parsed.letter || null,
      zodiac: parsed.zodiac || null,
      superNumber: parsed.superNumber || null,
      numberRuns: parsed.numberRuns,
      ignoredRuns: parsed.ignoredRuns,
      serials: parsed.serials,
      confidence: parsed.confidence,
      warnings: parsed.warnings
    },
    null,
    2
  );
}
