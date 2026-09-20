# 🎟️ LK Lottery Master

ශ්‍රී ලංකා **NLB** (ජාතික ලොතරැයි මණ්ඩලය) සහ **DLB** (සංවර්ධන ලොතරැයි මණ්ඩලය) ලොතරැයි
ප්‍රතිඵල බලන්න, ටිකට් check කරන්න, ඇත්ත prize amounts දැනගන්න සහ AI එකෙන් ටිකට් photo
එකක් scan කරන්න පුළුවන් web app එකක්.

```
┌──────────────────────────────────────────────────────────┐
│  ✍️ අතින් Check   📋 අද Results   📷 Scan   🕘 History   👤 ගිණුම │
└──────────────────────────────────────────────────────────┘
```

---

## ⚡ ඉක්මන් පටන් ගැනීම

```bash
npm install          # dependencies install
npm test             # automated tests 44ක් — Pass: 44 / Fail: 0 වෙන්න ඕන
npm run scrape       # NLB + DLB එකෙන් ප්‍රතිඵල අරන් data.json එක අලුත් කරන්න
npm start            # http://localhost:3000
```

Browser එකකින් **http://localhost:3000** open කරන්න. ඒ තරම්.

`.env` එකේ credentials කිසිවක් නැතුවත් **ටිකට් පරීක්ෂාව / අලුත්ම ප්‍රතිඵල / මගේ වාර්තා**
features සම්පූර්ණයෙන්ම වැඩ කරනවා. AI Scan / Google Sign-In / Payments / 🍀 අනුමානය ටික
විතරයි setup (හෝ plan එකක්) ඕන.

App එකේ **ප්‍රධාන ක්‍රියාව කැමරා Scan** — ඒක tab row එකෙන් එළියේ ලොකු CTA එකක් විදිහට
තියෙනවා. අනිත් tabs (ටිකට් පරීක්ෂාව · අලුත්ම ප්‍රතිඵල · මගේ වාර්තා · අනුමානය ·
මගේ ගිණුම · පරිපාලනය) උඩින් තියෙනවා.

### අවශ්‍යතා

| දේ | අවශ්‍යතාව |
|---|---|
| Node.js | **18.17 හෝ ඉහළ** (global `fetch` එක පාවිච්චි කරනවා) |
| Internet | `npm install`, `npm run scrape` සහ AI scan එකට |
| Browser | Chrome / Edge / Safari (කාමරය + Sinhala fonts) |

---

- **🔎 SEO** — හැම ලොතරැයියකටම **සේවාදායකයේදීම HTML හදන** ප්‍රතිඵල පිටු
  (`/lottery/mahajana-sampatha` වගේ), `/results`, `/how-to-use`, `/about`,
  `/privacy-policy`, `/refund-policy`, `robots.txt`, `sitemap.xml`, JSON-LD
  (WebSite · FAQPage · BreadcrumbList · ItemList), Open Graph + Twitter cards.
  *"ලංකා ලොටරි ප්‍රතිඵල" වගේ සෙවුම්වලට උඩට එන්න ඕන දේ මේකයි — app එකේ
  ප්‍රධාන පිටුව SPA එකක් නිසා ඒ තනියෙන් SEO වලට ප්‍රමාණවත් නෑ.*
- **📜 මාස 6ක ඉතිහාසය** — NLB වලට පිටුවකට draw 200ක්, DLB වලට pagination
  endpoint එකෙන් `පරණ draws`. හැම එකක්ම SQLite `draws` table එකටත් sync වෙනවා
  (දිනය අනුව ඉක්මන් lookup සඳහා). දැනට **draw ~2900ක් (මාස 6.8)**.

- **🌐 භාෂා තුනක්** — සිංහල · English · தமிழ். Menu එකේ උඩම තියෙන switcher එකෙන්
  මාරු කරන්න පුළුවන්; තේරීම localStorage එකේ රැකෙනවා. (Chrome: tabs, buttons,
  labels, notices, hero — okkoma.)
- **📅 දිනය අනුව ප්‍රතිඵල** — 📋 අලුත්ම ප්‍රතිඵල tab එකේ calendar එකෙන් දිනයක්
  තෝරාම **එදා හැම ලොතරැයියකගේම** ප්‍රතිඵલ. අතින් පරීක්ෂාවෙත් calendar එකක් තියෙනවා.
- **⚡ QR detect —— හැම video frame එකේම** (`requestVideoFrameCallback`).
  මනින ලද වේගය: **~120-140ms, frame 4-5ක් ඇතුළත** (කලින් `setInterval(260ms)`
  නිසා තත්පර 0.26ක් බලා ඉන්න වුනා). හම්බුන ගමන් **vibration + chime +
  ප්රතිඵලය**, ඊට පස්සේ **කලින්ම උණුසුම් කරපු** `speechSynthesis` එකෙන්
  ශබ්දය (පළවෙනි වතාවේ ප්රමාදය මඟහැරෙන්න `prewarmSpeech()`).
- **🔳 QR කියවීම මට්ටම් 3කින්** — 1) browser `BarcodeDetector` (Chrome/Android)
  2) **jsQR** (pure JS — iPhone/Firefox ද වැඩ කරනවා) 3) Gemini (අපැහැදිලි QR).
  කලින් තිබ්බේ (1) විතරයි — ඒ නිසා iPhone වල QR වැඩ කළේ නෑ.
- **🚫 scan limit නෑ** — user කෙනෙකුට දවසට/මාසෙට scan ප්‍රමාණයක් නෑ.
  (Abuse නවත්තන්න විනාඩියකට AI ඉල්ලීම් 20ක rate limit එකක් විතරයි තියෙන්නේ.)

## 📁 Project structure

```
lk-lottery-master/
├── server.js              ← Express API + check logic (listen කරන්නේ `node server.js` වලින් විතරයි)
├── scraper.js             ← NLB (bot-check bypass එක්ක) + DLB scraper
├── prizes.js              ← ඇත්ත NLB/DLB prize structure engine (lottery 16ටම)
├── vision.js              ← AI scan — Gemini vision REST API
├── auth.js                ← Register / Login / Google Sign-In / JWT
├── billing.js             ← Plans, scan quota, PayHere checkout + notify
├── stats.js               ← Check logging + user reports + admin analytics
├── lucky.js               ← 🍀 "මගේ වාසනාව" — numerology + pattern analysis + AI guess
├── lottery-meta.js        ← ලොතරැයි ව්‍යුහය (positional/set, ඉලක්කම්/අකුරු) එක තැනකින්
├── gemini-keys.js         ← 🔑 API key pool — rotation + failover (+ cooldown/disable)
├── scrape-runner.js       ← Auto-scrape cron + status (startup stale check එකත් එක්ක)
├── draws-store.js         ← data.json → SQLite `draws` (මාස 6+ ඉතිහාසය, දිනය අනුව query)
├── seo.js                 ← 🔎 Server-rendered SEO පිටු + sitemap + structured data
├── db.js                  ← SQLite layer (better-sqlite3)
├── env.js                 ← .env loader (dependency එකක් නැතුව)
├── test.js                ← Automated tests 44ක් (`npm test`)
├── test-gemini.js         ← Gemini API connectivity test (`npm run test:gemini`)
├── data.json              ← Scrape කරපු ප්‍රතිඵල (auto-generate)
├── data/                  ← SQLite DB (auto-generate, .gitignore කරලා)
├── public/
│   ├── index.html         ← සම්පූර්ණ frontend එක (HTML + CSS + JS එකේම)
│   ├── app-icon.svg       ← App icon (vector)
│   ├── icon-192.png       ← PWA icon
│   ├── icon-512.png       ← PWA icon (maskable)
│   ├── apple-touch-icon.png
│   ├── favicon-32.png
│   └── manifest.webmanifest
├── .env.example           ← Environment variables template
├── SETUP.md               ← Credentials setup guide (Gemini / Google / PayHere)
├── HOWTO-TEST.md          ← Feature එකින් එක අතින් test කරන විදිය
└── package.json
```

---

## ⚙️ npm scripts

| Command | කරන්නේ මොකද |
|---|---|
| `npm start` | Server එක start කරනවා (port 3000, `.env` එකේ `PORT` එකෙන් වෙනස් කරන්න පුළුවන්) |
| `npm run scrape` | NLB + DLB එකෙන් results scrape කරලා `data.json` ලියනවා |
| `npm test` | Automated tests 44ක් (prize engine, check logic, real data) |
| `npm run test:gemini` | Gemini API key + model එක වැඩ කරනවද බලනවා |
| `npm run health` | Run වෙන server එකේ `/api/health` එක call කරනවා |

---

## ✨ Features

- **📷 කැමරා Scan (ප්‍රධාන ක්‍රියාව)** — tab row එකෙන් එළියේ තියෙන ලොකු CTA එකක්.
  ඇතුළේ ප්‍රධාන button **3යි**: කැමරාවෙන් Scan · Phone එකේ camera app · Gallery.
  ටිකට්පත්‍රය කැමරාවට ලං කරාම **auto-focus** (continuous AF + තත්පර 3කට වරක් නැවත
  ලොක් කිරීම + preview එකේ ඔබාම tap-to-focus), රාමුවට **crop** (අනවශ්‍ය කොටස් යවන්නේ නෑ),
  zoom slider + නිවැරදිව වැඩ කරන **🛑 නවත්තන්න** button එකක්.
- **🍀 මගේ වාසනාව (Premium)** — නම + උපන් දිනය + උපන් වේලාව (AM/PM) දාලා, පසුගිය
  ප්‍රතිඵලවල **සැබෑ සංඛ්‍යාලේඛන** (hot/cold/overdue, position-wise, එකතුව, අකුරු/රාශි
  වාර ගණන) + සාම්ප්‍රදායික සංඛ්‍යා ශාස්ත්‍රීය සංඥා එකට එකතු කරලා AI අංක යෝජනාවක්.
  කැමරාවෙන් scan කරලත් අනුමානය ගන්න පුළුවන්.
  ⚠️ හැම උත්සාහයකටම කලින් **disclaimer එකට එකඟ වීම අනිවාර්යයි** (server එකෙනුත්
  enforce කරනවා) — මෙය අනාවැකියක් නොවේ, ලොතරැයි අංක අහඹුයි.
- **📢 Display ads** — ස්ථාන 7ක් (උඩ · scan · lucky · results · history · පහළ ·
  check 3කට වරක් එන interstitial). Ad network එකේ code එක අදාළ තැනට paste කරන්න
  විතරයි. Premium (adFree) plans වලට දැන්වීම් නොපෙනෙනවා.
- **🔑 API key failover** — Gemini keys කිහිපයක් දැම්මොත් එකක් quota/limit එකට
  වැටුනාම app එක **තනියම ඊළඟ key එකට මාරු වෙනවා** (cooldown + disabled keys
  skip කරලා, භාරය සමානව බෙදලා). ඒ නිසා එක key එකක් ඉවර උනාම user ට 429 error
  එකක් එන්නේ නෑ. Admin → Overview එකේ key එකක තත්ත්වය (masked) පේනවා.
  ⚠️ *Free quota එක ගුණ කරන්න වෙන වෙන Google accounts හෝලා keys හදන එක
  Google ToS කඩයි — ඒකට පාවිච්චි කරන්න එපා. Keys ඔබේම project/team එකේ
  ඒවා විය යුතුයි.*
- **⏳ අපරාදේ request නොයන එක** — button එකක් ඔබපුවම result එක එනකම් ඒක
  **අළු පාට වෙලා disable** වෙනවා (Scan · පරීක්ෂා කරන්න · අනුමානය ඔක්කොම).
  Frontend එක විතරක් නෙවෙයි — server එකෙනුත් එකම user එකෙන් එකවර යන AI
  ඉල්ලීම් block කරනවා, ඒ නිසා Gemini calls නාස්ති වෙන්නේ නෑ.
- **🔄 Auto-scrape** — දිනකට දෙපාරක් (09:30 + 21:30 Asia/Colombo) ස්වයංක්‍රීයව, ඒ වගේම
  server එක start වෙද්දී දත්ත පරණ නම් background එකේ. Scrape එකක් අසාර්ථක උනොත්
  පරණ දත්ත රැකෙනවා (හිස් වෙන්නේ නෑ). Admin ට manual refresh button එකකුත් තියෙනවා.
- **✍️ අතින් Check** — lottery එකට අනුව box ගණන automatic වෙනස් වෙනවා
  (අකුරු box, රාශි dropdown, super number box, multi-game selector), auto-advance cursor,
  පරණ draw අංකයකින් වුනත් check කරන්න පුළුවන්.
- **ඇත්ත prize amounts** — placeholder logic එකක් නෙවෙයි. lottery 16න් 15කට NLB/DLB
  නිල prize structure table එකෙන්ම හදපු tier + Rs. amount logic එකක්.
  (Waasi සහ Dhana Nidhanaya 9th tier — data නැති නිසා "check කරන්න බෑ" කියලා
  පැහැදිලිව කියනවා, වැරදි answer එකක් දෙන්නේ නෑ.)
- **📋 අද Results** — lottery 16ටම අලුත්ම draw + අංක. Item එකක් click කළාම
  ඒ draw එකත් එක්ක Check tab එකට auto-fill වෙනවා.
- **📷 AI Camera Scan** — photo එකක් Gemini vision එකට යවලා lottery නම, draw අංකය,
  ඉලක්කම්, අකුර, රාශිය structured JSON එකක් විදිහට ගන්නවා. Photo එක ගත්තට පස්සේ
  **scan වෙනවා වගේ animation** එකක් පේනවා, ඊට පස්සේ **එවලේම scrape කරපු ප්‍රතිඵලත්
  එක්ක match කරලා** දිනුමක් තියෙනවා නම් tier එකයි Rs. amount එකයි එතනම පෙන්නනවා.
  ඕන නම් "අතින් Check" එකට auto-fill කරන්නත් පුළුවන්.
  Camera එකට continuous auto-focus + resolution 1920×1080 + ticket align කරන්න රාමුවක්,
  සහ "🎯 නැවත Focus කරන්න" button එකක් තියෙනවා. Focus ප්‍රශ්න තියෙන phones වලට
  "📱 Phone එකේ camera app එකෙන් ගන්න" කියලා වෙනම option එකකුත් තියෙනවා.
- **🕘 History + 📊 Report** — ගිණුමක් නැතුව (guest) check කරන ඒවා browser එකේ
  localStorage එකේ තියෙනවා. **ගිණුමකට login වුනාම** හැම check එකක්ම server එකේ save වෙලා:
  - සම්පූර්ණ history එක — ලොතරැයිය / දින පරාසය / දිනුම් විතරක් කියන filter එක්ක + pagination
  - **ලොතරැයි අනුව විස්තරාත්මක report එකක්** — එක එක ලොතරැයියට check කීයක්, දිනුම් කීයක්,
    දිනුම් අනුපාතය, මුළු දිනුම් මුදල, අලුත්ම දිනුම, ලොකුම දිනුම — analysis කරන්න ලේසි විදිහට
- **👤 ගිණුම** — Email/Password + **Google (Gmail) එකෙන් එක click එකකින් signup**.
  Google One Tap එකේ `auto_select` දාලා තියෙන නිසා browser එකේ දැනටමත් login වෙලා ඉන්න
  Gmail ගිණුම **auto-select වෙලා** එක click එකකින් ගිණුම හැදෙනවා/ලොග් වෙනවා.
  Register වෙද්දී password එක දෙපාරක් අහනවා (typo වළක්වන්න) + 👁️ බලන්න button එකක්.
  Plan එකින් scan quota, PayHere subscriptions (Rs. 100 / 500 / 1000).
- **🛠️ Admin Panel** — `.env` එකේ `ADMIN_EMAILS` එකේ දාපු email වලට විතරයි:
  - **ඔක්කොම signups** — එක එකාගේ plan, login ක්‍රමය (Google/Password), joined දිනය
  - **එක එකාගේ statistics** — කීයක් search/check කළාද, දිනුම් කීයක්ද, අනුපාතය,
    මුළු දිනුම් මුදල, AI scans කීයක්, අලුතෙන්ම active උන වෙලාව
  - **per-user විස්තර** — ඒ user ගේ ලොතරැයි report එක + history + payments
  - **Lottery report (හැම user ගේම)** — මුළු check, players, winners, දිනුම් මුදල, top tiers
  - Daily signups / checks chart + අලුත්ම checks list එකක්
- **💰 Ad break** — හැම 3වෙනි check එකකටම තත්පර 5ක ad screen එකක්
  (`public/index.html` එකේ `id="adSlot"` එක ඇතුළේ AdSense code එක දාන්න).
- **⏰ Auto scrape** — server එක run වෙලා තියෙනකොට හැම දිනකම උදේ **10:00 (Asia/Colombo)**
  ට `scraper.js` auto run වෙනවා.

---

## 🗄️ දත්ත

| දේ | කොහෙද | ඇතුළේ මොනවද |
|---|---|---|
| `data.json` | ලොතරැයි ප්‍රතිඵල | lottery 16, draw 168ක් (scraper එකෙන් auto-generate) |
| `data/app.db` | SQLite | `users`, `payments`, `checks` (check history + statistics) |

**Privacy:** **scan කරන photo එක කවදාවත් save කරන්නේ නෑ** (එයා Gemini එකට ගිහින්
ප්‍රතිඵලය එනවා විතරයි). ගිණුමක් නැතුව check කරන ඒවා browser එකේ විතරයි.
**ගිණුමකට login වුනාම**, ඔබගේ check කිරීම් (ලොතරැයිය, draw, දිනය, ඉලක්කම් සහ ප්‍රතිඵලය)
ඔබගේ report/history සහ admin statistics සඳහා server එකේ සුරකිනවා.

---

## 🔑 Configuration (`.env`)

`cp .env.example .env` කරලා පුරවන්න. සම්පූර්ණ setup steps → **[SETUP.md](SETUP.md)**.

| Key | අවශ්‍යද | විස්තරය |
|---|---|---|
| `PORT` | නෑ | Server port (default `3000`) |
| `APP_BASE_URL` | නෑ | PayHere return/notify URLs සඳහා |
| `APP_TIMEZONE` | නෑ | Daily/monthly quota reset වෙන timezone (default `Asia/Colombo`) |
| `TRUST_PROXY` | නෑ | nginx/Render වගේ proxy එකක් පිටුපස නම් `true` |
| `JWT_SECRET` | ✅ **අනිවාර්යයි** | අකුරු 32+ random string. හදාගන්න: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `GEMINI_API_KEY` | AI scan එකට | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — FREE |
| `GEMINI_MODEL` | නෑ | default `gemini-3.6-flash` ([වෙන models](https://ai.google.dev/gemini-api/docs/models)) |
| `GEMINI_TIMEOUT_MS` | නෑ | එක scan එකකට උපරිම තත්පර (default `45000`) |
| `GEMINI_API_KEY_2`...`_N` | නෑ | අමතර keys — එකක් limit වුනාම ඊළඟ එකට මාරු වෙනවා (failover) |
| `GEMINI_KEY_COOLDOWN_MS` | නෑ | 429 වුනාම ඒ key එක තත්පර කීයක් නවත්තනවද (default 60s) |
| `GEMINI_KEY_DAILY_COOLDOWN_MS` | නෑ | දවසේ limit ඉවර key එකක් (default 30 min) |
| `GEMINI_MAX_KEY_ATTEMPTS` | නෑ | එක ඉල්ලීමකට උපරිම keys කීයක් try කරන්නද (default 3) |
| `SCRAPE_CRON` | නෑ | Auto-scrape කවදාද (default `30 9,21 * * *` — දිනකට දෙපාරක්) |
| `SCRAPE_HISTORY_MONTHS` | නෑ | කොච්චර කාලයක් ප්‍රතිඵල ගන්නද (default `6`) |
| `SCRAPE_NLB_DRAWS` | නෑ | NLB ලොතරැයියකට උපරිම draw ගණන (default `200`) |
| `SCRAPE_DLB_MAX_PAGES` | නෑ | DLB pagination උපරිම පිටු (default `90`) |
| `SCRAPE_MAX_AGE_HOURS` | නෑ | Server start වෙද්දී දත්ත මීට වඩා පරණ නම් scrape කරනවා (default `8`) |
| `UNLIMITED_SCAN` | නෑ | `true` = scan limit එකක් නෑ. **දැනට `true`** (test කරන කාලෙට). Test ඉවර වුනාම `false` කරන්න — එතකොට plan limits ආපහු වැඩ කරනවා (counters දිගටම ගණන් වෙනවා) |
| `GOOGLE_CLIENT_ID` | Google login එකට | OAuth 2.0 "Web application" client ID. දැම්මම **Gmail එකෙන් එක click signup** (One Tap auto-select) වැඩ කරනවා |
| `ADMIN_EMAILS` | Admin panel එකට | Admin අවසර දෙන email එකක් හෝ කිහිපයක් (කොමාවෙන් වෙන් කරලා). උදා: `ADMIN_EMAILS=you@gmail.com` |
| `GEMINI_THINKING` | නෑ | default `minimal` — scan එක ගොඩක් වේගවත් කරනවා. `off` දැම්මම thinking config එක යවන්නේම නෑ |
| `PAYHERE_MERCHANT_ID` / `_SECRET` | Payments වලට | PayHere Merchant Portal එකෙන් |
| `PAYHERE_MODE` | නෑ | `sandbox` (default) හෝ `live` |

---

## 🔌 API

| Method | Endpoint | කරන්නේ |
|---|---|---|
| GET | `/api/health` | Uptime + data status |
| GET | `/api/lotteries` | Lottery list + display metadata (box ගණන, රාශි, sub-games) |
| GET | `/api/results/:slug` | එක lottery එකක draw ඔක්කොම |
| GET | `/api/latest` | අලුත්ම draw (හැම lottery එකකටම) |
| POST | `/api/check` | `{ slug, drawNo?, letter?, zodiac?, superNumber?, numbers[], subGameIndex? }` |
| POST | `/api/scan` | `{ image: <base64>, mimeType }` → AI vision |
| POST | `/api/auth/register` | `{ email, password, name? }` |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/google` | `{ idToken }` |
| GET | `/api/auth/me` | Bearer token → user (+ `isAdmin`) |
| GET | `/api/me/stats` | මගේ summary (checks, දිනුම්, අනුපාතය, මුදල, ලොකුම දිනුම) |
| GET | `/api/history` | මගේ සම්පූර්ණ history — `?slug=&from=&to=&winsOnly=true&limit=&offset=` |
| GET | `/api/report` | මගේ ලොතරැයි අනුව විස්තරාත්මක report — `?from=&to=` |
| GET | `/api/admin/overview` | **Admin:** totals, signups/checks by day, plan mix, recent checks |
| GET | `/api/admin/users` | **Admin:** හැම signup එකක්ම + per-user statistics — `?q=&sort=&limit=&offset=` |
| GET | `/api/admin/users/:id` | **Admin:** එක user කෙනෙක්ගේ සම්පූර්ණ විස්තර + report + history |
| GET | `/api/admin/report` | **Admin:** ලොතරැයි අනුව සමස්ත report + top tiers |
| GET | `/api/admin/setup` | Admin configure කරලා තියෙනවද / මගේ email එක (setup help) |
| GET | `/api/draws/:slug` | Draw ලැයිස්තුව / `?date=YYYY-MM-DD` → ඒ දවසේ draw |
| POST | `/api/check` | `date` දුන්නොත් **ඒ දවසේ ප්‍රතිඵලය** සමඟ සැසඳෙනවා |
| GET | `/api/lucky/disclaimer` | 🍀 නියමයන් (disclaimer) text + version |
| GET | `/api/profile` | මගේ උපන් විස්තර + සංඛ්‍යා ශාස්ත්‍රීය සංඥා |
| POST | `/api/profile` | උපන් විස්තර save — `{fullName, birthday, birthHour, birthMinute, birthMeridiem}` |
| GET | `/api/lucky/patterns` | 🍀 **Premium:** විශ්ලේෂණය + 🧮 ශ්‍රේණිගත ඉලක්කම් + ඊළඟ draw යෝජනාව — `?slug=&subGameIndex=` |
| GET | `/api/lucky/overview` | 🍀 **Premium:** ලොතරැයි අනුව සාරාංශය (හැම ලොතරැයියකටම top අංක + යෝජනාව) — `?limit=6` |
| POST | `/api/lucky/guess` | 🍀 **Premium:** AI අනුමානය — `agreedDisclaimer: 'v1'` අනිවාර්යයි |
| GET | `/api/lucky/history` | 🍀 මගේ පෙර අනුමාන |
| GET | `/api/scrape/status` | Auto-scrape තත්ත්වය (cron, අවසන් උත්සාහය, දත්ත අලුත්ද) |
| POST | `/api/admin/scrape` | **Admin:** දැන්ම අතින් scrape එකක් run කරන්න |
| GET | `/api/billing/plans` | Plans + current plan |
| POST | `/api/billing/checkout` | PayHere checkout fields (auth ඕන) |
| POST | `/api/billing/notify` | PayHere server-to-server callback (md5sig verify) |

Auth ඕන endpoints වලට `Authorization: Bearer <token>` header එක යවන්න.

---

## 🧪 Testing

```bash
npm test              # 44 tests — Pass: 44 / Fail: 0
npm run test:gemini   # Gemini key + model check
```

### 🧮 ශ්‍රේණිගත කිරීමේ එන්ජිම (Lucky Guess algorithm)

`lucky.js` එකේ `rankCandidates()` සහ `nextDrawPlan()` පසුගිය draws වලින්
අංක **ශ්‍රේණිගත කරනවා** (score 0-100). බර:

| සාධකය | බර | කරන්නේ |
|---|---|---|
| වාර ගණන (frequency) | 34% | කී draw එකක ආවද |
| මෑතකාලීනත්වය (recency) | 26% | exponential decay (half-life `LUCKY_HALFLIFE`, default 25) |
| හිඩැස (overdue) | 18% | බලාපොරොත්තු වන හිඩැසට සාපේක්ෂව |
| සංක්‍රමණය (transition) | 14% | අලුත්ම draw එකට සමාන ඓතිහාසික තත්ත්වවලින් පස්සේ ආපු අංක (Markov) |
| සංඛ්‍යා ශාස්ත්‍රය | 8% | user ගේ profile එකේ ඉලක්කම් වලට ගැලපීම (profile නැත්නම් බලපෑම 0) |

⚠️ **මේවා අපේ තේරීම්** — ලොතරැයි විශේෂඥයින් තහවුරු කළ පරාමිති නොවේ.
ලොතරැයි අංක අහඹුයි; මේ එන්ජිම දිනුම් සම්භාවිතාව වැඩි කරන්නේ **නෑ** —
පාරදෘශ්‍ය විශ්ලේෂණ මෙවලමක් විතරයි.

`npm test` එකෙන් cover කරන්නේ: date parsing, check logic (positional + set match),
scraped data integrity, සහ **lottery 16ටම ඇත්ත prize tiers** (SUPER / 3RD / 4TH / ... amounts).
Feature එකින් එක අතින් test කරන පියවර-by-පියවර guide එක → **[HOWTO-TEST.md](HOWTO-TEST.md)**.

---

## 🚀 Deploy කරන්න

1. `JWT_SECRET` එක strong random එකක් දාන්න (අනිවාර්යයි).
2. `APP_BASE_URL` එක ඔයාගේ domain එකට දාන්න, `TRUST_PROXY=true` (proxy පිටුපස නම්).
3. HTTPS පාවිච්චි කරන්න — phone එකකින් camera scan කරන්න ඕන නම් **HTTPS අනිවාර්යයි**
   (browser එක `localhost` එකට විතරයි HTTPS නැතුව camera එක දෙන්නේ).
4. Serverless / short-lived process එකක deploy කරනවා නම් `node-cron` schedule එක
   reliable නෑ — OS-level cron එකකින් `npm run scrape` run කරන්න.
5. AdSense approve වුනාට පස්සේ code එක `public/index.html` එකේ `id="adSlot"` ඇතුළේ දාන්න,
   සහ `ads.txt` එක domain root එකට දාන්න.

---

## ⚠️ වගකීම් ප්‍රතික්ෂේප කිරීම

මේ app එකේ ප්‍රතිඵල NLB/DLB නිල වෙබ් අඩවි වලින් automatic ලෙස scrape කරන ඒවා —
**නිල ප්‍රතිඵල පත්‍රිකාවක් නොවේ**. Prize amounts නිල prize structure එකෙන් ගත්තත්,
අවසන් තීරණයක් ගන්න කලින් නිල ලේඛනයෙන් තහවුරු කරගන්න. AI scan එකෙන් වැරදි
කියවීම් වෙන්න පුළුවන් — හැමවෙලාවෙම අංක නැවත බලන්න.
