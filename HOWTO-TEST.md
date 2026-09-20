# 🎟️ ලොතරැයි App එක — Test කරන විදිය

> කිසිම දෙයක් නොදන්නවා කියලා හිතලා ලියලා තියෙන්නේ.
> පිළිවෙළට කරන්න. පියවරක් skip කරන්න එපා.

---

## කලින් තේරුම් ගන්න ඕන දේ

මේ app එකේ **කොටස් 2ක්** තියෙනවා:

| කොටස | මොකද කරන්නේ | File එක |
|---|---|---|
| 🔧 **Backend** (පිටිපස්සේ) | NLB/DLB සයිට් වලින් results අරන් තියාගන්නවා | `scraper.js`, `server.js` |
| 🎨 **Frontend** (ඉස්සරහ) | ඔයා දකින page එක | `public/index.html` |

Backend එක **run වෙලා තියෙන්න ඕන**, එතකොට තමයි frontend එකට results පේන්නේ.

---

## 🪜 පියවර 1 — Node.js තියෙනවද බලන්න

App එක run කරන්න **Node.js** කියන එක ඕන. (JavaScript run කරන program එකක්.)

**Terminal එකක් open කරන්න:**
- **Windows:** Start button → `cmd` කියලා type කරලා Enter
- **Mac:** Cmd+Space → `terminal` කියලා type කරලා Enter
- **Linux:** Ctrl+Alt+T

මේක type කරලා Enter ගහන්න:

```bash
node --version
```

**මොකද වෙන්නේ:**

✅ `v22.23.2` වගේ දෙයක් ආවොත් → හොඳයි, පියවර 2ට යන්න

❌ `command not found` කිව්වොත් → Node.js install කරන්න ඕන:
1. [nodejs.org](https://nodejs.org) එකට යන්න
2. **LTS** කියන ලොකු green button එක click කරන්න
3. Download උන file එක open කරලා Next → Next → Install
4. **Terminal එක close කරලා අලුතෙන් open කරන්න** (මේක වැදගත්!)
5. නැවත `node --version` try කරන්න

---

## 🪜 පියවර 2 — Folder එකට යන්න

Terminal එකේ මේක type කරන්න (folder එකේ path එක ඔයාගේ පරිගණකයේ තියෙන තැන):

```bash
cd lk-lottery-master
```

හරියටම ගියාද බලන්න:

```bash
ls
```
*(Windows නම් `dir` කියලා type කරන්න)*

**මේ files පේන්න ඕන:**
```
data.json    node_modules    package.json
public       scraper.js      server.js      test.js
```

මේවා පේනවා නම් ✅ හරි තැන. නැත්නම් `cd` command එක වැරදියි.

---

## 🪜 පියවර 3 — අවශ්‍ය දේවල් install කරන්න

```bash
npm install
```

විනාඩියක් විතර යනවා. පොඩි warning ටිකක් ආවත් කමක් නෑ.

`node_modules` කියන folder එක හැදුනොත් ✅ හරි.

---

## 🪜 පියවර 4 — Results ගන්න (scraper එක)

මේක තමයි NLB සහ DLB සයිට් වලට ගිහින් results අරන් එන කොටස.

```bash
npm run scrape
```

**මෙහෙම එන්න ඕන:**

```
DLB scrape කරනවා...
  ✓ DLB: lottery 8ක්
NLB scrape කරනවා...
  ✓ Mahajana Sampatha: draw 20ක්
  ✓ Govisetha: draw 20ක්
  ✓ Dhana Nidhanaya: draw 20ක්
  ✓ Mega Power: draw 20ක්
  – Lucky 7: නවත්තලා (skip)
  ✓ Handahana: draw 20ක්
  ...
Saved → data.json (lottery 16ක්)
```

### 🔍 මොනවද මේ පේන්නේ

| ලකුණ | තේරුම |
|---|---|
| `✓` | හොඳින් ගත්තා |
| `–` නවත්තලා | ඒ ලොතරැයිය NLB එකෙන්ම නවත්තලා. **වැරැද්දක් නෙවෙයි** |
| `✗ fail` | ප්‍රශ්නයක්. Internet එක බලන්න |

**"lottery 16ක්" කියලා ආවොත් ✅ සාර්ථකයි.**

⚠️ **වැදගත්:** Internet connection එකක් ඕන. `fetch failed` කිව්වොත් internet එක check කරන්න.

---

## 🪜 පියවර 5 — Tests run කරන්න

මේකෙන් බලනවා ඔක්කොම හරියට වැඩ කරනවද කියලා. **App එක open කරන්න කලින් මේක කරන්න.**

```bash
npm test
```

**මෙහෙම එන්න ඕන (අන්තිම කොටස):**

```
========================================
✓ Pass: 44   ✗ Fail: 0
========================================
```

### 🔍 Fail 0 නම් ✅ ඔක්කොම හරි

Fail එකක් ආවොත් ඒක මොකක්ද කියලා උඩින් පේනවා. උදාහරණයක්:

```
  ✗ අංක ඔක්කොම digits විතරයි
      → handahana: bad number "TAURUS"
```

මේකෙන් කියන්නේ Handahana එකේ රාශියක් අංකයක් විදිහට කියවලා කියලා. (මේක මම දැනටමත් හදලා තියෙනවා.)

**මොකද මේ test 44න් බලන්නේ:**
- දිනය හරියට convert වෙනවද (`Monday September 07, 2026` → `2026-09-07`)
- දිනපු ticket එකකට "දිනලා" කියනවද
- නොදිනපු එකකට "නෑ" කියනවද
- Duplicate අංක දෙපාරක් ගණන් ගන්නේ නැද්ද
- Scrape කරපු data එකේ හැම draw එකකටම අංක තියෙනවද
- **(අලුත්) ඇත්ත Prize Structure එකෙන් හරි Rs. amount එක ම එනවද** — Mahajana Sampatha, Govisetha, Mega Power, Ada Kotipathi, Handahana, Jaya Sampatha, Ada Sampatha (sub-game 3ම), Suba Dawasak (sub-game 2ම) — hardest cases (positional, multi-game, super number, zodiac) ඔක්කොම cover කරනවා

---

## 🪜 පියවර 6 — App එක ක්‍රියාත්මක කරන්න

```bash
npm start
```

**මෙහෙම එනවා:**
```
Server: http://localhost:3000
```

⚠️ **මේ terminal එක වහන්න එපා!** වැහුවොත් app එක නවතිනවා.
*(නවත්තන්න ඕන වෙලාවක `Ctrl + C` ගහන්න)*

දැන් **browser එකක්** (Chrome) open කරලා address bar එකට මේක type කරන්න:

```
http://localhost:3000
```

---

## 🪜 පියවර 7 — App එක අතින් test කරන්න

### ✅ Test 1 — Page එක load වෙනවද

**බලන්න ඕන:**
- උඩින් 🎟️ **ලොතරැයි ප්‍රතිඵල** කියලා තද කහ පාටින්
- Tabs 3ක්: `✍️ අතින් Check` · `📋 අද Results` · `📷 Scan`
- පහළින් dropdown එකක්

❌ පිටුව හිස් නම් → server එක run වෙනවද බලන්න (පියවර 6)

---

### ✅ Test 2 — දිනපු ticket එකක්

මේකෙන් බලනවා **win detection** එක වැඩ කරනවද කියලා.

1. Dropdown එකෙන් **Mahajana Sampatha (NLB)** තෝරන්න
2. **Box 7ක් එනවා** — පළවෙනි එක නිල් පාට (අකුරට), අනිත් 6 අංක වලට
3. Draw අංකය **හිස්ව තියන්න**
4. Boxes වලට මේ අගයන් දාන්න:

```
Z  8  1  7  7  1  2
```

> 💡 එක box එකකට type කරාම cursor එක ඊළඟ box එකට **තනියම** යනවා

5. **පරීක්ෂා කරන්න** button එක click කරන්න

**බලන්න ඕන:**
```
┌────────────────────────────┐
│    🎉 ඔයා දිනලා!            │  ← කොළ පාට
│      [ JACKPOT ]            │
│   Z  8  1  7  7  1  2       │  ← ඔක්කොම කොළ පාටින්
└────────────────────────────┘
```
යටින් details: ලොතරැයිය, Draw අංකය, දිනය, ගැලපුණු අංක **6/6**

⚠️ **මේ අංක වෙනස් වෙනවා!** උඩ තියෙන `Z 8 1 7 7 1 2` කියන්නේ **2026-09-07 වෙනිදාට**. ඔයා test කරන දවසේ අලුත් draw එකක් තියෙනවා නම් අංක වෙනස්. **හරි අංක ගන්න විදිය:** `📋 අද Results` tab එකට ගිහින් Mahajana Sampatha එකේ අංක බලලා, ඒවා copy කරන්න.

---

### ✅ Test 3 — නොදිනපු ticket එකක්

1. Page එක **refresh** කරන්න (F5)
2. නැවත **Mahajana Sampatha** තෝරන්න
3. **වැරදි අංක** දාන්න:

```
Q  3  4  5  6  9  0
```

4. **පරීක්ෂා කරන්න** click කරන්න

**බලන්න ඕන:**
```
┌────────────────────────────┐
│   😔 මේ වතාවේ නෑ            │  ← අළු පාට
│   Z  8  1  7  7  1  2       │  ← නිල ප්‍රතිඵලය
└────────────────────────────┘
```
ගැලපුණු අංක: **0/6**

---

### ✅ Test 4 — පරණ draw එකක්

1. **Mahajana Sampatha** තෝරන්න
2. Draw අංකයට: `6300`
3. අංක: `C 1 6 2 9 1 4`
4. Check කරන්න

**බලන්න ඕන:** 🎉 දිනලා, Draw 6300, දිනය 2026-09-04

මේකෙන් තහවුරු වෙනවා **පරණ draws** වලටත් check කරන්න පුළුවන් කියලා.

---

### ✅ Test 5 — වෙනස් lottery වර්ග

Dropdown එකේ lottery 16ක් තියෙනවා. **box ගණන වෙනස් වෙනවා** — ඒක බලන්න:

| ලොතරැයිය | Boxes | විශේෂත්වය |
|---|---|---|
| **Sasiri** (DLB) | 3 | අකුරක් නෑ |
| **Ada Kotipathi** (DLB) | 1 + 4 | අකුරක් තියෙනවා |
| **Kapruka** (DLB) | 1 + 5 | |
| **Suba Dawasak** (NLB) | 7 | අකුරක් නෑ |
| **Ada Sampatha** (NLB) | 1 + 9 | **වැඩිම** |
| **Lagna Wasana** (DLB) | 4 | රාශි lottery |

එකින් එක තෝරලා box ගණන මාරු වෙනවද බලන්න. ✅

---

### ✅ Test 6 — අද Results tab එක

`📋 අද Results` click කරන්න.

**බලන්න ඕන:** lottery 16ක list එකක්, එකින් එකට:
- නම + `NLB` හෝ `DLB` badge එකක්
- Draw අංකය + දිනය
- පොඩි වටකුරු අංක

---

### ✅ Test 6.5 — ඇත්ත Prize Amount එක (Rs.) හරියටම එනවද

මේකෙන් තහවුරු වෙනවා **app එකේ prize logic එක NLB/DLB නිල Prize Structure එකෙන්ම** කියලා — placeholder logic එකක් නෙවෙයි.

1. `✍️ අතින් Check` tab එකට යන්න
2. **Mahajana Sampatha** තෝරන්න
3. `📋 අද Results` tab එකෙන් අද දවසේ **ම** Letter + 6 Numbers copy කරගන්න
4. ආපහු `✍️ අතින් Check` එකට ගිහින් **ඒම** අංක + letter දාන්න
5. Check කරන්න

**බලන්න ඕන:**
```
🎉 ඔයා දිනලා!
[ Letter and 6 Numbers Correct ]
     Rs. 20,000,000.00      ← මෙච්චරම විශාල අගයක් පේන්න ඕන
```

මේ `Rs. 20,000,000.00` කියන්නේ Mahajana Sampatha එකේ **Super Prize** එකයි — [nlb.lk/results/mahajana-sampatha](https://www.nlb.lk/results/mahajana-sampatha) එකේ ම Prize Structure එකේ ම amount එක. **ඕන lottery එකකදීම මේ විදිහට NLB/DLB official page එකේ Prize Structure table එකත් එක්කම compare කරලා බලන්න.**

#### Zodiac lottery test (Lagna Wasana, Handahana, Suba Dawasak)

1. **Lagna Wasana** තෝරන්න — "රාශිය (Zodiac Sign)" dropdown එකක් extra ලෙස පේනවා
2. අද දවසේ රාශිය + අංක 4 දාන්න
3. Check කරන්න → **Rs. 3,000,000.00** (Super) පේන්න ඕන

#### Multi-game lottery test (Ada Sampatha)

1. **Ada Sampatha** තෝරන්න — "Game එක තෝරන්න" dropdown එකක් extra ලෙස පේනවා (2/3/4-digit+letter)
2. එකින් එක game එක තෝරලා, ඒ game එකේම box ගණන වෙනස් වෙනවද බලන්න
3. 4-digit+letter game එකෙන් Check කරොත් → **Rs. 250,000.00** (letter+4 numbers) හෝ **Rs. 50,000.00** (4 numbers විතරක්)

⚠️ **මේ tiers ටික use කරමින්:**
- **SET match** — Govisetha, Handahana, Dhana Nidhanaya, Mega Power, Ada Kotipathi, Shanida, Super Ball, Kapruka, Lagna Wasana, Sasiri, Ada Sampatha, Suba Dawasak (sub-games) — පිළිවෙළ අදාළ නෑ
- **POSITIONAL match** — Mahajana Sampatha, NLB Jaya, Supiri Dhana Sampatha (Last-N/First-N), Jaya Sampatha (**strictly** back-to-forward විතරයි — First-N නෑ)
- **MULTI-GAME** — Ada Sampatha (independent sub-game 3ක්), Suba Dawasak (independent sub-game 2ක්) — එකකට දිනුවත් අනිත් එකට බලපාන්නේ නෑ

#### දැනට "check කරන්න බෑ" කියලා පෙන්නන cases (intentional — guess කරන්නේ නෑ)

| Lottery | ප්‍රශ්නය |
|---|---|
| **Waasi** (DLB) | දැනට DLB සයිට් එකේම live draw දත්තයක් නෑ ("No Data Found") |
| **Dhana Nidhanaya** 9th tier ("Special Letter Correct") | ඒ second letter එක NLB public results page එකේ පෙන්නන්නේ නෑ — data තියෙන්නේ නෑ නිසා ඒ tier එක check කරන්න බෑ (අනිත් tiers 8ම හරියටම වැඩ කරනවා) |

මේ දෙකෙදිම app එක **වැරදි answer එකක් දෙනවට වඩා** "unavailable" කියලා පැහැදිලිව කියනවා.

---

### ✅ Test 7 — Ad Break (හැම 3වෙනි Check එකකටම)

මේක **revenue** එකට දාපු feature එක. Check කරන හැම 3වෙනි වතාවෙම, ප්‍රතිඵලය පේන්න කලින් තත්පර 5ක ad screen එකක් පෙන්නනවා.

1. Page එක **refresh** කරන්න (counter එක browser එකේ `localStorage` එකේ ඉතුරු වෙනවා — 1,2,3 check කරොත් ඊළඟ session එකේත් 4,5,6 විදිහට continue වෙනවා. ඒක bug එකක් නෙවෙයි, purposeful behavior එකක්.)
2. **පරීක්ෂා කරන්න** button එක **3 වතාවක්** click කරන්න (ඕන ලොතරැයියක, ඕන අංකයක් — වැදගත් වෙන්නේ 3වෙනි click එක)
3. **1 සහ 2 වෙනි check එකේදී** — කෙලින්ම result එක පෙන්නන්න ඕන (ad නෑ)
4. **3වෙනි check එකේදී** — screen එක අඳුරු වෙලා මැදින් box එකක් එන්න ඕන:

```
┌─────────────────────────────┐
│  දැන්වීම 5 තත්පරයෙන් ඉවර වේ  │
│  ┌───────────────────────┐  │
│  │  Ad Placeholder        │  │
│  │  300x250               │  │
│  └───────────────────────┘  │
│  [ දිගටම කරගෙන යන්න (5) ]   │
└─────────────────────────────┘
```

5. Countdown එක 5 → 0 වෙනකන් button එක **disabled** (click කරන්න බෑ)
6. 0 ආවම button එක **enable** වෙනවා → click කරන්න
7. ඊට පස්සේ ලොතරැයි ප්‍රතිඵලය සාමාන්‍ය විදිහටම පෙන්නනවා

**බලන්න ඕන:** ✅ 1,2-check → ad නෑ · 3-check → ad → 4,5-check → ad නෑ · 6-check → ad ...

⚠️ **දැනට තියෙන්නේ placeholder box එකයි** (ඇත්ත ad එකක් නෙවෙයි). ඇත්ත AdSense ad එකක් පෙන්නන්න:
1. [Google AdSense](https://www.google.com/adsense/) එකට site එක submit කරලා **approve** වෙන්න ඕන (traffic ටිකක් තියෙන්න ඕන, දවස් ගණනක් යනවා)
2. Approve උනාට පස්සේ ලැබෙන `<script>` + `<ins class="adsbygoogle">` code එක `public/index.html` එකේ `id="adSlot"` කියන `<div>` එක ඇතුළේ දාන්න
3. Domain root එකට `ads.txt` file එකක් දාන්න ඕන (AdSense dashboard එකෙන් කියලා දෙනවා)

---

### ✅ Test 8 — AI Camera Scan (Gemini Vision)

⚠️ **වැදගත්:** Camera එක `localhost` එකේ **වැඩ කරනවා**. ඒත් phone එකකින් වෙන පරිගණකයක app එකට connect කරොත් **HTTPS ඕන** — නැත්නම් browser එක camera එක දෙන්නේ නෑ.

**මේක දැන් OCR (Tesseract) එකක් නෙවෙයි — AI Vision model එකක් (Google Gemini).** ඒකෙන් photo එකක් **එකවර** විශ්ලේෂණය කරලා lottery නම, draw No එක, ඉලක්කම්, අකුර, රාශිය ඔක්කොම structured විදිහට හඳුනාගන්නවා. Camera එක නිශ්චලව තියාගෙන ඉන්න අවශ්‍ය නෑ — photo එක clear නම් ඇති.

#### 🔑 මුලින්ම — GEMINI_API_KEY setup කරන්න (එක වතාවක් විතරයි)

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) එකට යන්න (Google account එකකින් login වෙන්න)
2. **Create API Key** click කරන්න — **FREE** (card එකක්වත් දාන්න ඕන නෑ)
3. project folder එකේ `.env` කියලා file එකක් හදන්න (`.env.example` එකේ copy එකක් හදලා rename කරන්න):
   ```
   GEMINI_API_KEY=AIzaSy....ඔයාගේ key එක මෙතන....
   ```
4. Server එක restart කරන්න: `Ctrl+C` ගහලා `npm start`

⚠️ `.env` file එක **කවදාවත් git/GitHub එකට commit කරන්න එපා** — key එක leak වෙනවා. (`.gitignore` එකේ දැනටමත් ඇතුළත් කරලා තියෙනවා.)

#### Manual test

1. `📷 Scan` tab එක click කරන්න
2. **📸 Camera එක විවෘත කරන්න** click කරන්න (හෝ "🖼️ Gallery එකෙන් photo එකක් උඩුගත කරන්න" / "📱 Phone එකේ camera app එකෙන් ගන්න" එකෙන් photo එකක් තෝරන්න)
3. Browser එකෙන් permission එකක් අහනවා → **Allow**

   **Camera window එක ගැන:** ඒක තිරයේ පළලම ගන්නවා (card එකෙනුත් එළියට
   යනවා) සහ උස 320px+. රාමුවක් (dashed) ඇතුළේ ලොතරැයි පත්‍රිකාව තියන්න.
   පහළ වම් කෙළවරේ status chip එකේ resolution + focus mode එක පේනවා
   (උදා: `1920×1080 · focus: continuous ✓`).
4. ලොතරැයි පත්‍රිකාවක් camera එකට ගන්න (whole ticket එකම, angle ලේසි)
5. Photo එක blurry නම් **🎯 නැවත Focus කරන්න** ඔබලා තත්පරයක් ඉඳලා photo ගන්න
6. **📷 Photo ගන්න → Scan කරන්න** click කරන්න
7. Photo එක උඩින් **scan වෙනවා වගේ තද කහ පාට line එකක් උඩ-පහළ යනවා**,
   photo එක අඳුරු වෙලා, පහළින් `🤖 AI එක photo එක කියවමින්...` පේනවා
   (තත්පර 2-6ක් යනවා).

**බලන්න ඕන — දෙකක් එකපාරම:**

**(අ) දිනුම් ප්‍රතිඵලය — මේක තමයි උඩින්ම එන්නේ:**

```
┌──────────────────────────────────────┐
│  🎯 Scrape කරපු ප්‍රතිඵලයත් එක්ක match එක │
│                                      │
│      🎉 ඔයා දිනලා!                    │
│   [ Letter and 6 Numbers Correct ]   │
│        Rs. 20,000,000.00             │
│   නිල ප්‍රතිඵලය: [T][7][8][2][9][1][5] │
│   ගැලපුණු අංක: 6/6                  │
└──────────────────────────────────────┘
```

Photo එකේ උඩින් badge එකත් මෙහෙම වෙනවා: **🎉 දිනුමක් තියෙනවා! පහළින් බලන්න**
දිනුමක් නැත්නම් **✓ Scan ඉවරයි — දිනුමක් නෑ** කියලා එනවා (result card එක අළු පාටින්).

**(ආ) AI එක කියෙව්ව දේ — ඊට යටින්:**

```
🤖 AI කියෙව්වේ මෙහෙමයි
විශ්වාසය: high
┌─────────────────────────┐
│ ලොතරැයිය: Mahajana...  → Mahajana Sampatha ✓
│ Draw අංකය: 6308
│ දිනය: 2026-09-12
│ [T] [7][8][2][9][1][5]
└─────────────────────────┘
[ ✍️ "අතින් Check" එකට auto-fill කරන්න ]
```

8. AI එකට ලොතරැයිය හඳුනාගන්න බැරි උනොත් (`❓ ලොතරැයිය හඳුනාගන්න බැරි උනා`) → ලැයිස්තුවෙන්
   තෝරලා අතින් Check කරන්න. ඉලක්කම් කියවන්න බැරි උනොත් (blurry photo) → පැහැදිලි
   photo එකක් ආයෙ ගන්න.
9. හරි අංක පේනවා නම් **"අතින් Check" එකට auto-fill කරන්න** button එක click කරන්න →
   `✍️ අතින් Check` tab එකට auto-jump වෙලා, boxes ටික auto-fill වෙනවා
10. Boxes වල අගයන් **ඔයාම නැවත බලලා** (AI වැරදිලා තියෙන්න පුළුවන්) Check කරන්න

> 💡 **Scan limit:** දැනට `.env` එකේ `UNLIMITED_SCAN=true` නිසා scan කීයක් උනත්
> කරන්න පුළුවන්. Test ඉවර වුනාම `false` කරන්න — එතකොට guest 2/day,
> Free 3/day limits ආපහු වැඩ කරනවා.

**GEMINI_API_KEY එක නැත්නම්** — "⚙️ Setup ඕන" කියලා පැහැදිලි error message එකක් + setup instructions පෙන්නනවා (crash වෙන්නේ නෑ).

😐 **AI එකට වැරදෙන්නත් පුළුවන් (specially අඳුරු photo, angle වැරදි).** ඒකයි "වැරදි වෙන්න පුළුවන්" කියලා disclaimer එකක් හැමවිටම දාන්නේ.

---

## 🐛 ප්‍රශ්න ආවොත්

| ප්‍රශ්නය | හේතුව | විසඳුම |
|---|---|---|
| `command not found: node` | Node නෑ | පියවර 1 නැවත |
| `Cannot find module 'express'` | Install කරලා නෑ | `npm install` |
| Page එක load වෙන්නේ නෑ | Server නවතිලා | Terminal එකේ `npm start` |
| Dropdown එකේ "Error: server ක්‍රියාත්මක නෑ" | Server නවතිලා | `npm start` |
| Dropdown එක හිස් | data.json නෑ | `npm run scrape` |
| `EADDRINUSE` | Port 3000 වෙන එකක් පාවිච්චි කරනවා | `PORT=3001 npm start` |
| Scrape එකේ `fetch failed` | Internet නෑ | Connection එක බලන්න |
| Camera එක වැඩ කරන්නේ නෑ | HTTPS නෑ / permission නෑ | localhost එකේ try කරන්න |
| Sinhala අකුරු කොටු වගේ | Font එක නෑ | Chrome පාවිච්චි කරන්න |
| Scan tab එකේ "⚙️ Setup ඕන" | `GEMINI_API_KEY` .env එකේ නෑ | Test 8 එකේ setup steps කරන්න |
| Scan එකේ "API_KEY_INVALID" | Key එක වැරදියි / copy වැරදියි | aistudio.google.com/apikey එකෙන් අලුත් key එකක් |
| Scan එකේ "limit එක ඉක්මවලා" (429) | Gemini free tier limit එක ගැහුනා | පොඩ්ඩක් ඉඳලා try කරන්න |

---

## 📁 මොනවද මේ files

```
lk-lottery-master/
├── server.js              ← API එක (check logic එක මෙතන)
├── scraper.js             ← NLB + DLB වලින් results අරන් එනවා
├── prizes.js              ← ඇත්ත Prize Structure engine (Rs. amounts ඔක්කොම මෙතන)
├── vision.js              ← AI Scan — Gemini vision REST API
├── auth.js                ← Register / Login / Google Sign-In / JWT
├── billing.js             ← Plans, scan quota, PayHere checkout + notify
├── db.js                  ← SQLite layer (better-sqlite3)
├── env.js                 ← .env loader (dependency එකක් නැතුව)
├── test.js                ← Automated tests 44ක් (npm test)
├── test-gemini.js         ← Gemini key/model check (npm run test:gemini)
├── data.json              ← Scrape කරපු results (auto-generate)
├── data/                  ← SQLite DB — users + payments (auto-generate)
├── .env                   ← ඔයාගේ secrets (git එකට යන්නේ නෑ)
├── .env.example           ← Template — copy කරලා .env හදන්න
├── README.md              ← Full documentation
├── SETUP.md               ← Credentials setup (Gemini / Google / PayHere)
├── HOWTO-TEST.md          ← මේ file එක
├── package.json           ← Project settings
└── public/
    ├── index.html         ← ඔයා දකින page එක (ඔක්කොම එකේ)
    ├── app-icon.svg       ← App icon
    ├── icon-192.png · icon-512.png · apple-touch-icon.png · favicon-32.png
    └── manifest.webmanifest
```

---

## 🔧 මම හදපු වැදගත් දේවල් 4ක්

### 1. NLB එකේ bot-check එක

NLB සයිට් එකට කෙලින්ම request එකක් යැව්වම **363 bytes** විතරයි එන්නේ — ඇත්ත page එක නෙවෙයි. ඇතුළේ මෙහෙම script එකක්:

```javascript
setCookie('human','000f030e26...',1);
location.reload();
```

මේක bot-block එකක්. **විසඳුම:** ඒ cookie එක extract කරලා දෙවෙනි request එකට දාන්න ඕන. එතකොට **277KB** ඇත්ත page එක එනවා. `scraper.js` එකේ `nlbFetch()` function එකේ තියෙන්නේ ඒක.

මේක **ඔයාට තනියම හොයාගන්න අමාරු දෙයක්** — normal scraper එකක් මෙතන fail වෙනවා.

### 2. රාශි lottery + Super Number + Multi-game

- Handahana, Lagna Wasana, Suba Dawasak වගේ ඒවායේ **රාශියක්** තියෙනවා (`TAURUS` වගේ). Lagna Wasana එකේ ඒක `<img>` icon එකක් විදිහට එනවා (text නෙවෙයි) — ඒක Sinhala filename → English zodiac name map එකකින් convert කළා.
- Mega Power, Kapruka වගේ ඒවායේ **Super Number** කියලා වෙනම number එකක් තියෙනවා — regular numbers එක්ක මිශ්‍ර නොවෙන්න වෙනම field එකකට extract කළා.
- Ada Sampatha, Suba Dawasak වගේ ඒවා ඇත්තටම **වෙනම lottery 3ක් / 2ක්** එකම row එකේ පෙන්නන එකක්. ඒවා flat merge කරොත් prize calculation එක වැරදියි — වෙනම `subGames` array එකකට split කළා.

### 3. ඇත්ත Prize Structure Engine (`prizes.js`)

මුලින් තියෙන්නේ "අංක 3ක් ගැලපුණොත් දිනලා" වගේ **සරල placeholder logic** එකක්. දැන් lottery 16න් 15කටම (Waasi හැරෙන්නට, live data නැති නිසා) NLB/DLB **නිල Prize Structure** table එකෙන්ම හදපු exact tier + Rs. amount logic එකක් තියෙනවා. Match mechanic 3ක් handle කරනවා:
- **SET** — order අදාළ නෑ (Govisetha වගේ)
- **POSITIONAL** — Last-N/First-N, එකක් break උනාම නවතිනවා (Mahajana Sampatha, Jaya Sampatha වගේ)
- **MULTI-GAME** — sub-game එකින් එක වෙනම calculate වෙනවා (Ada Sampatha, Suba Dawasak)

### 4. Camera Scan — OCR (Tesseract) වෙනුවට AI Vision (Gemini)

මුලින් තිබ්බේ Tesseract.js (browser-side OCR) එකක්. ඒකෙන් character තියෙනවද කියලා විතරයි කියවෙන්නේ — lottery එක මොකක්ද, draw No එක මොකක්ද, ඉලක්කම් vs serial number වෙන් කරගන්න බෑ. Camera එකත් stable ව අල්ලගෙන ඉන්න ඕන, angle ටිකක් වැරදුනොත් fail.

**දැන් `vision.js`** — photo එක Google Gemini vision API එකට යවලා, structured JSON එකක් (lottery, draw No, numbers, letter, zodiac, super number, confidence) එකවර ලබාගන්නවා. Slug එක AI hallucinate කළොත් `data.json` එකේ ඇත්තටම තියෙනවද verify කරලා invalid නම් null කරනවා (misleading result එකක් නොදෙන්න).

⚠️ මේකට **`GEMINI_API_KEY`** setup කරගන්න ඕන (FREE, [HOWTO-TEST.md Test 8](#-test-8--ai-camera-scan-gemini-vision) බලන්න). Key එක නැත්නම් crash වෙන්නේ නෑ — clear setup instructions එකක් පෙන්නනවා.

---

## ⚠️ මේක **prototype** එකක් — production සම්පූර්ණයෙන්ම නෙවෙයි

වැඩ කරන දේවල්:
- ✅ NLB + DLB scraping (bot-check bypass එක්ක)
- ✅ Lottery 16ක්, draws 168ක්
- ✅ **ඇත්ත Prize Structure engine — lottery 15ක්ම (Rs. amount exact)**
- ✅ Manual check + zodiac/super-number/multi-game support
- ✅ **AI Camera Scan (Gemini Vision)** — structured lottery/numbers/letter/zodiac extraction,
  scan animation + **එවලේම scrape කරපු ප්‍රතිඵලත් එක්ක match කරලා දිනුම Rs. amount එකත් එක්කම පෙන්නනවා**
- ✅ Ad break (හැම 3වෙනි check එකකටම, placeholder ad slot එකක්)
- ✅ Automated tests 44ක්

**තවම නැති, ඒත් production එකට අනිවාර්ය දේවල්:**

| නැති දේ | ඇයි වැදගත් |
|---|---|
| 🔴 **Database** | දැන් `data.json` file එකක් විතරයි. Users වැඩි උනාම PostgreSQL ඕන |
| 🔴 **Auto scrape** | දැන් අතින් `npm run scrape` කරන්න ඕන. Cron job එකක් ඕන (හැමදාම රෑ 8.45ට) |
| 🟠 **ඇත්ත AdSense** | Placeholder box එකක් විතරයි දැන්. Google AdSense approve වෙන්න ඕන (traffic + review time) |
| 🟠 **Gemini API key production cost** | Free tier limit එකක් තියෙනවා. Traffic වැඩි උනොත් paid tier එකට යන්න වෙනවා |
| 🟠 Dhana Nidhanaya 9th tier | Special Letter data NLB page එකේ නැති නිසා check කරන්න බෑ |
| 🟠 Waasi | දැනට live draw data නෑ (DLB සයිට් එකේම) |
| 🟠 SEO pages | Google traffic එකට |
| 🟠 My Tickets | Retention එකට |

---

## 🎯 ඊළඟට

App එක වැඩ කරනවා දැක්කට පස්සේ:

1. **Database** — `data.json` වෙනුවට PostgreSQL
2. **Cron job එකක්** — හැමදාම automatic scrape
3. **Google AdSense approval** — real ad revenue
4. **SEO** — traffic සඳහා

---

# 🆕 අලුත් Features — අතින් test කරන විදිය

## Test 9 — Register / Login (පරණ ප්‍රශ්නය හදලා තියෙනවා)

1. `👤 ගිණුම` tab එක open කරන්න
2. **"✨ අලුත් ගිණුමක් හදන්න"** කියන tab එක ඔබන්න → නම + password confirm fields දෙක පේනවා
3. Password දෙක **වෙනස් වෙන්න** දාලා "ගිණුම හදන්න" ඔබන්න
   → `❌ දෙපාරක් ලියපු password දෙක එකම නෑ` කියලා එවලේම කියනවා (typo වළක්වනවා)
4. **👁️ බලන්න** ඔබලා password එක ඇත්තටම ලියලා තියෙනවද බලන්න
5. දැන් එකම password එක දෙපාරක් දාලා ගිණුම හදන්න
   → `🎉 ගිණුම හැදුනා!` + stats cards (checks / දිනුම් / දිනුම් මුදල) පේනවා
6. Logout කරලා, **නැති email එකකින්** login වෙන්න try කරන්න
   → `මේ email එකෙන් ගිණුමක් නෑ ... register වෙන්න` කියලා කියනවා + form එක
   තනියම **register mode** එකට මාරු වෙනවා
7. වැරදි password එකක් දාලා බලන්න → `Password එක වැරදියි` කියලා වෙනම කියනවා

**Google (Gmail) එකෙන් එක click එකකින්:** `.env` එකේ `GOOGLE_CLIENT_ID` එක දාලා
(→ SETUP.md §4) server එක restart කරන්න. ඊට පස්සේ `👤 ගිණුම` tab එකේ Google
button එක auto පේනවා **සහ** ඔබගේ browser එකේ දැනටමත් login වෙලා ඉන්න Gmail ගිණුම
**auto-select වෙලා** උඩින් One Tap එකෙන් එක click එකකින් signup/login වෙන්න පුළුවන්.

---

## Test 10 — History + ලොතරැයි Report එක

**Guest ලෙස:**
1. Login නොකර check කිහිපයක් කරන්න → `🕘 History` tab එකේ ඒවා පේනවා
2. `📊 Report` කොටසේ `Report එක පෙන්නන්න ගිණුමකට login වෙන්න ඕන` කියලා තියෙනවා

**Login කරලා:**
3. Login වෙලා ලොතරැයි 2-3කින් check කිහිපයක් කරන්න (සමහරක් දිනුම්)
4. `🕘 History` tab එකට යන්න:
   - `✅ ඔබ ලොග් වෙලා ඉන්න නිසා හැම check එකක්ම server එකේ save වෙලා තියෙනවා` කියලා පේනවා
   - Item එකක `📷 Scan` / දිනුම් tier + මුදල + ඉල්ලක්කම් පේනවා
5. Filters try කරන්න: ලොතරැයිය, from/to දින, **"දිනුම් තියෙන ඒවා විතරක්"** checkbox
6. `📊 ලොතරැයි අනුව Report එක` card එකේ:
   - stat cards 4ක්: මුළු Check / දිනුම් / දිනුම් අනුපාතය / මුළු දිනුම් මුදල
   - highlights: 🏆 ලොකුම දිනුම, 🎯 අලුත්ම දිනුම, 📌 වැඩිපුරම check කළ ලොතරැයිය
   - **ලොතරැයි අනුව table එකක්** — එක එක ලොතරැයියට check/dිනුම්/අනුපාතය/මුදල +
     `එකතුව` පේළියක්
7. `⬇️ තව පෙන්නන්න` button එක check 40කට වඩා තියෙනකොට විතරයි පේන්නේ

---

## Test 11 — Admin Panel එක

1. `.env` එකේ `ADMIN_EMAILS=ඔබගේ@email.com` දාලා server එක restart කරන්න
2. ඒ email එකෙන් login වෙන්න → `🛠️ Admin` tab එක පේනවා
3. **📈 Overview** — මුළු users, active users (7d), මුළු check, දිනුම්, දිනුම් ගෙවීම්,
   AI scans, Payments + plan mix + දින අනුව signups/checks table එක
4. **👥 Signups + Users** — **හැම signup එකක්ම**:
   - නම / email / joined දිනය / plan / ADMIN badge
   - 🔵 Google හෝ 🔑 Password (ලොග් වුන ක්‍රමය)
   - checks කීයක් / දිනුම් කීයක් / අනුපාතය / scans කීයක් / දිනුම් මුදල
   - අලුත්ම check + අලුත්ම දිනුම කවදාද
   - `නම හෝ email එකෙන් හොයන්න` search එකයි sort (අලුත්ම / වැඩිපුරම check /
     වැඩිම දිනුම් මුදල ...) එකයි try කරන්න
   - `👁️ විස්තර බලන්න` ඔබාම → ඒ user ගේ stats + ලොතරැයි report + payments
5. **📊 Lottery Report** — හැම user ගේම එකතුව: ලොතරැයියකට check/user/winners/
   දිනුම් මුදල + වැඩිපුරම ලැබුණු tiers
6. **🕘 Recent Checks** — හැම user ගෙන්ම අලුත්ම checks 25ක් (`📷 Scan` /
   `⌨️ Manual` සහ user email එකත් එක්ක)
7. `ADMIN_EMAILS` එක හිස් කරලා ආයෙ බලන්න → Admin tab එකේ copy-paste කරන්න පුළුවන්
   instructions පේනවා (`📋 පේළිය copy කරන්න` button එකත් එක්ක). ඒ වෙලාවට API එකෙන්
   `403` දෙනවා (tab එක පේනවට අවසරයක් ලැබෙන්නේ නෑ).

---

## Test 12 — Camera එක (crop + focus + zoom)

1. `📷 Scan` tab එකේ `📸 Camera එක විවෘත කරන්න` ඔබන්න
2. Camera window එක **තිරයේ පළලම** (card එකෙනුත් එළියට), උස 320px+ වෙන්න ඕන
3. රාමුවක් (dashed) ඇතුළේ **"ලොතරැයි පත්‍රිකාව මේ රාමුව ඇතුළේ තියන්න"** කියන label එක—
   **කැපිලා යන්නේ නැතුව** සම්පූර්ණයෙන් පේන්න ඕන
4. පහළ වම් කෙළවරේ status chip එකේ resolution + focus mode (උදා: `1920×1080 · focus: continuous ✓`)
5. `🎯 නැවත Focus කරන්න` ඔබන්න → `⏳ නැවත focus කරමින්...` ඊට පස්සේ
   `🎯 Focus එක අලුතෙන් ලොක් කළා ...` කියලා **අනිවාර්යයෙන්** එන්න ඕන
   (support නැති phone වල වුනත් camera stream එක restart කරලා වැඩ කරනවා)
6. **🔍 Zoom slider** එක — camera එක support කරනවා නම් විතරයි පේන්නේ (Android Chrome
   වල ගොඩක් වෙලාවට පේනවා). Slider එක ඇදලා ඉලක්කම් ලොකු කරගන්න පුළුවන්
7. **"රාමුව ඇතුළේ තියෙන කොටස විතරක් යවන්න"** checkbox එක ON තියලා `📷 Photo ගන්න` ඔබන්න
   → `✂️ රාමුව ඇතුළේ තියෙන කොටස විතරයි යැව්වේ — 1400×1076px (සම්පූර්ණ frame එක 1920×1080)`
   කියලා පේනවා. **මේ පණිවිඩය scan එක ඉවර වෙනකම්ම තියෙනවා** (එවලේම අයින් වෙන්නේ නෑ).
8. Checkbox එක OFF කරලා ආයෙ ගන්න → `📐 සම්පූර්ණ photo එකම යවනවා` කියලා පේනවා
   (එතකොට යවන දත්ත ගොඩක් වැඩි)
9. `📱 Phone එකේ camera app එකෙන් ගන්න` — native camera app එකේ නියම autofocus එක
   පාවිච්චි කරන්න පුළුවන් option එකක්

**වේගය ගැන:** scan එක අතරතුර badge එකේ `🤖 AI එක photo එක කියවමින්... 2.3s` කියලා
ලයිව් තත්පර ගණන පේනවා, ඉවර වුනාම `✅ කියවලා ඉවරයි (2.8s)` කියලා එනවා. Crop
කරන නිසා යවන payload එක **~25-35%කින් අඩු**, ඒ වගේම AI එකේ thinking level එක
`minimal` කරලා තියෙන නිසා answer එක ගොඩක් ඉක්මනින් එනවා.

**Gemini limit එක ඉවර වුනොත්:** `අද දවසට Gemini free limit එක ඉවරයි. හෙට ආයෙ try කරන්න...`
කියලා පැහැදිලිව කියනවා (crash වෙන්නේ නෑ).

---

## Test 13 — Yellow buttons + tab colours

1. **හැම button එකක්ම කහ (gold)** වෙන්න ඕන — `🖼️ Gallery එකෙන් උඩුගත කරන්න`,
   `🗑️ History එක මකන්න`, `🎯 නැවත Focus කරන්න` වගේ ඒවාත් එකම කහ පාටයි
2. Main menu එකේ **select කරපු tab එක light blue** (කහ නෙවෙයි) වෙන්න ඕන.
   Tab එකකට යනකොට පාට එවලේම වෙනස් වෙනවා
3. (Google button එක — Google එකේ official widget එකක් නිසා ඒකේ පාට වෙනස් කරන්න බෑ)

---

# 🆕 2වෙනි වටයේ වෙනස්කම් — අතින් test කරන විදිය

## Test 14 — Scan එක තමයි දැන් ප්‍රධාන ක්‍රියාව

1. App එක open කරන්න. Tabs උඩ තියෙනවා: `🎟️ ටිකට් පරීක්ෂාව` · `📋 අලුත්ම ප්‍රතිඵල` ·
   `🕘 මගේ වාර්තා` · `🍀 අනුමානය` · `👤 මගේ ගිණුම` (login වුනාම `🛠️ පරිපාලනය` ත්)
2. Tabs වලට **යටින් ලොකු කහ රාමුවක්** තියෙනවා — ඒක **"📷 ටිකට් එක Scan කරන්න"** CTA එක.
   ඒක tab buttons වලට වඩා **පැහැදිලිවම ලොකු** (උස දෙගුණයකට වඩා, අකුරු ලොකු, කැමරා icon එකක් ඇතුළේ)
3. ඒක ඔබන්න → Scan panel එක විවෘත වෙනවා + CTA එක එතකොට හැංගෙනවා
4. Panel එකේ **ප්‍රධාන button 3ක් විතරයි**:
   `📸 කැමරාවෙන් Scan කරන්න` · `📱 Phone එකේ camera app එකෙන්` · `🖼️ Gallery එකෙන් photo එකක්`
5. `⚙️ උසස් සැකසුම් (focus · zoom · crop)` කියන කොටස **වහලා** තියෙනවා — ඔබලා ඇරලා
   zoom slider / නැවත focus / crop checkbox ටික බලන්න පුළුවන්

## Test 15 — Camera auto-focus + stop button

1. `📸 කැමරාවෙන් Scan කරන්න` ඔබන්න → Allow
2. Preview එක උඩ badge එකක් පේනවා: `ටිකට් එක රාමුව ඇතුළේ ලං කරන්න — focus එක තනියම හැරවෙනවා`
3. පහළ වම් කෙළවරේ status: `1920×1080 · focus: continuous ✓` (support නම්)
4. **ටිකට්පත්‍රය කැමරාවට ලං කරන්න** → අකුරු/ticket එක **තනියම sharp වෙනවා**
   (තත්පර 3කට වරක් focus එක අලුතෙන් ලොක් වෙනවා)
5. Preview එකේ **කොතනක හරි ඔබන්න** → එතන කහ රාමුවක් (focus ring) එකක් එනවා + ඒ තැනට focus වෙනවා
6. **🛑 කැමරාව නවත්තන්න** ඔබන්න → camera එක **ඇත්තටම නවතිනවා** (camera light එක නිවෙනවා),
   preview එක හැංගෙනවා, button 3 ආයෙ එනවා, button එකේ නම ආයෙ "කැමරාවෙන් Scan කරන්න" වෙනවා
7. ආයෙ ඔබන්න → ආයෙ විවෘත වෙනවා (start/stop දෙකම වැඩ කරනවා)

## Test 16 — 📢 දැන්වීම් ස්ථාන

1. උඩින්, ප්‍රතිඵල ලැයිස්තුවට යටින්, Scan panel එකේ, History එකේ, පහළම —
   තැන් හයක **"දැන්වීම් ස්ථානය"** කියලා රාමු පේනවා (300×250 / Responsive කියලත් ලියලා)
2. 3වෙනි check එකේදී එන 5-තත්පර screen එකේත් **ඇත්ත ad slot එකක්** තියෙනවා
3. Premium plan එකක ඉන්න කෙනාට **දැන්වීම් පේන්නේ නෑ** (login වෙලා බලන්න)
4. ඇත්ත ad code එක දාන්නේ `public/index.html` එකේ `const ADS = {` කොටසේ —
   විස්තර `SETUP.md` §4.7 එකේ

## Test 17 — 🔄 ප්‍රතිඵල ස්වයංක්‍රීයව ලබාගැනීම

1. Server එක start කරන්න. Log එකේ මේක පේන්න ඕන:
   ```
   ✓ Auto-scrape cron: "30 9,21 * * *" (Asia/Colombo) — දිනකට දෙපාරක්.
   ```
2. දත්ත පරණ නම් ඒ වෙලාවේම `⏳ ප්‍රතිඵල දත්ත පරණයි (පැය Xක්) — background එකේ...` කියලා
   scrape එකක් පටන් ගන්නවා
3. `🛠️ පරිපාලනය` → `📈 Overview` එකේ **auto-scrape කොටස** බලන්න:
   cron expression, දත්ත අලුත්ද, අවසන් උත්සාහය (සාර්ථක/අසාර්ථක + තත්පර කීයද)
4. **🔄 දැන්ම ප්‍රතිඵල අලුත් කරන්න** ඔබන්න → තත්පර 15-30ක් යනවා → "✅ ප්‍රතිඵල අලුත් කළා —
   lottery 16ක්" වගේ පණිවිඩයක් එනවා
5. Internet නැති කරලා scrape එක run කරන්න try කරන්න → **පරණ දත්ත නැති වෙන්නේ නෑ**
   (header එකේ "දත්ත යාවත්කාලීන" වෙලාව වෙනස් වෙන්නේ නෑ, අංක ටික ඒ විදිහටම තියෙනවා)

## Test 18 — 🍀 මගේ වාසනාව (Premium)

**Login නැතුව:** `🍀 අනුමානය` ඔබන්න → login වෙන්න කියනවා.

**Free ගිණුමකින්:**
1. Login වෙලා `🍀 අනුමානය` ඔබන්න → කහ රාමුවක **Premium** notice එකක් + `⬆️ Plan එකක් ගන්න` button
2. ඒ පෙට්ටියේම **"මෙය අනාවැකියක් නොවේ"** කියලා ලියලා තියෙනවා
3. උපන් විස්තර form එක පුරවන්න පුළුවන් (නම, උපන් දිනය, පැය 1-12, මිනිත්තු, AM/PM)
   → Save කරාම **ජීවන මාර්ග අංකය / වාසනාවන්ත අංකය / නම් අංකය** cards එනවා
4. පැය 15 වගේ වැරදි අගයක් දාලා Save කරන්න → `❌ පැය 1 සහ 12 අතර වෙන්න ඕන` කියලා එවලේම කියනවා

**Premium ගිණුමකින් (plan එකක් ගත්තට පස්සේ):**
5. `📊 පසුගිය ප්‍රතිඵල විශ්ලේෂණය` ඔබන්න → ලොතරැයියේ **සැබෑ විශ්ලේෂණය** පේනවා:
   - stat cards (විශ්ලේෂණය කළ draw, ඉලක්කම් ගණන, සාමාන්‍ය එකතුව, සාමාන්‍ය ඔත්තේ)
   - 🔥 hot · ❄️ cold · ⏳ overdue chips (හිඩැස් කී draw ක්ද කියලත් එක්ක)
   - අංක වාර ගණන **bar chart** එකක්
   - **ස්ථානය අනුව (position-wise)** වගුව + අලුත්ම ප්‍රතිඵල වගුව
6. `🍀 අනුමානය ලබාගන්න` ඔබන්න → **⚠️ නියමයන් (disclaimer) පෙට්ටිය** එනවා
   - checkbox එක tick කරන්න **කලින්** `✅ එකඟ වෙමි` button එක **disabled**
   - `✕ එකඟ නොවෙමි` ඔබන්න → modal එක වැහෙනවා + `නවත්තන ලදී` කියලා එනවා (අනුමානයක් නෑ)
7. ආයෙ ඔබලා checkbox tick කරලා `✅ එකඟ වෙමි` ඔබන්න → තත්පර කීපයකින්:
   - ඉලක්කම් (gold boxes) + අකුර/රාශිය/Super Number
   - **සිංහල reasoning** එක (`මොන දත්ත මතද තෝරාගත්තේ` කියලා + "අනාවැකියක් නොවේ" කියලා)
   - **සංඛ්‍යාලේඛන පදනම් කරගත් යෝජනාව** (විනිවිදභාවය සඳහා)
   - **යටින් නැවතත් disclaimer එක**
   - **අනුමානයට පාදක වූ දත්ත** (pattern chart එක)
8. `📜 මගේ පෙර අනුමාන` කොටසේ ඒක save වෙලා තියෙනවා
9. `📷 Photo එකකින් Scan කරලා අනුමානය` ඔබන්න → Scan panel එකට මාරු වෙනවා, note එක
   **"🍀 අනුමානය සඳහා scan කිරීම"** වෙනස් වෙනවා → photo එකක් ගන්න →
   **එතකොටත් disclaimer එක ආයෙ අහනවා** (හැම උත්සාහයකටම එක පාරක්)

> ⚠️ **නියමයන් bypass කරන්න බෑ** කියලා තහවුරු කරගන්න: browser console එකෙන්
> `fetch('/api/lucky/guess',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('lkm_token')},body:JSON.stringify({slug:'mahajana-sampatha'})})`
> කරලා බලන්න → **400** එකක් + disclaimer text එක එනවා. ඒ කියන්නේ server එකෙනුත්
> එකඟ වීම බලනවා.

## Test 20 — ⏳ අපරාදේ request නොයන එක (button disable)

මේක බලන්නේ user කීපපාරක් ඔබලා Gemini request නාස්ති වෙනවද කියලා.

1. `🎟️ ටිකට් පරීක්ෂාව` එකේ ඉලක්කම් පුරවලා **🔍 පරීක්ෂා කරන්න** ඔබන්න
   → button එක එවලේම **අළු පාට** වෙලා `⏳ පරීක්ෂා කරමින්...` වෙනවා
   → result එක එනකොට ආයෙ කහ පාටට + වැඩ කරන තත්ත්වයට එනවා
2. දැන් **කීපපාරක් ඉක්මනින්** ඔබන්න (double click) → request **එකක් විතරයි** යන්නේ
   (Browser Console → Network එකේ `/api/check` කීයක් ගියාද බලන්න)
3. `📷 Scan` එකේ photo එකක් ගන්න → **📷 Photo ගන්න → Scan කරන්න** ඔබන්න
   → ඒ button එකයි අනිත් scan buttons 3යි **🍀 scan CTA එකයි** ඔක්කොම disable වෙනවා
   → ආයෙ කීපපාරක් ඔබන්නත් බෑ
   → result එක ආවට පස්සේ ඔක්කොම ආයෙ වැඩ කරනවා
4. 🍀 අනුමානය tab එකේ button 3ත් එහෙමම (`⏳ අනුමානය සකසමින්...`)
5. **Server එකෙනුත් guard:** terminal එකෙන් මේක run කරන්න —
   ```bash
   curl -s -X POST http://localhost:3000/api/scan \
     -H 'Content-Type: application/json' \
     -d '{"image":"AAAA","mimeType":"image/jpeg"}' &
   curl -s -X POST http://localhost:3000/api/scan \
     -H 'Content-Type: application/json' \
     -d '{"image":"AAAA","mimeType":"image/jpeg"}' &
   wait
   ```
   → දෙවෙනි එකෙන් `{"error":"...දැනටමත් ඉල්ලීමක් යනවා...","inProgress":true}` එනවා.
   ඒ කියන්නේ frontend එක bypass කරලා වුනත් double request යන්නේ නෑ.

## Test 21 — 🔑 Keys කිහිපයක් (failover)

1. `.env` එකේ `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`... විදිහට keys කිහිපයක් දාන්න
   (හෝ `GEMINI_API_KEYS=key1,key2`)
2. Server එක start කරන්න → 🛠️ පරිපාලනය → 📈 Overview → **🔑 AI key pool** කොටස
   → `මුළු keys: 5 · දැන් පාවිච්චි කරන්න පුළුවන්: 5` වගේ පේනවා
   + එක එක key එකේ තත්ත්වය (`ready` / `cooldown` / `disabled`) + calls/ok/429 ගණන
3. `GEMINI_API_KEY_1` එකට **වැරදි key එකක්** දාලා (උදා: `GEMINI_API_KEY_1=BAD-key`)
   server restart කරලා එක scan එකක් කරන්න
   → ඒ key එක `disabled` වෙලා, **scan එක ඊළඟ key එකෙන් සාර්ථක වෙනවා** (user ට error නෑ)
4. Keys ඔක්කොම කොහෙන් හරි rate-limit වුනොත් විතරයි "තව තත්පර Xකින් ආයෙ try
   කරන්න" කියලා එන්නේ
5. ⚠️ admin panel එකේ keys පේන්නේ masked විදිහට විතරයි (`AQ.Ab8…t0w`) —
   පූර්ණ key එකක් කවදාවත් පේන්නේ නෑ

## Test 19 — පාට

1. **හැම button එකක්ම කහ** — ප්‍රධාන button 3, Plan buttons, "විස්තර බලන්න", "දැන්ම අලුත් කරන්න"...
2. Main menu එකේ **select කරපු tab එක light blue** (කහ නෙවෙයි)
3. Scan CTA එකේ කහ රාමුව + කහ කැමරා icon එක
