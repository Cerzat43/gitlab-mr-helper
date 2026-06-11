const test = require('node:test');
const assert = require('node:assert');
const { isMrListUrl } = require('../gitlab-mr-helper.user.js');

test('matche la liste de MRs d\'un projet', () => {
  assert.strictEqual(isMrListUrl('/webediagroup/gaming/jvc-respawn/-/merge_requests'), true);
});

test('matche la liste de MRs avec slash final', () => {
  assert.strictEqual(isMrListUrl('/grp/proj/-/merge_requests/'), true);
});

test('matche la liste de MRs d\'un groupe', () => {
  assert.strictEqual(isMrListUrl('/groups/webediagroup/-/merge_requests'), true);
});

test('matche le dashboard global', () => {
  assert.strictEqual(isMrListUrl('/dashboard/merge_requests'), true);
});

test('ne matche PAS une page de détail de MR', () => {
  assert.strictEqual(isMrListUrl('/grp/proj/-/merge_requests/123'), false);
});

test('ne matche PAS une liste d\'issues', () => {
  assert.strictEqual(isMrListUrl('/grp/proj/-/issues'), false);
});

test('ne matche PAS la racine', () => {
  assert.strictEqual(isMrListUrl('/'), false);
});
