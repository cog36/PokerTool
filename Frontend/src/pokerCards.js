// Shared card ranking for game settlement and sampled chip-EV decisions.
export const values = '23456789TJQKA';
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

