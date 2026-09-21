/**
 * Self-test for the ticket parser, draw resolver and prize calculator.
 *
 * Run with:  npm test
 *
 * These cases encode the behaviour the app must guarantee:
 *  - a QR is matched by DRAW NUMBER, never by a date that happens to be present
 *  - nothing is ever invented when a field cannot be read
 *  - 1-digit lotteries (Mahajana Sampatha, NLB Jaya, ...) keep 1-digit balls
 *  - prize amounts follow the official NLB / DLB prize structures
 */

import { parseLotteryQR, parsedFromAi } from '../src/utils/qrParser';
import { resolveTicket } from '../src/utils/drawResolver';
import { evaluateLotteryPrize } from '../src/utils/prizeCalculator';
import { toIsoDate, normaliseDrawNo } from '../src/utils/dateUtils';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
    if (detail !== undefined) console.log('      got:', JSON.stringify(detail));
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

/* ------------------------------------------------------------------ */
section('date normalisation');
/* ------------------------------------------------------------------ */
check('ISO passthrough', toIsoDate('2026-09-19') === '2026-09-19', toIsoDate('2026-09-19'));
check('day-first slashes', toIsoDate('19/09/2026') === '2026-09-19', toIsoDate('19/09/2026'));
check('compact year-last', toIsoDate('19092026') === '2026-09-19', toIsoDate('19092026'));
check('compact year-first', toIsoDate('20260919') === '2026-09-19', toIsoDate('20260919'));
check('month name', toIsoDate('Saturday September 19, 2026') === '2026-09-19', toIsoDate('Saturday September 19, 2026'));
check('invalid rejected', toIsoDate('99999999') === null, toIsoDate('99999999'));
check('draw no leading zeros', normaliseDrawNo('0890') === '890', normaliseDrawNo('0890'));

/* ------------------------------------------------------------------ */
section('Govisetha — the date must never drive the match');
/* ------------------------------------------------------------------ */
{
  const parsed = parseLotteryQR('GS/4557/W/03-32-36-62/19092026/12345');
  check('slug detected', parsed.lotterySlug === 'govisetha', parsed.lotterySlug);
  check('draw number detected', parsed.drawNo === '4557', parsed.drawNo);
  check('letter detected', parsed.letter === 'W', parsed.letter);
  check('date detected', parsed.date === '2026-09-19', parsed.date);
  check('serial not treated as a ball', !parsed.numberRuns.includes('12345'), parsed.numberRuns);

  const resolution = resolveTicket(parsed);
  check('draw resolved', resolution.status === 'verified', resolution.status);
  check('matched by draw number', resolution.matchedBy === 'drawNo', resolution.matchedBy);
  check('official draw no is 4557', resolution.draw?.drawNo === '4557', resolution.draw?.drawNo);
  check(
    'ticket balls parsed',
    JSON.stringify(resolution.numbers) === JSON.stringify(['03', '32', '36', '62']),
    resolution.numbers
  );

  const evaluation = evaluateLotteryPrize('govisetha', resolution.draw!, {
    letter: resolution.letter,
    zodiac: null,
    superNumber: null,
    numbers: resolution.numbers
  });
  check('letter + 4 numbers = Super Prize', evaluation.tier === 'Super Prize', evaluation.tier);
  check('prize is Rs 60,000,000', evaluation.prizeAmountRs === 60000000, evaluation.prizeAmountRs);
}

{
  // The date on this payload is deliberately WRONG. The draw number must win.
  const parsed = parseLotteryQR('GOVISETHA|4557|W|03 32 36 62|01/01/2020');
  const resolution = resolveTicket(parsed);
  check('wrong date does not change the draw', resolution.draw?.drawNo === '4557', resolution.draw?.drawNo);
  check('matched by draw number despite date', resolution.matchedBy === 'drawNo', resolution.matchedBy);
  check(
    'a mismatch is reported to the user',
    resolution.warnings.some((w) => w.toLowerCase().includes('differs')),
    resolution.warnings
  );
}

{
  // Draw number that is not in the downloaded results -> refuse, do not guess.
  const parsed = parseLotteryQR('GS/9999/W/03-32-36-62/19092026');
  const resolution = resolveTicket(parsed);
  check('unknown draw number is not silently accepted', resolution.status === 'needs-review', resolution.status);
  check('candidates are offered instead', resolution.candidateDraws.length > 0, resolution.candidateDraws.length);
  check(
    'the ticket is not scored against an unrelated draw',
    resolution.draw === undefined,
    resolution.draw?.drawNo
  );
  check('no prize is produced for an unverified ticket', resolution.status !== 'verified', resolution.status);
}

{
  // 8 glued digits that also look like a date must still yield 4 balls.
  const parsed = parseLotteryQR('GOVISETHA|4557|W|20260919');
  const resolution = resolveTicket(parsed);
  check('ambiguous 8-digit run still resolves the draw', resolution.draw?.drawNo === '4557', resolution.draw?.drawNo);
  check(
    'ambiguous 8-digit run is read as 4 balls',
    resolution.numbers.join('-') === '20-26-09-19',
    resolution.numbers
  );
}

{
  // Date only (no draw number) -> allowed, but flagged as a soft match.
  const parsed = parseLotteryQR('GOVISETHA|W|03 32 36 62|19/09/2026');
  const resolution = resolveTicket(parsed);
  check('date fallback resolves', resolution.status === 'verified', resolution.status);
  check('date fallback is flagged', resolution.matchedBy === 'date', resolution.matchedBy);
}

/* ------------------------------------------------------------------ */
section('structured payloads');
/* ------------------------------------------------------------------ */
{
  const parsed = parseLotteryQR(
    'https://www.nlb.lk/verify?lottery=govisetha&draw=4557&letter=W&numbers=03,32,36,62&date=2026-09-19'
  );
  check('URL payload: slug', parsed.lotterySlug === 'govisetha', parsed.lotterySlug);
  check('URL payload: draw', parsed.drawNo === '4557', parsed.drawNo);
  check('URL payload: numbers', parsed.numbers.join('-') === '03-32-36-62', parsed.numbers);
}
{
  const parsed = parseLotteryQR(
    JSON.stringify({ lottery: 'mega-power', draw: '2663', letter: 'U', super: '15', numbers: ['20', '43', '65', '79'] })
  );
  check('JSON payload: slug', parsed.lotterySlug === 'mega-power', parsed.lotterySlug);
  check('JSON payload: super number', parsed.superNumber === '15', parsed.superNumber);
  const resolution = resolveTicket(parsed);
  const evaluation = evaluateLotteryPrize('mega-power', resolution.draw!, {
    letter: resolution.letter,
    zodiac: null,
    superNumber: resolution.superNumber,
    numbers: resolution.numbers
  });
  check('Mega Power: letter + super + 4 = Mega Super Prize', evaluation.tier === 'Mega Super Prize', evaluation.tier);
  check('Mega Power prize Rs 150,000,000', evaluation.prizeAmountRs === 150000000, evaluation.prizeAmountRs);
}

/* ------------------------------------------------------------------ */
section('1-digit lotteries must keep 1-digit balls');
/* ------------------------------------------------------------------ */
{
  const parsed = parseLotteryQR('MS 6315 Q 2 1 6 1 2 1');
  check('Mahajana slug', parsed.lotterySlug === 'mahajana-sampatha', parsed.lotterySlug);
  check('Mahajana letter', parsed.letter === 'Q', parsed.letter);
  const resolution = resolveTicket(parsed);
  check('Mahajana draw resolved', resolution.draw?.drawNo === '6315', resolution.draw?.drawNo);
  check(
    'Mahajana balls stay single digits',
    JSON.stringify(resolution.numbers) === JSON.stringify(['2', '1', '6', '1', '2', '1']),
    resolution.numbers
  );
  const evaluation = evaluateLotteryPrize('mahajana-sampatha', resolution.draw!, {
    letter: resolution.letter,
    numbers: resolution.numbers
  });
  check('Mahajana letter + 6 = Super Prize', evaluation.tier === 'Super Prize', evaluation.tier);
  check('Mahajana prize Rs 20,000,000', evaluation.prizeAmountRs === 20000000, evaluation.prizeAmountRs);
}
{
  const parsed = parseLotteryQR('NLBJAYA|0583|S|7817');
  const resolution = resolveTicket(parsed);
  check('NLB Jaya resolved by zero-padded draw no', resolution.draw?.drawNo === '0583', resolution.draw?.drawNo);
  check('NLB Jaya balls are single digits', resolution.numbers.join('') === '7817', resolution.numbers);
}

/* ------------------------------------------------------------------ */
section('glued barcode digits');
/* ------------------------------------------------------------------ */
{
  const parsed = parseLotteryQR('AK/3115/M/03182170');
  const resolution = resolveTicket(parsed);
  check('Ada Kotipathi draw resolved', resolution.draw?.drawNo === '3115', resolution.draw?.drawNo);
  check('glued balls split correctly', resolution.numbers.join('-') === '03-18-21-70', resolution.numbers);
  const evaluation = evaluateLotteryPrize('ada-kotipathi', resolution.draw!, {
    letter: resolution.letter,
    numbers: resolution.numbers
  });
  check('Ada Kotipathi jackpot tier', evaluation.tier === 'Jackpot', evaluation.tier);
}

/* ------------------------------------------------------------------ */
section('AI scan payload');
/* ------------------------------------------------------------------ */
{
  const parsed = parsedFromAi({
    lotterySlug: 'govisetha',
    drawNo: '4557',
    letter: 'W',
    numbers: ['03', '32', '36', '62'],
    confidence: 'high'
  });
  const resolution = resolveTicket(parsed);
  check('AI payload resolves', resolution.status === 'verified', resolution.status);
  check('AI payload numbers survive', resolution.numbers.join('-') === '03-32-36-62', resolution.numbers);
}

/* ------------------------------------------------------------------ */
section('unreadable payloads are refused, not guessed');
/* ------------------------------------------------------------------ */
{
  const parsed = parseLotteryQR('HELLO-WORLD');
  const resolution = resolveTicket(parsed);
  check('garbage payload is not verified', resolution.status !== 'verified', resolution.status);
  check('no numbers invented', resolution.numbers.length === 0, resolution.numbers);
}

/* ------------------------------------------------------------------ */
section('prize structure spot checks');
/* ------------------------------------------------------------------ */
{
  const govisethaDraw = {
    drawNo: '4557',
    date: '2026-09-19',
    letter: 'W',
    zodiac: null,
    superNumber: null,
    numbers: ['03', '32', '36', '62']
  };
  const cases: [string, any, any, number | null][] = [
    ['2 numbers only', { letter: 'A', numbers: ['03', '32'] }, { tier: '5th Prize' }, 200],
    ['1 number + letter', { letter: 'W', numbers: ['03', '99'] }, { tier: '6th Prize' }, 200],
    ['letter only', { letter: 'W', numbers: ['88', '99'] }, { tier: '8th Prize' }, 40],
    ['no match', { letter: 'A', numbers: ['88', '99'] }, { tier: null }, 0]
  ];
  for (const [label, ticket, expectation, amount] of cases) {
    const evaluation = evaluateLotteryPrize('govisetha', govisethaDraw, ticket);
    check(
      `Govisetha ${label} → ${expectation.tier ?? 'no win'}`,
      evaluation.tier === expectation.tier && (amount === null || evaluation.prizeAmountRs === amount),
      `${evaluation.tier} / ${evaluation.prizeAmountRs}`
    );
  }
}

{
  const sasiriDraw = {
    drawNo: '1119',
    date: '2026-09-19',
    letter: null,
    zodiac: null,
    superNumber: null,
    numbers: ['14', '21', '24']
  };
  const evaluation = evaluateLotteryPrize('sasiri', sasiriDraw, {
    letter: null,
    numbers: ['14', '21', '24']
  });
  check('Sasiri 3 numbers = Rs 200,000', evaluation.prizeAmountRs === 200000, evaluation.prizeAmountRs);
}

{
  const handahanaDraw = {
    drawNo: '1624',
    date: '2026-09-19',
    letter: null,
    zodiac: 'TAURUS',
    superNumber: null,
    numbers: ['34', '44', '57', '60']
  };
  const evaluation = evaluateLotteryPrize('handahana', handahanaDraw, {
    zodiac: 'TAURUS',
    numbers: ['34', '44', '57', '60']
  });
  check('Handahana zodiac + 4 = Rs 3,000,000', evaluation.prizeAmountRs === 3000000, evaluation.prizeAmountRs);
}

/* ------------------------------------------------------------------ */
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
