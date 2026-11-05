const test = require('node:test');
const assert = require('node:assert');
const { classifyMr, isParkedLabel, sortRank, SORT_ORDER } = require('../gitlab-mr-helper.user.js');

const KEY = '/grp/proj/-/merge_requests/1';
const TOKEN = 'jeudi 11 juin 2026 à 17:33:25 UTC+2';

function mr(over) {
  return Object.assign({ key: KEY, author: 'someone', updateToken: TOKEN, approved: false, labels: [] }, over);
}

test("isParkedLabel : Don't merge et Status::Work In Progress, préfixes décoratifs tolérés", () => {
  assert.strictEqual(isParkedLabel("Don't merge"), true);
  assert.strictEqual(isParkedLabel("✗ Don't merge"), true);
  assert.strictEqual(isParkedLabel('Dont merge'), true);
  assert.strictEqual(isParkedLabel('Status::Work In Progress'), true);
  assert.strictEqual(isParkedLabel('Status::🚧 Work in progress'), true);
  assert.strictEqual(isParkedLabel('Status::Needs review'), false);
  assert.strictEqual(isParkedLabel('Status::To be tested'), false);
  assert.strictEqual(isParkedLabel('Work In Progress'), false);     // hors scope Status::
  assert.strictEqual(isParkedLabel('Bug'), false);
  assert.strictEqual(isParkedLabel(''), false);
  assert.strictEqual(isParkedLabel(null), false);
});

test('MR parquée -> seen même non marquée, et prime sur changed et mine', () => {
  assert.strictEqual(classifyMr(mr({ labels: ["✗ Don't merge"] }), 'me', {}), 'seen');
  assert.strictEqual(classifyMr(mr({ labels: ['Status::Work In Progress'] }), 'me', {}), 'seen');
  assert.strictEqual(classifyMr(mr({ labels: ['Status::Work In Progress'], author: 'me' }), 'me', {}), 'seen');
  assert.strictEqual(classifyMr(mr({ labels: ["Don't merge"], updateToken: 'neuf' }), 'me', { [KEY]: TOKEN }), 'seen');
  // approuvée mais parquée : pas ready (label bloquant)
  assert.strictEqual(classifyMr(mr({ labels: ["Don't merge"], approved: true }), 'me', {}), 'seen');
});

test('sortRank : ready < changed < neutral < mine < seen', () => {
  assert.deepStrictEqual(SORT_ORDER, ['ready', 'changed', 'neutral', 'mine', 'seen']);
  const states = ['seen', 'mine', 'neutral', 'changed', 'ready'];
  assert.deepStrictEqual(states.sort((a, b) => sortRank(a) - sortRank(b)), ['ready', 'changed', 'neutral', 'mine', 'seen']);
  assert.strictEqual(sortRank('inconnu'), sortRank('neutral'));
});

test('compareStateSort : rang d\'état puis date de création antéchronologique', () => {
  const { compareStateSort } = require('../gitlab-mr-helper.user.js');
  const rows = [
    { id: 'seen-new', state: 'seen', createdAt: '2026-11-05T10:00:00Z' },
    { id: 'neutral-old', state: 'neutral', createdAt: '2026-10-01T10:00:00Z' },
    { id: 'ready-old', state: 'ready', createdAt: '2026-09-01T10:00:00Z' },
    { id: 'neutral-new', state: 'neutral', createdAt: '2026-11-04T10:00:00Z' },
    { id: 'neutral-nodate', state: 'neutral', createdAt: null },
    { id: 'ready-new', state: 'ready', createdAt: '2026-11-01T10:00:00Z' },
  ];
  assert.deepStrictEqual(rows.slice().sort(compareStateSort).map((r) => r.id),
    ['ready-new', 'ready-old', 'neutral-new', 'neutral-old', 'neutral-nodate', 'seen-new']);
});
