import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Download,
  Upload,
  Database,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  LogOut,
  Activity,
  Lock
} from 'lucide-react';
import { Language, ScanHistoryRecord } from '../types/lottery';
import { DISCLAIMER_STORAGE_KEY, DisclaimerRecord } from './DisclaimerModal';
import { ScannerDiagnostics } from './QRScanner';

const ADMIN_KEY_STORAGE = 'lk_lottery_admin_key';

interface AdminPanelViewProps {
  language: Language;
  diagnostics: ScannerDiagnostics | null;
  history: ScanHistoryRecord[];
  disclaimerRecord: DisclaimerRecord | null;
}

interface ResultsStatus {
  lotteries?: number;
  draws?: number;
  newestDraw?: { slug?: string; drawNo?: string; date?: string } | null;
  lastRefreshAt?: string | null;
  lastRefreshSource?: string | null;
  lastRefreshError?: string | null;
  sources?: string[];
  storagePath?: string | null;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  language,
  diagnostics,
  history,
  disclaimerRecord
}) => {
  const [adminKey, setAdminKey] = useState<string>(() => localStorage.getItem(ADMIN_KEY_STORAGE) || '');
  const [keyInput, setKeyInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [records, setRecords] = useState<any[] | null>(null);
  const [status, setStatus] = useState<ResultsStatus | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const t = {
    en: {
      title: 'Admin Panel',
      locked: 'Admin access',
      lockedHint: 'Enter the admin key configured in your .env (ADMIN_KEY).',
      unlock: 'Unlock',
      lock: 'Lock panel',
      wrongKey: 'Wrong admin key.',
      serverOffline: 'Server not reachable — showing local data only.',
      disclaimerRecords: 'Disclaimer acceptance records',
      disclaimerHint:
        'Every acceptance is stored on the server with the timestamp, device and browser. This is the audit trail.',
      localRecord: 'This device',
      noRecords: 'No acceptance records found on the server yet.',
      export: 'Export CSV',
      records: 'records',
      dataStatus: 'Results data status',
      lotteries: 'Lotteries',
      draws: 'Draws',
      newest: 'Newest draw',
      lastRefresh: 'Last refresh',
      never: 'never',
      refreshNow: 'Refresh results',
      importJson: 'Import results (JSON)',
      importHint:
        'The official NLB / DLB sites block automated scraping. Export the latest results as JSON and import them here — the file is merged and stored on the server.',
      fileName: 'Choose a JSON file',
      source: 'Source',
      error: 'Last error',
      scannerDiag: 'Scanner diagnostics',
      browser: 'Browser',
      state: 'Camera state',
      engine: 'Last engine',
      native: 'Native detector',
      fps: 'Decode rate',
      sound: 'Audio primed',
      history: 'Scans recorded',
      clearLocal: 'Clear local admin data',
      cleanOk: 'Done.',
      notSupported: 'not supported'
    },
    si: {
      title: 'පරිපාලක පැනලය',
      locked: 'පරිපාලක ප්‍රවේශය',
      lockedHint: '.env හි සකසා ඇති පරිපාලක යතුර (ADMIN_KEY) ඇතුළත් කරන්න.',
      unlock: 'විවෘත කරන්න',
      lock: 'පැනලය අගුළු දමන්න',
      wrongKey: 'පරිපාලක යතුර වැරදියි.',
      serverOffline: 'සේවාදායකයට සම්බන්ධ විය නොහැක — දේශීය දත්ත පමණක් පෙන්වයි.',
      disclaimerRecords: 'වගකීම් ප්‍රතික්ෂේපන අනුමැති වාර්තා',
      disclaimerHint: 'සෑම අනුමැතියක්ම වේලාව, උපාංගය සහ බ්‍රව්සරය සමඟ සේවාදායකයේ සුරැකේ.',
      localRecord: 'මෙම උපාංගය',
      noRecords: 'සේවාදායකයේ අනුමැති වාර්තා නොමැත.',
      export: 'CSV බාගන්න',
      records: 'වාර්තා',
      dataStatus: 'ප්‍රතිඵල දත්ත තත්ත්වය',
      lotteries: 'ලොතරැයි',
      draws: 'දිනුම් වාර',
      newest: 'නවතම වාරය',
      lastRefresh: 'අවසන් යාවත්කාලීනය',
      never: 'කිසිවිටෙකත් නැත',
      refreshNow: 'ප්‍රතිඵල යාවත්කාලීන කරන්න',
      importJson: 'ප්‍රතිඵල ආයාත කරන්න (JSON)',
      importHint:
        'නිල NLB / DLB වෙබ් අඩවි ස්වයංක්‍රීය ලබාගැනීම අවහිර කරයි. නවතම ප්‍රතිඵල JSON ලෙස ආයාත කරන්න — එය සේවාදායකයේ ඒකාබද්ධ වේ.',
      fileName: 'JSON ගොනුවක් තෝරන්න',
      source: 'මූලාශ්‍රය',
      error: 'අවසන් දෝෂය',
      scannerDiag: 'ස්කෑනර් තත්ත්වය',
      browser: 'බ්‍රව්සරය',
      state: 'කැමරා තත්ත්වය',
      engine: 'අවසන් එන්ජිම',
      native: 'දේශීය හඳුනාගැනීම',
      fps: 'කියවීමේ වේගය',
      sound: 'ශබ්දය සක්‍රීයයි',
      history: 'ස්කෑන් වාර්තා',
      clearLocal: 'දේශීය පරිපාලක දත්ත මකන්න',
      cleanOk: 'සම්පූර්ණයි.',
      notSupported: 'නොමැත'
    },
    ta: {
      title: 'நிர்வாக பலகை',
      locked: 'நிர்வாக அணுகல்',
      lockedHint: '.env இல் அமைக்கப்பட்ட ADMIN_KEY ஐ உள்ளிடவும்.',
      unlock: 'திற',
      lock: 'பலகையை பூட்டு',
      wrongKey: 'தவறான நிர்வாக விசை.',
      serverOffline: 'சேவையகம் கிடைக்கவில்லை — உள்ளூர் தரவு மட்டும்.',
      disclaimerRecords: 'மறுப்பு ஏற்பு பதிவுகள்',
      disclaimerHint: 'ஒவ்வொரு ஏற்பும் நேரம், சாதனம், உலாவியுடன் சேவையகத்தில் சேமிக்கப்படும்.',
      localRecord: 'இந்த சாதனம்',
      noRecords: 'சேவையகத்தில் பதிவுகள் இல்லை.',
      export: 'CSV ஏற்றுமதி',
      records: 'பதிவுகள்',
      dataStatus: 'முடிவுகள் தரவு நிலை',
      lotteries: 'லாட்டரிகள்',
      draws: 'குலுக்கல்கள்',
      newest: 'புதிய குலுக்கல்',
      lastRefresh: 'கடைசி புதுப்பிப்பு',
      never: 'இல்லை',
      refreshNow: 'முடிவுகளை புதுப்பி',
      importJson: 'முடிவுகளை இறக்குமதி (JSON)',
      importHint: 'அதிகாரப்பூர்வ தளங்கள் தானியங்கி ஸ்கிராப்பிங்கை தடுக்கின்றன. JSON கோப்பை இறக்குமதி செய்யவும்.',
      fileName: 'JSON கோப்பைத் தேர்வு',
      source: 'மூலம்',
      error: 'கடைசி பிழை',
      scannerDiag: 'ஸ்கேனர் கண்டறிதல்',
      browser: 'உலாவி',
      state: 'கேமரா நிலை',
      engine: 'கடைசி இன்ஜின்',
      native: 'இயல்பான கண்டறிதல்',
      fps: 'டிகோட் வேகம்',
      sound: 'ஒலி தயார்',
      history: 'பதிவான ஸ்கேன்கள்',
      clearLocal: 'உள்ளூர் நிர்வாக தரவை அழி',
      cleanOk: 'முடிந்தது.',
      notSupported: 'இல்லை'
    }
  }[language];

  const loadAll = useCallback(
    async (key: string) => {
      setBusy(true);
      setAuthError(null);
      setMessage(null);
      try {
        const [recordsRes, statusRes] = await Promise.all([
          fetch(`/api/admin/disclaimer-records?key=${encodeURIComponent(key)}`),
          fetch('/api/results-status')
        ]);

        if (recordsRes.status === 401 || recordsRes.status === 403) {
          setAuthError(t.wrongKey);
          setRecords(null);
          setBusy(false);
          return false;
        }

        if (recordsRes.ok) {
          const data = await recordsRes.json();
          setRecords(Array.isArray(data.records) ? data.records : []);
        } else {
          setRecords(null);
          setMessage(t.serverOffline);
        }

        if (statusRes.ok) setStatus(await statusRes.json());
        else setMessage(t.serverOffline);
      } catch {
        setRecords(null);
        setMessage(t.serverOffline);
      }
      setBusy(false);
      return true;
    },
    [t.serverOffline, t.wrongKey]
  );

  useEffect(() => {
    if (adminKey) void loadAll(adminKey);
  }, [adminKey, loadAll]);

  const handleUnlock = async () => {
    const key = keyInput.trim();
    if (!key) return;
    const ok = await loadAll(key);
    if (ok) {
      localStorage.setItem(ADMIN_KEY_STORAGE, key);
      setAdminKey(key);
      setKeyInput('');
    }
  };

  const handleLock = () => {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey('');
    setRecords(null);
    setStatus(null);
  };

  const handleRefresh = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/refresh?key=${encodeURIComponent(adminKey)}`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setMessage(`${t.refreshNow}: ${data.addedDraws ?? 0} new draw(s) merged.`);
      } else {
        setMessage(`${t.error}: ${data?.error || data?.lastRefreshError || 'refresh failed'}`);
      }
      await loadAll(adminKey);
    } catch (err: any) {
      setMessage(`${t.error}: ${err?.message || err}`);
    }
    setBusy(false);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const res = await fetch(`/api/results/import?key=${encodeURIComponent(adminKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setMessage(
          `${t.importJson}: ${data.lotteries ?? 0} ${t.lotteries}, ${data.draws ?? 0} ${t.draws} (${data.addedDraws ?? 0} new).`
        );
      } else {
        setMessage(`${t.error}: ${data?.error || 'import failed'}`);
      }
      await loadAll(adminKey);
    } catch (err: any) {
      setMessage(`${t.error}: ${err?.message || err}`);
    }
    setBusy(false);
  };

  const exportCsv = () => {
    if (!records || records.length === 0) return;
    const rows = [
      ['Accepted at', 'Version', 'Name', 'Device', 'Platform', 'Language', 'Screen', 'Timezone', 'IP', 'User agent'],
      ...records.map((r) => [
        r.acceptedAt || '',
        r.version || '',
        r.userName || '',
        r.device || '',
        r.platform || '',
        r.language || '',
        r.screen || '',
        r.timezone || '',
        r.ip || '',
        r.userAgent || ''
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'disclaimer_acceptance_records.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* -------------------- Locked -------------------- */
  if (!adminKey) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-10">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">{t.locked}</h2>
          <p className="text-xs text-slate-400 mt-1 mb-4">{t.lockedHint}</p>

          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-500" />
            <input
              id="admin-key-input"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleUnlock()}
              placeholder="ADMIN_KEY"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          {authError && <p className="mt-3 text-xs text-rose-400">{authError}</p>}
          {message && <p className="mt-3 text-xs text-amber-300">{message}</p>}

          <button
            id="btn-admin-unlock"
            disabled={busy || !keyInput.trim()}
            onClick={() => void handleUnlock()}
            className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <ShieldCheck className="w-4 h-4" />
            {t.unlock}
          </button>
        </div>
      </div>
    );
  }

  /* -------------------- Unlocked -------------------- */
  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{t.title}</h2>
            <p className="text-[11px] text-slate-400">
              {records ? `${records.length} ${t.records}` : t.serverOffline}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadAll(adminKey)}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            {t.refreshNow}
          </button>
          <button
            onClick={handleLock}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.lock}
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700 text-[11px] text-slate-200">{message}</div>
      )}

      {/* Results data status */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-sky-400" />
          {t.dataStatus}
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <InfoTile label={t.lotteries} value={String(status?.lotteries ?? '—')} />
          <InfoTile label={t.draws} value={String(status?.draws ?? '—')} />
          <InfoTile
            label={t.newest}
            value={status?.newestDraw ? `#${status.newestDraw.drawNo} • ${status.newestDraw.date}` : '—'}
          />
          <InfoTile
            label={t.lastRefresh}
            value={status?.lastRefreshAt ? new Date(status.lastRefreshAt).toLocaleString() : t.never}
          />
        </div>

        <div className="mt-3 space-y-1 text-[11px] text-slate-400">
          {status?.lastRefreshSource && (
            <div>
              {t.source}: <span className="text-slate-200">{status.lastRefreshSource}</span>
            </div>
          )}
          {status?.lastRefreshError && (
            <div className="text-amber-300">
              {t.error}: {status.lastRefreshError}
            </div>
          )}
          {status?.sources && status.sources.length > 0 && (
            <div className="font-mono text-[10px] text-slate-500 break-all">
              {status.sources.join(' | ')}
            </div>
          )}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-100">{t.importHint}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void handleRefresh()}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-200 text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            {t.refreshNow}
          </button>
          <label className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            {t.fileName}
            <input type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </section>

      {/* Disclaimer acceptance records */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            {t.disclaimerRecords}
          </h3>
          {records && records.length > 0 && (
            <button
              onClick={exportCsv}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {t.export}
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mb-3">{t.disclaimerHint}</p>

        {disclaimerRecord && (
          <div className="mb-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
            <span className="text-slate-500 uppercase text-[10px] mr-2">{t.localRecord}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />
            {new Date(disclaimerRecord.acceptedAt).toLocaleString()} • v{disclaimerRecord.version} •{' '}
            {disclaimerRecord.device} • {disclaimerRecord.screen}
            {disclaimerRecord.userName ? ` • ${disclaimerRecord.userName}` : ''}
          </div>
        )}

        {records === null ? (
          <p className="text-xs text-slate-400">{t.serverOffline}</p>
        ) : records.length === 0 ? (
          <p className="text-xs text-slate-400">{t.noRecords}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-950/70 text-slate-400">
                <tr>
                  <th className="text-left px-2.5 py-2 font-semibold">#</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Accepted at</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Name</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Device</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Screen</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Lang</th>
                  <th className="text-left px-2.5 py-2 font-semibold">IP</th>
                  <th className="text-left px-2.5 py-2 font-semibold">Version</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr key={record.id || index} className="border-t border-slate-800">
                    <td className="px-2.5 py-2 text-slate-500">{records.length - index}</td>
                    <td className="px-2.5 py-2 text-slate-200">
                      {record.acceptedAt ? new Date(record.acceptedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-slate-300">{record.userName || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-300">{record.device || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-400">{record.screen || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-400 uppercase">{record.language || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-500 font-mono">{record.ip || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-500">{record.version || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Scanner diagnostics */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-amber-400" />
          {t.scannerDiag}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <InfoTile label={t.browser} value={diagnostics?.browser || '—'} />
          <InfoTile label={t.state} value={diagnostics?.state || '—'} />
          <InfoTile label={t.engine} value={diagnostics?.engineLast || '—'} />
          <InfoTile
            label={t.native}
            value={diagnostics?.engineNative ? 'yes' : t.notSupported}
          />
          <InfoTile label={t.fps} value={diagnostics ? `${diagnostics.decodeFps}/s` : '—'} />
          <InfoTile label={t.history} value={String(history.length)} />
          <InfoTile
            label={t.sound}
            value={diagnostics ? (diagnostics.state === 'running' ? 'yes' : '—') : '—'}
          />
          {diagnostics?.lastRawPayload && (
            <div className="col-span-2 lg:col-span-3">
              <div className="text-[10px] uppercase text-slate-500 mb-1">Last raw payload</div>
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px] text-emerald-300 font-mono">
                {diagnostics.lastRawPayload}
              </pre>
            </div>
          )}
        </div>
      </section>

      <button
        onClick={() => {
          localStorage.removeItem(DISCLAIMER_STORAGE_KEY);
          setMessage(t.cleanOk);
        }}
        className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-2"
      >
        <Clock className="w-3.5 h-3.5" />
        {t.clearLocal}
      </button>
    </div>
  );
};

const InfoTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
    <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">{label}</div>
    <div className="text-slate-100 font-semibold truncate">{value}</div>
  </div>
);
