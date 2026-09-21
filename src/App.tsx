import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { QRScanner, ScannerDiagnostics } from './components/QRScanner';
import { AiTicketScanner } from './components/AiTicketScanner';
import { ScanResultModal, ScannedTicketView } from './components/ScanResultModal';
import { ManualCheckView } from './components/ManualCheckView';
import { AllResultsView } from './components/AllResultsView';
import { AiPredictionsView } from './components/AiPredictionsView';
import { HistoryView } from './components/HistoryView';
import { AccountAndLegalView } from './components/AccountAndLegalView';
import { AdBannerModal } from './components/AdBannerModal';
import { AdminPanelView } from './components/AdminPanelView';
import { DisclaimerModal, DisclaimerRecord, DISCLAIMER_STORAGE_KEY } from './components/DisclaimerModal';
import { applyServerResults } from './data/lotteriesData';
import { parseLotteryQR, ParsedTicketQR } from './utils/qrParser';
import { resolveTicket, TicketResolution } from './utils/drawResolver';
import { evaluateLotteryPrize } from './utils/prizeCalculator';
import { installGlobalAudioUnlock } from './utils/audioFeedback';
import {
  DrawMatchMethod,
  DrawResolutionStatus,
  Language,
  LotteryDraw,
  PrizeEvaluation,
  ScanHistoryRecord
} from './types/lottery';

const HISTORY_STORAGE_KEY = 'lk_lottery_history_v2';

function detectInitialLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('si')) return 'si';
  if (lang.startsWith('ta')) return 'ta';
  return 'en';
}

interface ScanContext {
  parsed: ParsedTicketQR;
  resolution: TicketResolution;
  ticket: ScannedTicketView;
  scanMethod: 'qr' | 'ai';
  rawPayload: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('scanner');
  const [language, setLanguage] = useState<Language>(() => detectInitialLanguage());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [scansLeft, setScansLeft] = useState<number>(50);
  const [scanCount, setScanCount] = useState<number>(0);
  const [disclaimerRecord, setDisclaimerRecord] = useState<DisclaimerRecord | null>(() => {
    try {
      const saved = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
      if (saved) {
        const record = JSON.parse(saved);
        if (record?.acceptedAt) return record as DisclaimerRecord;
      }
    } catch {
      /* ignore corrupt storage */
    }
    return null;
  });
  const [dataVersion, setDataVersion] = useState<number>(0);

  const [isScannerPaused, setIsScannerPaused] = useState<boolean>(false);
  const [isAiScanOpen, setIsAiScanOpen] = useState<boolean>(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState<boolean>(false);
  const [isAdOpen, setIsAdOpen] = useState<boolean>(false);

  // Scanner diagnostics + camera capture hook for the AI reader
  const [diagnostics, setDiagnostics] = useState<ScannerDiagnostics | null>(null);
  const captureRef = useRef<(() => Promise<string | null>) | null>(null);
  const [captureAvailable, setCaptureAvailable] = useState<boolean>(false);

  // Active scan presentation
  const [scanKey, setScanKey] = useState<string>('');
  const [activeLotteryName, setActiveLotteryName] = useState<string>('');
  const [activeLotterySlug, setActiveLotterySlug] = useState<string>('');
  const [activeOfficialDraw, setActiveOfficialDraw] = useState<LotteryDraw | null>(null);
  const [activeScannedTicket, setActiveScannedTicket] = useState<ScannedTicketView>({ numbers: [] });
  const [activeEvaluation, setActiveEvaluation] = useState<PrizeEvaluation | null>(null);
  const [activeStatus, setActiveStatus] = useState<DrawResolutionStatus>('verified');
  const [activeMatchMethod, setActiveMatchMethod] = useState<DrawMatchMethod>('none');
  const [activeWarnings, setActiveWarnings] = useState<string[]>([]);
  const [activeRawPayload, setActiveRawPayload] = useState<string | null>(null);
  const [activeCandidates, setActiveCandidates] = useState<LotteryDraw[]>([]);
  const [activePrintedDrawNo, setActivePrintedDrawNo] = useState<string | null>(null);
  const [activePrintedDate, setActivePrintedDate] = useState<string | null>(null);
  const [activeScanMethod, setActiveScanMethod] = useState<'qr' | 'ai' | 'manual'>('qr');

  const activeContextRef = useRef<ScanContext | null>(null);
  const scanCountRef = useRef<number>(0);
  const lastAdShownForRef = useRef<number>(0);

  // History
  const [history, setHistory] = useState<ScanHistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY) || localStorage.getItem('lk_lottery_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore corrupt storage */
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      /* storage full / private mode */
    }
  }, [history]);

  useEffect(() => installGlobalAudioUnlock(), []);

  /* Keep the results dataset as fresh as the server can make it. */
  useEffect(() => {
    let cancelled = false;
    fetch('/api/lotteries')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.lotteries) return;
        const touched = applyServerResults(data.lotteries);
        if (touched > 0) setDataVersion((v) => v + 1);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /* Record the disclaimer acceptance locally and on the server. */
  const handleAcceptDisclaimer = useCallback((record: DisclaimerRecord) => {
    try {
      localStorage.setItem(DISCLAIMER_STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* private mode */
    }
    setDisclaimerRecord(record);
    fetch('/api/disclaimer/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(() => undefined);
  }, []);

  const addHistoryRecord = useCallback((record: ScanHistoryRecord) => {
    setHistory((prev) => [record, ...prev]);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Core scan pipeline                                                  */
  /* ------------------------------------------------------------------ */
  const presentScan = useCallback(
    (context: ScanContext, draw: LotteryDraw | null, status: DrawResolutionStatus, matchMethod: DrawMatchMethod) => {
      const { parsed, ticket, scanMethod, rawPayload } = context;
      const lottery = context.resolution.lottery;

      let evaluation: PrizeEvaluation | null = null;
      if (draw && lottery) {
        evaluation = evaluateLotteryPrize(
          lottery.slug,
          draw,
          {
            letter: ticket.letter ?? null,
            zodiac: ticket.zodiac ?? null,
            superNumber: ticket.superNumber ?? null,
            numbers: ticket.numbers
          },
          context.resolution.subGameIndex
        );
      }

      if (evaluation?.matchedNumbers && ticket.numbers.length === 0) {
        evaluation = { ...evaluation, unavailable: true };
      }

      const warnings = [...context.resolution.warnings];
      if (evaluation && evaluation.matchedNumbers.length !== evaluation.matchedCount) {
        // Defensive: keep the count authoritative for the UI.
        evaluation = { ...evaluation, matchedCount: evaluation.matchedNumbers.length };
      }

      const recordId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const record: ScanHistoryRecord = {
        id: recordId,
        timestamp: Date.now(),
        lotterySlug: lottery?.slug || parsed.lotterySlug || 'unknown',
        lotteryName: lottery?.name || parsed.lotteryName || 'Unknown lottery',
        provider: lottery?.provider || parsed.provider || 'NLB',
        drawNo: draw?.drawNo,
        date: draw?.date,
        scannedNumbers: ticket.numbers,
        scannedLetter: ticket.letter ?? null,
        scannedZodiac: ticket.zodiac ?? null,
        scannedSuperNumber: ticket.superNumber ?? null,
        officialDraw: draw || undefined,
        prizeEvaluation:
          evaluation || {
            won: false,
            tier: null,
            prizeLabel: null,
            prizeAmountRs: 0,
            prizeAmountFormatted: null,
            matchedCount: 0,
            matchedNumbers: [],
            unavailable: true
          },
        scanMethod,
        rawPayload: rawPayload ? rawPayload.slice(0, 4000) : undefined,
        matchMethod,
        resolutionStatus: status,
        warnings,
        subGameIndex: context.resolution.subGameIndex,
        printedDrawNo: context.resolution.printedDrawNo,
        printedDate: context.resolution.printedDate
      };

      addHistoryRecord(record);

      // The interstitial is shown AFTER the result modal closes, so it never
      // hides the win/lose result the user is reading.
      scanCountRef.current += 1;
      setScanCount(scanCountRef.current);
      setScansLeft((prev) => Math.max(0, prev - 1));

      // Present
      setScanKey(recordId);
      setActiveLotteryName(record.lotteryName);
      setActiveLotterySlug(record.lotterySlug);
      setActiveOfficialDraw(draw);
      setActiveScannedTicket(ticket);
      setActiveEvaluation(evaluation);
      setActiveStatus(status);
      setActiveMatchMethod(matchMethod);
      setActiveWarnings(warnings);
      setActiveRawPayload(rawPayload);
      setActiveCandidates(status === 'verified' ? [] : context.resolution.candidateDraws);
      setActivePrintedDrawNo(context.resolution.printedDrawNo);
      setActivePrintedDate(context.resolution.printedDate);
      setActiveScanMethod(scanMethod);

      setIsScannerPaused(true);
      setIsResultModalOpen(true);
    },
    [addHistoryRecord]
  );

  const handleProcessTicket = useCallback(
    (parsed: ParsedTicketQR, scanMethod: 'qr' | 'ai' = 'qr', rawPayload?: string) => {
      const resolution = resolveTicket(parsed);

      const ticket: ScannedTicketView = {
        letter: resolution.letter,
        zodiac: resolution.zodiac,
        superNumber: resolution.superNumber,
        numbers: resolution.numbers
      };

      const context: ScanContext = {
        parsed,
        resolution,
        ticket,
        scanMethod,
        rawPayload: rawPayload || parsed.rawPayload || ''
      };
      activeContextRef.current = context;

      presentScan(context, resolution.draw || null, resolution.status, resolution.matchedBy);
    },
    [presentScan]
  );

  /** Re-scores the current ticket against a draw the user picked manually. */
  const handleManualDrawSelect = useCallback((draw: LotteryDraw) => {
    const context = activeContextRef.current;
    if (!context) return;

    const warnings = [
      ...context.resolution.warnings,
      `Verified manually against draw #${draw.drawNo} (${draw.date}).`
    ];
    const rematch: TicketResolution = {
      ...context.resolution,
      draw,
      status: 'verified',
      matchedBy: 'manual',
      warnings,
      candidateDraws: []
    };
    const nextContext: ScanContext = { ...context, resolution: rematch };
    activeContextRef.current = nextContext;

    const lottery = rematch.lottery;
    const evaluation = lottery
      ? evaluateLotteryPrize(
          lottery.slug,
          draw,
          {
            letter: context.ticket.letter ?? null,
            zodiac: context.ticket.zodiac ?? null,
            superNumber: context.ticket.superNumber ?? null,
            numbers: context.ticket.numbers
          },
          rematch.subGameIndex
        )
      : null;

    // Keep the history entry written for this scan in sync.
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const [latest, ...rest] = prev;
      return [
        {
          ...latest,
          drawNo: draw.drawNo,
          date: draw.date,
          officialDraw: draw,
          matchMethod: 'manual' as DrawMatchMethod,
          resolutionStatus: 'verified' as DrawResolutionStatus,
          warnings,
          prizeEvaluation:
            evaluation ||
            ({
              won: false,
              tier: null,
              prizeLabel: null,
              prizeAmountRs: 0,
              prizeAmountFormatted: null,
              matchedCount: 0,
              matchedNumbers: [],
              unavailable: true
            } as PrizeEvaluation)
        },
        ...rest
      ];
    });

    setActiveOfficialDraw(draw);
    setActiveEvaluation(evaluation);
    setActiveStatus('verified');
    setActiveMatchMethod('manual');
    setActiveWarnings(warnings);
    setActiveCandidates([]);
  }, []);

  const maybeShowAd = useCallback(() => {
    const count = scanCountRef.current;
    if (count > 0 && count % 3 === 0 && lastAdShownForRef.current !== count) {
      lastAdShownForRef.current = count;
      window.setTimeout(() => setIsAdOpen(true), 400);
    }
  }, []);

  const handleAutoResume = useCallback(() => {
    setIsResultModalOpen(false);
    setIsScannerPaused(false);
    maybeShowAd();
  }, [maybeShowAd]);

  const handleCloseModal = useCallback(() => {
    setIsResultModalOpen(false);
    setIsScannerPaused(false);
    maybeShowAd();
  }, [maybeShowAd]);

  const handleScanFromQr = useCallback(
    (raw: string) => {
      const parsed = parseLotteryQR(raw);
      handleProcessTicket(parsed, 'qr', raw);
    },
    [handleProcessTicket]
  );

  const handleTicketFromAi = useCallback(
    (parsed: ParsedTicketQR, raw: string) => {
      handleProcessTicket(parsed, 'ai', raw);
    },
    [handleProcessTicket]
  );

  const handleCaptureReady = useCallback((capture: (() => Promise<string | null>) | null) => {
    captureRef.current = capture;
    setCaptureAvailable(Boolean(capture));
  }, []);

  const aiCaptureFn = useMemo(
    () => (captureAvailable ? () => captureRef.current?.() ?? Promise.resolve(null) : null),
    [captureAvailable]
  );

  if (!disclaimerRecord) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <DisclaimerModal
          language={language}
          onAccept={handleAcceptDisclaimer}
          onDecline={() => {
            window.setTimeout(() => window.close(), 200);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={language}
        setLanguage={setLanguage}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        scansLeft={scansLeft}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col">
        {/*
          The scanner stays MOUNTED for every tab (just hidden) so the camera
          stream is never torn down. Restarting the stream on every tab switch
          is what used to force users to leave and re-enter the scanner.
        */}
        <div
          className={
            activeTab === 'scanner'
              ? 'w-full flex-1 flex flex-col items-center justify-center py-2 sm:py-6'
              : 'hidden'
          }
          aria-hidden={activeTab !== 'scanner'}
        >
            <div className="text-center mb-4 max-w-md">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {language === 'si'
                  ? 'අධිවේගී QR ලොතරැයි ස්කෑනරය'
                  : language === 'ta'
                  ? 'அதிவேக QR லாட்டரி ஸ்கேனர்'
                  : 'High-Speed QR Lottery Scanner'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'si'
                  ? 'ජාතික (NLB) හා සංවර්ධන (DLB) ලොතරැයි සියල්ල ක්ෂණිකව පරීක්ෂා කරන්න. කැමරාව ස්කෑන් අතරතුරද ක්‍රියාත්මකයි.'
                  : language === 'ta'
                  ? 'தேசிய மற்றும் அபிவிருத்தி லாட்டரி முடிவுகளை உடனடியாக சரிபார்க்கவும்.'
                  : 'Instant automated checking for all NLB & DLB tickets. The camera stays on between scans.'}
              </p>
            </div>

            <QRScanner
              isPaused={isScannerPaused || activeTab !== 'scanner'}
              language={language}
              onScan={handleScanFromQr}
              onOpenAiScan={() => setIsAiScanOpen(true)}
              onCaptureReady={handleCaptureReady}
              onDiagnostics={setDiagnostics}
            />

            {diagnostics && (
              <div className="w-full max-w-md mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                  {diagnostics.browser}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full border ${
                    diagnostics.state === 'running'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {diagnostics.state === 'running' ? 'camera live' : diagnostics.state}
                </span>
                {diagnostics.state === 'running' && (
                  <>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                      {diagnostics.engineNative ? 'native+js decode' : 'js decode'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                      {diagnostics.decodeFps}/s
                    </span>
                  </>
                )}
              </div>
            )}
        </div>

        {activeTab === 'manual' && (
          <ManualCheckView
            language={language}
            soundEnabled={soundEnabled}
            onRecordHistory={addHistoryRecord}
          />
        )}

        {activeTab === 'results' && <AllResultsView language={language} />}
        {activeTab === 'predictions' && <AiPredictionsView language={language} />}

        {activeTab === 'history' && (
          <HistoryView history={history} onClearHistory={() => setHistory([])} language={language} />
        )}

        {activeTab === 'account' && (
          <AccountAndLegalView
            language={language}
            scansLeft={scansLeft}
            onAddScans={(count) => setScansLeft((prev) => prev + count)}
            disclaimerAccepted={Boolean(disclaimerRecord)}
            onAcceptDisclaimer={() => handleAcceptDisclaimer(disclaimerRecord as DisclaimerRecord)}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanelView
            language={language}
            diagnostics={diagnostics}
            history={history}
            disclaimerRecord={disclaimerRecord}
          />
        )}
      </main>

      <AiTicketScanner
        isOpen={isAiScanOpen}
        onClose={() => setIsAiScanOpen(false)}
        language={language}
        onTicketParsed={handleTicketFromAi}
        captureFromCamera={aiCaptureFn}
      />

      <ScanResultModal
        isOpen={isResultModalOpen}
        scanKey={scanKey}
        onClose={handleCloseModal}
        evaluation={activeEvaluation}
        lotteryName={activeLotteryName}
        lotterySlug={activeLotterySlug}
        drawNo={activeOfficialDraw?.drawNo}
        officialDraw={activeOfficialDraw}
        scannedTicket={activeScannedTicket}
        language={language}
        soundEnabled={soundEnabled}
        onAutoResume={handleAutoResume}
        status={activeStatus}
        matchMethod={activeMatchMethod}
        warnings={activeWarnings}
        rawPayload={activeRawPayload}
        candidateDraws={activeCandidates}
        onManualDrawSelect={handleManualDrawSelect}
        printedDrawNo={activePrintedDrawNo}
        printedDate={activePrintedDate}
        scanMethod={activeScanMethod}
      />

      <AdBannerModal isOpen={isAdOpen} onClose={() => setIsAdOpen(false)} language={language} />

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>LK Lottery Master PRO • Official Sri Lankan Lottery Results Verification Tool</p>
        <p className="text-[11px] text-slate-600 mt-1">
          Compatible with National Lotteries Board (NLB) & Development Lotteries Board (DLB)
        </p>
      </footer>
    </div>
  );
}
