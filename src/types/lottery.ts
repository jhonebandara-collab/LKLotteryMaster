export type Language = 'si' | 'en' | 'ta';

export interface LotteryDraw {
  drawNo: string;
  date: string;
  dateText?: string;
  letter: string | null;
  zodiac: string | null;
  superNumber: string | null;
  numbers: string[];
  jackpotAmount?: number | null;
  subGames?: {
    title?: string;
    letter: string | null;
    zodiac: string | null;
    superNumber: string | null;
    numbers: string[];
  }[];
}

export interface LotteryInfo {
  provider: 'NLB' | 'DLB';
  slug: string;
  name: string;
  code?: string;
  nameSi?: string;
  nameTa?: string;
  draws: LotteryDraw[];
  drawDays?: string;
  hasLetter?: boolean;
  hasZodiac?: boolean;
  hasSuperNumber?: boolean;
  numberCount?: number;
  ballCount?: number;
  digitWidth?: number;
}

export interface CheckTicketParams {
  slug: string;
  drawNo?: string;
  date?: string;
  letter?: string | null;
  zodiac?: string | null;
  superNumber?: string | null;
  numbers: string[];
  subGameIndex?: number;
  source?: 'qr' | 'ai' | 'manual';
}

export interface PrizeEvaluation {
  won: boolean;
  tier: string | null;
  prizeLabel: string | null;
  prizeAmountRs: number | null;
  prizeAmountFormatted: string | null;
  matchedCount: number;
  matchedNumbers: string[];
  totalNumbers?: number;
  letterMatch?: boolean;
  zodiacMatch?: boolean;
  superNumberMatch?: boolean;
  note?: string | null;
  subGameIndex?: number;
  unavailable?: boolean;
}

export interface CheckResult extends PrizeEvaluation {
  lottery: {
    provider: 'NLB' | 'DLB';
    slug: string;
    name: string;
    nameSi?: string;
  };
  draw: {
    drawNo: string;
    date: string;
    letter?: string | null;
    zodiac?: string | null;
    superNumber?: string | null;
    numbers: string[];
  };
  ticket: {
    letter?: string | null;
    zodiac?: string | null;
    superNumber?: string | null;
    numbers: string[];
  };
  disclaimer: string;
  timestamp: string;
}

/** How a scanned payload was bound to an official draw record. */
export type DrawMatchMethod = 'drawNo' | 'date' | 'drawNo+date' | 'manual' | 'none';

/**
 * Result of binding a scanned ticket to an official draw.
 * `needs-review` means we refused to guess — the user must pick the draw.
 */
export type DrawResolutionStatus = 'verified' | 'needs-review' | 'not-found';

export interface ScanHistoryRecord {
  id: string;
  timestamp: number;
  lotterySlug: string;
  lotteryName: string;
  provider: 'NLB' | 'DLB';
  drawNo?: string;
  /** ISO date of the official draw that was used for evaluation */
  date?: string;
  scannedNumbers: string[];
  scannedLetter?: string | null;
  scannedZodiac?: string | null;
  scannedSuperNumber?: string | null;
  officialDraw?: LotteryDraw;
  prizeEvaluation: PrizeEvaluation;
  scanMethod: 'qr' | 'ai' | 'manual';
  /** exact string decoded from QR / read by AI, kept for auditing */
  rawPayload?: string;
  matchMethod?: DrawMatchMethod;
  resolutionStatus?: DrawResolutionStatus;
  warnings?: string[];
  subGameIndex?: number;
  /** the draw number printed on the physical ticket (may differ from the matched draw) */
  printedDrawNo?: string | null;
  /** the date printed on the physical ticket (ISO) */
  printedDate?: string | null;
}

export interface UserAccount {
  email: string;
  name: string;
  isLoggedIn: boolean;
  plan: 'free' | 'rs300' | 'rs450' | 'rs700';
  planExpiresAt?: string;
  scansUsedTotal: number;
  scansRemaining: number;
  disclaimerAccepted: boolean;
  testingMode: boolean;
}
