import test from 'node:test';
import assert from 'node:assert/strict';
import { act, planAction, compareRanks, dealHand, evaluate } from './arena.js';
const cards = text => text.split(' ').map(card => [card[0], { s: '♠', h: '♥', d: '♦', c: '♣' }[card[1]]]);

// Cover each ranking category plus the two tricky cases: wheel straights and kickers.
test('showdown evaluator ranks all categories and chooses the best five of seven', () => {
  const examples = ['As Jh 9c 6d 3s', 'As Ah 9c 6d 3s', 'As Ah 9c 9d 3s', 'As Ah Ac 6d 3s', 'As 2h 3c 4d 5s', 'As Js 9s 6s 3s', 'As Ah Ac 6d 6s', 'As Ah Ac Ad 3s', '9s Ts Js Qs Ks'];
  examples.forEach((hand, category) => assert.equal(evaluate(cards(hand))[0], category));
  assert.deepEqual(evaluate(cards('As 2h 3c 4d 5s')), [4, 5]);
  assert.deepEqual(evaluate(cards('As Ah Ac Kd Ks Kh 2c')), [6, 14, 13]);
  assert.ok(compareRanks(evaluate(cards('As Ah Kc 9d 2s')), evaluate(cards('Ad Ac Qc Jd 9s'))) > 0);
  assert.deepEqual(evaluate(cards('Ts Js Qs Ks As 2h 3d')), [8, 14]);
});

test('a deal has unique cards and conserves the initial chips', () => {
  const state = dealHand();
  const all = [...state.board, ...state.players.flatMap(player => player.cards)];
  assert.equal(new Set(all.map(card => card.join(''))).size, 13);
  assert.equal(state.pot + state.players.reduce((total, player) => total + player.stack, 0), 400);
});

test('calls, folds, bets, and check-throughs conserve chips and never award twice', () => {
  let seed = 417;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  let facing = 0;
  for (let n = 0; n < 90; n++) {
    const initial = dealHand(undefined, n + 1, random);
    let result = act(initial, ['check', 'bet4', 'bet8'][n % 3]);
    if (result.phase === 'facing') { facing++; result = act(result, n % 2 ? 'fold' : 'call'); }
    assert.equal(result.phase, 'complete');
    assert.equal(result.pot, 0);
    assert.ok(Math.abs(result.players.reduce((total, player) => total + player.stack, 0) - 400) < 1e-8);
    assert.ok(result.players.every(player => player.stack >= 0));
    assert.equal(act(result, 'bet8'), result);
    assert.equal(initial.phase, 'player');
    assert.equal(initial.pot, 12);
  }
  assert.ok(facing > 0);
});

test('a shared royal flush splits the pot without losing chips', () => {
  const state = dealHand();
  state.board = cards('Ts Js Qs Ks As');
  state.players.forEach((player, index) => { player.cards = cards(['2h 3h', '4h 5h', '6h 7h', '8h 9h'][index]); });
  const result = act(state, 'bet8');
  assert.deepEqual(result.winners, [0, 1, 2, 3]);
  assert.ok(result.players.every(player => player.stack === 100));
});


test('animation frames preserve engine results and show each chip movement before settlement', () => {
  const initial = dealHand();
  const frames = planAction(initial, 'bet8');
  assert.equal(frames[0].event, 'bet');
  assert.equal(frames[0].hand.pot, 20);
  assert.equal(frames[0].hand.players[0].stack, 89);
  assert.equal(frames.filter(frame => frame.event === 'thinking').length, 3);
  assert.ok(frames.some(frame => frame.event === 'showdown'));
  assert.equal(frames.at(-1).event, 'award');
  assert.deepEqual(frames.at(-1).hand, act(initial, 'bet8'));
  assert.equal(initial.pot, 12);
  for (const frame of frames) {
    const total = frame.hand.pot + frame.hand.players.reduce((sum, player) => sum + player.stack, 0);
    assert.ok(Math.abs(total - 400) < 1e-8);
  }
  assert.equal(frames[0].hand.players[1].folded, false);
  assert.deepEqual(planAction(frames.at(-1).hand, 'bet8'), []);
});
