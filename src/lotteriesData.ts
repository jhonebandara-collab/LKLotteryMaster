export interface LotteryInfo {
  slug: string;
  name: string;
  nameSi?: string;
  type: 'numbers' | 'zodiac' | 'letters';
}

export const ALL_LOTTERIES: LotteryInfo[] = [
  { slug: 'govisetha', name: 'Govisetha', nameSi: 'ගොවිසෙත', type: 'numbers' },
  { slug: 'mahajana-sampatha', name: 'Mahajana Sampatha', nameSi: 'මහජන සම්පත', type: 'numbers' },
  { slug: 'vasana', name: 'Vasana Sampatha', nameSi: 'වාසනා සම්පත', type: 'numbers' },
  { slug: 'lagana-vasana', name: 'Lagana Vasana', nameSi: 'ලග්න වාසනාව', type: 'zodiac' },
  { slug: 'handahana', name: 'Handahana', nameSi: 'හඳහන', type: 'zodiac' }
];

export const ZODIAC_SIGNS = [
  'Mesha', 'Vrushabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Thula', 'Vrushchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'
];

export function getLotteryBySlug(slug: string) {
  return ALL_LOTTERIES.find(l => l.slug === slug);
}