/**
 * draws-store.js — data.json → SQLite `draws` table
 *
 * ඇයි දෙකක් තියෙන්නේ?
 *   • `data.json`  → scrape කරන ලද ප්‍රතිඵලයේ "සත්‍ය මූලාශ්‍රය" (server එක
 *                    ඉක්මනට කියවනවා, git එකට යන්නත් පුළුවන්)
 *   • `draws` table → **දිනයක් අනුව / පරාසයක් අනුව** ඉක්මනින් query
 *                    කරන්න (index තියෙනවා), සංඛ්‍යාලේඛන හදන්න,
 *                    සහ කාලයත් එක්ක දත්ත වැඩි වුනත් වේගවත්ව තියාගන්න
 *
 * හැම scrape එකකට පස්සේ `syncDraws()` කැඳවනවා → අලුත් draws ටික
 * `INSERT ... ON CONFLICT` එකෙන් update වෙනවා (duplicate වෙන්නේ නෑ).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { prepare, db } = require('./db');

const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
  try {
    const p = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(p.lotteries) ? p : { lotteries: [] };
  } catch (e) {
    return { lotteries: [] };
  }
}

/**
 * data.json එකේ ඔක්කොම draws ටික database එකට sync කරනවා.
 * returns { lotteries, printed, inserted, updated }
 */
function syncDraws() {
  const data = readData();
  const stmt = prepare(`
    INSERT INTO draws (slug, provider, lotteryName, drawNo, date, letter, zodiac, superNumber, numbers, updatedAt)
    VALUES (@slug, @provider, @lotteryName, @drawNo, @date, @letter, @zodiac, @superNumber, @numbers, datetime('now'))
    ON CONFLICT(slug, drawNo) DO UPDATE SET
      date = excluded.date,
      letter = excluded.letter,
      zodiac = excluded.zodiac,
      superNumber = excluded.superNumber,
      numbers = excluded.numbers,
      provider = excluded.provider,
      lotteryName = excluded.lotteryName,
      updatedAt = datetime('now')
  `);

  let printed = 0;
  const before = Number((prepare('SELECT COUNT(*) AS n FROM draws').get() || {}).n || 0);

  // transaction එකක් ඇතුළේ — ප්‍රතිඵලයක් ලක්ෂ ගණනක් වුනත් වේගවත්
  const runAll = db.transaction((rows) => {
    for (const r of rows) stmt.run(r);
  });

  const all = [];
  for (const l of data.lotteries) {
    for (const d of (l.draws || [])) {
      if (!d || !d.drawNo) continue;
      printed++;
      all.push({
        slug: l.slug,
        provider: l.provider || null,
        lotteryName: l.nameSi || l.name || null,
        drawNo: String(d.drawNo),
        date: d.date || null,
        letter: d.letter || null,
        zodiac: d.zodiac || null,
        superNumber: d.superNumber || null,
        numbers: JSON.stringify(d.numbers || []),
      });
    }
  }
  runAll(all);

  const after = Number((prepare('SELECT COUNT(*) AS n FROM draws').get() || {}).n || 0);
  return {
    lotteries: data.lotteries.length,
    printed,
    inserted: after - before,
    total: after,
  };
}

/** දත්තවල තියෙන කාල පරාසය (ලොතරැයියකට හෝ ඔක්කොටම) */
function drawsRange(slug) {
  const row = slug
    ? prepare('SELECT COUNT(*) AS n, MIN(date) AS fromDate, MAX(date) AS toDate FROM draws WHERE slug = ?').get(slug)
    : prepare('SELECT COUNT(*) AS n, MIN(date) AS fromDate, MAX(date) AS toDate FROM draws').get();
  return row || { n: 0, fromDate: null, toDate: null };
}

/** දිනයක් අනුව draw එකක් (server එකට වේගවත් lookup) */
function drawByDate(slug, date) {
  return prepare('SELECT * FROM draws WHERE slug = ? AND date = ? LIMIT 1').get(slug, date) || null;
}

/** කාල පරාසයක draws (පැරණි → අලුත් පිළිවෙළට) */
function drawsBetween(slug, from, to, limit = 500) {
  return prepare(`
    SELECT * FROM draws
    WHERE slug = ? AND date >= ? AND date <= ?
    ORDER BY date ASC LIMIT ?
  `).all(slug, from, to, limit);
}

module.exports = { syncDraws, drawsRange, drawByDate, drawsBetween, DATA_FILE };
