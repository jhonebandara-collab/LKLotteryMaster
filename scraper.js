/**
 * scraper.js — NLB + DLB results scraper
 *
 * වැදගත්: NLB එකේ bot-check එකක් තියෙනවා.
 * පළමු request එකට 'human' cookie එකක් set කරන script එකක් එනවා.
 * ඒක extract කරලා දෙවෙනි request එකට දාන්න ඕන.
 */

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const DATA_FILE = path.join(__dirname, 'data.json');

// DLB Lagna Wasana ලග්න icon එක image file එකක් (text නෙවෙයි).
// front_img/<id><sinhala-name>.png — Sinhala transliteration → English zodiac name
const DLB_ZODIAC_IMG_MAP = {
  mesha: 'ARIES', wushaba: 'TAURUS', mithuna: 'GEMINI', kataka: 'CANCER',
  sinha: 'LEO', kanya: 'VIRGO', thula: 'LIBRA', vushchika: 'SCORPIO',
  danu: 'SAGITTARIUS', makara: 'CAPRICORN', kumba: 'AQUARIUS', meena: 'PISCES',
};

// NLB lotteries — slug list (results index page එකෙන් ගත්තා)
const NLB_LOTTERIES = [
  { slug: 'mahajana-sampatha',     name: 'Mahajana Sampatha',  nameSi: 'මහජන සම්පත' },
  { slug: 'govisetha',             name: 'Govisetha',          nameSi: 'ගොවිසෙත' },
  { slug: 'dhana-nidhanaya',       name: 'Dhana Nidhanaya',    nameSi: 'ධන නිධානය' },
  { slug: 'mega-power',            name: 'Mega Power',         nameSi: 'මෙගා පවර්' },
  { slug: 'lucky-7',               name: 'Lucky 7',            nameSi: 'ලකී 7' },
  { slug: 'handahana',             name: 'Handahana',          nameSi: 'හඳහන' },
  { slug: 'ada-sampatha',          name: 'Ada Sampatha',       nameSi: 'අද සම්පත' },
  { slug: 'nlb-jaya',              name: 'NLB Jaya',           nameSi: 'NLB ජය' },
  { slug: 'suba-dawasak',          name: 'Suba Dawasak',       nameSi: 'සුබ දවසක්' },
  { slug: 'jathika-sampatha',      name: 'Jathika Sampatha',   nameSi: 'ජාතික සම්පත' },
  { slug: 'supiri-vasana',         name: 'Supiri Vasana',      nameSi: 'සුපිරි වාසනා' },
  { slug: 'sevana',                name: 'Sevana',             nameSi: 'සෙවණ' },
];

// ---------------------------------------------------------------
// NLB fetch — cookie bypass එක්ක
// ---------------------------------------------------------------
let nlbCookie = null;

async function nlbFetch(url) {
  const headers = { 'User-Agent': UA };
  if (nlbCookie) headers['Cookie'] = `human=${nlbCookie}`;

  let res = await fetch(url, { headers });
  let html = await res.text();

  // Bot-check page එකක් ද කියලා බලනවා
  const m = html.match(/setCookie\('human','([a-f0-9]+)'/);
  if (m) {
    nlbCookie = m[1];
    // cookie එක එක්ක නැවත try කරනවා
    res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Cookie': `human=${nlbCookie}` }
    });
    html = await res.text();
  }
  return html;
}

// ---------------------------------------------------------------
// NLB parser
// ---------------------------------------------------------------
// 📜 NLB results පිටුවේම දින 200+ක් තියෙනවා — ඒ නිසා limit එක 20 → 200
async function scrapeNLB(lottery, limit = NLB_MAX_DRAWS) {
  const url = `https://www.nlb.lk/results/${lottery.slug}`;
  const html = await nlbFetch(url);
  const $ = cheerio.load(html);

  // නවත්තපු lottery එකක් ද කියලා බලනවා
  if (/Lottery Discontinued/i.test(html)) {
    const err = new Error('DISCONTINUED');
    err.discontinued = true;
    throw err;
  }

  const draws = [];

  $('table.tbl tbody tr').each((i, row) => {
    if (draws.length >= limit) return false;

    const $row = $(row);
    const drawNo = $row.find('td').first().find('b').text().trim();
    if (!drawNo) return;

    // "Monday September 07, 2026" වගේ text එකක්
    const dateText = $row.find('td').first()
      .contents().filter((_, n) => n.type === 'text')
      .text().trim();

    // ⚠️ ඇතුළේ ol.B group කීයක් තියෙනවද කියලා බලනවා.
    // Ada Sampatha වගේ ලොතරැයි වල sub-game 3ක් වෙනම ol.B group වශයෙන් තියෙනවා
    // (2-digit, 3-digit, 4-digit+letter). Suba Dawasak එකේ 2ක් — zodiac+3-number
    // සහ වෙනම plain 4-number promotional draw එකක්.
    const groups = $row.find('ol.B').map((_, ol) => {
      const letters = [];
      const numbers = [];
      const zodiac = [];
      let superNumber = null;
      $(ol).find('li').each((_, li) => {
        const $li = $(li);
        const title = $li.attr('title') || '';
        const val = $li.text().trim();
        if (!val) return;
        if (/^letter$/i.test(title)) letters.push(val);
        else if (/^super number$/i.test(title)) superNumber = val;
        else if (/^zodiac$/i.test(title)) zodiac.push(val);
        else if (/^\d{1,2}$/.test(val)) numbers.push(val);
        else zodiac.push(val);          // fallback — රාශි නම් වගේ දේවල්
      });
      return { letters, numbers, zodiac, superNumber };
    }).get();

    const nonEmptyGroups = groups.filter(g => g.numbers.length || g.letters.length);
    if (nonEmptyGroups.length === 0) return;

    // Sub-games තියෙනවා නම් (ol.B 2ක් හෝ වැඩිය) — ඒවා draw.subGames එකේ තියාගන්නවා.
    // Backward-compat එකට letter/zodiac/numbers/superNumber — පළවෙනි group එකෙන්ම.
    const primary = nonEmptyGroups[0];
    const draw = {
      drawNo,
      date: normalizeDate(dateText),
      dateText,
      letter: primary.letters[0] || null,
      zodiac: primary.zodiac[0] || null,
      superNumber: primary.superNumber || null,
      numbers: primary.numbers,
    };
    if (nonEmptyGroups.length > 1) {
      draw.subGames = nonEmptyGroups.map(g => ({
        letter: g.letters[0] || null,
        zodiac: g.zodiac[0] || null,
        superNumber: g.superNumber || null,
        numbers: g.numbers,
      }));
    }
    draws.push(draw);
  });

  return draws;
}

// "Monday September 07, 2026" → "2026-09-07"
function normalizeDate(text) {
  const MONTHS = { january:1, february:2, march:3, april:4, may:5, june:6,
    july:7, august:8, september:9, october:10, november:11, december:12 };
  const m = text.match(/(\w+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[1].toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${String(mon).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
}

// ---------------------------------------------------------------
// DLB parser — හැම lottery එකම එකම page එකේ
// ---------------------------------------------------------------
/* ------------------------------------------------------------------
   📜 HISTORY — මාස 6ක් වගේ පරණ ප්‍රතිඵල
   ------------------------------------------------------------------
   NLB: results පිටුවේම දින 200කට වැඩි ගණනක් තියෙනවා (අපි කලින් 20ට
        limit කරලා තිබ්බා — දැන් 200ක් ගන්නවා).
   DLB: පිටුවේ පෙන්නන්නේ අලුත්ම draw එක විතරයි. ඒත් පරණ ඒවා ගන්න
        `POST /result/pagination_re` කියන endpoint එකක් තියෙනවා
        (pageId, resultID, lotteryID, lastsegment). එක පිටුවකට draw 10ක්
        වගේ එනවා → මාස 6ක් ගන්න පුළුවන්.
   ------------------------------------------------------------------ */
const HISTORY_MONTHS = Math.max(1, Number(process.env.SCRAPE_HISTORY_MONTHS || 6));
const NLB_MAX_DRAWS = Math.max(20, Number(process.env.SCRAPE_NLB_DRAWS || 200));
const DLB_MAX_PAGES = Math.max(1, Number(process.env.SCRAPE_DLB_MAX_PAGES || 90));
const DLB_MON3 = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
                   Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

/** දැන් ඉඳන් මාස Nකට කලින් දිනය (YYYY-MM-DD) */
function historyCutoff() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - HISTORY_MONTHS);
  return d.toISOString().slice(0, 10);
}

/** DLB pagination response එකේ rows → draw objects */
function parseDlbPageRows(html) {
  // ⚠️ මේ response එකේ එන්නේ හුදෙක් `<tr>` ටිකක් — `<table>` wrapper එකක් නෑ.
  // Browser/cheerio වගේ HTML parsers, table එකක් නැතුව තියෙන `<tr>` elements
  // **අයින් කරනවා** (HTML spec එකේ ඒ විදිහට තමයි). ඒ නිසා අපි අතින්
  // `<table>` එකක් ඇතුළට දාලා parse කරනවා — නැත්නම් rows 0ක් එනවා.
  const $ = cheerio.load('<table>' + String(html || '') + '</table>');
  const out = [];
  $('tr').each((_, tr) => {
    const $tr = $(tr);
    const first = $tr.find('td').first().text().replace(/\s+/g, ' ').trim();
    const m = first.match(/(\d+)\s*\|\s*(\d{4})-(\w{3})-(\d{2})/);
    if (!m) return;
    const mon = DLB_MON3[m[3]];
    if (!mon) return;
    const date = `${m[2]}-${String(mon).padStart(2, '0')}-${m[4]}`;

    const letter = $tr.find('li.res_eng_letter').first().text().trim() || null;
    const numbers = [];
    $tr.find('li.res_number').each((_i, li) => {
      const v = $(li).text().trim();
      if (/^\d{1,2}$/.test(v)) numbers.push(v);
    });
    const zodiac = [];
    $tr.find('img').each((_i, img) => {
      const mm = ($(img).attr('src') || '').match(/front_img\/\d*([a-zA-Z]+)\.(png|jpg)/);
      if (mm && DLB_ZODIAC_IMG_MAP[mm[1].toLowerCase()]) zodiac.push(DLB_ZODIAC_IMG_MAP[mm[1].toLowerCase()]);
    });
    if (!numbers.length && !letter && !zodiac.length) return;

    out.push({ drawNo: m[1], date, dateText: first, letter,
      zodiac: zodiac[0] || null, superNumber: null, numbers });
  });
  return out;
}

/** එක ලොතරැයියක පරණ draws (cutoff දක්වා) */
async function dlbHistory(lotteryID, resultID, cutoff) {
  const rows = [];
  for (let page = 1; page <= DLB_MAX_PAGES; page++) {
    let html;
    try {
      const res = await fetch('https://www.dlb.lk/result/pagination_re', {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.dlb.lk/result/en',
        },
        body: `pageId=${page}&resultID=${resultID}&lotteryID=${lotteryID}&lastsegment=en`,
      });
      html = await res.text();
    } catch (e) { break; }

    const pageRows = parseDlbPageRows(html);
    if (!pageRows.length) break;
    rows.push(...pageRows);

    const oldest = pageRows[pageRows.length - 1].date;
    if (oldest && cutoff && oldest < cutoff) break;
    await new Promise(r => setTimeout(r, 300));   // server එකට හිරිහැර නොකරන්න
  }
  return rows;
}

async function scrapeDLB() {
  const res = await fetch('https://www.dlb.lk/result/en', {
    headers: { 'User-Agent': UA }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];
  const cutoff = historyCutoff();
  const blocks = $('.lot_main_result').toArray();

  for (const block of blocks) {
    const $b = $(block);
    const name = $b.find('.lot_m_re_heading').first().text().trim();
    const dateLine = $b.find('.lot_m_re_date').first().text().trim();
    if (!name || !dateLine) continue;

    // "Draw Number - 3103  |  2026-Sep-07 Monday"
    const dm = dateLine.match(/Draw Number\s*-\s*(\d+)\s*\|\s*(\d{4})-(\w{3})-(\d{2})/);
    if (!dm) return;

    const MON3 = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,
                   Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
    const mon = MON3[dm[3]];
    const date = mon ? `${dm[2]}-${String(mon).padStart(2,'0')}-${dm[4]}` : null;

    const letters = [];
    const numbers = [];
    const zodiac = [];
    let superNumber = null;

    // Lagna Wasana වගේ ලොතරැයි වල රාශිය <img> icon එකක් විදිහට එනවා (text නෙවෙයි)
    $b.find('ul.result_detail_result img').each((_, img) => {
      const src = $(img).attr('src') || '';
      const m2 = src.match(/front_img\/\d*([a-zA-Z]+)\.(png|jpg)/);
      if (m2 && DLB_ZODIAC_IMG_MAP[m2[1].toLowerCase()]) {
        zodiac.push(DLB_ZODIAC_IMG_MAP[m2[1].toLowerCase()]);
      }
    });

    $b.find('ul.result_detail_result li h6').each((_, h6) => {
      const $h = $(h6);
      const val = $h.text().trim();
      if (!val) return;
      const cls = $h.attr('class') || '';
      const style = ($h.attr('style') || '').toLowerCase();
      if (/eng_letter/.test(cls)) letters.push(val);
      else if (/^\d{1,2}$/.test(val)) {
        // Kapruka එකේ අන්තිම number එක "Super Number" එකක් — background-color දාපු
        // circle එකකින් වෙන් කරලා තියෙනවා (border විතරක් නෙවෙයි, fill එකක් තියෙනවා)
        if (/background-color/.test(style) && superNumber === null) {
          superNumber = val;
        } else {
          numbers.push(val);
        }
      }
      else zodiac.push(val);
    });

    if (numbers.length === 0 && letters.length === 0) continue;

    const draws = [{
      drawNo: dm[1],
      date,
      dateText: dateLine,
      letter: letters[0] || null,
      zodiac: zodiac[0] || null,
      superNumber,
      numbers,
    }];

    // 📜 පරණ draws ටික (pagination endpoint එකෙන්) — මාස 6ක් දක්වා
    //
    // ⚠️ lotteryID + resultID ගන්නේ මේ block එක ඇතුළේම තියෙන දේවලින්:
    //    • `changePagination('1','1_no','11')` → lotteryID = 11
    //    • `<input id="resultID11" value="18689">` → resultID (අලුත්ම එකේ id)
    //      (මේක block එකට පිටින් ගත්තොත් ලොතරැයියක්වත් හරියට match වෙන්නේ නෑ)
    const blkHtml = $b.html() || '';
    const cp = blkHtml.match(/changePagination\(\s*'\d+'\s*,\s*'[^']*'\s*,\s*'(\d+)'/);
    const ridInput = $b.find('input[id^="resultID"]').first();
    const lotteryID = cp ? cp[1] : (ridInput.attr('id') || '').replace('resultID', '');
    const resultID = ridInput.attr('value') || null;

    if (lotteryID && resultID) {
      try {
        const hist = await dlbHistory(lotteryID, resultID, cutoff);
        draws.push(...hist);
        if (hist.length) console.log(`  📜 ${name}: පරණ draws ${hist.length}ක්`);
      } catch (e) {
        console.log(`  ⚠ ${name}: පරණ දත්ත ගන්න බැරි උනා (${e.message})`);
      }
    } else {
      console.log(`  ⚠ ${name}: lotteryID/resultID හම්බුනේ නෑ — පැරණි දත්ත skip`);
    }

    // draw අංකය අනුව duplicate අයින් කරලා, අලුත්ම එක උඩට
    const seen = new Set();
    const uniq = draws
      .filter(d => d.drawNo && !seen.has(String(d.drawNo)) && seen.add(String(d.drawNo)))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    results.push({
      provider: 'DLB',
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      draws: uniq,
    });
  }

  return results;
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
/**
 * දැනට තියෙන data.json එක කියවනවා (scrape එකක් fail උනොත් පරණ දත්ත
 * රැකගන්න මේක ඕන).
 */
function readExisting() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(parsed.lotteries) ? parsed : { lotteries: [] };
  } catch (e) {
    return { lotteries: [] };
  }
}

/**
 * main() — DLB + NLB ඔක්කොම scrape කරලා data.json එක update කරනවා.
 *
 * ⚠️ වැදගත්: පරණ version එකේ scrape එකක් fail උනොත් ඒ ලොතරැයියේ දත්ත
 * **නැති වුනා** (සම්පූර්ණ file එකම අලුතෙන් ලියන නිසා). දැන්:
 *   • scrape එකක් සාර්ථක උනොත් → අලුත් දත්ත
 *   • fail උනොත් → පරණ දත්ත ඒ විදිහටම තියාගන්නවා (stale කියලා සලකුණු කරලා)
 *   • සම්පූර්ණයෙන්ම fail උනොත් → file එකම ලියන්නේ නෑ (හොඳ දත්ත රැකෙනවා)
 *
 * returns { ok, scrapedAt, total, updated, keptStale, failed: [...] }
 */
async function main() {
  const existing = readExisting();
  const prevBySlug = new Map(existing.lotteries.map(l => [l.slug, l]));

  const out = { scrapedAt: new Date().toISOString(), lotteries: [] };
  const updated = [];
  const keptStale = [];
  const failed = [];

  console.log('DLB scrape කරනවා...');
  try {
    const dlb = await scrapeDLB();
    for (const l of dlb) {
      out.lotteries.push(l);
      updated.push(l.slug);
    }
    console.log(`  ✓ DLB: lottery ${dlb.length}ක්`);
  } catch (e) {
    console.log(`  ✗ DLB fail: ${e.message}`);
    failed.push('DLB: ' + e.message);
  }

  console.log('NLB scrape කරනවා...');
  for (const lot of NLB_LOTTERIES) {
    let done = false;
    try {
      const draws = await scrapeNLB(lot);
      if (draws.length) {
        out.lotteries.push({
          provider: 'NLB',
          slug: lot.slug,
          name: lot.name,
          nameSi: lot.nameSi,
          draws,
        });
        updated.push(lot.slug);
        done = true;
        console.log(`  ✓ ${lot.name}: draw ${draws.length}ක්`);
      } else {
        console.log(`  ⚠ ${lot.name}: draws හම්බුනේ නෑ — පරණ දත්ත තියාගන්නවා`);
      }
    } catch (e) {
      if (e.discontinued) {
        console.log(`  – ${lot.name}: නවත්තලා තියෙන එකක් (skip)`);
      } else {
        console.log(`  ✗ ${lot.name} fail: ${e.message}`);
        failed.push(lot.slug + ': ' + e.message);
      }
    }

    if (!done) {
      const prev = prevBySlug.get(lot.slug);
      if (prev) {
        out.lotteries.push(Object.assign({}, prev, { stale: true }));
        keptStale.push(lot.slug);
      }
    }

    await new Promise(r => setTimeout(r, 700)); // polite delay
  }

  // සම්පූර්ණයෙන්ම fail උනොත් හොඳ දත්ත විනාශ කරන්නේ නෑ
  if (out.lotteries.length < 8) {
    console.error(`✗ Scrape එකේ ප්‍රතිඵල අසම්පූර්ණයි (lottery ${out.lotteries.length}ක් විතරයි) — ` +
      'data.json එක update කළේ නෑ, කලින් තිබ්බ දත්ත ඒ විදිහටම තියෙනවා.');
    return { ok: false, error: 'scrape incomplete', total: out.lotteries.length, updated, keptStale, failed };
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(out, null, 2));
  console.log(`\nSaved → data.json (lottery ${out.lotteries.length}ක් · අලුත් ${updated.length}ක් · පරණ තියාගත්තා ${keptStale.length}ක්)`);

  return {
    ok: true, scrapedAt: out.scrapedAt, total: out.lotteries.length,
    updated, keptStale, failed,
  };
}

module.exports = { scrapeNLB, scrapeDLB, normalizeDate, NLB_LOTTERIES, main };

if (require.main === module) main();
