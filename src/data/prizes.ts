import { PrizeEvaluationResult, TicketCheckInput, LotteryDraw } from '../types';

function norm(arr: string[] = []): string[] {
  return (arr || []).map(n => String(n).trim());
}

function setMatchCount(official: string[], ticket: string[]): { count: number; matched: string[] } {
  const pool = [...official];
  const matched: string[] = [];
  let count = 0;
  for (const n of ticket) {
    const idx = pool.indexOf(n);
    if (idx !== -1) {
      pool.splice(idx, 1);
      count++;
      matched.push(n);
    }
  }
  return count ? { count, matched } : { count: 0, matched: [] };
}

function positionalFromEnd(official: string[], ticket: string[]): number {
  let count = 0;
  const n = Math.min(official.length, ticket.length);
  for (let i = 0; i < n; i++) {
    if (official[official.length - 1 - i] === ticket[ticket.length - 1 - i]) count++;
    else break;
  }
  return count;
}

function positionalFromStart(official: string[], ticket: string[]): number {
  let count = 0;
  const n = Math.min(official.length, ticket.length);
  for (let i = 0; i < n; i++) {
    if (official[i] === ticket[i]) count++;
    else break;
  }
  return count;
}

export function formatRs(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Rs. 0.00';
  return 'Rs. ' + amount.toLocaleString('en-US') + '.00';
}

interface MatchStats {
  official: string[];
  mine: string[];
  total: number;
  setCount: number;
  matchedSet: string[];
  posStart: number;
  posEnd: number;
  letter: boolean;
  zodiac: boolean;
  superN: boolean;
}

function getStats(draw: LotteryDraw, ticket: TicketCheckInput): MatchStats {
  const official = norm(draw.numbers);
  const mine = norm(ticket.numbers);
  const { count: setCount, matched: matchedSet } = setMatchCount(official, mine);
  const letter = Boolean(draw.letter && ticket.letter && String(draw.letter).trim().toUpperCase() === String(ticket.letter).trim().toUpperCase());
  const zodiac = Boolean(draw.zodiac && ticket.zodiac && String(draw.zodiac).trim().toUpperCase() === String(ticket.zodiac).trim().toUpperCase());
  const superN = Boolean(draw.superNumber != null && ticket.superNumber != null && String(draw.superNumber).trim() === String(ticket.superNumber).trim());

  return {
    official,
    mine,
    total: official.length,
    setCount,
    matchedSet,
    posStart: positionalFromStart(official, mine),
    posEnd: positionalFromEnd(official, mine),
    letter,
    zodiac,
    superN
  };
}

interface TierCandidate {
  tier: string;
  label: string;
  prizeRs: number | null;
  nonCash?: string;
  note?: string;
  when: (s: MatchStats) => boolean;
}

function evalTiers(tiers: TierCandidate[], s: MatchStats): PrizeEvaluationResult {
  for (const t of tiers) {
    if (t.when(s)) {
      return {
        won: true,
        tier: t.tier,
        prizeLabel: t.label,
        prizeAmountRs: t.prizeRs || 0,
        prizeAmountFormatted: t.prizeRs != null ? formatRs(t.prizeRs) : (t.nonCash || 'Prize Won'),
        note: t.note || null,
        matchedNumbers: s.matchedSet,
        matchedNumbersCount: s.setCount,
        letterMatched: s.letter,
        zodiacMatched: s.zodiac,
        superNumberMatched: s.superN
      };
    }
  }

  return {
    won: false,
    tier: null,
    prizeLabel: 'දිනුමක් නොමැත (No Prize Won)',
    prizeAmountRs: 0,
    prizeAmountFormatted: 'Rs. 0.00',
    matchedNumbers: s.matchedSet,
    matchedNumbersCount: s.setCount,
    letterMatched: s.letter,
    zodiacMatched: s.zodiac,
    superNumberMatched: s.superN
  };
}

// Combo builder (SET MATCH + LETTER or ZODIAC)
function comboTiers(
  bonusType: 'letter' | 'zodiac',
  amounts: { c4b: number; c4: number; c3b: number; c3: number; c2b: number; c2: number; c1b: number; c1: number; c0b: number }
): TierCandidate[] {
  const isLetter = bonusType === 'letter';
  const bonusLabel = isLetter ? 'Letter' : 'Zodiac';
  const hasBonus = (s: MatchStats) => isLetter ? s.letter : s.zodiac;

  return [
    { tier: 'SUPER', label: `4 Numbers + ${bonusLabel} Correct`, prizeRs: amounts.c4b, when: s => s.setCount === 4 && hasBonus(s) },
    { tier: '1ST', label: '4 Numbers Correct', prizeRs: amounts.c4, when: s => s.setCount === 4 },
    { tier: '2ND', label: `Any 3 Numbers + ${bonusLabel} Correct`, prizeRs: amounts.c3b, when: s => s.setCount === 3 && hasBonus(s) },
    { tier: '3RD', label: 'Any 3 Numbers Correct', prizeRs: amounts.c3, when: s => s.setCount === 3 },
    { tier: '4TH', label: `Any 2 Numbers + ${bonusLabel} Correct`, prizeRs: amounts.c2b, when: s => s.setCount === 2 && hasBonus(s) },
    { tier: '5TH', label: 'Any 2 Numbers Correct', prizeRs: amounts.c2, when: s => s.setCount === 2 },
    { tier: '6TH', label: `Any Number + ${bonusLabel} Correct`, prizeRs: amounts.c1b, when: s => s.setCount === 1 && hasBonus(s) },
    { tier: '7TH', label: 'Any Number Correct', prizeRs: amounts.c1, when: s => s.setCount === 1 },
    { tier: '8TH', label: `${bonusLabel} Correct`, prizeRs: amounts.c0b, when: s => s.setCount === 0 && hasBonus(s) }
  ];
}

export function evaluateLotteryPrize(
  slug: string,
  draw: LotteryDraw,
  ticket: TicketCheckInput
): PrizeEvaluationResult {
  const s = getStats(draw, ticket);

  // 1. Handahana (NLB)
  if (slug === 'handahana') {
    const tiers = comboTiers('zodiac', {
      c4b: 3000000, c4: 1000000, c3b: 25000, c3: 2000,
      c2b: 500, c2: 200, c1b: 120, c1: 40, c0b: 40
    });
    return evalTiers(tiers, s);
  }

  // 2. Dhana Nidhanaya (NLB)
  if (slug === 'dhana-nidhanaya') {
    const tiers = comboTiers('letter', {
      c4b: 80000000, c4: 2000000, c3b: 200000, c3: 6000,
      c2b: 2000, c2: 200, c1b: 120, c1: 40, c0b: 40
    });
    return evalTiers(tiers, s);
  }

  // 3. Govisetha (NLB)
  if (slug === 'govisetha') {
    const tiers = comboTiers('letter', {
      c4b: 60000000, c4: 2000000, c3b: 250000, c3: 5000,
      c2b: 2000, c2: 200, c1b: 200, c1: 40, c0b: 40
    });
    return evalTiers(tiers, s);
  }

  // 4. Ada Kotipathi, Shanida, Super Ball (DLB)
  if (slug === 'ada-kotipathi' || slug === 'shanida' || slug === 'super-ball') {
    const tiers = comboTiers('letter', {
      c4b: 50000000, c4: 2000000, c3b: 200000, c3: 4000,
      c2b: 2000, c2: 200, c1b: 200, c1: 40, c0b: 40
    });
    return evalTiers(tiers, s);
  }

  // 5. Lagna Wasana (DLB)
  if (slug === 'lagna-wasana') {
    const tiers = comboTiers('zodiac', {
      c4b: 3000000, c4: 1000000, c3b: 20000, c3: 2000,
      c2b: 400, c2: 200, c1b: 120, c1: 40, c0b: 40
    });
    return evalTiers(tiers, s);
  }

  // 6. Mega Power (NLB)
  if (slug === 'mega-power') {
    const megaTiers: TierCandidate[] = [
      { tier: 'MEGA_SUPER', label: 'Letter and Super Number and 4 Numbers Correct', prizeRs: 150000000, when: s => s.setCount === 4 && s.letter && s.superN },
      { tier: 'POWER_SUPER', label: 'Letter and 4 Numbers Correct', prizeRs: 10000000, when: s => s.setCount === 4 && s.letter },
      { tier: 'GRAND_SUPER', label: 'Super Number and 4 Numbers Correct', prizeRs: 8000000, nonCash: 'Motor Car (Rs. 8M+)', when: s => s.setCount === 4 && s.superN },
      { tier: '1ST', label: '4 Numbers Correct', prizeRs: 2000000, when: s => s.setCount === 4 },
      { tier: '2ND', label: 'Letter and Any 3 Numbers Correct', prizeRs: 200000, when: s => s.setCount === 3 && s.letter },
      { tier: '3RD', label: 'Any 3 Numbers Correct', prizeRs: 5000, when: s => s.setCount === 3 },
      { tier: '4TH', label: 'Letter and Any 2 Numbers Correct', prizeRs: 2000, when: s => s.setCount === 2 && s.letter },
      { tier: '5TH', label: 'Any 2 Numbers Correct', prizeRs: 200, when: s => s.setCount === 2 },
      { tier: '6TH', label: 'Letter and Any Number Correct', prizeRs: 200, when: s => s.setCount === 1 && s.letter },
      { tier: '7TH', label: 'Any Number Correct', prizeRs: 40, when: s => s.setCount === 1 },
      { tier: '8TH', label: 'Letter Correct', prizeRs: 40, when: s => s.setCount === 0 && s.letter },
      { tier: '9TH', label: 'Super Number Correct', prizeRs: 40, when: s => s.setCount === 0 && !s.letter && s.superN },
    ];
    return evalTiers(megaTiers, s);
  }

  // 7. Kapruka (DLB)
  if (slug === 'kapruka') {
    const kaprukaTiers: TierCandidate[] = [
      { tier: 'TOP', label: '4 Numbers + English Letter + Super Number', prizeRs: 150000000, when: s => s.setCount === 4 && s.letter && s.superN },
      { tier: '2ND_TOP_A', label: '4 Numbers + Super Number', prizeRs: 10000000, when: s => s.setCount === 4 && s.superN },
      { tier: '2ND_TOP_B', label: '4 Numbers + English Letter', prizeRs: 10000000, when: s => s.setCount === 4 && s.letter },
      { tier: '3RD', label: '4 Numbers', prizeRs: 2000000, when: s => s.setCount === 4 },
      { tier: '4TH', label: 'Any 3 Numbers + English Letter', prizeRs: 200000, when: s => s.setCount === 3 && s.letter },
      { tier: '5TH', label: 'Any 3 Numbers', prizeRs: 4000, when: s => s.setCount === 3 },
      { tier: '6TH', label: 'Any 2 Numbers + English Letter', prizeRs: 2000, when: s => s.setCount === 2 && s.letter },
      { tier: '7TH', label: 'Any 2 Numbers', prizeRs: 200, when: s => s.setCount === 2 },
      { tier: '8TH', label: 'Any 1 Number + English Letter', prizeRs: 200, when: s => s.setCount === 1 && s.letter },
      { tier: '9TH', label: 'Any Single Number', prizeRs: 40, when: s => s.setCount === 1 },
      { tier: '10TH', label: 'Any English Letter', prizeRs: 40, when: s => s.setCount === 0 && s.letter },
      { tier: '11TH', label: 'Super Number', prizeRs: 40, when: s => s.setCount === 0 && !s.letter && s.superN },
    ];
    return evalTiers(kaprukaTiers, s);
  }

  // 8. Mahajana Sampatha (NLB) - 6 Numbers Positional
  if (slug === 'mahajana-sampatha') {
    const mahajanaTiers: TierCandidate[] = [
      { tier: 'SUPER', label: 'Letter and 6 Numbers Correct', prizeRs: 20000000, when: s => s.posStart === 6 && s.posEnd === 6 && s.letter },
      { tier: '1ST', label: '6 Numbers Correct', prizeRs: 2500000, when: s => s.posStart === 6 && s.posEnd === 6 },
      { tier: '2ND', label: 'Last 5 Numbers Correct', prizeRs: 100000, when: s => s.posEnd === 5 },
      { tier: '3RD', label: 'Last 4 Numbers Correct', prizeRs: 15000, when: s => s.posEnd === 4 },
      { tier: '4TH', label: 'Last 3 Numbers Correct', prizeRs: 2000, when: s => s.posEnd === 3 },
      { tier: '5TH', label: 'Last 2 Numbers Correct', prizeRs: 200, when: s => s.posEnd === 2 },
      { tier: '6TH', label: 'Last Single Digit Correct', prizeRs: 40, when: s => s.posEnd === 1 },
      { tier: '7TH', label: 'First 5 Numbers Correct', prizeRs: 100000, when: s => s.posStart === 5 },
      { tier: '8TH', label: 'First 4 Numbers Correct', prizeRs: 2000, when: s => s.posStart === 4 },
      { tier: '9TH', label: 'First 3 Numbers Correct', prizeRs: 200, when: s => s.posStart === 3 },
      { tier: '10TH', label: 'First 2 Numbers Correct', prizeRs: 80, when: s => s.posStart === 2 },
      { tier: '11TH', label: 'First Single Digit Correct', prizeRs: 40, when: s => s.posStart === 1 },
      { tier: 'LETTER', label: 'Letter Correct', prizeRs: 40, when: s => s.letter && s.posStart === 0 && s.posEnd === 0 },
    ];
    return evalTiers(mahajanaTiers, s);
  }

  // 9. Supiri Dhana Sampatha (DLB) - 6 Numbers Positional with Any Order fallback
  if (slug === 'supiri-dhana-sampatha') {
    const supiriTiers: TierCandidate[] = [
      { tier: 'SUPER', label: 'Letter and 6 Numbers Correct', prizeRs: 20000000, when: s => s.posStart === 6 && s.posEnd === 6 && s.letter },
      { tier: '1ST', label: '6 Numbers Correct in Exact Order', prizeRs: 2500000, when: s => s.posStart === 6 && s.posEnd === 6 },
      { tier: '2ND', label: 'Last 5 Numbers Correct', prizeRs: 100000, when: s => s.posEnd === 5 },
      { tier: '3RD', label: 'Last 4 Numbers Correct', prizeRs: 20000, when: s => s.posEnd === 4 },
      { tier: '4TH', label: 'Last 3 Numbers Correct', prizeRs: 2000, when: s => s.posEnd === 3 },
      { tier: '5TH', label: 'Last 2 Numbers Correct', prizeRs: 200, when: s => s.posEnd === 2 },
      { tier: '6TH', label: 'Last Single Digit Correct', prizeRs: 40, when: s => s.posEnd === 1 },
      { tier: '7TH', label: 'First 5 Numbers Correct', prizeRs: 100000, when: s => s.posStart === 5 },
      { tier: '8TH', label: 'First 4 Numbers Correct', prizeRs: 2000, when: s => s.posStart === 4 },
      { tier: '9TH', label: 'First 3 Numbers Correct', prizeRs: 200, when: s => s.posStart === 3 },
      { tier: '10TH', label: 'First 2 Numbers Correct', prizeRs: 120, when: s => s.posStart === 2 },
      { tier: '11TH', label: 'First Single Digit Correct', prizeRs: 40, when: s => s.posStart === 1 },
      { tier: 'ANY_ORDER', label: 'All 6 Numbers (any order)', prizeRs: 500, when: s => s.setCount === 6 && s.posStart < 6 },
      { tier: 'LETTER', label: 'Letter Correct', prizeRs: 40, when: s => s.letter && s.posStart === 0 && s.posEnd === 0 },
    ];
    return evalTiers(supiriTiers, s);
  }

  // 10. NLB Jaya (NLB) - 4 Numbers Positional
  if (slug === 'nlb-jaya') {
    const nlbJayaTiers: TierCandidate[] = [
      { tier: 'SUPER', label: 'Letter and 4 Numbers Correct', prizeRs: 500000, when: s => s.posStart === 4 && s.posEnd === 4 && s.letter },
      { tier: '1ST', label: '4 Numbers Correct', prizeRs: 50000, when: s => s.posStart === 4 && s.posEnd === 4 },
      { tier: '3RD', label: 'Last 3 Numbers Correct', prizeRs: 2000, when: s => s.posEnd === 3 },
      { tier: '4TH', label: 'Last 2 Numbers Correct', prizeRs: 200, when: s => s.posEnd === 2 },
      { tier: '5TH', label: 'Last Number Correct', prizeRs: 40, when: s => s.posEnd === 1 },
      { tier: '6TH', label: 'First 3 Numbers Correct', prizeRs: 200, when: s => s.posStart === 3 },
      { tier: '7TH', label: 'First 2 Numbers Correct', prizeRs: 80, when: s => s.posStart === 2 },
      { tier: '8TH', label: 'First Number Correct', prizeRs: 40, when: s => s.posStart === 1 },
      { tier: 'LETTER', label: 'Letter Correct', prizeRs: 40, when: s => s.letter && s.posStart === 0 && s.posEnd === 0 },
    ];
    return evalTiers(nlbJayaTiers, s);
  }

  // 11. Jaya Sampatha (DLB) - 4 Numbers strictly back to forward
  if (slug === 'jaya-sampatha') {
    const jayaTiers: TierCandidate[] = [
      { tier: 'TOP', label: 'All 4 numbers back to forward + English Letter', prizeRs: 250000, when: s => s.posEnd === 4 && s.letter },
      { tier: '2ND', label: '4 numbers in order from back to forward', prizeRs: 50000, when: s => s.posEnd === 4 },
      { tier: '3RD', label: 'Matching 3 numbers from back to forward', prizeRs: 4000, when: s => s.posEnd === 3 },
      { tier: '4TH', label: '2 printed numbers from back to forward', prizeRs: 1000, when: s => s.posEnd === 2 },
      { tier: '5TH', label: 'English Letter', prizeRs: 80, when: s => s.letter && s.posEnd < 2 },
    ];
    return evalTiers(jayaTiers, s);
  }

  // 12. Sasiri (DLB) - 3 numbers set match
  if (slug === 'sasiri') {
    const sasiriTiers: TierCandidate[] = [
      { tier: '1ST', label: 'Any 3 Numbers', prizeRs: 200000, when: s => s.setCount === 3 },
      { tier: '2ND', label: 'Any 2 Numbers', prizeRs: 400, when: s => s.setCount === 2 },
      { tier: '3RD', label: 'Any Single Number', prizeRs: 40, when: s => s.setCount === 1 },
    ];
    return evalTiers(sasiriTiers, s);
  }

  // 13. Ada Sampatha (NLB) - sub games or direct 4 numbers
  if (slug === 'ada-sampatha') {
    const adaSampathaTiers: TierCandidate[] = [
      { tier: '2ND', label: '4 Numbers and Letter Correct', prizeRs: 250000, when: s => s.setCount === 4 && s.letter },
      { tier: '1ST', label: '4 Numbers Correct', prizeRs: 50000, when: s => s.setCount === 4 },
      { tier: '3RD', label: 'Letter Correct', prizeRs: 80, when: s => s.setCount === 0 && s.letter },
    ];
    return evalTiers(adaSampathaTiers, s);
  }

  // 14. Suba Dawasak (NLB)
  if (slug === 'suba-dawasak') {
    const subaTiers: TierCandidate[] = [
      { tier: '1ST', label: 'Zodiac and 3 Numbers Correct', prizeRs: 500000, when: s => s.setCount === 3 && s.zodiac },
      { tier: '2ND', label: '3 Numbers Correct', prizeRs: 50000, when: s => s.setCount === 3 },
      { tier: '3RD', label: 'Zodiac and Any 2 Numbers Correct', prizeRs: 2500, when: s => s.setCount === 2 && s.zodiac },
      { tier: '4TH', label: 'Any 2 Numbers Correct', prizeRs: 1000, when: s => s.setCount === 2 },
      { tier: '5TH', label: 'Zodiac and Any Number Correct', prizeRs: 200, when: s => s.setCount === 1 && s.zodiac },
      { tier: '6TH', label: 'Any Number Correct', prizeRs: 40, when: s => s.setCount === 1 },
      { tier: '7TH', label: 'Zodiac Correct', prizeRs: 40, when: s => s.setCount === 0 && s.zodiac },
    ];
    return evalTiers(subaTiers, s);
  }

  // 15. Waasi (DLB)
  if (slug === 'waasi') {
    const waasiTiersList: TierCandidate[] = [
      { tier: 'TOP', label: '2 Numbers + English Letter + Super Number', prizeRs: 1000000, when: s => s.setCount === 2 && s.letter && s.superN },
      { tier: '2ND', label: '2 Numbers + English Letter', prizeRs: 500000, when: s => s.setCount === 2 && s.letter },
      { tier: '3RD', label: '2 Numbers + Super Number', prizeRs: 50000, when: s => s.setCount === 2 && s.superN },
      { tier: '4TH', label: '2 Numbers', prizeRs: 25000, when: s => s.setCount === 2 },
      { tier: '5TH', label: '1 Number + Super Number + English Letter', prizeRs: 1000, when: s => s.setCount === 1 && s.superN && s.letter },
      { tier: '6TH', label: '1 Number + English Letter', prizeRs: 500, when: s => s.setCount === 1 && s.letter },
      { tier: '7TH', label: '1 Number + Super Number', prizeRs: 500, when: s => s.setCount === 1 && s.superN },
      { tier: '8TH', label: 'Super Number + English Letter', prizeRs: 120, when: s => s.setCount === 0 && s.superN && s.letter },
      { tier: '9TH', label: '1 Number Only', prizeRs: 40, when: s => s.setCount === 1 },
      { tier: '10TH', label: 'English Letter', prizeRs: 40, when: s => s.setCount === 0 && s.letter },
      { tier: '11TH', label: 'Only Super Number', prizeRs: 40, when: s => s.setCount === 0 && s.superN },
    ];
    return evalTiers(waasiTiersList, s);
  }

  // General Fallback
  if (s.setCount >= 3) {
    const fallbackPrize = s.setCount === 4 ? 2000000 : 5000;
    return {
      won: true,
      tier: `MATCH_${s.setCount}`,
      prizeLabel: `${s.setCount} Numbers Matched`,
      prizeAmountRs: fallbackPrize,
      prizeAmountFormatted: formatRs(fallbackPrize),
      matchedNumbers: s.matchedSet,
      matchedNumbersCount: s.setCount,
      letterMatched: s.letter,
      zodiacMatched: s.zodiac,
      superNumberMatched: s.superN
    };
  }

  return {
    won: false,
    tier: null,
    prizeLabel: 'දිනුමක් නොමැත (No Prize Won)',
    prizeAmountRs: 0,
    prizeAmountFormatted: 'Rs. 0.00',
    matchedNumbers: s.matchedSet,
    matchedNumbersCount: s.setCount,
    letterMatched: s.letter,
    zodiacMatched: s.zodiac,
    superNumberMatched: s.superN
  };
}
