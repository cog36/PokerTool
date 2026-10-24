import test from 'node:test';
import assert from 'node:assert/strict';
import { act, planAction, planOpening, compareRanks, createMatch, createTournamentHand, dealHand, nextHand, evaluate, legalActions, decisionView, chooseBotAction } from './arena.js';
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


function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const chips = state => state.pot + state.players.reduce((sum, player) => sum + player.stack, 0);
function last(frames, fallback) { return frames.at(-1)?.hand || fallback; }

test('random tables contain 1–8 unique profiles and start before any community cards', () => {
  const counts = new Set();
  for (let seed = 1; seed < 300; seed++) {
    const hand = createMatch({ random: seeded(seed * 417) });
    counts.add(hand.players.length - 1);
    assert.ok(hand.players.length >= 2 && hand.players.length <= 9);
    assert.equal(new Set(hand.players.slice(1).map(player => player.archetype)).size, hand.players.length - 1);
    assert.deepEqual(hand.board, []);
    assert.equal(hand.street, 0);
    assert.equal(hand.pot, 3);
    assert.equal(chips(hand), hand.players.length * 200);
    assert.equal(new Set([...hand.deck, ...hand.players.flatMap(player => player.cards)].map(card => card.join(''))).size, 52);
  }
  assert.equal(counts.size, 8);
});

test('heads-up button posts the small blind and acts first; positions rotate', () => {
  const hand = createMatch({ opponentCount: 1, random: seeded(44) });
  assert.equal(hand.smallBlind, 0);
  assert.equal(hand.bigBlind, 1);
  assert.equal(hand.actor, 0);
  const raised = act(hand, { type: 'raise', to: 6 });
  assert.equal(raised.actor, 1);
  const flop = act(raised, 'call');
  assert.equal(flop.street, 1);
  assert.equal(flop.board.length, 3);
  assert.equal(flop.actor, 1);
  assert.throws(() => nextHand(flop), /Finish the current hand/);
  let complete = flop;
  while (complete.phase !== 'complete') complete = act(complete, legalActions(complete).canCheck ? 'check' : 'call');
  assert.equal(nextHand(complete).button, 1);
});

test('check/call play visits all four streets with correct actor order', () => {
  let hand = createMatch({ opponentCount: 3, random: seeded(66) });
  const seen = new Set([hand.street]);
  while (hand.phase !== 'complete') {
    const legal = legalActions(hand);
    hand = act(hand, legal.canCheck ? 'check' : 'call');
    seen.add(hand.street);
  }
  assert.deepEqual([...seen], [0, 1, 2, 3]);
  assert.equal(hand.board.length, 5);
  assert.equal(chips(hand), 800);
});

test('side pots only pay eligible players and odd chips are not lost', () => {
  let hand = createMatch({ opponentCount: 2, random: seeded(77) });
  const players = hand.players.map((player, index) => ({ ...player, stack: [200, 90, 40][index] }));
  hand = dealHand({ players, button: 0, seed: 3 });
  let turns = 0;
  while (hand.phase !== 'complete') {
    const legal = legalActions(hand);
    hand = act(hand, legal.canRaise ? 'allin' : legal.canCheck ? 'check' : 'call');
    assert.ok(++turns < 50);
  }
  assert.equal(chips(hand), 330);
  assert.equal(hand.pot, 0);
  assert.ok(hand.pots.some(pot => pot.refund));
  assert.ok(hand.pots.filter(pot => !pot.refund).length >= 2);
  hand.pots.forEach(pot => {
    if (!pot.refund) pot.winners.forEach(id => assert.ok(hand.players[id].committed >= Math.min(...pot.winners.map(winner => hand.players[winner].committed))));
  });
});

test('short all-ins do not reopen raising for a player who already acted', () => {
  let hand = createMatch({ opponentCount: 2, random: seeded(11) });
  // Three-handed: button 0 acts first, SB 1 is short, BB 2 calls the short raise.
  hand = dealHand({ players: hand.players.map((player, index) => ({ ...player, stack: index === 1 ? 7 : 200 })), seed: 11 });
  hand = act(hand, { type: 'raise', to: 6 });
  hand = act(hand, 'allin');
  hand = act(hand, 'call');
  assert.equal(hand.actor, 0);
  assert.equal(legalActions(hand).canRaise, false);
  assert.equal(legalActions(hand).toCall, 1);
  assert.equal(act(hand, { type: 'raise', to: 20 }), hand);
});

test('bots cannot see opponents’ cards or future streets', () => {
  const hand = createMatch({ opponentCount: 4, random: seeded(88) });
  const id = hand.actor;
  assert.notEqual(id, 0);
  const view = decisionView(hand);
  assert.equal(view.deck, undefined);
  assert.ok(view.opponents.every(player => player.cards === undefined));
  const before = chooseBotAction(view, .6);
  hand.players[0].cards = cards('As Ah');
  hand.deck.reverse();
  assert.deepEqual(chooseBotAction(decisionView(hand), .6), before);
});

test('all table sizes finish with legal actions and conserved chips across multiple hands', () => {
  for (let count = 1; count <= 8; count++) {
    for (let seed = 1; seed <= 20; seed++) {
      let hand = createMatch({ opponentCount: count, random: seeded(seed * 317) });
      const total = chips(hand);
      hand = last(planOpening(hand), hand);
      let decisions = 0;
      while (hand.phase !== 'complete') {
        assert.equal(hand.actor, 0);
        const legal = legalActions(hand);
        const action = decisions % 4 === 0 && legal.canRaise ? { type: 'raise', to: legal.minRaiseTo } : legal.canCheck ? 'check' : 'call';
        const frames = planAction(hand, action);
        assert.ok(frames.length);
        frames.forEach(frame => { assert.equal(chips(frame.hand), total); assert.ok(frame.hand.players.every(player => player.stack >= 0)); });
        hand = last(frames, hand);
        assert.ok(++decisions < 1000);
      }
      assert.equal(hand.pot, 0);
      assert.equal(chips(hand), total);
      assert.deepEqual(planAction(hand, 'call'), []);
    }
  }
});

test('archetypes change decisions rather than only their labels', () => {
  const hand = createMatch({ opponentCount: 2, random: seeded(1) });
  const base = { ...decisionView(hand), cards: cards('7s 2h'), position: 'UTG', opponents: [], legal: { toCall: 2, callCost: 2, canRaise: true, minRaiseTo: 4, maxRaiseTo: 200 }, currentBet: 2, streetBet: 0, pot: 3, raises: 0, street: 0 };
  assert.equal(chooseBotAction({ ...base, archetype: 'nit' }, .95), 'fold');
  assert.equal(chooseBotAction({ ...base, archetype: 'maniac' }, .95).type, 'raise');
  assert.equal(chooseBotAction({ ...base, archetype: 'station' }, .10), 'call');
  const premium = { ...base, cards: cards('As Ah') };
  assert.equal(chooseBotAction({ ...premium, archetype: 'tag' }, .3).type, 'raise');
  assert.equal(chooseBotAction({ ...premium, archetype: 'tp' }, .3), 'call');
  assert.equal(chooseBotAction({ ...premium, archetype: 'tricky' }, .3), 'call');
  const exploit = { ...base, archetype: 'exploit' };
  assert.equal(chooseBotAction(exploit, .83), 'fold');
  assert.equal(chooseBotAction({ ...exploit, opponents: [{ stats: { actions: 4, folds: 3, calls: 0, raises: 0 } }] }, .83).type, 'raise');
});

test('side-pot eligibility prevents a short stack winning chips it did not cover', () => {
  let hand = createMatch({ opponentCount: 2, random: seeded(8) });
  hand.board = cards('2s 3h 5d 9c Ts'); hand.street = 3;
  hand.players.forEach((player, index) => {
    player.cards = cards(['As Ah', 'Ks Kh', 'Qs Qh'][index]);
    player.committed = [40, 90, 90][index]; player.streetBet = player.committed;
    player.stack = [0, 0, 110][index]; player.allIn = index < 2;
  });
  hand.pot = 220; hand.currentBet = 90; hand.actor = 2; hand.pending = [2];
  hand = planOpening(hand).at(-1).hand;
  assert.deepEqual(hand.players.map(player => player.stack), [120, 100, 110]);
  assert.deepEqual(hand.pots.map(pot => pot.winners), [[0], [1]]);
});

test('an odd chip in a tied pot goes clockwise from the button', () => {
  let hand = createMatch({ opponentCount: 2, random: seeded(9) });
  hand.street = 3; hand.board = cards('Ts Js Qs Ks As');
  hand.players.forEach((player, index) => {
    player.cards = cards(['2h 3h', '4h 5h', '6h 7h'][index]);
    player.stack = 195; player.committed = 5; player.streetBet = 0;
  });
  hand.players[2].folded = true;
  hand.pot = 15; hand.currentBet = 0; hand.actor = 0; hand.pending = [0, 1];
  hand = act(act(hand, 'check'), 'check');
  assert.deepEqual(hand.players.map(player => player.stack), [202, 203, 195]);
  assert.equal(chips(hand), 600);
});

test('cumulative short all-ins can reopen raising by a full increment', () => {
  const initial = createMatch({ opponentCount: 3, random: seeded(4) });
  let hand = dealHand({ players: initial.players.map((player, index) => ({ ...player, stack: [200, 8, 10, 200][index] })) });
  assert.equal(hand.actor, 3);
  hand = act(hand, 'call');
  hand = act(hand, { type: 'raise', to: 6 });
  hand = act(hand, 'allin');
  hand = act(hand, 'allin');
  hand = act(hand, 'call');
  assert.equal(hand.actor, 0);
  assert.equal(legalActions(hand).canRaise, true);
  assert.equal(legalActions(hand).minRaiseTo, 14);
});

test('an incomplete opening all-in needs a full raise and does not reopen a previous check', () => {
  const initial = createMatch({ opponentCount: 2, random: seeded(18) });
  let hand = dealHand({ players: initial.players.map((player, index) => ({ ...player, stack: index === 2 ? 3 : 200 })) });
  hand = act(hand, 'call');
  hand = act(hand, 'call');
  hand = act(hand, 'check');
  assert.equal(hand.street, 1);
  assert.equal(hand.actor, 1);
  hand = act(hand, 'check');
  hand = act(hand, 'allin');
  assert.equal(hand.actor, 0);
  assert.equal(legalActions(hand).minRaiseTo, 3);
  hand = act(hand, 'call');
  assert.equal(hand.actor, 1);
  assert.equal(legalActions(hand).canRaise, false);
});

test('persistent actions label raises, 3-bets and call increments separately from total chips', () => {
  let hand = createMatch({ opponentCount: 2, random: seeded(2) });
  hand = act(hand, { type: 'raise', to: 6 });
  assert.equal(hand.players[0].lastAction.label, 'Raise');
  assert.equal(hand.players[0].streetBet, 6);
  hand = act(hand, { type: 'raise', to: 16 });
  assert.equal(hand.players[1].lastAction.label, '3-bet');
  assert.equal(hand.players[1].lastAction.total, 16);
  hand = act(hand, 'call');
  const callFrame = planAction(hand, 'call').find(frame => frame.actor === 0 && frame.event === 'call');
  assert.equal(callFrame.hand.players[0].lastAction.amount, 10);
  assert.equal(callFrame.hand.players[0].lastAction.total, 16);
  hand = act(hand, 'call');
  // Round completion sweeps bets and resets old labels before the flop action.
  assert.equal(hand.street, 1);
  assert.ok(hand.players.every(player => player.streetBet === 0 && player.lastAction === null));
});

test('tournament drills redraw seven unique types and reseat the human and shared archetypes', () => {
  let previous = createTournamentHand({ random: () => .999 });
  for (let number = 2; number < 8; number++) {
    const hand = createTournamentHand({ number, previous, random: () => .999 });
    assert.equal(hand.players.length, 8);
    assert.equal(new Set(hand.players.map(player => player.seat)).size, 8);
    assert.equal(new Set(hand.players.slice(1).map(player => player.archetype)).size, 7);
    assert.notEqual(hand.players[0].seat, previous.players[0].seat);
    assert.notEqual(hand.players[0].position, previous.players[0].position);
    assert.notDeepEqual(hand.players.slice(1).map(player => player.archetype).sort(), previous.players.slice(1).map(player => player.archetype).sort());
    hand.players.slice(1).forEach(player => {
      const old = previous.players.find(other => other.archetype === player.archetype);
      if (old) assert.notEqual(player.seat, old.seat);
    });
    assert.ok(hand.players.every(player => player.stack + player.committed === 200));
    assert.equal(hand.trainingMode, 'chipEV');
    previous = hand;
  }
});

test('random physical seats determine blinds and action order without changing human identity', () => {
  const hand = createTournamentHand({ random: seeded(999) });
  const seats = [...hand.players].sort((a, b) => a.seat - b.seat);
  const button = seats.findIndex(player => player.id === hand.button);
  assert.equal(hand.smallBlind, seats[(button + 1) % 8].id);
  assert.equal(hand.bigBlind, seats[(button + 2) % 8].id);
  assert.equal(hand.actor, seats[(button + 3) % 8].id);
  assert.equal(hand.players[0].name, 'You');
});

test('chip-EV tournament hands keep archetypes fixed and conserve chips through sampled decisions', () => {
  for (const seed of [11, 17, 31]) {
    let hand = createTournamentHand({ random: seeded(seed) });
    const roster = hand.players.map(player => [player.id, player.archetype, player.seat]);
    hand = last(planOpening(hand), hand);
    let decisions = 0;
    while (hand.phase !== 'complete') {
      const legal = legalActions(hand);
      const frames = planAction(hand, legal.canCheck ? 'check' : 'call');
      hand = last(frames, hand);
      assert.deepEqual(hand.players.map(player => [player.id, player.archetype, player.seat]), roster);
      assert.equal(chips(hand), 1600);
      assert.ok(++decisions < 200);
    }
  }
});
