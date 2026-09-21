import React, { useMemo, useState } from 'react';
import {
  History,
  Trophy,
  Trash2,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Filter,
  TrendingUp,
  Percent,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { ScanHistoryRecord, Language } from '../types/lottery';
import { ALL_LOTTERIES } from '../data/lotteriesData';
import { formatRs } from '../utils/prizeCalculator';
import { toIsoDate } from '../utils/dateUtils';

interface HistoryViewProps {
  history: ScanHistoryRecord[];
  onClearHistory: () => void;
  language: Language;
}

type DateBasis = 'scan' | 'draw';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onClearHistory, language }) => {
  const [lotteryFilter, setLotteryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [dateBasis, setDateBasis] = useState<DateBasis>('scan');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showBreakdown, setShowBreakdown] = useState<boolean>(true);

  const t = {
    en: {
      title: 'Scan History & Statistics',
      subtitle: 'Every ticket you checked — filter by lottery and by date range to see wins and losses.',
      totalScans: 'Tickets checked',
      wins: 'Wins',
      losses: 'No win',
      winRate: 'Win rate',
      totalWon: 'Total winnings',
      biggest: 'Biggest win',
      filterLottery: 'Lottery',
      allLotteries: 'All lotteries',
      filterStatus: 'Result',
      allStatuses: 'All results',
      wonOnly: 'Wins only',
      lostOnly: 'No win only',
      dateBasis: 'Date basis',
      byScan: 'Scan time',
      byDraw: 'Draw date',
      from: 'From',
      to: 'To',
      today: 'Today',
      last7: 'Last 7 days',
      last30: 'Last 30 days',
      allTime: 'All time',
      clear: 'Clear history',
      exportCsv: 'Export CSV',
      empty: 'No tickets match these filters yet. Scan a ticket to start building your history.',
      draw: 'Draw',
      method: 'Method',
      breakdown: 'Per-lottery breakdown',
      lottery: 'Lottery',
      scanned: 'Checked',
      unverified: 'Needs review',
      clearConfirm: 'Delete the whole scan history? This cannot be undone.',
      official: 'Official',
      ticket: 'Ticket',
      resetFilters: 'Reset filters',
      of: 'of'
    },
    si: {
      title: 'ස්කෑන් ඉතිහාසය සහ සංඛ්‍යා ලේඛන',
      subtitle: 'පරීක්ෂා කළ සියලු ටිකට්පත් — ලොතරැයිය අනුව සහ දින පරාසය අනුව පෙරහන් කර ජය පරාජය බලන්න.',
      totalScans: 'පරීක්ෂා කළ ටිකට්පත්',
      wins: 'ජයග්‍රහණ',
      losses: 'දිනුම් නැති',
      winRate: 'ජයග්‍රහණ අනුපාතය',
      totalWon: 'මුළු ජයග්‍රහණ එකතුව',
      biggest: 'විශාලතම ජයග්‍රහණය',
      filterLottery: 'ලොතරැයිය',
      allLotteries: 'සියලු ලොතරැයි',
      filterStatus: 'ප්‍රතිඵලය',
      allStatuses: 'සියලු ප්‍රතිඵල',
      wonOnly: 'ජයග්‍රහණ පමණයි',
      lostOnly: 'දිනුම් නැති පමණයි',
      dateBasis: 'දිනය පදනම්ව',
      byScan: 'ස්කෑන් වේලාව',
      byDraw: 'දිනුම් දිනය',
      from: 'සිට',
      to: 'දක්වා',
      today: 'අද',
      last7: 'පසුගිය දින 7',
      last30: 'පසුගිය දින 30',
      allTime: 'සියලු කාලය',
      clear: 'ඉතිහාසය මකන්න',
      exportCsv: 'CSV බාගන්න',
      empty: 'මෙම පෙරහන් වලට ගැලපෙන සටහන් නොමැත. ටිකට්පතක් ස්කෑන් කරන්න.',
      draw: 'දිනුම් වාරය',
      method: 'ක්‍රමය',
      breakdown: 'ලොතරැයි අනුව විස්තරය',
      lottery: 'ලොතරැයිය',
      scanned: 'පරීක්ෂා කළ',
      unverified: 'පරීක්ෂාව අවශ්‍යයි',
      clearConfirm: 'මුළු ස්කෑන් ඉතිහාසය මකන්නද? මෙය නැවත ලබාගත නොහැක.',
      official: 'නිල',
      ticket: 'ටිකට්',
      resetFilters: 'පෙරහන් යළි සකසන්න',
      of: 'න්'
    },
    ta: {
      title: 'ஸ்கேன் வரலாறு & புள்ளிவிவரம்',
      subtitle: 'நீங்கள் சரிபார்த்த அனைத்து டிக்கெட்டுகளும் — லாட்டரி மற்றும் தேதி வரம்பு வாரியாக வெற்றி/தோல்வியைப் பார்க்கவும்.',
      totalScans: 'சரிபார்க்கப்பட்டவை',
      wins: 'வெற்றிகள்',
      losses: 'வெற்றி இல்லை',
      winRate: 'வெற்றி விகிதம்',
      totalWon: 'மொத்த வெற்றித் தொகை',
      biggest: 'மிகப்பெரிய வெற்றி',
      filterLottery: 'லாட்டரி',
      allLotteries: 'அனைத்து லாட்டரிகள்',
      filterStatus: 'முடிவு',
      allStatuses: 'அனைத்து முடிவுகள்',
      wonOnly: 'வெற்றிகள் மட்டும்',
      lostOnly: 'வெற்றி இல்லை மட்டும்',
      dateBasis: 'தேதி அடிப்படை',
      byScan: 'ஸ்கேன் நேரம்',
      byDraw: 'குலுக்கல் தேதி',
      from: 'இருந்து',
      to: 'வரை',
      today: 'இன்று',
      last7: 'கடந்த 7 நாட்கள்',
      last30: 'கடந்த 30 நாட்கள்',
      allTime: 'எல்லா காலமும்',
      clear: 'வரலாற்றை அழி',
      exportCsv: 'CSV ஏற்றுமதி',
      empty: 'இந்த வடிகட்டல்களுக்கு பொருந்தும் பதிவுகள் இல்லை.',
      draw: 'குலுக்கல்',
      method: 'முறை',
      breakdown: 'லாட்டரி வாரியான விவரம்',
      lottery: 'லாட்டரி',
      scanned: 'சரிபார்த்தது',
      unverified: 'சரிபார்ப்பு தேவை',
      clearConfirm: 'முழு வரலாற்றையும் அழிக்கவா?',
      official: 'அதிகாரப்பூர்வ',
      ticket: 'டிக்கெட்',
      resetFilters: 'வடிகட்டிகளை மீட்டமை',
      of: 'இல்'
    }
  }[language];

  /** Resolve the calendar day a record belongs to. */
  const recordDay = (record: ScanHistoryRecord): string | null => {
    if (dateBasis === 'draw') {
      return toIsoDate(record.date) || null;
    }
    const d = new Date(record.timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const inRange = (record: ScanHistoryRecord): boolean => {
    if (!fromDate && !toDate) return true;
    const day = recordDay(record);
    if (!day) return false;
    if (fromDate && day < fromDate) return false;
    if (toDate && day > toDate) return false;
    return true;
  };

  const statusMatches = (record: ScanHistoryRecord): boolean => {
    const won = Boolean(record.prizeEvaluation?.won);
    if (statusFilter === 'won') return won;
    if (statusFilter === 'lost') return !won;
    return true;
  };

  const filtered = useMemo(
    () =>
      history.filter((record) => {
        if (lotteryFilter !== 'all' && record.lotterySlug !== lotteryFilter) return false;
        if (!statusMatches(record)) return false;
        return inRange(record);
      }),
    [history, lotteryFilter, statusFilter, fromDate, toDate, dateBasis]
  );

  const stats = useMemo(() => {
    const wins = filtered.filter((r) => r.prizeEvaluation?.won);
    const losses = filtered.length - wins.length;
    const totalWon = filtered.reduce((sum, r) => sum + (r.prizeEvaluation?.prizeAmountRs || 0), 0);
    const biggest = filtered.reduce((max, r) => Math.max(max, r.prizeEvaluation?.prizeAmountRs || 0), 0);
    const unverified = filtered.filter((r) => r.resolutionStatus && r.resolutionStatus !== 'verified').length;
    return {
      total: filtered.length,
      wins: wins.length,
      losses,
      totalWon,
      biggest,
      unverified,
      winRate: filtered.length > 0 ? (wins.length / filtered.length) * 100 : 0
    };
  }, [filtered]);

  /** Per-lottery breakdown respects the date range but not the lottery filter. */
  const breakdown = useMemo(() => {
    const rows = new Map<
      string,
      { slug: string; name: string; scans: number; wins: number; losses: number; won: number }
    >();

    for (const record of history) {
      if (!inRange(record)) continue;
      const key = record.lotterySlug || 'unknown';
      const row =
        rows.get(key) ||
        { slug: key, name: record.lotteryName || key, scans: 0, wins: 0, losses: 0, won: 0 };
      row.scans += 1;
      if (record.prizeEvaluation?.won) {
        row.wins += 1;
        row.won += record.prizeEvaluation?.prizeAmountRs || 0;
      } else {
        row.losses += 1;
      }
      rows.set(key, row);
    }

    return Array.from(rows.values()).sort((a, b) => b.scans - a.scans || b.won - a.won);
  }, [history, fromDate, toDate, dateBasis, lotteryFilter]);

  const handleExportCsv = () => {
    const rows = [
      [
        'Scanned at',
        'Lottery',
        'Board',
        'Draw No',
        'Draw Date',
        'Ticket numbers',
        'Official numbers',
        'Result',
        'Tier',
        'Prize (Rs)',
        'Method',
        'Verification',
        'Raw payload'
      ],
      ...filtered.map((r) => [
        new Date(r.timestamp).toISOString(),
        r.lotteryName,
        r.provider,
        r.drawNo || '',
        r.date || '',
        `${r.scannedLetter ? r.scannedLetter + ' ' : ''}${(r.scannedNumbers || []).join('-')}`,
        `${r.officialDraw?.letter ? r.officialDraw.letter + ' ' : ''}${(r.officialDraw?.numbers || []).join('-')}`,
        r.prizeEvaluation?.won ? 'WON' : 'LOST',
        r.prizeEvaluation?.prizeLabel || '',
        String(r.prizeEvaluation?.prizeAmountRs || 0),
        r.scanMethod,
        r.resolutionStatus || 'verified',
        (r.rawPayload || '').replace(/"/g, '""')
      ])
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell)}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lk_lottery_history_${fromDate || 'all'}_${toDate || 'all'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const applyQuickRange = (days: number | null) => {
    if (days === null) {
      setFromDate('');
      setToDate('');
      return;
    }
    const today = todayIso();
    setToDate(today);
    setFromDate(days === 0 ? today : shiftDays(today, -(days - 1)));
  };

  const selectClass =
    'bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none';
  const dateInputClass =
    'bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none';

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <StatTile
          icon={<History className="w-5 h-5" />}
          tone="blue"
          label={t.totalScans}
          value={String(stats.total)}
          sub={`${filtered.length} ${t.of} ${history.length}`}
        />
        <StatTile
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="emerald"
          label={t.wins}
          value={String(stats.wins)}
          sub={`${stats.winRate.toFixed(1)}% ${t.winRate}`}
        />
        <StatTile
          icon={<XCircle className="w-5 h-5" />}
          tone="slate"
          label={t.losses}
          value={String(stats.losses)}
          sub={stats.unverified > 0 ? `${stats.unverified} ${t.unverified}` : undefined}
        />
        <StatTile
          icon={<Trophy className="w-5 h-5" />}
          tone="amber"
          label={t.totalWon}
          value={formatRs(stats.totalWon)}
        />
        <StatTile
          icon={<TrendingUp className="w-5 h-5" />}
          tone="amber"
          label={t.biggest}
          value={formatRs(stats.biggest)}
        />
        <StatTile
          icon={<Percent className="w-5 h-5" />}
          tone="purple"
          label={t.winRate}
          value={`${stats.winRate.toFixed(1)}%`}
        />
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-amber-400" />
          {t.title}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">{t.filterLottery}</label>
            <select value={lotteryFilter} onChange={(e) => setLotteryFilter(e.target.value)} className={`${selectClass} w-full`}>
              <option value="all">{t.allLotteries}</option>
              {ALL_LOTTERIES.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.name} ({l.provider})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">{t.filterStatus}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'won' | 'lost')}
              className={`${selectClass} w-full`}
            >
              <option value="all">{t.allStatuses}</option>
              <option value="won">{t.wonOnly}</option>
              <option value="lost">{t.lostOnly}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">{t.dateBasis}</label>
            <select
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value as DateBasis)}
              className={`${selectClass} w-full`}
            >
              <option value="scan">{t.byScan}</option>
              <option value="draw">{t.byDraw}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">{t.from}</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${dateInputClass} w-full`} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">{t.to}</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`${dateInputClass} w-full`} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QuickChip label={t.today} onClick={() => applyQuickRange(0)} />
          <QuickChip label={t.last7} onClick={() => applyQuickRange(7)} />
          <QuickChip label={t.last30} onClick={() => applyQuickRange(30)} />
          <QuickChip label={t.allTime} onClick={() => applyQuickRange(null)} />
          <button
            onClick={() => {
              setLotteryFilter('all');
              setStatusFilter('all');
              setFromDate('');
              setToDate('');
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            {t.resetFilters}
          </button>

          <div className="flex-1" />

          {history.length > 0 && (
            <>
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                {t.exportCsv}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t.clearConfirm)) onClearHistory();
                }}
                className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-[11px] font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.clear}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Per-lottery breakdown */}
      {breakdown.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl mb-4 overflow-hidden">
          <button
            onClick={() => setShowBreakdown((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-200"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              {t.breakdown}
            </span>
            <span className="text-[10px] text-slate-400">
              {fromDate || toDate ? `${fromDate || '…'} → ${toDate || '…'}` : t.allTime}
            </span>
          </button>

          {showBreakdown && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">{t.lottery}</th>
                    <th className="text-right px-3 py-2 font-semibold">{t.scanned}</th>
                    <th className="text-right px-3 py-2 font-semibold">{t.wins}</th>
                    <th className="text-right px-3 py-2 font-semibold">{t.losses}</th>
                    <th className="text-right px-3 py-2 font-semibold">{t.totalWon}</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row) => (
                    <tr
                      key={row.slug}
                      className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer"
                      onClick={() => setLotteryFilter(row.slug)}
                    >
                      <td className="px-3 py-2 text-slate-200 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{row.scans}</td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-bold">{row.wins}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{row.losses}</td>
                      <td className="px-3 py-2 text-right text-amber-300 font-semibold">
                        {row.won > 0 ? formatRs(row.won) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-950/70">
                  <tr>
                    <td className="px-3 py-2 font-bold text-slate-200">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-white">
                      {breakdown.reduce((s, r) => s + r.scans, 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-400">
                      {breakdown.reduce((s, r) => s + r.wins, 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-300">
                      {breakdown.reduce((s, r) => s + r.losses, 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-amber-300">
                      {formatRs(breakdown.reduce((s, r) => s + r.won, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Records */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <History className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{t.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const won = Boolean(item.prizeEvaluation?.won);
            const unverified = item.resolutionStatus && item.resolutionStatus !== 'verified';
            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  won
                    ? 'bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 border-emerald-500/40'
                    : unverified
                    ? 'bg-slate-900 border-amber-500/30'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.provider === 'NLB' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {item.provider}
                    </span>
                    <h4 className="font-bold text-white text-sm">{item.lotteryName}</h4>
                    {item.drawNo && <span className="text-xs text-slate-400 font-mono">{t.draw}: #{item.drawNo}</span>}
                    <span className="text-[10px] uppercase font-bold text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
                      {item.scanMethod}
                    </span>
                    {item.matchMethod === 'date' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        by date
                      </span>
                    )}
                    {unverified && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {item.resolutionStatus === 'not-found' ? 'draw not found' : 'needs review'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                    {item.date && <span className="text-slate-500">• {t.byDraw}: {item.date}</span>}
                  </div>

                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 uppercase mr-1">{t.ticket}</span>
                    {item.scannedLetter && (
                      <span className="w-6 h-6 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center text-[11px]">
                        {item.scannedLetter}
                      </span>
                    )}
                    {item.scannedZodiac && (
                      <span className="px-1.5 h-6 rounded bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[10px]">
                        {item.scannedZodiac}
                      </span>
                    )}
                    {item.scannedSuperNumber && (
                      <span className="w-6 h-6 rounded bg-amber-400 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                        ★{item.scannedSuperNumber}
                      </span>
                    )}
                    {(item.scannedNumbers || []).map((n, i) => (
                      <span
                        key={i}
                        className={`w-6 h-6 rounded font-mono font-bold flex items-center justify-center text-[11px] ${
                          (item.prizeEvaluation?.matchedNumbers || []).includes(n)
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>

                  {item.officialDraw && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 uppercase mr-1">{t.official}</span>
                      {item.officialDraw.letter && (
                        <span className="w-6 h-6 rounded bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[11px]">
                          {item.officialDraw.letter}
                        </span>
                      )}
                      {item.officialDraw.zodiac && (
                        <span className="px-1.5 h-6 rounded bg-purple-900/60 text-purple-300 font-bold flex items-center justify-center text-[10px]">
                          {item.officialDraw.zodiac}
                        </span>
                      )}
                      {item.officialDraw.superNumber && (
                        <span className="w-6 h-6 rounded bg-amber-900/50 text-amber-300 font-bold flex items-center justify-center text-[10px]">
                          ★{item.officialDraw.superNumber}
                        </span>
                      )}
                      {item.officialDraw.numbers.map((n, i) => (
                        <span
                          key={i}
                          className="w-6 h-6 rounded bg-slate-800 text-slate-100 font-mono font-bold flex items-center justify-center text-[11px]"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  {won ? (
                    <div>
                      <div className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{item.prizeEvaluation?.prizeLabel || 'WINNER'}</span>
                      </div>
                      <div className="text-lg font-black text-white mt-1">
                        {item.prizeEvaluation?.prizeAmountFormatted || formatRs(item.prizeEvaluation?.prizeAmountRs ?? 0)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                      <XCircle className="w-4 h-4" />
                      <span>{unverified ? t.unverified : t.losses}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: 'blue' | 'emerald' | 'slate' | 'amber' | 'purple';
}> = ({ icon, label, value, sub, tone }) => {
  const toneClass = {
    blue: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
    emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
    slate: 'bg-slate-700/30 border-slate-600 text-slate-400',
    amber: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
    purple: 'bg-purple-500/20 border-purple-500/40 text-purple-400'
  }[tone];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${toneClass}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label}</div>
        <div className="text-lg font-black text-white truncate">{value}</div>
        {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
      </div>
    </div>
  );
};

const QuickChip: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700"
  >
    {label}
  </button>
);
