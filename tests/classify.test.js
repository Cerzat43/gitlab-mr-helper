const test = require('node:test');
const assert = require('node:assert');
const { classifyMr, isBlockingLabel } = require('../gitlab-mr-helper.user.js');

const KEY = '/grp/proj/-/merge_requests/1';
const TOKEN = 'jeudi 11 juin 2026 à 17:33:25 UTC+2';

function mr(over) {
  // Par défaut : non approuvée, avec un label bloquant -> jamais « ready ».
  return Object.assign(
    { key: KEY, author: 'someone', updateToken: TOKEN, approved: false, labels: ['Status::Needs review'] },
    over
  );
}

test('vue : marquée avec le même token -> seen', () => {
  const state = classifyMr(mr({}), 'me', { [KEY]: TOKEN });
  assert.strictEqual(state, 'seen');
});

test('changée : marquée mais token différent -> changed', () => {
  const state = classifyMr(mr({ updateToken: 'token-plus-recent' }), 'me', { [KEY]: TOKEN });
  assert.strictEqual(state, 'changed');
});

test('ma MR : auteur courant, pas marquée -> mine', () => {
  const state = classifyMr(mr({ author: 'me' }), 'me', {});
  assert.strictEqual(state, 'mine');
});

test('autre MR non marquée -> neutral', () => {
  const state = classifyMr(mr({ author: 'x' }), 'me', {});
  assert.strictEqual(state, 'neutral');
});

test('seen/changed priment sur mine quand une MR marquée appartient à l\'auteur courant', () => {
  assert.strictEqual(classifyMr(mr({ author: 'me' }), 'me', { [KEY]: TOKEN }), 'seen');
  assert.strictEqual(classifyMr(mr({ author: 'me', updateToken: 'autre' }), 'me', { [KEY]: TOKEN }), 'changed');
});

test('sans utilisateur courant : mine désactivé, mais seen/changed restent', () => {
  assert.strictEqual(classifyMr(mr({ author: 'x' }), null, {}), 'neutral');
  assert.strictEqual(classifyMr(mr({}), null, { [KEY]: TOKEN }), 'seen');
  assert.strictEqual(classifyMr(mr({ updateToken: 'autre' }), null, { [KEY]: TOKEN }), 'changed');
});

test('token stocké vide ("") est respecté comme une vue valide', () => {
  assert.strictEqual(classifyMr(mr({ updateToken: '' }), 'me', { [KEY]: '' }), 'seen');
});

test('prête à merger : approuvée + aucun label bloquant -> ready', () => {
  // labels de catégorie non bloquants
  assert.strictEqual(classifyMr(mr({ approved: true, labels: ['Bug', 'SEO', 'Deploy::Release'], author: 'x' }), 'me', {}), 'ready');
  // zéro label tout court
  assert.strictEqual(classifyMr(mr({ approved: true, labels: [], author: 'x' }), 'me', {}), 'ready');
});

test('ready prime sur seen, changed et mine', () => {
  assert.strictEqual(classifyMr(mr({ approved: true, labels: [], author: 'me' }), 'me', { [KEY]: TOKEN }), 'ready');
  assert.strictEqual(classifyMr(mr({ approved: true, labels: [], updateToken: 'neuf' }), 'me', { [KEY]: TOKEN }), 'ready');
});

test('pas ready si un label bloquant reste (Status::* ou Don\'t merge)', () => {
  assert.strictEqual(classifyMr(mr({ approved: true, labels: ['Status::To be tested'], author: 'x' }), 'me', {}), 'neutral');
  assert.strictEqual(classifyMr(mr({ approved: true, labels: ['Bug', "Don't merge"], author: 'x' }), 'me', {}), 'neutral');
});

test('pas ready si aucun label bloquant mais non approuvée', () => {
  assert.strictEqual(classifyMr(mr({ approved: false, labels: [], author: 'x' }), 'me', {}), 'neutral');
});

test('isBlockingLabel : Status::* et Don\'t merge bloquent, le reste non', () => {
  assert.strictEqual(isBlockingLabel('Status::Needs review'), true);
  assert.strictEqual(isBlockingLabel('Status::Work In Progress'), true);
  assert.strictEqual(isBlockingLabel('Status::To be tested'), true);
  assert.strictEqual(isBlockingLabel("Don't merge"), true);
  assert.strictEqual(isBlockingLabel('Dont merge'), true);          // apostrophe absente toléré
  assert.strictEqual(isBlockingLabel('Deploy::Release'), false);
  assert.strictEqual(isBlockingLabel('Deploy::Hotfix'), false);
  assert.strictEqual(isBlockingLabel('Bug'), false);
  assert.strictEqual(isBlockingLabel('SEO'), false);
  assert.strictEqual(isBlockingLabel('Documentation'), false);
});
