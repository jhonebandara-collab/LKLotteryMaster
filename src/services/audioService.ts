/**
 * Text-to-Speech audio service for Sri Lankan Lottery Results
 * Pronounces "Rupees" instead of "Rs." for high quality audio feedback.
 */

export function speakLotteryResult(won: boolean, prizeLabel: string | null, prizeAmountRs: number, isSinhala: boolean = true) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  let textToSpeak = '';
  if (won && prizeAmountRs > 0) {
    const formattedAmount = prizeAmountRs.toLocaleString('en-US');
    if (isSinhala) {
      textToSpeak = `සුබ පැතුම්! ඔබ රුපියල් ${formattedAmount} ක් දිනා ඇත! ${prizeLabel || ''}`;
    } else {
      textToSpeak = `Congratulations! You won Rupees ${formattedAmount}! ${prizeLabel || ''}`;
    }
  } else if (won) {
    textToSpeak = isSinhala ? 'සුබ පැතුම්! ඔබ ත්‍යාගයක් දිනා ඇත!' : 'Congratulations! You won a prize!';
  } else {
    textToSpeak = isSinhala ? 'මෙම වාරයේ දිනුමක් නොමැත. ඊළඟ වාරයට සුබ පැතුම්!' : 'No prize this time. Better luck next draw!';
  }

  try {
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    // Pick best voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      (isSinhala && (v.lang.includes('si') || v.lang.includes('hi') || v.lang.includes('en-IN'))) ||
      (!isSinhala && (v.lang.includes('en-US') || v.lang.includes('en-GB') || v.lang.includes('en')))
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis playback error:', e);
  }
}
