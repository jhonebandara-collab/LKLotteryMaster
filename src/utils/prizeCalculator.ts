import { LotteryDraw, PrizeEvaluation } from '../types/lottery';

function norm(arr?: string[] | null): string[] {
  return (arr || []).map((n) => String(n).trim().padStart(2, '0'));
}

function normRaw(arr?: string[] | null): string[] {
  return (arr || []).map((n) => String(n).trim());
}

function setMatchCount(official: string[], mine: string[]): { count: number; matches: string[] } {
  const pool = [...official];
  const matches: string[] = [];
  let count = 0;
  for (const n of mine) {
    const idx = pool.indexOf(n);
    if (idx !== -1) {
      pool.splice(idx, 1);
      count++;
      matches.push(n);
    }
  }
  return { count, matches };
}

function positionalFromEnd(official: string[], mine: string[]): number {
  let count = 0;
  const n = Math.min(official.length, mine.length);
  for (let i = 0; i < n; i++) {
    if (official[official.length - 1 - i] === mine[mine.length - 1 - i]) count++;
    else break;
  }
  return count;
}

function positionalFromStart(official: string[], mine: string[]): number {
  let count = 0;
  const n = Math.min(official.length, mine.length);
  for (let i = 0; i < n; i++) {
    if (official[i] === mine[i]) count++;
    else break;
  }
  return count;
}

export function formatRs(amount: number | null): string {
  if (amount === null) return 'Non-Cash Prize';
  return 'Rs. ' + amount.toLocaleString('en-US') + '.00';
}

export function evaluateLotteryPrize(
  slug: string,
  draw: LotteryDraw,
  ticket: {
    letter?: string | null;
    zodiac?: string | null;
    superNumber?: string | null;
    numbers: string[];
  },
  subGameIndex?: number
): PrizeEvaluation {
  const cleanSlug = slug.toLowerCase().trim();

  // Multi-game handling for Ada Sampatha & Suba Dawasak
  if (cleanSlug === 'ada-sampatha' && draw.subGames && draw.subGames.length > 0) {
    const idx = subGameIndex !== undefined && subGameIndex >= 0 ? subGameIndex : 2; // default to game 3
    const subDraw = draw.subGames[idx] || draw.subGames[draw.subGames.length - 1];
    return evaluateAdaSampathaSubgame(idx, subDraw, ticket);
  }

  if (cleanSlug === 'suba-dawasak' && draw.subGames && draw.subGames.length > 0) {
    const idx = subGameIndex !== undefined && subGameIndex >= 0 ? subGameIndex : 0;
    const subDraw = draw.subGames[idx] || draw.subGames[0];
    return evaluateSubaDawasakSubgame(idx, subDraw, ticket);
  }

  // Handle single-digit style lotteries (e.g. Mahajana Sampatha, Supiri Dhana Sampatha, Jaya Sampatha, NLB Jaya)
  const isPositionalSingleDigit = ['mahajana-sampatha', 'supiri-dhana-sampatha', 'jaya-sampatha', 'nlb-jaya'].includes(cleanSlug);

  const officialNumbers = isPositionalSingleDigit ? normRaw(draw.numbers) : norm(draw.numbers);
  const ticketNumbers = isPositionalSingleDigit ? normRaw(ticket.numbers) : norm(ticket.numbers);

  const { count: setCount, matches } = setMatchCount(officialNumbers, ticketNumbers);
  const posStart = positionalFromStart(officialNumbers, ticketNumbers);
  const posEnd = positionalFromEnd(officialNumbers, ticketNumbers);

  const letterMatch = !!(
    draw.letter &&
    ticket.letter &&
    draw.letter.trim().toUpperCase() === ticket.letter.trim().toUpperCase()
  );

  const zodiacMatch = !!(
    draw.zodiac &&
    ticket.zodiac &&
    draw.zodiac.trim().toUpperCase() === ticket.zodiac.trim().toUpperCase()
  );

  const superNumberMatch = !!(
    draw.superNumber != null &&
    ticket.superNumber != null &&
    String(draw.superNumber).trim().padStart(2, '0') === String(ticket.superNumber).trim().padStart(2, '0')
  );

  switch (cleanSlug) {
    // ----------------------------------------------------
    // GOVISETHA (Letter + 4 Numbers)
    // ----------------------------------------------------
    case 'govisetha': {
      if (setCount === 4 && letterMatch) return win('Super Prize', 'Letter and 4 Numbers Correct', 60000000, 4, matches, true);
      if (setCount === 4) return win('1st Prize', '4 Numbers Correct', 2000000, 4, matches);
      if (setCount === 3 && letterMatch) return win('2nd Prize', 'Letter and Any 3 Numbers Correct', 250000, 3, matches, true);
      if (setCount === 3) return win('3rd Prize', 'Any 3 Numbers Correct', 5000, 3, matches);
      if (setCount === 2 && letterMatch) return win('4th Prize', 'Letter and Any 2 Numbers Correct', 2000, 2, matches, true);
      if (setCount === 2) return win('5th Prize', 'Any 2 Numbers Correct', 200, 2, matches);
      if (setCount === 1 && letterMatch) return win('6th Prize', 'Letter and Any Number Correct', 200, 1, matches, true);
      if (setCount === 1) return win('7th Prize', 'Any Number Correct', 40, 1, matches);
      if (letterMatch) return win('8th Prize', 'Letter Correct', 40, 0, [], true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // MAHAJANA SAMPATHA (Letter + 6 Numbers positional)
    // ----------------------------------------------------
    case 'mahajana-sampatha': {
      if (posStart === 6 && letterMatch) return win('Super Prize', 'Letter and 6 Numbers Correct', 20000000, 6, matches, true);
      if (posStart === 6) return win('1st Prize', '6 Numbers Correct', 2500000, 6, matches);
      if (posEnd === 5) return win('2nd Prize', 'Last 5 Numbers Correct', 100000, 5, matches);
      if (posStart === 5) return win('7th Prize', 'First 5 Numbers Correct', 100000, 5, matches);
      if (posEnd === 4) return win('3rd Prize', 'Last 4 Numbers Correct', 15000, 4, matches);
      if (posStart === 4) return win('8th Prize', 'First 4 Numbers Correct', 2000, 4, matches);
      if (posEnd === 3) return win('4th Prize', 'Last 3 Numbers Correct', 2000, 3, matches);
      if (posStart === 3) return win('9th Prize', 'First 3 Numbers Correct', 200, 3, matches);
      if (posEnd === 2) return win('5th Prize', 'Last 2 Numbers Correct', 200, 2, matches);
      if (posStart === 2) return win('10th Prize', 'First 2 Numbers Correct', 80, 2, matches);
      if (posEnd === 1) return win('6th Prize', 'Last Number Correct', 40, 1, matches);
      if (posStart === 1) return win('11th Prize', 'First Number Correct', 40, 1, matches);
      if (letterMatch) return win('12th Prize', 'Letter Correct', 40, 0, [], true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // DHANA NIDHANAYA (Letter + 4 Numbers)
    // ----------------------------------------------------
    case 'dhana-nidhanaya': {
      if (setCount === 4 && letterMatch) return win('Super Prize', 'Letter and 4 Numbers Correct', 80000000, 4, matches, true);
      if (setCount === 4) return win('1st Prize', '4 Numbers Correct', 2000000, 4, matches);
      if (setCount === 3 && letterMatch) return win('2nd Prize', 'Letter and Any 3 Numbers Correct', 200000, 3, matches, true);
      if (setCount === 3) return win('3rd Prize', 'Any 3 Numbers Correct', 6000, 3, matches);
      if (setCount === 2 && letterMatch) return win('4th Prize', 'Letter and Any 2 Numbers Correct', 2000, 2, matches, true);
      if (setCount === 2) return win('5th Prize', 'Any 2 Numbers Correct', 200, 2, matches);
      if (setCount === 1 && letterMatch) return win('6th Prize', 'Letter and Any Number Correct', 120, 1, matches, true);
      if (setCount === 1) return win('7th Prize', 'Any Number Correct', 40, 1, matches);
      if (letterMatch) return win('8th Prize', 'Letter Correct', 40, 0, [], true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // MEGA POWER (Letter + Super Number + 4 Numbers)
    // ----------------------------------------------------
    case 'mega-power': {
      if (setCount === 4 && letterMatch && superNumberMatch) return win('Mega Super Prize', 'Letter, Super Number & 4 Numbers Correct', 150000000, 4, matches, true, false, true);
      if (setCount === 4 && letterMatch) return win('Power Super Prize', 'Letter and 4 Numbers Correct', 10000000, 4, matches, true);
      if (setCount === 4 && superNumberMatch) return win('Grand Super Prize', 'Super Number and 4 Numbers (Motor Car)', null, 4, matches, false, false, true);
      if (setCount === 4) return win('1st Prize', '4 Numbers Correct', 2000000, 4, matches);
      if (setCount === 3 && letterMatch) return win('2nd Prize', 'Letter and Any 3 Numbers Correct', 200000, 3, matches, true);
      if (setCount === 3) return win('3rd Prize', 'Any 3 Numbers Correct', 5000, 3, matches);
      if (setCount === 2 && letterMatch) return win('4th Prize', 'Letter and Any 2 Numbers Correct', 2000, 2, matches, true);
      if (setCount === 2) return win('5th Prize', 'Any 2 Numbers Correct', 200, 2, matches);
      if (setCount === 1 && letterMatch) return win('6th Prize', 'Letter and Any Number Correct', 200, 1, matches, true);
      if (setCount === 1) return win('7th Prize', 'Any Number Correct', 40, 1, matches);
      if (letterMatch) return win('8th Prize', 'Letter Correct', 40, 0, [], true);
      if (superNumberMatch) return win('9th Prize', 'Super Number Correct', 40, 0, [], false, false, true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // HANDAHANA (Zodiac + 4 Numbers)
    // ----------------------------------------------------
    case 'handahana': {
      if (setCount === 4 && zodiacMatch) return win('Super Prize', 'Zodiac and 4 Numbers Correct', 3000000, 4, matches, false, true);
      if (setCount === 4) return win('1st Prize', '4 Numbers Correct', 1000000, 4, matches);
      if (setCount === 3 && zodiacMatch) return win('2nd Prize', 'Zodiac and Any 3 Numbers Correct', 25000, 3, matches, false, true);
      if (setCount === 3) return win('3rd Prize', 'Any 3 Numbers Correct', 2000, 3, matches);
      if (setCount === 2 && zodiacMatch) return win('4th Prize', 'Zodiac and Any 2 Numbers Correct', 500, 2, matches, false, true);
      if (setCount === 2) return win('5th Prize', 'Any 2 Numbers Correct', 200, 2, matches);
      if (setCount === 1 && zodiacMatch) return win('6th Prize', 'Zodiac and Any Number Correct', 120, 1, matches, false, true);
      if (setCount === 1) return win('7th Prize', 'Any Number Correct', 40, 1, matches);
      if (zodiacMatch) return win('8th Prize', 'Zodiac Correct', 40, 0, [], false, true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // NLB JAYA (Letter + 4 Numbers positional)
    // ----------------------------------------------------
    case 'nlb-jaya': {
      if (posStart === 4 && letterMatch) return win('1st Prize', 'Letter and 4 Numbers Correct', 500000, 4, matches, true);
      if (posStart === 4) return win('2nd Prize', '4 Numbers Correct', 50000, 4, matches);
      if (posEnd === 3) return win('3rd Prize', 'Last 3 Numbers Correct', 2000, 3, matches);
      if (posStart === 3) return win('6th Prize', 'First 3 Numbers Correct', 200, 3, matches);
      if (posEnd === 2) return win('4th Prize', 'Last 2 Numbers Correct', 200, 2, matches);
      if (posStart === 2) return win('7th Prize', 'First 2 Numbers Correct', 80, 2, matches);
      if (posEnd === 1) return win('5th Prize', 'Last Number Correct', 40, 1, matches);
      if (posStart === 1) return win('8th Prize', 'First Number Correct', 40, 1, matches);
      if (letterMatch) return win('9th Prize', 'Letter Correct', 40, 0, [], true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // ADA KOTIPATHI & SHANIDA (Letter + 4 Numbers)
    // ----------------------------------------------------
    case 'ada-kotipathi':
    case 'shanida': {
      if (setCount === 4 && letterMatch) return win('Jackpot', '4 Numbers + English Letter', 50000000, 4, matches, true);
      if (setCount === 4) return win('1st Prize', '4 Numbers Correct', 2000000, 4, matches);
      if (setCount === 3 && letterMatch) return win('2nd Prize', 'Any 3 Numbers + English Letter', 200000, 3, matches, true);
      if (setCount === 3) return win('3rd Prize', 'Any 3 Numbers Correct', 4000, 3, matches);
      if (setCount === 2 && letterMatch) return win('4th Prize', 'Any 2 Numbers + English Letter', 2000, 2, matches, true);
      if (setCount === 2) return win('5th Prize', 'Any 2 Numbers Correct', 200, 2, matches);
      if (setCount === 1 && letterMatch) return win('6th Prize', 'Any 1 Number + English Letter', 200, 1, matches, true);
      if (setCount === 1) return win('7th Prize', 'Any Single Number Correct', 40, 1, matches);
      if (letterMatch) return win('8th Prize', 'English Letter Correct', 40, 0, [], true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // LAGNA WASANA (Zodiac + 4 Numbers)
    // ----------------------------------------------------
    case 'lagna-wasana': {
      if (setCount === 4 && zodiacMatch) return win('Jackpot', '4 Numbers + Zodiac Sign', 3000000, 4, matches, false, true);
      if (setCount === 4) return win('1st Prize', '4 Numbers Correct', 1000000, 4, matches);
      if (setCount === 3 && zodiacMatch) return win('2nd Prize', 'Any 3 Numbers + Zodiac Sign', 20000, 3, matches, false, true);
      if (setCount === 3) return win('3rd Prize', 'Any 3 Numbers Correct', 2000, 3, matches);
      if (setCount === 2 && zodiacMatch) return win('4th Prize', 'Any 2 Numbers + Zodiac Sign', 400, 2, matches, false, true);
      if (setCount === 2) return win('5th Prize', 'Any 2 Numbers Correct', 200, 2, matches);
      if (setCount === 1 && zodiacMatch) return win('6th Prize', 'Any 1 Number + Zodiac Sign', 120, 1, matches, false, true);
      if (setCount === 1) return win('7th Prize', 'Any Single Number Correct', 40, 1, matches);
      if (zodiacMatch) return win('8th Prize', 'Any Zodiac Sign Correct', 40, 0, [], false, true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // SUPIRI DHANA SAMPATHA (6 Numbers + Letter positional)
    // ----------------------------------------------------
    case 'supiri-dhana-sampatha': {
      if (posStart === 6 && letterMatch) return win('Jackpot', 'All 6 Numbers + Letter', 20000000, 6, matches, true);
      if (posStart === 6) return win('1st Prize', 'All 6 numbers', 2500000, 6, matches);
      if (posEnd === 5) return win('2nd Prize', 'Last 5 Numbers Correct', 100000, 5, matches);
      if (posStart === 5) return win('7th Prize', 'First 5 Numbers Correct', 100000, 5, matches);
      if (posEnd === 4) return win('3rd Prize', 'Last 4 Numbers Correct', 20000, 4, matches);
      if (posStart === 4) return win('8th Prize', 'First 4 Numbers Correct', 2000, 4, matches);
      if (posEnd === 3) return win('4th Prize', 'Last 3 Numbers Correct', 2000, 3, matches);
      if (posStart === 3) return win('9th Prize', 'First 3 Numbers Correct', 200, 3, matches);
      if (posEnd === 2) return win('5th Prize', 'Last 2 Numbers Correct', 200, 2, matches);
      if (posStart === 2) return win('10th Prize', 'First 2 Numbers Correct', 120, 2, matches);
      if (posEnd === 1) return win('6th Prize', 'Last Number Correct', 40, 1, matches);
      if (posStart === 1) return win('11th Prize', 'First Number Correct', 40, 1, matches);
      if (setCount === 6) return win('Any Order Prize', 'All 6 Numbers in any order', 500, 6, matches);
      if (letterMatch) return win('12th Prize', 'English Letter Correct', 40, 0, [], true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // SUPER BALL (Letter + 4 Numbers)
    // ----------------------------------------------------
    case 'super-ball': {
      if (setCount === 4 && letterMatch) return win('Jackpot', 'All 4 Numbers + English Letter', 50000000, 4, matches, true);
      if (setCount === 4) return win('1st Prize', 'All 4 Numbers Correct', 2000000, 4, matches);
      if (setCount === 3 && letterMatch) return win('2nd Prize', 'Any 3 Numbers + English Letter', 200000, 3, matches, true);
      if (setCount === 3) return win('3rd Prize', 'Any 3 Numbers Correct', 4000, 3, matches);
      if (setCount === 2 && letterMatch) return win('4th Prize', 'Any 2 Numbers + English Letter', 2000, 2, matches, true);
      if (setCount === 2) return win('5th Prize', 'Any 2 Numbers Correct', 200, 2, matches);
      if (setCount === 1 && letterMatch) return win('6th Prize', 'Any One Number + English Letter', 200, 1, matches, true);
      if (setCount === 1) return win('7th Prize', 'Any One Number Correct', 40, 1, matches);
      if (letterMatch) return win('8th Prize', 'Any English Letter Correct', 40, 0, [], true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // KAPRUKA (Letter + Super Number + 4 Numbers)
    // ----------------------------------------------------
    case 'kapruka': {
      if (setCount === 4 && letterMatch && superNumberMatch) return win('Jackpot', '4 Numbers + English Letter + Super Number', 150000000, 4, matches, true, false, true);
      if (setCount === 4 && letterMatch) return win('Top Prize A', '4 Numbers + English Letter', 10000000, 4, matches, true);
      if (setCount === 4 && superNumberMatch) return win('Top Prize B', '4 Numbers + Super Number', 10000000, 4, matches, false, false, true);
      if (setCount === 4) return win('1st Prize', '4 Numbers Correct', 2000000, 4, matches);
      if (setCount === 3 && letterMatch) return win('2nd Prize', 'Any 3 Numbers + English Letter', 200000, 3, matches, true);
      if (setCount === 3) return win('3rd Prize', 'Any 3 Numbers Correct', 4000, 3, matches);
      if (setCount === 2 && letterMatch) return win('4th Prize', 'Any 2 Numbers + English Letter', 2000, 2, matches, true);
      if (setCount === 2) return win('5th Prize', 'Any 2 Numbers Correct', 200, 2, matches);
      if (setCount === 1 && letterMatch) return win('6th Prize', 'Any 1 Number + English Letter', 200, 1, matches, true);
      if (setCount === 1) return win('7th Prize', 'Any Single Number Correct', 40, 1, matches);
      if (letterMatch) return win('8th Prize', 'Any English Letter Correct', 40, 0, [], true);
      if (superNumberMatch) return win('9th Prize', 'Super Number Correct', 40, 0, [], false, false, true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // WAASI (2 Numbers + Letter + Super Number)
    // ----------------------------------------------------
    case 'waasi': {
      if (setCount === 2 && letterMatch && superNumberMatch) return win('1st Prize', '2 Numbers + English Letter + Super Number', 1000000, 2, matches, true, false, true);
      if (setCount === 2 && letterMatch) return win('2nd Prize', '2 Numbers + English Letter', 500000, 2, matches, true);
      if (setCount === 2 && superNumberMatch) return win('3rd Prize', '2 Numbers + Super Number', 50000, 2, matches, false, false, true);
      if (setCount === 2) return win('4th Prize', '2 Numbers Correct', 25000, 2, matches);
      if (setCount === 1 && superNumberMatch && letterMatch) return win('5th Prize', '1 Number + Super Number + English Letter', 1000, 1, matches, true, false, true);
      if (setCount === 1 && letterMatch) return win('6th Prize', '1 Number + English Letter', 500, 1, matches, true);
      if (setCount === 1 && superNumberMatch) return win('7th Prize', '1 Number + Super Number', 500, 1, matches, false, false, true);
      if (superNumberMatch && letterMatch) return win('8th Prize', 'Super Number + English Letter', 120, 0, [], true, false, true);
      if (setCount === 1) return win('9th Prize', '1 Number Only', 40, 1, matches);
      if (letterMatch) return win('10th Prize', 'English Letter Only', 40, 0, [], true);
      if (superNumberMatch) return win('11th Prize', 'Only Super Number', 40, 0, [], false, false, true);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // SASIRI (3 Numbers only)
    // ----------------------------------------------------
    case 'sasiri': {
      if (setCount === 3) return win('1st Prize', 'Any 3 Numbers Correct', 200000, 3, matches);
      if (setCount === 2) return win('2nd Prize', 'Any 2 Numbers Correct', 400, 2, matches);
      if (setCount === 1) return win('3rd Prize', 'Any Single Number Correct', 40, 1, matches);
      return noWin(setCount, matches);
    }

    // ----------------------------------------------------
    // JAYA SAMPATHA (4 Numbers strictly back-to-forward)
    // ----------------------------------------------------
    case 'jaya-sampatha': {
      if (posEnd === 4 && letterMatch) return win('Top Prize', 'All 4 numbers back to forward with English Letter', 250000, 4, matches, true);
      if (posEnd === 4) return win('1st Prize', '4 numbers in order from back to forward', 50000, 4, matches);
      if (posEnd === 3) return win('2nd Prize', 'Matching 3 numbers from back to forward', 4000, 3, matches);
      if (posEnd === 2) return win('3rd Prize', '2 printed numbers from back to forward', 1000, 2, matches);
      if (letterMatch) return win('4th Prize', 'English Letter Correct', 80, 0, [], true);
      return noWin(setCount, matches);
    }

    default: {
      if (setCount >= 3) return win('General Win', `${setCount} Numbers Matched`, setCount * 500, setCount, matches);
      return noWin(setCount, matches);
    }
  }
}

function evaluateAdaSampathaSubgame(idx: number, subDraw: any, ticket: any): PrizeEvaluation {
  const official = normRaw(subDraw.numbers);
  const mine = normRaw(ticket.numbers);
  const { count: setCount, matches } = setMatchCount(official, mine);
  const letterMatch = !!(
    subDraw.letter &&
    ticket.letter &&
    subDraw.letter.trim().toUpperCase() === ticket.letter.trim().toUpperCase()
  );

  if (idx === 0) {
    // 2 numbers game
    if (setCount === 2) return win('1st Prize', '2 Numbers Correct', 1000, 2, matches);
    return noWin(setCount, matches);
  } else if (idx === 1) {
    // 3 numbers game
    if (setCount === 3) return win('1st Prize', '3 Numbers Correct', 4000, 3, matches);
    return noWin(setCount, matches);
  } else {
    // 4 numbers + letter game
    if (setCount === 4 && letterMatch) return win('2nd Prize', '4 Numbers and Letter Correct', 250000, 4, matches, true);
    if (setCount === 4) return win('1st Prize', '4 Numbers Correct', 50000, 4, matches);
    if (letterMatch) return win('3rd Prize', 'Letter Correct', 80, 0, [], true);
    return noWin(setCount, matches);
  }
}

function evaluateSubaDawasakSubgame(idx: number, subDraw: any, ticket: any): PrizeEvaluation {
  const official = norm(subDraw.numbers);
  const mine = norm(ticket.numbers);
  const { count: setCount, matches } = setMatchCount(official, mine);
  const zodiacMatch = !!(
    subDraw.zodiac &&
    ticket.zodiac &&
    subDraw.zodiac.trim().toUpperCase() === ticket.zodiac.trim().toUpperCase()
  );

  if (idx === 0) {
    // Zodiac and 3 numbers game
    if (setCount === 3 && zodiacMatch) return win('1st Prize', 'Zodiac and 3 Numbers Correct', 500000, 3, matches, false, true);
    if (setCount === 3) return win('2nd Prize', '3 Numbers Correct', 50000, 3, matches);
    if (setCount === 2 && zodiacMatch) return win('3rd Prize', 'Zodiac and Any 2 Numbers Correct', 2500, 2, matches, false, true);
    if (setCount === 2) return win('4th Prize', 'Any 2 Numbers Correct', 1000, 2, matches);
    if (setCount === 1 && zodiacMatch) return win('5th Prize', 'Zodiac and Any Number Correct', 200, 1, matches, false, true);
    if (setCount === 1) return win('6th Prize', 'Any Number Correct', 40, 1, matches);
    if (zodiacMatch) return win('7th Prize', 'Zodiac Correct', 40, 0, [], false, true);
    return noWin(setCount, matches);
  } else {
    // 4 numbers promotional game
    if (setCount === 4) return win('1st Prize', '4 Numbers Correct', 25000, 4, matches);
    return noWin(setCount, matches);
  }
}

function win(
  tier: string,
  label: string,
  amount: number | null,
  matchedCount: number,
  matchedNumbers: string[],
  letterMatch?: boolean,
  zodiacMatch?: boolean,
  superNumberMatch?: boolean
): PrizeEvaluation {
  return {
    won: true,
    tier,
    prizeLabel: label,
    prizeAmountRs: amount,
    prizeAmountFormatted: formatRs(amount),
    matchedCount,
    matchedNumbers,
    letterMatch,
    zodiacMatch,
    superNumberMatch
  };
}

function noWin(matchedCount: number, matchedNumbers: string[]): PrizeEvaluation {
  return {
    won: false,
    tier: null,
    prizeLabel: null,
    prizeAmountRs: 0,
    prizeAmountFormatted: 'Rs. 0.00',
    matchedCount,
    matchedNumbers
  };
}
