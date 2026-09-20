/**
 * lottery-meta.js — ලොතරැයියක ව්‍යුහය (structure) එක විස්තර කරන පොදු helper
 *
 * data.json එකේ තියෙන්නේ provider/slug/name/draws විතරයි — "අකුරක් තියෙනවද",
 * "ඉලක්කම් කීයක්ද", "ඉලක්කමක් පළල කීයද" කියන දේවල් ව්‍යුත්පන්න කරගන්න ඕන.
 * server.js (/api/lotteries) සහ lucky.js දෙකම මේක පාවිච්චි කරනවා —
 * එකම තැනක තිබ්බොත් දෙකක් වැරදියන්නේ නෑ.
 */

'use strict';

const { evaluatePrize, hasPrizeTable, getLotteryKind } = require('./prizes');

/** ඉලක්කම් ටිකේ "පළල" — උදා: ['7','8'] → 1, ['07','48'] → 2 */
function digitWidthOf(numbers) {
  const arr = Array.isArray(numbers) ? numbers : [];
  return arr.reduce((w, n) => Math.max(w, String(n).length), 0);
}

/** draws array එකේ අලුත්ම එක (scraper එකේ පිළිවෙළ අනුව draws[0]) */
function latestDrawOf(lottery) {
  return (lottery && lottery.draws && lottery.draws[0]) || null;
}

/**
 * ලොතරැයිය positional ද (පිළිවෙළ වැදගත්) නැත්නම් set-match ද?
 *
 * ක්‍රමය: නිල ඉලක්කම් ටික **ආපහු හරවලා** ඇත්ත prize engine එකට දාලා බලනවා.
 *  - ආපහු හරවපු එකෙන් අඩු tier එකක් / නොදිනන එකක් ආවොත් → පිළිවෙළ වැදගත් (positional)
 *  - ඒකම tier එකම ආවොත් → set-match (ඕන පිළිවෙළකට)
 * මේක ඇත්තටම engine එකේ නීතිය පරීක්ෂා කරන නිසා නිවැරදි.
 */
function isPositional(slug, draw) {
  const official = (draw && draw.numbers) || [];
  if (official.length < 2) return true;
  const reversed = official.slice().reverse();
  if (reversed.join('|') === official.join('|')) return true;   // palindrome → වෙනසක් නෑ

  const base = {
    letter: draw.letter, zodiac: draw.zodiac,
    superNumber: draw.superNumber, numbers: official,
  };
  const probe = Object.assign({}, base, { numbers: reversed });

  try {
    const a = evaluatePrize(slug, draw, base);
    const b = evaluatePrize(slug, draw, probe);
    if (a && a.unavailable) return true;
    return !(b.won && a.won && b.prizeAmountRs === a.prizeAmountRs);
  } catch (e) {
    return true;   // නොදන්නා එකක් නම් positional කියලා හිතනවා (ආරක්ෂිත පැත්ත)
  }
}

/**
 * describeLottery(lottery) — /api/lotteries එකට යවන හැඩයම හදනවා.
 */
function describeLottery(lottery) {
  const d0 = latestDrawOf(lottery) || {};
  const slug = lottery.slug;
  const prizeKind = getLotteryKind(slug);          // 'single' | 'multi' | null

  const out = {
    provider: lottery.provider,
    slug,
    name: lottery.name,
    nameSi: lottery.nameSi || null,
    hasLetter: !!d0.letter,
    hasZodiac: !!d0.zodiac,
    hasSuperNumber: !!d0.superNumber,
    numberCount: d0.numbers ? d0.numbers.length : 0,
    digitWidth: digitWidthOf(d0.numbers),
    latestDraw: d0.drawNo || null,
    latestDate: d0.date || null,
    drawCount: (lottery.draws || []).length,
    hasPrizeTable: hasPrizeTable(slug),
    prizeKind,                                     // 'single' | 'multi' | null
    positional: null,
    subGames: null,
  };

  if (d0.subGames) {
    // ⚠️ multi ලොතරැයි වල එක එක game එකට වෙනම structure එකක් තියෙනවා, ඒ නිසා
    // positional ද කියන එක **game එකෙන් game එකට** වෙනස් වෙන්න පුළුවන්.
    // ඒ නිසා හැම game එකකටම වෙනම ගණනය කරනවා, සහ engine එකට යවන්නේ
    // ඒ game එකේ විස්තර (numbers/letter/zodiac) විතරයි.
    out.subGames = d0.subGames.map((sg, i) => ({
      index: i,
      numberCount: sg.numbers ? sg.numbers.length : 0,
      digitWidth: digitWidthOf(sg.numbers),
      hasLetter: !!sg.letter,
      hasZodiac: !!sg.zodiac,
      hasSuperNumber: !!sg.superNumber,
      positional: isPositional(slug, {
        numbers: sg.numbers || [], letter: sg.letter,
        zodiac: sg.zodiac, superNumber: sg.superNumber,
      }),
    }));
    out.positional = null;   // game එකක් තෝරාගත්තට පස්සේ resolveGame එකෙන් එනවා
  } else {
    out.positional = isPositional(slug, d0);
  }

  return out;
}

/**
 * resolveGame(lotteryMeta, subGameIndex) — multi ලොතරැයියක specific game එකක
 * ව්‍යුහය ගන්නවා (single නම් ලොතරැයියේම structure එක).
 */
function resolveGame(meta, subGameIndex = null) {
  if (!meta) return null;
  if (meta.prizeKind === 'multi' && Array.isArray(meta.subGames) && meta.subGames.length) {
    const g = meta.subGames[subGameIndex != null ? subGameIndex : 0] || meta.subGames[0];
    return {
      numberCount: g.numberCount, digitWidth: g.digitWidth,
      hasLetter: g.hasLetter, hasZodiac: g.hasZodiac, hasSuperNumber: g.hasSuperNumber,
      positional: g.positional, subGameIndex: subGameIndex != null ? subGameIndex : 0,
    };
  }
  return {
    numberCount: meta.numberCount, digitWidth: meta.digitWidth,
    hasLetter: meta.hasLetter, hasZodiac: meta.hasZodiac, hasSuperNumber: meta.hasSuperNumber,
    positional: meta.positional, subGameIndex: null,
  };
}

module.exports = { digitWidthOf, latestDrawOf, isPositional, describeLottery, resolveGame };
