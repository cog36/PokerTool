import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, planOpening, planAction } from './arena.js';
import { actionFeedback } from './actionFeedback.js';

test('each played action has public, concise feedback and replay-stable keys', () => {
  const initial = createMatch({ opponentCount: 7, random: () => .999 });
  const opening = planOpening(initial);
  let hand = opening.at(-1).hand;
  const frames = [...opening];
  while (hand.phase !== 'complete') {
    const next = planAction(hand, 'call');
    // Hero may check instead of calling when no chips are owed.
    const legal = next.length ? next : planAction(hand, 'check');
    frames.push(...legal);
    hand = legal.at(-1).hand;
  }
  const actions = frames.filter(frame => ['fold', 'check', 'call', 'raise'].includes(frame.event));
  assert.ok(actions.some(frame => frame.actor !== 0));
  assert.ok(actions.some(frame => frame.actor === 0));
  assert.equal(new Set(actions.map(frame => frame.feedback.id)).size, actions.length);
  actions.forEach(frame => {
    assert.equal(frame.feedback.actor, frame.actor);
    assert.ok(frame.feedback.text.length < 300);
    assert.equal('cards' in frame.feedback, false);
  });
});

test('call feedback caps the pot to hero coverage and ignores hidden cards', () => {
  const before = { number: 1, pot: 220, currentBet: 100, players: [
    { id: 0, stack: 10, streetBet: 0, committed: 10 },
    { id: 1, committed: 110 }, { id: 2, committed: 100 },
  ] };
  const after = { number: 1, street: 0, history: [1], players: [{ name: 'You', position: 'BB', lastAction: { type: 'call', label: 'Call', amount: 10 } }] };
  assert.match(actionFeedback(before, after, 0).text, /17% equity/);
  before.players[1].cards = [['A', '♠'], ['A', '♥']];
  assert.match(actionFeedback(before, after, 0).text, /17% equity/);
});
