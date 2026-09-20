/**
 * gemini-keys.js — Gemini API key pool (rotation + failover)
 *
 * ═══════════════════════════════════════════════════════════════════
 * ⚠️ මේ module එක දෙන ප්‍රධාන ප්‍රයෝජනය: **FAILOVER**
 *    එක key එකක් quota/limit එකට වැටුනාම, ඊළඟ scan එක තව key එකකින්
 *    ස්වයංක්‍රීයව වැඩ කරන්න දෙන එක. ඒ නිසා එක key එකක් ඉවර උනාම
 *    user ට "429 — quota ඉවරයි" කියලා error එකක් එන්නේ නෑ.
 *
 * 🚫 නොකරන්න ඕන දේ:
 *    එකම මනුස්සයෙක්/සමාගමක් එක Google project එකක් වෙනුවට **වෙන වෙන
 *    Google account කිහිපයක් හදලා** free quota එක ගුණ කරගන්න එක
 *    Google Gemini API Terms of Service කඩ කිරීමක්. Google ඒක
 *    detect කරලා keys සහ accounts suspend කරන්න පුළුවන් — එතකොට
 *    ඔබේ app එක සම්පූර්ණයෙන්ම නවතිනවා.
 *
 * ✅ නිවැරදි භාවිතයන්:
 *    • Paid (billing enabled) keys — plan එකක එකම project එකෙන් keys කිහිපයක්
 *    • වෙනස් නිත්‍යානුකූල projects/teams (ඔබේම organization එකක)
 *    • Failover — එකක් 429 උනාම අනිත් එකට මාරු වීම
 *    • Free tier එකේ ඉන්නකොට scan ගණන අඩු කරලා, අවශ්‍ය තැනට විතරක්
 *      AI එක පාවිච්චි කිරීම (අපි කරන්නේ ඒකයි — crop කරපු පොඩි photo,
 *      thinking=minimal, cache කරපු model list)
 *
 * ⚠️ "Free key 4ක් දාලා විනාඩියකට scan 60ක්" කියන එක ඇත්තටම වැඩ කරන්නේ නෑ:
 *    free tier limit වලින් **දවසේ limit එක** තමයි app එකකට බාධාව.
 *    Key 4කින් ලැබෙන්නේ ඒ දවසේ limit එක 4 ගුණයක් — විනාඩියට 60ක්
 *    දිගටම නොවේ. (Key එකකට per-minute limit එක තියෙන නිසා, keys කීපයක්
 *    මාරු කරලා ලබාගන්න පුළුවන් උපරිමය = keys ගණන × per-minute limit.)
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

require('./env');

const PER_MINUTE_COOLDOWN_MS = Number(process.env.GEMINI_KEY_COOLDOWN_MS || 60 * 1000);
const PER_DAY_COOLDOWN_MS = Number(process.env.GEMINI_KEY_DAILY_COOLDOWN_MS || 30 * 60 * 1000);
const MAX_ATTEMPTS = Math.max(1, Number(process.env.GEMINI_MAX_KEY_ATTEMPTS || 3));

/** keys එකතු කරන්න — .env එකෙන් (env.js) හෝ environment variables වලින් */
function loadKeys() {
  const raw = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(/[,\s]+/);
  const out = [];
  for (const k of raw) {
    const v = String(k || '').trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

const keys = loadKeys();
const state = keys.map(() => ({
  uses: 0,
  ok: 0,
  limited: 0,
  failures: 0,
  cooldownUntil: 0,
  disabled: false,
  lastError: null,
  lastErrorAt: null,
  lastUsedAt: 0,
}));

function size() { return keys.length; }
function maxAttempts() { return MAX_ATTEMPTS; }

/** යතුර කවදාවත් log/API response එකකට පූර්ණ ලෙස නොයවන්න — masked */
function maskKey(k) {
  const s = String(k);
  if (s.length <= 12) return '****';
  return s.slice(0, 6) + '…' + s.slice(-4);
}

/** Retry-After header/body එකක් තිබ්බොත් ඒක ගන්නවා (ms) */
function parseRetryAfter(text) {
  const m = String(text || '').match(/"retryDelay"\s*:\s*"?(\d+(?:\.\d+)?)s"?/i);
  if (m) return Math.min(Number(m[1]) * 1000, 10 * 60 * 1000);
  return null;
}

function readyCount() {
  const now = Date.now();
  return keys.reduce((n, _k, i) => n + (!state[i].disabled && state[i].cooldownUntil <= now ? 1 : 0), 0);
}

/**
 * ඊළඟ key එක තෝරනවා — "ready" ඒවායින් අන්තිමටම පාවිච්චි කරපු එක
 * (least-recently-used) ගන්නවා. ඒකෙන් keys ටික සමානව බෙදිලා යනවා.
 */
function pick() {
  const now = Date.now();
  let best = -1;
  for (let i = 0; i < keys.length; i++) {
    const s = state[i];
    if (s.disabled || s.cooldownUntil > now) continue;
    if (best === -1 || s.lastUsedAt < state[best].lastUsedAt) best = i;
  }
  if (best === -1) return null;
  state[best].lastUsedAt = now;
  state[best].uses++;
  return { index: best, key: keys[best], label: 'key #' + (best + 1) };
}

function noteSuccess(i) {
  const s = state[i];
  if (!s) return;
  s.ok++;
  s.cooldownUntil = 0;
  s.lastError = null;
}

/** 429 — per-minute නම් කෙටි cooldown, per-day නම් දිග cooldown */
function noteRateLimit(i, text) {
  const s = state[i];
  if (!s) return;
  s.limited++;
  const isDaily = /per day|daily|requests per day|PER_DAY/i.test(String(text || ''));
  const wait = parseRetryAfter(text) || (isDaily ? PER_DAY_COOLDOWN_MS : PER_MINUTE_COOLDOWN_MS);
  s.cooldownUntil = Date.now() + wait;
  s.lastError = (isDaily ? 'දවසේ limit ඉවරයි' : 'per-minute limit') +
    ' · තත්පර ' + Math.round(wait / 1000) + 'ක් නවත්තලා';
  s.lastErrorAt = new Date().toISOString();
}

/** Key එකම වැරදි/අවසර නැති නම් — මේ process එකේ තියෙන තාක් ආයෙ පාවිච්චි කරන්නේ නෑ */
function noteInvalid(i, text) {
  const s = state[i];
  if (!s) return;
  s.disabled = true;
  s.lastError = String(text || 'key වැරදියි').slice(0, 120);
  s.lastErrorAt = new Date().toISOString();
}

function noteFailure(i, text) {
  const s = state[i];
  if (!s) return;
  s.failures++;
  s.lastError = String(text || 'error').slice(0, 120);
  s.lastErrorAt = new Date().toISOString();
}

function allBusy() {
  return keys.length > 0 && readyCount() === 0;
}

/** Keys ඔක්කොම limit වෙලා නම් — user ට තේරෙන විදිහට කියන්න */
function busyMessage() {
  const now = Date.now();
  const waits = keys
    .map((_k, i) => state[i])
    .filter(s => !s.disabled && s.cooldownUntil > now)
    .map(s => Math.ceil((s.cooldownUntil - now) / 1000));
  if (!waits.length) return 'දැනට AI එකට යන්න පුළුවන් key එකක් නෑ. ටිකකින් ආයෙ try කරන්න.';
  return 'දැනට හැම AI key එකක්ම limit එකට වැටිලා — තව තත්පර ' +
    Math.min(...waits) + 'කින් ආයෙ try කරන්න (හෝ plan එකක් ගන්න).';
}

/** Admin panel එකට — keys ටික පෙන්නන්නේ masked විදිහට විතරයි */
function status() {
  const now = Date.now();
  return {
    total: keys.length,
    ready: readyCount(),
    maxAttempts: MAX_ATTEMPTS,
    perMinuteCooldownSec: Math.round(PER_MINUTE_COOLDOWN_MS / 1000),
    perDayCooldownSec: Math.round(PER_DAY_COOLDOWN_MS / 1000),
    keys: keys.map((k, i) => {
      const s = state[i];
      return {
        label: 'key #' + (i + 1),
        masked: maskKey(k),
        state: s.disabled ? 'disabled' : (s.cooldownUntil > now ? 'cooldown' : 'ready'),
        cooldownSec: s.cooldownUntil > now ? Math.ceil((s.cooldownUntil - now) / 1000) : 0,
        uses: s.uses,
        ok: s.ok,
        limited: s.limited,
        failures: s.failures,
        lastError: s.lastError,
        lastErrorAt: s.lastErrorAt,
      };
    }),
  };
}

/** Public-safe summary (keys ගැන කිසිම විස්තරයක් නෑ) */
function summary() {
  return { keys: keys.length, ready: readyCount() };
}

module.exports = {
  size, maxAttempts, pick, noteSuccess, noteRateLimit, noteInvalid, noteFailure,
  status, summary, allBusy, busyMessage, maskKey, loadKeys,
};
