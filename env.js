/**
 * env.js — .env loader (zero dependency)
 *
 * ⚠️ මේ module එක **හැම වෙනත් module එකකට කලින්ම** require කරන්න ඕන.
 *
 * ඇයි: auth.js වගේ modules `process.env.JWT_SECRET` කියන එක
 * **require කරන මොහොතේම** කියවනවා. කලින් server.js එකේ loadEnvFile() එක
 * පලවෙනි require ටිකට පස්සේ run වුන නිසා .env එකේ තිබුණ JWT_SECRET එක
 * කවදාවත් apply වුනේ නෑ — හැම token එකක්ම hardcoded fallback secret එකෙන්
 * sign වුනා. දැන් මේකෙන් ඒක නිවැරදි කරනවා.
 *
 * Rules:
 *  - File එක නැත්නම් silently skip (crash වෙන්නේ නෑ).
 *  - process.env එකේ දැනටමත් තියෙන value එකක් **override කරන්නේ නෑ**
 *    (deployment එකේදී real environment variables ට priority).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '.env');

function stripQuotes(v) {
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return v.slice(1, -1);
    }
  }
  return v;
}

/**
 * Gemini API keys එකට වඩා තියෙන්න පුළුවන්. පිළිගන්නා ආකෘති:
 *
 *   GEMINI_API_KEY=key1          ← සාමාන්‍ය (තනි එකක්)
 *   GEMINI_API_KEY=key1          ← එකම නම දෙපාරක්/කීපවරක් (හැම එකක්ම ගන්නවා)
 *   GEMINI_API_KEY=key2
 *   GEMINI_API_KEY_1=key1        ← අංක දාලා
 *   GEMINI_API_KEY_2=key2
 *   GEMINI_API_KEYS=key1,key2    ← කොමා/හිස් ඉඩෙන් වෙන් කරලා
 *
 * හැම එකක්ම එකතු කරලා `process.env.GEMINI_API_KEYS` එකට දානවා
 * (dedupe කරලා, පිළිවෙළ රැකගෙන). gemini-keys.js එක ඒක කියවනවා.
 */
const GEMINI_KEY_VAR = /^GEMINI_API_KEYS?(_\d+)?$/;

function collectGeminiKeys(envPath = ENV_PATH) {
  const out = [];
  const add = (v) => {
    for (const part of String(v || '').split(/[,\s]+/)) {
      const k = part.trim();
      if (k && !out.includes(k)) out.push(k);
    }
  };

  // 1) real environment variables (deployment) → ඒවට මුල් තැන
  for (const [k, v] of Object.entries(process.env)) {
    if (GEMINI_KEY_VAR.test(k)) add(v);
  }

  // 2) .env file එකේ තියෙන ඒවා (දැනටමත් ලැබිච්ච ඒවා ආයෙ එකතු වෙන්නේ නෑ)
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const s = t.startsWith('export ') ? t.slice(7).trim() : t;
      const i = s.indexOf('=');
      if (i === -1) continue;
      const key = s.slice(0, i).trim();
      if (!GEMINI_KEY_VAR.test(key)) continue;
      add(stripQuotes(s.slice(i + 1).trim()));
    }
  } catch (e) { /* .env නෑ */ }

  if (out.length) process.env.GEMINI_API_KEYS = out.join(',');
  return out;
}

function loadEnvFile(envPath = ENV_PATH) {
  let raw;
  try {
    raw = fs.readFileSync(envPath, 'utf8');
  } catch (e) {
    // .env නෑ — environment variables විතරක් පාවිච්චි කරනවා
    collectGeminiKeys(envPath);
    return false;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const withoutPrefix = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const idx = withoutPrefix.indexOf('=');
    if (idx === -1) continue;

    const key = withoutPrefix.slice(0, idx).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    const val = stripQuotes(withoutPrefix.slice(idx + 1).trim());
    if (!(key in process.env)) process.env[key] = val;
  }

  // Gemini keys ටික එකතු කරන්නේ අන්තිමට — මොකද එකම නම දෙපාරක්
  // තිබ්බොත් උඩ ලූප් එකේදී පලවෙනි එක විතරයි process.env එකට වැටෙන්නේ.
  collectGeminiKeys(envPath);

  return true;
}

loadEnvFile();

module.exports = { loadEnvFile, collectGeminiKeys, ENV_PATH, stripQuotes };
