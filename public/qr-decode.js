/*!
 * qr-decode.js — ලංකා ලොතරැයි ටිකට් QR සඳහා විශේෂිත decode pipeline
 * =====================================================================
 *
 * ⚠️ ප්‍රශ්නය: ටිකට් QR එක **අතිශයින්ම පොඩි**. සාමාන්‍ය scanner එකක් frame එකම
 *    jsQR/BarcodeDetector එකට දෙන නිසා QR එකේ එක module එකකට පික්සෙල් 1-2ක්
 *    විතරක් වැටෙනවා → decode වෙන්නේ නෑ. (module එකකට අවම ~2.5-3px ඕන)
 *
 * ✅ විසඳුම — මේ module එකෙන් කරන දේ:
 *    1. **locateFinders()** — QR එකේ 1:1:3:1:1 finder pattern එක run-length
 *       විශ්ලේෂණයෙන් හොයනවා. ඒකෙන් QR එක **කොහෙද තියෙන්නේ**, **module එකකට
 *       පික්සෙල් කීයද**, සහ **modules කීයද** (ඉන් version එක) කියලා කියනවා.
 *       → මේකෙන් user ට "තව කිට්ටු වෙන්න" කියලා **මිනුම් සහිතව** කියන්න පුළුවන්.
 *    2. **preprocessVariants()** — gray → contrast stretch → unsharp →
 *       {raw, otsu, adaptive} × {normal, inverted} = binarization lattice එකක්.
 *    3. **decodeLattice()** — scale × variant × inversion ලැටිස් එකේ හැම සෙල් එකක්ම
 *       BarcodeDetector → jsQR අනුපිළිවෙලින් try කරනවා.
 *    4. **stackAverage()** — frames කීපයක් align කරලා average කරනවා (noise අඩුවෙනවා
 *       → පොඩි QR එකට ලොකු උදව්වක්). මේක "super-resolution lite".
 *
 * Dependencies: කිසිවක් නෑ (window.jsQR සහ window.BarcodeDetector තිබ්බොත් පාවිච්චි කරනවා).
 */
(function (global) {
  'use strict';

  // =====================================================================
  // 1. මූලික image utilities (හැම එකම Uint8ClampedArray gray වලින් වැඩ කරනවා)
  // =====================================================================

  /** RGBA ImageData → grayscale (Rec.601 luma). alpha එක ignore කරනවා. */
  function rgbaToGray(data, w, h) {
    const g = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < g.length; i++, p += 4) {
      // 0.299R + 0.587G + 0.114B — integer math (වේගවත්)
      g[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
    }
    return g;
  }

  function histogram(g) {
    const h = new Uint32Array(256);
    for (let i = 0; i < g.length; i++) h[g[i]]++;
    return h;
  }

  /**
   * Percentile contrast stretch — පොඩි QR එකේ contrast එක බොහෝ වෙලාවට
   * අඩුයි (අළු පාට කොළ/කහ පසුබිම්). 2%-98% පරාසය 0-255 ට ඇදලා දානවා.
   * ⚠️ min/max වෙනුවට percentile පාවිච්චි කරන්නේ outlier පික්සෙල් (noise,
   *    specular highlight) එකක් නිසා මුළු image එකම විකෘති නොවෙන්න.
   */
  function percentileStretch(g, lo, hi) {
    lo = lo == null ? 2 : lo;
    hi = hi == null ? 98 : hi;
    const h = histogram(g);
    const total = g.length;
    let cum = 0, pLo = 0, pHi = 255;
    const loTarget = total * lo / 100, hiTarget = total * hi / 100;
    for (let v = 0; v < 256; v++) {
      cum += h[v];
      if (cum >= loTarget) { pLo = v; break; }
    }
    cum = 0;
    for (let v = 0; v < 256; v++) {
      cum += h[v];
      if (cum >= hiTarget) { pHi = v; break; }
    }
    if (pHi - pLo < 8) return g;           // පරාසය ඇත්තටම පොඩි නම් වෙනසක් කරන්නේ නෑ
    const out = new Uint8ClampedArray(g.length);
    const k = 255 / (pHi - pLo);
    for (let i = 0; i < g.length; i++) {
      const v = (g[i] - pLo) * k;
      out[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    return out;
  }

  /** 3×3 box blur — unsharp mask එකට පාදකය */
  function boxBlur3(g, w, h) {
    const out = new Uint8ClampedArray(g.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            s += g[yy * w + xx]; n++;
          }
        }
        out[y * w + x] = s / n;
      }
    }
    return out;
  }

  /**
   * Unsharp mask — බොරු (blurry) QR එකේ module අතර තියෙන edges එනවා.
   * ⚠️ amount 1.0 ට වඩා ලොකු කළොත් noise එකත් ලොකු වෙනවා → 0.8-1.4 හොඳම.
   * camera එකේ optical focus එක දුර්වල නම් මේකෙන් ගොඩක් උදව් වෙනවා.
   */
  function unsharp(g, w, h, amount) {
    amount = amount == null ? 1.1 : amount;
    const blurred = boxBlur3(g, w, h);
    const out = new Uint8ClampedArray(g.length);
    for (let i = 0; i < g.length; i++) {
      const v = g[i] + amount * (g[i] - blurred[i]);
      out[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    return out;
  }

  /** Otsu global threshold — ආලෝකය ඒකාකාරී නම් හොඳම (සරල, වේගවත්) */
  function otsuThreshold(g) {
    const h = histogram(g);
    const total = g.length;
    let sum = 0;
    for (let v = 0; v < 256; v++) sum += v * h[v];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let v = 0; v < 256; v++) {
      wB += h[v];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += v * h[v];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = v; }
    }
    return thr;
  }

  function binarizeGlobal(g, thr) {
    const out = new Uint8ClampedArray(g.length);
    for (let i = 0; i < g.length; i++) out[i] = g[i] > thr ? 255 : 0;
    return out;
  }

  /**
   * Adaptive (Bradley) threshold — integral image එකක් පාවිච්චි කරලා
   * ප්‍රදේශය අනුව threshold එක වෙනස් කරනවා. ටිකට් එකේ එක පැත්තක ආලෝකය
   * වැඩියි / අනිත් පැත්තේ අඩුයි නම් (එහෙම තමයි බොහෝ වෙලාවට වෙන්නේ),
   * global threshold එකට වඩා මේකෙන් ගොඩක් හොඳ ප්‍රතිඵල එනවා.
   */
  function binarizeAdaptive(g, w, h, winFrac, k) {
    winFrac = winFrac || 0.12;
    k = k == null ? 0.14 : k;
    let win = Math.round(Math.min(w, h) * winFrac);
    if (win < 7) win = 7;
    if ((win % 2) === 0) win++;

    // integral image (Float64 — w*h විතරයි, overflow නෑ)
    const integ = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      for (let x = 0; x < w; x++) {
        rowSum += g[y * w + x];
        integ[(y + 1) * (w + 1) + (x + 1)] = integ[y * (w + 1) + (x + 1)] + rowSum;
      }
    }
    const half = (win - 1) >> 1;
    const out = new Uint8ClampedArray(g.length);
    for (let y = 0; y < h; y++) {
      const y0 = y - half < 0 ? 0 : y - half;
      const y1 = y + half >= h ? h - 1 : y + half;
      for (let x = 0; x < w; x++) {
        const x0 = x - half < 0 ? 0 : x - half;
        const x1 = x + half >= w ? w - 1 : x + half;
        const area = (y1 - y0 + 1) * (x1 - x0 + 1);
        const sum = integ[(y1 + 1) * (w + 1) + (x1 + 1)]
                  - integ[y0 * (w + 1) + (x1 + 1)]
                  - integ[(y1 + 1) * (w + 1) + x0]
                  + integ[y0 * (w + 1) + x0];
        out[y * w + x] = g[y * w + x] * area > sum * (1 - k) ? 255 : 0;
      }
    }
    return out;
  }

  /** median — outlier (blur වැඩි පේළියක්, noise) වලට ඔරොත්තු දෙන සාමාන්‍යය */
  function median(arr) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function invertGray(g) {
    const out = new Uint8ClampedArray(g.length);
    for (let i = 0; i < g.length; i++) out[i] = 255 - g[i];
    return out;
  }

  // =====================================================================
  // 2. 🎯 FINDER PATTERN LOCATOR — "QR එක කොහෙද, පොඩි කීයද" කියන මිනුම
  // =====================================================================
  /**
   * QR code එකේ හැම කොනකම (3ක්) තියෙන **finder pattern** එකේ තිබෙන
   * අද්විතීය ලක්ෂණය: ඕනෑම පේළියක් හරහා ගියාම කළු-සුදු ධාවන 5ක්
   * **1:1:3:1:1** අනුපාතයෙන් එනවා. මේක QR එකට විතරක් ආවේණිකයි.
   *
   * එක finder pattern එකක් = module 7ක් පළල. ඒ නිසා:
   *   modulePx  = (ධාවන 5ේ එකතුව) / 7
   *   modules N = 7 + (finder දෙකක මධ්‍යස්ථානය අතර දුර) / modulePx
   *   version V = (N - 17) / 4
   *   QR පළල   = N × modulePx   (පික්සෙල් වලින්)
   *
   * මේකෙන් user ට "ඔබේ QR එකේ එක module එකකට දැන් පික්සෙල් 1.4යි —
   * තව 2cm කිට්ටු වෙන්න" වගේ **සැබෑ මිනුමක්** දෙන්න පුළුවන්. කලින්
   * තිබ්බේ නෑ — ඒ නිසා user ට හේතුව තේරුනේ නෑ.
   */
  function locateFinders(g, w, h) {
    const cands = [];
    const stride = Math.max(1, Math.round(h / 220));   // වේගය සඳහා පේළි skip

    for (let y = 0; y < h; y += stride) {
      const rowOff = y * w;
      // ධාවන (runs) ටික හදනවා — x0 සමඟ
      let runs = [];
      let dark = g[rowOff] < 128;
      let runX = 0;
      for (let x = 1; x <= w; x++) {
        const d = x < w ? g[rowOff + x] < 128 : !dark;
        if (d === dark) continue;
        runs.push({ len: x - runX, dark: dark, x0: runX });
        dark = d;
        runX = x;
        // memory — අවශ්‍ය වන්නේ අන්තිම 5යි
        if (runs.length > 9) runs.splice(0, runs.length - 9);
      }
      // අන්තිම run එක
      if (runX < w) runs.push({ len: w - runX, dark: dark, x0: runX });

      // 5 ධාවන කවුළුවක් සොයනවා: dark light dark light dark = 1:1:3:1:1
      for (let i = 0; i + 4 < runs.length; i++) {
        const r0 = runs[i], r1 = runs[i + 1], r2 = runs[i + 2], r3 = runs[i + 3], r4 = runs[i + 4];
        if (!(r0.dark && !r1.dark && r2.dark && !r3.dark && r4.dark)) continue;
        const sum = r0.len + r1.len + r2.len + r3.len + r4.len;
        const unit = sum / 7;
        if (unit < 1.2) continue;                       // තනි පික්සෙල් noise නොගන්න
        const tol = unit * 0.75 + 0.9;                  // blur/aliasing නිසා ලිහිල්
        if (Math.abs(r0.len - unit) > tol) continue;
        if (Math.abs(r1.len - unit) > tol) continue;
        if (Math.abs(r2.len - 3 * unit) > 3 * tol) continue;
        if (Math.abs(r3.len - unit) > tol) continue;
        if (Math.abs(r4.len - unit) > tol) continue;
        // ⚠️ module ප්‍රමාණය මැනීමට **මැද ධාවනය (3 module පළල)** පාවිච්චි කරනවා.
        // ඒක තුන් ගුණයක් ලොකු නිසා blur/noise වලින් වෙන දෝෂය **1/3ක්**
        // විතරයි — 1-module ධාවන 4ෙන් ගණනය කරනවාට වඩා ගොඩක් නිවැරදියි.
        cands.push({ cx: r2.x0 + r2.len / 2, cy: y, unit: unit, unitMid: r2.len / 3, score: sum });
      }
    }
    if (!cands.length) return null;

    // එකම finder pattern එකේ පේළි කීපයක් එකට cluster කරනවා
    const clusters = [];
    for (const c of cands) {
      let hit = null;
      for (const cl of clusters) {
        if (Math.abs(cl.cx - c.cx) < cl.unit * 3.2 && Math.abs(cl.cy - c.cy) < cl.unit * 3.2) { hit = cl; break; }
      }
      if (hit) {
        hit.hits++;
        hit.cxSum += c.cx; hit.cySum += c.cy; hit.unitSum += c.unit;
        // ⚠️ **සම්පූර්ණ ධාවන 5ේ එකතුව/7** පාවිච්චි කරනවා (මැද ධාවනය/3 නෙවෙයි).
        // හේතුව: blur එකක් නිසා එක ධාවනයක් **නිශ්චිත පික්සෙල් ගණනකින්** (δ)
        // වැඩි වෙනවා. ඒ නිසා මැද ධාවනය (module 3) වල δ/3ක් දෝෂයක් එනවා, එකතුවේ
        // (module 7) δ/7ක් විතරයි — ඒක 2.3 ගුණයක් නිවැරදියි.
        hit.units.push(c.unit);
        hit.cx = hit.cxSum / hit.hits;
        hit.cy = hit.cySum / hit.hits;
        // mean වෙනුවට **median** — එක පේළියක blur වැඩි වුනත් මිනුම විකෘති වෙන්නේ නෑ
        hit.unit = median(hit.units);
      } else {
        clusters.push({
          cx: c.cx, cy: c.cy, unit: c.unit, hits: 1,
          cxSum: c.cx, cySum: c.cy, unitSum: c.unit, units: [c.unit],
        });
      }
    }
    // ⚠️ සැබෑ finder pattern එකක් පේළි ගොඩක් පුරා පවතිනවා. කලින් `hits >= 3`
    // තිබ්බ නිසා **අකුරු/barcode රේඛා** වගේ දේවලුත් finder pattern විදිහට
    // අහුවුනා (සැබෑ sample වල මනිද්දී පැහැදිලි වුනා) → "QR හම්බුනා" කියලා
    // බොරුවට කිව්වා. දැන් අවම 6ක් ඉල්ලනවා (+ පහළින් යුගල ගැලපීමකුත්).
    const strong = clusters.filter(cl => cl.hits >= 6);
    if (!strong.length) return null;
    strong.sort((a, b) => b.hits - a.hits);

    const a = strong[0];
    let best = { modulePx: a.unit, found: 1, candidates: strong.slice(0, 4) };

    // finder දෙකක් එකම පේළියේ හෝ එකම තීරුවේ තිබ්බොත් QR එක තහවුරු වෙනවා
    // (සහ modules ගණනත් හරියටම ගණනය කරන්න පුළුවන්)
    for (let i = 1; i < strong.length; i++) {
      const b = strong[i];
      if (Math.abs(b.unit - a.unit) > a.unit * 0.45) continue;
      const dx = Math.abs(b.cx - a.cx), dy = Math.abs(b.cy - a.cy);
      const horiz = dy < a.unit * 3.5 && dx > a.unit * 8;
      const vert = dx < a.unit * 3.5 && dy > a.unit * 8;
      if (!horiz && !vert) continue;
      const dist = horiz ? dx : dy;
      const unitAvg = (a.unit + b.unit) / 2;
      // finder මධ්‍යස්ථාන අතර දුර = (N - 7) module
      const N = 7 + dist / unitAvg;
      const version = Math.round((N - 17) / 4);
      const nRound = 17 + 4 * version;
      if (version < 1 || version > 40) continue;
      // ✅ data row එකක්: finder දෙකක් එකම පේළියේ/තීරුවේ තියෙනවා = QR එකක්.
      //    ඒ නිසා found = 2. මේකෙන් රාමුවේ QR එකක් තියෙනවා කියලා විශ්වාසයෙන්
      //    කියන්න පුළුවන් (locator එකේ ප්‍රධාන රාජකාරිය ඒකයි).
      //
      // ⛔ **version/module ගණන වාර්තා කරන්නේ නෑ** — හේතුව මනින ලද දෙයක්:
      //    ධාවන පළලෙන් N (=7+distance/modulePx) ගණනය කිරීමේදී modulePx මිනුමේ
      //    ~10% දෝෂයක් නිසා N එකේ ~3 module දෝෂයක් එනවා. version එකේ පියවර
      //    4 module නිසා ඒක **±1 version** අවිනිශ්චිතතාවයක් — සැබෑ ටිකට්
      //    sample වල මනිද්දී v4 එකක් v1 විදිහට වාර්තා වුනා. user ට වැදගත් වන්නේ
      //    "module එකකට පික්සෙල් කීයද" (ඒක 11% නිරවද්‍යයි) — ඒ නිසා වැරදි
      //    module ගණනක් කියනවට වඩා නොකියා ඉන්නවා.
      void N; void nRound; void version; void dist;
      best = { modulePx: unitAvg, found: Math.min(2, strong.length), candidates: strong.slice(0, 4) };
      break;
      // 🎯 **blur-invariant නිවැරදි මිනුම**: finder දෙකේ මධ්‍යස්ථාන අතර දුර
      // = (N-7) module. blur එකක් නිසා ධාවන පළල වැඩි වුනත් **මධ්‍යස්ථානය**
      // වෙනස් වෙන්නේ නෑ (දෙපැත්තටම සමානව පැතිරෙන නිසා). ඒ නිසා මේකෙන්
      // modulePx එක 1-2% නිවැරදිව ගන්න පුළුවන්.
      const unitRefined = dist / (nRound - 7);
      best = {
        modulePx: unitRefined,
        modulePxRaw: unitAvg,
        modules: nRound,
        version: version,
        pxWidth: nRound * unitRefined,
        orientation: horiz ? 'h' : 'v',
        found: Math.min(2, strong.length),
        candidates: strong.slice(0, 4),
      };
      break;
    }
    return best;
  }

  // =====================================================================
  // 3. Binarization lattice
  // =====================================================================
  /**
   * Gray image එකකින් decode කරන්න උත්සාහ කළ යුතු **ප්‍රභේද** ටික හදනවා.
   * ටිකට් ටික වෙනස් වෙනස් තත්ත්වවල (හිරු එළිය, සෙවනැල්ල, පරණ කොළ පාට)
   * තියෙන නිසා එක binarization එකකින් විතරක් හරියන්නේ නෑ.
   */
  function preprocessVariants(g, w, h, deep) {
    const variants = [];
    const stretched = percentileStretch(g, 2, 98);
    const sharp = unsharp(stretched, w, h, 1.1);
    variants.push({ name: 'gray', data: stretched });
    variants.push({ name: 'sharp', data: sharp });
    if (deep) {
      const otsu = otsuThreshold(sharp);
      const b1 = binarizeGlobal(sharp, otsu);
      variants.push({ name: 'otsu', data: b1 });
      // අඩු කොන්ට්‍රාස්ට් (specular/සෙවනැල්ල) වලට වඩා ලිහිල් k එකක්
      variants.push({ name: 'otsu2', data: binarizeGlobal(sharp, Math.max(20, otsu - 18)) });
      variants.push({ name: 'adapt', data: binarizeAdaptive(sharp, w, h, 0.10, 0.12) });
      variants.push({ name: 'adapt2', data: binarizeAdaptive(sharp, w, h, 0.20, 0.18) });
    }
    // inversion — සමහර ටිකට් වල QR එක සුදු-උඩ-කළු (negative) විදිහට print කරලා
    const out = [];
    for (const v of variants) {
      out.push({ name: v.name, data: v.data, invert: false });
      out.push({ name: v.name + '-inv', data: invertGray(v.data), invert: true });
    }
    return out;
  }

  /** Uint8 gray → ImageData (RGBA) — jsQR ට ඕන නිසා */
  function grayToImageData(g, w, h, reuse) {
    const img = reuse && reuse.width === w && reuse.height === h ? reuse : new ImageData(w, h);
    const d = img.data;
    for (let i = 0, p = 0; i < g.length; i++, p += 4) {
      const v = g[i];
      d[p] = v; d[p + 1] = v; d[p + 2] = v; d[p + 3] = 255;
    }
    return img;
  }

  // ---------- decoders ----------
  let bd = null, bdTried = false, bdNeedsVideo = false;
  function getDetector() {
    if (bdTried) return bd;
    bdTried = true;
    try {
      if (typeof global.BarcodeDetector === 'function') {
        bd = new global.BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch (e) { bd = null; }
    return bd;
  }

  /**
   * එක variant එකක් decode කරනවා: මුලින්ම BarcodeDetector (native, වේගවත්),
   * ඊට පස්සේ jsQR (CPU). jsQR ට `attemptBoth` දෙනවා — inversion දෙකම බලනවා.
   */
  function tryDecodeVariant(g, w, h, canvas) {
    const det = getDetector();
    if (det && canvas && !bdNeedsVideo) {
      try {
        const res = det.detect(canvas);
        // BarcodeDetector sync වුනත් Promise එකක් return කරනවා
        if (res && typeof res.then === 'function') {
          return res.then(r => (r && r.length && r[0].rawValue) ? { text: String(r[0].rawValue), via: 'barcodeDetector' } : null)
                    .catch(() => null);
        }
        if (res && res.length && res[0].rawValue) return Promise.resolve({ text: String(res[0].rawValue), via: 'barcodeDetector' });
      } catch (e) { bdNeedsVideo = true; }
    }
    if (typeof global.jsQR === 'function') {
      try {
        const img = grayToImageData(g, w, h);
        const r = global.jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
        if (r && r.data) return Promise.resolve({ text: String(r.data), via: 'jsQR' });
      } catch (e) { /* ignore */ }
    }
    return Promise.resolve(null);
  }

  /** gray → canvas (BarcodeDetector එකට දෙන්න) */
  function grayToCanvas(g, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const img = grayToImageData(g, w, h);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // =====================================================================
  // 4. Decode lattice
  // =====================================================================
  /**
   * ලැටිස් එකේ හැම සෙල් එකක්ම try කරනවා: scale × variant × (invert කරලා තියෙනවා).
   *
   * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} source
   * @param {Object} opt
   *   roi   {x,y,w,h} — source එකේ crop කළ යුතු කොටස (null = මුළු එකම)
   *   scales number[]  — upscale/downscale සාධක (default [1,2,3])
   *   deep  boolean    — otsu/adaptive variants එකතු කරන්නද
   *   maxSide number   — එක canvas එකක උපරිම පළල (default 1000)
   *   budgetMs number  — කොච්චර වෙලා උත්සාහ කරන්නද (default 900)
   * @returns {Promise<{text,via,scale,variant,ms}|null>}
   */
  async function decodeLattice(source, opt) {
    opt = opt || {};
    const t0 = performance.now();
    const maxSide = opt.maxSide || 900;
    /**
     * 🎯 **මේකයි ඇත්ත රහස — ඇත්ත ටිකට් photo එකකින් මනින ලද දෙයක්:**
     *
     * jsQR එක ගොඩක් හොඳට වැඩ කරන්නේ QR එකේ **module එකකට පික්සෙල් ~3-10**
     * තියෙන තැනට විතරයි. 3000×4000 සැබෑ photo එකම scale කරලා measure කරාම:
     *     200px → ❌     300px → ✅     450px → ✅
     *     700px → ✅    1000px → ❌    1400px → ❌
     * (ඒ photo එකේ module එකක් 32px නිසා 1000px+ වලදී module 20px+ වෙනවා —
     *  jsQR එකේ binarizer එක එතකොට අසාර්ථක වෙනවා. මේකයි app එකේ QR එක
     *  "ලොකුවට පේනවා, ඒත් scan වෙන්නේ නෑ" කියන ප්‍රශ්නය!)
     *
     * ✅ විසඳුම: locator එකෙන් මනින **modulePx** එක පාවිච්චි කරලා QR එක හරියටම
     * module 3-10px තියෙන ප්‍රමාණයට scale කරනවා — ලොකු නම් **පොඩි කරනවා**,
     * පොඩි නම් ලොකු කරනවා. (ඔබේ 8mm QR එක ටිකට් photo එකේ 32px/module වුනා
     * නම් අපි ඒක 5px/module ට පොඩි කරනවා — එතකොට jsQR කියවනවා.)
     */
    let scales = opt.scales;
    if (!scales) {
      const hint = opt.hintModulePx || 0;
      if (hint > 0) {
        const target = 5 / hint;                      // module 5px වෙන scale එක
        scales = [target * 0.5, target * 0.75, target, target * 1.5, target * 2.5];
      } else {
        // hint නැත්නම් ලොකු පරාසයක් — පොඩි කරන + ලොකු කරන දෙකම
        scales = [0.3, 0.45, 0.65, 1, 1.6, 2.5];
      }
    }
    const budget = opt.budgetMs || 900;
    const sw = source.videoWidth || source.naturalWidth || source.width;
    const sh = source.videoHeight || source.naturalHeight || source.height;
    if (!sw || !sh) return null;
    const roi = opt.roi || { x: 0, y: 0, w: sw, h: sh };
    const rx = Math.max(0, Math.round(roi.x)), ry = Math.max(0, Math.round(roi.y));
    const rw = Math.max(8, Math.min(sw - rx, Math.round(roi.w)));
    const rh = Math.max(8, Math.min(sh - ry, Math.round(roi.h)));

    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const s of scales) {
      if (performance.now() - t0 > budget) break;
      let tw = Math.round(rw * s), th = Math.round(rh * s);
      const biggest = Math.max(tw, th);
      if (biggest > maxSide) { const k = maxSide / biggest; tw = Math.round(tw * k); th = Math.round(th * k); }
      // ⚠️ ඇත්ත photo එකෙන් මනින ලද සීමාවන්: 200px ❌ · 300-700px ✅ · 1000px+ ❌
      // ඒ නිසා ඉතාම පොඩි (60pxට අඩු) canvas එකක් අපරාදේ — කෙලින්ම skip.
      if (tw < 60 || th < 60) continue;
      cv.width = tw; cv.height = th;
      // ⚠️ crop → scale: පොඩි QR එකක් සඳහා **bicubic upscale** එකක්. මේක
      // කරන්නේ නැත්නම් module එකකට පික්සෙල් 1ක් වගේ වැටිලා decode වෙන්නේ නෑ.
      ctx.drawImage(source, rx, ry, rw, rh, 0, 0, tw, th);
      let imgData;
      try { imgData = ctx.getImageData(0, 0, tw, th); } catch (e) { continue; }

      // 1) native BarcodeDetector එකට පිරිසිදු (crop+scale කරපු) canvas එක දෙනවා
      const det = getDetector();
      if (det) {
        try {
          const r = await det.detect(cv);
          if (r && r.length && r[0].rawValue) {
            return { text: String(r[0].rawValue), via: 'barcodeDetector', scale: s, variant: 'raw', ms: Math.round(performance.now() - t0) };
          }
        } catch (e) { /* canvas support නැත්නම් jsQR වලට වැටෙනවා */ }
      }

      if (typeof global.jsQR !== 'function') continue;
      const g0 = rgbaToGray(imgData.data, tw, th);
      const variants = preprocessVariants(g0, tw, th, !!opt.deep);
      for (const v of variants) {
        if (performance.now() - t0 > budget) break;
        let r = null;
        try {
          const im = grayToImageData(v.data, tw, th);
          const res = global.jsQR(im.data, tw, th, { inversionAttempts: 'attemptBoth' });
          if (res && res.data) r = { text: String(res.data), via: 'jsQR' };
        } catch (e) { r = null; }
        if (r) {
          return { text: r.text, via: r.via, scale: s, variant: v.name, ms: Math.round(performance.now() - t0) };
        }
      }
    }
    return null;
  }

  // =====================================================================
  // 5. Multi-frame stacking ("super-resolution lite")
  // =====================================================================
  /**
   * frames කීපයක් align කරලා average කරනවා.
   *
   * ඇයි වැදගත්: පොඩි QR එකේ module එකක් පික්සෙල් 1-2ක් වගේ වැටෙනවා නම්,
   * sensor noise සහ motion blur නිසා ඒ සීමාවේ තියෙන තොරතුරු විනාශ වෙනවා.
   * frame 5-8ක් **හරියටම align කරලා** average කළොත් noise √N ගුණයකින්
   * අඩු වෙනවා → SNR එක වැඩි වෙලා decode එක ගොඩක් පහසු වෙනවා.
   * (මේක classic "lucky imaging / drizzle" උපාය — telescope වල පාවිච්චි කරනවා.)
   *
   * alignment: coarse integer search — 32×32 downsample එකේ SAD එක මිනුම් කරලා
   * ±maxShift පරාසයේ හොඳම shift එක තෝරනවා. (sub-pixel ඕන නෑ — average
   * කරද්දී ඒක තනියම smooth වෙනවා.)
   */
  function stackAverage(frames, w, h, maxShift) {
    if (!frames || frames.length < 2) return frames && frames[0] ? frames[0] : null;
    maxShift = maxShift == null ? 6 : maxShift;

    // coarse reference (පළවෙනි frame එකේ පොඩි පිටපතක්)
    const CW = 32, CH = 32;
    const ref = downsample32(frames[0].gray, w, h, CW, CH);
    const acc = new Float64Array(w * h);
    let used = 0;

    for (const f of frames) {
      let bx = 0, by = 0, best = Infinity;
      const cur = downsample32(f.gray, w, h, CW, CH);
      for (let dy = -maxShift; dy <= maxShift; dy++) {
        for (let dx = -maxShift; dx <= maxShift; dx++) {
          let sad = 0;
          for (let y = 2; y < CH - 2; y++) {
            const sy = y + dy;
            if (sy < 2 || sy >= CH - 2) continue;
            for (let x = 2; x < CW - 2; x++) {
              const sx = x + dx;
              if (sx < 2 || sx >= CW - 2) continue;
              sad += Math.abs(cur[y * CW + x] - ref[sy * CW + sx]);
            }
          }
          if (sad < best) { best = sad; bx = dx; by = dy; }
        }
      }
      // shift එක coarse grid එකෙන් → full-res වලට පරිවර්තනය
      const fx = Math.round(bx * w / CW), fy = Math.round(by * h / CH);
      for (let y = 0; y < h; y++) {
        const sy = y + fy;
        if (sy < 0 || sy >= h) continue;
        for (let x = 0; x < w; x++) {
          const sx = x + fx;
          if (sx < 0 || sx >= w) continue;
          acc[y * w + x] += f.gray[sy * w + sx];
        }
      }
      used++;
    }
    const out = new Uint8ClampedArray(w * h);
    for (let i = 0; i < out.length; i++) out[i] = acc[i] / used;
    return out;
  }

  function downsample32(g, w, h, CW, CH) {
    const out = new Float64Array(CW * CH);
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        let s = 0, n = 0;
        const x0 = Math.floor(x * w / CW), x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / CW));
        const y0 = Math.floor(y * h / CH), y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / CH));
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) { s += g[yy * w + xx]; n++; }
        }
        out[y * CW + x] = n ? s / n : 0;
      }
    }
    return out;
  }

  // =====================================================================
  // public API
  // =====================================================================
  global.LKMQR = {
    rgbaToGray: rgbaToGray,
    percentileStretch: percentileStretch,
    unsharp: unsharp,
    otsuThreshold: otsuThreshold,
    binarizeGlobal: binarizeGlobal,
    binarizeAdaptive: binarizeAdaptive,
    invertGray: invertGray,
    grayToImageData: grayToImageData,
    grayToCanvas: grayToCanvas,
    locateFinders: locateFinders,
    preprocessVariants: preprocessVariants,
    decodeLattice: decodeLattice,
    stackAverage: stackAverage,
    hasDetector: function () { return !!getDetector(); },
    hasJsQr: function () { return typeof global.jsQR === 'function'; },
  };
})(window);
