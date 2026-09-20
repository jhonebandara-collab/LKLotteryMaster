/**
 * prizes.js — ඇත්ත ($) prize structure engine
 *
 * මෙතන තියෙන්නේ user දුන්න NLB/DLB Prize Structure tables ටිකම
 * code එකට හරවපු එක. හැම lottery එකකටම වෙනම tier list එකක් තියෙනවා.
 * "highest applicable tier" එක විතරක් return කරනවා (double-count නෑ).
 *
 * IMPORTANT: මෙතන කිසිම ලකුණක් guess කරලා නෑ. දත්තයක් scraper එකෙන්
 * අරගන්න බැරි උනොත් (උදා: Dhana Nidhanaya 9th tier, Waasi draws)
 * ඒක "unavailable" කියලා පැහැදිලිව පෙන්නනවා මිසක් වරදවා දිනුවා කියලා කියන්නේ නෑ.
 */

// ---------------------------------------------------------------
// Match-stat helpers
// ---------------------------------------------------------------
function norm(arr) {
  return (arr || []).map(n => String(n).trim());
}

// Set match — order අදාළ නෑ, duplicate ගණන් කරන්නේ නෑ (Govisetha වගේ)
function setMatchCount(official, ticket) {
  const pool = [...official];
  let count = 0;
  for (const n of ticket) {
    const idx = pool.indexOf(n);
    if (idx !== -1) { pool.splice(idx, 1); count++; }
  }
  return count;
}

// පිටිපස්සින් ඉස්සරහට ගැලපෙන ගණන (contiguous, mismatch එකකින් නවතී) — Last N
function positionalFromEnd(official, ticket) {
  let count = 0;
  const n = Math.min(official.length, ticket.length);
  for (let i = 0; i < n; i++) {
    if (official[official.length - 1 - i] === ticket[ticket.length - 1 - i]) count++;
    else break;
  }
  return count;
}

// ඉස්සරහින් පිටිපසට ගැලපෙන ගණන (contiguous, mismatch එකකින් නවතී) — First N
function positionalFromStart(official, ticket) {
  let count = 0;
  const n = Math.min(official.length, ticket.length);
  for (let i = 0; i < n; i++) {
    if (official[i] === ticket[i]) count++;
    else break;
  }
  return count;
}

function letterOk(draw, ticket) {
  return !!(draw.letter && ticket.letter &&
    String(draw.letter).toUpperCase() === String(ticket.letter).toUpperCase());
}

function zodiacOk(draw, ticket) {
  return !!(draw.zodiac && ticket.zodiac &&
    String(draw.zodiac).toUpperCase() === String(ticket.zodiac).toUpperCase());
}

function superOk(draw, ticket) {
  return !!(draw.superNumber != null && ticket.superNumber != null &&
    String(draw.superNumber).trim() === String(ticket.superNumber).trim());
}

function stats(draw, ticket) {
  const official = norm(draw.numbers);
  const mine = norm(ticket.numbers);
  return {
    official, mine,
    total: official.length,
    setCount: setMatchCount(official, mine),
    posStart: positionalFromStart(official, mine),
    posEnd: positionalFromEnd(official, mine),
    letter: letterOk(draw, ticket),
    zodiac: zodiacOk(draw, ticket),
    superN: superOk(draw, ticket),
  };
}

function fmt(rs) {
  if (rs == null) return null;
  return 'Rs. ' + rs.toLocaleString('en-US') + '.00';
}

// ---------------------------------------------------------------
// Generic tier evaluator — ordered candidate list, first match wins
// (list එක උසින්ම, දුෂ්කරම tier එකෙන් පටන් අරන් තියෙන්න ඕන)
// ---------------------------------------------------------------
function evalTiers(tiers, s) {
  for (const t of tiers) {
    if (t.when(s)) {
      return {
        won: true,
        tier: t.tier,
        prizeLabel: t.label,
        prizeAmountRs: t.prizeRs,
        prizeAmountFormatted: t.prizeRs != null ? fmt(t.prizeRs) : (t.nonCash || null),
        note: t.note || null,
      };
    }
  }
  return { won: false, tier: null, prizeLabel: null, prizeAmountRs: 0,
           prizeAmountFormatted: null, note: null };
}

// ---------------------------------------------------------------
// Tier-list builders for the two most common shapes
// ---------------------------------------------------------------

// "SET match + one bonus (letter/zodiac)" — Handahana, Dhana Nidhanaya,
// Govisetha, Ada Kotipathi, Shanida, Super Ball, Lagna Wasana
// amounts: { c4b, c4, c3b, c3, c2b, c2, c1b, c1, c0b }
function comboTiers(bonusField, amounts, extra) {
  const list = [
    { tier: 'SUPER',  label: `4 Numbers + ${bonusField.label} Correct`, prizeRs: amounts.c4b,
      when: s => s.setCount === 4 && s[bonusField.key] },
    { tier: '1ST',    label: '4 Numbers Correct', prizeRs: amounts.c4,
      when: s => s.setCount === 4 },
    { tier: '2ND',    label: `Any 3 Numbers + ${bonusField.label} Correct`, prizeRs: amounts.c3b,
      when: s => s.setCount === 3 && s[bonusField.key] },
    { tier: '3RD',    label: 'Any 3 Numbers Correct', prizeRs: amounts.c3,
      when: s => s.setCount === 3 },
    { tier: '4TH',    label: `Any 2 Numbers + ${bonusField.label} Correct`, prizeRs: amounts.c2b,
      when: s => s.setCount === 2 && s[bonusField.key] },
    { tier: '5TH',    label: 'Any 2 Numbers Correct', prizeRs: amounts.c2,
      when: s => s.setCount === 2 },
    { tier: '6TH',    label: `Any Number + ${bonusField.label} Correct`, prizeRs: amounts.c1b,
      when: s => s.setCount === 1 && s[bonusField.key] },
    { tier: '7TH',    label: 'Any Number Correct', prizeRs: amounts.c1,
      when: s => s.setCount === 1 },
    { tier: '8TH',    label: `${bonusField.label} Correct`, prizeRs: amounts.c0b,
      when: s => s.setCount === 0 && s[bonusField.key] },
  ];
  if (extra) list.push(...extra);
  return list;
}

const LETTER = { key: 'letter', label: 'Letter' };
const ZODIAC = { key: 'zodiac', label: 'Zodiac' };

// "Positional match (Last N / First N) + bonus only at full match" —
// Mahajana Sampatha, NLB Jaya, Supiri Dhana Sampatha, Jaya Sampatha
function positionalTiers(cfg) {
  const list = [];
  list.push({ tier: 'SUPER', label: `Letter and ${cfg.total} Numbers Correct`, prizeRs: cfg.fullWithBonus,
    when: s => s.posStart === cfg.total && s.posEnd === cfg.total && s.letter });
  list.push({ tier: '1ST', label: `${cfg.total} Numbers Correct`, prizeRs: cfg.fullNoBonus,
    when: s => s.posStart === cfg.total && s.posEnd === cfg.total });
  for (const t of cfg.lastTiers) {
    list.push({ tier: t.tier, label: `Last ${t.n} Number${t.n>1?'s':''} Correct`, prizeRs: t.prizeRs,
      when: s => s.posEnd === t.n });
  }
  for (const t of (cfg.firstTiers || [])) {
    list.push({ tier: t.tier, label: `First ${t.n} Number${t.n>1?'s':''} Correct`, prizeRs: t.prizeRs,
      when: s => s.posStart === t.n });
  }
  if (cfg.anyOrderRs != null) {
    list.push({ tier: 'ANY_ORDER', label: `All ${cfg.total} Numbers (any order)`, prizeRs: cfg.anyOrderRs,
      when: s => s.setCount === cfg.total && s.posStart < cfg.total });
  }
  list.push({ tier: 'LETTER', label: 'Letter Correct', prizeRs: cfg.letterAloneRs,
    when: s => s.letter && s.posStart === 0 && s.posEnd === 0 });
  return list;
}

// ---------------------------------------------------------------
// PRIZE_TABLES — per-slug tier lists (built lazily via functions
// below because some need per-lottery custom shapes)
// ---------------------------------------------------------------

function handahanaTiers() {
  return comboTiers(ZODIAC, {
    c4b: 3000000, c4: 1000000, c3b: 25000, c3: 2000,
    c2b: 500, c2: 200, c1b: 120, c1: 40, c0b: 40,
  });
}

function dhanaNidhanayaTiers() {
  return comboTiers(LETTER, {
    c4b: 80000000, c4: 2000000, c3b: 200000, c3: 6000,
    c2b: 2000, c2: 200, c1b: 120, c1: 40, c0b: 40,
  }, [
    // 9th tier — "Special Letter Correct". Real NLB draws have a SECOND
    // letter used only for this tier, but it is never shown on the public
    // results page (verified live) — our scraper cannot see it. We do NOT
    // guess; we just flag it so the app never reports a wrong win/loss.
    { tier: 'SPECIAL_LETTER_UNAVAILABLE', label: 'Special Letter Correct', prizeRs: null,
      nonCash: null, when: () => false,
      note: 'Special Letter (9th tier, Rs.40) NLB වෙබ් අඩවියේ පිටුවේ පෙන්නන්නේ නෑ — check කරන්න බෑ.' }
  ]);
}

function govisethaTiers() {
  return comboTiers(LETTER, {
    c4b: 60000000, c4: 2000000, c3b: 250000, c3: 5000,
    c2b: 2000, c2: 200, c1b: 200, c1: 40, c0b: 40,
  });
}

function adaKotipathiTiers() {
  return comboTiers(LETTER, {
    c4b: 50000000, c4: 2000000, c3b: 200000, c3: 4000,
    c2b: 2000, c2: 200, c1b: 200, c1: 40, c0b: 40,
  });
}

const shanidaTiers = adaKotipathiTiers;   // ම table එකමයි
const superBallTiers = adaKotipathiTiers; // ම table එකමයි

function lagnaWasanaTiers() {
  return comboTiers(ZODIAC, {
    c4b: 3000000, c4: 1000000, c3b: 20000, c3: 2000,
    c2b: 400, c2: 200, c1b: 120, c1: 40, c0b: 40,
  });
}

// Mega Power — Letter + Super Number + 4 numbers (3-way bonus system)
function megaPowerTiers() {
  return [
    { tier: 'MEGA_SUPER', label: 'Letter and Super Number and 4 Numbers Correct', prizeRs: 150000000,
      when: s => s.setCount === 4 && s.letter && s.superN },
    { tier: 'POWER_SUPER', label: 'Letter and 4 Numbers Correct', prizeRs: 10000000,
      when: s => s.setCount === 4 && s.letter },
    { tier: 'GRAND_SUPER', label: 'Super Number and 4 Numbers Correct', prizeRs: null,
      nonCash: 'Motor Car',
      when: s => s.setCount === 4 && s.superN },
    { tier: '1ST', label: '4 Numbers Correct', prizeRs: 2000000,
      when: s => s.setCount === 4 },
    { tier: '2ND', label: 'Letter and Any 3 Numbers Correct', prizeRs: 200000,
      when: s => s.setCount === 3 && s.letter },
    { tier: '3RD', label: 'Any 3 Numbers Correct', prizeRs: 5000,
      when: s => s.setCount === 3 },
    { tier: '4TH', label: 'Letter and Any 2 Numbers Correct', prizeRs: 2000,
      when: s => s.setCount === 2 && s.letter },
    { tier: '5TH', label: 'Any 2 Numbers Correct', prizeRs: 200,
      when: s => s.setCount === 2 },
    { tier: '6TH', label: 'Letter and Any Number Correct', prizeRs: 200,
      when: s => s.setCount === 1 && s.letter },
    { tier: '7TH', label: 'Any Number Correct', prizeRs: 40,
      when: s => s.setCount === 1 },
    { tier: '8TH', label: 'Letter Correct', prizeRs: 40,
      when: s => s.setCount === 0 && s.letter },
    { tier: '9TH', label: 'Super Number Correct', prizeRs: 40,
      when: s => s.setCount === 0 && !s.letter && s.superN },
  ];
}

// Kapruka — Letter + Super Number + 4 numbers (different shape from Mega Power:
// Super Number can also combine at the 4-number tier WITHOUT letter)
function kaprukaTiers() {
  return [
    { tier: 'TOP', label: '4 Numbers + English Letter + Super Number', prizeRs: 150000000,
      when: s => s.setCount === 4 && s.letter && s.superN },
    { tier: '2ND_TOP_A', label: '4 Numbers + Super Number', prizeRs: 10000000,
      when: s => s.setCount === 4 && s.superN },
    { tier: '2ND_TOP_B', label: '4 Numbers + English Letter', prizeRs: 10000000,
      when: s => s.setCount === 4 && s.letter },
    { tier: '3RD', label: '4 Numbers', prizeRs: 2000000,
      when: s => s.setCount === 4 },
    { tier: '4TH', label: 'Any 3 Numbers + English Letter', prizeRs: 200000,
      when: s => s.setCount === 3 && s.letter },
    { tier: '5TH', label: 'Any 3 Numbers', prizeRs: 4000,
      when: s => s.setCount === 3 },
    { tier: '6TH', label: 'Any 2 Numbers + English Letter', prizeRs: 2000,
      when: s => s.setCount === 2 && s.letter },
    { tier: '7TH', label: 'Any 2 Numbers', prizeRs: 200,
      when: s => s.setCount === 2 },
    { tier: '8TH', label: 'Any 1 Number + English Letter', prizeRs: 200,
      when: s => s.setCount === 1 && s.letter },
    { tier: '9TH', label: 'Any Single Number', prizeRs: 40,
      when: s => s.setCount === 1 },
    { tier: '10TH', label: 'Any English Letter', prizeRs: 40,
      when: s => s.setCount === 0 && s.letter },
    { tier: '11TH', label: 'Super Number', prizeRs: 40,
      when: s => s.setCount === 0 && !s.letter && s.superN },
  ];
}

// Mahajana Sampatha — 6 numbers, positional, NO "any order" fallback
function mahajanaSampathaTiers() {
  return positionalTiers({
    total: 6,
    fullWithBonus: 20000000,
    fullNoBonus: 2500000,
    lastTiers: [
      { tier: '2ND', n: 5, prizeRs: 100000 },
      { tier: '3RD', n: 4, prizeRs: 15000 },
      { tier: '4TH', n: 3, prizeRs: 2000 },
      { tier: '5TH', n: 2, prizeRs: 200 },
      { tier: '6TH', n: 1, prizeRs: 40 },
    ],
    firstTiers: [
      { tier: '7TH', n: 5, prizeRs: 100000 },
      { tier: '8TH', n: 4, prizeRs: 2000 },
      { tier: '9TH', n: 3, prizeRs: 200 },
      { tier: '10TH', n: 2, prizeRs: 80 },
      { tier: '11TH', n: 1, prizeRs: 40 },
    ],
    letterAloneRs: 40,
  });
}

// NLB Jaya — 4 numbers, positional
function nlbJayaTiers() {
  return positionalTiers({
    total: 4,
    fullWithBonus: 500000,
    fullNoBonus: 50000,
    lastTiers: [
      { tier: '3RD', n: 3, prizeRs: 2000 },
      { tier: '4TH', n: 2, prizeRs: 200 },
      { tier: '5TH', n: 1, prizeRs: 40 },
    ],
    firstTiers: [
      { tier: '6TH', n: 3, prizeRs: 200 },
      { tier: '7TH', n: 2, prizeRs: 80 },
      { tier: '8TH', n: 1, prizeRs: 40 },
    ],
    letterAloneRs: 40,
  });
}

// Supiri Dhana Sampatha (DLB) — 6 numbers + letter, positional WITH
// "any order" Rs.500 fallback tier
function supiriDhanaSampathaTiers() {
  return positionalTiers({
    total: 6,
    fullWithBonus: 20000000,
    fullNoBonus: 2500000,
    lastTiers: [
      { tier: '2ND', n: 5, prizeRs: 100000 },
      { tier: '3RD', n: 4, prizeRs: 20000 },
      { tier: '4TH', n: 3, prizeRs: 2000 },
      { tier: '5TH', n: 2, prizeRs: 200 },
      { tier: '6TH', n: 1, prizeRs: 40 },
    ],
    firstTiers: [
      { tier: '7TH', n: 5, prizeRs: 100000 },
      { tier: '8TH', n: 4, prizeRs: 2000 },
      { tier: '9TH', n: 3, prizeRs: 200 },
      { tier: '10TH', n: 2, prizeRs: 120 },
      { tier: '11TH', n: 1, prizeRs: 40 },
    ],
    anyOrderRs: 500,
    letterAloneRs: 40,
  });
}

// Jaya Sampatha (DLB) — 4 numbers, STRICTLY back-to-forward positional,
// no "first N" tiers, and no Last-1 tier either (only down to Last 2)
function jayaSampathaTiers() {
  return [
    { tier: 'TOP', label: 'All 4 numbers back to forward + English Letter', prizeRs: 250000,
      when: s => s.posEnd === 4 && s.letter },
    { tier: '2ND', label: '4 numbers in order from back to forward', prizeRs: 50000,
      when: s => s.posEnd === 4 },
    { tier: '3RD', label: 'Matching 3 numbers from back to forward', prizeRs: 4000,
      when: s => s.posEnd === 3 },
    { tier: '4TH', label: '2 printed numbers from back to forward', prizeRs: 1000,
      when: s => s.posEnd === 2 },
    { tier: '5TH', label: 'English Letter', prizeRs: 80,
      when: s => s.letter && s.posEnd < 2 },
  ];
}

// Sasiri (DLB) — 3 numbers, plain SET match, no bonus at all
function sasiriTiers() {
  return [
    { tier: '1ST', label: 'Any 3 Numbers', prizeRs: 200000, when: s => s.setCount === 3 },
    { tier: '2ND', label: 'Any 2 Numbers', prizeRs: 400,    when: s => s.setCount === 2 },
    { tier: '3RD', label: 'Any Single Number', prizeRs: 40, when: s => s.setCount === 1 },
  ];
}

// Ada Sampatha — 3 independent sub-games (2-digit / 3-digit / 4-digit+letter)
function adaSampathaSubTiers() {
  return {
    0: [ // 2 numbers — full SET match only
      { tier: '1ST', label: '2 Numbers Correct', prizeRs: 1000, when: s => s.setCount === 2 && s.total === 2 } ],
    1: [ // 3 numbers — full SET match only
      { tier: '1ST', label: '3 Numbers Correct', prizeRs: 4000, when: s => s.setCount === 3 && s.total === 3 } ],
    2: [ // 4 numbers + letter
      { tier: '2ND', label: '4 Numbers and Letter Correct', prizeRs: 250000,
        when: s => s.setCount === 4 && s.letter },
      { tier: '1ST', label: '4 Numbers Correct', prizeRs: 50000,
        when: s => s.setCount === 4 },
      { tier: '3RD', label: 'Letter Correct', prizeRs: 80,
        when: s => s.setCount === 0 && s.letter } ],
  };
}

// Suba Dawasak — 2 independent sub-games (zodiac+3-number / plain 4-number)
function subaDawasakSubTiers() {
  return {
    0: [ // zodiac + 3 numbers — SET match ("Any" wording)
      { tier: '1ST', label: 'Zodiac and 3 Numbers Correct', prizeRs: 500000,
        when: s => s.setCount === 3 && s.zodiac },
      { tier: '2ND', label: '3 Numbers Correct', prizeRs: 50000,
        when: s => s.setCount === 3 },
      { tier: '3RD', label: 'Zodiac and Any 2 Numbers Correct', prizeRs: 2500,
        when: s => s.setCount === 2 && s.zodiac },
      { tier: '4TH', label: 'Any 2 Numbers Correct', prizeRs: 1000,
        when: s => s.setCount === 2 },
      { tier: '5TH', label: 'Zodiac and Any Number Correct', prizeRs: 200,
        when: s => s.setCount === 1 && s.zodiac },
      { tier: '6TH', label: 'Any Number Correct', prizeRs: 40,
        when: s => s.setCount === 1 },
      { tier: '7TH', label: 'Zodiac Correct', prizeRs: 40,
        when: s => s.setCount === 0 && s.zodiac } ],
    1: [ // plain 4 numbers — SET match, single tier only
      { tier: '1ST', label: '4 Numbers Correct', prizeRs: 25000,
        when: s => s.setCount === 4 } ],
  };
}

// Waasi (DLB) — 2 numbers + letter + super number. No live draw data exists
// right now (site returns "No Data Found"), so we keep the table for when
// data becomes available, but evaluatePrize() will refuse to guess.
function waasiTiers() {
  return [
    { tier: 'TOP', label: '2 Numbers + English Letter + Super Number', prizeRs: 1000000,
      when: s => s.setCount === 2 && s.letter && s.superN },
    { tier: '2ND', label: '2 Numbers + English Letter', prizeRs: 500000,
      when: s => s.setCount === 2 && s.letter },
    { tier: '3RD', label: '2 Numbers + Super Number', prizeRs: 50000,
      when: s => s.setCount === 2 && s.superN },
    { tier: '4TH', label: '2 Numbers', prizeRs: 25000,
      when: s => s.setCount === 2 },
    { tier: '5TH', label: '1 Number + Super Number + English Letter', prizeRs: 1000,
      when: s => s.setCount === 1 && s.superN && s.letter },
    { tier: '6TH', label: '1 Number + English Letter', prizeRs: 500,
      when: s => s.setCount === 1 && s.letter },
    { tier: '7TH', label: '1 Number + Super Number', prizeRs: 500,
      when: s => s.setCount === 1 && s.superN },
    { tier: '8TH', label: 'Super Number + English Letter', prizeRs: 120,
      when: s => s.setCount === 0 && s.superN && s.letter },
    { tier: '9TH', label: '1 Number Only', prizeRs: 40,
      when: s => s.setCount === 1 },
    { tier: '10TH', label: 'English Letter', prizeRs: 40,
      when: s => s.setCount === 0 && s.letter },
    { tier: '11TH', label: 'Only Super Number', prizeRs: 40,
      when: s => s.setCount === 0 && s.superN },
  ];
}

// ---------------------------------------------------------------
// Registry: slug → { kind: 'single'|'multi', tiers/subTiers, note }
// ---------------------------------------------------------------
const REGISTRY = {
  'handahana':              { kind: 'single', build: handahanaTiers },
  'dhana-nidhanaya':         { kind: 'single', build: dhanaNidhanayaTiers },
  'mega-power':              { kind: 'single', build: megaPowerTiers },
  'govisetha':               { kind: 'single', build: govisethaTiers },
  'mahajana-sampatha':       { kind: 'single', build: mahajanaSampathaTiers },
  'nlb-jaya':                { kind: 'single', build: nlbJayaTiers },
  'ada-sampatha':            { kind: 'multi',  buildSub: adaSampathaSubTiers },
  'suba-dawasak':            { kind: 'multi',  buildSub: subaDawasakSubTiers },

  'ada-kotipathi':           { kind: 'single', build: adaKotipathiTiers },
  'shanida':                 { kind: 'single', build: shanidaTiers },
  'lagna-wasana':            { kind: 'single', build: lagnaWasanaTiers },
  'supiri-dhana-sampatha':   { kind: 'single', build: supiriDhanaSampathaTiers },
  'super-ball':              { kind: 'single', build: superBallTiers },
  'kapruka':                 { kind: 'single', build: kaprukaTiers },
  'sasiri':                  { kind: 'single', build: sasiriTiers },
  'jaya-sampatha':           { kind: 'single', build: jayaSampathaTiers },
  'waasi':                   { kind: 'single', build: waasiTiers, noLiveData: true },
};

function hasPrizeTable(slug) {
  return !!REGISTRY[slug];
}

function getLotteryKind(slug) {
  const r = REGISTRY[slug];
  return r ? r.kind : null;
}

/**
 * evaluatePrize(slug, draw, ticket, opts)
 *   draw    — official draw object (data.json draw record). For multi-game
 *             lotteries, pass the whole draw (it has .subGames).
 *   ticket  — { letter, zodiac, superNumber, numbers } for single-game,
 *             or the SAME shape but you must also pass opts.subGameIndex
 *             (0,1,2...) for multi-game lotteries.
 *
 * returns { won, tier, prizeLabel, prizeAmountRs, prizeAmountFormatted,
 *           note, subGameIndex? , unavailable? }
 */
function evaluatePrize(slug, draw, ticket, opts) {
  const reg = REGISTRY[slug];
  if (!reg) {
    return {
      won: false, tier: null, prizeLabel: null, prizeAmountRs: 0,
      prizeAmountFormatted: null, unavailable: true,
      note: `"${slug}" සඳහා තාම ඇත්ත prize table එකක් නෑ.`
    };
  }

  if (reg.noLiveData) {
    return {
      won: false, tier: null, prizeLabel: null, prizeAmountRs: 0,
      prizeAmountFormatted: null, unavailable: true,
      note: `${slug}: දැනට official draw දත්තයක් නෑ (site එකේම "No Data Found"). ` +
            `Prize check කරන්න බෑ — වැරදි answer එකක් දෙනවට වඩා check එක නවත්තනවා.`
    };
  }

  if (reg.kind === 'multi') {
    const idx = opts && typeof opts.subGameIndex === 'number' ? opts.subGameIndex : null;
    if (idx === null || !draw.subGames || !draw.subGames[idx]) {
      return {
        won: false, tier: null, prizeLabel: null, prizeAmountRs: 0,
        prizeAmountFormatted: null, unavailable: true,
        note: `${slug} ගණයේ lottery එකකට sub-game එක (subGameIndex) දෙන්න ඕන.`
      };
    }
    const subDraw = draw.subGames[idx];
    const subTiersMap = reg.buildSub();
    const tiers = subTiersMap[idx] || [];
    const s = stats(subDraw, ticket);
    const result = evalTiers(tiers, s);
    result.subGameIndex = idx;
    if (!result.won) {
      result.note = result.note ||
        'මේ sub-game එකේ tier එකකටවත් ගැලපුනේ නෑ — දිනුමක් නෑ.';
    }
    return result;
  }

  // single-game
  const s = stats(draw, ticket);
  const tiers = reg.build();
  const result = evalTiers(tiers, s);
  if (!result.won) {
    result.note = result.note || 'ලොතරැයියේ එකම tier එකකටවත් ගැලපුනේ නෑ — දිනුමක් නෑ.';
  }
  return result;
}

module.exports = {
  evaluatePrize,
  hasPrizeTable,
  getLotteryKind,
  stats,       // exported for testing
  REGISTRY,    // exported for testing / introspection
};
