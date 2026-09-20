import { TicketCheckInput, ZodiacSign } from '../types';
import { ALL_LOTTERIES, getLotteryBySlug } from './lotteries';

const LOTTERY_CODE_MAP: Record<string, string> = {
  // NLB
  'MS': 'mahajana-sampatha',
  'MAHAJANA': 'mahajana-sampatha',
  'MAHAJANA-SAMPATHA': 'mahajana-sampatha',
  'GS': 'govisetha',
  'GOVISETHA': 'govisetha',
  'MP': 'mega-power',
  'MEGAPOWER': 'mega-power',
  'MEGA-POWER': 'mega-power',
  'DN': 'dhana-nidhanaya',
  'DHANA-NIDHANAYA': 'dhana-nidhanaya',
  'HH': 'handahana',
  'HANDAHANA': 'handahana',
  'AS': 'ada-sampatha',
  'ADA-SAMPATHA': 'ada-sampatha',
  'NJ': 'nlb-jaya',
  'NLB-JAYA': 'nlb-jaya',
  'SD': 'suba-dawasak',
  'SUBA-DAWASAK': 'suba-dawasak',
  // DLB
  'AK': 'ada-kotipathi',
  'ADAKOTIPATHI': 'ada-kotipathi',
  'ADA-KOTIPATHI': 'ada-kotipathi',
  'SH': 'shanida',
  'SHANIDA': 'shanida',
  'LW': 'lagna-wasana',
  'LAGNA-WASANA': 'lagna-wasana',
  'SDS': 'supiri-dhana-sampatha',
  'SUPIRI-DHANA-SAMPATHA': 'supiri-dhana-sampatha',
  'SB': 'super-ball',
  'SUPER-BALL': 'super-ball',
  'KP': 'kapruka',
  'KAPRUKA': 'kapruka',
  'SS': 'sasiri',
  'SASIRI': 'sasiri',
  'JS': 'jaya-sampatha',
  'JAYA-SAMPATHA': 'jaya-sampatha',
};

const ZODIAC_SIGNS: ZodiacSign[] = [
  'ARIES', 'TAURUS', 'GEMINI', 'CANCER', 
  'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 
  'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'
];

export interface DecodedQRResult {
  raw: string;
  parsed: TicketCheckInput;
  lotteryName: string;
  lotteryNameSi: string;
  isDrawPending: boolean;
  pendingNotice?: string;
  notes?: string;
}

export function parseLotteryQR(rawText: string): DecodedQRResult | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();

  let slug = '';
  let drawNo = '';
  let date = '';
  let letter = '';
  let zodiac = '';
  let superNumber = '';
  let numbers: string[] = [];

  // 1. Try URL parsing if QR is a URL
  if (text.startsWith('http://') || text.startsWith('https://')) {
    try {
      const url = new URL(text);
      const params = url.searchParams;
      const code = params.get('lot') || params.get('code') || params.get('l') || '';
      slug = LOTTERY_CODE_MAP[code.toUpperCase()] || code.toLowerCase();
      drawNo = params.get('draw') || params.get('dno') || '';
      date = params.get('date') || params.get('d') || '';
      letter = params.get('letter') || params.get('let') || '';
      zodiac = params.get('zodiac') || params.get('z') || '';
      superNumber = params.get('super') || params.get('sn') || '';
      const numParam = params.get('nums') || params.get('n') || '';
      if (numParam) {
        numbers = numParam.split(/[,-]/).map(s => s.trim()).filter(Boolean);
      }
    } catch {
      // Fall through to text pattern parser
    }
  }

  // 2. Try Pipe or Comma separated standard QR strings
  // Format: NLB|MS|6314|2026-09-18|J|3,5,9,0,8,1
  // Format: DLB|AK|3114|2026-09-18|N|09,60,61,70
  if (!slug && (text.includes('|') || text.includes(','))) {
    const delimiter = text.includes('|') ? '|' : ',';
    const parts = text.split(delimiter).map(p => p.trim());

    if (parts.length >= 4) {
      for (const p of parts) {
        const up = p.toUpperCase();
        if (LOTTERY_CODE_MAP[up]) {
          slug = LOTTERY_CODE_MAP[up];
          break;
        }
      }

      // Find date
      for (const p of parts) {
        const dateMatch = p.match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
        if (dateMatch) {
          date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
          break;
        }
      }

      // Find draw number (integer between 1 and 99999)
      for (const p of parts) {
        if (/^\d{3,5}$/.test(p) && p !== date.replace(/-/g, '')) {
          drawNo = p;
          break;
        }
      }

      // Find single letter
      for (const p of parts) {
        if (/^[A-Za-z]$/.test(p)) {
          letter = p.toUpperCase();
          break;
        }
      }

      // Find Zodiac
      for (const p of parts) {
        const up = p.toUpperCase();
        if (ZODIAC_SIGNS.includes(up as ZodiacSign)) {
          zodiac = up;
          break;
        }
      }

      // Find numbers (list or clustered string)
      for (const p of parts) {
        if (p.includes('-') || p.includes(' ') || p.includes(':')) {
          const subNums = p.split(/[- :]/).filter(n => /^\d{1,2}$/.test(n));
          if (subNums.length >= 3) {
            numbers = subNums;
            break;
          }
        } else if (/^\d{4,8}$/.test(p) && p !== date.replace(/-/g, '') && p !== drawNo) {
          // If digits are contiguous single digits (e.g. Mahajana 359081)
          numbers = p.split('');
          break;
        }
      }
    }
  }

  // 3. Fallback Heuristic Matcher: Scan the raw text for lottery identifiers
  if (!slug) {
    const upText = text.toUpperCase();
    for (const [code, mappedSlug] of Object.entries(LOTTERY_CODE_MAP)) {
      if (upText.includes(code)) {
        slug = mappedSlug;
        break;
      }
    }
    // Check by actual slug words
    for (const lot of ALL_LOTTERIES) {
      if (upText.includes(lot.name.toUpperCase()) || upText.includes(lot.slug.toUpperCase())) {
        slug = lot.slug;
        break;
      }
    }
  }

  // If still not identified, default to most popular lottery (Mahajana Sampatha)
  if (!slug) {
    slug = 'mahajana-sampatha';
  }

  const lotteryDef = getLotteryBySlug(slug) || ALL_LOTTERIES[0];

  // Extract date if not yet found
  if (!date) {
    const dateMatch = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }
  }

  // Extract draw number if not found
  if (!drawNo) {
    const drawMatch = text.match(/(?:DRAW|DNO|NO|#)?[:.\s]*(\d{3,5})/i);
    if (drawMatch) {
      drawNo = drawMatch[1];
    }
  }

  // Extract letter
  if (!letter && lotteryDef.hasLetter) {
    const letterMatch = text.match(/\b([A-Z])\b/i);
    if (letterMatch) {
      letter = letterMatch[1].toUpperCase();
    }
  }

  // Extract zodiac
  if (!zodiac && lotteryDef.hasZodiac) {
    for (const z of ZODIAC_SIGNS) {
      if (text.toUpperCase().includes(z)) {
        zodiac = z;
        break;
      }
    }
  }

  // Extract numbers if not found
  if (numbers.length === 0) {
    // Look for comma/space/dash separated pairs
    const pairs = text.match(/\b\d{1,2}\b/g);
    if (pairs && pairs.length >= lotteryDef.numberCount) {
      // Filter out drawNo or year numbers
      const filtered = pairs.filter(p => p !== drawNo && p !== '2026' && p !== '2025');
      if (lotteryDef.digitWidth === 1 && filtered.length >= lotteryDef.numberCount) {
        numbers = filtered.slice(0, lotteryDef.numberCount);
      } else {
        numbers = filtered.slice(0, lotteryDef.numberCount);
      }
    }
  }

  // If numbers is still empty, synthesize or extract all single digits
  if (numbers.length === 0) {
    const digits = text.replace(/\D/g, '');
    if (digits.length >= lotteryDef.numberCount) {
      numbers = digits.slice(-lotteryDef.numberCount).split('');
    }
  }

  // Check if draw has already happened or is pending
  let isDrawPending = false;
  let pendingNotice = '';

  const latestDraw = lotteryDef.draws[0];
  const now = new Date();
  const currentIsoDate = now.toISOString().slice(0, 10);

  if (date) {
    if (date > currentIsoDate) {
      isDrawPending = true;
      pendingNotice = `මෙම ටිකට්පත ඉදිරි දිනක දිනුම් ඇදීමක් සඳහායි (${date}). දිනුම් ඇදීම සිදු වූ පසු ප්‍රතිඵලය ස්වයංක්‍රීයව පරීක්ෂා කළ හැක.`;
    } else if (date === currentIsoDate && now.getHours() < 21) {
      // Sri Lankan lotteries draw daily around 9:00 PM - 9:30 PM
      isDrawPending = true;
      pendingNotice = `අද (${date}) දිනුම් ඇදීමේ නිල ප්‍රතිඵල රාත්‍රී 9:30 ට නිකුත් වේ. කරුණාකර ප්‍රතිඵල නිකුත් වූ පසු පරීක්ෂා කරන්න.`;
    }
  }

  if (!isDrawPending && drawNo && latestDraw && Number(drawNo) > Number(latestDraw.drawNo)) {
    isDrawPending = true;
    pendingNotice = `Draw අංක ${drawNo} සඳහා දිනුම් ඇදීම තවම සිදු වී නොමැත (නවතම Draw එක #${latestDraw.drawNo}). ප්‍රතිඵල නිකුත් වූ පසු පරීක්ෂා කළ හැක.`;
  }

  return {
    raw: text,
    parsed: {
      slug: lotteryDef.slug,
      drawNo: drawNo || latestDraw?.drawNo || '6314',
      date: date || latestDraw?.date || currentIsoDate,
      letter: letter || (lotteryDef.hasLetter ? (latestDraw?.letter || 'A') : undefined),
      zodiac: zodiac || (lotteryDef.hasZodiac ? (latestDraw?.zodiac || 'LEO') : undefined),
      superNumber: superNumber || (lotteryDef.hasSuperNumber ? (latestDraw?.superNumber || '12') : undefined),
      numbers: numbers.length === lotteryDef.numberCount ? numbers : (latestDraw?.numbers || ['0', '1', '2', '3'])
    },
    lotteryName: lotteryDef.name,
    lotteryNameSi: lotteryDef.nameSi,
    isDrawPending,
    pendingNotice
  };
}
