const test = require('node:test');
const assert = require('node:assert');
const { createSeenStore } = require('../gitlab-mr-helper.user.js');

function fakeStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    get: (k, d) => (k in data ? data[k] : d),
    set: (k, v) => { data[k] = v; },
    _data: data,
  };
}

const DAY = 24 * 60 * 60 * 1000;

test('store vide : count 0, isSeen false', () => {
  const store = createSeenStore(fakeStorage());
  assert.strictEqual(store.count(), 0);
  assert.strictEqual(store.isSeen('/a'), false);
});

test('markSeen rend isSeen true et incrémente count', () => {
  const store = createSeenStore(fakeStorage());
  store.markSeen('/a', 'tok', 1000);
  assert.strictEqual(store.isSeen('/a'), true);
  assert.strictEqual(store.count(), 1);
});

test('markSeen stocke le token et la date (seenAt) dans all()', () => {
  const store = createSeenStore(fakeStorage());
  store.markSeen('/a', 'tok', 1000);
  assert.deepStrictEqual(store.all()['/a'], { token: 'tok', seenAt: 1000 });
});

test('unmarkSeen retire l\'entrée', () => {
  const store = createSeenStore(fakeStorage());
  store.markSeen('/a', 'tok', 1000);
  store.unmarkSeen('/a');
  assert.strictEqual(store.isSeen('/a'), false);
  assert.strictEqual(store.count(), 0);
});

test('toggle avec le MÊME token bascule l\'état (marque puis annule)', () => {
  const store = createSeenStore(fakeStorage());
  assert.strictEqual(store.toggle('/a', 'tok-1', 1000), true);
  assert.strictEqual(store.isSeen('/a'), true);
  assert.strictEqual(store.all()['/a'].token, 'tok-1');
  assert.strictEqual(store.toggle('/a', 'tok-1', 2000), false);
  assert.strictEqual(store.isSeen('/a'), false);
});

test('toggle avec un token DIFFÉRENT ré-acquitte avec le nouveau token et rafraîchit seenAt', () => {
  const store = createSeenStore(fakeStorage());
  store.toggle('/a', 'tok-1', 1000);
  // la MR a bougé : nouveau token -> on ré-acquitte plutôt que de désélectionner
  assert.strictEqual(store.toggle('/a', 'tok-2', 5000), true);
  assert.strictEqual(store.isSeen('/a'), true);
  assert.deepStrictEqual(store.all()['/a'], { token: 'tok-2', seenAt: 5000 });
});

test('clear vide tout', () => {
  const store = createSeenStore(fakeStorage());
  store.markSeen('/a', 'x', 1);
  store.markSeen('/b', 'y', 2);
  store.clear();
  assert.strictEqual(store.count(), 0);
});

test('persiste via l\'adaptateur de stockage', () => {
  const storage = fakeStorage();
  const store = createSeenStore(storage);
  store.markSeen('/a', 'x', 1);
  const store2 = createSeenStore(storage);
  assert.strictEqual(store2.isSeen('/a'), true);
});

test('prune : retire les entrées plus vieilles que le TTL, garde les récentes', () => {
  const now = 100 * DAY;
  const store = createSeenStore(fakeStorage());
  store.markSeen('/old', 'a', now - 91 * DAY); // périmée (> 90j)
  store.markSeen('/new', 'b', now - 10 * DAY); // récente
  store.prune(now, 90 * DAY);
  assert.strictEqual(store.isSeen('/old'), false);
  assert.strictEqual(store.isSeen('/new'), true);
});

test('prune : migre une entrée legacy (string) en lui donnant seenAt = now', () => {
  const now = 100 * DAY;
  // entrée legacy : valeur string nue (ancien format)
  const storage = fakeStorage({ seenMrs: { '/legacy': 'ancien-token' } });
  const store = createSeenStore(storage);
  store.prune(now, 90 * DAY);
  assert.deepStrictEqual(store.all()['/legacy'], { token: 'ancien-token', seenAt: now });
});

test('prune : renvoie la map après purge et n\'écrit que si nécessaire', () => {
  const now = 100 * DAY;
  const store = createSeenStore(fakeStorage());
  store.markSeen('/new', 'b', now - 1 * DAY);
  const map = store.prune(now, 90 * DAY);
  assert.ok('/new' in map);
});
