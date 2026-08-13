import test from 'node:test';
import assert from 'node:assert/strict';
import { FACES, isFace, reactionsForRound } from '../src/reactions.js';

// --- isFace --------------------------------------------------------------
// This is the whole validation surface for the endpoint, so it has to reject
// everything that is not literally one of the seven.

test('every declared face is accepted', () => {
  for (const f of FACES) assert.equal(isFace(f), true, f);
});

test('anything not in the set is refused', () => {
  for (const bad of ['angry', 'HAPPY', 'happy ', '', 'sad;drop table', '__proto__', 'toString']) {
    assert.equal(isFace(bad), false, bad);
  }
});

test('non-strings are refused rather than coerced', () => {
  for (const bad of [null, undefined, 0, 1, {}, [], ['happy'], true]) {
    assert.equal(isFace(bad), false, String(bad));
  }
});

// --- reactionsForRound ---------------------------------------------------

/** Minimal stand-in for the D1 binding: one prepare().bind().all(). */
const fakeDb = (rows) => ({
  prepare: () => ({ bind: () => ({ all: async () => ({ results: rows }) }) }),
});

test('counts group by entry, and mine lists only my own faces', async () => {
  const out = await reactionsForRound(fakeDb([
    { sid: 's1', face: 'happy', n: 3, mine: 1 },
    { sid: 's1', face: 'sad', n: 1, mine: 0 },
    { sid: 's2', face: 'love', n: 2, mine: 1 },
  ]), 'r1', 'u1');

  assert.deepEqual(out.s1.counts, { happy: 3, sad: 1 });
  assert.deepEqual(out.s1.mine, ['happy']);
  assert.deepEqual(out.s2.counts, { love: 2 });
  assert.deepEqual(out.s2.mine, ['love']);
});

test('an entry nobody reacted to is simply absent', async () => {
  const out = await reactionsForRound(fakeDb([]), 'r1', 'u1');
  assert.deepEqual(out, {});
});

test('faces sort by count, so the pills do not reshuffle between refreshes', async () => {
  const out = await reactionsForRound(fakeDb([
    { sid: 's1', face: 'sad', n: 1, mine: 0 },
    { sid: 's1', face: 'dizzy', n: 9, mine: 0 },
    { sid: 's1', face: 'love', n: 4, mine: 0 },
  ]), 'r1', 'u1');
  assert.deepEqual(Object.keys(out.s1.counts), ['dizzy', 'love', 'sad']);
});

test('a tie breaks by canonical face order, not by whatever D1 returned', async () => {
  const rows = [
    { sid: 's1', face: 'dizzy', n: 2, mine: 0 },
    { sid: 's1', face: 'happy', n: 2, mine: 0 },
  ];
  const forward = await reactionsForRound(fakeDb(rows), 'r1', 'u1');
  const reversed = await reactionsForRound(fakeDb([...rows].reverse()), 'r1', 'u1');
  // happy precedes dizzy in FACES, so both orderings must agree.
  assert.deepEqual(Object.keys(forward.s1.counts), ['happy', 'dizzy']);
  assert.deepEqual(Object.keys(reversed.s1.counts), ['happy', 'dizzy']);
});
