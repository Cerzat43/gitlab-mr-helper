const test = require('node:test');
const assert = require('node:assert');
const { usernameFromHref } = require('../gitlab-mr-helper.user.js');

test('extrait le username d\'un href absolu', () => {
  assert.strictEqual(usernameFromHref('/alice'), 'alice');
});

test('extrait le username d\'un href avec segments suivants', () => {
  assert.strictEqual(usernameFromHref('/bob/projet'), 'bob');
});

test('extrait le username en ignorant query et fragment', () => {
  assert.strictEqual(usernameFromHref('/carol?tab=1#x'), 'carol');
});

test('gère l\'absence de slash initial', () => {
  assert.strictEqual(usernameFromHref('dave'), 'dave');
});

test('renvoie null pour un href vide', () => {
  assert.strictEqual(usernameFromHref(''), null);
});

test('renvoie null pour null', () => {
  assert.strictEqual(usernameFromHref(null), null);
});
