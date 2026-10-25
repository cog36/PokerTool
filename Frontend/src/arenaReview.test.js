import test from 'node:test';
import assert from 'node:assert/strict';
import { canSkipReviewedHand, reviewMessage } from './arenaReview.js';

test('correct continuing actions keep the player in the current hand', () => {
  for (const type of ['call', 'raise', 'check']) assert.equal(canSkipReviewedHand({ assessment: 'CORRECT', type }), false);
  assert.equal(canSkipReviewedHand({ assessment: 'CORRECT', type: 'fold' }), true);
  assert.equal(canSkipReviewedHand({ assessment: 'INCORRECT', type: 'call' }), true);
});
test('reviews explain moves without exposing evaluation plumbing', () => {
  assert.equal(reviewMessage({ text: 'Chart unavailable — using legacy analysis logic. Pays 2bb.' }), 'Pays 2bb.');
  const review = { type: 'call', label: 'Call', assessment: 'INCORRECT', chart: { frequencies: { FOLD: 1, CALL: 0 } } };
  assert.equal(reviewMessage(review), 'Consider fold instead in this situation.');
  assert.equal(reviewMessage({ ...review, type: 'fold', label: 'Fold', assessment: 'CORRECT' }), 'Fold is a good option here.');
});
