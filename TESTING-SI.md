# ටෙස්ට් කරන ආකාරය — LK Lottery Master PRO

මේක පියවරින් පියවර කරන්න. **පියවර 1–3 නොකර QR scan කරන්න බැහැ** — හේතුව පහළින්
"ඇයි camera වැඩ කරන්නේ නැත්තේ" කොටසේ තියෙනවා.

---

## පියවර 1 — Install කරන්න

```bash
unzip lk-lottery-master-fixed.zip
cd lk-lottery
npm install
```

## පියවර 2 — `.env` හදන්න

```bash
cp .env.example .env
```

`.env` එකේ මේවා දාන්න:

```env
GEMINI_API_KEY_1="AIza...."
GEMINI_API_KEY_2="AIza...."
GEMINI_API_KEY_3="AIza...."
ADMIN_KEY="mage-rahas-123"
```

Keys 5ක් තියෙනවා නම් 5ම දාන්න. එකක් limit වුනාම ඊළඟ එකට auto rotate වෙනවා.

## පියවර 3 — HTTPS එකෙන් run කරන්න (⚠️ අනිවාර්යයි)

```bash
npm run dev:https
```

මේකෙන් self-signed certificate එකක් හදලා `https://<ඔබේ-IP>:3000` වලට serve කරනවා.
Terminal එකේ පෙන්නන IP එක (උදා: `https://192.168.1.5:3000`) phone එකෙන් අරින්න.

Browser එකේ "Not secure / Advanced → Proceed" කියලා එනවා නම් **Proceed** කරන්න.
Self-signed certificate එකක් නිසා එහෙම එනවා — ඒක සාමාන්ය දෙයක්.

> `npm run dev` (plain HTTP) එකෙන් phone එකෙන් scan කරන්න **බැහැ**. Chrome, Edge,
> Safari හැම එකක්ම camera API එක HTTP වලින් හංගනවා. Desktop එකේ `localhost` වලින්
> විතරයි HTTP වලින් වැඩ කරන්නේ.

---

## පියවර 4 — Camera එක

1. Scanner tab එකට යන්න.
2. **"Start Camera"** button එක ඔබන්න. (මේක අනිවාර්යයි — මේ tap එකෙන් තමයි
   camera එක සහ ශබ්දය unlock වෙන්නේ.)
3. Browser එකෙන් camera permission ඉල්ලනවා → **Allow**.
4. දැන් video preview එක එනවා. Preview එක උඩ තියෙන පාට strip එක බලන්න.

### පාට strip එක තමයි ඔබේ මාර්ගෝපදේශකය

| Strip එක | අර්ථය | කරන්න ඕන දේ |
|---|---|---|
| 🟢 `QR: 4.2 px/module — hold still` | හරියටම තියෙනවා | නොසෙල්වී තියාගන්න — decode වෙනවා |
| 🟡 `QR: 1.4 px/module — move closer` | QR එක පොඩි වැඩියි | phone එක **ටිකට් එකට ළඟට** ගන්න |
| 🟡 `QR: 18 px/module — move back` | QR එක ලොකු වැඩියි | phone එක **ටිකක් ඈතට** ගන්න |

**මේකයි අපේ ප්‍රධාන ප්‍රශ්නය:** lottery ටිකට් එකේ QR එක ගොඩක් පොඩි. QR එකේ එක
module එකකට pixels 2.5ට අඩු නම් **හෝ** 11ට වැඩි නම් jsQR එක කියවන්නේ නෑ.
"Focus වෙන්නේ නෑ / blue වෙනවා" කියලා පෙනුණේ ඒකයි — optical focus එකේ ප්‍රශ්නයක්
නොවෙයි. දැන් app එකේ scale lattice එකක් තියෙනවා, ඒක module එක 5px වෙන ප්‍රමාණයට
auto scale කරලා decode කරනවා.

---

## පියවර 5 — QR scan ටෙස්ට් කරන්න

1. ටිකට් එකේ QR එක viewfinder එකේ **මැදට** ගන්න.
2. QR එක detect වුණාම — **vibrate + beep + කොළ පාට flash** එකක් එනවා.
3. Result modal එක එනවා: **WIN (කහ/කොළ)** හෝ **NO WIN (අළු)**.
4. තත්පර 5ක් ඇතුළත auto ම නැවත camera එකට එනවා (countdown bar එක පෙන්නනවා).

### ✅ Scan එක වැඩ කළාද බලන ලකුණු

- [ ] `Start Camera` ඔබපු ගමන් preview එක ආවා
- [ ] Strip එකේ px/module අංකය **නිතර වෙනස් වෙනවා** (උඩට/පහළට) → decoder එක
      ජීවත් වෙනවා කියන එකයි
- [ ] QR එක ළඟට ගත්තම strip එක **කොළ පාට** වුණා
- [ ] Detect වුණාම phone එක vibrate වුණා (Android වල) + beep එක ආවා
- [ ] Result එක තත්පර 5කට පෙන්නලා auto නැවත scan වුණා
- [ ] Result එකේ **ඔබේ ටිකට් අංක** සහ **නිල ප්‍රතිඵලය** වෙන වෙනම පෙනුණා

⚠️ **iPhone** එකේ vibrate API එකක් නැහැ (Apple ඒක support කරන්නේ නෑ) — ඒ නිසා
iPhone වල beep + flash එක විතරයි එන්නේ. ඒක Apple වල සීමාවක්, අපේ app එකේ ප්‍රශ්නයක් නොවෙයි.

### Scan එක වැඩ නොකළොත් මෙහෙම කරන්න

1. **Inspector එක බලන්න** — Scanner එකේ පහළින් `Show details` ඔබලා:
   - `Decode rate` අංකය 0 ට වැඩිද? (0 නම් decoder loop එක නැවතිලා)
   - `Last engine` මොකක්ද? (`pipeline`, `zxing`, `jsqr`, `barcode-detector`)
   - `Last raw payload` එකේ මොනවා හරි තියෙනවද?
2. **Gallery button** එකෙන් ටිකට් එකේ photo එකක් upload කරලා බලන්න. ඒකෙන් scan
   වුණොත් ප්‍රශ්නය camera quality එකේ — එතකොට **AI Scan** button එක පාවිච්චි කරන්න.
3. **AI Scan** button එක ඔබලා → "Capture from live camera" → Gemini එකෙන් කියවනවා.
4. තවම නැත්නම්: `Show details` එකේ **Last raw payload** එකේ තියෙන text එක මට එවන්න.
   ඒකෙන් ඔබේ ටිකට් වර්ගයට හරියටම parser එක හදලා දෙන්න පුළුවන්.

---

## පියවර 6 — Disclaimer + Admin panel

1. App එක ඕපන් කරද්දීම Terms modal එක එනවා → පහළට scroll කරලා **Accept**.
2. Header එකේ **Admin** tab එකට යන්න → `.env` එකේ දාපු `ADMIN_KEY` එක දාන්න.
3. **Disclaimer acceptance records** table එකේ ඔබේ accept එක වේලාව, උපාංගය, IP එකත්
   එක්ක පේනවා → **Export CSV** එකෙන් බාගන්න පුළුවන්.
4. පහළින් **Scanner diagnostics**: browser, camera state, last engine, fps, px/module.

### ටෙස්ට් කරන්න
- [ ] Phone එකෙන් accept කළාම, **desktop එකේ Admin පැනලයේ** ඒ record එක පේනවා
      (server එකේ `data/disclaimer-records.json` වල save වෙනවා)
- [ ] වැරදි key එකක් දැම්මම "Wrong admin key" එනවා
- [ ] CSV export එක Excel වල ඕපන් වෙනවා

---

## පියවර 7 — Results data (scrape) එක

නිල NLB සහ DLB වෙබ් අඩවි server එකකින් ලබාගැනීම block කරනවා (NLB එක හිස් shell
එකක් දෙනවා, DLB එක HTTP 406 දෙනවා). ඒ නිසා:

**ක්‍රමය A — Admin පැනලයෙන් import (නිර්දේශිතයි)**

1. Admin → **Import results (JSON)** → file එකක් තෝරන්න.
2. Format එක:

```json
{
  "lotteries": [
    {
      "slug": "govisetha",
      "draws": [
        { "drawNo": "4559", "date": "2026-09-23", "letter": "K",
          "numbers": ["07","15","33","61"], "zodiac": null, "superNumber": null }
      ]
    }
  ]
}
```

3. Import කළාම `addedDraws` කීයද කියලා පෙන්නනවා. App එක ඊළඟ scan එකේදී අලුත්
   දත්ත පාවිච්චි කරනවා (restart අවශ්‍ය නෑ).

**ක්‍රමය B — Auto feed එකක් තියෙනවා නම්**

`RESULT_SOURCES` env var එකට JSON URL එකක් දාන්න → `Refresh results` එක ඔබන්න.

### ටෙස්ට් කරන්න
- [ ] Import කළාම `Results data status` එකේ draws ගණන වැඩි වුණා
- [ ] අලුත් draw එකක් import කරලා, ඒ draw එකේ ටිකට් එකක් scan කළාම result එක හරි
- [ ] **Database එකේ නැති draw එකක්** scan කළාම app එක "cannot verify" කියලා
      candidate draws පෙන්නනවා — බොරු result එකක් **නොපෙන්නනවා** (මේක අනිවාර්යයි)

---

## පියවර 8 — History එක

1. කීපයක් scan කරන්න.
2. History tab එකට යන්න → **Lottery** filter එකෙන් එකක් තෝරන්න → **All** එකත් බලන්න.
3. **From / To** දින දෙන්න → ඒ කාලය ඇතුළත **Won / Lost / Win rate / Total won** එක
   recalculate වෙනවා.
4. පහළින් **per-lottery breakdown** table එක — ලොතරැයි අනුව දිනුම්/පැරදුම්.
5. **Export CSV** එකෙන් ඔක්කොම බාගන්න.

### ටෙස්ට් කරන්න
- [ ] Date range එක වෙනස් කළාම win/lose ගණනත් වෙනස් වෙනවා
- [ ] Lottery filter එක "All" + date range එකේදී breakdown table එකේ හැම ලොතරැයියක්ම
- [ ] Page එක refresh කළත් history එක නැති වෙන්නේ නෑ (localStorage)

---

## ඇයි camera වැඩ කරන්නේ නැත්තේ — checklist

| රෝග ලක්ෂණය | හේතුව | විසඳුම |
|---|---|---|
| "Start Camera" ඔබපුවම කිසිවක් නෑ | HTTP වලින් ඕපන් කරලා | `npm run dev:https` |
| "Camera not supported" | Browser එකේ API එක නෑ | Chrome / Safari / Edge අලුත් version |
| Preview එක එනවා, scan වෙන්නේ නෑ | QR module එක පොඩි වැඩියි | strip එක බලලා ළඟට යන්න |
| Preview එක කළු | අනිත් app එකක් camera එක අල්ලගෙන | අනිත් app එක close කරලා "Retry" |
| Decode rate 0 | Decoder loop එක නැවතිලා | Watchdog එක තත්පර 2කින් auto restart කරනවා — නැත්නම් tab එක refresh කරන්න |
| App එක background එකට ගියාට පස්සේ නෑ | OS එක camera එක නැවැත්තුවා | Scanner tab එකට ආපහු ගියාම auto resume වෙනවා |

---

## Developer test commands

```bash
npm test          # 57 parser / resolver / prize checks
npm run typecheck # TypeScript
npm run build     # client + server bundle
```

Build එක පස්සේ production එකෙන් run කරන්න:

```bash
npm run build && HTTPS=1 npm start
```
