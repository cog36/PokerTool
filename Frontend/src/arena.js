import { archetypes, profileFor } from './archetypes.js';

// Money is stored in half-big-blind chips (2 chips = 1bb). Integer accounting
// makes blind posting, all-ins, split pots, and odd chips deterministic.
export const BIG_BLIND = 2;
export const STREETS = ['Preflop', 'Flop', 'Turn', 'River'];
const values = '23456789TJQKA';
export const handLabels = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

export function compareRanks(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return difference;
  }
  return 0;
}

function rankFive(cards) {
  const numbers = cards.map(card => values.indexOf(card[0]) + 2).sort((a, b) => b - a);
  const counts = new Map();
  numbers.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const unique = [...counts.keys()].sort((a, b) => b - a);
  const straight = unique.length === 5 && unique[0] - unique[4] === 4 ? unique[0] : unique.join(',') === '14,5,4,3,2' ? 5 : 0;
  const flush = cards.every(card => card[1] === cards[0][1]);
  if (straight && flush) return [8, straight];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...numbers];
  if (straight) return [4, straight];
  if (groups[0][1] === 3) return [3, ...groups.map(group => group[0])];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, ...groups.map(group => group[0])];
  if (groups[0][1] === 2) return [1, ...groups.map(group => group[0])];
  return [0, ...numbers];
}

export function evaluate(cards) {
  let best = [-1];
  // Seven cards have only 21 five-card subsets; exhaustive ranking is small and clear.
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const rank = rankFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (compareRanks(rank, best) > 0) best = rank;
          }
  return best;
}


const nextSeat = (players, from, predicate = player => player.inHand) => {
  for (let offset = 1; offset <= players.length; offset++) {
    const index = (from + offset) % players.length;
    if (predicate(players[index])) return index;
  }
  return null;
};
const able = player => player.inHand && !player.folded && player.stack > 0;
const live = state => state.players.filter(player => player.inHand && !player.folded);
function ordered(state, from, predicate = able) {
  return Array.from({ length: state.players.length }, (_, offset) => (from + offset + 1) % state.players.length).filter(id => predicate(state.players[id]));
}
function note(state, text, actor = null) {
  state.history.push({ street: STREETS[state.street], actor, text });
  state.log.push(`[${STREETS[state.street]}] ${text}`);
}
function pay(state, player, amount) {
  const chips = Math.min(player.stack, amount);
  player.stack -= chips;
  player.committed += chips;
  player.streetBet += chips;
  state.pot += chips;
  player.allIn = player.stack === 0;
  return chips;
}
const money = chips => `${Number((chips / 2).toFixed(2))}bb`;

// Seeded randomness lives in the hand, so React renders cannot reroll an opponent.
function randomFor(state) {
  state.rng = (Math.imul(1664525, state.rng) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

export function createMatch({ opponentCount, random = Math.random } = {}) {
  const count = opponentCount ?? 1 + Math.floor(random() * 8);
  if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error('Choose 1–8 opponents.');
  const pool = [...archetypes];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const players = [{ id: 0, name: 'You', stack: 200, stats: { actions: 0, folds: 0, calls: 0, raises: 0 } }, ...pool.slice(0, count).map((profile, index) => ({
    id: index + 1, name: profile.name, archetype: profile.id, stack: 200,
    stats: { actions: 0, folds: 0, calls: 0, raises: 0 },
  }))];
  return dealHand({ players, button: 0, number: 1, seed: Math.floor(random() * 4294967295) });
}

export function dealHand({ players, button = 0, number = 1, seed = 417 } = {}) {
  if (!players) return createMatch();
  const state = {
    players: players.map(player => ({ ...player, stats: { ...player.stats }, inHand: player.stack > 0, cards: [], committed: 0, streetBet: 0, folded: false, allIn: false, lastActedBet: null, reopenAt: 0, rank: null, bubble: player.id ? profileFor(player.archetype).intro : '' })),
    button, number, street: 0, board: [], deck: [], pot: 0, currentBet: BIG_BLIND,
    minRaise: BIG_BLIND, pending: [], actor: null, phase: 'betting', history: [], log: [], winners: [], rng: seed >>> 0, raises: 0, showdown: false,
  };
  if (state.players.filter(player => player.inHand).length < 2 || !state.players[0].inHand) throw new Error('Start a new match when you or all opponents are out of chips.');
  if (!state.players[button].inHand) state.button = nextSeat(state.players, button);
  const seats = ordered(state, state.button, player => player.inHand);
  const headsUp = seats.length === 2;
  state.smallBlind = headsUp ? state.button : seats[0];
  state.bigBlind = nextSeat(state.players, state.smallBlind);
  const positionLabels = seats.length === 2 ? [] : ({ 1: ['CO'], 2: ['HJ', 'CO'], 3: ['UTG', 'HJ', 'CO'], 4: ['UTG', 'LJ', 'HJ', 'CO'], 5: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO'], 6: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'] }[seats.length - 3] || []);
  state.players.forEach(player => { player.position = player.inHand ? '' : 'OUT'; });
  ordered(state, state.bigBlind, player => player.inHand && ![state.button, state.smallBlind, state.bigBlind].includes(player.id)).forEach((id, index) => { state.players[id].position = positionLabels[index]; });
  state.players[state.button].position = headsUp ? 'BTN / SB' : 'BTN';
  if (!headsUp) state.players[state.smallBlind].position = 'SB';
  state.players[state.bigBlind].position = 'BB';
  state.deck = [...values].flatMap(rank => ['♠', '♥', '♣', '♦'].map(suit => [rank, suit]));
  for (let i = state.deck.length - 1; i > 0; i--) {
    const j = Math.floor(randomFor(state) * (i + 1));
    [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
  }
  state.dealOrder = [...seats, ...seats];
  state.dealOrder.forEach(id => state.players[id].cards.push(state.deck.pop()));
  for (const [id, amount, blind] of [[state.smallBlind, 1, 'small blind'], [state.bigBlind, 2, 'big blind']]) {
    const posted = pay(state, state.players[id], amount);
    note(state, `${state.players[id].name} (${state.players[id].position}) posts ${money(posted)} ${blind}${state.players[id].allIn ? ' · all-in' : ''}.`, id);
  }
  state.pending = ordered(state, state.bigBlind);
  state.actor = state.pending[0] ?? null;
  return state;
}

export function nextHand(previous) {
  if (previous.phase !== 'complete') throw new Error('Finish the current hand before dealing another.');
  return dealHand({ players: previous.players, button: nextSeat(previous.players, previous.button, player => player.stack > 0), number: previous.number + 1, seed: previous.rng });
}

export function legalActions(state, id = state.actor) {
  const player = state.players[id];
  if (state.phase !== 'betting' || id !== state.actor || !player || !able(player)) return null;
  const toCall = Math.max(0, state.currentBet - player.streetBet);
  const maxRaiseTo = player.streetBet + player.stack;
  const fullMinimum = state.currentBet === 0 ? BIG_BLIND : state.currentBet + state.minRaise;
  const reopened = player.lastActedBet === null || state.currentBet >= player.reopenAt;
  const canRaise = reopened && maxRaiseTo > state.currentBet && state.players.some(other => other.id !== id && able(other));
  return { toCall, callCost: Math.min(toCall, player.stack), canCheck: toCall === 0, canFold: toCall > 0, canRaise, minRaiseTo: Math.min(fullMinimum, maxRaiseTo), fullMinimum, maxRaiseTo, shortAllIn: maxRaiseTo < fullMinimum };
}

function finish(state, record) {
  const remaining = live(state);
  state.showdown = remaining.length > 1;
  if (state.showdown) {
    remaining.forEach(player => { player.rank = evaluate([...player.cards, ...state.board]); });
    record(state, 'showdown');
  }
  const levels = [...new Set(state.players.map(player => player.committed).filter(Boolean))].sort((a, b) => a - b);
  state.pots = [];
  state.awards = state.players.map(() => 0);
  let previous = 0;
  for (const level of levels) {
    const contributors = state.players.filter(player => player.committed >= level);
    const amount = (level - previous) * contributors.length;
    previous = level;
    if (contributors.length === 1) {
      const player = contributors[0]; player.stack += amount;
      state.pots.push({ amount, winners: [player.id], refund: true });
      note(state, `${money(amount)} uncalled chips returned to ${player.name}.`);
      continue;
    }
    const eligible = contributors.filter(player => !player.folded && player.inHand);
    let best = [-1];
    eligible.forEach(player => { if (compareRanks(player.rank || [0], best) > 0) best = player.rank || [0]; });
    const winners = eligible.filter(player => compareRanks(player.rank || [0], best) === 0);
    if (!winners.length) throw new Error('A pot must have an eligible winner.');
    const share = Math.floor(amount / winners.length);
    let odd = amount % winners.length;
    const clockwise = ordered(state, state.button, player => winners.includes(player));
    clockwise.forEach(id => {
      const award = share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
      state.players[id].stack += award;
      state.awards[id] += award;
    });
    state.pots.push({ amount, winners: winners.map(player => player.id), refund: false });
    note(state, `${winners.map(player => player.name).join(' & ')} ${winners.length > 1 ? 'split' : 'wins'} ${money(amount)}${state.pots.length > 1 ? ' side pot' : ' main pot'}.`);
  }
  state.winners = state.awards.flatMap((amount, id) => amount > 0 ? [id] : []);
  state.awarded = state.awards.reduce((sum, amount) => sum + amount, 0);
  state.pot = 0;
  state.phase = 'complete';
  state.actor = null;
  state.pending = [];
  state.result = `${state.winners.map(id => state.players[id].name).join(' & ')} awarded ${money(state.awarded)}${state.showdown ? ' at showdown' : ' · everyone else folded'}.`;
  state.players.filter(player => player.id && player.inHand).forEach(player => {
    if (!player.folded) player.bubble = state.winners.includes(player.id) ? 'A pot worth remembering. Next hand?' : 'One result. Back to the decisions.';
  });
  record(state, 'award');
}

function progress(state, record) {
  while (state.phase === 'betting') {
    if (live(state).length === 1) { finish(state, record); return; }
    state.pending = state.pending.filter(id => able(state.players[id]));
    const actors = state.players.filter(able);
    // A lone player cannot bet into a dry side pot but must still answer an owed bet.
    if (actors.length === 1 && state.players[actors[0].id].streetBet >= state.currentBet) state.pending = [];
    if (state.pending.length) { state.actor = state.pending[0]; return; }
    if (state.street === 3) { finish(state, record); return; }
    state.street++;
    state.deck.pop(); // Burn a card before each community street.
    const count = state.street === 1 ? 3 : 1;
    for (let i = 0; i < count; i++) state.board.push(state.deck.pop());
    state.currentBet = 0;
    state.minRaise = BIG_BLIND;
    state.raises = 0;
    state.players.forEach(player => { player.streetBet = 0; player.lastActedBet = null; player.reopenAt = 0; });
    note(state, `${STREETS[state.street]} dealt: ${state.board.map(card => card.join('')).join(' ')}.`);
    record(state, 'street');
    state.pending = actors.length > 1 ? ordered(state, state.button) : [];
  }
}

function apply(state, action, record) {
  const legal = legalActions(state);
  if (!legal) return false;
  const player = state.players[state.actor];
  let type = typeof action === 'string' ? action : action?.type;
  let target = action?.to;
  if (type === 'allin') {
    if (legal.maxRaiseTo <= state.currentBet) type = 'call';
    else { type = 'raise'; target = legal.maxRaiseTo; }
  }
  if (type === 'check' && !legal.canCheck || type === 'fold' && !legal.canFold || type === 'call' && !legal.toCall) return false;
  if (!['check', 'call', 'fold', 'raise'].includes(type)) return false;
  if (type === 'raise' && (!legal.canRaise || !Number.isInteger(target) || target > legal.maxRaiseTo || target <= state.currentBet || target < legal.fullMinimum && target !== legal.maxRaiseTo)) return false;
  state.pending.shift();
  let amount = 0;
  if (type === 'fold') player.folded = true;
  if (type === 'call') amount = pay(state, player, legal.callCost);
  if (type === 'raise') {
    const previousBet = state.currentBet;
    amount = pay(state, player, target - player.streetBet);
    state.currentBet = target;
    if (target - previousBet >= state.minRaise) state.minRaise = target - previousBet;
    state.raises++;
    state.pending = ordered(state, player.id).filter(id => state.players[id].streetBet < state.currentBet || state.pending.includes(id));
  }
  player.lastActedBet = state.currentBet;
  player.reopenAt = state.currentBet + state.minRaise;
  player.stats.actions++;
  if (type === 'fold') player.stats.folds++;
  if (type === 'call') player.stats.calls++;
  if (type === 'raise') player.stats.raises++;
  const label = type === 'raise' ? `${legal.toCall || state.street === 0 ? 'raises' : 'bets'} to ${money(target)}` : type === 'call' ? `calls ${money(amount)}` : `${type}s`;
  note(state, `${player.name} (${player.position}) ${label}${player.allIn ? ' · all-in' : ''}.`, player.id);
  if (player.id) {
    const profile = profileFor(player.archetype);
    const lines = { fold: profile.threshold > .7 ? 'Patience. Another hand will come.' : 'Not this time. Keep those chips warm.', check: profile.trap > .3 ? 'A quiet move can still tell a story.' : 'Let’s see what happens next.', call: profile.stickiness > .8 ? 'I do like to see how the story ends.' : 'That price deserves a look.', raise: profile.aggression > .8 ? 'Your move. Let’s make it interesting.' : 'I have a reason to put chips in.' };
    player.bubble = lines[type];
  }
  record(state, type, player.id, amount);
  progress(state, record);
  return true;
}

export function act(previous, action) {
  const state = structuredClone(previous);
  return apply(state, action, () => {}) ? state : previous;
}

// Deliberately omit deck, opponents' hole cards, and future community cards.
export function decisionView(state, id = state.actor) {
  const player = state.players[id];
  return {
    id, cards: player.cards, archetype: player.archetype, position: player.position,
    board: state.board, street: state.street, pot: state.pot, raises: state.raises,
    currentBet: state.currentBet, streetBet: player.streetBet, legal: legalActions(state, id),
    opponents: state.players.filter(other => other.id !== id && other.inHand && !other.folded).map(other => ({ stack: other.stack, stats: { ...other.stats } })),
  };
}

export function preflopStrength(cards) {
  const [high, low] = cards.map(card => values.indexOf(card[0]) + 2).sort((a, b) => b - a);
  if (high === low) return .52 + high / 14 * .48;
  const gap = high - low;
  return Math.max(0, Math.min(.99, (high + low - 4) / 24 * .65 + (high === 14 ? .12 : 0) + (cards[0][1] === cards[1][1] ? .07 : 0) + (gap <= 2 ? .06 : gap >= 5 ? -.05 : 0)));
}

export function chooseBotAction(view, roll = Math.random()) {
  const profile = profileFor(view.archetype);
  const legal = view.legal;
  if (!legal) return null;
  const rank = view.street ? evaluate([...view.cards, ...view.board]) : null;
  let strength = view.street ? [ .12, .34, .70, .79, .86, .91, .96, .99, 1 ][rank[0]] + (rank[0] <= 1 ? (rank[1] || 2) / 14 * .23 : 0) : preflopStrength(view.cards);
  const suitedCount = [...view.cards, ...view.board].reduce((counts, card) => ({ ...counts, [card[1]]: (counts[card[1]] || 0) + 1 }), {});
  const draw = view.street > 0 && view.street < 3 && Object.values(suitedCount).includes(4);
  if (draw) strength += .10;
  const connected = view.cards[0][0] === view.cards[1][0] || view.cards.some(card => view.board.some(board => board[0] === card[0])) || rank?.[0] >= 4 || draw;
  const price = legal.callCost / Math.max(1, view.pot + legal.callCost);
  let bluff = profile.bluff;
  let aggression = profile.aggression;
  let threshold = view.street ? .32 + price * .40 + (1 - profile.stickiness) * .18 : profile.threshold + price * .12 + Math.min(view.raises, 3) * .025 - (['BTN', 'BTN / SB', 'CO'].includes(view.position) ? .045 : 0);
  if (view.archetype === 'exploit') {
    const observed = view.opponents.filter(other => other.stats.actions >= 3);
    if (observed.some(other => other.stats.folds / other.stats.actions > .45)) bluff *= 2;
    if (observed.some(other => other.stats.calls / other.stats.actions > .5)) { bluff *= .2; aggression += strength > .6 ? .2 : 0; }
    if (observed.some(other => other.stats.raises / other.stats.actions > .5)) threshold -= .08;
  }
  if (view.archetype === 'gto') {
    // Mixed heuristic actions, not a claim to solve an equilibrium strategy.
    threshold += (roll - .5) * .08;
  }
  const fitFold = view.archetype === 'fitfold' && view.street > 0 && !connected;
  const wantsTrap = strength > .78 && roll < profile.trap;
  const pressure = bluff / (1 + view.raises * 1.4);
  const strong = strength > (view.street ? .76 : .86);
  const raise = legal.canRaise && !wantsTrap && !fitFold && (strong && roll < aggression / (1 + view.raises * .4) || !legal.toCall && strength >= threshold && roll < aggression || roll > 1 - pressure);
  if (raise) {
    const desired = view.street === 0 ? Math.max(5, view.currentBet * 3) : view.streetBet + legal.toCall + Math.ceil((view.pot + legal.toCall) * (profile.aggression > .8 ? .8 : .55));
    return { type: 'raise', to: Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, desired)) };
  }
  if (!legal.toCall) return 'check';
  if (!fitFold && (strength >= threshold || roll < profile.stickiness * (view.street ? .40 : .18))) return 'call';
  return 'fold';
}

function runBots(state, record) {
  progress(state, record);
  let turns = 0;
  while (state.phase === 'betting' && state.actor !== 0) {
    if (++turns > 2000) throw new Error('Unexpected betting loop.');
    const id = state.actor;
    record(state, 'thinking', id);
    const action = chooseBotAction(decisionView(state), randomFor(state));
    if (!apply(state, action, record)) throw new Error('A bot selected an illegal action.');
  }
}

function plan(previous, action, opening) {
  const state = structuredClone(previous);
  const frames = [];
  const record = (hand, event, actor = null, amount = 0) => frames.push({ hand: structuredClone(hand), event, actor, amount });
  if (!opening && (state.actor !== 0 || !apply(state, action, record))) return [];
  runBots(state, record);
  if (!frames.length) return [];
  if (state.phase !== 'complete') record(state, 'ready', 0);
  return frames;
}
export const planAction = (previous, action) => plan(previous, action, false);
export const planOpening = previous => plan(previous, null, true);
export const personalities = [
  { id: 'fox', name: 'Blaze', title: 'The pressure player', avatar: '🦊', colour: 'orange', intro: 'A little pressure makes things interesting.', bet: 'You checked? I found a reason to bet.', call: 'I’m not letting you push me around.', fold: 'Fine. I’ll find a better spot.', win: 'Pressure and a little timing. Lovely.', lose: 'You got this one. I’m still here.' },
  { id: 'owl', name: 'Professor', title: 'The patient thinker', avatar: '🦉', colour: 'purple', intro: 'Let’s make every decision count.', bet: 'There may be value in this position.', call: 'The price deserves a closer look.', fold: 'Discipline is also a decision.', win: 'An interesting result. On to the next.', lose: 'A result to review, not to regret.' },
  { id: 'panda', name: 'Mochi', title: 'The curious caller', avatar: '🐼', colour: 'teal', intro: 'I came for the cards. Stayed for the river.', bet: 'Maybe it’s my turn to ask a question.', call: 'One more look? Don’t mind if I do.', fold: 'Even curiosity has a limit.', win: 'Oh! That worked out rather nicely.', lose: 'Well, at least I got to see it.' },
];


export const tellQuestions = [
  { bot: 0, line: 'You checked again? I might have to make this pot a little bigger.', question: 'Blaze applies pressure often. Which adjustment is most sensible?', options: ['Assume every bet is a bluff', 'Consider a wider range, then weigh the board and price', 'Raise every hand to win it back'], answer: 1, explanation: 'A frequent bettor can have a wider range. That is a reason to examine the situation, not to assume a bluff or call automatically.' },
  { bot: 1, line: 'I have passed on plenty of spots. This one deserves a bigger bet.', question: 'Professor has been selective and now bets big. What should you do?', options: ['Ignore the betting pattern', 'Fold everything, including the nuts', 'Reassess the likely range and your pot odds'], answer: 2, explanation: 'A selective opponent’s aggression is useful information. Combine it with hand strength and the price; a personality never proves what they hold.' },
  { bot: 2, line: 'A pair? A draw? I do like to see how the story ends.', question: 'Mochi calls frequently. What is a reasonable adjustment?', options: ['Value-bet hands weaker holdings can call', 'Bluff every river regardless of the board', 'Stop betting your strong hands'], answer: 0, explanation: 'An opponent who calls too widely may pay off more value bets. Still consider the board and what worse hands can actually continue.' },
];
