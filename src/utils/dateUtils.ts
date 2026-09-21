/**
 * Date normalisation helpers.
 *
 * Scanned tickets, official result feeds and AI readers all express dates
 * differently ("2026-09-19", "19/09/2026", "19092026", "2026-Sep-19",
 * "Saturday September 19, 2026", epoch millis ...). Everything is normalised
 * to a single canonical `YYYY-MM-DD` key so comparisons are unambiguous.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

const WEEKDAYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sun', 'mon', 'tue', 'tues', 'wed', 'thu', 'thur', 'thurs', 'fri', 'sat'
];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
}

export function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIso(year: number, month: number, day: number): string | null {
  if (!isValidYmd(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Normalise a 2 digit year to a 4 digit year (lottery data range). */
function expandYear(y: number): number {
  if (y >= 100) return y;
  return 2000 + y;
}

/**
 * Normalises almost any date representation into `YYYY-MM-DD`.
 * Returns `null` when the value is not a believable lottery-era date,
 * so callers can safely use it to *reject* false positives.
 */
export function toIsoDate(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;

  if (typeof input === 'number' && Number.isFinite(input)) {
    const ms = input > 1e11 ? input : input * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  let raw = String(input).trim();
  if (!raw) return null;

  // Drop weekday names and any time component.
  raw = raw.replace(/\bT\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?\b/g, ' ');
  raw = raw.replace(/\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b/gi, ' ');
  raw = raw.replace(/\b(am|pm)\b/gi, ' ');

  const lowered = raw.toLowerCase();
  const withoutWeekdays = lowered
    .split(/[\s,]+/)
    .filter((tok) => tok && !WEEKDAYS.includes(tok.replace(/[^a-z]/g, '')))
    .join(' ')
    .trim();
  if (withoutWeekdays) raw = withoutWeekdays;

  const cleaned = raw.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

  // Epoch timestamps that arrived as strings
  if (/^\d{13}$/.test(cleaned)) return toIsoDate(Number(cleaned));
  if (/^\d{10}$/.test(cleaned)) return toIsoDate(Number(cleaned));

  // "2026-09-19" / "2026/09/19" / "2026.09.19"
  let m = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));

  // "19-09-2026" / "19/09/2026" / "19.09.2026"
  m = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return toIso(Number(m[3]), Number(m[2]), Number(m[1]));

  // "19-09-26" / "19/09/26" (ambiguous, assume day first)
  m = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (m) return toIso(expandYear(Number(m[3])), Number(m[2]), Number(m[1]));

  // Compact 8 digit "20260919" (year first) or "19092026" (year last)
  if (/^\d{8}$/.test(cleaned)) {
    const a = toIso(Number(cleaned.slice(0, 4)), Number(cleaned.slice(4, 6)), Number(cleaned.slice(6, 8)));
    if (a) return a;
    const b = toIso(Number(cleaned.slice(4, 8)), Number(cleaned.slice(2, 4)), Number(cleaned.slice(0, 2)));
    if (b) return b;
    return null;
  }

  // "2026-Sep-19" / "19-Sep-2026" / "Sep 19 2026" / "19 September 2026"
  const monthName = Object.keys(MONTHS).find((name) =>
    new RegExp(`(^|[^a-z])${name}([^a-z]|$)`, 'i').test(cleaned)
  );
  if (monthName) {
    const month = MONTHS[monthName];
    const numbers = cleaned.match(/\d+/g) || [];
    if (numbers.length >= 2) {
      let day: number | null = null;
      let year: number | null = null;
      for (const token of numbers) {
        const value = Number(token);
        if (token.length === 4 || value > 31) year = value;
        else if (day === null) day = value;
      }
      // Handle "2026 Sep 19" where the year comes first
      if (year !== null && day === null && numbers.length >= 2) day = Number(numbers[1]);
      if (year !== null && day !== null) return toIso(expandYear(year), month, day);
    }
    // "Sep 19" without a year — not enough to identify a draw safely
  }

  return null;
}

/** Normalise an official draw number so "0890" and "890" are equal. */
export function normaliseDrawNo(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  const stripped = digits.replace(/^0+/, '');
  return stripped === '' ? '0' : stripped;
}

/** Reject day-first/month-first ambiguity by checking both interpretations. */
export function isoDateVariants(year: number, a: number, b: number): string[] {
  const first = toIso(year, b, a); // treat a as day
  const second = toIso(year, a, b); // treat b as day
  return [first, second].filter((x): x is string => Boolean(x));
}
