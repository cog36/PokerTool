import { values, evaluate, compareRanks } from './pokerCards.js';

// This is a finite-sample, check-down model, not solved strategic EV or ICM.
// All unknown cards are sampled from the unseen deck, never the game's real deck.
// Calls use only currently committed pots; later betting and range selection add uncertainty.
export function callChipEV(equity, potBeforeCall, cost) {
  return equity * (potBeforeCall + cost) - cost;
}

function randomFrom(text) {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}

function eligiblePots(view) {
  const cost = view.legal?.callCost || 0;
  if (!view.contributors) return [{ amount: view.pot + cost, ids: [view.id, ...view.opponents.map((opponent, index) => opponent.id ?? -(index + 1))] }];
  const cap = view.committed + cost;
  const contributions = view.contributors.map(player => ({ ...player, total: Math.min(cap, player.committed + (player.id === view.id ? cost : 0)) }));
  const levels = [...new Set(contributions.map(player => player.total).filter(Boolean))].sort((a, b) => a - b);
  let previous = 0;
  return levels.map(level => {
    const contributors = contributions.filter(player => player.total >= level);
    const pot = { amount: (level - previous) * contributors.length, ids: contributors.filter(player => !player.folded).map(player => player.id) };
    previous = level;
    return pot;
  });
}

export function sampledChipEV(view, samples = 40) {
  const known = [...view.cards, ...view.board];
  const occupied = new Set(known.map(card => card.join('')));
  const unseen = [...values].flatMap(rank => ['♠', '♥', '♣', '♦'].map(suit => [rank, suit])).filter(card => !occupied.has(card.join('')));
  const opponents = view.opponents.map((player, index) => player.id ?? -(index + 1));
  const random = randomFrom(`${view.id}|${known.map(card => card.join('')).join(',')}|${opponents.join(',')}`);
  const pots = eligiblePots(view);
  const cost = view.legal?.callCost || 0;
  let shares = 0, returns = 0;
  const riverRank = view.board.length === 5 ? evaluate(known) : null;
  for (let trial = 0; trial < samples; trial++) {
    const deck = [...unseen];
    const draw = () => {
      const index = Math.floor(random() * deck.length);
      const card = deck[index]; deck[index] = deck.at(-1); deck.pop(); return card;
    };
    const board = [...view.board];
    while (board.length < 5) board.push(draw());
    const ranks = new Map([[view.id, riverRank || evaluate([...view.cards, ...board])]]);
    opponents.forEach(id => ranks.set(id, evaluate([draw(), draw(), ...board])));
    const share = ids => {
      let best = [-1], winners = [];
      ids.forEach(id => {
        const rank = ranks.get(id);
        if (!rank) return;
        const comparison = compareRanks(rank, best);
        if (comparison > 0) { best = rank; winners = [id]; }
        else if (comparison === 0) winners.push(id);
      });
      return winners.includes(view.id) ? 1 / winners.length : 0;
    };
    shares += share([view.id, ...opponents]);
    returns += pots.reduce((total, pot) => total + pot.amount * share(pot.ids), 0);
  }
  const eligible = pots.reduce((total, pot) => total + pot.amount, 0);
  return { equity: shares / samples, callEV: returns / samples - cost, potOdds: eligible ? cost / eligible : 0, samples, model: 'uniform-unseen-cards-checkdown' };
}

export function betChipEV(view, target, equity) {
  const coveredTarget = Math.min(target, Math.max(0, ...view.opponents.map(opponent => (opponent.streetBet || 0) + opponent.stack)));
  const extra = Math.max(0, coveredTarget - view.streetBet);
  let allFold = 1, expectedCalls = 0;
  for (const opponent of view.opponents) {
    // All-in opponents cannot fold; optional side pots must not create phantom fold equity.
    const fold = opponent.stack === 0 ? 0 : opponent.stats?.actions >= 3
      ? Math.min(.8, Math.max(.1, opponent.stats.folds / opponent.stats.actions)) : .25;
    allFold *= fold;
    expectedCalls += (1 - fold) * Math.min(opponent.stack, Math.max(0, coveredTarget - (opponent.streetBet || 0)));
  }
  return allFold * view.pot + (1 - allFold) * (equity * (view.pot + extra + expectedCalls) - extra);
}
