const test = require('node:test');
const assert = require('node:assert');
const { countStates, FILTER_STATES } = require('../gitlab-mr-helper.user.js');

test('FILTER_STATES : les 5 états, dans l\'ordre du tri', () => {
  assert.deepStrictEqual(FILTER_STATES, ['ready', 'changed', 'neutral', 'mine', 'seen']);
});

test('countStates : dénombre chaque état filtrable, 0 par défaut, ignore les autres', () => {
  assert.deepStrictEqual(
    countStates(['ready', 'seen', 'neutral', 'ready', 'mine', 'inconnu', 'seen', 'seen']),
    { ready: 2, changed: 0, neutral: 1, mine: 1, seen: 3 }
  );
  assert.deepStrictEqual(countStates([]), { ready: 0, changed: 0, neutral: 0, mine: 0, seen: 0 });
});
