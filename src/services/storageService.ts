import { UserProfile, SavedTicket, DisclaimerRecord, SubscriptionPlan } from '../types';

const STORAGE_KEYS = {
  USER: 'lkm_user_profile',
  CHECK_COUNT: 'lkm_check_counter',
  SAVED_TICKETS: 'lkm_saved_tickets',
  DISCLAIMERS: 'lkm_disclaimer_records',
  AUTH_TOKEN: 'lkm_jwt_token',
  LANGUAGE: 'lkm_app_lang',
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter Pass',
    nameSi: 'මූලික පැකේජය',
    searches: 300,
    priceRs: 300,
    validityDays: 30,
    description: '300 QR searches with 100% Ad-Free experience for 1 month.',
    features: [
      'QR Checks 300ක් සම්පූර්ණයෙන් Ads රහිතව',
      'දින 30ක වලංගු කාලය (1 Month)',
      'ක්ෂණික දිනුම් මුදල් පරීක්ෂාව',
      'ඉදිරි ලොතරැයි සුරැකීමේ පහසුකම'
    ]
  },
  {
    id: 'pro',
    name: 'Pro Pass',
    nameSi: 'ප්‍රෝ පැකේජය (වඩාත් ජනප්‍රිය)',
    searches: 500,
    priceRs: 450,
    validityDays: 30,
    description: '500 QR searches + AI Predictions + Ad-Free for 1 month.',
    features: [
      'QR Checks 500ක් සම්පූර්ණයෙන් Ads රහිතව',
      'දින 30ක වලංගු කාලය (1 Month)',
      '🍀 මගේ වාසනාව AI Predictions ප්‍රමුඛතාව',
      'මාස 6ක සම්පූර්ණ දත්ත වාර්තා බාගත කිරීම'
    ]
  },
  {
    id: 'master',
    name: 'Master Pass',
    nameSi: 'මාස්ටර් පැකේජය (අසීමිත)',
    searches: 1000,
    priceRs: 700,
    validityDays: 30,
    description: '1000 Searches (Unlimited access) + AI Pro Guess + VIP Support.',
    features: [
      'QR Checks 1,000ක් (Unlimited Daily)',
      'දින 30ක වලංගු කාලය (1 Month)',
      'දැන්වීම් සම්පූර්ණයෙන්ම ඉවත් කිරීම',
      'ලොතරැයි 16ම සියලුම AI අනාවැකි සහ අංක නිර්දේශ',
      'VIP Priority Support'
    ]
  }
];

export const DISCLAIMER_TEXT_SI = `
⚠️ වැදගත් නෛතික වගකීම් ප්‍රකාශය සහ පරිශීලක එකඟතාව (Legal Disclaimer & Liability Waiver):

1. මෙම "LK Lottery Master" යෙදුම ශ්‍රී ලංකාවේ ජාතික ලොතරැයි මණ්ඩලය (NLB) හෝ සංවර්ධන ලොතරැයි මණ්ඩලය (DLB) සමඟ සෘජු සම්බන්ධයක් නොමැති ස්වාධීන සහායක යෙදුමකි.
2. මෙහි පෙන්වනු ලබන සියලුම දිනුම් ප්‍රතිඵල, ත්‍යාග ගණනය කිරීම්, කැමරා කියවීම් සහ AI අනුමානයන් පරිශීලක පහසුව සඳහා සපයනු ලබන තොරතුරු පමණි.
3. ලොතරැයි අංක සහ දිනුම් තීරණය වන්නේ සම්පූර්ණයෙන්ම අහඹු ක්‍රියාවලියක් මඟින් බැවින්, මෙම යෙදුමේ අනුමාන හෝ විශ්ලේෂණ කිසිදු දිනුමක් සහතික නොකරයි.
4. ඕනෑම ත්‍යාගයක් ලබා ගැනීමට පෙර හෝ ප්‍රවේශපත්‍ර සම්බන්ධ නිල තීරණයක් ගැනීමට පෙර අදාළ ලොතරැයි මණ්ඩලයේ නිල ප්‍රතිඵල පත්‍රිකාව (Official Gazette Sheet) සමඟ තහවුරු කරගැනීම පරිශීලකයාගේ වගකීමකි.
5. මෙම යෙදුම භාවිත කිරීම නිසා හෝ මෙහි ඇති තොරතුරුවල අඩංගු කිසියම් අතපසුවීමක්/දෝෂයක් හේතුවෙන් සිදුවන කිසිදු මූල්‍යමය අලාභයකට හෝ හානියකට යෙදුම හෝ එහි නිර්මාණකරුවන් නීතිමය වශයෙන් වගකීමක් භාර නොගනී.
`;

export const DISCLAIMER_VERSION = 'v2.4-Liability-Accepted';

export function getStoredUser(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  const defaultUser: UserProfile = {
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
  saveStoredUser(defaultUser);
  return defaultUser;
}

export function saveStoredUser(user: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch {}
}

export function getCheckCounter(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.CHECK_COUNT);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function incrementCheckCounter(): { count: number; shouldShowAd: boolean } {
  const current = getCheckCounter() + 1;
  try {
    localStorage.setItem(STORAGE_KEYS.CHECK_COUNT, current.toString());
  } catch {}

  const user = getStoredUser();
  // Free users see an ad every 3rd check
  const isFreePlan = user.plan === 'free';
  const shouldShowAd = isFreePlan && current % 3 === 0;

  return { count: current, shouldShowAd };
}

export function getDisclaimerRecords(): DisclaimerRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DISCLAIMERS);
    if (raw) return JSON.parse(raw);
  } catch {}

  // Seed with initial audit records
  const initial: DisclaimerRecord[] = [
    {
      id: 'disc_1',
      userEmail: 'gsminkcom@gmail.com',
      userName: 'Admin User',
      acceptedAt: '2026-09-18T10:30:00Z',
      version: DISCLAIMER_VERSION,
      userAgent: 'Chrome on Android'
    },
    {
      id: 'disc_2',
      userEmail: 'jhonebandara@gmail.com',
      userName: 'Jhone Bandara',
      acceptedAt: '2026-09-19T08:15:00Z',
      version: DISCLAIMER_VERSION,
      userAgent: 'Chrome on Windows'
    }
  ];
  saveDisclaimerRecords(initial);
  return initial;
}

export function saveDisclaimerRecords(records: DisclaimerRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DISCLAIMERS, JSON.stringify(records));
  } catch {}
}

export function recordDisclaimerAcceptance(userOrEmail: UserProfile | string, userName?: string): UserProfile {
  const records = getDisclaimerRecords();
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail.email;
  const name = typeof userOrEmail === 'string' ? userName : userOrEmail.name;

  const newRecord: DisclaimerRecord = {
    id: 'disc_' + Date.now(),
    userEmail: email,
    userName: name || email.split('@')[0],
    acceptedAt: new Date().toISOString(),
    version: DISCLAIMER_VERSION,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser'
  };
  records.unshift(newRecord);
  saveDisclaimerRecords(records);

  const user = typeof userOrEmail === 'object' ? { ...userOrEmail } : getStoredUser();
  user.disclaimerAccepted = true;
  user.disclaimerAcceptedAt = newRecord.acceptedAt;
  user.disclaimerAcceptedVersion = DISCLAIMER_VERSION;
  saveStoredUser(user);
  return user;
}

export function activateUserPlan(planId: 'starter' | 'pro' | 'master'): UserProfile {
  const user = getStoredUser();
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId) || SUBSCRIPTION_PLANS[0];

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + plan.validityDays);

  user.plan = planId;
  user.planExpiresAt = expiry.toISOString();
  user.maxSearchesMonth = plan.searches;
  user.searchesUsedToday = 0;
  user.searchesTotalMonth = 0;

  saveStoredUser(user);
  return user;
}

export function saveTicketToUser(ticket: Omit<SavedTicket, 'id' | 'createdAt'>): SavedTicket {
  const user = getStoredUser();
  const saved: SavedTicket = {
    ...ticket,
    id: 'ticket_' + Date.now(),
    createdAt: new Date().toISOString()
  };

  user.savedTickets = user.savedTickets || [];
  user.savedTickets.unshift(saved);
  saveStoredUser(user);
  return saved;
}
