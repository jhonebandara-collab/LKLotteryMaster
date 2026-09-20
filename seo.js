/**
 * seo.js — Search Engine Optimization (server-rendered pages)
 *
 * ═══════════════════════════════════════════════════════════════════
 * ⚠️ ඇයි මේක ඕන?
 *    App එකේ ප්‍රධාන පිටුව SPA එකක් — ඒ කියන්නේ JavaScript එක run වෙන්නේ
 *    browser එකේ. Google එකට සම්පූර්ණ content එක එවලේම නොපෙනීම නිසා
 *    "ලංකා ලොටරි ප්‍රතිඵල" වගේ search එකකින් උඩට එන්න අමාරුයි.
 *
 *    ඒ නිසා මේ module එකෙන් **සේවාදායකයේදීම HTML හදලා** යවනවා:
 *      /lottery/:slug      → ලොතරැයියක ප්‍රතිඵල පිටුව (නවතම draw + පසුගිය draws)
 *      /results            → ඔක්කොම ලොතරැයි එක පිටුවක
 *      /about /how-to-use /privacy-policy /refund-policy
 *      /robots.txt /sitemap.xml
 *
 *    ඒ වගේම හැම පිටුවකම: title, meta description, keywords, canonical,
 *    Open Graph, Twitter card සහ JSON-LD (structured data) තියෙනවා.
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

const SITE_NAME = 'LK Lottery Master';
const SITE_NAME_SI = 'ලංකා ලොටරි මාස්ටර්';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function baseUrl(req) {
  const env = (process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (env && !/localhost|127\.0\.0\.1/.test(env)) return env;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  return proto + '://' + req.get('host');
}

/** ලොතරැයියක නම සිංහලෙන් + ඉංග්‍රීසියෙන් (search දෙකටම හම්බෙන්න) */
function names(lot) {
  return {
    si: lot.nameSi || lot.name,
    en: lot.name,
    provider: lot.provider === 'NLB' ? 'ජාතික ලොටරැයි මණ්ඩලය (NLB)' : 'සංවර්ධන ලොටරැයි මණ්ඩලය (DLB)',
  };
}

function fmtDateSi(d) {
  if (!d) return '';
  const months = ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි',
    'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (!m) return String(d);
  return m[3] + ' ' + months[Number(m[2]) - 1] + ' ' + m[1];
}

/* ------------------------------------------------------------------
   පොදු CSS — SEO පිටු තමන්ම හැඩගැහෙන විදිහට (external file එකක් ඕන නෑ)
   ------------------------------------------------------------------ */
const CSS = `
:root{--bg:#0f1420;--panel:#1a2530;--panel2:#161f29;--line:#26333f;--gold:#f1c40f;
--gold2:#d4ac0d;--text:#e8f1ff;--muted:#8b9bb0;--green:#2ecc71}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);
font-family:"Noto Sans Sinhala","Iskoola Pota","Segoe UI",system-ui,Arial,sans-serif;line-height:1.7}
.wrap{max-width:820px;margin:0 auto;padding:16px 14px 40px}
header.top{display:flex;align-items:center;gap:12px;padding:14px 0}
header.top img{width:52px;height:52px;border-radius:14px}
header.top a{color:var(--gold);text-decoration:none;font-weight:800;font-size:17px}
h1{font-size:23px;margin:6px 0 6px;color:var(--gold);line-height:1.4}
h2{font-size:17px;margin:22px 0 8px;color:var(--text)}
h3{font-size:14.5px;margin:16px 0 6px;color:var(--gold)}
p,li{font-size:14px;color:#c9d6e4}
.meta{font-size:12.5px;color:var(--muted)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin:14px 0}
.nums{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.num{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;
padding:0 8px;border-radius:12px;background:linear-gradient(135deg,var(--gold),var(--gold2));
color:#10161f;font-weight:800;font-size:17px}
.num.ltr{background:linear-gradient(135deg,#9fd8ff,#5aa9e6)}
.num.sup{background:linear-gradient(135deg,#c9f7d6,#63c98a)}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
th,td{padding:9px 6px;border-bottom:1px solid var(--line);text-align:right}
th:first-child,td:first-child{text-align:left}
th{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.4px}
.cta{display:block;text-align:center;background:linear-gradient(135deg,var(--gold),var(--gold2));
color:#10161f;font-weight:800;text-decoration:none;padding:15px;border-radius:14px;margin:18px 0;font-size:15px}
.links{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.links a{font-size:12.5px;color:var(--text);background:var(--panel2);border:1px solid var(--line);
border-radius:999px;padding:8px 12px;text-decoration:none}
nav.crumbs{font-size:12px;color:var(--muted);margin:4px 0 10px}
nav.crumbs a{color:var(--muted);text-decoration:none}
details{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:8px 0;background:var(--panel2)}
summary{cursor:pointer;font-weight:700;font-size:13.5px}
details p{margin:8px 0 0}
footer{margin-top:30px;border-top:1px solid var(--line);padding-top:16px;font-size:12px;color:var(--muted)}
footer a{color:var(--muted)}
.warn{background:rgba(241,196,15,.08);border-left:3px solid var(--gold);padding:10px 12px;
border-radius:0 10px 10px 0;margin:14px 0;font-size:12.5px;color:#ffe89a}
`;

/* ------------------------------------------------------------------
   පිටුවක උඩ කොටස — meta + OG + Twitter + JSON-LD
   ------------------------------------------------------------------ */
function head({ title, description, keywords, canonical, base, jsonLd }) {
  return `<!DOCTYPE html>
<html lang="si">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="keywords" content="${esc(keywords)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="#f1c40f">
<link rel="icon" href="/app-icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(base)}/icon-512.png">
<meta property="og:locale" content="si_LK">
<meta property="og:locale:alternate" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(base)}/icon-512.png">
<link rel="alternate" hreflang="si" href="${esc(canonical)}">
<style>${CSS}</style>
${(jsonLd || []).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head><body><div class="wrap">
<header class="top">
  <img src="/app-icon.svg" alt="${esc(SITE_NAME)}" width="52" height="52">
  <a href="/">${esc(SITE_NAME_SI)} — ${esc(SITE_NAME)}</a>
</header>`;
}

function foot(base, lotteries) {
  const links = (lotteries || [])
    .map(l => `<a href="/lottery/${esc(l.slug)}">${esc(l.nameSi || l.name)}</a>`).join('');
  return `<footer>
  <div class="links">${links}</div>
  <div class="links">
    <a href="/">📷 ටිකට් එක Scan කරන්න</a>
    <a href="/results">📋 ප්‍රතිඵල සියල්ල</a>
    <a href="/how-to-use">📘 භාවිතා කරන විදිය</a>
    <a href="/about">🏢 අප ගැන</a>
    <a href="/privacy-policy">🔒 රහස්‍යතා ප්‍රතිපත්තිය</a>
    <a href="/refund-policy">💳 මුදල් ආපසු ගැනීමේ ප්‍රතිපත්තිය</a>
  </div>
  <p>⚠️ මෙහි දක්වන ප්‍රතිඵල නිල ප්‍රතිඵල නොවේ. අවසන් තීරණයක් සඳහා NLB/DLB නිල මූලාශ්‍රය තහවුරු කරගන්න.
  ලොතරැයි දිනුම් අහඹු සිදුවීමක් බැවින්, භාවිතයෙන් සිදුවන කිසිදු මූල්‍යමය පාඩුවකට අපි වගකීමක් නොබාරගනිමු.</p>
  <p>© ${new Date().getFullYear()} ${esc(SITE_NAME)}</p>
</footer></div></body></html>`;
}

/* ------------------------------------------------------------------
   1) ලොතරැයියක ප්‍රතිඵල පිටුව
   ------------------------------------------------------------------ */
function drawNumbersHtml(d) {
  if (!d) return '';
  const parts = [];
  if (d.letter) parts.push(`<span class="num ltr" title="අකුර">${esc(d.letter)}</span>`);
  if (d.zodiac) parts.push(`<span class="num sup" title="රාශිය">${esc(d.zodiac)}</span>`);
  if (d.superNumber) parts.push(`<span class="num sup" title="Super Number">${esc(d.superNumber)}</span>`);
  for (const n of (d.numbers || [])) parts.push(`<span class="num">${esc(n)}</span>`);
  return `<div class="nums">${parts.join('')}</div>`;
}

function lotteryPage(lot, { base, lotteries }) {
  const n = names(lot);
  const latest = lot.draws[0] || {};
  const numsText = (latest.numbers || []).join(', ');
  const dateSi = fmtDateSi(latest.date);

  const title = `${n.si} ප්‍රතිඵල ${latest.date || ''} — ${n.en} Result Today | ${SITE_NAME}`;
  const description =
    `${n.si} (${n.en}) නවතම ප්‍රතිඵලය. Draw ${latest.drawNo || ''} · ${dateSi} · ඉලක්කම් ${numsText}` +
    (latest.letter ? ` · අකුර ${latest.letter}` : '') +
    `. පසුගිය draws ${lot.draws.length}ක් සහ ඔබේ ටිකට්පත්‍රය scan කර ප්‍රතිඵලය බලන්න.`;
  const keywords = [
    n.si + ' ප්‍රතිඵල', n.si, n.en + ' result', n.en, 'ලංකා ලොටරි ප්‍රතිඵල',
    'අද ලොතරැයි ප්‍රතිඵල', 'lottery results sri lanka', 'lanka lottery',
    lot.provider + ' results', 'අද ' + n.si, n.si + ' අද ප්‍රතිඵල',
  ].join(', ');
  const canonical = `${base}/lottery/${lot.slug}`;

  const rows = lot.draws.slice(0, 12).map(d => `<tr>
      <td>${esc(d.drawNo)}</td><td>${esc(d.date)}</td>
      <td>${esc(d.letter || '—')}</td>
      <td>${esc((d.numbers || []).join(' '))}</td></tr>`).join('');

  const faq = [
    ['හරි', `${n.si} ප්‍රතිඵලය කවදාද එළියට දාන්නේ?`,
      `${n.si} (${n.provider}) ප්‍රතිඵල නිල වශයෙන් නිකුත් වූ පසු, මෙම පිටුව ස්වයංක්‍රීයව යාවත්කාලීන වේ. දිනකට දෙපාරක් ප්‍රතිඵල ලබාගනී.`],
    ['හරි', `${n.si} ටිකට්පත්‍රය මගේද දිනුම්ද කියලා බලන්නේ කොහොමද?`,
      `ඉහළ ඇති "ටිකට් එක Scan කරන්න" බොත්තමෙන් ඔබගේ ටිකට්පත්‍රයේ ඡායාරූපයක් ගන්න, නැත්නම් අංක අතින් ඇතුළත් කරන්න. දිනුමක් ඇත්නම් ත්‍යාග මුදලද පෙන්වයි.`],
    ['හරි', `මෙහි පෙන්වන ප්‍රතිඵල නිල ප්‍රතිඵලද?`,
      `නොවේ. නිල වෙබ් අඩවිවලින් ලබාගත් ප්‍රතිඵලයි. කිසියම් වෙනසක් ඇත්නම් නිල ප්‍රතිඵල පත්‍රිකාවම බලපැවැත්වේ.`],
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: SITE_NAME, alternateName: SITE_NAME_SI, url: base + '/',
      inLanguage: 'si',
      potentialAction: {
        '@type': 'SearchAction',
        target: base + '/search?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'මුල් පිටුව', item: base + '/' },
        { '@type': 'ListItem', position: 2, name: 'ප්‍රතිඵල', item: base + '/results' },
        { '@type': 'ListItem', position: 3, name: n.si, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map(([, q, a]) => ({
        '@type': 'Question', name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ];

  return head({ title, description, keywords, canonical, base, jsonLd }) + `
<nav class="crumbs"><a href="/">මුල් පිටුව</a> › <a href="/results">ප්‍රතිඵල</a> › ${esc(n.si)}</nav>
<h1>${esc(n.si)} ප්‍රතිඵල ${esc(latest.date || '')}</h1>
<p class="meta">${esc(n.en)} · ${esc(n.provider)} · Draw අංකය ${esc(latest.drawNo || '—')} · ${esc(dateSi)}</p>

<div class="card">
  <h2 style="margin-top:0">නවතම ප්‍රතිඵලය${latest.letter ? ` — අකුර ${esc(latest.letter)}` : ''}</h2>
  ${drawNumbersHtml(latest)}
  <p class="meta">ඉලක්කම්: ${esc(numsText) || '—'}${latest.zodiac ? ' · රාශිය: ' + esc(latest.zodiac) : ''}${
    latest.superNumber ? ' · Super Number: ' + esc(latest.superNumber) : ''}</p>
</div>

<a class="cta" href="/">📷 ඔබේ ටිකට්පත්‍රය Scan කරලා දිනුම බලන්න — නොමිලේ</a>

<h2>පසුගිය ${n.si} ප්‍රතිඵල</h2>
<div class="card" style="padding:8px 12px">
  <table>
    <thead><tr><th>Draw</th><th>දිනය</th><th>අකුර</th><th>ඉලක්කම්</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">දත්ත නොමැත</td></tr>'}</tbody>
  </table>
</div>

<h2>නිතර අසන ප්‍රශ්න</h2>
${faq.map(([, q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}

<div class="warn">⚠️ මෙම පිටුවේ ඇති තොරතුරු NLB/DLB නිල වෙබ් අඩවිවලින් ලබාගත් ඒවා වන අතර
නිල ප්‍රතිඵල ලේඛනයක් නොවේ. ලොතරැයි දිනුම් සම්පූර්ණයෙන්ම අහඹු බැවින්, භාවිතයෙන් සිදුවන කිසිදු
මූල්‍යමය පාඩුවකට මෙම යෙදුම වගකීමක් නොබාරගනී.</div>
` + foot(base, lotteries);
}

/* ------------------------------------------------------------------
   2) ප්‍රතිඵල සියල්ල (index)
   ------------------------------------------------------------------ */
function resultsPage(all, { base, lotteries }) {
  const cards = all.map(l => {
    const d = l.draws[0] || {};
    const n = names(l);
    return `<div class="card">
      <h2 style="margin-top:0"><a href="/lottery/${esc(l.slug)}" style="color:var(--gold);text-decoration:none">${esc(n.si)} ප්‍රතිඵල</a></h2>
      <p class="meta">${esc(n.en)} · Draw ${esc(d.drawNo || '—')} · ${esc(d.date || '')}</p>
      ${drawNumbersHtml(d)}
    </div>`;
  }).join('');

  const title = `ශ්‍රී ලංකා ලොතරැයි ප්‍රතිඵල එකම තැනකින් | Sri Lanka Lottery Results | ${SITE_NAME}`;
  const description = `NLB සහ DLB ලොතරැයි ${all.length}ක නවතම ප්‍රතිඵල. මහජන සම්පත්, ගොවිසෙත, අද කොටිපති, ජය සම්පත්, සුපිරි ධන සම්පත් ඇතුළු සියලු ප්‍රතිඵල.`;
  const keywords = ['ලංකා ලොටරි ප්‍රතිඵල', 'අද ලොතරැයි ප්‍රතිඵල', 'NLB ප්‍රතිඵල', 'DLB ප්‍රතිඵල',
    'lanka lottery results', 'sri lanka lottery result today', 'lottery sri lanka', 'ලොටරි ප්‍රතිඵල'].join(', ');

  return head({
    title, description, keywords, canonical: base + '/results', base,
    jsonLd: [{
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: 'ශ්‍රී ලංකා ලොතරැයි ප්‍රතිඵල',
      itemListElement: all.map((l, i) => ({
        '@type': 'ListItem', position: i + 1,
        name: (l.nameSi || l.name) + ' ප්‍රතිඵල',
        url: base + '/lottery/' + l.slug,
      })),
    }],
  }) + `
<nav class="crumbs"><a href="/">මුල් පිටුව</a> › ප්‍රතිඵල</nav>
<h1>ශ්‍රී ලංකා ලොතරැයි ප්‍රතිඵල — අද</h1>
<p>NLB (ජාතික ලොතරැයි මණ්ඩලය) සහ DLB (සංවර්ධන ලොතරැයි මණ්ඩලය) ලොතරැයි
${all.length}ක නවතම ප්‍රතිඵල පහතින්. ඔබේ ටිකට්පත්‍රය දිනුම්ද කියලා දැනගන්න එක බොත්තමකින්.</p>
<a class="cta" href="/">📷 ටිකට්පත්‍රය Scan කරන්න</a>
${cards}
` + foot(base, lotteries);
}

/* ------------------------------------------------------------------
   3) ස්ථිතික පිටු (about / how-to-use / privacy / refund)
   ------------------------------------------------------------------ */
const STATIC_PAGES = {
  about: {
    title: `අප ගැන | ${SITE_NAME} — ශ්‍රී ලංකා ලොතරැයි ප්‍රතිඵල යෙදුම`,
    description: 'LK Lottery Master යනු NLB සහ DLB ලොතරැයි ප්‍රතිඵල එක තැනකින් බැලීමට සහ ටිකට්පත්‍රය scan කර දිනුම පරීක්ෂා කිරීමට සකසන ලද ස්වාධීන නොමිලේ යෙදුමකි.',
    keywords: 'ලංකා ලොටරි යෙදුම, lottery app sri lanka, ලොතරැයි ප්‍රතිඵල යෙදුම',
    body: `
<h1>අප ගැන</h1>
<p><strong>${SITE_NAME}</strong> යනු ශ්‍රී ලංකාවේ NLB (ජාතික ලොතරැයි මණ්ඩලය) සහ
DLB (සංවර්ධන ලොතරැයි මණ්ඩලය) ලොතරැයි ප්‍රතිඵල එකම තැනකින් බැලීමට සකසන ලද
ස්වාධීන වෙබ් යෙදුමකි.</p>
<p>නිල වෙබ් අඩවිවලින් ප්‍රතිඵල ස්වයංක්‍රීයව ලබාගෙන (දිනකට දෙපාරක්),
ඒවා නිල ලොතරැයි ව්‍යුහයට අනුව විශ්ලේෂණය කර ඔබගේ ටිකට්පත්‍රය දිනුම්ද නැද්ද යන්න
වහාම පෙන්වීම මෙහි ප්‍රධාන අරමුණයි.</p>
<div class="warn">මෙය <strong>NLB හෝ DLB සමඟ කිසිදු සම්බන්ධයක් නොමැති ස්වාධීන
යෙදුමකි</strong>. ඒවායේ නිල නිවේදන, ලාංඡන හෝ සේවාවන්ට මෙය නියෝජනය නොකරයි.</div>
<h2>අපගේ කැපවීම</h2>
<ul>
<li>නවතම ප්‍රතිඵල දිනකට දෙපාරක් ස්වයංක්‍රීයව යාවත්කාලීන කිරීම</li>
<li>ඔබගේ ඡායාරූප කිසිවිටෙක සුරකින්නේ නොමැත</li>
<li>නොමිලේ මූලික අංග — සැඟවුණු ගාස්තු නොමැත</li>
</ul>`,
  },
  'how-to-use': {
    title: `භාවිතා කරන විදිය | ${SITE_NAME}`,
    description: 'ටිකට්පත්‍රය QR scan කිරීම, සම්පූර්ණ ටිකට් එක scan කිරීම, අතින් පරීක්ෂා කිරීම සහ ලොතරැයි ප්‍රතිඵල බැලීම — පියවරෙන් පියවර උපදෙස්.',
    keywords: 'ලොතරැයි ටිකට් පරීක්ෂා කරන විදිය, lottery ticket check sri lanka, QR scan ලොතරැයි',
    body: `
<h1>භාවිතා කරන විදිය</h1>
<h3>1. 🔳 QR Scan</h3>
<p>ටිකට්පත්‍රයේ ඇති QR කේතය කැමරාවට ලබා දෙන්න. කේතය කුඩා බැවින්
<strong>කැමරාවට හැකි තරම් කිට්ටු කිරීම</strong> වැදගත්. කහ රාමුව ඇතුළේ QR එක තිබ්බොත්
යෙදුම තනියම කියවාගෙන ප්‍රතිඵලය පෙන්වයි. දිනුමක් ඇත්නම් ශබ්දයෙන්ද දන්වයි.</p>
<h3>2. 🎟️ Total Lottery Scan</h3>
<p>සම්පූර්ණ ටිකට්පත්‍රයේ ඡායාරූපයක් ගන්න — කැමරාවෙන්, දුරකථනයේ කැමරා
යෙදුමෙන් හෝ ගැලරියෙන්. රාමුව ඇතුළේ ටිකට්පත්‍රය තබන්න; අනවශ්‍ය කොටස්
ස්වයංක්‍රීයව ඉවත් වේ.</p>
<div class="warn">⚠️ ඡායාරූපය අපැහැදිලි නම් හෝ හානි වී තිබේ නම් යෙදුම
<strong>ප්‍රතිඵලයක් නිකුත් නොකරයි</strong> — ඒ වෙනුවට අතින් පරීක්ෂාව භාවිතා කරන ලෙස දන්වයි.</div>
<h3>3. 🎟️ අතින් පරීක්ෂාව</h3>
<p>ලොතරැයිය තෝරා අංක ටයිප් කරන්න. <strong>Calendar එකෙන් දිනයක්</strong> තෝරා
එම දිනයේ ප්‍රතිඵලය සමඟ සැසඳිය හැක.</p>
<h3>4. 📋 ප්‍රතිඵල · 🕘 මගේ වාර්තා · 🍀 අනුමානය</h3>
<p>සියලු ලොතරැයි ප්‍රතිඵල, ඔබගේ පරීක්ෂාවන්හි ඉතිහාසය සහ (Premium) පසුගිය
ප්‍රතිඵලවල සංඛ්‍යාලේශනික විශ්ලේෂණය මත පදනම් වූ අනුමාන අංගය.</p>
<div class="warn">🍀 අනුමාන අංගය <strong>විනෝදාත්මක එකකි</strong>. ලොතරැයි අංක අහඹු
බැවින් කිසිදු අනුමානයකින් දිනුමක් සහතික කළ නොහැක.</div>`,
  },
  'privacy-policy': {
    title: `රහස්‍යතා ප්‍රතිපත්තිය | ${SITE_NAME}`,
    description: 'අප රැස් කරන දත්ත, තෙවන පාර්ශ්ව සේවා, cookies සහ ඔබගේ දත්ත ඉවත් කරන ලෙස ඉල්ලීම — සම්පූර්ණ රහස්‍යතා ප්‍රතිපත්තිය.',
    keywords: 'රහස්‍යතා ප්‍රතිපත්තිය, privacy policy, දත්ත ආරක්ෂාව',
    body: `
<h1>රහස්‍යතා ප්‍රතිපත්තිය</h1>
<h3>1. අප රැස් කරන තොරතුරු</h3>
<ul>
<li>ගිණුමක් සාදන විට: නම, ඊමේල් ලිපිනය සහ hash කරන ලද මුරපදය.</li>
<li>ගිණුමක් සමඟ පිවිසුණු විට: ඔබ සිදු කරන පරීක්ෂාවන් (ලොතරැයිය, draw, දිනය, ඉලක්කම්, ප්‍රතිඵලය).</li>
<li>🍀 අනුමාන අංගය: නම, උපන් දිනය සහ උපන් වේලාව (ගණනය සඳහා පමණි).</li>
<li><strong>ඡායාරූප කිසිවිටෙක ගබඩා නොකරයි</strong> — කියවා ප්‍රතිඵලය දී එසැණින් ඉවත් වේ.</li>
</ul>
<h3>2. තෙවන පාර්ශ්ව සේවා</h3>
<ul>
<li>Google Gemini API — ඡායාරූපය කියවීමට පමණක්.</li>
<li>PayHere — ගෙවීම් සැකසීමට.</li>
<li>Google Identity Services — Google පිවිසුමට.</li>
</ul>
<p>අපි දත්ත කිසිවිටෙක විකුණන්නේ නොවේ.</p>
<h3>3. Cookies සහ දේශීය ගබඩාව</h3>
<p>පිවිසුම් token, සැකසුම් සහ දැන්වීම් සංඛ්‍යාව සුරැකීමට ඔබගේ browser එකේ
localStorage භාවිතා වේ.</p>
<h3>4. දත්ත ඉවත් කිරීම</h3>
<p>ඔබගේ ගිණුම සහ අදාළ සියලු දත්ත ඉවත් කරන ලෙස ඉල්ලා සිටිය හැක.</p>
<h3>5. වයස් සීමාව</h3>
<p>වයස අවුරුදු 18ට වැඩි අයට පමණි.</p>
<p class="meta">අවසන් යාවත්කාලීනය: 2026</p>`,
  },
  'refund-policy': {
    title: `මුදල් ආපසු ගැනීමේ ප්‍රතිපත්තිය | ${SITE_NAME}`,
    description: 'දායකත්ව ගෙවීම්, මුදල් ආපසු ගැනීමේ කොන්දේසි සහ ලොතරැයි ප්‍රතිඵල සම්බන්ධ වගකීම් ප්‍රතික්ෂේප කිරීම.',
    keywords: 'refund policy, මුදල් ආපසු, වගකීම් ප්‍රතික්ෂේප',
    body: `
<h1>මුදල් ආපසු ගැනීමේ ප්‍රතිපත්තිය</h1>
<h3>1. ගෙවීම්</h3>
<p>මූලික අංග සම්පූර්ණයෙන්ම නොමිලේ. අමතර සීමා ඉක්මවා භාවිතා කිරීමට ඇති
දායකත්ව පැකේජ (Rs. 100 / 500 / 1000) ස්වේච්ඡාවෙන් ලබා ගන්නා සේවාවකි.</p>
<h3>2. ආපසු ගැනීම</h3>
<ul>
<li>ගෙවීමෙන් පසු පැය 24 ඇතුළත සහ සේවාව භාවිතා නොකර ඇත්නම් — සම්පූර්ණයෙන්ම ආපසු.</li>
<li>සේවාව භාවිතා කර ඇත්නම් — එම දිනයන්හි පිරිවැය අඩු කර සමතුලිත මුදල.</li>
<li>තාක්ෂණික දෝෂයක් නිසා භාවිතා කළ නොහැකි වූයේ නම් — පැය 72ක් ඇතුළත දැනුම් දුන් විට සම්පූර්ණ මුදල.</li>
<li>වැඩ කරන දින 7-14ක් ඇතුළත එම ක්‍රමයටම බැර කෙරේ.</li>
</ul>
<h3>3. ⚠️ වගකීම් ප්‍රතික්ෂේප කිරීම</h3>
<div class="warn">
<p><strong>ලොතරැයි දිනුම් සම්පූර්ණයෙන්ම අහඹු සිදුවීමකි.</strong> මෙම යෙදුමෙන් ලබා
දෙන ප්‍රතිඵල, විශ්ලේෂණ, සංඛ්‍යාලේඛන හෝ 🍀 අනුමාන කිසිවක් <strong>දිනුම් ලැබීමට
සහතිකයක් නොවේ</strong>.</p>
<p>මෙම යෙදුම භාවිතා කිරීම නිසා සිදු වන කිසිදු <strong>මූල්‍යමය පාඩුවකට, අහිමි වූ
අවස්ථාවකට හෝ වෙනත් කිසිදු හානියකට අපි කිසිදු වගකීමක් හෝ වන්දියක්
නොබාරගනිමු</strong>. යෙදුම භාවිතා කිරීමෙන් ඔබ මෙය පිළිගන්නා බව සැලකේ.</p>
<p>ටිකට්පත්‍රයක් මිලදී ගැනීම, එය රැක තබා ගැනීම සහ ත්‍යාග ලබා ගැනීම සම්බන්ධ සියලු
වගකීම සම්පූර්ණයෙන්ම පරිශීලකයා සතුය. අවසන් අධිකාරිය <strong>NLB / DLB පමණක්</strong> වේ.</p>
</div>
<p class="meta">අවසාන යාවත්කාලීනය: 2026</p>`,
  },
};

function staticPage(key, { base, lotteries }) {
  const p = STATIC_PAGES[key];
  if (!p) return null;
  const canonical = `${base}/${key}`;
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'WebPage',
      name: p.title, description: p.description, url: canonical, inLanguage: 'si',
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: base + '/' },
    },
    {
      '@context': 'https://schema.org', '@type': 'Organization',
      name: SITE_NAME, url: base + '/', logo: base + '/icon-512.png',
    },
  ];
  return head({
    title: p.title, description: p.description, keywords: p.keywords,
    canonical, base, jsonLd,
  }) + `<nav class="crumbs"><a href="/">මුල් පිටුව</a> › ${esc(p.title.split('|')[0].trim())}</nav>`
    + p.body + foot(base, lotteries);
}

/* ------------------------------------------------------------------
   4) robots.txt + sitemap.xml
   ------------------------------------------------------------------ */
function robotsTxt(base) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    '',
    'Sitemap: ' + base + '/sitemap.xml',
    '',
  ].join('\n');
}

function sitemapXml(all, { base }) {
  const now = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: base + '/', p: '1.0', f: 'daily' },
    { loc: base + '/results', p: '0.95', f: 'daily' },
    { loc: base + '/how-to-use', p: '0.7', f: 'monthly' },
    { loc: base + '/about', p: '0.5', f: 'monthly' },
    { loc: base + '/privacy-policy', p: '0.3', f: 'yearly' },
    { loc: base + '/refund-policy', p: '0.3', f: 'yearly' },
  ].concat(all.map(l => ({ loc: base + '/lottery/' + l.slug, p: '0.9', f: 'daily' })));

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${esc(u.loc)}</loc><lastmod>${now}</lastmod>` +
      `<changefreq>${u.f}</changefreq><priority>${u.p}</priority></url>`).join('\n') +
    '\n</urlset>\n';
}

module.exports = {
  lotteryPage, resultsPage, staticPage, robotsTxt, sitemapXml,
  STATIC_PAGES, baseUrl, esc, fmtDateSi, SITE_NAME,
};
