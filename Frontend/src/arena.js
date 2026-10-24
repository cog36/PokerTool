// A deliberately bounded river game: no raises, side pots, rake, or real money.
// Bots see their own cards and the board, never the hero's hidden cards.
export const personalities = [
  { id: 'fox', name: 'Blaze', title: 'The pressure player', avatar: '🦊', colour: 'orange', intro: 'A little pressure makes things interesting.', bet: 'You checked? I found a reason to bet.', call: 'I’m not letting you push me around.', fold: 'Fine. I’ll find a better spot.', win: 'Pressure and a little timing. Lovely.', lose: 'You got this one. I’m still here.' },
  { id: 'owl', name: 'Professor', title: 'The patient thinker', avatar: '🦉', colour: 'purple', intro: 'Let’s make every decision count.', bet: 'There may be value in this position.', call: 'The price deserves a closer look.', fold: 'Discipline is also a decision.', win: 'An interesting result. On to the next.', lose: 'A result to review, not to regret.' },
  { id: 'panda', name: 'Mochi', title: 'The curious caller', avatar: '🐼', colour: 'teal', intro: 'I came for the cards. Stayed for the river.', bet: 'Maybe it’s my turn to ask a question.', call: 'One more look? Don’t mind if I do.', fold: 'Even curiosity has a limit.', win: 'Oh! That worked out rather nicely.', lose: 'Well, at least I got to see it.' },
];

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

export function dealHand(stacks = [100, 100, 100, 100], number = 1, random = Math.random) {
  const deck = [...values].flatMap(rank => ['♠', '♥', '♣', '♦'].map(suit => [rank, suit]));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const players = stacks.map((stack, index) => ({
    id: index, name: index === 0 ? 'You' : personalities[index - 1].name,
    stack: stack - 3, cards: deck.splice(0, 2), folded: false,
    // The random tendency is fixed at deal time, so rerenders never reroll a decision.
    tendency: random(), bubble: index ? personalities[index - 1].intro : '',
  }));
  return { players, board: deck.splice(0, 5), pot: 12, phase: 'player', bet: 0, bettor: null, number, log: ['Each player contributed 3bb to this sample river pot. You act first.'], winners: [] };
}

function willCall(player, board, amount) {
  const rank = evaluate([...player.cards, ...board]);
  const type = player.id;
  if (rank[0] >= 2) return true;
  if (type === 1) return rank[0] >= 1 || player.tendency > (amount === 8 ? 0.8 : 0.65);
  if (type === 2) return rank[0] >= 1 && rank[1] >= (amount === 8 ? 12 : 10);
  return rank[0] >= 1 || player.tendency > (amount === 8 ? 0.65 : 0.35);
}

function pay(state, id, amount) {
  state.players[id].stack -= amount;
  state.pot += amount;
}

function respond(state, amount, skip = null, record = () => {}) {
  state.players.slice(1).forEach(player => {
    if (player.id === skip) return;
    const persona = personalities[player.id - 1];
    record(state, 'thinking', player.id);
    if (willCall(player, state.board, amount)) {
      pay(state, player.id, amount); player.bubble = persona.call;
      state.log.push(`${player.name} calls ${amount}bb.`);
      record(state, 'call', player.id, amount);
    } else {
      player.folded = true; player.bubble = persona.fold;
      state.log.push(`${player.name} folds.`);
      record(state, 'fold', player.id);
    }
  });
}

function settle(state, record = () => {}) {
  record(state, 'showdown');
  const contenders = state.players.filter(player => !player.folded);
  let best = [-1];
  contenders.forEach(player => {
    player.rank = evaluate([...player.cards, ...state.board]);
    if (compareRanks(player.rank, best) > 0) best = player.rank;
  });
  const winners = contenders.filter(player => compareRanks(player.rank, best) === 0);
  const share = state.pot / winners.length;
  winners.forEach(player => { player.stack += share; });
  state.winners = winners.map(player => player.id);
  state.awarded = state.pot;
  state.pot = 0;
  state.phase = 'complete';
  state.result = `${winners.map(player => player.name).join(' & ')} ${winners.length > 1 ? 'split' : 'wins'} ${state.awarded}bb${contenders.length > 1 ? ` · ${handLabels[best[0]]}` : ' · everyone else folded'}.`;
  state.players.slice(1).forEach(player => {
    if (!player.folded) player.bubble = personalities[player.id - 1][state.winners.includes(player.id) ? 'win' : 'lose'];
  });
  state.log.push(state.result);
  return state;
}

export function act(previous, action, record = () => {}) {
  const legal = previous.phase === 'player' ? ['check', 'bet4', 'bet8'] : previous.phase === 'facing' ? ['call', 'fold'] : [];
  if (!legal.includes(action)) return previous;
  const state = { ...previous, players: previous.players.map(player => ({ ...player })), log: [...previous.log] };
  if (action === 'check') {
    state.log.push('You check.');
    record(state, 'check', 0);
    const bettor = state.players.slice(1).find(player => {
      const rank = evaluate([...player.cards, ...state.board]);
      return rank[0] >= 2 || (player.id === 1 && player.tendency > 0.45);
    });
    if (!bettor) {
      state.players.slice(1).forEach(player => {
        record(state, 'thinking', player.id);
        player.bubble = ['I’ll let this one breathe.', 'A check is a decision too.', 'Let’s see those cards.'][player.id - 1];
        state.log.push(`${player.name} checks.`);
        record(state, 'check', player.id);
      });
      return settle(state, record);
    }
    record(state, 'thinking', bettor.id);
    state.bet = 4; state.bettor = bettor.id; state.phase = 'facing';
    pay(state, bettor.id, 4);
    bettor.bubble = personalities[bettor.id - 1].bet;
    state.log.push(`${bettor.name} bets 4bb. Your decision: call or fold. Other responses resolve after yours.`);
    record(state, 'bet', bettor.id, 4);
    return state;
  }
  if (action === 'bet4' || action === 'bet8') {
    const amount = action === 'bet4' ? 4 : 8;
    pay(state, 0, amount); state.log.push(`You bet ${amount}bb.`);
    record(state, 'bet', 0, amount);
    respond(state, amount, null, record);
  } else {
    if (action === 'call') { pay(state, 0, state.bet); state.log.push(`You call ${state.bet}bb.`); }
    else { state.players[0].folded = true; state.log.push('You fold.'); }
    record(state, action, 0, action === 'call' ? state.bet : 0);
    respond(state, state.bet, state.bettor, record);
  }
  return settle(state, record);
}

// Presentation frames are independent snapshots: the UI can animate without changing rules.
export function planAction(previous, action) {
  const frames = [];
  const next = act(previous, action, (state, event, actor = null, amount = 0) => {
    frames.push({ hand: structuredClone(state), event, actor, amount });
  });
  if (next !== previous) frames.push({ hand: next, event: next.phase === 'complete' ? 'award' : 'ready', actor: null, amount: 0 });
  return frames;
}

export const tellQuestions = [
  { bot: 0, line: 'You checked again? I might have to make this pot a little bigger.', question: 'Blaze applies pressure often. Which adjustment is most sensible?', options: ['Assume every bet is a bluff', 'Consider a wider range, then weigh the board and price', 'Raise every hand to win it back'], answer: 1, explanation: 'A frequent bettor can have a wider range. That is a reason to examine the situation, not to assume a bluff or call automatically.' },
  { bot: 1, line: 'I have passed on plenty of spots. This one deserves a bigger bet.', question: 'Professor has been selective and now bets big. What should you do?', options: ['Ignore the betting pattern', 'Fold everything, including the nuts', 'Reassess the likely range and your pot odds'], answer: 2, explanation: 'A selective opponent’s aggression is useful information. Combine it with hand strength and the price; a personality never proves what they hold.' },
  { bot: 2, line: 'A pair? A draw? I do like to see how the story ends.', question: 'Mochi calls frequently. What is a reasonable adjustment?', options: ['Value-bet hands weaker holdings can call', 'Bluff every river regardless of the board', 'Stop betting your strong hands'], answer: 0, explanation: 'An opponent who calls too widely may pay off more value bets. Still consider the board and what worse hands can actually continue.' },
];
