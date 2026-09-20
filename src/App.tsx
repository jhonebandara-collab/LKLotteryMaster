import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ManualCheckView } from './components/ManualCheckView';
import { AIGuessView } from './components/AIGuessView';
import { ResultsArchiveView } from './components/ResultsArchiveView';
import { MyAccountView } from './components/MyAccountView';
import { AdminView } from './components/AdminView';
import { ContinuousScannerModal } from './components/ContinuousScannerModal';
import { TicketCheckResultModal } from './components/TicketCheckResultModal';
import { AdModal } from './components/AdModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { DisclaimerModal } from './components/DisclaimerModal';
import { PolicyModal } from './components/PolicyModal';

import { getStoredUser, saveStoredUser, incrementCheckCounter } from './services/storageService';
import { evaluateLotteryPrize } from './data/prizes';
import { getLotteryBySlug } from './data/lotteries';
import { DecodedQRResult } from './data/qrParser';
import { UserProfile, PrizeEvaluationResult, TicketCheckInput, LotteryDraw, SavedTicket } from './types';
import { ShieldCheck, Heart, ExternalLink, Sparkles, QrCode } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<'si' | 'en'>('si');
  const [activeTab, setActiveTab] = useState<string>('check');
  const [user, setUser] = useState<UserProfile>(getStoredUser());

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerMode, setScannerMode] = useState<'qr' | 'ai'>('qr');
  const [isResultOpen, setIsResultOpen] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<PrizeEvaluationResult | null>(null);
  const [currentTicket, setCurrentTicket] = useState<TicketCheckInput | null>(null);

  const [isAdOpen, setIsAdOpen] = useState<boolean>(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState<boolean>(false);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState<boolean>(false);
  const [policyType, setPolicyType] = useState<'about' | 'privacy' | 'refund' | null>(null);

  const isSinhala = lang === 'si';

  // Check on mount: if user hasn't accepted disclaimer, prompt them
  useEffect(() => {
    if (!user.disclaimerAccepted) {
      const timer = setTimeout(() => {
        setIsDisclaimerOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user.disclaimerAccepted]);

  // Handle QR Scan Complete
  const handleScanComplete = (decoded: DecodedQRResult, rawTicket: TicketCheckInput) => {
    // 1. Trigger ad check (every 3rd scan for free user)
    const { shouldShowAd } = incrementCheckCounter();
    if (shouldShowAd) {
      setIsAdOpen(true);
    }

    const lottery = getLotteryBySlug(rawTicket.slug);

    if (decoded.isDrawPending) {
      // Future / pending draw
      const pendingRes: PrizeEvaluationResult = {
        won: false,
        isDrawPending: true,
        drawPendingDate: rawTicket.date,
        tier: null,
        prizeLabel: null,
        prizeAmountRs: 0,
        prizeAmountFormatted: null,
        note: decoded.notes || 'මෙම ලොතරැයියේ දිනුම් ඇදීම තවම සිදු වී නොමැත.'
      };
      setCurrentResult(pendingRes);
      setCurrentTicket(rawTicket);
      setIsResultOpen(true);
      return;
    }

    // Attempt matching with existing historical draws
    let matchedDraw = lottery?.draws.find(d => 
      (rawTicket.drawNo && d.drawNo === rawTicket.drawNo) || 
      (rawTicket.date && d.date === rawTicket.date)
    );

    if (!matchedDraw && lottery?.draws.length) {
      // Fallback to latest draw
      matchedDraw = lottery.draws[0];
    }

    if (matchedDraw && lottery) {
      const evalResult = evaluateLotteryPrize(lottery.slug, matchedDraw, rawTicket);
      setCurrentResult(evalResult);
      setCurrentTicket(rawTicket);
      setIsResultOpen(true);
    } else {
      // General result fallback
      const fallbackRes: PrizeEvaluationResult = {
        won: false,
        isDrawPending: false,
        tier: null,
        prizeLabel: null,
        prizeAmountRs: 0,
        prizeAmountFormatted: null,
        note: 'ලොතරැයි අංක සාර්ථකව හඳුනාගන්නා ලදී.'
      };
      setCurrentResult(fallbackRes);
      setCurrentTicket(rawTicket);
      setIsResultOpen(true);
    }
  };

  // Handle Manual check finish
  const handleManualCheckFinished = (result: PrizeEvaluationResult, ticket: TicketCheckInput) => {
    setCurrentResult(result);
    setCurrentTicket(ticket);
    setIsResultOpen(true);
  };

  // Handle checking a saved ticket from My Account
  const handleCheckSavedTicket = (saved: SavedTicket) => {
    const lot = getLotteryBySlug(saved.slug);
    const draw = lot?.draws.find(d => d.drawNo === saved.drawNo || d.date === saved.drawDate) || lot?.draws[0];

    const ticketInput: TicketCheckInput = {
      slug: saved.slug,
      drawNo: saved.drawNo,
      date: saved.drawDate,
      letter: saved.letter,
      zodiac: saved.zodiac,
      superNumber: saved.superNumber,
      numbers: saved.numbers
    };

    if (draw && lot) {
      const evaluation = evaluateLotteryPrize(lot.slug, draw, ticketInput);
      setCurrentResult(evaluation);
      setCurrentTicket(ticketInput);
      setIsResultOpen(true);
    }
  };

  // Handle selecting a draw from Archive
  const handleSelectDrawForCheck = (slug: string, draw: LotteryDraw) => {
    setActiveTab('check');
  };

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated);
    saveStoredUser(updated);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
        onOpenScanner={() => {
          setScannerMode('qr');
          setIsScannerOpen(true);
        }}
        onOpenDisclaimer={() => setIsDisclaimerOpen(true)}
        onOpenPolicy={(type) => setPolicyType(type)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'check' && (
          <ManualCheckView
            lang={lang}
            onCheckFinished={handleManualCheckFinished}
            onOpenScanner={(mode = 'qr') => {
              setScannerMode(mode);
              setIsScannerOpen(true);
            }}
            onRequestAd={() => setIsAdOpen(true)}
          />
        )}

        {activeTab === 'guess' && (
          <AIGuessView
            lang={lang}
            onOpenSubscription={() => setIsSubscriptionOpen(true)}
          />
        )}

        {activeTab === 'results' && (
          <ResultsArchiveView
            lang={lang}
            onSelectDrawForCheck={handleSelectDrawForCheck}
          />
        )}

        {activeTab === 'account' && (
          <MyAccountView
            user={user}
            onUpdateUser={handleUpdateUser}
            lang={lang}
            onOpenSubscription={() => setIsSubscriptionOpen(true)}
            onOpenDisclaimer={() => setIsDisclaimerOpen(true)}
            onCheckSavedTicket={handleCheckSavedTicket}
          />
        )}

        {activeTab === 'admin' && (
          <AdminView lang={lang} />
        )}
      </main>

      {/* Footer with Policies and Legal Links */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">LK Lottery Master</span>
              <span className="text-slate-600">|</span>
              <span>© {new Date().getFullYear()} LK Lottery Master. All rights reserved.</span>
            </div>

            {/* Policy links as requested by user */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <button
                onClick={() => setPolicyType('about')}
                className="hover:text-amber-400 transition"
              >
                {isSinhala ? 'අප ගැන (About Us)' : 'About Us'}
              </button>
              <button
                onClick={() => setPolicyType('privacy')}
                className="hover:text-amber-400 transition"
              >
                {isSinhala ? 'පෞද්ගලිකත්ව ප්‍රතිපත්තිය' : 'Privacy Policy'}
              </button>
              <button
                onClick={() => setPolicyType('refund')}
                className="hover:text-amber-400 transition"
              >
                {isSinhala ? 'මුදල් ආපසු ගෙවීම් (Refund)' : 'Refund Policy'}
              </button>
              <button
                onClick={() => setIsDisclaimerOpen(true)}
                className="text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isSinhala ? 'වගකීම් ප්‍රකාශය (Disclaimer)' : 'Disclaimer'}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-900/80 text-[11px] text-slate-500 leading-relaxed text-center sm:text-left">
            {isSinhala 
              ? 'වගකීමෙන් බැහැරවීම: මෙම යෙදුම ශ්‍රී ලංකා ජාතික ලොතරැයි මණ්ඩලය (NLB) හෝ සංවර්ධන ලොතරැයි මණ්ඩලය (DLB) සමඟ සම්බන්ධ නොමැති ස්වාධීන යෙදුමකි. සියලු ප්‍රතිඵල නිල ගැසට් පත්‍රිකාව සමඟ සැසඳිය යුතුය.' 
              : 'Disclaimer: LK Lottery Master is an independent tool not affiliated with NLB or DLB. All winning claims must be verified with official gazettes.'}
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ContinuousScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        mode={scannerMode}
        onScanResultFound={(result, ticket) => {
          const { shouldShowAd } = incrementCheckCounter();
          if (shouldShowAd) {
            setIsAdOpen(true);
          }
        }}
        lang={lang}
      />

      <TicketCheckResultModal
        isOpen={isResultOpen}
        onClose={() => setIsResultOpen(false)}
        result={currentResult}
        ticket={currentTicket}
        lang={lang}
        onNavigateToGuess={() => setActiveTab('guess')}
      />

      <AdModal
        isOpen={isAdOpen}
        onClose={() => setIsAdOpen(false)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        lang={lang}
      />

      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        user={user}
        onPlanActivated={handleUpdateUser}
        lang={lang}
      />

      <DisclaimerModal
        isOpen={isDisclaimerOpen}
        onClose={() => setIsDisclaimerOpen(false)}
        user={user}
        onAccepted={handleUpdateUser}
        lang={lang}
      />

      <PolicyModal
        isOpen={policyType !== null}
        onClose={() => setPolicyType(null)}
        type={policyType || 'about'}
        lang={lang}
      />
    </div>
  );
}
