import test from 'node:test';
import assert from 'node:assert/strict';
import { sampledChipEV, callChipEV, betChipEV } from './chipEv.js';
const cards = text => text.split(' ').map(card => [card[0], { s: '♠', h: '♥', d: '♦', c: '♣' }[card[1]]]);

test('chip-EV call arithmetic compares the immediate chip return with the call cost', () => {
  assert.equal(callChipEV(.25, 30, 10), 0);
  assert.equal(callChipEV(.5, 30, 10), 10);
  assert.equal(callChipEV(.1, 30, 10), -6);
});

test('sampled equity recognises an unbeatable river hand without access to hidden cards', () => {
  const view = { id: 0, cards: cards('As Ks'), board: cards('Qs Js Ts 2h 3c'), pot: 20, legal: { callCost: 10 }, opponents: [{ id: 1, stack: 100, streetBet: 10 }] };
  const result = sampledChipEV(view, 20);
  assert.equal(result.equity, 1);
  assert.equal(result.callEV, 20);
  assert.deepEqual(sampledChipEV({ ...view, deck: cards('Ah Ad'), hiddenCards: cards('Kh Kd') }, 20), result);
});

test('short-stack call estimates cannot claim an uncovered side pot', () => {
  const result = sampledChipEV({ id: 0, committed: 0, cards: cards('2h 3h'), board: cards('Ts Js Qs Ks As'), pot: 200,
    legal: { callCost: 2 }, contributors: [{ id: 0, committed: 0 }, { id: 1, committed: 100 }, { id: 2, committed: 100 }],
    opponents: [{ id: 1, stack: 0 }, { id: 2, stack: 0 }] }, 12);
  assert.equal(result.callEV, 0);
  assert.equal(result.potOdds, 1 / 3);
});

test('all-in opponents provide no imaginary fold equity', () => {
  const view = { pot: 20, streetBet: 0, opponents: [{ stack: 0, streetBet: 10, stats: { actions: 5, folds: 5 } }] };
  assert.equal(betChipEV(view, 10, 0), -10);
});
