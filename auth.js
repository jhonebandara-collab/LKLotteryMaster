/**
 * auth.js — User registration / login / Google Sign-In + JWT helpers
 *
 * SETUP (Google Sign-In):
 *   1. https://console.cloud.google.com/apis/credentials වලින් OAuth 2.0
 *      "Web application" Client ID එකක් හදාගන්න.
 *   2. .env file එකට දාන්න:  GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
 *   3. Server restart කරන්න.
 *   Client ID එක නැති කාලෙකදී Google Sign-In button එක "Setup ඕන" කියලා
 *   පෙන්නනවා විතරයි — Email/Password auth එක ඒ අතරතුරත් සාමාන්‍යයෙන් වැඩ කරනවා.
 */

'use strict';

// ⚠️ මේක පලවෙනිම require එක විය යුතුයි — පහළින් JWT_SECRET එක
// module load වෙන මොහොතේම කියවන නිසා .env එක දැනටමත් load වෙලා තියෙන්න ඕන.
require('./env');

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const JWT_EXPIRES = '30d';

/**
 * JWT_SECRET
 * ----------
 * .env එකේ strong secret එකක් තියෙනවා නම් ඒක පාවිච්චි කරනවා.
 * නැත්නම් **guessable hardcoded string එකක් නොදා** start වෙන වෙලාවේ
 * random secret එකක් generate කරනවා + ලොකුවට warn කරනවා.
 * (Random එකක් දැම්මම server restart එකකදී පරණ tokens invalid වෙනවා —
 *  ඒක insecure default එකකට වඩා හොඳයි. Production එකේ .env එකේ fix එකක් දාන්න.)
 */
const JWT_SECRET = (() => {
  const fromEnv = (process.env.JWT_SECRET || '').trim();
  if (fromEnv) {
    if (fromEnv.length < 32) {
      console.warn('⚠️  JWT_SECRET එක අකුරු ' + fromEnv.length +
        'යි — අවම වශයෙන් අකුරු 32ක් (random) දාන්න.');
    }
    return fromEnv;
  }
  console.warn('⚠️  JWT_SECRET .env එකේ නෑ — මේ run එකට random secret එකක් හදනවා. ' +
    'Server restart උනාම හැම login session එකක්ම invalid වෙනවා.');
  return crypto.randomBytes(48).toString('base64url');
})();

function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, email: u.email, name: u.name, plan: u.plan,
    planExpiresAt: u.planExpiresAt,
    scansUsedToday: u.scansUsedToday, scansUsedThisMonth: u.scansUsedThisMonth,
  };
}

// ---------------------------------------------------------------
// Express middleware — Authorization: Bearer <token> එකෙන් user එක load කරනවා
// (token නැත්තම් req.user = null, req එක block කරන්නේ නෑ — guest ලෙස ඉදිරියට යනවා)
// ---------------------------------------------------------------
function authMiddleware(req, res, next) {
  req.user = null;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (user) req.user = user;
  } catch (e) { /* token expired/invalid — guest ලෙස සලකනවා */ }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'ගිණුමට login වෙන්න ඕන.' });
  next();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------
// Register — email + password
// ---------------------------------------------------------------
async function register(email, password, name) {
  email = String(email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { error: 'නිවැරදි email address එකක් දාන්න.' };
  }
  if (!password || password.length < 6) {
    return { error: 'Password එක අවම වශයෙන් අකුරු 6ක් තියෙන්න ඕන.' };
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return { error: 'මේ email එකෙන් දැනටමත් ගිණුමක් තියෙනවා. Login කරන්න.' };

  const hash = await bcrypt.hash(password, 10);
  const cleanName = name ? String(name).trim().slice(0, 100) : null;

  let info;
  try {
    info = db.prepare(
      'INSERT INTO users (email, passwordHash, name, plan) VALUES (?, ?, ?, ?)'
    ).run(email, hash, cleanName, 'free');
  } catch (e) {
    // දෙන්නෙක් එකම වෙලාවේ එකම email එකෙන් register වෙන්න හැදුවොත්
    // UNIQUE constraint එකෙන් throw වෙනවා — 500ක් දෙනවට වඩා මේක හොඳයි.
    if (String(e.code || '').startsWith('SQLITE_CONSTRAINT')) {
      return { error: 'මේ email එකෙන් දැනටමත් ගිණුමක් තියෙනවා. Login කරන්න.' };
    }
    throw e;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  return { user, token: signToken(user), isNew: true };
}

// ---------------------------------------------------------------
// Login — email + password
// ---------------------------------------------------------------
async function login(email, password) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return { error: 'Email එක දාන්න.' };
  if (!password) return { error: 'Password එක දාන්න.' };

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  // ගිණුමක් නැත්නම් "වැරදියි" කියනවට වඩා නිශ්චිතව කියනවා —
  // නැත්නම් user ට "register වුනේ නෑ" කියලා වැටහෙනවා.
  if (!user) {
    return {
      error: 'මේ email එකෙන් ගිණුමක් නෑ. "අලුත් ගිණුමක් හදන්න" කියන tab එකෙන් register වෙන්න.',
      noAccount: true,
    };
  }
  if (!user.passwordHash) {
    return {
      error: 'මේ ගිණුම හදලා තියෙන්නේ Google එකෙන් — password එකක් නෑ. ' +
        '"Google එකෙන් ඉදිරියට යන්න" button එක භාවිතා කරන්න.',
      useGoogle: true,
    };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return {
      error: 'Password එක වැරදියි.' +
        (password.length < 6 ? ' (Password එක අවම අකුරු 6ක් — ඔයා ලියපු එක ලොකු/පොඩි අකුරු බලන්න.)' : ''),
      badPassword: true,
    };
  }
  return { user, token: signToken(user), isExisting: true };
}

// ---------------------------------------------------------------
// Google Sign-In — ID token verify කරලා user එක upsert කරනවා
// ---------------------------------------------------------------
async function loginWithGoogle(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return {
      error: 'GOOGLE_CLIENT_ID set කරලා නෑ. .env file එකේ Google OAuth setup කරන්න.',
      needsSetup: true,
    };
  }
  let payload;
  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch (e) {
    return { error: 'Google token එක verify කරන්න බැරි උනා: ' + e.message };
  }
  if (!payload || !payload.email) return { error: 'Google account එකෙන් email එක ලැබුනේ නෑ.' };

  const email = payload.email.toLowerCase();
  let user = db.prepare('SELECT * FROM users WHERE googleId = ? OR email = ?')
    .get(payload.sub, email);

  // මේ Google login එකෙන් අලුත් ගිණුමක් හැදුනාද කියලා frontend එකට කියන්න ඕන
  // ("ඔයාගේ ගිණුම හැදුනා" කියලා පෙන්නන්න).
  let isNew = false;

  if (!user) {
    let info;
    isNew = true;
    try {
      info = db.prepare(
        'INSERT INTO users (email, googleId, name, plan) VALUES (?, ?, ?, ?)'
      ).run(email, payload.sub, payload.name || null, 'free');
    } catch (e) {
      if (String(e.code || '').startsWith('SQLITE_CONSTRAINT')) {
        user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) throw e;
        if (!user.googleId) {
          db.prepare('UPDATE users SET googleId = ? WHERE id = ?').run(payload.sub, user.id);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        }
      } else {
        throw e;
      }
    }
    if (!user) user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  } else if (!user.googleId) {
    db.prepare('UPDATE users SET googleId = ? WHERE id = ?').run(payload.sub, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }
  return { user, token: signToken(user), isNew: !!isNew, email: payload.email };
}

module.exports = {
  authMiddleware, requireAuth, publicUser,
  register, login, loginWithGoogle, signToken,
};
