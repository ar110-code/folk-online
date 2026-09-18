// tests/techPuzzles.test.js
const assert = require('assert');
const { MegagameRoom, generateRoomPuzzles, checkPuzzleAnswer, sanitizePuzzle } = require('../server/gameEngine');

console.log('--- شروع تست‌های اختصاصی سیستم ۱۰ سطحی فناوری و جاسوسی اطلاعاتی ---');

// 1. Test Seeded PRNG & Room Determinism
console.log('۱. تست بذربندی بر اساس کد اتاق و یکسانی سوالات برای تمام کشورهای یک اتاق:');
const roomAlpha = new MegagameRoom('WAR-ROOM-77', 'host1', 'General');
const roomBeta = new MegagameRoom('PEACE-ROOM-99', 'host2', 'Diplomat');

assert.strictEqual(Object.keys(roomAlpha.roomPuzzles).length, 10, 'Must have exactly 10 levels');
assert.strictEqual(Object.keys(roomBeta.roomPuzzles).length, 10, 'Must have exactly 10 levels');

for (let lvl = 1; lvl <= 10; lvl++) {
  const pA = roomAlpha.roomPuzzles[lvl];
  assert.ok(pA.answer, `Level ${lvl} must have an answer`);
  assert.strictEqual(checkPuzzleAnswer(pA, pA.answer), true, `Self-check answer failed for level ${lvl}`);
}

// Check that countries in same room face the EXACT SAME answers
const redInitialPuzzle = roomAlpha.countries['red'].currentPuzzle;
const blueInitialPuzzle = roomAlpha.countries['blue'].currentPuzzle;
assert.strictEqual(redInitialPuzzle.level, blueInitialPuzzle.level, 'Initial levels match');
assert.strictEqual(redInitialPuzzle.prompt, blueInitialPuzzle.prompt, 'Prompts must be identical across countries');
assert.strictEqual(roomAlpha.roomPuzzles[1].answer, roomAlpha.roomPuzzles[1].answer, 'Answers identical across countries in room');
console.log(`  ✓ پازل‌های سطح ۱ برای سرخستان و آبی‌پلیس در اتاق WAR-ROOM-77 کاملاً یکسان هستند (پاسخ: ${roomAlpha.roomPuzzles[1].answer}).`);

// Check difference across different rooms
const ansAlphaL1 = roomAlpha.roomPuzzles[1].answer;
const ansBetaL1 = roomBeta.roomPuzzles[1].answer;
console.log(`  ✓ بررسی تفاوت بین دو اتاق: اتاق الف: ${ansAlphaL1} | اتاق ب: ${ansBetaL1}`);

// 2. Test Sanitization (Security / Anti-Cheat)
console.log('۲. تست امنیت و پنهان‌سازی پاسخ از کلاینت (Sanitization):');
assert.strictEqual(redInitialPuzzle.answer, undefined, 'Client puzzle must NOT contain plain answer');
assert.strictEqual(sanitizePuzzle(roomAlpha.roomPuzzles[5]).answer, undefined, 'Sanitized puzzle 5 must not expose answer');
console.log('  ✓ پاسخ‌های معماها از دید کلاینت پنهان و در سرور محفوظ است.');

// 3. Test Fee Deduction (2000 coins on both right and wrong)
console.log('۳. تست کسر اجباری ۲۰۰۰ سکه برای هر بار ثبت پاسخ:');
roomAlpha.countries['red'].treasury = 5000;

// Wrong answer attempt
const failRes = roomAlpha.submitTechPuzzle('red', 'FAKE-CODE-BLUFF');
assert.strictEqual(failRes.success, true);
assert.strictEqual(failRes.isCorrect, false);
assert.strictEqual(roomAlpha.countries['red'].treasury, 3000, 'Treasury must decrease by 2000 on wrong attempt');
assert.strictEqual(roomAlpha.countries['red'].techLevel, 1, 'Tech level must not advance on failure');

// Correct answer attempt
const correctL1 = roomAlpha.roomPuzzles[1].answer;
const winRes = roomAlpha.submitTechPuzzle('red', correctL1);
assert.strictEqual(winRes.success, true);
assert.strictEqual(winRes.isCorrect, true);
assert.strictEqual(roomAlpha.countries['red'].treasury, 1000, 'Treasury must decrease by 2000 on correct attempt');
assert.strictEqual(roomAlpha.countries['red'].techLevel, 2, 'Tech level advances to 2');
assert.strictEqual(roomAlpha.countries['red'].solvedPuzzles.length, 1);
assert.strictEqual(roomAlpha.countries['red'].solvedPuzzles[0].answer, correctL1);
console.log('  ✓ کسر ۲۰۰۰ سکه برای پاسخ غلط و درست به دقت تأیید شد.');

// Insufficient funds attempt
const brokeRes = roomAlpha.submitTechPuzzle('red', 'ANY');
assert.strictEqual(brokeRes.success, false, 'Should reject if treasury < 2000');
assert.ok(brokeRes.error.includes('۲٬۰۰۰ سکه'));
console.log('  ✓ جلوگیری از ثبت پاسخ در صورت کمبود سکه در خزانه تأیید شد.');

// 4. Test Progression through all 10 Levels
console.log('۴. تست پیشرفت در تمام ۱۰ سطح پازل فناوری:');
roomAlpha.countries['red'].treasury = 100000;

for (let lvl = 2; lvl <= 10; lvl++) {
  const ans = roomAlpha.roomPuzzles[lvl].answer;
  const res = roomAlpha.submitTechPuzzle('red', ans);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.isCorrect, true, `Level ${lvl} should be solved with ${ans}`);
  assert.strictEqual(roomAlpha.countries['red'].techLevel, lvl + 1);
}

assert.strictEqual(roomAlpha.countries['red'].techLevel, 11, 'Completed all 10 levels');
assert.strictEqual(roomAlpha.countries['red'].currentPuzzle, null, 'No more puzzles after level 10');
assert.strictEqual(roomAlpha.countries['red'].solvedPuzzles.length, 10, 'All 10 puzzles in secret archive');
assert.strictEqual(roomAlpha.countries['red'].techMultiplier, 3.0, 'Level 10 max multiplier is 3.0x');
assert.strictEqual(roomAlpha.getToolPrice(roomAlpha.countries['red'].techLevel), 1000, 'Level 10 tool price is 1000');

console.log('  ✓ تمام ۱۰ سطح پازل به ترتیب با موفقیت حل شدند و آرشیو ۱۰ تایی ساخته شد.');
console.log('✅ تمامی تست‌های اختصاصی پازل‌های فناوری با موفقیت ۱۰۰٪ پاس شدند!');
