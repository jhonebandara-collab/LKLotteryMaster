import { ALL_LOTTERIES, getLotteryBySlug } from '../data/lotteriesData';
import { LotteryDraw, LotteryInfo, DrawMatchMethod, DrawResolutionStatus } from '../types/lottery';
import { ParsedTicketQR } from './qrParser';
import { normaliseDrawNo, toIsoDate } from './dateUtils';

/**
 * Binds a parsed ticket to an official draw record.
 *
 * The single most important rule here: if we cannot identify the draw with
 * certainty we return `needs-review` instead of silently falling back to the
 * newest draw. Silently falling back is what produced wrong Govisetha
 * results before (a ticket was scored against an unrelated draw).
 */
export interface TicketResolution {
  lottery?: LotteryInfo;
  lotteryCandidates: LotteryInfo[];
  numbers: string[];
  letter: string | null;
  zodiac: string | null;
  superNumber: string | null;
  draw?: LotteryDraw;
  matchedBy: DrawMatchMethod;
  status: DrawResolutionStatus;
  warnings: string[];
  /** Draws the user can pick from when the match is ambiguous. */
  candidateDraws: LotteryDraw[];
  subGameIndex?: number;
  printedDrawNo: string | null;
  printedDate: string | null;
  /** The ticket's numbers as read before format normalisation. */
  rawNumbers: string[];
}

/* ------------------------------------------------------------------ */
/* Number format normalisation                                         */
/* ------------------------------------------------------------------ */

function normaliseToken(token: string, digitWidth: number): string {
  const digits = token.replace(/\D/g, '');
  if (digitWidth <= 1) {
    const stripped = digits.replace(/^0+/, '');
    return stripped === '' ? '0' : stripped;
  }
  return digits.slice(-digitWidth).padStart(digitWidth, '0');
}

/** Split a digit run into ball tokens using the lottery's digit width. */
function splitRun(run: string, digitWidth: number): string[] {
  const digits = run.replace(/\D/g, '');
  if (!digits) return [];
  if (digits.length <= digitWidth) return [normaliseToken(digits, digitWidth)];

  if (digits.length % digitWidth === 0) {
    const out: string[] = [];
    for (let i = 0; i < digits.length; i += digitWidth) {
      out.push(normaliseToken(digits.slice(i, i + digitWidth), digitWidth));
    }
    return out;
  }

  // Not divisible — fall back to 2-digit chunks, then single digits.
  if (digits.length % 2 === 0) {
    const out: string[] = [];
    for (let i = 0; i < digits.length; i += 2) out.push(normaliseToken(digits.slice(i, i + 2), digitWidth));
    return out;
  }

  return digits.split('').map((d) => normaliseToken(d, digitWidth));
}

export function interpretRunsForLottery(runs: string[], digitWidth: number): string[] {
  const out: string[] = [];
  for (const run of runs) out.push(...splitRun(run, digitWidth));
  return out;
}

/* ------------------------------------------------------------------ */
/* Lottery inference                                                   */
/* ------------------------------------------------------------------ */

function scoreLotteryForTicket(lot: LotteryInfo, parsed: ParsedTicketQR): number {
  const digitWidth = lot.digitWidth || 2;
  const ballCount = lot.ballCount || lot.numberCount || 4;
  const nums = interpretRunsForLottery(parsed.numberRuns, digitWidth);

  let score = 0;
  if (nums.length === ballCount) score += 40;
  else if (Math.abs(nums.length - ballCount) <= 1) score += 12;
  else score -= 20;

  if (lot.hasZodiac && parsed.zodiac) score += 18;
  if (lot.hasZodiac && !parsed.zodiac) score -= 6;
  if (lot.hasLetter && parsed.letter) score += 18;
  if (lot.hasLetter && !parsed.letter) score -= 6;
  if (!lot.hasLetter && parsed.letter) score -= 2;
  if (!lot.hasZodiac && parsed.zodiac) score -= 8;

  if (lot.hasSuperNumber && parsed.superNumber) score += 10;

  // A candidate that actually matches one of this lottery's draw numbers is a
  // very strong signal.
  const known = new Set(lot.draws.map((d) => normaliseDrawNo(d.drawNo)));
  if (parsed.drawNoCandidates.some((c) => known.has(normaliseDrawNo(c)))) score += 60;
  if (parsed.drawNo && known.has(normaliseDrawNo(parsed.drawNo))) score += 30;

  // Date agreement is a soft bonus only — never a decisive signal.
  if (parsed.date && lot.draws.some((d) => toIsoDate(d.date) === parsed.date)) score += 20;

  return score;
}

/* ------------------------------------------------------------------ */
/* Main resolver                                                       */
/* ------------------------------------------------------------------ */

export function resolveTicket(parsed: ParsedTicketQR): TicketResolution {
  const warnings: string[] = [...(parsed.warnings || [])];

  /* ---------------- 1. Which lottery? ---------------- */
  let lottery: LotteryInfo | undefined;
  let lotteryCandidates: LotteryInfo[] = [];

  if (parsed.lotterySlug) {
    lottery = getLotteryBySlug(parsed.lotterySlug);
  }

  if (!lottery) {
    const scored = ALL_LOTTERIES.filter((l) => l.draws.length > 0)
      .map((l) => ({ lot: l, score: scoreLotteryForTicket(l, parsed) }))
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score >= 40) {
      const bestScore = scored[0].score;
      const tied = scored.filter((s) => s.score === bestScore);
      if (tied.length === 1) {
        lottery = tied[0].lot;
        warnings.push(`Lottery was detected from the ticket layout: ${lottery.name}.`);
      } else {
        lotteryCandidates = tied.map((s) => s.lot);
      }
    } else {
      lotteryCandidates = scored.slice(0, 6).map((s) => s.lot);
    }
  }

  if (!lottery) {
    return {
      lottery: undefined,
      lotteryCandidates,
      numbers: parsed.numbers,
      letter: parsed.letter ?? null,
      zodiac: parsed.zodiac ?? null,
      superNumber: parsed.superNumber ?? null,
      matchedBy: 'none',
      status: 'needs-review',
      warnings: [...warnings, 'Could not determine which lottery this ticket belongs to.'],
      candidateDraws: [],
      printedDrawNo: parsed.drawNo ?? null,
      printedDate: parsed.date ?? null,
      rawNumbers: parsed.numbers
    };
  }

  const digitWidth = lottery.digitWidth || 2;
  const ballCount = lottery.ballCount || lottery.numberCount || 4;
  const printedDate = parsed.date ?? null;

  /* ---------------- 2. Which draw? ---------------- */
  const byDrawNo = new Map<string, LotteryDraw>();
  for (const d of lottery.draws) {
    const key = normaliseDrawNo(d.drawNo);
    if (key && !byDrawNo.has(key)) byDrawNo.set(key, d);
  }

  // Draw numbers that appear inside the payload but were not classified as
  // the primary draw number are still strong candidates.
  const drawNoCandidateOrder: string[] = [];
  for (const c of parsed.drawNoCandidates) {
    const norm = normaliseDrawNo(c);
    if (norm && !drawNoCandidateOrder.includes(norm)) drawNoCandidateOrder.push(norm);
  }
  if (parsed.drawNo) {
    const norm = normaliseDrawNo(parsed.drawNo);
    if (norm && !drawNoCandidateOrder.includes(norm)) drawNoCandidateOrder.unshift(norm);
  }

  let draw: LotteryDraw | undefined;
  let matchedBy: DrawMatchMethod = 'none';

  // 2a. Exact draw-number match (authoritative).
  let matchedDrawNoToken: string | null = null;
  for (const candidate of drawNoCandidateOrder) {
    const hit = byDrawNo.get(candidate);
    if (hit) {
      draw = hit;
      matchedBy = 'drawNo';
      matchedDrawNoToken = candidate;
      break;
    }
  }

  // 2b. No draw-number match AND the ticket carried no draw number at all →
  // the printed date may be used, but it is flagged as a soft match.
  //
  // If the ticket DID carry a draw number that we could not find, the date is
  // NOT used: the ticket is asking for a draw the result database does not
  // have, and silently scoring against another draw is exactly the bug that
  // produced wrong Govisetha results before.
  const drawNoWasRead = drawNoCandidateOrder.length > 0;
  if (!draw && !drawNoWasRead && printedDate) {
    const byDate = lottery.draws.find((d) => toIsoDate(d.date) === printedDate);
    if (byDate) {
      draw = byDate;
      matchedBy = 'date';
      warnings.push(
        `Matched by the date printed on the ticket (${printedDate}) because no draw number could be read.`
      );
    }
  }

  // 2c. Still nothing → ambiguous, let the user choose.
  if (!draw) {
    const dateMatch = printedDate
      ? lottery.draws.find((d) => toIsoDate(d.date) === printedDate)
      : undefined;
    const nearest = pickCandidateDraws(lottery, printedDate);
    const candidateDraws = dateMatch
      ? [dateMatch, ...nearest.filter((d) => d.drawNo !== dateMatch.drawNo)].slice(0, 8)
      : nearest;

    if (drawNoWasRead) {
      warnings.push(
        `The ticket shows draw number ${parsed.drawNo ?? drawNoCandidateOrder[0]}, which is not in the downloaded ` +
          `results for ${lottery.name} (available: ${lottery.draws.length} draws). ` +
          'The ticket was NOT scored automatically — pick the draw below to score it.'
      );
    } else {
      warnings.push(`No draw number could be read for ${lottery.name}. Pick the draw below to score the ticket.`);
    }

    return {
      lottery,
      lotteryCandidates: [],
      numbers: pickBestNumbers(parsed, lottery, ballCount, digitWidth, null),
      letter: parsed.letter ?? null,
      zodiac: parsed.zodiac ?? null,
      superNumber: parsed.superNumber ?? null,
      matchedBy: 'none',
      status: drawNoWasRead ? 'needs-review' : 'not-found',
      warnings,
      candidateDraws,
      printedDrawNo: parsed.drawNo ?? null,
      printedDate,
      rawNumbers: parsed.numbers
    };
  }

  /* ---------------- 3. Consistency checks ---------------- */
  if (matchedBy === 'drawNo' && printedDate) {
    const officialDate = toIsoDate(draw.date);
    if (officialDate && officialDate !== printedDate) {
      warnings.push(
        `The date printed on the ticket (${printedDate}) differs from the official draw date (${officialDate}). ` +
          'The printed draw number was used for scoring.'
      );
    }
  }
  if (matchedDrawNoToken && parsed.drawNo && normaliseDrawNo(parsed.drawNo) !== matchedDrawNoToken) {
    warnings.push(`Draw number read as ${parsed.drawNo}, matched official draw ${draw.drawNo}.`);
  }

  /* ---------------- 4. Ball numbers ---------------- */
  const numbers = pickBestNumbers(parsed, lottery, ballCount, digitWidth, matchedDrawNoToken);

  if (numbers.length !== ballCount) {
    warnings.push(
      `Read ${numbers.length} ball number(s) but ${lottery.name} tickets carry ${ballCount}. Please verify the ticket.`
    );
  }

  /* ---------------- 5. Sub-game (Ada Sampatha / Suba Dawasak) ---------------- */
  let subGameIndex: number | undefined;
  if (draw.subGames && draw.subGames.length > 0) {
    const idx = draw.subGames.findIndex(
      (sg) => interpretRunsForLottery(parsed.numberRuns, digitWidth).length === sg.numbers.length
    );
    const exact = draw.subGames.findIndex(
      (sg) => sg.numbers.length === numbers.length ||
        (sg.numbers.length === ballCount && numbers.length === ballCount)
    );
    subGameIndex = idx >= 0 ? idx : exact >= 0 ? exact : undefined;
    if (subGameIndex === undefined) {
      warnings.push('Could not determine which sub-game of this ticket was scanned.');
    }
  }

  return {
    lottery,
    lotteryCandidates: [],
    numbers,
    letter: parsed.letter ?? null,
    zodiac: parsed.zodiac ?? null,
    superNumber: parsed.superNumber ?? null,
    draw,
    matchedBy: matchedBy === 'drawNo' ? 'drawNo' : matchedBy,
    status: 'verified',
    warnings,
    candidateDraws: [],
    subGameIndex,
    printedDrawNo: parsed.drawNo ?? null,
    printedDate,
    rawNumbers: parsed.numbers
  };
}

/**
 * Pick the ball-number interpretation that best fits the lottery.
 * Handles both 1-digit and 2-digit lotteries, and recovers balls that the
 * first pass classified as a draw number.
 */
function pickBestNumbers(
  parsed: ParsedTicketQR,
  lottery: LotteryInfo,
  ballCount: number,
  digitWidth: number,
  matchedDrawNoToken: string | null
): string[] {
  const candidates: string[][] = [];

  const base = interpretRunsForLottery(parsed.numberRuns, digitWidth);
  if (base.length > 0) candidates.push(base);

  // A run that was consumed as the printed date may really be glued balls
  // (e.g. "20260919" = 20-26-09-19).
  const ambiguous = parsed.ambiguousRuns || [];
  if (ambiguous.length > 0) {
    const withAmbiguous = interpretRunsForLottery([...parsed.numberRuns, ...ambiguous], digitWidth);
    if (withAmbiguous.length > 0) candidates.push(withAmbiguous);
    const ambiguousOnly = interpretRunsForLottery(ambiguous, digitWidth);
    if (ambiguousOnly.length > 0) candidates.push(ambiguousOnly);
  }

  // Alternative: a draw-number candidate that did not match any official draw
  // may actually be glued ball numbers.
  const leftoverRuns = parsed.drawNoCandidates.filter(
    (c) => normaliseDrawNo(c) !== matchedDrawNoToken
  );
  if (leftoverRuns.length > 0) {
    const merged = interpretRunsForLottery([...leftoverRuns, ...parsed.numberRuns], digitWidth);
    if (merged.length > 0) candidates.push(merged);

    const appended = interpretRunsForLottery([...parsed.numberRuns, ...leftoverRuns], digitWidth);
    if (appended.length > 0) candidates.push(appended);
  }

  // Prefer an interpretation whose length matches the ticket format exactly.
  const exact = candidates.filter((c) => c.length === ballCount);
  if (exact.length > 0) {
    // Among exact matches, prefer the one that is not padded with nothing odd.
    return exact[0];
  }

  if (base.length > ballCount) return base.slice(0, ballCount);
  return base;
}

/** Recent draws of a lottery, ordered by closeness to `isoDate` when known. */
export function pickCandidateDraws(lottery: LotteryInfo, isoDate: string | null, limit = 8): LotteryDraw[] {
  const draws = [...lottery.draws];
  if (!isoDate) return draws.slice(0, limit);

  const target = new Date(isoDate + 'T00:00:00Z').getTime();
  return draws
    .map((d) => {
      const iso = toIsoDate(d.date);
      const diff = iso ? Math.abs(new Date(iso + 'T00:00:00Z').getTime() - target) : Number.MAX_SAFE_INTEGER;
      return { d, diff };
    })
    .sort((a, b) => a.diff - b.diff)
    .slice(0, limit)
    .map((x) => x.d);
}

/** Date range helper used by the history view. */
export function drawDateIso(draw: LotteryDraw): string | null {
  return toIsoDate(draw.date);
}
