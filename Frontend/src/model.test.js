import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRange, initialSession, scoreAnswer, validNotes } from './model.js';

test('each position has all 169 unique categories and expands towards the button', () => {
  const counts = ['UTG', 'CO', 'BTN'].map(position => {
    const cells = buildRange(position);
    assert.equal(cells.length, 169);
    assert.equal(new Set(cells.map(cell => cell.hand)).size, 169);
    assert.equal(cells.filter(cell => cell.hand.length === 2).length, 13);
    assert.equal(cells.find(cell => cell.hand === 'AA').action, 'raise');
    return cells.filter(cell => cell.action === 'raise').length;
  });
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
});

test('answers update accuracy inputs and reset the streak after a miss', () => {
  const first = scoreAnswer(initialSession, true);
  const second = scoreAnswer(first, true);
  assert.deepEqual(scoreAnswer(second, false), { attempts: 3, correct: 2, streak: 0 });
  assert.deepEqual(initialSession, { attempts: 0, correct: 0, streak: 0 });
});

test('stored notes reject malformed data and impossible dates', () => {
  const note = { id: 'one', title: 'Study', body: 'Position matters', category: 'Position', date: 1 };
  assert.deepEqual(validNotes([note, null, { ...note, date: Infinity }, { ...note, date: 9e15 }]), [note]);
  assert.deepEqual(validNotes({}), []);
});
