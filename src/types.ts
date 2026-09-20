export type LotteryProvider = 'NLB' | 'DLB';

export type ZodiacSign = 
  | 'ARIES' | 'TAURUS' | 'GEMINI' | 'CANCER' 
  | 'LEO' | 'VIRGO' | 'LIBRA' | 'SCORPIO' 
  | 'SAGITTARIUS' | 'CAPRICORN' | 'AQUARIUS' | 'PISCES';

export interface LotteryDraw {
  drawNo: string;
  date: string; // YYYY-MM-DD
  dateText?: string;
  letter?: string | null;
  zodiac?: string | null;
  superNumber?: string | null;
  numbers: string[];
  subGames?: Array<{
    letter?: string | null;
    zodiac?: string | null;
    superNumber?: string | null;
    numbers: string[];
  }>;
}

export interface LotteryDefinition {
  id: string;
  slug: string;
  name: string;
  nameSi: string;
  provider: LotteryProvider;
  drawDays: string[]; // e.g. ['Daily'] or ['Mon', 'Wed', 'Fri']
  hasLetter: boolean;
  hasZodiac: boolean;
  hasSuperNumber: boolean;
  numberCount: number;
  digitWidth: number; // 1 for single digits (e.g. Mahajana 0-9), 2 for 01-99
  color: string;
  superPrizeStarting: string;
  draws: LotteryDraw[];
}

export interface TicketCheckInput {
  slug: string;
  drawNo?: string;
  date?: string;
  letter?: string;
  zodiac?: string;
  superNumber?: string;
  numbers: string[];
  subGameIndex?: number;
}

export interface PrizeEvaluationResult {
  won: boolean;
  isDrawPending?: boolean;
  drawPendingDate?: string;
  tier: string | null;
  prizeLabel: string | null;
  prizeAmountRs: number;
  prizeAmountFormatted: string | null;
  note?: string | null;
  matchedNumbersCount?: number;
  matchedNumbers?: string[];
  letterMatched?: boolean;
  zodiacMatched?: boolean;
  superNumberMatched?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  provider: 'google' | 'email';
  plan: 'free' | 'starter' | 'pro' | 'master';
  planExpiresAt?: string;
  searchesUsedToday: number;
  searchesTotalMonth: number;
  maxSearchesMonth: number;
  disclaimerAccepted: boolean;
  disclaimerAcceptedAt?: string;
  disclaimerAcceptedVersion?: string;
  savedTickets?: SavedTicket[];
}

export interface SavedTicket {
  id: string;
  slug: string;
  drawNo?: string;
  drawDate?: string;
  letter?: string;
  zodiac?: string;
  superNumber?: string;
  numbers: string[];
  createdAt: string;
  status: 'pending' | 'won' | 'lost';
  prizeAmountRs?: number;
}

export interface DisclaimerRecord {
  id: string;
  userId?: string;
  userEmail: string;
  userName?: string;
  acceptedAt: string;
  version: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SubscriptionPlan {
  id: 'starter' | 'pro' | 'master';
  name: string;
  nameSi: string;
  searches: number;
  priceRs: number;
  validityDays: number;
  description: string;
  features: string[];
}

export interface AIGuessResult {
  lotterySlug: string;
  lotteryName: string;
  confidence: number;
  recommendedNumbers: string[];
  recommendedLetter?: string;
  recommendedZodiac?: string;
  recommendedSuperNumber?: string;
  hotNumbers: Array<{ number: string; frequency: number }>;
  overdueNumbers: Array<{ number: string; drawsAgo: number }>;
  expectedSumRange: string;
  analysisReasoningSi: string;
  generatedAt: string;
}
