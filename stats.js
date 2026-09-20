/**
 * stats.js — Check logging + user reports + admin analytics
 *
 * මේ module එක තමයි:
 *   • හැම ticket check එකක්ම `checks` table එකට ලියන තැන (logCheck)
 *   • user කෙනෙක්ගේ summary (userStats), full history (userHistory),
 *     ලොතරැයි අනුව report එක (userReport)
 *   • admin panel එකට ඕන ඔක්කොම (adminOverview, adminUsers, adminUserDetail,
 *     adminReport)
 *
 * ⚠️ සියලුම queries **prepared statements** + bound parameters — SQL injection නෑ.
 * (LIKE pattern එකට user input යන තැන escape කරනවා.)
 */

'use strict';

require('./env');

const { db, prepare } = require('./db');

// ---------------------------------------------------------------
// Admin නිර්ණය — .env එකේ ADMIN_EMAILS (comma separated)
// ---------------------------------------------------------------
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(user) {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.includes(String(user.email).trim().toLowerCase());
}

function adminEmails() {
  return ADMIN_EMAILS.slice();
}

// ---------------------------------------------------------------
// LIKE pattern එකක් සඳහා user input escape (%, _ වගේ wildcards නවත්තන්න)
// ---------------------------------------------------------------
function likePattern(q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return null;
  return '%' + s.replace(/[\\%_]/g, m => '\\' + m) + '%';
}

// ---------------------------------------------------------------
// logCheck — හැම check එකක්ම save කරනවා
// ---------------------------------------------------------------
/**
 * @param {object} p
 * @param {object|null} p.user      req.user (guest නම් null)
 * @param {object} p.lottery        { slug, provider, name, nameSi }
 * @param {object} p.draw           { drawNo, date }
 * @param {object} p.ticket         { letter, zodiac, superNumber, numbers }
 * @param {object} p.result         evaluatePrize()/checkTicket() result
 * @param {string} p.engine         'real-prize-table' | 'simplified-fallback'
 * @param {string} p.source         'manual' | 'scan'
 * @returns {number|null} inserted row id
 */
function logCheck({ user, lottery, draw, ticket, result, engine, source }) {
  try {
    const info = prepare(`
      INSERT INTO checks
        (userId, slug, provider, lotteryName, lotteryNameSi, drawNo, drawDate,
         tier, prizeLabel, won, prizeAmountRs, letter, zodiac, superNumber,
         numbers, engine, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user ? user.id : null,
      lottery.slug,
      lottery.provider || null,
      lottery.name || null,
      lottery.nameSi || null,
      draw && draw.drawNo != null ? String(draw.drawNo) : null,
      (draw && draw.date) || null,
      result.tier || null,
      result.prizeLabel || null,
      result.won ? 1 : 0,
      result.won && typeof result.prizeAmountRs === 'number' ? result.prizeAmountRs : 0,
      ticket.letter ? String(ticket.letter).toUpperCase() : null,
      ticket.zodiac ? String(ticket.zodiac).toUpperCase() : null,
      ticket.superNumber != null && ticket.superNumber !== '' ? String(ticket.superNumber) : null,
      JSON.stringify(Array.isArray(ticket.numbers) ? ticket.numbers.map(String) : []),
      engine || null,
      source === 'scan' ? 'scan' : 'manual'
    );
    return Number(info.lastInsertRowid);
  } catch (e) {
    // Check log එක fail උනත් user ට ප්රතිඵලය ලැබෙන්න ඕන — ඒ නිසා
    // server එක crash කරන්නේ නෑ, log එකක් විතරයි දාන්නේ.
    console.error('⚠️  check log කරන්න බැරි උනා:', e.message);
    return null;
  }
}

// ---------------------------------------------------------------
// Shared SQL bits
// ---------------------------------------------------------------
const WON_MONEY = `COALESCE(SUM(CASE WHEN won = 1 THEN prizeAmountRs ELSE 0 END), 0)`;
const NONCASH_WINS = `COALESCE(SUM(CASE WHEN won = 1 AND (prizeAmountRs IS NULL OR prizeAmountRs = 0) THEN 1 ELSE 0 END), 0)`;

function dateFilter(from, to, alias = '') {
  const col = (alias ? alias + '.' : '') + 'createdAt';
  const parts = [];
  const args = [];
  if (from) { parts.push(`${col} >= ?`); args.push(String(from)); }
  if (to) { parts.push(`${col} <= ?`); args.push(String(to) + ' 23:59:59'); }
  return { sql: parts.length ? ' AND ' + parts.join(' AND ') : '', args };
}

function mapCheckRow(r) {
  let numbers = [];
  try { numbers = JSON.parse(r.numbers || '[]'); } catch (e) { numbers = []; }
  return {
    id: r.id,
    slug: r.slug,
    provider: r.provider,
    lotteryName: r.lotteryName,
    lotteryNameSi: r.lotteryNameSi,
    drawNo: r.drawNo,
    drawDate: r.drawDate,
    won: !!r.won,
    tier: r.tier,
    prizeLabel: r.prizeLabel,
    prizeAmountRs: r.prizeAmountRs,
    prizeAmountFormatted: r.prizeAmountFormatted != null
      ? r.prizeAmountFormatted
      : (typeof r.prizeAmountRs === 'number' && r.prizeAmountRs > 0
          ? 'Rs. ' + Number(r.prizeAmountRs).toLocaleString('en-US') + '.00'
          : null),
    letter: r.letter,
    zodiac: r.zodiac,
    superNumber: r.superNumber,
    numbers,
    engine: r.engine,
    source: r.source,
    createdAt: r.createdAt,
  };
}

function fmtRs(n) {
  const v = Number(n || 0);
  return 'Rs. ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------
// User — summary
// ---------------------------------------------------------------
function userStats(userId) {
  const s = prepare(`
    SELECT COUNT(*) AS checks,
           COALESCE(SUM(won), 0) AS wins,
           ${WON_MONEY} AS prizeTotal,
           ${NONCASH_WINS} AS nonCashWins,
           MIN(createdAt) AS firstCheckAt,
           MAX(createdAt) AS lastCheckAt
    FROM checks WHERE userId = ?
  `).get(userId) || {};

  const byProv = prepare(`
    SELECT provider, COUNT(*) AS checks, COALESCE(SUM(won), 0) AS wins
    FROM checks WHERE userId = ? GROUP BY provider
  `).all(userId);

  const best = prepare(`
    SELECT tier, prizeLabel, prizeAmountRs, lotteryName, drawNo, createdAt
    FROM checks
    WHERE userId = ? AND won = 1
    ORDER BY COALESCE(prizeAmountRs, 0) DESC, createdAt DESC
    LIMIT 1
  `).get(userId) || null;

  const lastWin = prepare(`
    SELECT tier, prizeLabel, prizeAmountRs, lotteryName, drawNo, createdAt
    FROM checks
    WHERE userId = ? AND won = 1
    ORDER BY createdAt DESC LIMIT 1
  `).get(userId) || null;

  const topLottery = prepare(`
    SELECT slug, lotteryName, COUNT(*) AS checks
    FROM checks WHERE userId = ?
    GROUP BY slug ORDER BY checks DESC, lotteryName ASC LIMIT 1
  `).get(userId) || null;

  const checks = Number(s.checks || 0);
  const wins = Number(s.wins || 0);

  return {
    checks,
    wins,
    losses: checks - wins,
    winRate: checks ? Math.round((wins / checks) * 1000) / 10 : 0,
    prizeTotal: Number(s.prizeTotal || 0),
    prizeTotalFormatted: fmtRs(s.prizeTotal || 0),
    nonCashWins: Number(s.nonCashWins || 0),
    firstCheckAt: s.firstCheckAt || null,
    lastCheckAt: s.lastCheckAt || null,
    byProvider: byProv.map(p => ({ provider: p.provider, checks: Number(p.checks), wins: Number(p.wins) })),
    best: best ? { ...best, prizeAmountFormatted: fmtRs(best.prizeAmountRs || 0) } : null,
    lastWin: lastWin ? { ...lastWin, prizeAmountFormatted: fmtRs(lastWin.prizeAmountRs || 0) } : null,
    topLottery: topLottery ? { ...topLottery, checks: Number(topLottery.checks) } : null,
  };
}

// ---------------------------------------------------------------
// User — full history (paginated + filters)
// ---------------------------------------------------------------
function userHistory(userId, { slug, from, to, winsOnly, limit, offset } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  const where = ['userId = ?'];
  const args = [userId];
  if (slug) { where.push('slug = ?'); args.push(String(slug)); }
  if (winsOnly === true || winsOnly === 'true' || winsOnly === '1') where.push('won = 1');
  const df = dateFilter(from, to);
  const sql = ' FROM checks WHERE ' + where.join(' AND ') + df.sql;

  const total = Number(prepare('SELECT COUNT(*) AS n' + sql).get(...args, ...df.args).n || 0);
  const rows = prepare('SELECT *' + sql + ' ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?')
    .all(...args, ...df.args, lim, off);

  return {
    total,
    limit: lim,
    offset: off,
    hasMore: off + rows.length < total,
    items: rows.map(mapCheckRow),
  };
}

// ---------------------------------------------------------------
// User — ලොතරැයි අනුව report
// ---------------------------------------------------------------
function userReport(userId, { from, to } = {}) {
  const df = dateFilter(from, to);
  const rows = prepare(`
    SELECT slug,
           MAX(lotteryName)   AS lotteryName,
           MAX(lotteryNameSi) AS lotteryNameSi,
           MAX(provider)      AS provider,
           COUNT(*)           AS checks,
           COALESCE(SUM(won), 0) AS wins,
           ${WON_MONEY}       AS prizeTotal,
           ${NONCASH_WINS}    AS nonCashWins,
           MAX(CASE WHEN won = 1 THEN createdAt END) AS lastWinAt,
           MAX(createdAt)     AS lastCheckAt
    FROM checks
    WHERE userId = ?${df.sql}
    GROUP BY slug
    ORDER BY prizeTotal DESC, checks DESC, lotteryName ASC
  `).all(userId, ...df.args);

  const byLottery = rows.map(r => {
    const checks = Number(r.checks || 0);
    const wins = Number(r.wins || 0);
    return {
      slug: r.slug,
      lotteryName: r.lotteryName,
      lotteryNameSi: r.lotteryNameSi,
      provider: r.provider,
      checks,
      wins,
      losses: checks - wins,
      winRate: checks ? Math.round((wins / checks) * 1000) / 10 : 0,
      prizeTotal: Number(r.prizeTotal || 0),
      prizeTotalFormatted: fmtRs(r.prizeTotal || 0),
      nonCashWins: Number(r.nonCashWins || 0),
      lastWinAt: r.lastWinAt || null,
      lastCheckAt: r.lastCheckAt || null,
    };
  });

  const totals = byLottery.reduce((a, b) => {
    a.checks += b.checks; a.wins += b.wins;
    a.prizeTotal += b.prizeTotal; a.nonCashWins += b.nonCashWins;
    return a;
  }, { checks: 0, wins: 0, prizeTotal: 0, nonCashWins: 0 });

  // ලොතරැයි වර්ගය අනුව (NLB / DLB) කණ්ඩායම්
  const byProvider = ['NLB', 'DLB'].map(p => {
    const g = byLottery.filter(l => (l.provider || '').toUpperCase() === p);
    return {
      provider: p,
      lotteries: g.length,
      checks: g.reduce((s, l) => s + l.checks, 0),
      wins: g.reduce((s, l) => s + l.wins, 0),
      prizeTotal: g.reduce((s, l) => s + l.prizeTotal, 0),
      prizeTotalFormatted: fmtRs(g.reduce((s, l) => s + l.prizeTotal, 0)),
    };
  }).filter(p => p.checks > 0);

  return {
    range: { from: from || null, to: to || null },
    overall: {
      ...totals,
      losses: totals.checks - totals.wins,
      winRate: totals.checks ? Math.round((totals.wins / totals.checks) * 1000) / 10 : 0,
      prizeTotalFormatted: fmtRs(totals.prizeTotal),
      lotteriesPlayed: byLottery.length,
      lotteriesWon: byLottery.filter(l => l.wins > 0).length,
    },
    byProvider,
    byLottery,
  };
}

// ---------------------------------------------------------------
// ADMIN — overview
// ---------------------------------------------------------------
function adminOverview() {
  const users = prepare('SELECT COUNT(*) AS n FROM users').get();
  const guests = prepare('SELECT COUNT(DISTINCT createdAt) AS n FROM checks WHERE userId IS NULL').get();

  const signups7 = prepare(
    "SELECT COUNT(*) AS n FROM users WHERE createdAt >= datetime('now', '-7 days')"
  ).get();
  const signups30 = prepare(
    "SELECT COUNT(*) AS n FROM users WHERE createdAt >= datetime('now', '-30 days')"
  ).get();
  const activeUsers7 = prepare(
    "SELECT COUNT(DISTINCT userId) AS n FROM checks WHERE userId IS NOT NULL AND createdAt >= datetime('now', '-7 days')"
  ).get();

  const c = prepare(`
    SELECT COUNT(*) AS checks,
           COALESCE(SUM(won), 0) AS wins,
           ${WON_MONEY} AS prizeTotal,
           ${NONCASH_WINS} AS nonCashWins,
           COUNT(DISTINCT userId) AS usersWhoChecked
    FROM checks
  `).get();

  const scans = prepare("SELECT COUNT(*) AS n FROM checks WHERE source = 'scan'").get();
  const scans7 = prepare(
    "SELECT COUNT(*) AS n FROM checks WHERE source = 'scan' AND createdAt >= datetime('now', '-7 days')"
  ).get();

  const planMix = prepare(`
    SELECT plan, COUNT(*) AS n FROM users GROUP BY plan ORDER BY n DESC
  `).all();

  const paid = prepare(`
    SELECT COUNT(*) AS n,
           COALESCE(SUM(CASE WHEN status = 'completed' THEN amountRs ELSE 0 END), 0) AS revenueRs
    FROM payments
  `).get();

  const signupsByDay = prepare(`
    SELECT date(createdAt) AS day, COUNT(*) AS n
    FROM users GROUP BY day ORDER BY day DESC LIMIT 30
  `).all();

  const checksByDay = prepare(`
    SELECT date(createdAt) AS day, COUNT(*) AS n, COALESCE(SUM(won), 0) AS wins
    FROM checks GROUP BY day ORDER BY day DESC LIMIT 30
  `).all();

  const recentChecks = prepare(`
    SELECT c.*, u.email AS userEmail, u.name AS userName
    FROM checks c LEFT JOIN users u ON u.id = c.userId
    ORDER BY c.id DESC LIMIT 25
  `).all();

  return {
    users: Number(users.n || 0),
    signups7: Number(signups7.n || 0),
    signups30: Number(signups30.n || 0),
    activeUsers7: Number(activeUsers7.n || 0),
    guestSessions: Number(guests.n || 0),
    checks: Number(c.checks || 0),
    wins: Number(c.wins || 0),
    prizeTotal: Number(c.prizeTotal || 0),
    prizeTotalFormatted: fmtRs(c.prizeTotal || 0),
    nonCashWins: Number(c.nonCashWins || 0),
    usersWhoChecked: Number(c.usersWhoChecked || 0),
    scans: Number(scans.n || 0),
    scans7: Number(scans7.n || 0),
    planMix: planMix.map(p => ({ plan: p.plan, users: Number(p.n) })),
    payments: { count: Number(paid.n || 0), revenueRs: Number(paid.revenueRs || 0), revenueFormatted: fmtRs(paid.revenueRs || 0) },
    signupsByDay: signupsByDay.map(r => ({ day: r.day, n: Number(r.n) })),
    checksByDay: checksByDay.map(r => ({ day: r.day, n: Number(r.n), wins: Number(r.wins) })),
    recentChecks: recentChecks.map(r => ({
      ...mapCheckRow(r),
      userEmail: r.userEmail || null,
      userName: r.userName || null,
      user: r.userId ? { id: r.userId, email: r.userEmail, name: r.userName } : null,
    })),
    adminConfigured: ADMIN_EMAILS.length > 0,
    adminEmails: adminEmails(),
  };
}

// ---------------------------------------------------------------
// ADMIN — හැම signup එකක්ම + ඒගොල්ලන්ගේ stats
// ---------------------------------------------------------------
function adminUsers({ q, limit, offset, sort } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const pat = likePattern(q);

  const where = [];
  const args = [];
  if (pat) {
    where.push("(LOWER(u.email) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(u.name,'')) LIKE ? ESCAPE '\\')");
    args.push(pat, pat);
  }
  // ⚠️ මෙතන `WHERE 1 = 1` දාන්නේ නෑ — දැම්මොත් පහළින් තවත් `WHERE` එකක්
  // එකතු වෙලා "WHERE ... WHERE ..." කියලා invalid SQL එකක් හැදෙනවා.
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const orderMap = {
    newest: 'u.id DESC',
    oldest: 'u.id ASC',
    checks: 'checks DESC, u.id DESC',
    wins: 'wins DESC, u.id DESC',
    prize: 'prizeTotal DESC, u.id DESC',
    lastActive: 'lastCheckAt DESC',
  };
  const order = orderMap[sort] || orderMap.newest;

  const base = `
    FROM users u${whereSql}
  `;

  const total = Number(prepare('SELECT COUNT(*) AS n' + base).get(...args).n || 0);

  const rows = prepare(`
    SELECT u.id, u.email, u.name, u.plan, u.planExpiresAt, u.createdAt,
           u.scansUsedToday, u.scansUsedThisMonth,
           CASE WHEN u.googleId IS NOT NULL THEN 1 ELSE 0 END AS viaGoogle,
           CASE WHEN u.passwordHash IS NOT NULL THEN 1 ELSE 0 END AS hasPassword,
           (SELECT COUNT(*) FROM checks c WHERE c.userId = u.id) AS checks,
           (SELECT COALESCE(SUM(c.won), 0) FROM checks c WHERE c.userId = u.id) AS wins,
           (SELECT COALESCE(SUM(CASE WHEN c.won = 1 THEN c.prizeAmountRs ELSE 0 END), 0)
              FROM checks c WHERE c.userId = u.id) AS prizeTotal,
           (SELECT COUNT(*) FROM checks c WHERE c.userId = u.id AND c.source = 'scan') AS scans,
           (SELECT MAX(c.createdAt) FROM checks c WHERE c.userId = u.id) AS lastCheckAt,
           (SELECT MAX(c.createdAt) FROM checks c WHERE c.userId = u.id AND c.won = 1) AS lastWinAt
    ` + base + ` ORDER BY ` + order + ' LIMIT ? OFFSET ?').all(...args, lim, off);

  return {
    total, limit: lim, offset: off, hasMore: off + rows.length < total,
    users: rows.map(r => {
      const checks = Number(r.checks || 0);
      const wins = Number(r.wins || 0);
      return {
        id: r.id,
        email: r.email,
        name: r.name,
        plan: r.plan,
        planExpiresAt: r.planExpiresAt,
        createdAt: r.createdAt,
        viaGoogle: !!r.viaGoogle,
        hasPassword: !!r.hasPassword,
        scansUsedToday: r.scansUsedToday,
        scansUsedThisMonth: r.scansUsedThisMonth,
        checks,
        wins,
        losses: checks - wins,
        winRate: checks ? Math.round((wins / checks) * 1000) / 10 : 0,
        prizeTotal: Number(r.prizeTotal || 0),
        prizeTotalFormatted: fmtRs(r.prizeTotal || 0),
        scans: Number(r.scans || 0),
        lastCheckAt: r.lastCheckAt || null,
        lastWinAt: r.lastWinAt || null,
        isAdmin: ADMIN_EMAILS.includes(String(r.email || '').toLowerCase()),
      };
    }),
  };
}

// ---------------------------------------------------------------
// ADMIN — එක user කෙනෙක්ගේ සම්පූර්ණ විස්තරය
// ---------------------------------------------------------------
function adminUserDetail(userId) {
  const u = prepare(`
    SELECT id, email, name, plan, planExpiresAt, createdAt,
           scansUsedToday, scansUsedThisMonth, lastScanDate, lastScanMonth,
           CASE WHEN googleId IS NOT NULL THEN 1 ELSE 0 END AS viaGoogle,
           CASE WHEN passwordHash IS NOT NULL THEN 1 ELSE 0 END AS hasPassword
    FROM users WHERE id = ?
  `).get(userId);
  if (!u) return null;

  const payments = prepare(`
    SELECT orderId, plan, amountRs, status, createdAt, completedAt
    FROM payments WHERE userId = ? ORDER BY id DESC LIMIT 50
  `).all(userId);

  return {
    user: {
      id: u.id, email: u.email, name: u.name, plan: u.plan,
      planExpiresAt: u.planExpiresAt, createdAt: u.createdAt,
      viaGoogle: !!u.viaGoogle, hasPassword: !!u.hasPassword,
      scansUsedToday: u.scansUsedToday, scansUsedThisMonth: u.scansUsedThisMonth,
      lastScanDate: u.lastScanDate, lastScanMonth: u.lastScanMonth,
      isAdmin: ADMIN_EMAILS.includes(String(u.email || '').toLowerCase()),
    },
    stats: userStats(userId),
    report: userReport(userId),
    history: userHistory(userId, { limit: 50 }).items,
    payments: payments.map(p => ({
      ...p, amountFormatted: fmtRs(p.amountRs),
    })),
  };
}

// ---------------------------------------------------------------
// ADMIN — ලොතරැයි අනුව සමස්ත report (හැම user ගේම)
// ---------------------------------------------------------------
function adminReport({ from, to, userId } = {}) {
  const df = dateFilter(from, to);
  const args = [];
  let extra = '';
  if (userId) { extra = ' AND userId = ?'; args.push(userId); }

  const rows = prepare(`
    SELECT slug, MAX(lotteryName) AS lotteryName, MAX(provider) AS provider,
           COUNT(*) AS checks,
           COALESCE(SUM(won), 0) AS wins,
           ${WON_MONEY} AS prizeTotal,
           ${NONCASH_WINS} AS nonCashWins,
           COUNT(DISTINCT userId) AS players,
           COUNT(DISTINCT CASE WHEN won = 1 THEN userId END) AS winners,
           MAX(createdAt) AS lastCheckAt
    FROM checks
    WHERE 1 = 1${df.sql}${extra}
    GROUP BY slug
    ORDER BY checks DESC, lotteryName ASC
  `).all(...df.args, ...args);

  const byLottery = rows.map(r => {
    const checks = Number(r.checks || 0);
    const wins = Number(r.wins || 0);
    return {
      slug: r.slug,
      lotteryName: r.lotteryName,
      provider: r.provider,
      checks,
      wins,
      winRate: checks ? Math.round((wins / checks) * 1000) / 10 : 0,
      prizeTotal: Number(r.prizeTotal || 0),
      prizeTotalFormatted: fmtRs(r.prizeTotal || 0),
      nonCashWins: Number(r.nonCashWins || 0),
      players: Number(r.players || 0),
      winners: Number(r.winners || 0),
      lastCheckAt: r.lastCheckAt || null,
    };
  });

  const totals = byLottery.reduce((a, b) => {
    a.checks += b.checks; a.wins += b.wins; a.prizeTotal += b.prizeTotal;
    return a;
  }, { checks: 0, wins: 0, prizeTotal: 0 });

  const topTiers = prepare(`
    SELECT tier, prizeLabel, COUNT(*) AS n,
           COALESCE(SUM(prizeAmountRs), 0) AS prizeTotal
    FROM checks
    WHERE won = 1${df.sql}${extra}
    GROUP BY tier ORDER BY n DESC LIMIT 20
  `).all(...df.args, ...args);

  return {
    range: { from: from || null, to: to || null },
    overall: {
      ...totals,
      winRate: totals.checks ? Math.round((totals.wins / totals.checks) * 1000) / 10 : 0,
      prizeTotalFormatted: fmtRs(totals.prizeTotal),
      lotteries: byLottery.length,
    },
    byLottery,
    topTiers: topTiers.map(t => ({
      tier: t.tier, prizeLabel: t.prizeLabel, count: Number(t.n),
      prizeTotal: Number(t.prizeTotal || 0),
      prizeTotalFormatted: fmtRs(t.prizeTotal || 0),
    })),
  };
}

module.exports = {
  isAdmin, adminEmails, ADMIN_EMAILS,
  logCheck,
  userStats, userHistory, userReport,
  adminOverview, adminUsers, adminUserDetail, adminReport,
  fmtRs,
};
