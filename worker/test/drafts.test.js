// The draft store is web/ code, but it is the only thing standing between a
// long answer and oblivion, so it gets tested here rather than nowhere.
//
// It talks to localStorage and nothing else, so a Map behind the same four
// methods is enough to run it under node.
import test from 'node:test';
import assert from 'node:assert/strict';

function withStorage(impl) {
  globalThis.localStorage = impl;
  // Fresh module each time: `dirty` is module state.
  return import(`../../web/js/drafts.js?t=${Math.random()}`);
}

const memory = () => {
  const m = new Map();
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    get length() { return m.size; },
    key: (i) => [...m.keys()][i],
  };
};
// Object.keys(localStorage) is what pruneDrafts walks, so the fake has to
// expose its keys the same way a real Storage does.
const keyed = () => {
  const s = memory();
  return new Proxy(s, { ownKeys: () => [...s.map.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
};

test('a draft round-trips and is namespaced by round', async () => {
  const { saveDraft, loadDraft } = await withStorage(memory());
  saveDraft('r1', 'hello');
  saveDraft('r2', 'other');
  assert.equal(loadDraft('r1'), 'hello');
  assert.equal(loadDraft('r2'), 'other');
  assert.equal(loadDraft('r3'), null);
});

test('an empty draft is removed rather than stored as ""', async () => {
  const store = memory();
  const { saveDraft, loadDraft } = await withStorage(store);
  saveDraft('r1', 'something');
  saveDraft('r1', '');
  assert.equal(loadDraft('r1'), null);
  assert.equal(store.length, 0);
});

test('clearing removes the draft and its timestamp, leaving nothing behind', async () => {
  const store = memory();
  const { saveDraft, touchDraft, clearDraft } = await withStorage(store);
  saveDraft('r1', 'text');
  touchDraft('r1');
  assert.equal(store.length, 2, 'draft + stamp');
  clearDraft('r1');
  assert.equal(store.length, 0);
});

test('clearing one round does not touch another', async () => {
  const { saveDraft, clearDraft, loadDraft } = await withStorage(memory());
  saveDraft('r1', 'keep me');
  saveDraft('r2', 'clear me');
  clearDraft('r2');
  assert.equal(loadDraft('r1'), 'keep me');
  assert.equal(loadDraft('r2'), null);
});

// The whole point: storage failing must not take the keystroke down with it.
test('a storage that throws never propagates', async () => {
  const hostile = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() { throw new Error('nope'); },
  };
  const { saveDraft, loadDraft, clearDraft, touchDraft } = await withStorage(hostile);
  assert.doesNotThrow(() => saveDraft('r1', 'x'));
  assert.doesNotThrow(() => touchDraft('r1'));
  assert.doesNotThrow(() => clearDraft('r1'));
  assert.equal(loadDraft('r1'), null, 'a failed read reads as "no draft"');
});

test('dirty flips on edit and clears once the save is confirmed', async () => {
  const { setDirty, isDirty, clearDraft } = await withStorage(memory());
  assert.equal(isDirty(), false);
  setDirty(true);
  assert.equal(isDirty(), true);
  clearDraft('r1');
  assert.equal(isDirty(), false, 'a confirmed save is the only thing that clears it');
});

test('pruning drops drafts older than 30 days and keeps recent ones', async () => {
  const store = keyed();
  const { saveDraft, loadDraft } = await withStorage(store);
  saveDraft('old', 'ancient');
  saveDraft('new', 'fresh');
  const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
  store.setItem('wrabble.draft.old.at', String(old));
  store.setItem('wrabble.draft.new.at', String(Date.now()));
  const { pruneDrafts } = await withStorage(store);
  pruneDrafts();
  assert.equal(loadDraft('old'), null);
  assert.equal(loadDraft('new'), 'fresh');
});

test('pruning never touches unrelated keys', async () => {
  const store = keyed();
  store.setItem('wrabble.token', 'secret');
  const { pruneDrafts } = await withStorage(store);
  store.setItem('wrabble.draft.x', 'text');
  store.setItem('wrabble.draft.x.at', String(Date.now() - 99 * 24 * 3600 * 1000));
  pruneDrafts();
  assert.equal(store.getItem('wrabble.token'), 'secret');
  assert.equal(store.getItem('wrabble.draft.x'), null);
});

test('a draft with no timestamp is kept, not silently binned', async () => {
  const store = keyed();
  const { saveDraft } = await withStorage(store);
  saveDraft('r1', 'no stamp on me');
  const { pruneDrafts, loadDraft } = await withStorage(store);
  pruneDrafts();
  assert.equal(loadDraft('r1'), 'no stamp on me');
});
