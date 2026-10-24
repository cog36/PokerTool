import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalHand, chartForStack, evaluateHeroPreflop } from './preflopCharts.js';
import { actionFeedback } from './actionFeedback.js';
const cards = (a = 'A', b = 'A', suited = false) => [[a, '♠'], [b, suited ? '♠' : '♥']];
function spot(depth = 100, position = 'BTN', hole = cards(), history = []) {
 const players = Array.from({ length: 8 }, (_, id) => ({ id, name: id ? `Bot ${id}` : 'You', position: id ? ['BB', 'SB', 'CO', 'HJ', 'LJ', 'UTG+1', 'UTG'][id - 1] : position, inHand: true, stack: depth * 2, streetBet: 0, committed: 0, cards: id ? cards('7', '2') : hole }));
 return { number: 1, players, startingStacks: Array(8).fill(depth * 2), stackDepthBB: depth, street: 0, currentBet: 2, pot: 3, history };
}
function after(before, type) {
 const result = structuredClone(before);
 result.players[0].lastAction = { type, label: type, amount: type === 'call' ? 2 : 6, total: 6 };
 result.history.push({ actor: 0, action: type }); return result;
}
test('canonical keys match all three chart hand categories independent of card order', () => {
 assert.equal(canonicalHand(cards()), 'AA');
 assert.equal(canonicalHand(cards('K', 'A', true)), 'AKs');
 assert.equal(canonicalHand(cards('2', '7')), '72o');
});
test('range explorer chooses the closest available chart and resolves ties upward', () => {
 assert.equal(chartForStack(12).chartDepth, 10);
 assert.equal(chartForStack(15).chartDepth, 20);
 assert.equal(chartForStack(25).chartDepth, 20);
 assert.equal(chartForStack(30).chartDepth, 40);
 assert.equal(chartForStack(50).chartDepth, 40);
});
test('all five chart depths approve premium opens and reject opening 72o on the button', () => {
 for (const depth of [5, 10, 20, 40, 100]) {
  const before = spot(depth); const premium = evaluateHeroPreflop(before, after(before, 'raise'));
  assert.equal(premium.actionFrequency, 1); assert.equal(premium.assessment, 'APPROVED'); assert.equal(premium.depth, depth);
  before.players[0].cards = cards('7', '2');
  assert.equal(evaluateHeroPreflop(before, after(before, 'raise')).assessment, 'NOT_RECOMMENDED');
  assert.equal(evaluateHeroPreflop(before, after(before, 'fold')).assessment, 'APPROVED');
 }
});
test('mixed-frequency actions stay approved and retain the supplied frequency', () => {
 const before = spot(10, 'BTN', cards('K', '7'));
 const result = evaluateHeroPreflop(before, after(before, 'raise'));
 assert.equal(result.actionFrequency, .3); assert.equal(result.assessment, 'APPROVED');
 assert.equal(result.frequencies.FOLD, .7);
});
test('position mapping removes EP1 in eight-handed games', () => {
 for (const [position, expected] of [['UTG', 'EP2'], ['UTG+1', 'EP3'], ['LJ', 'LJ']]) {
  const before = spot(100, position); assert.equal(evaluateHeroPreflop(before, after(before, 'raise')).position, expected);
 }
});
test('open, 3-bet and 4-bet contexts select the matching action tables', () => {
 const before = spot(100, 'BB', cards('A', 'K', true), [{ street: 'Preflop', action: 'raise', actor: 1 }]);
 before.players[1].position = 'BTN';
 assert.deepEqual(evaluateHeroPreflop(before, after(before, 'raise')).keys, ['CallBBvsBTN', '3BetBBvsBTN']);
 before.players[0].position = 'BTN';before.players[1].position = 'BB';
 before.history.unshift({ street: 'Preflop', action: 'raise', actor: 0 });
 assert.deepEqual(evaluateHeroPreflop(before, after(before, 'raise')).keys, ['Call 3BetBTNvsBB', '4BetBTNvsBB']);
 before.players[0].position = 'BB';before.players[1].position = 'BTN';
 before.history.unshift({ street: 'Preflop', action: 'raise', actor: 1 });
 assert.deepEqual(evaluateHeroPreflop(before, after(before, 'raise')).keys, ['Call 4BetBBvsBTN', '5BetBBvsBTN']);
});
test('uncovered preflop spots fall back to legacy feedback and disclose why', () => {
 for (const before of [spot(15), spot(20, 'BTN', cards(), [{ street: 'Preflop', action: 'call', actor: 1 }]), spot(20, 'BTN', cards(), [{ street: 'Preflop', action: 'raise', actor: 1 }, { street: 'Preflop', action: 'raise', actor: 2 }])]) {
  const result = actionFeedback(before, after(before, 'call'), 0);
  assert.equal(result.source, 'LEGACY_LOGIC'); assert.equal(result.chart.assessment, 'UNASSESSED');
  assert.equal(result.fallback, true); assert.ok(result.fallbackReason);
  assert.match(result.text, /using legacy analysis/); assert.match(result.text, /Pays/);
 }
});
test('opponent and Hero postflop feedback retain legacy evaluation with no chart data', () => {
 const before = spot(); let result = after(before, 'check');
 before.street = 1; result.street = 1;
 const hero = actionFeedback(before, result, 0);
 assert.equal(hero.source, 'LEGACY_LOGIC'); assert.equal(hero.chart, null);
 assert.match(hero.text, /^Keeps the pot controlled/);
 before.street = 0; result.players[1].lastAction = { type: 'check', label: 'Check' };
 const bot = actionFeedback(before, result, 1);
 assert.equal(bot.source, 'LEGACY_LOGIC'); assert.equal(bot.text, hero.text);
});
