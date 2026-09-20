/**
 * test-gemini.js — Gemini API connectivity test
 *
 * run: npm run test:gemini
 *
 * ⚠️ පරණ version එකේ තිබුණ ප්‍රශ්න:
 *   1. `require('dotenv')` — dotenv install කරලා තිබුනේ නෑ (ඒක වෙනුවට
 *      දැන් project එකේම env.js loader එක පාවිච්චි කරනවා).
 *   2. `require('@google/generative-ai')` — ඒ package එකත් install කරලා
 *      තිබුනේ නෑ. දැන් vision.js එකේ තියෙන විදිහටම REST API එකට
 *      කෙලින්ම fetch කරනවා — dependency එකක් අවශ්‍ය නෑ.
 *   3. Model නම hardcoded — දැන් .env එකේ GEMINI_MODEL එකෙන් (හෝ
 *      default එකෙන්) එනවා, ඒ නිසා model එකක් shutdown වුනාම
 *      code එක edit කරන්න ඕන නෑ.
 */

'use strict';

require('./env');

const { GEMINI_MODEL, GEMINI_URL } = require('./vision');

const apiKey = (process.env.GEMINI_API_KEY || '').trim();

function line() { console.log('─'.repeat(60)); }

async function listModels() {
  const version = process.env.GEMINI_API_VERSION || 'v1beta';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/${version}/models?key=${encodeURIComponent(apiKey)}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => String(m.name).replace(/^models\//, ''));
}

async function testGenerate() {
  if (!apiKey || apiKey === 'change-me') {
    console.log('❌ GEMINI_API_KEY එක .env එකේ set කරලා නෑ.');
    console.log('   aistudio.google.com/apikey එකෙන් key එකක් අරගෙන .env එකට දාන්න.');
    return 1;
  }

  line();
  console.log(`Model : ${GEMINI_MODEL}`);
  console.log(`URL   : ${GEMINI_URL.replace(/\/\/.*@/, '//')}`);
  line();

  const body = {
    contents: [{ parts: [{ text: 'මාව දිරිමත් කරන්න පොඩි සිංහල වාක්‍යයක් කියන්න.' }] }],
    generationConfig: { temperature: 0 },
  };

  let res;
  try {
    console.log('⏳ Gemini එකට connect වෙමින්...');
    res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
  } catch (e) {
    console.log(`❌ Connect වෙන්න බැරි උනා: ${e.message}`);
    return 1;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.log(`❌ Gemini API error (HTTP ${res.status})`);
    console.log(errText.slice(0, 500));

    if (res.status === 400 && /API_KEY_INVALID|API key not valid/i.test(errText)) {
      console.log('\n👉 Key එක වැරදියි. aistudio.google.com/apikey එකෙන් අලුත් key එකක් ගන්න.');
    } else if (res.status === 404) {
      console.log(`\n👉 "${GEMINI_MODEL}" කියන model එක තව නෑ (shutdown වෙලා / නම වැරදි).`);
      const names = await listModels().catch(() => null);
      if (names && names.length) {
        console.log('   .env එකේ GEMINI_MODEL එකට මේවායින් එකක් දාන්න:');
        for (const n of names.slice(0, 12)) console.log(`     - ${n}`);
      }
    } else if (res.status === 403) {
      console.log('\n👉 Key එකට අවසර නෑ. Key එකේ restrictions/project එක බලන්න.');
    } else if (res.status === 429) {
      console.log('\n👉 Free tier limit එක ඉක්මවලා. පොඩ්ඩක් ඉඳලා try කරන්න.');
    }
    return 1;
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.log('❌ හිස් පිළිතුරක් ආවා.');
    console.log(JSON.stringify(json, null, 2).slice(0, 800));
    return 1;
  }

  console.log('✅ සාර්ථකයි! Gemini වැඩ කරනවා.\n');
  console.log('🤖 Gemini: ' + text.trim());
  line();
  console.log('දැන් camera scan feature එකත් වැඩ කරනවා (npm start → Scan tab).');
  return 0;
}

testGenerate()
  .then(code => process.exit(code))
  .catch(e => { console.error('❌ Unexpected error:', e); process.exit(1); });
