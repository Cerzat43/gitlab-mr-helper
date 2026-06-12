const test = require('node:test');
const assert = require('node:assert');
const { createSeenStore } = require('../gitlab-mr-helper.user.js');

function fakeStorage() {
  const data = {};
  return {
    get: (k, d) => (k in data ? data[k] : d),
    set: (k, v) => { data[k] = v; },
  };
}

test('store vide : count 0, isSeen false', () => {
  const store = createSeenStore(fakeStorage());
  assert.strictEqual(store.count(), 0);
  assert.strictEqual(store.isSeen('/a'), false);
});

test('markSeen rend isSeen true et incrémente count', () => {
  const store = createSeenStore(fakeStorage());
  store.markSeen('/a', 111);
  assert.strictEqual(store.isSeen('/a'), true);
  assert.strictEqual(store.count(), 1);
});

test('markSeen conserve le timestamp dans all()', () => {
  const store = createSeenStore(fakeStorage());
  store.markSeen('/a', 111);
  assert.strictEqual(store.all()['/a'], 111);
});

test('unmarkSeen retire l\'entrée', () => {
  const store = createSeenStore(fakeStorage());
  store.markSeen('/a', 111);
  store.unmarkSeen('/a');
  assert.strictEqual(store.isSeen('/a'), false);
  assert.strictEqual(store.count(), 0);
});

test('toggle avec le MÊME token bascule l\'état (marque puis annule)', () => {
  const store = createSeenStore(fakeStorage());
  assert.strictEqual(store.toggle('/a', 'tok-1'), true);
  assert.strictEqual(store.isSeen('/a'), true);
  assert.strictEqual(store.all()['/a'], 'tok-1');
  assert.strictEqual(store.toggle('/a', 'tok-1'), false);
  assert.strictEqual(store.isSeen('/a'), false);
});

test('toggle avec un token DIFFÉRENT ré-acquitte avec le nouveau token (cas « changé »)', () => {
  const store = createSeenStore(fakeStorage());
  store.toggle('/a', 'tok-1');
  // la MR a bougé : nouveau token -> on ré-acquitte plutôt que de désélectionner
  assert.strictEqual(store.toggle('/a', 'tok-2'), true);
  assert.strictEqual(store.isSeen('/a'), true);
  assert.strictEqual(store.all()['/a'], 'tok-2');
});

test('clear vide tout', () => {
  const store = createSeenStore(fakeStorage());
  store.markSeen('/a', 1);
  store.markSeen('/b', 2);
  store.clear();
  assert.strictEqual(store.count(), 0);
});

test('persiste via l\'adaptateur de stockage', () => {
  const storage = fakeStorage();
  const store = createSeenStore(storage);
  store.markSeen('/a', 1);
  const store2 = createSeenStore(storage);
  assert.strictEqual(store2.isSeen('/a'), true);
});
