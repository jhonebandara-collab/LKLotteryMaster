/**
 * vision.js — Gemini integration
 *
 * මේ file එකේ දෙකක් තියෙනවා:
 *   1. `callGemini()`      — Gemini එකට request එකක් යවලා JSON එකක් ගන්න
 *                            පොදු function එකක් (retry + error handling ඔක්කොම මෙතන).
 *                            scanTicketImage සහ lucky.js දෙකම මේක පාවිච්චි කරනවා.
 *   2. `scanTicketImage()` — ලොතරැයි පත්‍රිකාවක photo එකකින් නම/draw/ඉලක්කම්/
 *                            අකුර/රාශිය structured JSON එකක් විදිහට ගන්නවා.
 */

'use strict';

require('./env');
const keyPool = require('./gemini-keys');

/**
 * Model එක .env එකෙන් වෙනස් කරන්න පුළුවන් (GEMINI_MODEL).
 *
 * ⚠️ පරණ code එකේ `gemini-1.5-flash` තිබුනා — ඒක Google විසින්ම
 * shutdown කරලා දැන් 404 දෙනවා. පහත default එක current stable
 * Flash model එකක් (multimodal + structured JSON output support).
 */
const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
const GEMINI_API_VERSION = (process.env.GEMINI_API_VERSION || 'v1beta').trim();
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45000);

/**
 * Thinking level — `gemini-3.6-flash` වගේ models default එකෙන්ම "medium"
 * thinking කරනවා. OCR/format වැඩවලට `minimal` දාන එකෙන් **පැහැදිලිවම
 * වේගවත්** + කිසි වෙනසක් නෑ. (Probe එකකින් මනින ලද්දේ: thinking tokens 0, ~1.5s.)
 *
 * `.env` එකේ GEMINI_THINKING=off දැම්මම මේක යවන්නේම නෑ.
 */
const GEMINI_THINKING = String(process.env.GEMINI_THINKING || 'minimal').trim().toLowerCase();

// scrape කරපු data.json එකෙන් ම lottery නම් ලැයිස්තුව හදාගන්නවා
function buildLotteryList(lotteries) {
  return (lotteries || []).map(l => `- "${l.slug}": ${l.name} (${l.provider})`).join('\n');
}

// ---------------------------------------------------------------
// පොදු Gemini caller
// ---------------------------------------------------------------

/** Gemini එකට POST එකක් යවලා text එකත් එක්ක return කරනවා */
async function postGemini(apiKey, body) {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let text = '';
  try { text = await res.text(); } catch (e) { text = ''; }
  return { res, text };
}

/** Gemini එකෙන් එන text එකෙන් JSON එක ගන්නවා (fence එකක් තිබ්බත්) */
function extractJson(text) {
  const trimmed = String(text).trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch (e) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw e;
  }
}

/** මිනිත්තු 3කට cache කරනවා — quota ඉතිරි කරන්න */
let modelInfoCache = { at: 0, value: null };

async function listAvailableModels(apiKey) {
  if (Date.now() - modelInfoCache.at < 180000 && modelInfoCache.value) return modelInfoCache.value;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models?key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const json = await res.json();
    const names = (json.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name).replace(/^models\//, ''));
    modelInfoCache = { at: Date.now(), value: names };
    return names;
  } catch (e) {
    return null;
  }
}

/**
 * callGemini({ parts, schema, temperature })
 *
 *   parts  — Gemini `contents[0].parts` array එක (text + inlineData)
 *   schema — responseSchema (optional)
 *
 * returns { ok: true, text, model, elapsedMs, thinking } |
 *         { ok: false, error, needsSetup?, quotaExceeded?, httpStatus? }
 */
/**
 * එක **key එකක්** එක්ක විතරක් වැඩ කරන පහළම මට්ටමේ function එක.
 * Key pool එක, 429 failover එක සහ user-friendly error messages ඔක්කොම
 * ඊට උඩින් තියෙන `callGemini()` එකේ.
 */
async function callGeminiWithKey(apiKey, { parts, schema, temperature = 0 }) {
  if (!Array.isArray(parts) || !parts.length) {
    return { ok: false, error: 'යවන්න දත්ත නෑ.' };
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
      // ⚠️ maxOutputTokens පොඩ්ඩක් දාන්නේ නෑ — thinking tokens ඒකට
      // ඇතුළත් නිසා පොඩි limit එකක් දැම්මොත් උත්තරේ කැපිලා යනවා.
    },
  };
  if (schema) body.generationConfig.responseSchema = schema;
  if (GEMINI_THINKING && GEMINI_THINKING !== 'off' && GEMINI_THINKING !== 'none') {
    body.generationConfig.thinkingConfig = { thinkingLevel: GEMINI_THINKING };
  }

  const startedAt = Date.now();

  /**
   * Generation config එකේ optional කොටස් (thinkingConfig / responseSchema)
   * සමහර model හෝ API version වලට support නැති වෙන්න පුළුවන් — එතකොට
   * Gemini 400 එකක් දෙනවා. එතකොට ඒ කොටස අයින් කරලා ආයෙ try කරනවා.
   * උපරිම try 3ක්.
   */
  let res, bodyText;
  let attempts = 0;
  for (;;) {
    try {
      ({ res, text: bodyText } = await postGemini(apiKey, body));
    } catch (e) {
      // Network/timeout — වෙන key එකකින් try කරලා වැඩක් නෑ (එකම අවුල)
      const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      return {
        ok: false,
        connectError: true,
        error: timedOut
          ? 'Gemini එකට යවපු දත්ත වලට වෙලාව ඉක්මවා ගියා. නැවත try කරන්න.'
          : `Gemini API එකට connect වෙන්න බැරි උනා: ${e.message}`,
      };
    }

    attempts++;
    if (res.ok || res.status !== 400 || attempts >= 3) break;

    if (body.generationConfig.thinkingConfig && /thinking/i.test(bodyText)) {
      delete body.generationConfig.thinkingConfig;   // → ආයෙ try
    } else if (body.generationConfig.responseSchema &&
               /nullable|schema|response|invalid json payload/i.test(bodyText)) {
      delete body.generationConfig.responseSchema;   // → ආයෙ try
    } else {
      break;                                          // වෙන 400 එකක් — report කරනවා
    }
  }

  if (!res.ok) {
    let msg = `Gemini API error (HTTP ${res.status})`;

    if (res.status === 400 && /API_KEY_INVALID|API key not valid/i.test(bodyText)) {
      // මේ key එක වැරදියි → pool එක ඒක disable කරලා ඊළඟ එකට මාරු වෙනවා
      return {
        ok: false, tryAnotherKey: true, badKey: true, httpStatus: 400,
        error: 'Gemini key එකක් වැරදියි — ඊළඟ key එකට මාරු වුනා.',
        rawError: bodyText.slice(0, 200),
      };
    } else if (res.status === 403) {
      return {
        ok: false, tryAnotherKey: true, badKey: true, httpStatus: 403,
        error: 'Gemini key එකකට අවසර නෑ (403) — ඊළඟ key එකට මාරු වුනා.',
        rawError: bodyText.slice(0, 200),
      };
    } else if (res.status === 404) {
      const names = await listAvailableModels(apiKey);
      msg = `"${GEMINI_MODEL}" කියන Gemini model එක තව නෑ (404). ` +
        (names && names.length
          ? `.env එකේ GEMINI_MODEL එකට මේවායින් එකක් දාන්න: ${names.slice(0, 8).join(', ')}`
          : '.env එකේ GEMINI_MODEL එක update කරන්න.');
    } else if (res.status === 429) {
      // quota ඉවරයි → pool එක මේ key එක cooldown එකට දාලා ඊළඟ එකට මාරු වෙනවා
      const daily = /per day|daily|requests per day/i.test(bodyText);
      return {
        ok: false, tryAnotherKey: true, rateLimited: true, quotaExceeded: true, httpStatus: 429,
        error: daily
          ? 'මේ key එකේ දවසේ limit එක ඉවරයි.'
          : 'මේ key එකේ per-minute limit එකට වැඩියි.',
        rawError: bodyText.slice(0, 300),
      };
    } else if (res.status >= 500) {
      // ⚠️ මේක Gemini server side ප්‍රශ්නයක් (උදා: 503 = model overloaded).
      // Key මාරු කරන එකෙන් වැඩක් නෑ — හැම key එකකටම එකම ප්‍රතිඵලයයි.
      // ඒ නිසා අනිත් keys වලින් උත්සාහ කරන්නේ නෑ (එහෙම කළොත් user
      // තත්පර 40-50ක් නිකම් ඉන්නවා). කෙටියෙන් error එක දීලා ඉවර කරනවා.
      return {
        ok: false, tryAnotherKey: false, httpStatus: res.status,
        error: res.status === 503
          ? 'Gemini එක දැනට කාර්යබහුලයි (503). තත්පර 10-20කින් ආයෙ try කරන්න.'
          : 'Gemini server error (HTTP ' + res.status + '). ටිකකින් ආයෙ try කරන්න.',
        rawError: bodyText.slice(0, 200),
      };
    }
    return { ok: false, error: msg, httpStatus: res.status, rawError: bodyText.slice(0, 300) };
  }

  let json;
  try {
    json = JSON.parse(bodyText);
  } catch (e) {
    return { ok: false, error: 'Gemini response එක parse කරන්න බැරි උනා.' };
  }

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = json?.promptFeedback?.blockReason;
    const finishReason = json?.candidates?.[0]?.finishReason;
    return {
      ok: false,
      error: blockReason
        ? `Gemini මේ දත්ත block කළා (${blockReason}). වෙන එකක් try කරන්න.`
        : finishReason && finishReason !== 'STOP'
          ? `Gemini පිළිතුරක් දෙන්න බැරි උනා (${finishReason}). ආයෙ try කරන්න.`
          : 'Gemini එකෙන් හිස් පිළිතුරක් ආවා.',
    };
  }

  return {
    ok: true,
    text,
    model: GEMINI_MODEL,
    elapsedMs: Date.now() - startedAt,
    thinking: body.generationConfig.thinkingConfig ? GEMINI_THINKING : 'off',
  };
}

// ---------------------------------------------------------------
// Key pool wrapper — failover + rotation
// ---------------------------------------------------------------

/**
 * callGemini({ parts, schema, temperature })
 *
 * `.env` එකේ keys කිහිපයක් තිබ්බොත් (GEMINI_API_KEY එකට වඩා) එකක්
 * limit එකට වැටුනාම **ස්වයංක්‍රීයව ඊළඟ එකට මාරු වෙනවා**. ඒ නිසා:
 *   • එක key එකක් ඉවර උනාම user ට error එකක් එන්නේ නෑ
 *   • keys ටික සමානව බෙදිලා පාවිච්චි වෙනවා (least-recently-used)
 *   • key එකක් වැරදි/අවසර නැති නම් ඒක skip වෙනවා
 *
 * ඔක්කොම keys limit වෙලා නම් විතරයි error එකක් එන්නේ — එතකොට
 * කීයක් වෙලාවක් ඉන්න ඕන කියලා කියනවා.
 */
async function callGemini({ parts, schema, temperature = 0 }) {
  // input එක මුලින්ම validate කරනවා — key pool එක ගැන හිතන්න කලින්
  if (!Array.isArray(parts) || !parts.length) {
    return { ok: false, error: 'යවන්න දත්ත නෑ.' };
  }
  if (!keyPool.size()) {
    return {
      ok: false,
      error: 'GEMINI_API_KEY set කරලා නෑ. SETUP.md එකේ "AI Scan Setup" කොටස බලන්න.',
      needsSetup: true,
    };
  }

  const startedAt = Date.now();
  const softCap = Math.min(keyPool.size(), keyPool.maxAttempts());
  const hardCap = keyPool.size();
  const tried = [];
  let lastFail = null;
  let attempts = 0;
  // 429 (quota) වලට එවැනි විගණනයක් යන්නේ නෑ — ඒ නිසා ඒවා තව keys වලින්
  // try කරන එක ඉක්මන්. අනිත් ප්‍රශ්න (network, invalid, 5xx) වලට
  // softCap (3) එකෙන් ඉවර කරනවා — නැත්නම් user අනවශ්‍ය වෙලාවක් ඉන්නවා.
  let onlyRateLimits = true;

  while (attempts < hardCap) {
    if (attempts >= softCap && !onlyRateLimits) break;

    const picked = keyPool.pick();
    if (!picked) break;                       // ready key එකක් නෑ
    attempts++;

    tried.push(picked.label);
    const r = await callGeminiWithKey(picked.key, { parts, schema, temperature });

    if (r.ok) {
      keyPool.noteSuccess(picked.index);
      return Object.assign({}, r, { key: picked.label, keyIndex: picked.index });
    }

    // ---- මේ key එකේ තත්ත්වය pool එකේ ලියනවා ----
    if (r.rateLimited || r.quotaExceeded) keyPool.noteRateLimit(picked.index, r.rawError || r.error);
    else if (r.badKey) keyPool.noteInvalid(picked.index, r.error);
    else keyPool.noteFailure(picked.index, r.error);

    if (!r.rateLimited && !r.quotaExceeded) onlyRateLimits = false;

    lastFail = r;
    if (!r.tryAnotherKey) return Object.assign({}, r, { keysTried: tried });
  }

  // හැම key එකක්ම limit/cooldown එකේ → user ට තේරෙන විදිහට කියන්න
  if (keyPool.allBusy()) {
    return {
      ok: false,
      error: keyPool.busyMessage(),
      rateLimited: true,
      quotaExceeded: true,
      keysTried: tried,
      keyPool: keyPool.summary(),
    };
  }

  if (lastFail) return Object.assign({}, lastFail, { keysTried: tried });
  return { ok: false, error: 'Gemini එකට යන්න පුළුවන් key එකක් දැනට නෑ. ටිකකින් try කරන්න.', keysTried: tried };
}

// ---------------------------------------------------------------
// 1) ලොතරැයි පත්‍රිකාව scan කිරීම
// ---------------------------------------------------------------
const PROMPT_TEMPLATE = `ඔබ ශ්‍රී ලංකා ලොතරැයි පත්‍රිකා කියවන විශේෂඥයෙකි.
මේ photo එකේ තියෙන්නේ NLB හෝ DLB ලොතරැයි ප්‍රතිඵල පත්‍රිකාවක් (හෝ ලොතරැයි ටිකට් එකක්).

පහත ලොතරැයි ලැයිස්තුවෙන් **හරියටම එකක් තෝරන්න** (photo එකේ නම/logo බලලා):
{{LOTTERY_LIST}}

Photo එකේ පේන දේවල් හොඳින් බලලා මේ JSON format එකටම (වෙන කිසිම text එකක් නැතුව) පිළිතුරු දෙන්න:

{
  "lotterySlug": "<උඩ ලැයිස්තුවෙන් slug එක, නොහඳුනාගත්තොත් null>",
  "lotteryNameSeen": "<photo එකේ ඇත්තටම පේන lottery නම>",
  "drawNo": "<Draw අංකය, නොපෙනුනොත් null>",
  "date": "<දිනය පේනවා නම්, නොපෙනුනොත් null>",
  "letter": "<English letter එකක් තියෙනවා නම් (A-Z), නැත්නම් null>",
  "zodiac": "<රාශියක් තියෙනවා නම් (ARIES/TAURUS/GEMINI/CANCER/LEO/VIRGO/LIBRA/SCORPIO/SAGITTARIUS/CAPRICORN/AQUARIUS/PISCES), නැත්නම් null>",
  "superNumber": "<Super Number එකක් තියෙනවා නම්, නැත්නම් null>",
  "numbers": ["<පේන ඉලක්කම් ටික, පත්‍රිකාවේ පිළිවෙළටම, string ලෙස>"],
  "confidence": "<high|medium|low — ඔබගේ විශ්වාසය>",
  "notes": "<අපැහැදිලි දෙයක් තිබ්බොත් කෙටියෙන් සඳහන් කරන්න, නැත්නම් null>"
}

වැදගත්:
- **ඉලක්කම් වගේම නොවන** barcode/serial number/price වගේ දේවල් "numbers" එකට දාන්න එපා.
- Numbers ටික photo එකේ පේන පිළිවෙළටම දෙන්න (position වැදගත්, Mahajana Sampatha වගේ ලොතරැයි වලට).
- පැහැදිලිව නොපෙනෙන අගයක් **කවදාවත් guess කරන්න එපා** — null දාන්න.
- Response එක **JSON විතරයි**.`;

/**
 * 1b) QR කේතය කියවීම
 * ---------------------------------------------------------------
 * Frontend එකේ 1) BarcodeDetector සහ 2) jsQR දෙකම fail උනොත් විතරයි මේකට
 * එන්නේ (අන්තිම උපාය). Gemini විශේෂයෙන්ම QR කේත කියවන්න හදන ලද්දක් නොවුනත්,
 * පැහැදිලි QR එකක් බොහෝ විට කියවාගන්නවා.
 */
const QR_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'string', enum: ['yes', 'no'] },
    payload: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['readable', 'payload'],
};

async function decodeQrImage(base64Image, mimeType) {
  if (!base64Image) return { ok: false, error: 'ඡායාරූපයේ දත්ත ලැබුනේ නෑ.' };

  const prompt = [
    'මේ ඡායාරූපයේ ඇති QR කේතය (QR code) කියවන්න.',
    'QR කේතයේ සංකේතනය වී ඇති අකුරු/අංක ටික හරියටම "payload" එකට දාන්න — අකුරක් වත් වෙනස් කරන්න එපා.',
    'QR එක අපැහැදිලි නම් හෝ හඳුනාගන්න බැරි නම් readable="no" දාලා payload හිස්ව තියන්න.',
    'QR එකේ කොටසක් විතරක් පේනවා නම් ඒ කොටස විතරක් දෙන්න එපා — readable="no" දාන්න.',
  ].join('\n');

  const r = await callGemini({
    parts: [{ text: prompt }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Image } }],
    schema: QR_SCHEMA,
  });
  if (!r.ok) return r;

  const parsed = r.data || {};
  const payload = String(parsed.payload || '').trim();
  if (parsed.readable !== 'yes' || !payload) {
    return { ok: false, error: 'QR කේතය අපැහැදිලි නිසා කියවාගන්න බැරි උනා.' };
  }
  return { ok: true, data: { payload, note: parsed.note || null }, model: r.model, elapsedMs: r.elapsedMs };
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    lotterySlug: { type: 'string' },
    lotteryNameSeen: { type: 'string' },
    drawNo: { type: 'string' },
    date: { type: 'string' },
    letter: { type: 'string' },
    zodiac: { type: 'string' },
    superNumber: { type: 'string' },
    numbers: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: { type: 'string' },
  },
  // `nullable` පාවිච්චි කරන්නේ නෑ (හැම API version එකකම support නෑ).
  required: ['numbers', 'confidence'],
};

/**
 * scanTicketImage(base64Image, mimeType, lotteries)
 * returns { ok, data, raw, model, elapsedMs } | { ok:false, error, ... }
 */
async function scanTicketImage(base64Image, mimeType, lotteries) {
  if (!base64Image || typeof base64Image !== 'string') {
    return { ok: false, error: 'photo එකේ දත්ත ලැබුනේ නෑ.' };
  }

  const prompt = PROMPT_TEMPLATE.replace('{{LOTTERY_LIST}}', buildLotteryList(lotteries));
  const r = await callGemini({
    parts: [
      { text: prompt },
      { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Image } },
    ],
    schema: RESPONSE_SCHEMA,
  });
  if (!r.ok) return r;

  let parsed;
  try {
    parsed = extractJson(r.text);
  } catch (e) {
    return { ok: false, error: 'Gemini response එක valid JSON එකක් නෙවෙයි.', raw: r.text };
  }

  // ---- output එක sanitize කරනවා (AI එකෙන් එන දේ කෙලින්ම විශ්වාස කරන්නේ නෑ) ----
  const clean = (v, max = 100) =>
    v == null || v === 'null' ? null : String(v).trim().slice(0, max) || null;

  parsed.lotterySlug = clean(parsed.lotterySlug, 60);
  parsed.lotteryNameSeen = clean(parsed.lotteryNameSeen, 120);
  parsed.drawNo = clean(parsed.drawNo, 20);
  parsed.date = clean(parsed.date, 30);
  parsed.letter = clean(parsed.letter, 3);
  parsed.zodiac = clean(parsed.zodiac, 20);
  parsed.superNumber = clean(parsed.superNumber, 4);
  parsed.confidence = ['high', 'medium', 'low'].includes(parsed.confidence)
    ? parsed.confidence : 'low';
  parsed.notes = clean(parsed.notes, 300);
  parsed.numbers = Array.isArray(parsed.numbers)
    ? parsed.numbers.map(n => String(n).trim()).filter(n => /^\d{1,2}$/.test(n)).slice(0, 12)
    : [];
  if (parsed.letter && !/^[A-Za-z]$/.test(parsed.letter)) parsed.letter = null;

  // lotterySlug එක ඇත්තටම data.json එකේ තියෙනවද verify කරනවා
  if (parsed.lotterySlug && !(lotteries || []).find(l => l.slug === parsed.lotterySlug)) {
    parsed.lotterySlugInvalid = parsed.lotterySlug;
    parsed.lotterySlug = null;
  }

  return {
    ok: true,
    data: parsed,
    raw: r.text,
    model: r.model,
    elapsedMs: r.elapsedMs,
    thinking: r.thinking,
  };
}

module.exports = {
  callGemini, callGeminiWithKey, extractJson,
  scanTicketImage, decodeQrImage, buildLotteryList,
  keyPool,
  GEMINI_MODEL, GEMINI_URL, GEMINI_THINKING, RESPONSE_SCHEMA,
};
