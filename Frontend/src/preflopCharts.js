import chart5 from '../../charts/MTT_5_GTO.json' with { type: 'json' };
import chart10 from '../../charts/MTT_10_GTO.json' with { type: 'json' };
import chart20 from '../../charts/MTT_20_GTO.json' with { type: 'json' };
import chart40 from '../../charts/MTT_40_GTO.json' with { type: 'json' };
import chart100 from '../../charts/MTT_100_GTO.json' with { type: 'json' };

const charts = { 5: chart5, 10: chart10, 20: chart20, 40: chart40, 100: chart100 };
const ranks = '23456789TJQKA';
export function canonicalHand(cards) {
  const [high, low] = [...cards].sort((a, b) => ranks.indexOf(b[0]) - ranks.indexOf(a[0]));
  return high[0] === low[0] ? high[0] + low[0] : high[0] + low[0] + (high[1] === low[1] ? 's' : 'o');
}

// Charts use nine-handed position names. Remove earliest positions as seats
// disappear, just as the hand-history parser does: 8-max UTG = EP2, UTG+1 = EP3.
function chartPosition(state, id) {
  const player = state.players[id];
  if (['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'].includes(player.position)) return player.position;
  const count = state.players.filter(other => other.inHand).length;
  const early = ['EP1', 'EP2', 'EP3', 'LJ', 'HJ', 'CO'].slice(-(count - 3));
  const offset = { UTG: 0, 'UTG+1': 1, 'UTG+2': 2 }[player.position];
  return offset === undefined ? null : early[offset];
}

export function evaluateHeroPreflop(before, after) {
  const hero = before.players[0];
  const depth = before.stackDepthBB ?? before.startingStacks?.[0] / 2;
  const chart = charts[depth];
  const matrixKey = canonicalHand(hero.cards);
  const position = chartPosition(before, 0);
  const result = { source: 'CHART', assessment: 'UNASSESSED', depth, position, matrixKey, frequencies: null, actionFrequency: null };
  const unavailable = reason => ({ ...result, text: `Preflop chart: unassessed. ${reason}` });
  if (!chart || !position) return unavailable('No exact chart depth or position matches this hand.');
  const actions = before.history.filter(entry => entry.street === 'Preflop' && ['fold', 'call', 'check', 'raise'].includes(entry.action));
  // The supplied pairwise charts do not describe limped or squeezed multiway pots.
  if (actions.some(entry => entry.action === 'call')) return unavailable('The supplied charts do not cover this limped or multiway calling sequence.');
  const raises = actions.filter(entry => entry.action === 'raise');
  const last = raises.at(-1);
  const villainPosition = last ? chartPosition(before, last.actor) : null;
  if (raises.length > 4 || last?.actor === 0) return unavailable('No matching action sequence is supplied.');
  if (raises.length >= 2 && raises.at(-2).actor !== 0) return unavailable('No matching chart for this cold-reraise sequence.');
  let keys;
  if (!raises.length) keys = [['RAISE', `Open${position}`], ['LIMP', `Limp${position}`]];
  else if (raises.length === 1) keys = [['CALL', `Call${position}vs${villainPosition}`], ['RAISE', `3Bet${position}vs${villainPosition}`]];
  else keys = [['CALL', `Call ${raises.length + 1}Bet${position}vs${villainPosition}`], ['RAISE', `${raises.length + 2}Bet${position}vs${villainPosition}`]];
  if (keys.some(([, key]) => !chart[key])) return unavailable('The required action tables are not included for this position matchup.');
  const frequencies = Object.fromEntries(keys.map(([action, key]) => [action, Number(chart[key][matrixKey] ?? 0)]));
  const sum = Object.values(frequencies).reduce((total, value) => total + value, 0);
  if (Object.values(frequencies).some(value => !Number.isFinite(value) || value < 0 || value > 1) || sum > 1.000001) return unavailable('This chart entry has inconsistent action frequencies.');
  frequencies.FOLD = Math.max(0, 1 - sum);
  const played = after.players[0].lastAction;
  const action = played.type === 'call' && !raises.length ? 'LIMP' : played.type.toUpperCase();
  if (!(action in frequencies)) return unavailable('The chart does not evaluate a free check in this situation.');
  const actionFrequency = frequencies[action];
  const assessment = actionFrequency > 0.000001 ? 'APPROVED' : 'NOT_RECOMMENDED';
  const options = Object.entries(frequencies).filter(([, value]) => value > 0.000001).map(([name, value]) => `${name.toLowerCase()} ${Number((value * 100).toFixed(1))}%`).join(', ');
  return { ...result, assessment, frequencies, actionFrequency, keys: keys.map(([, key]) => key),
    text: `${depth}bb chart · ${matrixKey} · ${position}: ${action.toLowerCase()} ${Number((actionFrequency * 100).toFixed(1))}% — ${assessment === 'APPROVED' ? 'chart-approved' : 'not recommended'}. Chart mix: ${options}. Action category only; bet size is not graded.` };
}
