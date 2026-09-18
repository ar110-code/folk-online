// tests/gameEngine.test.js
// Automated verification for Megagame V4

const assert = require('assert');
const { MegagameRoom, calculateTier, getToolPrice, calculateTechMultiplier } = require('../server/gameEngine');
const { CommsRouter } = require('../server/commsRouter');

console.log('--- شروع تست‌های خودکار موتور بازی استراتژی کلان (Megagame V4) ---');

// 1. Test Economic Tiers (PDF v4.2 Table: 1-3 -> Tier 1, 4-7 -> Tier 2, 8-11 -> Tier 3, 12+ -> Tier 4)
console.log('1. تست محاسبه طبقات اقتصادی (Tiers مطابق جدول صفحه ۷ سند رسمی):');
assert.strictEqual(calculateTier(0), 0, 'Zero tokens should be Tier 0');
assert.strictEqual(calculateTier(1), 1, '1 token should be Tier 1');
assert.strictEqual(calculateTier(3), 1, '3 tokens should still be Tier 1');
assert.strictEqual(calculateTier(4), 2, '4 tokens should be Tier 2');
assert.strictEqual(calculateTier(7), 2, '7 tokens should be Tier 2');
assert.strictEqual(calculateTier(8), 3, '8 tokens should be Tier 3');
assert.strictEqual(calculateTier(11), 3, '11 tokens should be Tier 3');
assert.strictEqual(calculateTier(12), 4, '12 tokens should be Tier 4');
assert.strictEqual(calculateTier(20), 4, '20 tokens should be Tier 4');
console.log('  ✓ محاسبه طبقات ۴ گانه دقیقاً مطابق جدول صفحه ۷ سند رسمی کار کرد.');

// 2. Test Production Formula Output = Tier_Tool * Tier_Pop & Crafting & Selling
console.log('2. تست فرمول تولید: Output = Tier_Tool * Tier_Pop و ساخت/فروش:');
const room = new MegagameRoom('TEST01', 'host_socket');
room.joinSlot('sock_1', 'بازیکن ۱', 'red', 'president');
room.joinSlot('sock_2', 'بازیکن ۲', 'red', 'economy');
room.joinSlot('sock_3', 'بازیکن ۳', 'red', 'war');
room.joinSlot('sock_4', 'بازیکن ۴', 'blue', 'president');
room.joinSlot('sock_5', 'بازیکن ۵', 'blue', 'economy');
room.joinSlot('sock_6', 'بازیکن ۶', 'blue', 'war');
room.startGame(); // Status becomes 'playing', phase = 'morning'

// Setup Wheat and Oven on Red
room.countries['red'].economy.toolsInventory = 20;
room.countries['red'].economy.populationInventory = 20;
// Wheat: 4 tools (Tier 2), 8 pop (Tier 3) -> Output = 2 * 3 = 6
// Oven: 4 tools (Tier 2), 4 pop (Tier 2) -> Output = 2 * 2 = 4
const u1 = room.updatePetalTokens('red', 'wheat', 4, 8);
assert.strictEqual(u1.success, true, 'u1 should succeed');
const u2 = room.updatePetalTokens('red', 'oven', 4, 4);
assert.strictEqual(u2.success, true, 'u2 should succeed');

room.startNoonPhase();
const sellRes = room.harvestProducts('red');
assert.strictEqual(sellRes.produced.wheat, 6, 'Wheat output must be 6 (Tier2 * Tier3)');
assert.strictEqual(sellRes.produced.oven, 4, 'Oven output must be 4 (Tier2 * Tier2)');

// Test craftProduct: consumes 1 wheat + 1 oven -> adds 1 bread to storage
const craftRes = room.craftProduct('red', 'bread');
assert.strictEqual(craftRes.success, true, 'Craft product should succeed');
assert.strictEqual(room.countries['red'].economy.storage.bread, 1, 'Bread in storage must be 1');

// Test sellProduct: sells 1 bread from storage for 5000 coins deposited to National Treasury
const initialTreasury = room.countries['red'].treasury;
const breadRes = room.sellProduct('red', 'bread');
assert.strictEqual(breadRes.success, true, 'Bread sell must succeed');
assert.strictEqual(breadRes.revenue, 5000, 'Revenue for 1 bread should be 5000 coins');
assert.strictEqual(room.countries['red'].economy.storage.bread, 0, 'Storage bread sold');
assert.strictEqual(room.countries['red'].treasury, initialTreasury + 5000, 'Revenue must be deposited to National Treasury');
// Test buyTool: costs 5000 per tool
room.countries['red'].econBudget = 6000;
const buyToolFail = room.buyTool('red', 2); // 10000 needed
assert.strictEqual(buyToolFail.success, false, 'Should fail if budget < 10000');
const buyToolSuccess = room.buyTool('red', 1); // 5000 needed
assert.strictEqual(buyToolSuccess.success, true, 'Should succeed for 1 tool with 5000 coins');
assert.strictEqual(room.countries['red'].econBudget, 1000, 'Remaining budget should be 1000 (6000 - 5000)');
assert.strictEqual(buyToolSuccess.toolsInventory, 13, 'Tools inventory should increase by 1 (12 + 1)');
console.log('  ✓ خرید ابزار با نرخ ۵۰۰۰ سکه به ازای هر ابزار تأیید شد.');

// 3. Test Army Reinforce Cost (2000 per soldier)
console.log('3. تست هزینه شارژ ارتش در خط مقدم (۲۰۰۰ سکه به ازای هر سرباز):');
room.countries['red'].warBudget = 10000;
const boxId = room.countries['red'].military.armyBoxes[0].id;
const reinfRes = room.reinforceBox('red', boxId, 5);
assert.strictEqual(reinfRes.success, true, 'Reinforce should succeed');
assert.strictEqual(reinfRes.cost, 10000, 'Cost for 5 soldiers should be 10000 coins (5 * 2000)');
assert.strictEqual(room.countries['red'].warBudget, 0, 'Remaining war budget should be 0 (10000 - 5*2000)');

// Test insufficient budget for 1 additional soldier (needs 2000, has 0)
const failReinf = room.reinforceBox('red', boxId, 1);
assert.strictEqual(failReinf.success, false, 'Should fail if budget < 2000');
console.log('  ✓ هزینه شارژ ارتش با نرخ ۲۰۰۰ سکه به ازای هر سرباز و بررسی سقف بودجه تأیید شد.');

// 4. Test Tech Puzzle & Circuit Answer & Tech Progression for Economy and War
console.log('4. تست حل پازل‌های فناوری و پیشرفت ضریب ارتش و تخفیف ابزار:');
assert.strictEqual(getToolPrice(1), 5000, 'L1 tool price must be 5000');
assert.strictEqual(getToolPrice(2), 4000, 'L2 tool price must be 4000 (-1000)');
assert.strictEqual(getToolPrice(4), 4000, 'L4 tool price must be 4000');
assert.strictEqual(getToolPrice(5), 3000, 'L5 tool price must be 3000 (-1000)');
assert.strictEqual(getToolPrice(7), 2000, 'L7 tool price must be 2000 (-1000)');
assert.strictEqual(getToolPrice(10), 1000, 'L10 tool price must be 1000 (-1000)');

assert.strictEqual(calculateTechMultiplier(1), 1.0, 'L1 tech multiplier must be 1.0');
assert.strictEqual(calculateTechMultiplier(2), 1.0, 'L2 tech multiplier must be 1.0');
assert.strictEqual(calculateTechMultiplier(3), 1.5, 'L3 tech multiplier must be 1.5 (+0.5)');
assert.strictEqual(calculateTechMultiplier(4), 1.5, 'L4 tech multiplier must be 1.5');
assert.strictEqual(calculateTechMultiplier(5), 2.0, 'L5 tech multiplier must be 2.0 (+0.5)');
assert.strictEqual(calculateTechMultiplier(7), 2.5, 'L7 tech multiplier must be 2.5 (+0.5)');
assert.strictEqual(calculateTechMultiplier(10), 3.0, 'L10 tech multiplier must be 3.0 (+0.5)');

room.countries['red'].treasury = 20000;
room.countries['red'].techLevel = 3;
// Wrong answer test (-2000 coins penalty)
const wrongRes = room.submitTechPuzzle('red', 'WRONG_ANSWER_123');
assert.strictEqual(wrongRes.success, true);
assert.strictEqual(wrongRes.isCorrect, false);
assert.strictEqual(room.countries['red'].treasury, 18000, '2000 coins penalty for wrong answer');
assert.strictEqual(room.countries['red'].techLevel, 3, 'Tech level should remain 3 on wrong answer');

// Correct answer test (using room's seeded level 3 puzzle)
const level3Answer = room.roomPuzzles[3].answer;
assert.ok(level3Answer, 'Level 3 puzzle must have an answer in roomPuzzles');
const submitRes = room.submitTechPuzzle('red', level3Answer);
assert.strictEqual(submitRes.success, true);
assert.strictEqual(submitRes.isCorrect, true, 'Answer must be accepted');
assert.strictEqual(room.countries['red'].treasury, 16000, '2000 coins deducted for attempt');
assert.strictEqual(room.countries['red'].techLevel, 4, 'Tech level should advance to 4');
assert.strictEqual(submitRes.multiplier, 1.5, 'Tech multiplier for level 4 must be 1.5 (Level >= 3)');
assert.strictEqual(submitRes.toolPrice, 4000, 'Tool price for level 4 must be 4000 (Level >= 2)');
assert.ok(room.countries['red'].solvedPuzzles.some(p => p.level === 3 && p.answer === level3Answer), 'Solved puzzle must be archived');
console.log(`  ✓ معمای ۱۰ سطحی با پاسخ "${level3Answer}" حل شد، ۲۰۰۰ سکه کسر شد، در بایگانی ثبت گردید، ضریب ارتش به ${submitRes.multiplier} و قیمت ابزار به ${submitRes.toolPrice} سکه رسید.`);

// 5. Test Night Resource Hex Income
console.log('5. تست درآمد هگزهای منابع در فاز شب:');
const prevTreasury = room.countries['red'].treasury;
room.startNightPhase();
// Red owns at least 6 resource hexes initially -> 6 * 1000 = 6000 coins
assert.ok(room.countries['red'].treasury >= prevTreasury + 6000, 'Treasury must receive at least 6000 coins from 6 resource hexes');
console.log(`  ✓ درآمد هگزهای منابع در فاز شب واریز شد (خزانه: ${room.countries['red'].treasury} سکه).`);

// 6. Test Combat Algorithm & Capital Fall & Turn Order Removal
console.log('6. تست الگوریتم جنگ، سقوط پایتخت و حذف از نوبت:');
const attBox = { id: 'red_box_test', soldiers: 150 };
const targetHex = room.hexMap[room.countries['blue'].capitalHex];
room.countries['red'].techMultiplier = 1.0;
room.countries['blue'].techMultiplier = 1.0;

const combatRes = room.resolveCombat('red', attBox, targetHex);
assert.strictEqual(combatRes.winner, 'red', 'Red should win the battle');
assert.strictEqual(combatRes.survivingSoldiers, 15, 'Surviving soldiers should be exactly 15');
assert.strictEqual(combatRes.isCapitalConquered, true, 'Capital should be conquered');
assert.strictEqual(room.countries['blue'].isEliminated, true, 'Blue should be eliminated');
assert.strictEqual(room.activeCountryOrder.includes('blue'), false, 'Eliminated country must be removed from activeCountryOrder');
console.log('  ✓ نبرد با پیروزی ارتش سرخ، فتح پایتخت و خروج آبی از چرخه نوبت تأیید شد.');

// 7. Test Comms Router Isolation
console.log('7. تست ایزولاسیون کانال‌های ارتباطی متناسب با فاز:');
const comms = new CommsRouter(room);
room.startNoonPhase();
const warChannels = comms.getAvailableChannels('red', 'war');
assert.strictEqual(warChannels.some(c => c.id === 'war_summit'), true, 'War minister must have war_summit in noon');
const econChannels = comms.getAvailableChannels('red', 'economy');
assert.strictEqual(econChannels.some(c => c.id === 'trade_summit'), true, 'Econ minister must have trade_summit in noon');

room.startNightPhase();
const nightChannels = comms.getAvailableChannels('red', 'war');
assert.strictEqual(nightChannels.length, 1, 'Night phase should only have 1 team channel');
assert.strictEqual(nightChannels[0].id, 'team_red', 'Night channel must be team_red');
console.log('  ✓ قوانین ایزولاسیون ارتباطات در فازهای ظهر و شب با موفقیت تأیید شد.');

// 8. Test Peaceful Territory Expansion with Fuel (without army movement)
console.log('8. تست گسترش قلمرو با سوخت بدون نیاز به حرکت ارتش:');
room.startNoonPhase();
const redCountry = room.countries['red'];
redCountry.military.fuelTokens = 2;
const redFriendly = Object.values(room.hexMap).filter(h => h.owner === 'red');
let neutralToExpand = null;
for (const f of redFriendly) {
  const nbr = room.getNeighbors(f).find(n => n.owner === 'neutral');
  if (nbr) {
    neutralToExpand = nbr;
    break;
  }
}
if (neutralToExpand) {
  const expandRes = room.expandTerritory('red', neutralToExpand.id);
  assert.strictEqual(expandRes.success, true, 'Expansion with fuel should succeed');
  assert.strictEqual(redCountry.military.fuelTokens, 1, 'Fuel token must be decremented by 1');
  assert.strictEqual(room.hexMap[neutralToExpand.id].owner, 'red', 'Hex owner must be red');

  // Test second expansion in same turn is blocked
  const secondExpandRes = room.expandTerritory('red', neutralToExpand.id);
  assert.strictEqual(secondExpandRes.success, false, 'Second expansion in same turn must fail');
  assert.strictEqual(secondExpandRes.error, 'در هر نوبت فقط می‌توانید ۱ زمین را با سوخت گسترش دهید.');
  console.log('  ✓ گسترش قلمرو با ۱ سوخت و محدودیت ۱ زمین در هر نوبت با موفقیت تأیید شد.');
}

// 9. Test Ministers Transferring Budget to National Treasury
console.log('9. تست انتقال بودجه وزارتخانه‌های اقتصاد و جنگ به خزانه ملی:');
redCountry.warBudget = 7000;
const prevTreasuryForWar = redCountry.treasury;
const warTransferRes = room.transferMinistryBudgetToTreasury('red', 'war', 2000);
assert.strictEqual(warTransferRes.success, true);
assert.strictEqual(redCountry.warBudget, 5000);
assert.strictEqual(redCountry.treasury, prevTreasuryForWar + 2000);

redCountry.econBudget = 8000;
const prevTreasuryForEcon = redCountry.treasury;
const econTransferRes = room.transferMinistryBudgetToTreasury('red', 'economy', 3000);
assert.strictEqual(econTransferRes.success, true);
assert.strictEqual(redCountry.econBudget, 5000);
assert.strictEqual(redCountry.treasury, prevTreasuryForEcon + 3000);
console.log('  ✓ انتقال بودجه‌های مازاد جنگ و اقتصاد به خزانه ملی با موفقیت تأیید شد.');

console.log('\n✅ تمام تست‌های موتور بازی با موفقیت ۱۰۰٪ پاس شدند!');
