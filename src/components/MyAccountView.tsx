import React, { useState } from 'react';
import { User, LogIn, Mail, Lock, Sparkles, CheckCircle, ShieldCheck, BookmarkCheck, LogOut, ExternalLink, QrCode } from 'lucide-react';
import { UserProfile, SavedTicket } from '../types';
import { saveStoredUser } from '../services/storageService';

interface MyAccountViewProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  lang: 'si' | 'en';
  onOpenSubscription: () => void;
  onOpenDisclaimer: () => void;
  onCheckSavedTicket: (ticket: SavedTicket) => void;
}

export const MyAccountView: React.FC<MyAccountViewProps> = ({
  user,
  onUpdateUser,
  lang,
  onOpenSubscription,
  onOpenDisclaimer,
  onCheckSavedTicket
}) => {
  const isSinhala = lang === 'si';

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const isGuest = user.id.startsWith('guest_');

  const handleGoogleLogin = () => {
    // Google Account login simulation
    const updated: UserProfile = {
      ...user,
      id: 'google_user_' + Date.now(),
      name: 'Jhone Bandara',
      email: 'jhonebandara@gmail.com',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      provider: 'google',
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date().toISOString()
    };
    saveStoredUser(updated);
    onUpdateUser(updated);
  };

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!emailInput || !passwordInput) {
      setAuthError(isSinhala ? 'කරුණාකර Email ලිපිනය සහ මුරපදය ඇතුළත් කරන්න.' : 'Please enter email and password.');
      return;
    }

    if (passwordInput.length < 6) {
      setAuthError(isSinhala ? 'මුරපදයට අවම වශයෙන් අකුරු 6ක් අවශ්‍යයි.' : 'Password must be at least 6 characters.');
      return;
    }

    const updated: UserProfile = {
      ...user,
      id: 'usr_' + Date.now(),
      name: nameInput || emailInput.split('@')[0],
      email: emailInput,
      provider: 'email',
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date().toISOString()
    };

    saveStoredUser(updated);
    onUpdateUser(updated);
    setEmailInput('');
    setPasswordInput('');
  };

  const handleLogout = () => {
    const guestUser: UserProfile = {
      id: 'guest_' + Math.random().toString(36).substring(2, 9),
      name: 'ලොතරැයි හිතවතා (Guest)',
      email: 'guest@lklotterymaster.com',
      provider: 'email',
      plan: 'free',
      searchesUsedToday: 0,
      searchesTotalMonth: 0,
      maxSearchesMonth: 30,
      disclaimerAccepted: false,
      savedTickets: []
    };
    saveStoredUser(guestUser);
    onUpdateUser(guestUser);
  };

  return (
    <div className="space-y-6">
      {/* Profile Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-white font-black text-xl">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full rounded-[14px] object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">{user.name}</h2>
                {user.provider === 'google' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                    Google Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isGuest ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-400 hover:text-white bg-rose-950/30 hover:bg-rose-900 border border-rose-800/40 rounded-xl transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isSinhala ? 'ඉවත් වන්න (Logout)' : 'Logout'}</span>
              </button>
            ) : null}

            <button
              onClick={onOpenSubscription}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl text-xs sm:text-sm shadow-md transition active:scale-95"
            >
              {isSinhala ? 'Plan එක වෙනස් කරන්න' : 'Upgrade Plan'}
            </button>
          </div>
        </div>

        {/* Plan & Usage Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Plan</span>
            <div className="text-lg font-black text-amber-400 uppercase mt-1">
              {user.plan} PASS
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {user.planExpiresAt 
                ? `Valid until ${new Date(user.planExpiresAt).toLocaleDateString()}` 
                : (isSinhala ? 'දැන්වීම් සහිත මූලික පැකේජය' : 'Free Ad-Supported')}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isSinhala ? 'QR Searches ඉතිරි ප්‍රමාණය' : 'Monthly Allowance'}
            </span>
            <div className="text-lg font-black text-white mt-1">
              {user.maxSearchesMonth - user.searchesTotalMonth} / {user.maxSearchesMonth}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div 
                className="bg-amber-400 h-full rounded-full" 
                style={{ width: `${Math.min(100, ((user.maxSearchesMonth - user.searchesTotalMonth) / user.maxSearchesMonth) * 100)}%` }} 
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isSinhala ? 'නෛතික එකඟතාව' : 'Liability Waiver'}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {user.disclaimerAccepted ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">
                    {isSinhala ? 'පිළිගෙන ඇත (Accepted)' : 'Accepted'}
                  </span>
                </>
              ) : (
                <button
                  onClick={onOpenDisclaimer}
                  className="text-xs font-bold text-amber-400 underline"
                >
                  {isSinhala ? 'කියවා එකඟ වන්න' : 'Accept Terms'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Audit version: v2.4-Accepted</p>
          </div>
        </div>
      </div>

      {/* Login / Registration Card (if guest) */}
      {isGuest && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="text-center max-w-sm mx-auto">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2">
              <User className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {isSinhala ? 'ගිණුමක් සමඟ සම්බන්ධ වන්න' : 'Connect Your Account'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isSinhala 
                ? 'Google ගිණුමෙන් හෝ Email ලිපිනයෙන් ලියාපදිංචි වී ඔබගේ සියලුම ටිකට්පත් සහ දිනුම් සුරක්ෂිත කරගන්න.' 
                : 'Sign in to save tickets, track prize winnings, and activate ad-free passes.'}
            </p>
          </div>

          {/* Google Sign-in Button */}
          <div className="max-w-md mx-auto">
            <button
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-sm flex items-center justify-center gap-3 transition shadow-md active:scale-95 border border-slate-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isSinhala ? 'Google ගිණුමෙන් ඉදිරියට යන්න' : 'Continue with Google'}</span>
            </button>

            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-slate-800" />
              <span className="px-3 text-[11px] text-slate-500 uppercase">
                {isSinhala ? 'හෝ Email මඟින්' : 'Or with Email'}
              </span>
              <div className="flex-1 border-t border-slate-800" />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isSinhala ? 'ඔබගේ නම:' : 'Your Name:'}
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Kamal Perera"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Email:
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  {isSinhala ? 'මුරපදය (Password):' : 'Password:'}
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              {authError && (
                <p className="text-xs text-rose-400">{authError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition"
              >
                {authMode === 'login' 
                  ? (isSinhala ? 'ඇතුල් වන්න (Login)' : 'Login') 
                  : (isSinhala ? 'ගිණුමක් සාදන්න (Sign Up)' : 'Sign Up')}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-xs text-amber-400 hover:underline"
                >
                  {authMode === 'login'
                    ? (isSinhala ? 'අලුත් ගිණුමක් හදන්න අවශ්‍යද? Register' : 'Need an account? Sign Up')
                    : (isSinhala ? 'දැනටමත් ගිණුමක් තියෙනවාද? Login' : 'Already have an account? Login')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Saved Tickets Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-amber-400" />
              <span>{isSinhala ? 'මගේ සුරකින ලද ප්‍රවේශපත්‍ර (Saved Tickets)' : 'My Saved Tickets'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isSinhala ? 'ඉදිරි දිනුම් ඇදීම් සඳහා පරීක්ෂා කිරීමට සුරකින ලද ටිකට්පත්' : 'Tickets saved for upcoming or past verification'}
            </p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            {user.savedTickets?.length || 0} Saved
          </span>
        </div>

        {(!user.savedTickets || user.savedTickets.length === 0) ? (
          <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs sm:text-sm">
            {isSinhala 
              ? 'තවම ප්‍රවේශපත්‍ර සුරැකී නොමැත. QR ස්කෑන් කර හෝ අතින් අංක දමා සුරකින්න.' 
              : 'No tickets saved yet. Scan QR or check manually and tap Save.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {user.savedTickets.map(ticket => (
              <div 
                key={ticket.id}
                className="p-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between gap-3 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase">{ticket.slug.replace(/-/g, ' ')}</span>
                    <span className="text-[10px] text-slate-400">#{ticket.drawNo} • {ticket.drawDate}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 font-mono text-xs text-amber-300 font-bold">
                    {ticket.letter && <span className="text-white bg-slate-800 px-1 rounded">{ticket.letter}</span>}
                    <span>{ticket.numbers.join(' ')}</span>
                  </div>
                </div>

                <button
                  onClick={() => onCheckSavedTicket(ticket)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-bold rounded-lg transition"
                >
                  {isSinhala ? 'දිනුම් බලන්න' : 'Verify'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
