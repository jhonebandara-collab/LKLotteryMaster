# LK Lottery Master — Setup Guide

මේ document එකේ ඔයාට app එක සම්පූර්ණයෙන්ම production-ready කරගන්න
ඕන credentials/setup steps ටික තියෙනවා.

## 0. File එකේ තියෙන මූලික Setup (2ක් විතරයි)

```bash
npm install       # dependencies
cp .env.example .env
```

ඊට පස්සේ `.env` එකේ **`JWT_SECRET` එක අනිවාර්යයෙන්** වෙනස් කරන්න — random string එකක් හදාගන්න:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 1. Install + Run

```bash
npm install
npm start             # http://localhost:3000
npm run scrape        # data.json manual ලෙස update කරගන්න (cron එකකින් වුනත් auto වෙනවා)
npm test              # automated tests 44ක් run කරනවා
npm run test:gemini   # Gemini API key + model එක වැඩ කරනවද බලනවා
```

Credentials කිසිවක් `.env` එකේ නැතුව app එක run කරන්න පුළුවන් —
Manual Check / Latest Results / History features වැඩ කරනවා.
AI Scan, Google Sign-In, Payment features ටික විතරයි "Setup ඕන" කියලා පෙන්නන්නේ.

## 2. `.env` File එක හදන්න

`.env.example` copy කරලා `.env` ලෙස save කරන්න:

```bash
cp .env.example .env
```

| Key | අවශ්‍යද | Default |
|---|---|---|
| `PORT` | නෑ | `3000` |
| `APP_BASE_URL` | PayHere වලට | `http://localhost:3000` |
| `APP_TIMEZONE` | නෑ | `Asia/Colombo` (daily/monthly scan quota reset වෙන එක) |
| `TRUST_PROXY` | නෑ | `false` (nginx/Heroku/Render පිටුපස නම් `true`) |
| `JWT_SECRET` | ✅ අනිවාර්යයි | — (උඩ විදිහට random එකක් හදන්න) |
| `DB_PATH` | නෑ | `data/app.db` |
| `UNLIMITED_SCAN` | නෑ | `true` කරලා තියෙනවා නම් scan limit එකක් නෑ (test කරන කාලෙට). **Production එකට `false` කරන්න** — එතකොට Free = දිනකට 3, Rs.100 = මාසෙකට 100, Rs.500 = මාසෙකට 800, Rs.1000 = unlimited |
| `GEMINI_TIMEOUT_MS` | නෑ | එක scan එකකට උපරිම තත්පර (default `45000`) |

## 3. AI Vision Scan (Gemini) — FREE

1. https://aistudio.google.com/apikey වලින් API key එකක් ගන්න.
2. `.env` එකට: `GEMINI_API_KEY=AIzaSy....`
3. Server restart කරන්න.

## 3.5 🔑 Keys කිහිපයක් (failover) — quota ඉවර උනාම error නොඑන විදිහට

Gemini key එකකට **per-minute** limit එකකුත් **per-day** limit එකකුත් තියෙනවා.
එක key එකක් ඉවර උනාම user ට `429 — limit` error එකක් එනවා වෙනුවට, keys
කිහිපයක් තිබ්බොත් app එක **තනියම ඊළඟ key එකට මාරු වෙනවා**.

```bash
# .env එකේ (හැම ආකෘතියක්ම වැඩ කරනවා)
GEMINI_API_KEY_1=...
GEMINI_API_KEY_2=...
GEMINI_API_KEY_3=...
# හෝ
GEMINI_API_KEYS=key1,key2,key3
# හෝ එකම නම දෙපාරක්
GEMINI_API_KEY=key1
GEMINI_API_KEY=key2
```

**මොනවද ස්වයංක්‍රීයව වෙන්නේ:**
- එක ඉල්ලීමක් සඳහා keys ටික **සමානව බෙදිලා** පාවිච්චි වෙනවා (round-robin)
- Key එකක් `429` උනාම ඒක **cooldown** එකට දාලා ඊළඟ එකට මාරු වෙනවා
  (per-minute නම් තත්පර 60, දවසේ limit නම් මිනිත්තු 30 — `.env` එකෙන් වෙනස් කරන්න)
- Key එකක් වැරදි/අවසර නැති නම් ඒක **disable** වෙනවා (ආයෙ පාවිච්චි කරන්නේ නෑ)
- `503` (Gemini කාර්යබහුලයි) වගේ Gemini පැත්තේ ප්‍රශ්නවලට keys මාරු කරන්නේ නෑ —
  ඒකෙන් වැඩක් නැති නිසා එවලේම තේරෙන error එකක් දෙනවා (තත්පර 40ක් නිකම් ඉන්නේ නෑ)
- Keys **ඔක්කොම** ඉවර නම් විතරයි error එකක් එන්නේ — එතකොට "තව තත්පර Xකින්
  ආයෙ try කරන්න" කියලා කියනවා

**බලන්න:** 🛠️ පරිපාලනය → 📈 Overview → **🔑 AI key pool** කොටසින් හැම key එකකගේම
තත්ත්වය (ready / cooldown / disabled), calls, ok, 429 ගණන පේනවා. Keys පෙන්නන්නේ
masked විදිහට විතරයි (`AQ.Ab8…t0w`) — පූර්ණ key එකක් කවදාවත් API එකකින් එන්නේ නෑ.

> ### 🚫 මේක අනිවාර්යයෙන් කියවන්න
>
> **වෙන වෙන Google accounts කිහිපයක් හදලා free quota එක ගුණ කරගන්න එක
> Google Gemini API Terms of Service කඩ කිරීමක්.** Google ඒක detect කරලා
> keys සහ accounts **suspend** කරන්න පුළුවන් — එහෙම වුනොත් ඔබේ app එක
> සම්පූර්ණයෙන්ම නවතිනවා.
>
> **"Keys 4කින් විනාඩියකට scan 60ක්"** කියන එක ගණනය වැරදියි — key එකකට
> per-minute limit එක වෙනම තියෙන නිසා keys 4කින් ලැබෙන්නේ **ඒ දවසේ limit
> එක 4 ගුණයක්** විතරයි, විනාඩියට 60ක් දිගටම නොවේ. (App එකේ scan එකකට
> photo එකක් යන නිසා, key එකකට විනාඩියකට කීයක් යන්න පුළුවන්ද කියන එකයි
> ඇත්ත සීමාව.)
>
> **නිවැරදි විසඳුම්:**
> 1. **Billing enable කරපු ඔබේම project එකක keys** — scan එකක මිල ඉතා අඩුයි
> 2. **එකම organization එකේ වෙනස් projects** වලින් keys (වෙන වෙන accounts නෙවෙයි)
> 3. **Scan ගණන අඩු කරන්න** — මේ app එකේ දැනටමත් කරලා තියෙන දේවල්:
>    රාමුවට crop කිරීම · photo එක පොඩි කිරීම · `thinkingLevel: minimal` ·
>    model ලැයිස්තුව cache කිරීම · එකම user එකෙන් එකවර එක ඉල්ලීමක් විතරක්
>    (button disable + server guard) · අසාර්ථක නොවී keys භාරය බෙදීම

## 4. Google Sign-In

1. https://console.cloud.google.com/apis/credentials
2. "Create Credentials" → "OAuth client ID" → Application type: **Web application**
3. Authorized JavaScript origins එකට ඔයාගේ domain එක දාන්න
   (dev එකට: `http://localhost:3000`)
4. Client ID එක `.env` එකට: `GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com`
5. Server restart කරන්න — 👤 ගිණුම tab එකේ Google button එක automatic ලෙස render වෙනවා.

Client ID එකක් නැති කාලෙදී Email/Password login/register එක සාමාන්‍යයෙන් වැඩ කරනවා.

**වැදගත්:** Client ID එක දාලා තියෙනකොට browser එකේ දැනටමත් login වෙලා ඉන්න
Gmail ගිණුම **auto-select වෙලා** (One Tap) එක click එකකින් ගිණුම හැදෙනවා/ලොග් වෙනවා.
OAuth consent screen එක Testing mode එකේ නම් **Test users** ලැයිස්තුවට අදාළ
Gmail එක එකතු කරන්න (නැත්නම් Google එකෙන් block කරනවා).

## 4.5 Admin Panel

1. `.env` එකට ඔබගේ email එක දාන්න:

   ```
   ADMIN_EMAILS=you@gmail.com
   ```

   (කිහිපයක් දාන්න ඕන නම්: `ADMIN_EMAILS=you@gmail.com,partner@example.com`)

2. Server එක restart කරන්න (`Ctrl+C` → `npm start`).
3. ආයෙ login වෙලා **🛠️ Admin** tab එක open කරන්න.

එතන පේන දේවල්: ඔක්කොම signups + එක එකාගේ plan / ලොග් වුන ක්‍රමය / joined දිනය,
කීයක් check කළාද, දිනුම් කීයක්ද (අනුපාතය + මුළු මුදල), AI scans කීයක්ද,
ලොතරැයි අනුව සමස්ත report එක, top tiers, daily signups/checks chart එක සහ
අලුත්ම checks ලැයිස්තුව.

`ADMIN_EMAILS` එක හිස් නම්, login වෙලා ඉන්න කෙනාට Admin tab එකේ
copy-paste කරන්න පුළුවන් පේළියක් එක්ක instructions පේනවා.

## 5. PayHere Payment Gateway (Subscription Plans)

1. https://www.payhere.lk එකේ merchant account එකක් හදාගන්න (Sandbox account
   එකකින් test කරන්න පුළුවන් — https://support.payhere.lk/sandbox-and-testing).
2. Merchant Portal → **Integrations** → **Add Domain/App** → domain එක verify කරන්න.
3. Merchant ID + Merchant Secret ලැබෙනවා.
4. `.env` එකට:
   ```
   PAYHERE_MERCHANT_ID=xxxxxx
   PAYHERE_MERCHANT_SECRET=xxxxxxxxxxxx
   PAYHERE_MODE=sandbox     # production වෙනකොට "live"
   APP_BASE_URL=https://yourdomain.com
   ```
5. Server restart කරන්න — 👤 ගිණුම tab එකේ Subscribe buttons වැඩ කරන්න පටන් ගන්නවා.

**Subscription tiers:**

| Plan | මාසික ගාස්තුව | Scan Limit | Ads |
|---|---|---|---|
| Free | Rs. 0 | දිනකට 3 | Ads සමඟ |
| Rs. 100 | Rs. 100 | මාසෙකට 100 | Ad-free |
| Rs. 500 | Rs. 500 | මාසෙකට 800 | Ad-free |
| Rs. 1000 | Rs. 1000 | Unlimited | Ad-free |

Payment සාර්ථක වූ පසු PayHere server-to-server notify එකක් `/api/billing/notify`
එකට එනවා — `md5sig` verify කරලා user එකේ plan එක auto-activate වෙනවා (1 මාසෙකට).

## 6. Database (SQLite)

- `data/app.db` file එකේ පහත tables තියෙනවා:
  - `users` — ගිණුම්, plan එක, scan quota counters
  - `payments` — PayHere orders + තත්ත්වය
  - `checks` — **හැම check එකක්ම** (ලොතරැයිය, draw, දිනය, ඉලක්කම්, දිනුම් tier
    සහ මුදල, manual/AI scan). මේක තමයි history + ලොතරැයි report + admin
    statistics වලට පාදක වෙන්නේ.
  - `profiles` — 🍀 අනුමානයට ඕන උපන් විස්තර (නම, උපන් දිනය, උපන් වේලාව)
  - `guesses` — හැම අනුමානයක්ම + එකඟ වුන disclaimer version එක
  - `meta` — auto-scrape status එක වගේ පොඩි දේවල්
- `data/` folder එක `.gitignore` කරලා තියෙනවා — commit කරන්න එපා.
- Backup ගන්න ඕන නම් `data/app.db` file එකම copy කරගන්න (server එක නවත්තලා).

🔒 **Privacy**: **scan කරන photo එක කවදාවත් save කරන්නේ නෑ** — එයා Gemini එකට
යවලා ප්‍රතිඵලය ගන්නවා විතරයි. ගිණුමක් නැතුව (guest) check කරන ඒවා එයාගේ
browser එකේ විතරයි. **ගිණුමකට login වුනාම**, එයාගේ check කිරීම් (ලොතරැයිය, draw,
දිනය, ඉලක්කම්, ප්‍රතිඵලය) history එකට, ලොතරැයි report එකට සහ admin statistics
වලට ඕන නිසා server එකේ සුරකිනවා. ඒ බව first-visit notice එකේ user ට කියනවා.

## 5.5 🔎 SEO — Google එකෙන් උඩට එන්න

මේ පිටු **සේවාදායකයේදීම HTML විදිහට හැදිලා** යවනවා (JavaScript එක ඕන නෑ):

| URL | මොකක්ද |
|---|---|
| `/lottery/<slug>` | හැම ලොතරැයියකටම ප්‍රතිඵල පිටුව (නවතම draw + පසුගිය 12 + FAQ) |
| `/results` | ඔක්කොම ලොතරැයි එක පිටුවක |
| `/how-to-use` · `/about` · `/privacy-policy` · `/refund-policy` | ස්ථිතික පිටු |
| `/robots.txt` · `/sitemap.xml` | crawler සඳහා |

**කරන්න ඕන දේවල් 2ක්:**

1. **`.env` එකේ `APP_BASE_URL` එක ඔබේ ඇත්ත domain එකට දාන්න**
   (උදා: `APP_BASE_URL=https://lankalottery.lk`). නැත්නම් sitemap එකේයි
   canonical URLs වලයි `localhost` වැටෙනවා — ඒක SEO වලට නරක.

2. **Google Search Console** ([search.google.com/search-console](https://search.google.com/search-console))
   එකට site එක එකතු කරලා `https://ඔබේ-domain/sitemap.xml` එක **submit** කරන්න.
   (Bing සඳහා [bing.com/webmasters](https://www.bing.com/webmasters).)

**දැනටමත් හදලා තියෙන දේවල්:** `title`/`description`/`keywords`, canonical,
Open Graph + Twitter card, JSON-LD (WebSite · Organization · FAQPage ·
BreadcrumbList · ItemList), hreflang, semantic H1/H2, internal links
(footer එකේ හැම ලොතරැයියකටම real `<a>` link), `sitemap.xml` (dynamic),
`robots.txt`. පිටු යාවත්කාලීන වෙන්නේ scrape එකට පස්සේ නිසා Google එකට
සැමවිටම අලුත් ප්‍රතිඵල පේනවා.

> ⚠️ SEO යනු ක්ෂණික දෙයක් නොවේ — index වෙන්න දින කිහිපයක් සහ උඩට එන්න
> සති කිහිපයක් ගත වෙන්න පුළුවන්. කිසිදු තැනක **rank guarantee** එකක් නෑ.

## 5.6 📜 මාස 6ක ඉතිහාසය

`npm run scrape` එකෙන් දැන් **මාස 6ක්** (default) බාගන්නවා:

* **NLB** — results පිටුවේම දින 200ක් වගේ තියෙනවා (`SCRAPE_NLB_DRAWS`)
* **DLB** — `result/pagination_re` endpoint එකෙන් පිටු පිටු ගානේ (`SCRAPE_DLB_MAX_PAGES`)

```bash
npm run scrape          # මාස 6 (default)
SCRAPE_HISTORY_MONTHS=12 npm run scrape   # මාස 12
npm run sync-draws      # data.json → SQLite draws table (scrape එකේදී auto වෙනවා)
```

හැම scrape එකකට පස්සේ ඔක්කොම draws **`draws` table** එකට sync වෙනවා —
ඒ නිසා දිනයක් අනුව ඉක්මනින් හොයන්න පුළුවන් (calendar එකේ ඒකයි).

> ⚠️ කොච්චර කාලයක් ලැබෙනවද කියන එක **මූලික වෙබ් අඩවියේ තියෙන තරම** මත
> යැපෙනවා — ඔවුන් පරණ ප්‍රතිඵල අයින් කළොත් ඊට වඩා ගන්න බෑ.

## 5.7 🌐 භාෂාව · 🔳 QR · 🚫 Scan limit

**භාෂාව:** App එකේ උඩම menu එකේ `සිං | EN | தமி` switcher එකෙන් භාෂාව මාරු කරන්න
පුළුවන්. තේරීම `localStorage` එකේ රැකෙනවා.

**QR කියවීම:** මට්ටම් 3ක් — browser `BarcodeDetector` → **jsQR**
(`public/vendor/jsqr.min.js`, offline) → Gemini (`/api/qr`). ඒ නිසා **iPhone
(Safari) සහ Firefox වලත්** QR scan එක වැඩ කරනවා. QR එක ලොකු කරන්න
⚙️ උසස් සැකසුම් එකේ **Zoom** එක පාවිච්චි කරන්න.

**Scan limit:** දැන් **කිසිම user කෙනෙකුට දවසට/මාසෙට scan සීමාවක් නෑ**
(`UNLIMITED_SCAN` default `true`). පස්සේ දවසක limit දාන්න ඕන නම් `.env`
එකේ `UNLIMITED_SCAN=false` දාන්න — එතකොට `billing.js` එකේ `PLANS` වල
අගයන් වැඩ කරනවා. Abuse නවත්තන්න විනාඩියකට AI ඉල්ලීම් 20ක රේට් ලිමිට් එකක්
විතරක් තියෙනවා (ඒක user එකෙකුට දිනකට දෙන ප්රමාණයක් නෙවෙයි).

## 6.5 Security Checklist (production එකට යන්න කලින්)

- [ ] `JWT_SECRET` එක random අකුරු 32+ එකක් කරලා තියෙනවා (weak secret එකකින් tokens forge කරන්න පුළුවන්).
- [ ] `.env` එක git එකට commit කරලා **නෑ** (`.gitignore` එකේ දැනටමත් තියෙනවා).
- [ ] `GEMINI_API_KEY` / `PAYHERE_MERCHANT_SECRET` කිසිවක් client එකට leak වෙන්නේ නෑ
      (`/api/auth/google-client-id` විතරයි public — secret කිසිවක් නෑ).
- [ ] `PAYHERE_MODE=live` කරන්නේ test කරලා ඉවර වුනාට පස්සේ විතරයි.
- [ ] HTTPS පාවිච්චි කරනවා (camera scan එකටත් අනිවාර්යයි).
- [ ] Server එක proxy එකක් පිටුපස නම් `TRUST_PROXY=true` — නැත්නම් හැම user එකක්ම
      එකම IP එකෙන් එනවා කියලා guest scan quota එක වැරදි විදිහට ගණන් කරනවා.
- [ ] `data/app.db` එකට regular backup එකක් ගන්නවා (server එක නවත්තලා file එක copy කරන්න).

## 4.7 📢 Display Ads (දැන්වීම් දාන තැන)

App එකේ **ad slots 7ක්** දැනටමත් හදලා තියෙනවා — layout එකත් ඒවට ඉඩ තියලා හදලා:

| Slot | තැන | ප්‍රමාණය |
|---|---|---|
| `top` | tabs වලට යටින් | responsive |
| `scan` | Scan panel එකේ | 300×250 |
| `lucky` | 🍀 අනුමානය panel එකේ | 300×250 |
| `results` | ප්‍රතිඵල ලැයිස්තුවට යටින් | 300×250 |
| `history` | වාර්තාවට යටින් | responsive |
| `bottom` | පිටුවේ පහළම | responsive |
| `interstitial` | හැම 3වෙනි check එකකදී එන 5-තත්පර screen එක | 300×250 |

**දාන්නේ මෙහෙමයි:**

1. `public/index.html` open කරන්න
2. `const ADS = {` කියන කොටස හොයාගන්න (script එකේ මුල හරියේ)
3. ඔබේ ad network එකේ code එක අදාළ slot එකේ `html:` එකට paste කරන්න:

```js
const ADS = {
  enabled: true,
  showPlaceholders: true,
  adFreePlans: ['rs100', 'rs500', 'rs1000'],
  slots: {
    top: {
      size: 'responsive',
      html: '<ins class="adsbygoogle" style="display:block" ' +
            'data-ad-client="ca-pub-xxxxxxxx" data-ad-slot="1234567890" ' +
            'data-ad-format="auto" data-full-width-responsive="true"></ins>' +
            '<scr' + 'ipt>(adsbygoogle = window.adsbygoogle || []).push({});</scr' + 'ipt>'
    },
    // ... ඉතුරු slots
  },
};
```

⚠️ **වැදගත්:** `</scr` + `ipt>` කියලා දෙකට කැඩුවේ ඇයි කියලා හිතෙන්න පුළුවන් —
හේතුව: HTML එකේ inline `<script>` block එකක් ඇතුළේ කෙලින්ම `</script>` ලිව්වොත්
browser එක එතනින්ම script එක කපලා දානවා, එතකොට app එක කැඩෙනවා. ඒ නිසා
හැමවෙලාවෙම උඩ තියෙන විදිහට ලියන්න.

**වෙනත් දේවල්:**
- `showPlaceholders: true` නිසා හිස් තැන්වල "දැන්වීම් ස්ථානය" කියලා පෙන්නනවා
  (layout එක ස්ථාවරව තියෙන්න). ඇත්ත code එක දැම්මට පස්සේ ඒක තනියම අයින් වෙනවා.
- දැන්වීම් **සම්පූර්ණයෙන්ම අක්‍රිය** කරන්න ඕන නම් `enabled: false` කරන්න.
- Premium plans (Rs.100/500/1000) වල අයට දැන්වීම් පෙන්නන්නේ නෑ (`adFree: true`).
- AdSense පාවිච්චි කරනවා නම් `public/index.html` එකේ `<head>` එකට Google දෙන
  loader script එක `<script async src="..."></script>` විදිහට එකතු කරන්න
  (**එහෙම කරද්දීත් ඒක දෙකට කඩන්න එපා** — ඒක වෙනම `<script>` tag එකක් නිසා අවුලක් නෑ).

## 7. 🔄 ප්‍රතිඵල ස්වයංක්‍රීයව ලබාගැනීම (Auto-scrape)

දැන් **අතින් මොකුවත් කරන්න ඕන නෑ**:

1. **Cron එකක්** — දිනකට දෙපාරක් (**09:30** සහ **21:30**, Asia/Colombo) ස්වයංක්‍රීයව
   `scraper.js` run කරලා `data.json` අලුත් කරනවා. (NLB/DLB ප්‍රතිඵල නිකුත් වෙන වෙලාවලට.)
2. **Server start වෙද්දී** — දත්ත පැය 8කට වඩා පරණ නම් එක පාරක් background එකේ
   scrape කරනවා. ඒ නිසා කීප දවසක් වැහිලා තිබ්බත් ආයෙ දාන කොට අලුත් දත්ත එනවා.
3. **Admin ට manual refresh** — 🛠️ පරිපාලනය → 📈 Overview → **🔄 දැන්ම ප්‍රතිඵල අලුත් කරන්න**.
   එතනම අවසන් උත්සාහය සාර්ථක උනාද, lottery කීයක් ගත්තද, දත්ත අලුත්ද කියලත් පේනවා.

Server log එකේ මේක පේනවා නම් cron එක active:
```
✓ Auto-scrape cron: "30 9,21 * * *" (Asia/Colombo) — දිනකට දෙපාරක්.
```

⏰ වෙන වෙලාවකට ඕන නම් `.env` එකේ `SCRAPE_CRON` එක වෙනස් කරන්න.

Manual ලෙස ඕන ඕන වෙලාවක:
```bash
npm run scrape
```

🛡️ **දත්ත ආරක්ෂාව:** scrape එකක් fail උනොත් (internet නෑ, site එක වෙනස් වුනා)
පරණ දත්ත **නැති වෙන්නේ නෑ** — ඒ ලොතරැයියේ පරණ ප්‍රතිඵල ඒ විදිහටම තියෙනවා.
සම්පූර්ණයෙන්ම fail උනොත් `data.json` එකම ලියන්නේ නෑ.

## 7.5 🍀 Premium feature: මගේ වාසනාව

- `.env` එකේ **කිසිම setup එකක් අවශ්‍ය නෑ** — Gemini key එක තියෙනවා නම් AI යෝජනාව
  එනවා, නැත්නම් සංඛ්‍යාලේඛන පදනම් කරගත් යෝජනාව පමණක් පෙන්නනවා (crash නෑ).
- **Free plan එකෙන් බලන්න බෑ** — `rs100` / `rs500` / `rs1000` plan එකක් ඕන
  (`/api/lucky/*` endpoints 402 දෙනවා).
- හැම අනුමාන උත්සාහයකටම **disclaimer එකට එකඟ වීම අනිවාර්යයි** — client එකේ modal
  එකෙන් විතරක් නෙවෙයි, **server එකෙනුත්** (`agreedDisclaimer: 'v1'` නැත්නම් 400).
  ඒ නිසා කිසිම විදිහකට disclaimer එක bypass කරන්න බෑ.
- හැම අනුමානයක්ම `guesses` table එකේ save වෙනවා (user history + audit).

⚠️ Serverless/short-lived process environment එකක deploy කළොත් (process එක
24/7 run නොවෙන තැනක) `node-cron` schedule එක reliable විදිහට වැඩ කරන්නේ නෑ —
ඒ වගේ තැනකට OS-level cron / hosting platform එකේම scheduled job feature එක
(`npm run scrape` command එක trigger කරන) පාවිච්චි කරන්න.

## 8. Ready-to-use without any setup

මේ features ටික `.env` credentials කිසිවක් නැතුව දැනටමත් full ලෙස වැඩ කරනවා:
- **📷 කැමරා Scan** (ප්‍රධාන CTA එක) — focus/crop/zoom ඔක්කොම browser එකෙන්ම
- Manual Check (dynamic digit boxes + auto-advance + auto-focus boxes)
- Latest Results (lottery 16ටම)
- History (guest ලාට localStorage, login වුනාම server-side)
- **🔄 Auto-scrape** — cron එකට කිසිම setup එකක් ඕන නෑ
- **📢 Ad slots 7** — placeholder ටික දැනටමත් තියෙනවා
- First-visit Disclaimer modal + fixed disclaimer text
- Sinhala Zodiac dropdown
