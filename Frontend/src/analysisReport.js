// Normalize at the API boundary. Older running servers may omit chart metadata;
// missing assessments stay unassessed instead of becoming invented successes.
const text = (value, fallback = 'Not available') => typeof value === 'string' && value.trim() ? value : fallback;
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function normalizeAnalysis(data) {
  if (!data || !Array.isArray(data.hands)) return null;
  const hands = data.hands.filter(hand => hand && typeof hand === 'object' && !Array.isArray(hand)).map(hand => ({
    ...hand,
    decision_assessment: ['CORRECT', 'INCORRECT', 'UNASSESSED'].includes(hand.decision_assessment) ? hand.decision_assessment : 'UNASSESSED',
    severity: ['CRITICAL', 'MAJOR', 'MINOR', 'NONE'].includes(hand.severity) ? hand.severity : 'UNASSESSED',
    analysis_source: ['CHART', 'LEGACY_LOGIC'].includes(hand.analysis_source) ? hand.analysis_source : 'UNAVAILABLE',
    matrix_key: text(hand.matrix_key), position: text(hand.position), hand_id: text(hand.hand_id),
    deviation_type: text(hand.deviation_type), feedback: text(hand.feedback, 'No feedback was returned for this hand.'),
    raw_cards: text(hand.raw_cards), facing_action: text(hand.facing_action), recommended_action: text(hand.recommended_action),
    stack_depth_bb: finite(hand.stack_depth_bb) ? hand.stack_depth_bb : 'Unknown',
    chart_stack_bb: finite(hand.chart_stack_bb) ? hand.chart_stack_bb : 'Unknown',
    net_profit: finite(hand.net_profit) ? hand.net_profit : null,
    board: text(hand.board, 'No board'),
    actions_before_hero: Array.isArray(hand.actions_before_hero) ? hand.actions_before_hero.filter(action => action && typeof action === 'object').map(action => ({ ...action, position: text(action.position), action: text(action.action) })) : [],
  }));
  if (!hands.length) return null;
  return {
    ...data, hands, filename: text(data.filename, 'Uploaded history'),
    total_hands_analyzed: hands.length,
    decisions_scored: hands.filter(hand => hand.decision_assessment !== 'UNASSESSED').length,
    decisions_unscored: hands.filter(hand => hand.decision_assessment === 'UNASSESSED').length,
    total_mistakes_detected: hands.filter(hand => hand.decision_assessment === 'INCORRECT').length,
    legacy_logic_hands: hands.filter(hand => hand.analysis_source === 'LEGACY_LOGIC').length,
    incomplete: hands.some(hand => hand.analysis_source === 'UNAVAILABLE'),
    leak_breakdown: Object.fromEntries(['played_weak_hands', 'folded_playable_hands', 'passive_calls_on_premiums'].map(key => [key, finite(data.leak_breakdown?.[key]) && data.leak_breakdown[key] >= 0 ? data.leak_breakdown[key] : null])),
  };
}
