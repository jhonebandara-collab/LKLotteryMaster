import { AIGuessResult, LotteryDefinition } from '../types';

export async function scanTicketWithGemini(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<{
  success: boolean;
  lotterySlug?: string;
  drawNo?: string;
  date?: string;
  letter?: string;
  zodiac?: string;
  superNumber?: string;
  numbers?: string[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/ai-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, mimeType })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Scan request failed');
    }

    const data = await res.json();
    return {
      success: true,
      lotterySlug: data.lotterySlug,
      drawNo: data.drawNo,
      date: data.date,
      letter: data.letter,
      zodiac: data.zodiac,
      superNumber: data.superNumber,
      numbers: data.numbers
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'AI Scanner communication error'
    };
  }
}

export function generateStrategicLotteryGuess(lottery: LotteryDefinition): AIGuessResult {
  // Calculate real frequency of all numbers from the historical draws
  const freqMap: Record<string, number> = {};
  const lastSeenMap: Record<string, number> = {};

  const draws = lottery.draws || [];
  draws.forEach((draw, drawIndex) => {
    draw.numbers.forEach(num => {
      const s = String(num).trim();
      freqMap[s] = (freqMap[s] || 0) + 1;
      if (lastSeenMap[s] === undefined) {
        lastSeenMap[s] = drawIndex;
      }
    });
  });

  const sortedFreq = Object.entries(freqMap).map(([number, frequency]) => ({
    number,
    frequency
  })).sort((a, b) => b.frequency - a.frequency);

  const sortedGaps = Object.entries(lastSeenMap).map(([number, drawsAgo]) => ({
    number,
    drawsAgo
  })).sort((a, b) => b.drawsAgo - a.drawsAgo);

  const hotNumbers = sortedFreq.slice(0, 6);
  const overdueNumbers = sortedGaps.slice(0, 6);

  // Strategic selection: 60% Hot Numbers + 40% Overdue Numbers
  const recommendedSet = new Set<string>();

  // Pick from hot
  for (const item of hotNumbers) {
    if (recommendedSet.size >= Math.ceil(lottery.numberCount * 0.6)) break;
    recommendedSet.add(item.number);
  }

  // Pick from overdue
  for (const item of overdueNumbers) {
    if (recommendedSet.size >= lottery.numberCount) break;
    recommendedSet.add(item.number);
  }

  // Fill up if needed
  let fallbackVal = 1;
  while (recommendedSet.size < lottery.numberCount) {
    const pad = lottery.digitWidth === 2 ? String(fallbackVal).padStart(2, '0') : String(fallbackVal % 10);
    recommendedSet.add(pad);
    fallbackVal++;
  }

  const finalNumbers = Array.from(recommendedSet);
  if (lottery.digitWidth === 2) {
    finalNumbers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }

  // Pick recommended letter from historical draws
  const letterFreq: Record<string, number> = {};
  draws.forEach(d => {
    if (d.letter) {
      letterFreq[d.letter] = (letterFreq[d.letter] || 0) + 1;
    }
  });
  const topLetter = Object.entries(letterFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Z';

  // Pick recommended zodiac
  const zodiacFreq: Record<string, number> = {};
  draws.forEach(d => {
    if (d.zodiac) {
      zodiacFreq[d.zodiac] = (zodiacFreq[d.zodiac] || 0) + 1;
    }
  });
  const topZodiac = Object.entries(zodiacFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'LEO';

  // Pick recommended super number
  const superFreq: Record<string, number> = {};
  draws.forEach(d => {
    if (d.superNumber) {
      superFreq[d.superNumber] = (superFreq[d.superNumber] || 0) + 1;
    }
  });
  const topSuper = Object.entries(superFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || '12';

  // Calculate sum range
  const sums = draws.map(d => d.numbers.reduce((acc, n) => acc + parseInt(n || '0', 10), 0));
  const avgSum = sums.length ? Math.round(sums.reduce((a, b) => a + b, 0) / sums.length) : 100;
  const expectedSumRange = `${avgSum - 15} - ${avgSum + 15}`;

  // Confidence calculation based on draw depth
  const confidence = Math.min(94, Math.max(72, 70 + Math.round((draws.length / 20) * 15)));

  const reasoningSi = `පසුගිය මාස 6ක ${draws.length} වාරයක නිල ප්‍රතිඵල සංඛ්‍යාලේඛන මත පදනම්ව: වඩාත්ම පැමිණි අංක (Hot: ${hotNumbers.slice(0, 3).map(h => h.number).join(', ')}) සහ දිගු කලක් නොපැමිණි අංක (Overdue: ${overdueNumbers.slice(0, 2).map(o => o.number).join(', ')}) සුසංයෝග කර මෙම යෝජනාව සකස් කර ඇත. බලාපොරොත්තු වන එකතුව: ${expectedSumRange}.`;

  return {
    lotterySlug: lottery.slug,
    lotteryName: lottery.name,
    confidence,
    recommendedNumbers: finalNumbers,
    recommendedLetter: lottery.hasLetter ? topLetter : undefined,
    recommendedZodiac: lottery.hasZodiac ? topZodiac : undefined,
    recommendedSuperNumber: lottery.hasSuperNumber ? topSuper : undefined,
    hotNumbers,
    overdueNumbers,
    expectedSumRange,
    analysisReasoningSi: reasoningSi,
    generatedAt: new Date().toISOString()
  };
}
