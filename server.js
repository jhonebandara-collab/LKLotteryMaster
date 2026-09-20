/**
 * server.js — Express server + check API
 *
 * ⚠️ මේ file එක require කළාම **server එකක් start වෙන්නේ නෑ**.
 * `npm start` (එනම් `node server.js`) කළාම විතරයි listen කරන්නේ —
 * ඒ නිසා test.js එකට මේක import කරන්න පුළුවන් EADDRINUSE එකක් නැතුව.
 */

'use strict';

require('./env'); // .env කලින්ම load කරන්න ඕන (auth.js module load එකේදී කියවනවා)

const express = require('express');
const fs = require('fs');
const path = require('path');
const { evaluatePrize, hasPrizeTable, getLotteryKind } = require('./prizes');
// ⚠️ මුළු module එකම import කරනවා — `vision.keyPool` (admin status එකට)
// සහ `vision.scanTicketImage` දෙකම පාවිච්චි වෙනවා. කලින් destructure
// කරලා තිබ්බ නිසා `vision.keyPool` සහ `vision.scanTicketImage` කියන
// තැන් දෙකේ "vision is not defined" error එකක් ආවා.
const vision = require('./vision');
const { scanTicketImage } = vision;
const { db, close: closeDb } = require('./db');
const auth = require('./auth');
const billing = require('./billing');
const stats = require('./stats');
const lucky = require('./lucky');
const scrapeRunner = require('./scrape-runner');
const lotteryMeta = require('./lottery-meta');
const seo = require('./seo');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_MAIN = require.main === module;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Reverse proxy (nginx / Heroku / Render) පිටුපස තියෙනවා නම් req.ip එක
// හරියටම ලැබෙන්න මේක ඕන. default = off (X-Forwarded-For spoof කරන්න බෑ).
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');

// image base64 payload එකට body size limit එක වැඩි කරනවා (default 100kb ප්‍රමාණවත් නෑ)
app.use(express.json({ limit: '10mb' }));
// PayHere notify endpoint form-urlencoded ලෙස POST කරනවා
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- මූලික security headers (dependency එකක් නැතුව) ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self)');
  next();
});

app.use(express.static(PUBLIC_DIR));
app.use(auth.authMiddleware);

// ---------------------------------------------------------------
// data.json — safe load (file එක corrupt / අඩක් ලියවිලා තිබ්බොත් crash නොවෙන්න)
// ---------------------------------------------------------------
let dataCache = { mtimeMs: 0, size: -1, value: { lotteries: [] } };

function loadData() {
  let stat;
  try {
    stat = fs.statSync(DATA_FILE);
  } catch (e) {
    return { lotteries: [] };
  }
  if (stat.mtimeMs === dataCache.mtimeMs && stat.size === dataCache.size) {
    return dataCache.value;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!parsed || !Array.isArray(parsed.lotteries)) {
      throw new Error('lotteries array එකක් නෑ');
    }
    dataCache = { mtimeMs: stat.mtimeMs, size: stat.size, value: parsed };
    return parsed;
  } catch (e) {
    console.error('⚠️  data.json කියවන්න බැරි උනා:', e.message);
    return dataCache.value || { lotteries: [] };
  }
}

// draw.numbers array එකේ තියෙන ඉල්ලක්කම් වල max string-length එක —
// e.g. Mahajana Sampatha ['7','8','2',...] → 1, Govisetha ['06','13',...] → 2
// (ක්‍රියාත්මක කිරීම lottery-meta.js එකේ — lucky.js එකත් එකම එක පාවිච්චි කරනවා)
const digitWidthOf = lotteryMeta.digitWidthOf;

// ---------------------------------------------------------------
// Simple in-memory rate limiter (brute-force වළක්වන්න — dependency එකක් නැතුව)
// ---------------------------------------------------------------
function rateLimiter({ windowMs, max, key }) {
  const hits = new Map();
  return (req, res, next) => {
    const id = `${key(req)}:${req.ip || 'unknown'}`;
    const now = Date.now();
    let rec = hits.get(id);
    if (!rec || now - rec.start > windowMs) {
      rec = { start: now, count: 0 };
      hits.set(id, rec);
    }
    rec.count++;
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
    }
    if (rec.count > max) {
      res.setHeader('Retry-After', Math.ceil((rec.start + windowMs - now) / 1000));
      return res.status(429).json({ error: 'ඉල්ලීම් ගොඩක් එනවා. පොඩ්ඩක් ඉඳලා try කරන්න.' });
    }
    next();
  };
}

const authLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 30, key: r => r.path });
const scanLimiter = rateLimiter({ windowMs: 60 * 1000, max: 20, key: () => 'scan' });

/**
 * එකම user/IP එකෙන් **එකවර** එකකට වඩා AI request යන එක නවත්තනවා.
 *
 * Frontend එකේ button එක disable කරන එකයි මේකයි දෙකම තියෙනවා — ඇයි දෙකක්?
 *   • Button disable එකෙන් user ට පේන විදිහට "යනවා" කියලා පෙන්නනවා
 *     (අපරාදේ request යන්නේ නෑ)
 *   • ඒත් frontend එක bypass කරන්න පුළුවන් (curl, පරණ cache වුනු page,
 *     එකවර tabs දෙකක්) — ඒ නිසා server එකෙනුත් guard කරනවා.
 * එක request එකක් = එක Gemini call එකක් නිසා මේකෙන් quota ඉතිරි වෙනවා.
 */
const AI_HOLD_MAX_MS = 150000;   // ආරක්ෂක සීමාවක් — හිර වුනොත් නැවත අරිනවා
function inFlightGuard(keyFn) {
  const inflight = new Map();
  return (req, res, next) => {
    const k = keyFn(req);
    const since = inflight.get(k);
    if (since && Date.now() - since < AI_HOLD_MAX_MS) {
      return res.status(429).json({
        error: 'දැනටමත් ඉල්ලීමක් යනවා — ඒක ඉවර වෙනකම් ටිකක් ඉන්න.',
        inProgress: true,
      });
    }
    inflight.set(k, Date.now());
    const clear = () => inflight.delete(k);
    res.on('finish', clear);
    res.on('close', clear);
    next();
  };
}
const aiSingleFlight = inFlightGuard(
  r => (r.user ? 'u:' + r.user.id : 'ip:' + (r.ip || 'unknown'))
);
const checkLimiter = rateLimiter({ windowMs: 60 * 1000, max: 60, key: () => 'check' });

// ---------------------------------------------------------------
// GET /api/health — deploy/uptime checks
// ---------------------------------------------------------------
app.get('/api/health', (req, res) => {
  const data = loadData();
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    lotteries: data.lotteries.length,
    scrapedAt: data.scrapedAt || null,
    timezone: billing.APP_TZ,
    scanLimited: !billing.UNLIMITED_SCAN,
    // AI key pool එකේ තත්ත්වය (කිසිම key එකක් හෝ secret එකක් expose වෙන්නේ නෑ)
    ai: vision.keyPool.summary(),
  });
});

// ---------------------------------------------------------------
// GET /api/lotteries — lottery list එක (dropdown එකට)
// ---------------------------------------------------------------
app.get('/api/lotteries', (req, res) => {
  const data = loadData();
  res.json({
    scrapedAt: data.scrapedAt,
    lotteries: data.lotteries.map(l => lotteryMeta.describeLottery(l)),
  });
});

// ---------------------------------------------------------------
// GET /api/results/:slug — එක lottery එකක draws
// ---------------------------------------------------------------
app.get('/api/results/:slug', (req, res) => {
  const data = loadData();
  const lot = data.lotteries.find(l => l.slug === req.params.slug);
  if (!lot) return res.status(404).json({ error: 'Lottery හම්බුනේ නෑ' });
  res.json(lot);
});

// ---------------------------------------------------------------
// GET /api/latest — අද ඔක්කොම results
// ---------------------------------------------------------------
// ===============================================================
// 🔎 SEO — server-rendered පිටු (Google එකට කියවන්න පුළුවන්)
//    ⚠️ SPA එක JavaScript නිසා පමණක් index වෙන්නේ නෑ — ඒ නිසා මේ
//    පිටු හැම ලොතරැයියකටම සේවාදායකයේදීම HTML විදිහට හදලා යවනවා.
// ===============================================================
function seoCtx(req) {
  const d = loadData();
  return { base: seo.baseUrl(req), lotteries: d.lotteries, all: d.lotteries };
}

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(seo.robotsTxt(seo.baseUrl(req)));
});

app.get('/sitemap.xml', (req, res) => {
  const c = seoCtx(req);
  res.type('application/xml').send(seo.sitemapXml(c.all, c));
});

app.get('/results', (req, res) => {
  const c = seoCtx(req);
  res.type('html').send(seo.resultsPage(c.all, c));
});

app.get('/lottery/:slug', (req, res, next) => {
  const c = seoCtx(req);
  const lot = c.all.find(l => l.slug === req.params.slug);
  if (!lot) return next();                 // නැත්නම් SPA එකට යන්න දෙන්න
  res.type('html').send(seo.lotteryPage(lot, c));
});

['/about', '/how-to-use', '/privacy-policy', '/refund-policy'].forEach(p => {
  app.get(p, (req, res) => {
    const c = seoCtx(req);
    const html = seo.staticPage(p.slice(1), c);
    if (!html) return res.status(404).send('Not found');
    res.type('html').send(html);
  });
});

// JSON-LD SearchAction එකට අදාළ සරල සෙවුම් පිටුව
app.get('/search', (req, res) => {
  const c = seoCtx(req);
  const q = String(req.query.q || '').trim().toLowerCase();
  const hits = q
    ? c.all.filter(l => (l.name + ' ' + (l.nameSi || '') + ' ' + l.slug).toLowerCase().includes(q))
    : c.all;
  const links = hits.map(l => `<a href="/lottery/${seo.esc(l.slug)}">${seo.esc(l.nameSi || l.name)}</a>`).join('');
  res.type('html').send(
    seo.staticPage('about', c).replace('</div></body>',
      '<h1>සෙවුම</h1><p>“' + seo.esc(q) + '” සඳහා ප්‍රතිඵල ' + hits.length + 'ක්.</p>' +
      '<div class="links">' + links + '</div></div></body>')
  );
});

// ---------------------------------------------------------------
// 📅 එක දිනකට **හැම ලොතරැයියකගේම** ප්‍රතිඵල
//    GET /api/results-by-date?date=YYYY-MM-DD
//    (📋 අලුත්ම ප්‍රතිඵල tab එකේ calendar එකෙන් දිනයක් තෝරාම මේක භාවිතා වෙනවා)
// ---------------------------------------------------------------
app.get('/api/results-by-date', (req, res) => {
  const date = String(req.query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date එක YYYY-MM-DD ආකෘතියෙන් ඕන' });
  }
  const data = loadData();
  const results = [];
  for (const l of data.lotteries) {
    const draw = (l.draws || []).find(d => d.date === date);
    if (!draw) continue;
    const meta = lotteryMeta.describeLottery(l);
    results.push({
      slug: l.slug, provider: l.provider,
      name: l.name, nameSi: l.nameSi || null,
      hasLetter: !!meta.hasLetter, hasZodiac: !!meta.hasZodiac,
      hasSuperNumber: !!meta.hasSuperNumber,
      numberCount: meta.numberCount, digitWidth: meta.digitWidth,
      drawNo: draw.drawNo, date: draw.date,
      letter: draw.letter || null, zodiac: draw.zodiac || null,
      superNumber: draw.superNumber || null, numbers: draw.numbers || [],
    });
  }
  res.json({ date, count: results.length, total: data.lotteries.length, results });
});

// ---------------------------------------------------------------
// 📅 ලොතරැයියක draw ලැයිස්තුව / දිනයකට අදාළ draw එක
//   GET /api/draws/:slug                       → හැම draw එකක්ම (දිනයත් එක්ක)
//   GET /api/draws/:slug?date=YYYY-MM-DD        → ඒ දවසේ draw එක
// ---------------------------------------------------------------
app.get('/api/draws/:slug', (req, res) => {
  const data = loadData();
  const lot = data.lotteries.find(l => l.slug === req.params.slug);
  if (!lot) return res.status(404).json({ error: 'Lottery හම්බුනේ නෑ' });

  const meta = lotteryMeta.describeLottery(lot);
  const wantDate = String(req.query.date || '').trim();

  if (wantDate) {
    const draw = lot.draws.find(d => d.date === wantDate);
    return res.json({
      lottery: { slug: lot.slug, name: lot.name, nameSi: lot.nameSi || null, provider: lot.provider },
      date: wantDate,
      draw: draw || null,
      totalDraws: lot.draws.length,
    });
  }

  const limit = Math.min(400, Math.max(1, Number(req.query.limit || 90)));
  res.json({
    lottery: { slug: lot.slug, name: lot.name, nameSi: lot.nameSi || null, provider: lot.provider },
    numberCount: meta.numberCount,
    dateFrom: lot.draws.length ? lot.draws[lot.draws.length - 1].date : null,
    dateTo: lot.draws.length ? lot.draws[0].date : null,
    totalDraws: lot.draws.length,
    draws: lot.draws.slice(0, limit).map(d => ({ drawNo: d.drawNo, date: d.date })),
  });
});

app.get('/api/latest', (req, res) => {
  const data = loadData();
  res.json({
    scrapedAt: data.scrapedAt,
    results: data.lotteries.map(l => ({
      provider: l.provider,
      slug: l.slug,
      name: l.name,
      nameSi: l.nameSi || null,
      ...(l.draws[0] || {})
    }))
  });
});

// ---------------------------------------------------------------
// POST /api/check — ticket එක check කරනවා
// ---------------------------------------------------------------
app.post('/api/check', checkLimiter, (req, res) => {
  const { slug, drawNo, date, letter, zodiac, superNumber, numbers, subGameIndex, source } = req.body || {};

  if (!slug) return res.status(400).json({ error: 'slug ඕන' });
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'numbers ඕන' });
  }

  const data = loadData();
  const lot = data.lotteries.find(l => l.slug === slug);
  if (!lot) return res.status(404).json({ error: 'Lottery හම්බුනේ නෑ' });

  /**
   * Draw එක තෝරන පිළිවෙළ:
   *   1. drawNo දුන්නොත් ඒක
   *   2. 📅 දිනය දුන්නොත් **ඒ දවසේ** draw එක (calendar එකෙන් බලන විට)
   *   3. නැත්නම් අලුත්ම draw එක
   */
  let draw = null;
  if (drawNo) {
    draw = lot.draws.find(d => String(d.drawNo) === String(drawNo));
  } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    draw = lot.draws.find(d => d.date === String(date));
  } else {
    draw = lot.draws[0];
  }

  if (!draw) {
    return res.status(404).json({
      error: drawNo ? `Draw ${drawNo} හම්බුනේ නෑ`
        : `${date} දිනයට ${lot.name} ප්‍රතිඵලයක් අපේ දත්තවල නෑ`,
      availableDraws: lot.draws.slice(0, 5).map(d => d.drawNo),
      availableDates: lot.draws.slice(0, 10).map(d => d.date),
    });
  }

  const ticket = { letter, zodiac, superNumber, numbers };
  const disclaimer = 'මෙය නිල ප්‍රතිඵලයක් නොවේ. ' +
    (lot.provider === 'NLB' ? 'NLB' : 'DLB') + ' වෙතින් තහවුරු කරගන්න.';

  // --- ඇත්ත prize table එකක් තියෙනවා නම් ඒක පාවිච්චි කරනවා ---
  if (hasPrizeTable(slug)) {
    const opts = Number.isInteger(subGameIndex) ? { subGameIndex } : undefined;
    const result = evaluatePrize(slug, draw, ticket, opts);

    const drawView = (Number.isInteger(subGameIndex) && draw.subGames && draw.subGames[subGameIndex])
      ? draw.subGames[subGameIndex]
      : draw;

    // History / report / admin statistics වලට මේ check එක save කරනවා
    stats.logCheck({
      user: req.user,
      lottery: { slug: lot.slug, provider: lot.provider, name: lot.name, nameSi: lot.nameSi },
      draw: { drawNo: draw.drawNo, date: draw.date },
      ticket: { letter, zodiac, superNumber, numbers },
      result,
      engine: 'real-prize-table',
      source,
    });

    return res.json({
      lottery: { provider: lot.provider, slug: lot.slug, name: lot.name },
      draw: { drawNo: draw.drawNo, date: draw.date,
              letter: drawView.letter, zodiac: drawView.zodiac,
              superNumber: drawView.superNumber, numbers: drawView.numbers },
      ticket: { letter: letter || null, zodiac: zodiac || null,
                superNumber: superNumber || null, numbers },
      engine: 'real-prize-table',
      ...result,
      disclaimer,
    });
  }

  // --- fallback: පරණ SIMPLIFIED logic එක (real table නැති lottery සඳහා විතරයි) ---
  const result = checkTicket(draw, { letter, numbers });

  stats.logCheck({
    user: req.user,
    lottery: { slug: lot.slug, provider: lot.provider, name: lot.name, nameSi: lot.nameSi },
    draw: { drawNo: draw.drawNo, date: draw.date },
    ticket: { letter, zodiac, superNumber, numbers },
    result,
    engine: 'simplified-fallback',
    source,
  });

  res.json({
    lottery: { provider: lot.provider, slug: lot.slug, name: lot.name },
    draw: { drawNo: draw.drawNo, date: draw.date,
            letter: draw.letter, numbers: draw.numbers },
    ticket: { letter: letter || null, numbers },
    engine: 'simplified-fallback',
    ...result,
    disclaimer,
  });
});

// ---------------------------------------------------------------
// POST /api/scan — photo එකක් AI vision model එකට (Gemini) යවලා
// lottery ticket එකේ ඉලක්කම්/අකුර/රාශිය ටික structured JSON එකක්
// විදිහට extract කරගන්නවා.
// body: { image: '<base64, "data:image/...;base64," prefix එක නැතුව>',
//         mimeType: 'image/jpeg' }
// ---------------------------------------------------------------
app.post('/api/scan', scanLimiter, aiSingleFlight, async (req, res, next) => {
  try {
    const { image, mimeType } = req.body || {};
    if (!image) return res.status(400).json({ error: 'image (base64) ඕන' });

    // --- Scan quota check (Free/guest limited, paid plans higher/unlimited) ---
    const quota = billing.checkScanQuota(req);
    if (!quota.allowed) {
      return res.status(429).json({ error: quota.reason, quotaExceeded: true });
    }

    const data = loadData();
    const result = await scanTicketImage(image, mimeType, data.lotteries);

    if (!result.ok) {
      const status = result.quotaExceeded ? 429 : (result.needsSetup ? 501 : 502);
      return res.status(status).json({
        error: result.error,
        needsSetup: !!result.needsSetup,
        quotaExceeded: !!result.quotaExceeded,
      });
    }

    quota.bump(); // සාර්ථක scan එකකට විතරයි quota එකෙන් අඩු කරන්නේ
    res.json({
      scan: result.data,
      quota: quota.remaining || null,
      unlimited: !!quota.unlimited,
      model: result.model || null,
      elapsedMs: result.elapsedMs || null,
      thinking: result.thinking || null,
    });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------
// AUTH — Register / Login / Google Sign-In / Me
// ---------------------------------------------------------------
app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const result = await auth.register(email, password, name);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ user: userPayload(result.user), token: result.token });
  } catch (e) { next(e); }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const result = await auth.login(email, password);
    if (result.error) {
      return res.status(401).json({
        error: result.error,
        noAccount: !!result.noAccount,
        useGoogle: !!result.useGoogle,
        badPassword: !!result.badPassword,
      });
    }
    res.json({ user: userPayload(result.user), token: result.token });
  } catch (e) { next(e); }
});

app.post('/api/auth/google', authLimiter, async (req, res, next) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken ඕන' });
    const result = await auth.loginWithGoogle(idToken);
    if (result.error) {
      return res.status(result.needsSetup ? 501 : 401).json({
        error: result.error, needsSetup: !!result.needsSetup,
      });
    }
    res.json({
      user: userPayload(result.user),
      token: result.token,
      isNew: !!result.isNew,
    });
  } catch (e) { next(e); }
});

app.get('/api/auth/me', auth.requireAuth, (req, res) => {
  res.json({ user: userPayload(req.user) });
});

// GET /api/auth/google-client-id — frontend එකට Google Sign-In button
// render කරන්න client_id එක ඕන (setup වෙලා නැත්තම් null)
app.get('/api/auth/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
});

// ---------------------------------------------------------------
// හැම auth response එකකටම isAdmin එකත් එකතු කරනවා — frontend එකට
// Admin tab එක පෙන්නන්න/හංගන්න ඒක ඕන.
// ---------------------------------------------------------------
function userPayload(u) {
  const p = auth.publicUser(u);
  return p ? Object.assign({}, p, { isAdmin: stats.isAdmin(u) }) : null;
}

// ---------------------------------------------------------------
// ADMIN guard — .env එකේ ADMIN_EMAILS එකේ තියෙන email එකක් වෙන්න ඕන
// ---------------------------------------------------------------
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'ගිණුමට login වෙන්න ඕන.' });
  if (!stats.isAdmin(req.user)) {
    return res.status(403).json({ error: 'මේ කොටස බලන්න admin අවසර ඕන.' });
  }
  next();
}

// ---------------------------------------------------------------
// 🔳 QR කේතය කියවීම — frontend එකේ native (BarcodeDetector) සහ jsQR
//    දෙකම fail උනොත් විතරයි මේකට එන්නේ. අන්තිම උපාය.
// ---------------------------------------------------------------
app.post('/api/qr', scanLimiter, aiSingleFlight, async (req, res) => {
  try {
    const { image, mimeType } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'image (base64) ඕන' });
    }
    const r = await vision.decodeQrImage(image, mimeType);
    if (!r.ok) {
      return res.status(r.needsSetup ? 501 : 422).json({
        error: r.error, needsSetup: !!r.needsSetup,
      });
    }
    res.json({ payload: r.data.payload, note: r.data.note, model: r.model || null });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------
// 🍀 "මගේ වාසනාව" (Lucky Guess) — premium feature
// ---------------------------------------------------------------
/**
 * Premium gate — free plan එකේ අයට 402 (Payment Required) එකක් දෙනවා,
 * එක්කම upgrade කරන්න පුළුවන් plans ටිකත් යවනවා.
 */
function requirePremium(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'මේ feature එක භාවිතා කරන්න login වෙන්න ඕන.' });
  const planKey = billing.effectivePlan(req.user);
  if (planKey === 'free') {
    return res.status(402).json({
      error: '🍀 "මගේ වාසනාව" කියන්නේ Premium feature එකක්. එක් plan එකක් ගත්තම වහාම භාවිතා කරන්න පුළුවන්.',
      premiumRequired: true,
      currentPlan: 'free',
      plans: Object.entries(billing.PLANS).map(([id, p]) => ({ id, label: p.label, priceRs: p.priceRs })),
    });
  }
  req.planKey = planKey;
  next();
}

const guessLimiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: 20, key: () => 'lucky-guess' });

/**
 * 🍀 user ගේ උපන් විස්තර වලින් සංඛ්‍යා ශාස්ත්‍රීය (numerology) සංඥා ගන්නවා.
 * Profile එකක් නැත්නම් null — එතකොට ශ්‍රේණිගත කිරීමේ එන්ජිම සංඛ්‍යාලේඛන
 * වලින් විතරක් වැඩ කරනවා.
 */
function numerologyOf(user) {
  if (!user) return null;
  try {
    const prof = lucky.getProfile(user.id);
    if (!prof || !prof.birthday) return null;
    return lucky.numerologyProfile({
      fullName: prof.fullName,
      birthday: prof.birthday,
      birthTime: prof.birthTime,
      birthMeridiem: prof.birthMeridiem,
    });
  } catch (e) {
    return null;
  }
}

/** numerology object එකෙන් client එකට යවන්න ඕන කොටස විතරයි (PII අඩුවෙන්) */
function publicNumerology(n) {
  if (!n) return null;
  return {
    lifePath: n.lifePath, birthdayNumber: n.birthdayNumber,
    timeNumber: n.timeNumber, nameNumber: n.nameNumber,
    luckyNumber: n.luckyNumber, luckyDigits: n.luckyDigits,
    planet: n.planet, element: n.element, note: n.note,
  };
}

/** Disclaimer එක — frontend එක මේක පෙන්නලා user එකෙන් එකඟ වීම ඉල්ලනවා */
app.get('/api/lucky/disclaimer', (req, res) => {
  res.json({
    version: lucky.DISCLAIMER_VERSION,
    title: '⚠️ කරුණාකර කියවා එකඟ වන්න',
    text: lucky.DISCLAIMER_SI,
  });
});

/** උපන් විස්තර — කියවන්න */
app.get('/api/profile', auth.requireAuth, (req, res) => {
  const p = lucky.getProfile(req.user.id);
  res.json({
    profile: p,
    numerology: p ? lucky.numerologyProfile({
      fullName: p.fullName, birthday: p.birthday,
      birthTime: p.birthTime, birthMeridiem: p.birthMeridiem,
    }) : null,
    plan: billing.effectivePlan(req.user),
  });
});

/** උපන් විස්තර — save කරන්න (නම, උපන් දිනය, උපන් වේලාව + AM/PM) */
app.post('/api/profile', auth.requireAuth, (req, res) => {
  const { fullName, birthday, birthHour, birthMinute, birthMeridiem, birthPlace } = req.body || {};

  const name = String(fullName || '').trim();
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: 'නම අකුරු 2ක් සහ 80ක් අතර වෙන්න ඕන.' });
  }

  const dob = String(birthday || '').trim();
  const dm = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return res.status(400).json({ error: 'උපන් දිනය YYYY-MM-DD විදිහට දෙන්න.' });
  const y = Number(dm[1]), mo = Number(dm[2]), d = Number(dm[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return res.status(400).json({ error: 'උපන් දිනය වලංගු දිනයක් නෙවෙයි.' });
  }
  if (y < 1900 || dt.getTime() > Date.now()) {
    return res.status(400).json({ error: 'උපන් දිනය 1900ට පස්සේ සහ අදට කලින් වෙන්න ඕන.' });
  }

  // උපන් වේලාව — 12 පැය ආකෘතියෙන් (AM/PM එක්ක) අසනවා, 24h ලෙස save කරනවා
  const meridiem = String(birthMeridiem || '').trim().toUpperCase();
  if (!['AM', 'PM'].includes(meridiem)) {
    return res.status(400).json({ error: 'උපන් වේලාවට AM හෝ PM තෝරන්න ඕන.' });
  }
  const h12 = Number(birthHour), min = Number(birthMinute);
  if (!Number.isInteger(h12) || h12 < 1 || h12 > 12) {
    return res.status(400).json({ error: 'පැය 1 සහ 12 අතර වෙන්න ඕන.' });
  }
  if (!Number.isInteger(min) || min < 0 || min > 59) {
    return res.status(400).json({ error: 'මිනිත්තු 0 සහ 59 අතර වෙන්න ඕන.' });
  }
  const hour24 = (h12 % 12) + (meridiem === 'PM' ? 12 : 0);
  const hhmm = String(hour24).padStart(2, '0') + ':' + String(min).padStart(2, '0');

  const saved = lucky.saveProfile(req.user.id, {
    fullName: name,
    birthday: dob,
    birthTime: hhmm,
    birthMeridiem: meridiem,
    birthPlace: String(birthPlace || '').trim().slice(0, 80) || null,
  });

  res.json({
    profile: saved,
    display: { hour12: h12, minute: String(min).padStart(2, '0'), meridiem },
    numerology: lucky.numerologyProfile({
      fullName: name, birthday: dob, birthTime: hhmm, birthMeridiem: meridiem,
    }),
  });
});

/** පසුගිය ප්රතිඵල විශ්ලේෂණය (AI නැතුව — වේගවත්) */
app.get('/api/lucky/patterns', auth.requireAuth, requirePremium, (req, res) => {
  const { slug, subGameIndex } = req.query || {};
  const data = loadData();
  const lot = data.lotteries.find(l => l.slug === slug);
  if (!lot) return res.status(404).json({ error: 'ඒ ලොතරැයිය හම්බුනේ නෑ.' });

  const sgIdx = subGameIndex != null && subGameIndex !== '' ? parseInt(subGameIndex, 10) : null;
  const p = lucky.analyzeDraws(lot, Number.isInteger(sgIdx) ? sgIdx : null);
  if (!p) return res.status(400).json({ error: 'දත්ත විශ්ලේෂණය කරන්න බැරි උනා.' });

  // 🧮 ශ්‍රේණිගත කිරීමේ එන්ජිම — ඉලක්කම් වලට වඩා ගැඹුරු විශ්ලේෂණයක්
  const numerology = numerologyOf(req.user);
  res.json({
    patterns: p,
    summary: lucky.summarizePatterns(p),
    ranking: lucky.rankCandidates(lot, p, numerology),
    plan: lucky.nextDrawPlan(lot, p, numerology),
    numerology: publicNumerology(numerology),
  });
});

/** 🍀 අනුමානය — AI එකෙන් (premium + disclaimer එකට එකඟ වීම අනිවාර්යයි) */
app.post('/api/lucky/guess', auth.requireAuth, requirePremium, guessLimiter, aiSingleFlight, async (req, res) => {
  try {
    const { slug, subGameIndex, drawNo, image, mimeType, source, agreedDisclaimer } = req.body || {};

    // ⚠️ Disclaimer එකට එකඟ වීම server එකේදීම enforce කරනවා — frontend එකේ
    // modal එක bypass කරන්න පුළුවන් වුනත්, එකඟ නැතුව අනුමානයක් හැදෙන්නේ නෑ.
    if (String(agreedDisclaimer || '') !== lucky.DISCLAIMER_VERSION) {
      return res.status(400).json({
        error: 'අනුමානය ලබාගැනීමට පෙර නියමයන්ට (disclaimer) එකඟ විය යුතුයි.',
        disclaimerRequired: true,
        version: lucky.DISCLAIMER_VERSION,
        text: lucky.DISCLAIMER_SI,
      });
    }

    const data = loadData();
    let lotterySlug = slug ? String(slug) : null;
    let scanInfo = null;
    let extraContext = null;

    // Photo එකක් එවලා නම් — මුලින්ම ලොතරැයිය හඳුනාගන්නවා
    if (image) {
      const source = data.lotteries.map(l => ({ slug: l.slug, name: l.name, provider: l.provider }));
      const scan = await vision.scanTicketImage(image, mimeType, source);
      if (scan.ok) {
        scanInfo = scan.data;
        if (!lotterySlug && scan.data.lotterySlug) lotterySlug = scan.data.lotterySlug;
        extraContext = [
          scan.data.lotteryNameSeen ? `පත්රිකාවේ පෙනුන නම: ${scan.data.lotteryNameSeen}` : null,
          scan.data.drawNo ? `පත්රිකාවේ Draw අංකය: ${scan.data.drawNo}` : null,
          scan.data.letter ? `පත්රිකාවේ අකුර: ${scan.data.letter}` : null,
          scan.data.numbers && scan.data.numbers.length ? `පත්රිකාවේ පේන ඉලක්කම්: ${scan.data.numbers.join(' ')}` : null,
        ].filter(Boolean).join('\n');
      } else if (!lotterySlug) {
        return res.status(scan.quotaExceeded ? 429 : 502).json({
          error: scan.error, needsSetup: !!scan.needsSetup, quotaExceeded: !!scan.quotaExceeded,
        });
      }
    }

    const lot = data.lotteries.find(l => l.slug === lotterySlug);
    if (!lot) {
      return res.status(404).json({
        error: 'ලොතරැයිය හඳුනාගන්න බැරි උනා — ලැයිස්තුවෙන් එකක් තෝරන්න.',
      });
    }

    const prof = lucky.getProfile(req.user.id);
    const numerology = prof ? lucky.numerologyProfile({
      fullName: prof.fullName, birthday: prof.birthday,
      birthTime: prof.birthTime, birthMeridiem: prof.birthMeridiem,
    }) : null;

    const sgIdx = subGameIndex != null && subGameIndex !== '' ? parseInt(subGameIndex, 10) : null;
    const r = await lucky.generateGuess({
      lottery: lot,
      subGameIndex: Number.isInteger(sgIdx) ? sgIdx : null,
      numerology,
      source: source === 'scan' || image ? 'scan' : 'manual',
      extraContext,
    });
    if (!r.ok) return res.status(400).json({ error: r.error });

    const latestDraw = lot.draws && lot.draws[0] ? lot.draws[0] : null;
    const guessId = lucky.saveGuess({
      userId: req.user.id,
      lottery: { slug: lot.slug, name: lot.name, provider: lot.provider },
      subGameIndex: Number.isInteger(sgIdx) ? sgIdx : null,
      draw: { drawNo: drawNo || (latestDraw && latestDraw.drawNo), date: latestDraw && latestDraw.date },
      guess: r.guess,
      patterns: r.patterns,
      numerology,
      source: source === 'scan' || image ? 'scan' : 'manual',
      model: r.model,
      aiUsed: r.aiUsed,
      agreedDisclaimer: lucky.DISCLAIMER_VERSION,
    });

    res.json({
      id: guessId,
      lottery: {
        slug: lot.slug, name: lot.name, nameSi: lot.nameSi, provider: lot.provider,
        prizeKind: lot.prizeKind || null,
      },
      subGameIndex: Number.isInteger(sgIdx) ? sgIdx : null,
      guess: r.guess,
      base: r.base,
      summary: r.summary,
      ranking: r.rank,
      plan: r.plan,
      patterns: r.patterns,
      aiUsed: r.aiUsed,
      warning: r.warning || null,
      model: r.model || null,
      elapsedMs: r.elapsedMs || null,
      scanInfo,
      disclaimer: { version: lucky.DISCLAIMER_VERSION, text: lucky.DISCLAIMER_SI },
      note: 'මෙය වාසනාව මත පදනම් වූ යෝජනාවක් මිස අනාවැකියක් නොවේ.',
    });
  } catch (e) {
    console.error('✗ /api/lucky/guess:', e.message);
    res.status(500).json({ error: 'අනුමානය හදන්න බැරි උනා: ' + e.message });
  }
});

/** පෙර අනුමාන (history) */
/**
 * 🧾 ලොතරැයි අනුව සාරාංශය (lottery-wise overview)
 *   GET /api/lucky/overview?limit=6
 *
 * හැම scrape කරපු ලොතරැයියකටම වෙන වෙනම: ඉහළම ශ්‍රේණියේ අංක, වැඩිපුරම ආපු
 * අංක, දිගු කලක් නොපෙනුණු අංක, අලුත්ම draw එක සහ ඊළඟ draw එකට යෝජනාව.
 * AI එකක් call වෙන්නේ නෑ — හැම ලොතරැයියකටම ~10ms නිසා මේක ඉක්මන්.
 */
app.get('/api/lucky/overview', auth.requireAuth, requirePremium, (req, res) => {
  try {
    const data = loadData();
    const numerology = numerologyOf(req.user);
    const limit = Math.min(10, Math.max(3, parseInt(req.query.limit, 10) || 6));
    res.json(lucky.lotteryWiseOverview(data, numerology, { limit }));
  } catch (e) {
    console.error('✗ /api/lucky/overview:', e.message);
    res.status(500).json({ error: 'සාරාංශය හදන්න බැරි උනා: ' + e.message });
  }
});

app.get('/api/lucky/history', auth.requireAuth, (req, res) => {
  const { limit, offset } = req.query || {};
  res.json(lucky.guessHistory(req.user.id, { limit, offset }));
});

// ---------------------------------------------------------------
// Auto-scrape status (public — UI එකේ "අවසන් යාවත්කාලීන" පෙන්නන්න)
// ---------------------------------------------------------------
app.get('/api/scrape/status', (req, res) => {
  res.json(scrapeRunner.status());
});

// ---------------------------------------------------------------
// 🔑 Gemini key pool එකේ තත්ත්වය — admin ට විතරයි.
// Keys පෙන්නන්නේ masked විදිහට විතරයි (key #1 · AQ.Ab8…t0w).
// ---------------------------------------------------------------
app.get('/api/admin/gemini-keys', requireAdmin, (req, res) => {
  res.json(vision.keyPool.status());
});

// Manual refresh — admin ට විතරයි
app.post('/api/admin/scrape', requireAdmin, async (req, res) => {
  const r = await scrapeRunner.runScrape({ reason: 'admin-manual' });
  res.status(r.ok ? 200 : 502).json(r);
});

// ---------------------------------------------------------------
// GET /api/me/stats — login වෙලා ඉන්න කෙනාගේ summary
// ---------------------------------------------------------------
app.get('/api/me/stats', auth.requireAuth, (req, res) => {
  res.json({
    user: userPayload(req.user),
    plan: billing.effectivePlan(req.user),
    stats: stats.userStats(req.user.id),
  });
});

// ---------------------------------------------------------------
// GET /api/history — login වෙලා ඉන්න කෙනාගේ සම්පූර්ණ check history එක
//   ?slug=  ?from=YYYY-MM-DD  ?to=YYYY-MM-DD  ?winsOnly=true  ?limit=  ?offset=
// ---------------------------------------------------------------
app.get('/api/history', auth.requireAuth, (req, res) => {
  const { slug, from, to, winsOnly, limit, offset } = req.query || {};
  res.json(stats.userHistory(req.user.id, { slug, from, to, winsOnly, limit, offset }));
});

// ---------------------------------------------------------------
// GET /api/report — ලොතරැයි අනුව විස්තරාත්මක report එක (analysis)
//   ?from=  ?to=
// ---------------------------------------------------------------
app.get('/api/report', auth.requireAuth, (req, res) => {
  const { from, to } = req.query || {};
  res.json({
    user: userPayload(req.user),
    stats: stats.userStats(req.user.id),
    report: stats.userReport(req.user.id, { from, to }),
  });
});

// ---------------------------------------------------------------
// ADMIN API — signups + user stats + ලොතරැයි report
// ---------------------------------------------------------------
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  res.json(stats.adminOverview());
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const { q, limit, offset, sort } = req.query || {};
  res.json(stats.adminUsers({ q, limit, offset, sort }));
});

app.get('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'user id එක වැරදියි' });
  const detail = stats.adminUserDetail(id);
  if (!detail) return res.status(404).json({ error: 'ඒ user ව හම්බුනේ නෑ' });
  res.json(detail);
});

app.get('/api/admin/report', requireAdmin, (req, res) => {
  const { from, to, userId } = req.query || {};
  res.json(stats.adminReport({
    from, to,
    userId: userId ? parseInt(userId, 10) : null,
  }));
});

// Admin නැතිව කවුරුහරි /api/admin/... ට ගියොත් — මොකද කරන්න ඕන කියලා කියනවා.
// ⚠️ login වෙච්ච කෙනෙක්ට විතරයි — නැත්නම් admin email ලැයිස්තුව කාට වුනත්
// පේනවා (information disclosure).
app.get('/api/admin/setup', auth.requireAuth, (req, res) => {
    const emails = stats.adminEmails();
  const isAdm = stats.isAdmin(req.user);
  res.json({
    adminConfigured: emails.length > 0,
    // admin ලැයිස්තුව පෙන්නන්නේ admin කෙනෙකුට විතරයි — අනිත් අයට
    // "set කරලා තියෙනවාද" කියන කාරණය විතරයි.
    adminEmails: isAdm ? emails : null,
    yourEmail: req.user ? req.user.email : null,
    loggedIn: !!req.user,
    isAdmin: isAdm,
  });
});

// ---------------------------------------------------------------
// BILLING — Plans / Checkout / Notify (PayHere)
// ---------------------------------------------------------------
app.get('/api/billing/plans', (req, res) => {
  const plan = billing.effectivePlan(req.user);
  res.json({ plans: billing.PLANS, currentPlan: plan, loggedIn: !!req.user });
});

app.post('/api/billing/checkout', auth.requireAuth, (req, res, next) => {
  try {
    const { plan } = req.body || {};
    const planCfg = billing.PLANS[plan];
    if (!planCfg || plan === 'free') return res.status(400).json({ error: 'නිවැරදි plan එකක් තෝරන්න.' });

    const orderId = `LKM-${req.user.id}-${Date.now()}`;
    const checkout = billing.buildPayhereCheckout({
      orderId, amountRs: planCfg.priceRs, itemName: `LK Lottery Master — ${planCfg.label}`,
      user: req.user,
    });
    if (checkout.error) {
      return res.status(checkout.needsSetup ? 501 : 500).json({
        error: checkout.error, needsSetup: !!checkout.needsSetup,
      });
    }

    db.prepare(
      'INSERT INTO payments (userId, orderId, plan, amountRs, status) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, orderId, plan, planCfg.priceRs, 'pending');

    res.json(checkout);
  } catch (e) { next(e); }
});

// PayHere server-to-server notify — payment සාර්ථක උනාම මෙතනට POST එකක් එනවා
app.post('/api/billing/notify', (req, res, next) => {
  try {
    const body = req.body || {};
    const valid = billing.verifyPayhereNotify(body);
    if (!valid) {
      console.warn('⚠️ PayHere notify: md5sig invalid, ignoring.', body.order_id);
      return res.status(400).send('invalid signature');
    }

    const result = billing.applyPaymentResult({
      orderId: body.order_id,
      statusCode: String(body.status_code),
      rawBody: body,
    });
    if (!result.ok) return res.status(result.code || 400).send(result.message || 'error');

    res.send('OK'); // PayHere ට 200 OK එකක් ලැබෙන්න ඕන, නැත්තම් retry කරනවා
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------
// Check logic (real prize table නැති lottery වලට fallback only)
// ---------------------------------------------------------------
function checkTicket(draw, ticket) {
  const official = draw.numbers.map(n => String(n).trim());
  const mine = ticket.numbers.map(n => String(n).trim());

  const letterMatch = !!(draw.letter && ticket.letter &&
    String(draw.letter).toUpperCase() === String(ticket.letter).toUpperCase());

  // --- Positional match (Mahajana වගේ sequential digits) ---
  let positional = 0;
  for (let i = 0; i < Math.min(official.length, mine.length); i++) {
    if (official[i] === mine[i]) positional++;
    else break;              // ඉදිරියෙන් පිළිවෙළට විතරයි
  }

  // --- Positional from the end ---
  let positionalFromEnd = 0;
  for (let i = 0; i < Math.min(official.length, mine.length); i++) {
    if (official[official.length-1-i] === mine[mine.length-1-i]) positionalFromEnd++;
    else break;
  }

  // --- Set match (Govisetha වගේ, පිළිවෙළ අදාළ නෑ) ---
  const pool = [...official];
  let setMatches = 0;
  const matchedNumbers = [];
  for (const n of mine) {
    const idx = pool.indexOf(n);
    if (idx !== -1) { pool.splice(idx, 1); setMatches++; matchedNumbers.push(n); }
  }

  const allMatch = setMatches === official.length && mine.length === official.length;

  // ⚠️ මේක SIMPLIFIED logic එකක්. ඇත්ත app එකට lottery
  // එකින් එකට prize table එකක් DB එකේ තියෙන්න ඕන.
  let won = false;
  let tier = null;

  if (allMatch && (!draw.letter || letterMatch)) {
    won = true; tier = 'JACKPOT';
  } else if (allMatch) {
    won = true; tier = 'ALL_NUMBERS';
  } else if (setMatches >= 3) {
    won = true; tier = `MATCH_${setMatches}`;
  } else if (positional >= 3) {
    won = true; tier = `FIRST_${positional}_DIGITS`;
  } else if (positionalFromEnd >= 3) {
    won = true; tier = `LAST_${positionalFromEnd}_DIGITS`;
  } else if (letterMatch && setMatches >= 2) {
    won = true; tier = 'LETTER_PLUS_2';
  }

  return {
    won,
    tier,
    detail: {
      letterMatch,
      setMatches,
      matchedNumbers,
      positionalFromStart: positional,
      positionalFromEnd,
      totalOfficial: official.length,
    },
    note: 'Prize amount එක lottery එකේ නිල prize structure එකෙන් ' +
          'තහවුරු කරගන්න. මේ tier logic එක සරල උදාහරණයක්.'
  };
}

// ---------------------------------------------------------------
// 404 + error handling
// ---------------------------------------------------------------
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint එකක් හම්බුනේ නෑ' });
  }
  // SPA-style fallback — public/index.html එක තියෙනවා නම් ඒක යවනවා
  const indexFile = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  next();
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('✗', req.method, req.originalUrl, '-', err && err.message);
  if (res.headersSent) return;
  const status = err && err.status ? err.status : 500;
  res.status(status).json({ error: 'Server error එකක් ආවා. Log එක බලන්න.' });
});

// ---------------------------------------------------------------
// Server start + cron — මේවා `node server.js` කළාම විතරයි run වෙන්නේ
// ---------------------------------------------------------------
function startServer(port = PORT) {
  const server = app.listen(port, () => {
    console.log(`Server: http://localhost:${port}`);
  });

  // ---------------------------------------------------------------
  // ස්වයංක්‍රීය scrape — දිනකට දෙපාරක් (default 09:30 + 21:30 Asia/Colombo)
  // + server එක start වෙද්දී දත්ත පරණ නම් එක පාරක් background එකේ.
  // සම්පූර්ණ logic එක scrape-runner.js එකේ (status එකත් එහෙන්ම ගන්නවා).
  // ---------------------------------------------------------------
  scrapeRunner.startScheduler();

  // graceful shutdown — DB file එක හරියට flush වෙන්න
  const shutdown = (signal) => {
    console.log(`\n${signal} — server නවත්තනවා...`);
    scrapeRunner.stopScheduler();
    server.close(() => { closeDb(); process.exit(0); });
    setTimeout(() => { closeDb(); process.exit(0); }, 5000).unref();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (IS_MAIN) startServer();

module.exports = {
  app, checkTicket, startServer, loadData, digitWidthOf,
  userPayload, requireAdmin, requirePremium,
};
