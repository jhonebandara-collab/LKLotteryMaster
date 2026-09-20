/**
 * lucky.js — "🍀 මගේ වාසනාව" (Lucky Guess) engine
 *
 * ⚠️ මේ මොකක්ද — සහ මොකක්ද නෙවෙයිද
 * -------------------------------------
 * මෙය **අනාවැකි කීමක් නොවේ**. ලොතරැයි අංක තීරණය වෙන්නේ සම්පූර්ණයෙන්ම
 * අහඹු ලෙසයි — පසුගිය ප්‍රතිඵල වලින් ඉදිරි ප්‍රතිඵලයක් ගණනය කරන්න බෑ.
 *
 * අපි මෙතන කරන්නේ දේවල් 3ක් එකට එකතු කරන එකයි:
 *   1. **සැබෑ සංඛ්‍යාලේඛන** — scrape කරපු ප්‍රතිඵල වලින් ගණනය කරන ලද
 *      අංක වල වාර ගණන, හිඩැස් (gaps), ඉරට්ටේ/ඔත්තේ, එකතුව, අකුරු/රාශි
 *      වාර ගණන. මේවා ඇත්තටම මනින ලද දත්ත.
 *   2. **සාම්ප්‍රදායික සංඛ්‍යා ශාස්ත්‍රය (numerology)** — උපන් දිනය, උපන්
 *      වේලාව සහ නමෙන් ගණනය කරන සංඛ්‍යා. මේවා විනෝදාත්මක පදනමක් මිස
 *      විද්‍යාත්මක සාධක නොවේ.
 *   3. **AI එකේ යෝජනාව** — උඩ දෙක බලලා අංක ටිකක් යෝජනා කරනවා.
 *
 * ඒ නිසා ප්‍රතිඵලය හැමවෙලාවෙම "වාසනාව මත පදනම් වූ යෝජනාවක්" විදිහට
 * පෙන්නනවා — දිනුම් ලැබීමට කිසිම සහතිකයක් නෑ. client එකෙන් හැම වතාවකම
 * disclaimer එකට එකඟ වෙන්න ඕන (server එකෙනුත් enforce කරනවා).
 */

'use strict';

require('./env');

const { prepare } = require('./db');
const vision = require('./vision');
const lotteryMeta = require('./lottery-meta');

// ---------------------------------------------------------------
// Disclaimer — server එකේ තියෙන එකම පිටපත. Frontend එක මේක පෙන්නලා
// user එකෙන් එකඟ වීම ඉල්ලනවා, ඊට පස්සේ `agreedDisclaimer: DISCLAIMER_VERSION`
// යවනවා. Server එක ඒක නැතුව guess එකක් හදන්නේ නෑ.
// ---------------------------------------------------------------
const DISCLAIMER_VERSION = 'v1';

const DISCLAIMER_SI = [
  'මෙය විනෝදාත්මක අංගයක් පමණි.',
  '',
  'මෙහි දක්වන "අනුමානය" (guess) යනු ඔබගේ නම, උපන් දිනය සහ උපන් වේලාව මත පදනම්ව',
  'ගණනය කරන ලද සාම්ප්‍රදායික සංඛ්‍යා ශාස්ත්‍රීය (numerology) සංඥා සහ පසුගිය ලොතරැයි',
  'ප්‍රතිඵලවල සංඛ්‍යාලේඛන පමණක් සලකා AI තාක්ෂණය මගින් ජනනය කරන ලද යෝජනාවකි.',
  '',
  'ලොතරැයි අංක තීරණය වන්නේ සම්පූර්ණයෙන්ම අහඹු ලෙස බැවින්, මෙය සත්‍ය අනාවැකියක් නොවේ.',
  'දිනුම් ලැබීමට කිසිදු සහතිකයක් නොමැති අතර, සම්භාවිතාව ද වැඩි වන්නේ නැත.',
  '',
  'මෙම අනුමානය භාවිතා කිරීමෙන් ඇතිවිය හැකි කිසිදු මූල්‍යමය පාඩුවකට හෝ වෙනත්',
  'කිසිදු වගකීමක් මෙම යෙදුම හෝ එහි සංවර්ධකයා වගකීමක් නොබාරගනී. කරුණාකර වගකීමෙන්',
  'යුතුව, ඔබට අහිමි වීමට ඉඩ දිය හැකි මුදලක් පමණක් යොදන්න.',
].join('\n');

// ---------------------------------------------------------------
// Deterministic PRNG — එකම user + එකම draw සඳහා එකම base යෝජනාව
// ලැබෙන්න (ගණනය කරන දේ පැහැදිලි සහ පුනරාවර්තනීය වෙන්න).
// ---------------------------------------------------------------
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------
// සාම්ප්‍රදායික සංඛ්‍යා ශාස්ත්‍රය (numerology)
// ---------------------------------------------------------------
const PLANETS = {
  1: { en: 'Sun',     si: 'රවි' },
  2: { en: 'Moon',    si: 'සඳු' },
  3: { en: 'Jupiter', si: 'ගුරු' },
  4: { en: 'Rahu',    si: 'රාහු' },
  5: { en: 'Mercury', si: 'බුධ' },
  6: { en: 'Venus',   si: 'සිකුරු' },
  7: { en: 'Ketu',    si: 'කේතු' },
  8: { en: 'Saturn',  si: 'ශනි' },
  9: { en: 'Mars',    si: 'කුජ' },
};

const ELEMENTS = { 1: 'Fire', 2: 'Water', 3: 'Air', 4: 'Earth', 5: 'Air',
                   6: 'Earth', 7: 'Water', 8: 'Earth', 9: 'Fire' };

/** ඉලක්කම් එකතු කර එක අංකයකට ගේනවා (1-9). Master numbers (11/22/33) හඳුනාගන්නවා. */
function reduceNumber(n, keepMaster = true) {
  let v = Math.abs(Number(n) || 0);
  while (v > 9) {
    if (keepMaster && (v === 11 || v === 22 || v === 33)) return v;
    v = String(v).split('').reduce((s, d) => s + Number(d), 0);
  }
  return v;
}

/** Pythagoras ක්‍රමය: A=1..I=9, J=1..K=9 ... (ලතින් අකුරු සඳහා) */
function nameNumberPythagorean(name) {
  const s = String(name || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!s) return null;
  let sum = 0;
  for (const ch of s) sum += ((ch.charCodeAt(0) - 65) % 9) + 1;
  return reduceNumber(sum, false);
}

/**
 * numerologyProfile({ fullName, birthday, birthTime, birthMeridiem })
 *
 * birthday  — 'YYYY-MM-DD'
 * birthTime — 'HH:MM'  (24h ලෙස save වෙනවා; AM/PM එක birthMeridiem එකේ)
 */
function numerologyProfile({ fullName, birthday, birthTime, birthMeridiem } = {}) {
  const dob = String(birthday || '').trim();
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const [, yy, mm, dd] = m;
  const day = Number(dd);
  const dobDigits = (yy + mm + dd).split('').reduce((s, d) => s + Number(d), 0);

  const lifePath = reduceNumber(dobDigits);                       // ජීවන මාර්ග අංකය
  const birthdayNumber = reduceNumber(day, false);                // උපන් දින අංකය

  const tm = String(birthTime || '').match(/^(\d{1,2}):(\d{2})$/);
  let timeDigits = null, timeNumber = null;
  let hour24 = null;
  if (tm) {
    hour24 = Number(tm[1]);
    timeDigits = (tm[1] + tm[2]).split('').reduce((s, d) => s + Number(d), 0);
    timeNumber = reduceNumber(timeDigits);
  }

  const nameNum = nameNumberPythagorean(fullName);
  const nameNumber = nameNum != null
    ? nameNum
    // ලතින් අකුරු නැත්නම් (උදා: සිංහල නමක්) — නමේ අකුරු වලින් ගණනය කරන
    //නිශ්චිත අංකයක් (deterministic) ගන්නවා. මෙය නිශ්චිත සම්ප්‍රදායක්
    // නොවන බව පැහැදිලි කරන්න ඕන — ඒ නිසා "නම් අංකය" කියලා විතරයි කියන්නේ.
    : reduceNumber(hashSeed(String(fullName || '')) % 100000, false);

  const luckyNumber = reduceNumber(lifePath + birthdayNumber + (nameNumber || 0) + (timeNumber || 0), false);

  const luckyDigits = Array.from(new Set([
    String(birthdayNumber), String(lifePath), String(luckyNumber),
    ...(timeNumber ? [String(timeNumber)] : []),
    String(day % 10),
  ])).filter(d => /^\d$/.test(d));

  return {
    fullName: fullName || null,
    birthday: dob,
    birthTime: birthTime || null,
    birthMeridiem: birthMeridiem || null,
    hour24,
    lifePath,
    birthdayNumber,
    timeNumber,
    nameNumber,
    luckyNumber,
    luckyDigits,
    planet: PLANETS[luckyNumber] || null,
    element: ELEMENTS[luckyNumber] || null,
    // මේවා විද්‍යාත්මක සාධක නොවන බව පැහැදිලිව කියන්න
    note: 'සාම්ප්‍රදායික සංඛ්‍යා ශාස්ත්‍රය අනුව ගණනය කළ සංඥා (විද්‍යාත්මක සාධක නොවේ)',
  };
}

// ---------------------------------------------------------------
// පසුගිය ප්‍රතිඵල විශ්ලේෂණය (සැබෑ සංඛ්‍යාලේඛන)
// ---------------------------------------------------------------
function numbersOf(draw) {
  return Array.isArray(draw.numbers) ? draw.numbers.map(String) : [];
}

/**
 * analyzeDraws(lottery) — data.json එකේ තියෙන draws වලින් pattern එකක් හොයනවා.
 * draws[0] අලුත්ම එක කියලා ගන්නවා (scraper එක ඒ විදිහටම ලියනවා).
 */
/**
 * drawRows(lottery, subGameIndex) — අදාළ game එකේ draw පේළිය (අලුත්ම එක මුලින්).
 *
 * analyzeDraws සහ ranking engine එක **එකම** පේළිය පාවිච්චි කරන්න ඕන —
 * නැත්නම් දෙකක් වෙනස් ප්‍රතිඵල දෙනවා.
 */
function drawRows(lottery, subGameIndex = null) {
  if (!lottery) return [];
  const meta = lotteryMeta.describeLottery(lottery);
  const isMulti = meta.prizeKind === 'multi' && Array.isArray(meta.subGames) && meta.subGames.length;
  return (lottery.draws || []).map(d => {
    const src = isMulti && Array.isArray(d.subGames) ? (d.subGames[subGameIndex != null ? subGameIndex : 0] || {}) : d;
    return {
      drawNo: d.drawNo,
      date: d.date,
      numbers: numbersOf(src),
      letter: (src.letter || '').toUpperCase() || null,
      zodiac: (src.zodiac || '').toUpperCase() || null,
      superNumber: src.superNumber != null && src.superNumber !== '' ? String(src.superNumber) : null,
    };
  }).filter(r => r.numbers.length);
}

function analyzeDraws(lottery, subGameIndex = null) {
  if (!lottery) return null;

  // ව්‍යුහය (අකුරු/රාශිය/ඉලක්කම් ගණන/positional ද) data එකෙනුයි prize
  // engine එකෙනුයි derive කරන්නේ — lottery-meta.js එකෙන් (තනි තැනක).
  const meta = lotteryMeta.describeLottery(lottery);
  const game = lotteryMeta.resolveGame(meta, subGameIndex);
  const isMulti = meta.prizeKind === 'multi' && Array.isArray(meta.subGames) && meta.subGames.length;
  const numberCount = game.numberCount || 0;
  const digitWidth = game.digitWidth || 2;

  const rows = drawRows(lottery, subGameIndex);

  const total = rows.length;

  // --- සමස්ත අංක වාර ගණන ---
  const freq = new Map();
  for (const r of rows) for (const n of r.numbers) freq.set(n, (freq.get(n) || 0) + 1);
  const frequency = [...freq.entries()]
    .map(([n, count]) => ({ n, count, pct: total ? Math.round((count / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count || a.n.localeCompare(b.n));

  // --- position අනුව වාර ගණන (position වැදගත් ලොතරැයි වලට) ---
  const byPosition = [];
  for (let i = 0; i < numberCount; i++) {
    const m = new Map();
    for (const r of rows) if (r.numbers[i] != null) m.set(r.numbers[i], (m.get(r.numbers[i]) || 0) + 1);
    byPosition.push({
      position: i + 1,
      top: [...m.entries()].map(([n, count]) => ({ n, count }))
        .sort((a, b) => b.count - a.count || a.n.localeCompare(b.n)).slice(0, 5),
    });
  }

  // --- හිඩැස් (කී draw එකක් තිස්සේ නොපෙනුනාද) ---
  const gaps = [...freq.keys()].map(n => {
    let g = 0;
    for (const r of rows) { if (r.numbers.includes(n)) break; g++; }
    return { n, gap: g, lastSeen: g < total ? rows[g].date : null };
  }).sort((a, b) => b.gap - a.gap);

  // --- ව්‍යුහාත්මක සංඛ්‍යාලේඛන ---
  const sums = rows.map(r => r.numbers.reduce((s, n) => s + Number(n), 0));
  const oddCounts = rows.map(r => r.numbers.filter(n => Number(n) % 2 === 1).length);
  const avg = a => (a.length ? Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 10) / 10 : null);

  // --- අකුරු / රාශි / super number ---
  const tally = key => {
    const m = new Map();
    for (const r of rows) if (r[key]) m.set(r[key], (m.get(r[key]) || 0) + 1);
    return [...m.entries()].map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
  };

  // --- එකට ආපු අංක යුගල (pairs) ---
  const pairMap = new Map();
  for (const r of rows) {
    const ns = [...new Set(r.numbers)].sort();
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const k = ns[i] + '-' + ns[j];
        pairMap.set(k, (pairMap.get(k) || 0) + 1);
      }
    }
  }
  const pairs = [...pairMap.entries()].map(([pair, count]) => ({ pair, count }))
    .filter(p => p.count > 1)
    .sort((a, b) => b.count - a.count).slice(0, 6);

  return {
    slug: lottery.slug,
    lotteryName: lottery.name,
    provider: lottery.provider,
    prizeKind: meta.prizeKind || null,
    positional: !!game.positional,
    subGameIndex: isMulti ? (subGameIndex != null ? subGameIndex : 0) : null,
    numberCount,
    digitWidth,
    hasLetter: !!game.hasLetter,
    hasZodiac: !!game.hasZodiac,
    hasSuperNumber: !!game.hasSuperNumber,
    drawsAnalyzed: total,
    dateRange: total ? { from: rows[total - 1].date, to: rows[0].date } : null,
    frequency,
    byPosition,
    gaps,
    stats: {
      avgSum: avg(sums),
      minSum: sums.length ? Math.min(...sums) : null,
      maxSum: sums.length ? Math.max(...sums) : null,
      avgOdd: avg(oddCounts),
      avgEven: oddCounts.length ? Math.round((numberCount - avg(oddCounts)) * 10) / 10 : null,
    },
    letters: game.hasLetter ? tally('letter') : [],
    zodiacs: game.hasZodiac ? tally('zodiac') : [],
    superNumbers: game.hasSuperNumber ? tally('superNumber') : [],
    pairs,
    recent: rows.slice(0, 8),
  };
}

/** hot / cold / overdue — පෙන්නන්න සහ AI එකට දෙන්න */
function summarizePatterns(p) {
  if (!p) return null;
  return {
    hot: p.frequency.slice(0, 6).map(f => f.n),
    cold: p.frequency.slice(-6).map(f => f.n).reverse(),
    overdue: p.gaps.slice(0, 6).map(g => ({ n: g.n, drawsAgo: g.gap })),
    hotLetter: p.letters[0] ? p.letters[0].value : null,
    hotZodiac: p.zodiacs[0] ? p.zodiacs[0].value : null,
    hotSuperNumber: p.superNumbers[0] ? p.superNumbers[0].value : null,
    topPairs: p.pairs.slice(0, 3).map(x => x.pair),
  };
}

// ---------------------------------------------------------------
// සංඛ්‍යාලේඛන පදනම් කරගෙන base යෝජනාවක්
// ---------------------------------------------------------------
function digitPad(v, width) {
  return String(v).padStart(width, '0').slice(-width);
}

// ===============================================================
// 🧮 ඊළඟ draw එකට ශ්‍රේණිගත කිරීමේ එන්ජිම (ranking engine)
// ===============================================================
/**
 * ⚠️ සැබෑ ලොතරැයි අංක අහඹුයි. මේ එන්ජිම **අනාවැකි කියන්නේ නෑ** —
 * පසුගිය ප්‍රතිඵලවල තියෙන සංඛ්‍යාලේඛන රටාවන් (වාර ගණන, මෑතකාලීනත්වය,
 * හිඩැස, සංක්‍රමණ සම්භාවිතාව) එකට බර දීලා **ශ්‍රේණිගත යෝජනා** දෙනවා.
 * ඕනෑම ලොතරැයියක දිනුම් අවස්ථාව වැඩි කරන්න මේකට බෑ — පාරදෘශ්‍ය
 * විශ්ලේෂණ මෙවලමක් විතරයි.
 *
 * බර (weights): සංඛ්‍යාලේඛන පර්යේෂණවල පොදුවේ පාවිච්චි වන
 * "hot + recency + overdue + transition" මිශ්‍රණයක්. මේවා **අපේ තේරීමක්**,
 * ලොතරැයි විශේෂඥයින් විසින් තහවුරු කළ පරාමිතීන් නොවේ.
 */
const RANK_WEIGHTS = {
  frequency: 0.34,   // සමස්ත වාර ගණන (hot)
  recency: 0.26,     // මෑතකදී කී වතාවක් ආවද (exponential decay)
  overdue: 0.18,     // කී draw එකක් තිස්සේ නොපෙනුනාද (expectation එකට සාපේක්ෂව)
  transition: 0.14,  // අලුත්ම draw එකට සමාන තත්ත්වවලින් පස්සේ ආපු අංක (Markov)
  numerology: 0.08,  // පුද්ගලික සංඛ්‍යා ශාස්ත්‍රීය ඉලක්කම් (profile එකක් තිබ්බොත් විතරයි)
};
/** recency බර බාගෙට බහින්න ගන්නා draw ගණන (half-life) */
const RECENCY_HALFLIFE = Number(process.env.LUCKY_HALFLIFE || 25);

/** i-th පරණ draw එකේ බර — අලුත්ම එක 1, ඊළඟ එක ½^… */
function recencyWeight(i) {
  return Math.pow(0.5, i / Math.max(1, RECENCY_HALFLIFE));
}

/**
 * aggregate(rows, numberCount, positional)
 *   positional නම් → එක එක position එකට Map එකක්, නැත්නම් එක Map එකක් (set-match).
 *   Map: number → { count, recent, gap }
 */
function aggregate(rows, numberCount, positional) {
  const buckets = positional
    ? Array.from({ length: numberCount }, () => new Map())
    : [new Map()];
  const total = rows.length;

  rows.forEach((r, i) => {
    const w = recencyWeight(i);
    if (positional) {
      for (let p = 0; p < numberCount; p++) {
        const n = r.numbers[p];
        if (n == null) continue;
        const m = buckets[p];
        const a = m.get(n) || { count: 0, recent: 0, gap: total };
        a.count++;
        a.recent += w;
        if (a.gap === total) a.gap = i;      // මුලින්ම හම්බුන එක = අලුත්ම එක
        m.set(n, a);
      }
    } else {
      const m = buckets[0];
      for (const n of new Set(r.numbers)) {
        const a = m.get(n) || { count: 0, recent: 0, gap: total };
        a.count++;
        a.recent += w;
        if (a.gap === total) a.gap = i;
        m.set(n, a);
      }
    }
  });

  return { buckets, total };
}

/**
 * transitionCounts(rows, numberCount, positional, latest)
 *
 * "Markov" පියවර: අලුත්ම draw එකේ අංක වලට **සමාන** (overlap තියෙන) පරණ
 * draw එකකට පස්සේ ආපු අංක කවරේද කියලා ගණන් කරනවා. overlap එක බර විදිහට
 * ගන්නවා — වැඩිපුර අංක ගැලපුණු තත්ත්වවලට වැඩි බරක්.
 */
function transitionCounts(rows, numberCount, positional, latest) {
  const latestSet = new Set(latest);
  const buckets = positional
    ? Array.from({ length: numberCount }, () => new Map())
    : [new Map()];
  let matches = 0;

  /**
   * ⚠️ 1-ඉලක්කම් lotteries වල (උදා: Mahajana Sampatha — 0-9 අතරින් අංක 6ක්)
   * "අවම වශයෙන් එකක් ගැලපුණා" කියන එක අහඹු ලෙසම හැමවෙලාවෙම වෙනවා — ඒ නිසා
   * ඒ කොන්දේසියෙන් තෝරන ලද ඓතිහාසික තත්ත්ව අර්ථවත් නෑ. ඉලක්කම් 4ක් හෝ
   * වැඩි නම් ගැලපීම් 2ක් අවම වශයෙන් ඉල්ලනවා (වඩාත් සමාන තත්ත්ව).
   */
  const needOverlap = numberCount >= 4 ? 2 : 1;

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].numbers;
    let overlap = 0;
    for (const n of prev) if (latestSet.has(n)) overlap++;
    if (overlap < needOverlap) continue;
    matches++;

    const cur = rows[i].numbers;
    if (positional) {
      for (let p = 0; p < numberCount; p++) {
        const n = cur[p];
        if (n == null) continue;
        const m = buckets[p];
        m.set(n, (m.get(n) || 0) + overlap);
      }
    } else {
      const m = buckets[0];
      for (const n of new Set(cur)) m.set(n, (m.get(n) || 0) + overlap);
    }
  }

  return { buckets, matches };
}

/** එක bucket එකක් ඇතුළත component අගයන් normalize කරලා score එකක් හදනවා */
function scoreBucket(stats, trans, { total, matches, numerology, width }) {
  const luckyDigits = numerology && Array.isArray(numerology.luckyDigits)
    ? new Set(numerology.luckyDigits.map(String))
    : null;

  const rows = [];
  for (const [n, a] of stats) {
    const tCount = trans.get(n) || 0;

    // 1) frequency — draw කීයක ආවද
    const freq = total ? a.count / total : 0;

    // 2) recency — decay කරපු බර
    const rec = a.recent;

    // 3) overdue — බලාපොරොත්තු වන හිඩැසට සාපේක්ෂව
    const expectedGap = (total + 1) / (a.count + 1);
    const overdueRatio = expectedGap > 0 ? Math.min(3, a.gap / expectedGap) : 0;

    // 4) transition — Markov සම්භාවිතාව
    const transProb = matches ? tCount / matches : 0;

    // 5) numerology — පුද්ගලික ඉලක්කම් වලට ගැලපෙනවාද (සම්පූර්ණයෙන්ම මේ අංකයම
    //    lucky digit එකක් නම් 1, කොටසක් ගැලපුනොත් 0.5, නැත්නම් 0)
    let num = 0;
    if (luckyDigits && luckyDigits.size) {
      const s = digitPad(n, width);
      const hit = [...s].filter(ch => luckyDigits.has(ch)).length;
      num = hit === s.length ? 1 : hit > 0 ? 0.5 : 0;
    }

    rows.push({ n, count: a.count, gap: a.gap, lastIndex: a.gap, tCount, raw: { freq, rec, overdueRatio, transProb, num } });
  }

  if (!rows.length) return { candidates: [] };

  // component එකක් ඇතුළත max එකෙන් බෙදලා 0..1 අතරට ගන්නවා
  const maxOf = key => rows.reduce((m, r) => Math.max(m, r.raw[key]), 0);
  const max = {
    freq: maxOf('freq'), rec: maxOf('rec'),
    overdueRatio: Math.max(maxOf('overdueRatio'), 1e-9), transProb: maxOf('transProb'),
  };
  const wSum = RANK_WEIGHTS.frequency + RANK_WEIGHTS.recency + RANK_WEIGHTS.overdue +
               RANK_WEIGHTS.transition + RANK_WEIGHTS.numerology;

  for (const r of rows) {
    const parts = {
      frequency: max.freq ? r.raw.freq / max.freq : 0,
      recency: max.rec ? r.raw.rec / max.rec : 0,
      overdue: max.overdueRatio ? r.raw.overdueRatio / max.overdueRatio : 0,
      transition: max.transProb ? r.raw.transProb / max.transProb : 0,
      numerology: r.raw.num,
    };
    const score = (RANK_WEIGHTS.frequency * parts.frequency +
                   RANK_WEIGHTS.recency * parts.recency +
                   RANK_WEIGHTS.overdue * parts.overdue +
                   RANK_WEIGHTS.transition * parts.transition +
                   RANK_WEIGHTS.numerology * parts.numerology) / wSum;
    r.parts = parts;
    r.score = Math.round(score * 1000) / 10;         // 0.0 – 100.0
  }

  rows.sort((a, b) => b.score - a.score || Number(a.n) - Number(b.n));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { candidates: rows };
}

/**
 * rankCandidates(lottery, patterns, numerology)
 *   → { positional, numberCount, digitWidth, buckets, overall, weights, note }
 *
 * buckets  — positional නම් position එකකට එකක් (0-based), නැත්නම් හිස්
 * overall  — සමස්ත ශ්‍රේණිය (set-match වලට මේකයි ප්‍රධාන)
 */
function rankCandidates(lottery, patterns, numerology = null) {
  const p = patterns || analyzeDraws(lottery);
  if (!p || !p.drawsAnalyzed) return null;

  const rows = drawRows(lottery, p.subGameIndex);
  const positional = !!p.positional && p.numberCount > 0;
  const numberCount = p.numberCount;
  const latest = rows.length ? rows[0].numbers : [];

  const { buckets, total } = aggregate(rows, numberCount, positional);
  const trans = transitionCounts(rows, numberCount, positional, latest);

  const opts = { total, matches: trans.matches, numerology, width: p.digitWidth };

  const overall = scoreBucket(buckets[0], trans.buckets[0], opts);
  const perPosition = positional
    ? buckets.map((b, i) => {
        const s = scoreBucket(b, trans.buckets[i], opts);
        return { position: i + 1, candidates: s.candidates };
      })
    : [];

  return {
    slug: p.slug,
    lotteryName: p.lotteryName,
    provider: p.provider,
    subGameIndex: p.subGameIndex,
    positional,
    numberCount,
    digitWidth: p.digitWidth,
    drawsAnalyzed: total,
    latestDraw: rows.length
      ? { drawNo: rows[0].drawNo, date: rows[0].date, numbers: rows[0].numbers }
      : null,
    transitionMatches: trans.matches,
    weights: RANK_WEIGHTS,
    buckets: perPosition,
    overall: overall.candidates,
    note: 'මේ ශ්‍රේණිය පසුගිය ප්‍රතිඵලවල සංඛ්‍යාලේඛන රටාවන් මත පදනම් වූ විශ්ලේෂණයක් ' +
          'මිස අනාවැකියක් නොවේ. ලොතරැයි අංක අහඹු බැවින් කිසිම අංකයක ' +
          'දිනුම් සම්භාවිතාව වැඩි වන්නේ නොමැත.',
  };
}

/**
 * nextDrawPlan(lottery, patterns, numerology)
 *   → { numbers, letter, zodiac, superNumber, perPosition, alternates, confidence, method }
 *
 * positional: එක එක position එකට අංක 1 වෙනි තේරීම.
 * set-match : ශ්‍රේණියේ ඉහළම අංක ගන්නවා + දැනටමත් තෝරාගත් අංක එක්ක
 *             ඓතිහාසිකව එකට ආපු (pair) අංක වලට පොඩි bonus එකක්.
 */
function nextDrawPlan(lottery, patterns, numerology = null) {
  const p = patterns || analyzeDraws(lottery);
  if (!p || !p.drawsAnalyzed) return null;
  const rank = rankCandidates(lottery, p, numerology);
  if (!rank) return null;

  const need = rank.numberCount;
  const width = rank.digitWidth;
  const pairs = new Map((p.pairs || []).map(x => [x.pair, x.count]));

  let numbers = [];
  let perPosition = [];
  let method = '';

  if (rank.positional && rank.buckets.length === need) {
    /**
     * ⚠️ සමහර positional ලොතරැයි වල **එකම අංකය දෙපාරක්** එනවා (උදා: Mahajana
     * Sampatha — draw 200න් 168ක). ඒත් අනිත් ඒවායේ කවදාවත් එන්නේ නෑ.
     * ඒ නිසා අපේ ඉතිහාසයෙන්ම තීරණය කරනවා — repeat එකක් කවදාවත් නැත්නම්
     * එකම අංකය දෙපාරක් යෝජනා කරන්නේ නෑ.
     */
    const rows = drawRows(lottery, p.subGameIndex);
    const allowRepeat = rows.some(r => new Set(r.numbers).size !== r.numbers.length);

    for (const b of rank.buckets) {
      let pick = b.candidates[0] || null;
      if (!allowRepeat && pick) {
        const alt = b.candidates.find(c => !numbers.includes(digitPad(c.n, width)));
        if (alt) pick = alt;
      }
      numbers.push(digitPad(pick ? pick.n : '0', width));
      perPosition.push({
        position: b.position,
        pick: pick ? pick.n : null,
        score: pick ? pick.score : 0,
        alternates: b.candidates.filter(c => c !== pick).slice(0, 3).map(c => ({ n: c.n, score: c.score })),
      });
    }
    method = 'position එකකට ශ්‍රේණියේ ඉහළම අංකය (වාර ගණන + මෑතකාලීනත්වය + හිඩැස + සංක්‍රමණය)';
  } else {
    const pool = rank.overall.slice();
    while (numbers.length < need && pool.length) {
      let best = null, bestVal = -Infinity;
      for (const c of pool) {
        if (numbers.includes(digitPad(c.n, width))) continue;
        // තෝරාගත් අංක සමඟ එකට ආපු ඉතිහාසය (pair bonus)
        let bonus = 0;
        for (const sel of numbers) {
          const key = [sel, digitPad(c.n, width)].map(Number).sort((a, b) => a - b).join('-');
          if (pairs.has(key)) bonus += pairs.get(key);
        }
        const val = c.score + Math.min(12, bonus * 2);
        if (val > bestVal) { bestVal = val; best = c; }
      }
      if (!best) break;
      numbers.push(digitPad(best.n, width));
      pool.splice(pool.indexOf(best), 1);
    }
    numbers.sort((a, b) => Number(a) - Number(b));
    perPosition = [];
    method = 'වාර ගණන + මෑතකාලීනත්වය + හිඩැස + සංක්‍රමණය මිශ්‍ර කර ශ්‍රේණිගත කළ ඉහළම අංක (එකට ආපු යුගල වලට bonus)';
  }

  const letter = p.hasLetter ? (p.letters[0] ? p.letters[0].value : null) : null;
  const zodiac = p.hasZodiac ? (p.zodiacs[0] ? p.zodiacs[0].value : null) : null;

  let superNumber = null;
  if (p.hasSuperNumber) {
    if (p.superNumbers.length) {
      // numerology එකක් තියෙනවා නම් ඒකට ගැලපෙන ඉහළම super number එකට මුල් තැන
      const lucky = numerology && Array.isArray(numerology.luckyDigits)
        ? new Set(numerology.luckyDigits.map(String)) : null;
      const sorted = p.superNumbers.slice().sort((a, b) => {
        const hit = v => (lucky && lucky.has(String(Number(v.value) % 10)) ? 1 : 0);
        return hit(b) - hit(a) || b.count - a.count;
      });
      superNumber = sorted[0].value;
    } else {
      superNumber = digitPad(numerology ? numerology.luckyNumber : 1, 2);
    }
  }

  const top = rank.overall[0];
  const second = rank.overall[1];
  const spread = top && second ? top.score - second.score : 0;
  const confidence = spread >= 10 ? 'high' : spread >= 4 ? 'medium' : 'low';

  return {
    numbers,
    letter,
    zodiac,
    superNumber,
    perPosition,
    alternates: rank.overall.slice(0, 8).map(c => ({ n: c.n, score: c.score })),
    confidence,
    method,
    engine: 'ranking-v1',
    note: rank.note,
  };
}

/**
 * lotteryWiseOverview(data, numerology)
 *   හැම ලොතරැයියකටම ශ්‍රේණියේ ඉහළම අංක කිහිපයක් + ඊළඟ draw එකට යෝජනාවක්
 *   (user ඉල්ලපු "ලොතරැයි අනුව බලන්න පුළුවන් feature එක").
 */
function lotteryWiseOverview(data, numerology = null, { limit = 6 } = {}) {
  const items = [];
  for (const lot of (data && data.lotteries) || []) {
    const p = analyzeDraws(lot, null);
    if (!p || !p.drawsAnalyzed) continue;
    const rank = rankCandidates(lot, p, numerology);
    const plan = nextDrawPlan(lot, p, numerology);
    if (!rank || !plan) continue;
    items.push({
      slug: lot.slug,
      name: lot.name,
      nameSi: lot.nameSi || null,
      provider: lot.provider,
      drawsAnalyzed: p.drawsAnalyzed,
      numberCount: p.numberCount,
      digitWidth: p.digitWidth,
      positional: rank.positional,
      lastDraw: p.recent[0] || null,
      hottest: p.frequency.slice(0, limit).map(f => ({ n: f.n, count: f.count, pct: f.pct })),
      mostOverdue: p.gaps.slice(0, limit).map(g => ({ n: g.n, drawsAgo: g.gap })),
      top: rank.overall.slice(0, limit).map(c => ({ n: c.n, score: c.score })),
      plan: {
        numbers: plan.numbers,
        letter: plan.letter,
        zodiac: plan.zodiac,
        superNumber: plan.superNumber,
        confidence: plan.confidence,
        perPosition: plan.perPosition,
      },
      note: rank.note,
    });
  }
  // වැඩිපුරම draw දත්ත තියෙන ඒවා මුලින් (විශ්ලේෂණය වඩාත් විශ්වාසදායක)
  items.sort((a, b) => b.drawsAnalyzed - a.drawsAnalyzed);
  return {
    generatedAt: new Date().toISOString(),
    count: items.length,
    weights: RANK_WEIGHTS,
    items,
    note: 'පසුගිය ප්‍රතිඵලවල සංඛ්‍යාලේඛන විශ්ලේෂණයක්. ලොතරැයි අංක අහඹුයි — ' +
          'මෙය අනාවැකියක් නොවේ. දිනුම් සම්භාවිතාව වැඩි කරන්නේ නොමැත.',
  };
}

/**
 * baseSuggestion(lottery, patterns, numerology, seedKey)
 *   → { numbers, letter, zodiac, superNumber, method }
 *
 * Position වැදගත් ලොතරැයි වලට position අනුව වැඩිපුරම ආපු අංක,
 * set-match ලොතරැයි වලට සමස්තයෙන් වැඩිපුරම ආපු අංක + හිඩැස් වැඩි ඒවා
 * මිශ්‍ර කරලා ගන්නවා. සම්පූර්ණයෙන්ම deterministic — එකම input වලට
 * එකම යෝජනාව.
 */
function baseSuggestion(p, numerology, seedKey) {
  const rnd = mulberry32(hashSeed(seedKey || 'lkm'));
  const need = p.numberCount;
  // `positional` එක lottery-meta.js එකෙන් එනවා — ඒක හදන්නේ ඇත්ත prize
  // engine එකට ආපහු හරවපු ටිකට් එකක් දාලා බලලා (අනුමානයක් නෙවෙයි).
  const isPositional = !!p.positional && p.byPosition.length === need;

  const picked = [];

  if (isPositional && p.byPosition.length === need) {
    // position එකකට අංකයක් — වැඩිපුරම ආපු එකයි දෙවෙනි එකයි අතර
    for (let i = 0; i < need; i++) {
      const top = p.byPosition[i].top;
      if (!top.length) { picked.push(digitPad(0, p.digitWidth)); continue; }
      const useSecond = top.length > 1 && rnd() < 0.35;
      picked.push(digitPad(top[useSecond ? 1 : 0].n, p.digitWidth));
    }
  } else {
    // set-match: hot අංක කිහිපයක් + හිඩැස් වැඩි (overdue) එකක් හෝ දෙකක්
    const hot = p.frequency.map(f => f.n);
    const overdue = p.gaps.map(g => g.n);
    const nHot = Math.max(0, need - 2);
    for (const n of hot) {
      if (picked.length >= nHot) break;
      if (!picked.includes(digitPad(n, p.digitWidth))) picked.push(digitPad(n, p.digitWidth));
    }
    for (const n of overdue) {
      if (picked.length >= need) break;
      const v = digitPad(n, p.digitWidth);
      if (!picked.includes(v)) picked.push(v);
    }
    // තව ඕන නම් අංක 0-9 අතරින් deterministic ලෙස පුරවනවා
    let guard = 0;
    while (picked.length < need && guard++ < 200) {
      const v = digitPad(Math.floor(rnd() * Math.pow(10, p.digitWidth)), p.digitWidth);
      if (!picked.includes(v)) picked.push(v);
    }
    if (isPositional) picked.sort((a, b) => Number(a) - Number(b));
  }

  const letter = p.hasLetter ? (p.letters[0] ? p.letters[0].value : null) : null;
  const zodiac = p.hasZodiac ? (p.zodiacs[0] ? p.zodiacs[0].value : null) : null;
  const superNumber = p.hasSuperNumber
    ? (p.superNumbers[0] ? p.superNumbers[0].value : digitPad(numerology ? numerology.luckyNumber : 1, 2))
    : null;

  return {
    numbers: picked.slice(0, need),
    letter,
    zodiac,
    superNumber,
    method: isPositional
      ? 'Position අනුව වැඩිපුරම ලැබුණු ඉලක්කම් (සංඛ්‍යාලේඛනය)'
      : 'වැඩිපුරම ලැබුණු + දිගු කලක් නොපෙනුණු අංක මිශ්‍රණය (සංඛ්‍යාලේඛනය)',
  };
}

// ---------------------------------------------------------------
// AI යෝජනාව
// ---------------------------------------------------------------
const ZODIAC_ENUM = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO',
                     'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];

function guessSchema(p, extra) {
  const props = {
    numbers: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoningSi: { type: 'string' },
    luckNoteSi: { type: 'string' },
  };
  if (p.hasLetter) props.letter = { type: 'string' };
  if (p.hasZodiac) props.zodiac = { type: 'string', enum: ZODIAC_ENUM };
  if (p.hasSuperNumber) props.superNumber = { type: 'string' };
  if (extra) Object.assign(props, extra);
  return { type: 'object', properties: props, required: ['numbers', 'reasoningSi'] };
}

function buildGuessPrompt({ patterns, numerology, base, extraContext, rank }) {
  const s = summarizePatterns(patterns);
  const n = numerology;
  const fmtFreq = arr => arr.map(f => `${f.n}(${f.count}×)`).join(', ');

  // 🧮 ශ්‍රේණිගත කිරීමේ එන්ජිමේ ප්‍රතිඵලය AI එකට දෙන කොටස
  const rankBlock = rank ? `
=== 🧮 ඊළඟ draw එකට ශ්‍රේණිගත කළ අංක (අපේ එන්ජිම) ===
බර: වාර ගණන ${RANK_WEIGHTS.frequency} · මෑතකාලීනත්වය ${RANK_WEIGHTS.recency} · හිඩැස ${RANK_WEIGHTS.overdue} · සංක්‍රමණය ${RANK_WEIGHTS.transition} · සංඛ්‍යා ශාස්ත්‍රය ${RANK_WEIGHTS.numerology}
අලුත්ම draw එකට සමාන තත්ත්ව ${rank.transitionMatches}ක් සමඟ සංසන්දනය කළා.
ඉහළම අංක (score 0-100): ${rank.overall.slice(0, 8).map(c => `${c.n}(${c.score})`).join(', ')}
${rank.buckets.length ? 'Position අනුව ඉහළම: ' + rank.buckets.map(b => `#${b.position}: ${b.candidates[0] ? b.candidates[0].n + '(' + b.candidates[0].score + ')' : '—'}`).join(' · ') : ''}
` : '';

  return `ඔබ ශ්‍රී ලංකා ලොතරැයි ප්‍රතිඵල විශ්ලේෂණය කරන සහායකයෙකි.
පහත **සැබෑ සංඛ්‍යාලේඛන** සහ **සාම්ප්‍රදායික සංඛ්‍යා ශාස්ත්‍රීය සංඥා** පමණක්
භාවිතා කර, ලොතරැයි අංක ටිකක් **යෝජනා** කරන්න.

⚠️ ඉතා වැදගත් නීති:
- මෙය **අනාවැකියක් නොවේ** කියන බව reasoning එකේ පැහැදිලිව සඳහන් කරන්න.
- "දිනනවා", "සහතිකයි", "නියතයි" වගේ පොරොන්දු දෙන්නේ නොවන්න.
- ලොතරැයි අංක අහඹු බවත්, සම්භාවිතාව වැඩි නොවන බවත් කියන්න.

=== ලොතරැයිය ===
${patterns.lotteryName} (${patterns.provider}) · slug: ${patterns.slug}
${patterns.subGameIndex != null ? `Game ${patterns.subGameIndex + 1} · ` : ''}ඉලක්කම් ${patterns.numberCount}ක්, එක ඉලක්කමක් අකුරු ${patterns.digitWidth}ක්
${patterns.hasLetter ? '· English අකුරක් තියෙනවා' : ''}${patterns.hasZodiac ? '· රාශියක් තියෙනවා' : ''}${patterns.hasSuperNumber ? '· Super Number එකක් තියෙනවා' : ''}

=== පසුගිය ප්‍රතිඵල (${patterns.drawsAnalyzed} draw · ${patterns.dateRange ? patterns.dateRange.from + ' සිට ' + patterns.dateRange.to : ''}) ===
අලුත්ම draws (අලුත්ම එක මුලින්):
${patterns.recent.slice(0, 6).map(r => `  Draw ${r.drawNo || '?'} (${r.date || '?'}): ${r.numbers.join(' ')}${r.letter ? ' | ' + r.letter : ''}${r.zodiac ? ' | ' + r.zodiac : ''}${r.superNumber ? ' | Super ' + r.superNumber : ''}`).join('\n')}

අංක වාර ගණන: ${fmtFreq(patterns.frequency.slice(0, 10))}
වැඩිපුරම ආපු (hot): ${s.hot.join(', ')}
අඩුවෙන්ම ආපු (cold): ${s.cold.join(', ')}
දිගු කලක් නොපෙනුණු (overdue): ${s.overdue.map(o => o.n + ' (' + o.drawsAgo + ' draw)').join(', ') || '—'}
${patterns.pairs.length ? 'නිතර එකට ආපු යුගල: ' + s.topPairs.join(', ') : ''}
position අනුව වැඩිපුරම: ${patterns.byPosition.map(b => `#${b.position}: ${b.top.slice(0, 3).map(t => t.n).join('/')}`).join(' · ')}
සංඛ්‍යා ව්‍යුහය: සාමාන්‍ය එකතුව ${patterns.stats.avgSum} (${patterns.stats.minSum}-${patterns.stats.maxSum}), සාමාන්‍ය ඔත්තේ ගණන ${patterns.stats.avgOdd}
${patterns.hasLetter ? 'අකුරු වාර ගණන: ' + patterns.letters.slice(0, 6).map(l => l.value + '(' + l.count + '×)').join(', ') : ''}
${patterns.hasZodiac ? 'රාශි වාර ගණන: ' + patterns.zodiacs.slice(0, 6).map(z => z.value + '(' + z.count + '×)').join(', ') : ''}
${patterns.hasSuperNumber ? 'Super Number වාර ගණන: ' + patterns.superNumbers.slice(0, 6).map(x => x.value + '(' + x.count + '×)').join(', ') : ''}

=== අනුමානය කරන පුද්ගලයා (සාම්ප්‍රදායික සංඛ්‍යා ශාස්ත්‍රය) ===
${n ? `නම: ${n.fullName || '—'}
උපන් දිනය: ${n.birthday}${n.birthTime ? ' · උපන් වේලාව: ' + n.birthTime + ' ' + (n.birthMeridiem || '') : ''}
ජීවන මාර්ග අංකය: ${n.lifePath} · උපන් දින අංකය: ${n.birthdayNumber}${n.timeNumber ? ' · වේලා අංකය: ' + n.timeNumber : ''} · නම් අංකය: ${n.nameNumber}
වාසනාවන්ත අංකය: ${n.luckyNumber}${n.planet ? ' · ග්‍රහයා: ' + n.planet.si + ' (' + n.planet.en + ')' : ''}
කැපී පෙනෙන ඉලක්කම්: ${n.luckyDigits.join(', ')}` : 'උපන් විස්තර ලබා දී නෑ — සංඛ්‍යාලේඛන පමණක් භාවිතා කරන්න.'}

=== ගණනය කළ පදනම් යෝජනාව (සංඛ්‍යාලේඛනයෙන්) ===
අංක: ${base.numbers.join(' ')}${base.letter ? ' · අකුර: ' + base.letter : ''}${base.zodiac ? ' · රාශිය: ' + base.zodiac : ''}${base.superNumber ? ' · Super: ' + base.superNumber : ''}
ක්‍රමය: ${base.method}
${rankBlock}

${extraContext ? '=== scan කළ පත්‍රිකාවෙන් ලැබුණු තොරතුරු ===\n' + extraContext + '\n' : ''}
=== ඔබ දෙන්න ඕන පිළිතුර ===
ඉලක්කම් **හරියටම ${patterns.numberCount}ක්** දෙන්න. එක ඉලක්කමක් **ඉලක්කම් ${patterns.digitWidth}ක්** වෙන්න ඕන (උදා: ${digitPad(7, patterns.digitWidth)}).
ඉහත සංඛ්‍යාලේඛනයි සංඛ්‍යා ශාස්ත්‍රීය සංඥාවයි **සමඟ ගැලපෙන** විදිහට අංක ටික තෝරන්න.
පදනම් යෝජනාව හැමවෙලාවෙම එකම විදිහටම දෙන්න එපා — සංඛ්‍යා ශාස්ත්‍රීය සංඥා ටිකත් සලකා තෝරන්න.
"reasoningSi" එකේ සිංහලෙන් වාක්‍ය 2-4කින් **මොන දත්ත මතද** තෝරාගත්තේ කියලා කියන්න,
සහ මෙය අනාවැකියක් නොවන බව අවසානයේ සඳහන් කරන්න.
"luckNoteSi" එකේ කෙටි දිරිගැන්වීමේ වාක්‍යයක් දෙන්න.`;
}

/** AI එකෙන් එන අංක ටික ඇත්තටම වලංගුද කියලා බලනවා */
function validateGuess(raw, p) {
  const nums = Array.isArray(raw.numbers)
    ? raw.numbers.map(n => String(n).trim()).filter(n => /^\d+$/.test(n))
    : [];
  const width = p.digitWidth;
  const ok = nums.length === p.numberCount && nums.every(n => n.length <= width);
  return {
    numbers: ok ? nums.map(n => digitPad(n, width)) : null,
    letter: p.hasLetter && /^[A-Za-z]$/.test(String(raw.letter || '')) ? String(raw.letter).toUpperCase() : null,
    zodiac: p.hasZodiac && ZODIAC_ENUM.includes(String(raw.zodiac || '').toUpperCase())
      ? String(raw.zodiac).toUpperCase() : null,
    superNumber: p.hasSuperNumber && /^\d{1,2}$/.test(String(raw.superNumber || ''))
      ? digitPad(String(raw.superNumber).trim(), 2) : null,
    confidence: ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'low',
    reasoningSi: raw.reasoningSi ? String(raw.reasoningSi).trim().slice(0, 1200) : null,
    luckNoteSi: raw.luckNoteSi ? String(raw.luckNoteSi).trim().slice(0, 300) : null,
    valid: ok,
  };
}

/**
 * generateGuess({ lottery, subGameIndex, numerology, source, extraContext })
 *   → { ok, guess, patterns, base, aiUsed, model, elapsedMs, warning? }
 */
async function generateGuess({ lottery, subGameIndex = null, numerology, source = 'manual', extraContext = null }) {
  const patterns = analyzeDraws(lottery, subGameIndex);
  if (!patterns || !patterns.drawsAnalyzed) {
    return { ok: false, error: 'මේ ලොතරැයියට ප්‍රතිඵල දත්ත තවම නෑ — scrape කරලා ආයෙ try කරන්න.' };
  }

  const seedKey = [lottery.slug, subGameIndex, numerology ? numerology.birthday : '', numerology ? numerology.birthTime : ''].join('|');

  // 🧮 මුලින්ම ශ්‍රේණිගත කිරීමේ එන්ජිම (වාර ගණන + මෑතකාලීනත්වය + හිඩැස +
  // සංක්‍රමණය + පුද්ගලික සංඛ්‍යා ශාස්ත්‍රය). ඒක හදන්න බැරි උනොත් පමණයි
  // පරණ සරල base එකට වැටෙන්නේ.
  const rank = rankCandidates(lottery, patterns, numerology);
  const plan = nextDrawPlan(lottery, patterns, numerology);
  const base = plan
    ? {
        numbers: plan.numbers, letter: plan.letter, zodiac: plan.zodiac,
        superNumber: plan.superNumber, method: plan.method,
        confidence: plan.confidence, plan,
      }
    : baseSuggestion(patterns, numerology, seedKey);

  const summary = summarizePatterns(patterns);

  const r = await vision.callGemini({
    parts: [{ text: buildGuessPrompt({ patterns, numerology, base, extraContext, rank }) }],
    schema: guessSchema(patterns),
    temperature: 0.7,   // සංඛ්‍යා ශාස්ත්‍රීය සංඥා එක්ක තරමක් වෙනස් යෝජනා එන්න
  });

  if (!r.ok) {
    // AI එක වැඩ කරන්නේ නැත්නම් — සංඛ්‍යාලේඛන පදනම් කරගත් යෝජනාව විතරක් දෙනවා
    // (user ට මොකුත් නොදී ඉන්න එකට වඩා හොඳයි). Error එකත් එක්කම කියනවා.
    return {
      ok: true,
      aiUsed: false,
      warning: r.needsSetup
        ? 'AI එක setup කරලා නෑ — දැනට සංඛ්‍යාලේඛන පදනම් කරගත් යෝජනාව පමණක් පෙන්නනවා.'
        : ('AI යෝජනාව ලබාගන්න බැරි උනා (' + r.error + ') — සංඛ්‍යාලේඛන පදනම් කරගත් යෝජනාව පෙන්නනවා.'),
      guess: {
        numbers: base.numbers, letter: base.letter, zodiac: base.zodiac,
        superNumber: base.superNumber, confidence: 'low',
        reasoningSi: base.method + ' මත පදනම්ව ගණනය කළ යෝජනාවක්. ' +
          'මෙය අනාවැකියක් නොවේ — ලොතරැයි අංක අහඹු බැවින් දිනුම් ලැබීමට සහතිකයක් නොමැත.',
        luckNoteSi: null,
      },
      patterns, summary, base, rank, plan,
    };
  }

  let raw;
  try {
    raw = vision.extractJson(r.text);
  } catch (e) {
    raw = null;
  }

  if (!raw) {
    return {
      ok: true, aiUsed: false,
      warning: 'AI පිළිතුර කියවන්න බැරි උනා — සංඛ්‍යාලේඛන පදනම් කරගත් යෝජනාව පෙන්නනවා.',
      guess: {
        numbers: base.numbers, letter: base.letter, zodiac: base.zodiac,
        superNumber: base.superNumber, confidence: 'low',
        reasoningSi: base.method + ' මත පදනම්ව ගණනය කළ යෝජනාවක්.',
        luckNoteSi: null,
      },
      patterns, summary, base, rank, plan,
    };
  }

  const v = validateGuess(raw, patterns);
  if (!v.valid) {
    return {
      ok: true, aiUsed: false,
      warning: 'AI එක දුන්න අංක ටික වලංගු නොවුනා — සංඛ්‍යාලේඛන පදනම් කරගත් යෝජනාව පෙන්නනවා.',
      guess: {
        numbers: base.numbers, letter: base.letter, zodiac: base.zodiac,
        superNumber: base.superNumber, confidence: 'low',
        reasoningSi: base.method + ' මත පදනම්ව ගණනය කළ යෝජනාවක්.',
        luckNoteSi: null,
      },
      patterns, summary, base, rank, plan, aiRaw: raw,
    };
  }

  return {
    ok: true,
    aiUsed: true,
    model: r.model,
    elapsedMs: r.elapsedMs,
    guess: {
      numbers: v.numbers,
      letter: v.letter || base.letter,
      zodiac: v.zodiac || base.zodiac,
      superNumber: v.superNumber || base.superNumber,
      confidence: v.confidence,
      reasoningSi: v.reasoningSi,
      luckNoteSi: v.luckNoteSi,
    },
    patterns, summary, base, rank, plan,
  };
}

// ---------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------
function getProfile(userId) {
  return prepare('SELECT * FROM profiles WHERE userId = ?').get(userId) || null;
}

function saveProfile(userId, { fullName, birthday, birthTime, birthMeridiem, birthPlace }) {
  prepare(`
    INSERT INTO profiles (userId, fullName, birthday, birthTime, birthMeridiem, birthPlace, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(userId) DO UPDATE SET
      fullName = excluded.fullName,
      birthday = excluded.birthday,
      birthTime = excluded.birthTime,
      birthMeridiem = excluded.birthMeridiem,
      birthPlace = excluded.birthPlace,
      updatedAt = datetime('now')
  `).run(userId, fullName || null, birthday || null, birthTime || null,
         birthMeridiem || null, birthPlace || null);
  return getProfile(userId);
}

function saveGuess({ userId, lottery, subGameIndex, draw, guess, patterns, numerology, source, model, aiUsed, agreedDisclaimer }) {
  try {
    const info = prepare(`
      INSERT INTO guesses
        (userId, slug, lotteryName, provider, drawNo, drawDate, numbers, letter, zodiac,
         superNumber, confidence, reasoning, patternSummary, numerology, model, source,
         aiUsed, agreedDisclaimer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      lottery.slug,
      lottery.name || null,
      lottery.provider || null,
      draw && draw.drawNo != null ? String(draw.drawNo) : null,
      (draw && draw.date) || null,
      JSON.stringify(guess.numbers || []),
      guess.letter || null,
      guess.zodiac || null,
      guess.superNumber != null ? String(guess.superNumber) : null,
      guess.confidence || null,
      guess.reasoningSi || null,
      patterns ? JSON.stringify(summarizePatterns(patterns)) : null,
      numerology ? JSON.stringify({
        birthday: numerology.birthday, birthTime: numerology.birthTime,
        birthMeridiem: numerology.birthMeridiem, lifePath: numerology.lifePath,
        birthdayNumber: numerology.birthdayNumber, timeNumber: numerology.timeNumber,
        nameNumber: numerology.nameNumber, luckyNumber: numerology.luckyNumber,
      }) : null,
      model || null,
      source === 'scan' ? 'scan' : 'manual',
      aiUsed ? 1 : 0,
      agreedDisclaimer || null
    );
    return Number(info.lastInsertRowid);
  } catch (e) {
    console.error('⚠️  guess log කරන්න බැරි උනා:', e.message);
    return null;
  }
}

function guessHistory(userId, { limit = 20, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const total = Number(prepare('SELECT COUNT(*) AS n FROM guesses WHERE userId = ?').get(userId).n || 0);
  const rows = prepare(`
    SELECT * FROM guesses WHERE userId = ?
    ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(userId, lim, off);
  return {
    total, limit: lim, offset: off,
    hasMore: off + rows.length < total,
    items: rows.map(r => {
      let numbers = [];
      try { numbers = JSON.parse(r.numbers || '[]'); } catch (e) { numbers = []; }
      let numerology = null;
      try { numerology = r.numerology ? JSON.parse(r.numerology) : null; } catch (e) { numerology = null; }
      return {
        id: r.id, slug: r.slug, lotteryName: r.lotteryName, provider: r.provider,
        drawNo: r.drawNo, drawDate: r.drawDate, numbers, letter: r.letter,
        zodiac: r.zodiac, superNumber: r.superNumber, confidence: r.confidence,
        reasoning: r.reasoning, numerology, model: r.model, source: r.source,
        aiUsed: !!r.aiUsed, agreedDisclaimer: r.agreedDisclaimer, createdAt: r.createdAt,
      };
    }),
  };
}

module.exports = {
  DISCLAIMER_SI, DISCLAIMER_VERSION, ZODIAC_ENUM,
  numerologyProfile, analyzeDraws, summarizePatterns, baseSuggestion,
  generateGuess, validateGuess, buildGuessPrompt, guessSchema,
  getProfile, saveProfile, saveGuess, guessHistory,
  reduceNumber, nameNumberPythagorean, hashSeed, mulberry32,
  // 🧮 ඊළඟ draw එකට ශ්‍රේණිගත කිරීමේ එන්ජිම
  drawRows, rankCandidates, nextDrawPlan, lotteryWiseOverview,
  RANK_WEIGHTS, RECENCY_HALFLIFE,
};
