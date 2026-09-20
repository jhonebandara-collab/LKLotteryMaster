/**
 * billing.js — Subscription plans + PayHere payment integration + scan quota
 *
 * SETUP (real payments ලබාගන්න):
 *   1. https://www.payhere.lk එකේ merchant account එකක් හදාගන්න.
 *   2. Merchant Portal → Integrations → Add Domain/App → Merchant ID + Merchant Secret ගන්න.
 *   3. .env file එකට දාන්න:
 *        PAYHERE_MERCHANT_ID=xxxxxx
 *        PAYHERE_MERCHANT_SECRET=xxxxxxxxxxxx
 *        PAYHERE_MODE=sandbox        (production වෙනකොට "live" කරන්න)
 *        APP_BASE_URL=https://yourdomain.com
 *   Credentials නැති කාලෙදී checkout endpoint එක "Setup ඕන" error එකක් දෙනවා
 *   විතරයි — app එක crash වෙන්නේ නෑ.
 */

'use strict';

require('./env');

const crypto = require('crypto');
const { db } = require('./db');

// ---------------------------------------------------------------
// Plan definitions (Rs./month)
// ---------------------------------------------------------------
const PLANS = {
  free:  { label: 'Free',        priceRs: 0,    scansPerDay: 3,   scansPerMonth: null, adFree: false },
  rs100: { label: 'Rs. 100/mo',  priceRs: 100,  scansPerDay: null, scansPerMonth: 100,  adFree: true  },
  rs500: { label: 'Rs. 500/mo',  priceRs: 500,  scansPerDay: null, scansPerMonth: 800,  adFree: true  },
  rs1000:{ label: 'Rs. 1000/mo', priceRs: 1000, scansPerDay: null, scansPerMonth: null, adFree: true  }, // unlimited
};

/**
 * ⚠️ කලින් `new Date().toISOString()` පාවිච්චි කළා — ඒක **UTC**.
 * ශ්‍රී ලංකාව UTC+5:30 නිසා "අද" කියන එක ලංකාවේ උදේ 5.30ට විතරයි reset වුනේ.
 * ඒ කියන්නේ රෑ 12ට අලුත් දවසක් පටන් ගත්තත් user ට තව 5.30 පැයක්
 * පරණ දවසේ quota එකම පාවිච්චි කරන්න වුනා. දැන් ලංකා වෙලාවෙන් ගණනය කරනවා.
 */
const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Colombo';

function localDateStr(date = new Date()) {
  // en-CA → YYYY-MM-DD format එකේම එනවා
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function todayStr() { return localDateStr(); }        // YYYY-MM-DD
function monthStr() { return localDateStr().slice(0, 7); } // YYYY-MM

// plan expire වුනා නම් 'free' එකට fallback කරනවා
function effectivePlan(user) {
  if (!user) return 'free';
  if (user.plan === 'free') return 'free';
  if (!PLANS[user.plan]) return 'free';
  if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) return 'free';
  return user.plan;
}

// ---------------------------------------------------------------
// Scan quota check — /api/scan call කරන්න කලින් මේක check කරනවා.
// req.user තියෙනවා නම් DB-backed quota, නැත්තම් guest ලෙස IP-based
// සරල daily cap එකක් (memory එකේ විතරයි, restart එකකින් reset වෙනවා).
// ---------------------------------------------------------------
const guestScanCounts = new Map(); // ip -> { date, count }
const GUEST_DAILY_LIMIT = 2;   // (UNLIMITED_SCAN=true නම් මේක භාවිතා වෙන්නේ නෑ)
const GUEST_MAP_MAX = 10000; // memory leak එකක් නොවෙන්න

/**
 * ⚠️ තාවකාලික test mode — `.env` එකේ `UNLIMITED_SCAN=true` දැම්මම
 * scan limit එක **කිසිවකට block කරන්නේ නෑ** (guest හෝ free plan ද නොබලා).
 *
 * ඒත් usage count එක දිගටම ගණන් කරනවා — ඒ නිසා test කරලා ඉවර වුනාම
 * `.env` එකේ එක `false` කරන්න විතරයි ඕන, කලින් වගේම limits වැඩ කරනවා.
 * (Counters නිසා ඔයාට "කීයක් scan කළාද" කියලා data එකත් තියෙනවා.)
 */
// ⚠️ User ඉල්ලීම: "user කෙනෙකුට දවසට දෙන scan ප්‍රමාණය අයින් කරන්න".
// ඒ නිසා **default එකම unlimited** — scan limit කිසිවක් නෑ.
// පස්සේ දවසක limit දාන්න ඕන නම් `.env` එකේ UNLIMITED_SCAN=false දාන්න
// විතරයි (එතකොට පහළ PLANS වල අගයන් වැඩ කරනවා).
const UNLIMITED_SCAN =
  String(process.env.UNLIMITED_SCAN || 'true').trim().toLowerCase() !== 'false';

function pruneGuestMap(today) {
  if (guestScanCounts.size <= GUEST_MAP_MAX) return;
  for (const [ip, rec] of guestScanCounts) {
    if (rec.date !== today) guestScanCounts.delete(ip);
  }
  // තවම ලොකු නම් මුලින්ම දාපු entries ටික අයින් කරනවා (Map order = insert order)
  if (guestScanCounts.size > GUEST_MAP_MAX) {
    const excess = guestScanCounts.size - GUEST_MAP_MAX;
    let i = 0;
    for (const ip of guestScanCounts.keys()) {
      if (i++ >= excess) break;
      guestScanCounts.delete(ip);
    }
  }
}

function checkScanQuota(req) {
  if (!req.user) {
    const ip = req.ip || 'unknown';
    const today = todayStr();
    pruneGuestMap(today);
    let rec = guestScanCounts.get(ip);
    if (!rec || rec.date !== today) {
      rec = { date: today, count: 0 };
      guestScanCounts.set(ip, rec);
    }
    if (!UNLIMITED_SCAN && rec.count >= GUEST_DAILY_LIMIT) {
      return { allowed: false, reason: `Guest ලෙස දිනකට scan ${GUEST_DAILY_LIMIT}ක් විතරයි. ගිණුමක් හදාගෙන upgrade කරන්න.` };
    }
    return {
      allowed: true,
      unlimited: UNLIMITED_SCAN,
      remaining: UNLIMITED_SCAN
        ? { today: null, month: null }
        : { today: Math.max(0, GUEST_DAILY_LIMIT - rec.count), month: null },
      bump: () => { rec.count++; },
    };
  }

  const plan = effectivePlan(req.user);
  const cfg = PLANS[plan] || PLANS.free;
  const today = todayStr();
  const month = monthStr();

  // day/month rollover — count reset කරනවා
  let { scansUsedToday, scansUsedThisMonth, lastScanDate, lastScanMonth } = req.user;
  if (lastScanDate !== today) scansUsedToday = 0;
  if (lastScanMonth !== month) scansUsedThisMonth = 0;

  if (!UNLIMITED_SCAN && cfg.scansPerDay != null && scansUsedToday >= cfg.scansPerDay) {
    return { allowed: false, reason: `අදට scan limit එක (${cfg.scansPerDay}) ඉවරයි. Subscription plan එකක් ගන්න.` };
  }
  if (!UNLIMITED_SCAN && cfg.scansPerMonth != null && scansUsedThisMonth >= cfg.scansPerMonth) {
    return { allowed: false, reason: `මේ මාසේ scan limit එක (${cfg.scansPerMonth}) ඉවරයි. ඉහළ plan එකකට upgrade කරන්න.` };
  }

  return {
    allowed: true,
    unlimited: UNLIMITED_SCAN,
    remaining: UNLIMITED_SCAN
      ? { today: null, month: null }
      : {
          today: cfg.scansPerDay != null ? Math.max(0, cfg.scansPerDay - scansUsedToday) : null,
          month: cfg.scansPerMonth != null ? Math.max(0, cfg.scansPerMonth - scansUsedThisMonth) : null,
        },
    bump: () => {
      db.prepare(`UPDATE users SET
          scansUsedToday = ?, scansUsedThisMonth = ?, lastScanDate = ?, lastScanMonth = ?
        WHERE id = ?`).run(scansUsedToday + 1, scansUsedThisMonth + 1, today, month, req.user.id);
      // in-memory copy එකත් update කරනවා (එකම request එකේ දෙපාරක් check කළොත් නිවැරදි වෙන්න)
      req.user.scansUsedToday = scansUsedToday + 1;
      req.user.scansUsedThisMonth = scansUsedThisMonth + 1;
      req.user.lastScanDate = today;
      req.user.lastScanMonth = month;
    },
  };
}

// ---------------------------------------------------------------
// PayHere Checkout — hash generation
// hash = strtoupper(md5(merchant_id + order_id + amount + currency + strtoupper(md5(merchant_secret))))
// ---------------------------------------------------------------
function buildPayhereCheckout({ orderId, amountRs, itemName, user }) {
  const merchantId = process.env.PAYHERE_MERCHANT_ID;
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  if (!merchantId || !merchantSecret) {
    return {
      error: 'PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET set කරලා නෑ. ' +
             '.env file එකේ PayHere Setup කොටස බලන්න.',
      needsSetup: true,
    };
  }

  const amount = Number(amountRs).toFixed(2);
  const currency = 'LKR';
  const mode = process.env.PAYHERE_MODE === 'live' ? 'live' : 'sandbox';
  const actionUrl = mode === 'live'
    ? 'https://www.payhere.lk/pay/checkout'
    : 'https://sandbox.payhere.lk/pay/checkout';

  const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
  const hash = crypto.createHash('md5')
    .update(merchantId + orderId + amount + currency + secretHash)
    .digest('hex').toUpperCase();

  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

  return {
    actionUrl,
    fields: {
      merchant_id: merchantId,
      return_url: `${baseUrl}/?payment=success`,
      cancel_url: `${baseUrl}/?payment=cancelled`,
      notify_url: `${baseUrl}/api/billing/notify`,
      order_id: orderId,
      items: itemName,
      currency,
      amount,
      first_name: (user && user.name) || 'Customer',
      last_name: '',
      email: (user && user.email) || 'guest@example.com',
      phone: '0000000000',
      address: 'N/A',
      city: 'Colombo',
      country: 'Sri Lanka',
      hash,
    },
  };
}

// ---------------------------------------------------------------
// PayHere Notify — md5sig verify කරලා plan එක activate කරනවා
// md5sig = strtoupper(md5(merchant_id + order_id + amount + currency + status_code + strtoupper(md5(merchant_secret))))
// ---------------------------------------------------------------
function verifyPayhereNotify(body) {
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  if (!merchantSecret) return false;
  const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = body;
  if (!merchant_id || !order_id || !md5sig) return false;

  const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
  const localSig = crypto.createHash('md5')
    .update(String(merchant_id) + order_id + payhere_amount + payhere_currency + status_code + secretHash)
    .digest('hex').toUpperCase();

  // timing-safe compare (md5sig user-controlled string එකක් නිසා)
  const a = Buffer.from(localSig, 'utf8');
  const b = Buffer.from(String(md5sig), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * PayHere notify එකක් ~30 විනාඩියක් ඇතුළත කිහිප වතාවක් එන්න පුළුවන්.
 * Plan එක දිගටම extend වීම වළක්වන්න order එක දැනටමත් success නම්
 * ආපහු activate කරන්නේ නෑ.
 */
function applyPaymentResult({ orderId, statusCode, rawBody }) {
  const payment = db.prepare('SELECT * FROM payments WHERE orderId = ?').get(orderId);
  if (!payment) return { ok: false, code: 404, message: 'order not found' };

  // status_code: 2=success, 0=pending, -1=cancelled, -2=failed, -3=chargedback
  const status = statusCode === '2' ? 'success'
    : statusCode === '0' ? 'pending'
    : statusCode === '-1' ? 'cancelled' : 'failed';

  const alreadySuccess = payment.status === 'success';

  db.prepare("UPDATE payments SET status = ?, payhereRaw = ?, completedAt = datetime('now') WHERE orderId = ?")
    .run(status, JSON.stringify(rawBody), orderId);

  if (status === 'success' && !alreadySuccess) {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    db.prepare('UPDATE users SET plan = ?, planExpiresAt = ? WHERE id = ?')
      .run(payment.plan, expiresAt.toISOString(), payment.userId);
    return { ok: true, activated: true, plan: payment.plan };
  }

  return { ok: true, activated: false, status };
}

module.exports = {
  PLANS, effectivePlan, checkScanQuota,
  buildPayhereCheckout, verifyPayhereNotify, applyPaymentResult,
  todayStr, monthStr, localDateStr, APP_TZ,
  UNLIMITED_SCAN,
};
