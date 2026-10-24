import { evaluateHeroPreflop } from './preflopCharts.js';
// Public-information coaching: explain the price and action, never an opponent's
// hidden holding. These observations are immediate heuristics, not solver grades.
const format = chips => Number((chips / 2).toFixed(2));
export function actionFeedback(before, after, actor) {
  const player = after.players[actor];
  const action = player.lastAction;
  const prior = before.players[actor];
  const cost = Math.min(prior.stack, Math.max(0, before.currentBet - prior.streetBet));
  const cap = prior.committed + cost;
  const eligiblePot = before.players.reduce((total, other) => total + Math.min(cap, other.committed), 0) + cost;
  const odds = Math.round(cost / Math.max(1, eligiblePot) * 100);
  let text;
  if (action.type === 'fold') text = cost
    ? `Saves ${format(cost)}bb. Continuing would need roughly ${odds}% equity before future betting; folding alone doesn't prove the hand was weak.`
    : 'Gives up a free check. Checking would preserve the chance to win without committing more chips.';
  if (action.type === 'check') text = 'Keeps the pot controlled at no extra cost. A check can protect a weak hand or disguise strength; watch the next action.';
  if (action.type === 'call') text = `Pays ${format(action.amount)}bb and needs roughly ${odds}% equity against the eligible pot before future betting. Price alone does not make a call profitable.`;
  if (action.type === 'raise') {
    const extra = Math.max(0, action.amount - cost);
    const potAfterCall = before.pot + cost;
    const fraction = Math.round(extra / Math.max(1, potAfterCall) * 100);
    text = `${action.label} to ${format(action.total)}bb puts pressure on the remaining players. The raise adds ${format(extra)}bb beyond calling (${fraction}% of the pot after a call); it needs value or enough folds.`;
  }
  const chart = actor === 0 && before.street === 0 ? evaluateHeroPreflop(before, after) : null;
  const fallback = chart?.assessment === 'UNASSESSED';
  if (chart && !fallback) text = chart.text;
  if (fallback) text = `Chart unavailable — using legacy analysis. ${text}`;
  // Keep the key independent of timing so replay/skip can't duplicate a review.
  return { id: `${after.number}-${after.history.length}-${actor}`, actor, name: actor === 0 ? 'You' : player.name, position: player.position, type: action.type, label: action.label, street: after.street, text, source: chart && !fallback ? 'CHART' : 'LEGACY_LOGIC', fallback, fallbackReason: fallback ? chart.text : null, chart };
}
