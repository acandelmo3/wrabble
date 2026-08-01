import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreRound, POINTS } from '../src/scoring.js';

const members = ['alice', 'bob', 'carol'];
const subs = [
  { id: 's1', user_id: 'alice' },
  { id: 's2', user_id: 'bob' },
  { id: 's3', user_id: 'carol' },
];
const pointsFor = (rows, id) => rows.find((r) => r.user_id === id)?.points ?? 0;
const breakdownFor = (rows, id) => rows.find((r) => r.user_id === id)?.breakdown ?? {};

test('everyone in the group appears, even with no play', () => {
  const rows = scoreRound({
    submissions: [], guesses: [], promptGuesses: [], promptAuthorId: null, memberIds: members,
  });
  assert.equal(rows.length, 3);
  assert.equal(pointsFor(rows, 'alice'), 0);
});

test('submitting earns participation', () => {
  const rows = scoreRound({
    submissions: subs, guesses: [], promptGuesses: [], promptAuthorId: null, memberIds: members,
  });
  assert.equal(pointsFor(rows, 'alice'), POINTS.submitted);
});

test('a correct guess scores the guesser, not the author', () => {
  const rows = scoreRound({
    submissions: subs,
    guesses: [{ guesser_id: 'alice', submission_id: 's2', guessed_user_id: 'bob' }],
    promptGuesses: [], promptAuthorId: null, memberIds: members,
  });
  assert.equal(breakdownFor(rows, 'alice').correctGuess, POINTS.correctGuess);
  assert.equal(breakdownFor(rows, 'bob').correctGuess, undefined);
  assert.equal(breakdownFor(rows, 'bob').fooledSomeone, undefined);
});

test('a wrong guess pays the author who fooled them', () => {
  const rows = scoreRound({
    submissions: subs,
    guesses: [{ guesser_id: 'alice', submission_id: 's2', guessed_user_id: 'carol' }],
    promptGuesses: [], promptAuthorId: null, memberIds: members,
  });
  assert.equal(breakdownFor(rows, 'bob').fooledSomeone, POINTS.fooledSomeone);
  assert.equal(breakdownFor(rows, 'alice').correctGuess, undefined);
  // The wrongly-named player gets nothing for being name-dropped.
  assert.equal(breakdownFor(rows, 'carol').fooledSomeone, undefined);
});

test('guessing your own entry scores nothing either way', () => {
  const rows = scoreRound({
    submissions: subs,
    guesses: [{ guesser_id: 'alice', submission_id: 's1', guessed_user_id: 'alice' }],
    promptGuesses: [], promptAuthorId: null, memberIds: members,
  });
  // Only the participation points survive.
  assert.equal(pointsFor(rows, 'alice'), POINTS.submitted + POINTS.guessed);
});

test('participation for guessing is granted once, not per guess', () => {
  const rows = scoreRound({
    submissions: subs,
    guesses: [
      { guesser_id: 'alice', submission_id: 's2', guessed_user_id: 'bob' },
      { guesser_id: 'alice', submission_id: 's3', guessed_user_id: 'carol' },
    ],
    promptGuesses: [], promptAuthorId: null, memberIds: members,
  });
  assert.equal(breakdownFor(rows, 'alice').guessed, POINTS.guessed);
  assert.equal(breakdownFor(rows, 'alice').correctGuess, POINTS.correctGuess * 2);
});

test('prompt author banks points and correct bonus guesses pay out', () => {
  const rows = scoreRound({
    submissions: subs,
    guesses: [],
    promptGuesses: [
      { guesser_id: 'alice', guessed_user_id: 'carol' },
      { guesser_id: 'bob', guessed_user_id: 'alice' },
    ],
    promptAuthorId: 'carol',
    memberIds: members,
  });
  assert.equal(breakdownFor(rows, 'carol').promptDrawn, POINTS.promptDrawn);
  assert.equal(breakdownFor(rows, 'alice').promptAuthorBonus, POINTS.promptAuthorBonus);
  assert.equal(breakdownFor(rows, 'bob').promptAuthorBonus, undefined);
});

test('seeded prompts (no author) award no prompt points at all', () => {
  const rows = scoreRound({
    submissions: subs,
    guesses: [],
    promptGuesses: [{ guesser_id: 'alice', guessed_user_id: 'carol' }],
    promptAuthorId: null,
    memberIds: members,
  });
  for (const id of members) {
    assert.equal(breakdownFor(rows, id).promptDrawn, undefined);
    assert.equal(breakdownFor(rows, id).promptAuthorBonus, undefined);
  }
});

test('a full three-player round totals correctly', () => {
  // alice nails bob, misses carol. bob misses both. carol nails both.
  const rows = scoreRound({
    submissions: subs,
    guesses: [
      { guesser_id: 'alice', submission_id: 's2', guessed_user_id: 'bob' },
      { guesser_id: 'alice', submission_id: 's3', guessed_user_id: 'bob' },
      { guesser_id: 'bob', submission_id: 's1', guessed_user_id: 'carol' },
      { guesser_id: 'bob', submission_id: 's3', guessed_user_id: 'alice' },
      { guesser_id: 'carol', submission_id: 's1', guessed_user_id: 'alice' },
      { guesser_id: 'carol', submission_id: 's2', guessed_user_id: 'bob' },
    ],
    promptGuesses: [], promptAuthorId: null, memberIds: members,
  });
  // alice: submitted 1 + guessed 1 + 1 correct (3) + fooled bob once (1) = 6
  assert.equal(pointsFor(rows, 'alice'), 6);
  // bob: submitted 1 + guessed 1 + 0 correct + fooled by nobody (alice & carol both got him) = 2
  assert.equal(pointsFor(rows, 'bob'), 2);
  // carol: submitted 1 + guessed 1 + 2 correct (6) + fooled alice and bob (2) = 10
  assert.equal(pointsFor(rows, 'carol'), 10);
});

test('guesses referencing an unknown submission are ignored', () => {
  const rows = scoreRound({
    submissions: subs,
    guesses: [{ guesser_id: 'alice', submission_id: 'ghost', guessed_user_id: 'bob' }],
    promptGuesses: [], promptAuthorId: null, memberIds: members,
  });
  assert.equal(breakdownFor(rows, 'alice').correctGuess, undefined);
});
