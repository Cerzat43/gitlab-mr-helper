const test = require('node:test');
const assert = require('node:assert');
const { classifyMr } = require('../gitlab-mr-helper.user.js');

const KEY = '/grp/proj/-/merge_requests/1';

function mr(over) {
  return Object.assign({ key: KEY, author: 'someone', reviewers: [] }, over);
}

test('vue : présente dans seenMap -> seen (prioritaire)', () => {
  const state = classifyMr(mr({ author: 'me' }), 'me', { [KEY]: 123 });
  assert.strictEqual(state, 'seen');
});

test('à reviewer : reviewer non approuvé -> review', () => {
  const state = classifyMr(
    mr({ reviewers: [{ username: 'me', approved: false }] }),
    'me',
    {}
  );
  assert.strictEqual(state, 'review');
});

test('reviewer ayant déjà approuvé -> pas review', () => {
  const state = classifyMr(
    mr({ author: 'x', reviewers: [{ username: 'me', approved: true }] }),
    'me',
    {}
  );
  assert.strictEqual(state, 'neutral');
});

test('ma MR : auteur courant -> mine', () => {
  const state = classifyMr(mr({ author: 'me' }), 'me', {});
  assert.strictEqual(state, 'mine');
});

test('priorité review sur mine quand les deux s\'appliquent', () => {
  const state = classifyMr(
    mr({ author: 'me', reviewers: [{ username: 'me', approved: false }] }),
    'me',
    {}
  );
  assert.strictEqual(state, 'review');
});

test('aucun cas -> neutral', () => {
  const state = classifyMr(mr({ author: 'x', reviewers: [{ username: 'y', approved: false }] }), 'me', {});
  assert.strictEqual(state, 'neutral');
});

test('sans utilisateur courant -> neutral sauf si vue', () => {
  assert.strictEqual(classifyMr(mr({ author: 'x' }), null, {}), 'neutral');
  assert.strictEqual(classifyMr(mr({ key: KEY }), null, { [KEY]: 9 }), 'seen');
});
