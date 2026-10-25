import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnalysis } from './analysisReport.js';
test('older API responses do not invent decision grades or crash on missing fields', () => {
 const report = normalizeAnalysis({ filename: 'old.txt', hands: [{ matrix_key: 'AKs', severity: 'NONE' }] });
 assert.equal(report.total_hands_analyzed, 1);
 assert.equal(report.decisions_scored, 0);
 assert.equal(report.decisions_unscored, 1);
 assert.equal(report.hands[0].analysis_source, 'UNAVAILABLE');
 assert.equal(report.hands[0].decision_assessment, 'UNASSESSED');
 assert.deepEqual(report.hands[0].actions_before_hero, []);
 assert.deepEqual(report.hands[0].action_timeline, []);
 assert.equal(report.hands[0].decision_action_index, null);
 assert.deepEqual(report.hands[0].street_boards, {});
 assert.equal(report.hands[0].big_blind, null);
 assert.equal(report.leak_breakdown.played_weak_hands, null);
 assert.equal(report.hands[0].net_profit, null);
});
test('normalizes street action context and blind values for BB display', () => {
 const report = normalizeAnalysis({
  hands: [{
   big_blind: 20,
   action_timeline: [{ street: 'Preflop', player: 'bullets685', position: 'BTN', action: 'raise', text: 'raises 1.75bb to 2.75bb' }],
   decision_action_index: 0,
   street_boards: { Flop: 'As Kd Qc', Turn: 'As Kd Qc 6h', River: 'As Kd Qc 6h 2s' },
  }],
 });
 assert.equal(report.hands[0].big_blind, 20);
 assert.equal(report.hands[0].action_timeline[0].text, 'raises 1.75bb to 2.75bb');
 assert.equal(report.hands[0].street_boards.Turn.split(' ').length, 4);
 assert.equal(report.hands[0].street_boards.River.split(' ').length, 5);
});
test('current hand assessments determine consistent summary counts', () => {
 const report = normalizeAnalysis({ hands: [{ decision_assessment: 'CORRECT', analysis_source: 'CHART' }, { decision_assessment: 'INCORRECT', analysis_source: 'LEGACY_LOGIC' }, { decision_assessment: 'UNASSESSED', analysis_source: 'CHART' }] });
 assert.equal(report.decisions_scored, 2);
 assert.equal(report.total_mistakes_detected, 1);
 assert.equal(report.decisions_unscored, 1);
 assert.equal(report.legacy_logic_hands, 1);
 assert.equal(report.incomplete, false);
});
test('invalid or empty hand data is rejected before updating the screen', () => {
 for (const value of [null, {}, { hands: [] }, { hands: [null, 4, []] }]) assert.equal(normalizeAnalysis(value), null);
});
