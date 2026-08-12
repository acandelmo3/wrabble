import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, globalName, nameSql, findNameConflict, MAX_NAME } from '../src/names.js';

// --- cleanName -----------------------------------------------------------

test('a normal name comes back untouched', () => {
  assert.equal(cleanName('Sam'), 'Sam');
  assert.equal(cleanName('  Sam  '), 'Sam');
});

test('empty, blank, and null all mean "clear it"', () => {
  assert.equal(cleanName(''), '');
  assert.equal(cleanName('   '), '');
  assert.equal(cleanName(null), '');
  assert.equal(cleanName(undefined), '');
});

test('internal whitespace collapses, so a pasted newline cannot split a name', () => {
  assert.equal(cleanName('Sam   the\nSecond'), 'Sam the Second');
  assert.equal(cleanName('a\tb'), 'a b');
});

test('a name longer than the cap is refused', () => {
  assert.equal(cleanName('x'.repeat(MAX_NAME)), 'x'.repeat(MAX_NAME));
  assert.throws(() => cleanName('x'.repeat(MAX_NAME + 1)), /32 characters/);
});

test('invisible characters are refused', () => {
  // Zero-width space: renders as nothing, so this looks exactly like "Sam"
  // while comparing as a different string ~ two players, one apparent name.
  assert.throws(() => cleanName('Sa​m'), /cannot be displayed/);
  // Zero-width joiner, same problem.
  assert.throws(() => cleanName('Sa‍m'), /cannot be displayed/);
  // Right-to-left override reorders everything after it.
  assert.throws(() => cleanName('Sam‮'), /cannot be displayed/);
});

test('a byte-order mark is stripped as whitespace, not refused', () => {
  // JS \s covers U+FEFF, so it is gone before the invisible-character check.
  // Silently cleaning it is friendlier than an error nobody can see the cause of.
  assert.equal(cleanName('Sam﻿'), 'Sam');
});

test('emoji and accents are allowed ~ they are visible and distinct', () => {
  assert.equal(cleanName('Zoë 🦊'), 'Zoë 🦊');
});

test('a non-string is refused rather than coerced', () => {
  assert.throws(() => cleanName(42), /not a name/);
  assert.throws(() => cleanName({}), /not a name/);
});

// --- fallback order ------------------------------------------------------

test('globalName prefers the chosen name, then discord global, then handle', () => {
  const u = { username: 'handle', global_name: 'Global', display_name: 'Chosen' };
  assert.equal(globalName(u), 'Chosen');
  assert.equal(globalName({ ...u, display_name: null }), 'Global');
  assert.equal(globalName({ ...u, display_name: null, global_name: null }), 'handle');
});

test('nameSql aliases and references the aliases it is given', () => {
  const sql = nameSql('author', 'mem', 'usr');
  assert.match(sql, /AS author$/);
  assert.match(sql, /mem\.nickname/);
  assert.match(sql, /usr\.display_name/);
});

// --- conflict detection --------------------------------------------------
//
// findNameConflict only needs .prepare().bind().all(), so a hand-rolled stub is
// cheaper and clearer here than standing up a real D1.
const fakeDb = (rows) => ({
  prepare() { return { bind: () => ({ all: async () => ({ results: rows }) }) }; },
});

test('a free name reports no conflict', async () => {
  assert.equal(await findNameConflict(fakeDb([{ taken: 'Ann' }]), 'u1', 'Bo'), null);
});

test('a taken name reports the name as already spelled', async () => {
  const db = fakeDb([{ taken: 'Ann' }, { taken: 'Bo' }]);
  assert.equal(await findNameConflict(db, 'u1', 'Bo'), 'Bo');
});

test('conflicts ignore case, since the reveal would be unreadable either way', async () => {
  const db = fakeDb([{ taken: 'Ann' }]);
  assert.equal(await findNameConflict(db, 'u1', 'ANN'), 'Ann');
  assert.equal(await findNameConflict(db, 'u1', 'ann'), 'Ann');
});

test('clearing a name (empty) never conflicts', async () => {
  assert.equal(await findNameConflict(fakeDb([{ taken: 'Ann' }]), 'u1', ''), null);
});
