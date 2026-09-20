/**
 * scrape-runner.js — ලොතරැයි ප්‍රතිඵල **ස්වයංක්‍රීයව** ලබාගැනීම
 *
 * මේක කරන දේවල්:
 *   1. Cron එකක් හරහා දිනකට දෙපාරක් (default: උදේ 9:30 + රෑ 9:30, Asia/Colombo)
 *      scraper.js run කරනවා.
 *   2. Server එක start වෙද්දී data.json එක පරණ නම් (default: පැය 8කට වැඩි)
 *      background එකේ scrape එකක් අරඹනවා — ඒ නිසා අතින් මොකුත් කරන්න ඕන නෑ.
 *   3. එකවර scrape දෙකක් run නොවෙන්න lock එකක් තියෙනවා.
 *   4. හැම run එකකගේම ප්රතිඵලය DB එකේ `meta` table එකේ save කරනවා —
 *      ඒ නිසා admin panel එකේ "අවසන් උත්සාහය / සාර්ථක වුනාද" පෙන්නන්න පුළුවන්.
 *   5. node-cron නැති environment එකක වුනත් app එක වැඩ කරනවා —
 *      `npm run scrape` එකෙන් අතින් run කරන්න පුළුවන් බව කියනවා.
 */

'use strict';

require('./env');

const fs = require('fs');
const path = require('path');
const { prepare } = require('./db');
const drawsStore = require('./draws-store');

const DATA_FILE = path.join(__dirname, 'data.json');

const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Colombo';
/** දිනකට දෙපාරක් — උදේ 9:30 සහ රෑ 9:30 (NLB/DLB ප්රතිඵල නිකුත් වෙන වෙලාවලට) */
const SCRAPE_CRON = process.env.SCRAPE_CRON || '30 9,21 * * *';
const MAX_AGE_MS = Number(process.env.SCRAPE_MAX_AGE_HOURS || 8) * 3600 * 1000;

let running = false;
let cronTask = null;
let last = null;

// ---------------------------------------------------------------
// meta (DB) — restart උනත් status එක රැකෙන්න
// ---------------------------------------------------------------
function metaGet(key) {
  try {
    const r = prepare('SELECT value FROM meta WHERE key = ?').get(key);
    return r ? r.value : null;
  } catch (e) { return null; }
}

function metaSet(key, value) {
  try {
    prepare(`
      INSERT INTO meta (key, value, updatedAt) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')
    `).run(key, String(value));
  } catch (e) { /* status save කරන්න බැරි උනත් app එක වැඩ කරන්න ඕන */ }
}

function loadLast() {
  if (last) return last;
  const raw = metaGet('last_scrape');
  if (raw) { try { last = JSON.parse(raw); } catch (e) { last = null; } }
  return last;
}

// ---------------------------------------------------------------
// data.json එකේ වයස
// ---------------------------------------------------------------
function dataUpdatedAt() {
  try { return fs.statSync(DATA_FILE).mtime.toISOString(); } catch (e) { return null; }
}

function dataAgeMs() {
  try { return Date.now() - fs.statSync(DATA_FILE).mtimeMs; } catch (e) { return Infinity; }
}

function isStale() {
  return dataAgeMs() > MAX_AGE_MS;
}

function status() {
  const l = loadLast();
  return {
    running,
    cron: cronTask ? SCRAPE_CRON : null,
    cronEnabled: !!cronTask,
    timezone: APP_TZ,
    maxAgeHours: Math.round(MAX_AGE_MS / 3600000),
    dataUpdatedAt: dataUpdatedAt(),
    stale: isStale(),
    lastRun: l,
  };
}

// ---------------------------------------------------------------
// Scrape එක run කිරීම
// ---------------------------------------------------------------
async function runScrape({ reason = 'manual' } = {}) {
  if (running) {
    return Object.assign({ ok: false, error: 'scrape එකක් දැනටමත් run වෙනවා — ටිකකින් බලන්න.' }, status());
  }
  running = true;
  const t0 = Date.now();
  try {
    // require කරන්නේ run වෙන මොහොතේ — server start එක බලාපොරොත්තු නොවී වේගවත් වෙන්න
    const { main } = require('./scraper');
    const r = await main();

    // ✅ scrape එක සාර්ථක නම් — හැම draw එකම SQLite `draws` table එකටත්
    // sync කරනවා (දිනය අනුව ඉක්මන් lookup + statistics වලට ඕන).
    if (r && r.ok) {
      try {
        const sync = drawsStore.syncDraws();
        console.log('  → draws table sync:', JSON.stringify(sync));
        r.drawsSynced = sync;
      } catch (e) {
        console.log('  ⚠ draws sync fail:', e.message);
      }
    }
    last = {
      at: new Date().toISOString(),
      reason,
      ok: !!r.ok,
      durationMs: Date.now() - t0,
      total: r.total || 0,
      updated: (r.updated || []).length,
      keptStale: (r.keptStale || []).length,
      failed: r.failed || [],
      error: r.ok ? null : (r.error || 'අසම්පූර්ණ ප්රතිඵල'),
    };
    return Object.assign({ ok: !!r.ok, result: r }, status());
  } catch (e) {
    last = {
      at: new Date().toISOString(), reason, ok: false,
      durationMs: Date.now() - t0, error: e.message,
    };
    return Object.assign({ ok: false, error: e.message }, status());
  } finally {
    running = false;
    metaSet('last_scrape', JSON.stringify(last));
    console.log(`[scrape] ${last.ok ? '✓ සාර්ථක' : '✗ අසාර්ථක'} (${reason}) — ${last.durationMs}ms` +
      (last.error ? ' · ' + last.error : ` · lottery ${last.total}ක්`));
  }
}

// ---------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------
function startScheduler() {
  try {
    const cron = require('node-cron');
    cronTask = cron.schedule(SCRAPE_CRON, () => {
      console.log(`⏰ [cron] ස්වයංක්‍රීය scrape එක ආරම්භ කරමින් (${SCRAPE_CRON}, ${APP_TZ})...`);
      runScrape({ reason: 'cron' }).catch(e => console.error('✗ [cron]', e.message));
    }, { timezone: APP_TZ });
    console.log(`✓ Auto-scrape cron: "${SCRAPE_CRON}" (${APP_TZ}) — දිනකට දෙපාරක්.`);
  } catch (e) {
    cronTask = null;
    console.warn('⚠️ node-cron load කරන්න බැරි උනා — ස්වයංක්‍රීය scrape නෑ. ' +
      '`npm run scrape` එකෙන් අතින් update කරන්න පුළුවන්.', e.message);
  }

  // Start වෙද්දී දත්ත පරණ නම් එක පාරක් background එකේ අලුත් කරගන්නවා
  if (isStale()) {
    const ageH = Math.round(dataAgeMs() / 3600000);
    console.log(`⏳ ප්රතිඵල දත්ත පරණයි (පැය ${ageH}ක්) — background එකේ අලුතෙන් scrape කරනවා...`);
    setImmediate(() => {
      runScrape({ reason: 'startup-stale' }).catch(e => console.error('✗ [startup]', e.message));
    });
  } else {
    console.log(`✓ ප්රතිඵල දත්ත අලුත් (${dataUpdatedAt()}).`);
  }

  return cronTask;
}

function stopScheduler() {
  if (cronTask && typeof cronTask.stop === 'function') cronTask.stop();
  cronTask = null;
}

module.exports = {
  runScrape, startScheduler, stopScheduler,
  status, isStale, dataUpdatedAt, dataAgeMs,
  SCRAPE_CRON, APP_TZ, MAX_AGE_MS,
};
