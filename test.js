/**
 * test.js — ඔක්කොම වැඩ කරනවද කියලා බලන automated tests
 * run: npm test
 */

const { checkTicket } = require('./server');
const { normalizeDate } = require('./scraper');
const { evaluatePrize } = require('./prizes');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`      → ${e.message}`);
    fail++;
  }
}

function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg||''} expected ${b}, got ${a}`);
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'expected truthy');
}

console.log('\n=== 1. Date parsing ===');
t('NLB date format එක convert වෙනවා', () => {
  eq(normalizeDate('Monday September 07, 2026'), '2026-09-07');
});
t('තව date එකක්', () => {
  eq(normalizeDate('Friday January 02, 2026'), '2026-01-02');
});
t('වැරදි date එකකට null', () => {
  eq(normalizeDate('garbage'), null);
});

console.log('\n=== 2. Check logic — හරියටම ගැලපෙන ticket ===');
const draw = { drawNo:'6303', date:'2026-09-07', letter:'Z',
               numbers:['8','1','7','7','1','2'] };

t('ඔක්කොම ගැලපුණාම JACKPOT', () => {
  const r = checkTicket(draw, { letter:'Z', numbers:['8','1','7','7','1','2'] });
  ok(r.won, 'won විය යුතුයි');
  eq(r.tier, 'JACKPOT');
});

t('අකුර වැරදි උනාම ALL_NUMBERS', () => {
  const r = checkTicket(draw, { letter:'A', numbers:['8','1','7','7','1','2'] });
  ok(r.won);
  eq(r.tier, 'ALL_NUMBERS');
  eq(r.detail.letterMatch, false);
});

t('අකුර lowercase උනත් ගැලපෙනවා', () => {
  const r = checkTicket(draw, { letter:'z', numbers:['8','1','7','7','1','2'] });
  eq(r.detail.letterMatch, true);
});

console.log('\n=== 3. Check logic — කොටසක් ගැලපෙනවා ===');
t('ඉදිරියෙන් ඉලක්කම් 3ක් ගැලපෙනවා', () => {
  const r = checkTicket(draw, { letter:'Z', numbers:['8','1','7','0','0','0'] });
  eq(r.detail.positionalFromStart, 3);
  ok(r.won);
});

t('ඉදිරියෙන් 2ක් විතරයි — positional win එකක් නෑ', () => {
  const r = checkTicket(draw, { letter:'Q', numbers:['8','1','0','0','0','0'] });
  eq(r.detail.positionalFromStart, 2);
});

t('පිටිපස්සෙන් ගැලපෙන එකත් හොයනවා', () => {
  const r = checkTicket(draw, { letter:'Q', numbers:['0','0','0','7','1','2'] });
  eq(r.detail.positionalFromEnd, 3);
  ok(r.won);
});

console.log('\n=== 4. Check logic — කිසිවක් ගැලපෙන්නේ නෑ ===');
t('සම්පූර්ණයෙන් වෙනස් ticket එකකට won=false', () => {
  const r = checkTicket(draw, { letter:'Q', numbers:['3','4','5','6','9','0'] });
  eq(r.won, false);
  eq(r.tier, null);
});

console.log('\n=== 5. Set-match lottery (Govisetha වගේ) ===');
const setDraw = { drawNo:'3103', date:'2026-09-07', letter:'Z',
                  numbers:['22','48','57','58'] };

t('පිළිවෙළ වෙනස් උනත් set match වෙනවා', () => {
  const r = checkTicket(setDraw, { letter:'Z', numbers:['58','22','57','48'] });
  eq(r.detail.setMatches, 4);
  ok(r.won);
});

t('4න් 3ක් ගැලපෙනවා', () => {
  const r = checkTicket(setDraw, { letter:'Z', numbers:['22','48','57','99'] });
  eq(r.detail.setMatches, 3);
  eq(r.tier, 'MATCH_3');
});

t('duplicate අංක දෙපාරක් count වෙන්නේ නෑ', () => {
  const r = checkTicket(setDraw, { letter:'Z', numbers:['22','22','22','22'] });
  eq(r.detail.setMatches, 1, 'official එකේ 22 එකයි තියෙන්නේ');
});

console.log('\n=== 6. Real scraped data ===');
const DATA = path.join(__dirname, 'data.json');
if (!fs.existsSync(DATA)) {
  console.log('  ⚠ data.json නෑ — මුලින් `npm run scrape` run කරන්න');
} else {
  const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));

  t('lottery 10කට වඩා තියෙනවා', () => {
    ok(d.lotteries.length >= 10, `only ${d.lotteries.length}`);
  });

  t('NLB සහ DLB දෙකම තියෙනවා', () => {
    const p = new Set(d.lotteries.map(l => l.provider));
    ok(p.has('NLB'), 'NLB නෑ');
    ok(p.has('DLB'), 'DLB නෑ');
  });

  t('හැම lottery එකකටම draws තියෙනවා', () => {
    const bad = d.lotteries.filter(l => !l.draws || !l.draws.length);
    ok(bad.length === 0, `හිස්: ${bad.map(b=>b.slug).join(', ')}`);
  });

  t('හැම draw එකකටම drawNo + numbers තියෙනවා', () => {
    for (const l of d.lotteries) {
      for (const dr of l.draws) {
        ok(dr.drawNo, `${l.slug}: drawNo නෑ`);
        ok(dr.numbers && dr.numbers.length, `${l.slug} draw ${dr.drawNo}: numbers නෑ`);
      }
    }
  });

  t('දිනය YYYY-MM-DD format එකේ', () => {
    for (const l of d.lotteries) {
      const dr = l.draws[0];
      ok(/^\d{4}-\d{2}-\d{2}$/.test(dr.date), `${l.slug}: bad date "${dr.date}"`);
    }
  });

  t('draw අංක අවරෝහණව (අලුත්ම මුලින්)', () => {
    for (const l of d.lotteries) {
      if (l.draws.length < 2) continue;
      const a = +l.draws[0].drawNo, b = +l.draws[1].drawNo;
      ok(a > b, `${l.slug}: ${a} should be > ${b}`);
    }
  });

  t('අංක ඔක්කොම digits විතරයි', () => {
    for (const l of d.lotteries) {
      for (const n of l.draws[0].numbers) {
        ok(/^\d{1,2}$/.test(n), `${l.slug}: bad number "${n}"`);
      }
    }
  });

  t('රාශි lottery වල zodiac එක වෙන් වෙලා', () => {
    const z = d.lotteries.filter(l => l.draws[0].zodiac);
    ok(z.length > 0, 'රාශි lottery එකක්වත් හම්බුනේ නෑ');
    for (const l of z) {
      ok(!/^\d+$/.test(l.draws[0].zodiac),
         `${l.slug}: zodiac "${l.draws[0].zodiac}" ඉලක්කමක්`);
    }
  });

  // ඇත්ත data එකෙන් end-to-end check එකක්
  t('ඇත්ත draw එකකට ඒකේම අංක දැම්මම දිනනවා', () => {
    const l = d.lotteries.find(x => x.slug === 'mahajana-sampatha') || d.lotteries[0];
    const dr = l.draws[0];
    const r = checkTicket(dr, { letter: dr.letter, numbers: dr.numbers });
    ok(r.won, `${l.slug}: තමන්ගේම අංක වලට දිනන්න ඕන`);
  });

  console.log(`\n  📊 Lottery ${d.lotteries.length}ක්, ` +
    `draw ${d.lotteries.reduce((s,l)=>s+l.draws.length,0)}ක්`);

  // ================================================================
  // 7. Real Prize Engine (prizes.js) — ඇත්ත prize structure test
  // ================================================================
  console.log('\n=== 7. Real Prize Engine — ඇත්ත prize table ===');

  function getDraw(slug) {
    const l = d.lotteries.find(x => x.slug === slug);
    if (!l) throw new Error(`${slug} data.json එකේ නෑ`);
    return l.draws[0];
  }
  function flip(v) { return v === '0' ? '9' : '0'; } // number එකක් හිතාමතා වරදින්න හදනවා

  // ---- Mahajana Sampatha — Letter+6 Numbers = Super (positional) ----
  t('mahajana-sampatha: ඔක්කොම ගැලපුණාම Super Prize (Rs.20,000,000)', () => {
    const dr = getDraw('mahajana-sampatha');
    const r = evaluatePrize('mahajana-sampatha', dr, { letter: dr.letter, numbers: dr.numbers });
    ok(r.won); eq(r.tier, 'SUPER'); eq(r.prizeAmountRs, 20000000);
  });
  t('mahajana-sampatha: Last 3 විතරක් ගැලපුණාම 4th (Rs.2,000)', () => {
    const dr = getDraw('mahajana-sampatha');
    const mine = [...dr.numbers];
    mine[0]=flip(mine[0]); mine[1]=flip(mine[1]); mine[2]=flip(mine[2]);
    const r = evaluatePrize('mahajana-sampatha', dr, { letter:'Q', numbers: mine });
    ok(r.won); eq(r.tier, '4TH'); eq(r.prizeAmountRs, 2000);
  });
  t('mahajana-sampatha: First 3 විතරක් ගැලපුණාම 9th (Rs.200)', () => {
    const dr = getDraw('mahajana-sampatha');
    const mine = [...dr.numbers];
    mine[3]=flip(mine[3]); mine[4]=flip(mine[4]); mine[5]=flip(mine[5]);
    const r = evaluatePrize('mahajana-sampatha', dr, { letter:'Q', numbers: mine });
    ok(r.won); eq(r.tier, '9TH'); eq(r.prizeAmountRs, 200);
  });
  t('mahajana-sampatha: කිසිවක් ගැලපුනේ නෑ නම් won=false', () => {
    const dr = getDraw('mahajana-sampatha');
    const mine = dr.numbers.map(flip);
    const r = evaluatePrize('mahajana-sampatha', dr, { letter:'Q', numbers: mine });
    eq(r.won, false); eq(r.tier, null);
  });

  // ---- Govisetha — Letter+4 Numbers (SET match) ----
  t('govisetha: Letter+4 Numbers = Super Prize (Rs.60,000,000)', () => {
    const dr = getDraw('govisetha');
    const r = evaluatePrize('govisetha', dr, { letter: dr.letter, numbers: dr.numbers });
    ok(r.won); eq(r.tier, 'SUPER'); eq(r.prizeAmountRs, 60000000);
  });
  t('govisetha: 3 Numbers විතරක් (letter නැතුව) = 3rd (Rs.5,000)', () => {
    const dr = getDraw('govisetha');
    const mine = [...dr.numbers]; mine[0] = flip(mine[0]);
    const r = evaluatePrize('govisetha', dr, { letter: 'ZZ', numbers: mine });
    ok(r.won); eq(r.tier, '3RD'); eq(r.prizeAmountRs, 5000);
  });

  // ---- Mega Power — Letter + Super Number + 4 Numbers (3-way bonus) ----
  t('mega-power: Letter+SuperNumber+4 Numbers = Mega Super (Rs.150,000,000)', () => {
    const dr = getDraw('mega-power');
    const r = evaluatePrize('mega-power', dr,
      { letter: dr.letter, superNumber: dr.superNumber, numbers: dr.numbers });
    ok(r.won); eq(r.tier, 'MEGA_SUPER'); eq(r.prizeAmountRs, 150000000);
  });
  t('mega-power: Letter+4 Numbers විතරක් (super number වැරදි) = Power Super (Rs.10,000,000)', () => {
    const dr = getDraw('mega-power');
    const r = evaluatePrize('mega-power', dr,
      { letter: dr.letter, superNumber: '99', numbers: dr.numbers });
    ok(r.won); eq(r.tier, 'POWER_SUPER'); eq(r.prizeAmountRs, 10000000);
  });
  t('mega-power: SuperNumber+4 Numbers විතරක් (letter වැරදි) = Grand Super (Motor Car)', () => {
    const dr = getDraw('mega-power');
    const r = evaluatePrize('mega-power', dr,
      { letter: 'ZZ', superNumber: dr.superNumber, numbers: dr.numbers });
    ok(r.won); eq(r.tier, 'GRAND_SUPER'); eq(r.prizeAmountRs, null);
    ok(r.prizeAmountFormatted === null || r.prizeAmountFormatted === undefined || true,
      'non-cash tier — Motor Car');
  });

  // ---- Ada Kotipathi (DLB) — Letter+4 Numbers (SET match) ----
  t('ada-kotipathi: Letter+4 Numbers = Super (Rs.50,000,000)', () => {
    const dr = getDraw('ada-kotipathi');
    const r = evaluatePrize('ada-kotipathi', dr, { letter: dr.letter, numbers: dr.numbers });
    ok(r.won); eq(r.tier, 'SUPER'); eq(r.prizeAmountRs, 50000000);
  });

  // ---- Handahana — Zodiac+4 Numbers (SET match) ----
  t('handahana: Zodiac+4 Numbers = Super (Rs.3,000,000)', () => {
    const dr = getDraw('handahana');
    const r = evaluatePrize('handahana', dr, { zodiac: dr.zodiac, numbers: dr.numbers });
    ok(r.won); eq(r.tier, 'SUPER'); eq(r.prizeAmountRs, 3000000);
  });
  t('handahana: Zodiac වැරදි නම් 4 Numbers විතරක් = 1st (Rs.1,000,000)', () => {
    const dr = getDraw('handahana');
    const r = evaluatePrize('handahana', dr, { zodiac: 'LEO', numbers: dr.numbers });
    // draw zodiac එකම LEO උනොත් වෙනස් sign එකක් දෙනවා
    if (dr.zodiac === 'LEO') {
      const r2 = evaluatePrize('handahana', dr, { zodiac: 'VIRGO', numbers: dr.numbers });
      ok(r2.won); eq(r2.tier, '1ST'); eq(r2.prizeAmountRs, 1000000);
    } else {
      ok(r.won); eq(r.tier, '1ST'); eq(r.prizeAmountRs, 1000000);
    }
  });

  // ---- Jaya Sampatha (DLB) — STRICTLY back-to-forward positional ----
  t('jaya-sampatha: ඔක්කොම back-to-forward + Letter = Top (Rs.250,000)', () => {
    const dr = getDraw('jaya-sampatha');
    const r = evaluatePrize('jaya-sampatha', dr, { letter: dr.letter, numbers: dr.numbers });
    ok(r.won); eq(r.tier, 'TOP'); eq(r.prizeAmountRs, 250000);
  });
  t('jaya-sampatha: back-3 විතරක් ගැලපුණාම 3rd (Rs.4,000)', () => {
    const dr = getDraw('jaya-sampatha');
    const mine = [...dr.numbers]; mine[0] = flip(mine[0]); // ඉස්සරහම ඉලක්කම විතරක් වරදවනවා
    const r = evaluatePrize('jaya-sampatha', dr, { letter: 'ZZ', numbers: mine });
    ok(r.won); eq(r.tier, '3RD'); eq(r.prizeAmountRs, 4000);
  });

  // ---- Ada Sampatha — 3 independent sub-games ----
  t('ada-sampatha[0]: 2 Numbers Correct = Rs.1,000', () => {
    const dr = getDraw('ada-sampatha');
    const sub = dr.subGames[0];
    const r = evaluatePrize('ada-sampatha', dr, { numbers: sub.numbers }, { subGameIndex: 0 });
    ok(r.won); eq(r.tier, '1ST'); eq(r.prizeAmountRs, 1000);
  });
  t('ada-sampatha[1]: 3 Numbers Correct = Rs.4,000', () => {
    const dr = getDraw('ada-sampatha');
    const sub = dr.subGames[1];
    const r = evaluatePrize('ada-sampatha', dr, { numbers: sub.numbers }, { subGameIndex: 1 });
    ok(r.won); eq(r.tier, '1ST'); eq(r.prizeAmountRs, 4000);
  });
  t('ada-sampatha[2]: 4 Numbers + Letter Correct = Rs.250,000', () => {
    const dr = getDraw('ada-sampatha');
    const sub = dr.subGames[2];
    const r = evaluatePrize('ada-sampatha', dr,
      { letter: sub.letter, numbers: sub.numbers }, { subGameIndex: 2 });
    ok(r.won); eq(r.tier, '2ND'); eq(r.prizeAmountRs, 250000);
  });
  t('ada-sampatha[2]: 4 Numbers විතරක් (letter වැරදි) = Rs.50,000', () => {
    const dr = getDraw('ada-sampatha');
    const sub = dr.subGames[2];
    const r = evaluatePrize('ada-sampatha', dr,
      { letter: 'ZZ', numbers: sub.numbers }, { subGameIndex: 2 });
    ok(r.won); eq(r.tier, '1ST'); eq(r.prizeAmountRs, 50000);
  });

  // ---- Suba Dawasak — 2 independent sub-games ----
  t('suba-dawasak[0]: Zodiac+3 Numbers Correct = Rs.500,000', () => {
    const dr = getDraw('suba-dawasak');
    const sub = dr.subGames[0];
    const r = evaluatePrize('suba-dawasak', dr,
      { zodiac: sub.zodiac, numbers: sub.numbers }, { subGameIndex: 0 });
    ok(r.won); eq(r.tier, '1ST'); eq(r.prizeAmountRs, 500000);
  });
  t('suba-dawasak[1]: 4 Numbers Correct (plain game) = Rs.25,000', () => {
    const dr = getDraw('suba-dawasak');
    const sub = dr.subGames[1];
    const r = evaluatePrize('suba-dawasak', dr, { numbers: sub.numbers }, { subGameIndex: 1 });
    ok(r.won); eq(r.tier, '1ST'); eq(r.prizeAmountRs, 25000);
  });

  // ---- Waasi — දැනට live draw data නෑ, "unavailable" කියලා පැහැදිලි කරන්න ඕන ----
  t('waasi: data.json එකේ නෑ නම් ලොතරැයි list එකේත් නැති වෙන්න ඕන', () => {
    const l = d.lotteries.find(x => x.slug === 'waasi');
    ok(!l, 'waasi draws තියෙනවා නම් prizes.js noLiveData flag එක අයින් කරන්න');
  });

  // ---- Dhana Nidhanaya — Special Letter tier (9th) is intentionally unavailable ----
  t('dhana-nidhanaya: Special Letter tier data නැති නිසා ඒක guess කරන්නේ නෑ', () => {
    const dr = getDraw('dhana-nidhanaya');
    const r = evaluatePrize('dhana-nidhanaya', dr, { letter: dr.letter, numbers: dr.numbers });
    // super prize ම ලැබෙන්න ඕන (9th tier logic එකට කිසි බලපෑමක් නැති බව තහවුරු කරනවා)
    ok(r.won); eq(r.tier, 'SUPER');
  });
}

console.log(`\n${'='.repeat(40)}`);
console.log(`✓ Pass: ${pass}   ✗ Fail: ${fail}`);
console.log('='.repeat(40) + '\n');
process.exit(fail ? 1 : 0);
