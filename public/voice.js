/*!
 * voice.js — 🎙️ ප්‍රතිඵල නිවේදනය (win / loss) හඬින්
 * =====================================================================
 * අවශ්‍යතාවය: "ටිකට් එක දිනුම් ගියත්, නොගියත් හඬින් කියන්න ඕන —
 *              ලස්සන තරුණ ගැහැණු හඬක් වගේ."
 *
 * ක්‍රමය: **Web Speech API** (`speechSynthesis`) — browser එකේම තියෙන නිසා
 * API key එකක්වත් internet එකක්වත් අවශ්‍ය නෑ, සහ data කිසිවක් එළියට යන්නේ නෑ.
 *
 * 🔊 හඬ තෝරන ආකාරය:
 *   1. සිංහල හඬක් (`si-LK`) තියෙනවා නම් → සිංහලෙන්ම කියනවා
 *   2. නැත්නම් → ගැහැණු හඬක් (Google UK/US English, Samantha, Zira…)
 *      ලකුණු දීලා තෝරලා, **pitch 1.25 + rate 1.02** දාලා තරුණ ගැහැණු
 *      හඬක් වගේ ශබ්දයක් ලබාගන්නවා (male හඬක් වුනොත් ලකුණු අඩු කරනවා).
 *
 * ⚙️ API:
 *   LKMVoice.win({ lottery, prize, amount })   → දිනුම් නිවේදනය
 *   LKMVoice.loss({ lottery })                 → නොදිනුම් නිවේදනය
 *   LKMVoice.say(text, opts)                   → ඕනෑම දෙයක්
 *   LKMVoice.setEnabled(bool) / isEnabled()
 *   LKMVoice.voices() / LKMVoice.test()
 */
(function (global) {
  'use strict';

  const LS_KEY = 'lkm_voice_enabled';
  let voices = [];
  let enabled = true;
  let lastKey = '';
  let lastAt = 0;

  try { const v = global.localStorage && global.localStorage.getItem(LS_KEY); if (v === '0') enabled = false; } catch (e) {}

  // ---------- හඬ ලැයිස්තුව ----------
  function loadVoices() {
    if (!global.speechSynthesis) return voices;
    try { voices = global.speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
    return voices;
  }
  loadVoices();
  if (global.speechSynthesis) {
    // ⚠️ Chrome එකේ voices list එක පස්සේ load වෙනවා (පළමු call එකේදී හිස්) —
    // ඒ නිසා මේ event එක අල්ලගන්න ඕන, නැත්නම් හඬ තේරීම fail වෙනවා.
    try { global.speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
  }

  // 🎀 ගැහැණු හඬවල නම් — ලකුණු වැඩි. පිරිමි නම් — ලකුණු අඩු.
  const FEMALE = /(female|woman|samantha|karen|moira|tessa|victoria|zira|aria|jenny|michelle|ana|clara|emma|ava|neerja|swara|heera|kalpana|raveena|priya|salli|joanna|kendra|kimberly|ivy|nicky|sonia|libby|natasha|google uk english female|google us english)/i;
  const MALE = /(^|\b)(male|man|david|mark|george|daniel|alex|fred|rishi|ravi|matthew|brian|joey|justin|oliver|thomas|guy|arthur|ryan)/i;

  function score(v, want) {
    const nm = ((v.name || '') + ' ' + (v.voiceURI || '')).toLowerCase();
    const lang = (v.lang || '').toLowerCase();
    let s = 0;
    if (FEMALE.test(nm)) s += 7;
    if (MALE.test(nm)) s -= 7;
    if (/google/.test(nm)) s += 3;                       // Google හඬ සාමාන්‍යයෙන් හොඳම
    if (want && lang.indexOf(want) === 0) s += 6;
    if (lang.indexOf('si') === 0) s += want === 'si' ? 10 : 2;   // සිංහල
    if (/en-(gb|us|in|au)/.test(lang)) s += 2;
    if (/local/i.test(v.localService === false ? '' : '')) s += 0;
    return s;
  }

  function pick(want) {
    loadVoices();
    let best = null, bs = -99;
    for (let i = 0; i < voices.length; i++) {
      const s = score(voices[i], want);
      if (s > bs) { bs = s; best = voices[i]; }
    }
    return best;
  }

  function hasSinhala() {
    loadVoices();
    for (let i = 0; i < voices.length; i++) if (/^si/i.test(voices[i].lang || '')) return true;
    return false;
  }

  // ---------- කථනය ----------
  function say(text, opts) {
    if (!enabled || !text) return false;
    if (!global.speechSynthesis) return false;
    opts = opts || {};
    try {
      global.speechSynthesis.cancel();               // එක උඩ එක නොගොස් පරණ එක නවත්තනවා
      const u = new global.SpeechSynthesisUtterance(String(text));
      const v = pick(opts.lang || (hasSinhala() ? 'si' : 'en'));
      if (v) { u.voice = v; u.lang = v.lang || 'en-US'; }
      // 🎀 තරුණ ගැහැණු හඬක් වගේ: හඬ ටිකක් උස් (pitch ↑), වේගය ස්වභාවික
      u.pitch = opts.pitch != null ? opts.pitch : 1.25;
      u.rate = opts.rate != null ? opts.rate : 1.02;
      u.volume = opts.volume != null ? opts.volume : 1;
      global.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  function rs(n) {  // රුපියල් අංකය කියවන්න පහසු විදිහට
    const x = Number(n);
    if (!isFinite(x)) return String(n || '');
    return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // ---------- නිවේදන ----------
  function win(o) {
    o = o || {};
    const lot = o.lottery || 'ලොතරැයිය';
    const prize = o.prize || '';
    const amt = o.amount != null ? rs(o.amount) : '';
    if (hasSinhala()) {
      const t = 'සුබ පැතුම්! ඔබේ ' + lot + ' ටිකට් එකට ' + (prize ? prize + ' ' : '') +
        (amt ? 'රුපියල් ' + amt + ' ක ' : '') + 'ත්‍යාගයක් තියෙනවා! වාසනාවන්තයි!';
      return say(t, { lang: 'si', pitch: 1.3, rate: 1.0 });
    }
    const t2 = 'Congratulations! Your ' + lot + ' ticket won' +
      (prize ? ' ' + prize : '') + (amt ? ', ' + amt + ' rupees' : '') + '. Well done!';
    return say(t2, { lang: 'en', pitch: 1.3, rate: 1.02 });
  }

  function loss(o) {
    o = o || {};
    const lot = o.lottery || 'ලොතරැයිය';
    if (hasSinhala()) {
      const arr = [
        'අද වාසනාව නැහැ. ' + lot + ' ටිකට් එකට ත්‍යාගයක් නැහැ. ලබන සැරේ හරි වෙයි.',
        'කණගාටුයි, ' + lot + ' ටිකට් එකට ත්‍යාගයක් නැහැ. ආයෙත් උත්සාහ කරන්න.',
      ];
      return say(arr[Math.floor(Math.random() * arr.length)], { lang: 'si', pitch: 1.22, rate: 1.0 });
    }
    const arr2 = [
      'No luck this time. Your ' + lot + ' ticket did not win. Better luck next draw.',
      'Sorry, your ' + lot + ' ticket did not win. Try again next time.',
    ];
    return say(arr2[Math.floor(Math.random() * arr2.length)], { lang: 'en', pitch: 1.22, rate: 1.02 });
  }

  /**
   * 🪄 **ස්වයංක්‍රීය hook** — app එකේ result එක render වුනාම, ඒකේ
   * "දිනුම් / නොදිනුම්" තත්ත්වය කියවලා හඬින් කියනවා. (app එකේ ඇතුළ
   * function එකක් call කරන්න ඕන නෑ — DOM එක බලාගෙන වැඩ කරනවා.)
   * එකම ප්‍රතිඵලය දෙපාරක් නොකියන්න text එකේ hash එකක් තියාගන්නවා.
   */
  const WIN_PAT = /(දිනුම්\s*(!|⚡|🎉|$)|සුබ\s*පැතුම්|ත්‍යාගයක්\s*තියෙනවා|You won|Winner)/i;
  const LOSS_PAT = /(දිනුම්\s*නැහැ|නොදිනුම්|ත්‍යාගයක්\s*නැහැ|No prize|did not win|Not a winner)/i;

  function scan(root) {
    if (!enabled || !root) return;
    const txt = (root.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt.length < 6 || txt.length > 400) return;
    const isLoss = LOSS_PAT.test(txt);
    const isWin = !isLoss && WIN_PAT.test(txt);
    if (!isWin && !isLoss) return;
    const key = (isWin ? 'W:' : 'L:') + txt.slice(0, 120);
    const now = Date.now();
    if (key === lastKey && now - lastAt < 20000) return;   // 20s ඇතුළේ එකම දේ දෙපාරක් නෑ
    lastKey = key; lastAt = now;
    if (isWin) win({ lottery: guessLottery(txt) });
    else loss({ lottery: guessLottery(txt) });
  }

  function guessLottery(txt) {
    const names = ['මහජන සම්පත', 'අද කෝටිපති', 'ජය සම්පත', 'සුබ දවසක්', 'ලග්න වාසනාව',
      'හඳහන', 'ධන සම්පත', 'ගොවි සම්පත', 'NLB', 'DLB'];
    for (const n of names) if (txt.indexOf(n) >= 0) return n;
    return 'ලොතරැයිය';
  }

  // result container එක ඇතුළේ වෙනස්කම් බලනවා (app එකේ result area එක)
  const HOSTS = ['#result', '#scanResult', '#checkResult', '.result', '#tab-check', '#tab-scan'];
  function attach() {
    if (!global.MutationObserver) return;
    const seen = new Set();
    function watch(host) {
      if (!host || seen.has(host)) return;
      seen.add(host);
      new global.MutationObserver(function () { scan(host); })
        .observe(host, { childList: true, subtree: true, characterData: true });
    }
    function find() { for (const s of HOSTS) { try { document.querySelectorAll(s).forEach(watch); } catch (e) {} } }
    find();
    // app එකේ tabs render වෙන වෙලාවට host එක අලුතෙන් හැදෙනවා → ආයෙ බලනවා
    if (global.MutationObserver) {
      new global.MutationObserver(find).observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();

  // ---------- පොදු API ----------
  global.LKMVoice = {
    say: say,
    win: win,
    loss: loss,
    scan: scan,
    voices: function () { loadVoices(); return voices.map(function (v) { return { name: v.name, lang: v.lang }; }); },
    hasSinhala: hasSinhala,
    enabled: function () { return enabled; },
    setEnabled: function (b) {
      enabled = !!b;
      try { global.localStorage && global.localStorage.setItem(LS_KEY, enabled ? '1' : '0'); } catch (e) {}
      if (!enabled && global.speechSynthesis) { try { global.speechSynthesis.cancel(); } catch (e) {} }
      return enabled;
    },
    test: function () { return win({ lottery: 'මහජන සම්පත', prize: '1st Prize', amount: 25000 }); },
    testLoss: function () { return loss({ lottery: 'අද කෝටිපති' }); },
  };
})(window);
