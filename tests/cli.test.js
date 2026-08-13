const test = require('node:test');
const assert = require('node:assert');

const { parseFlags } = require('../enviar');

test('parseFlags: aplica as flags globais da execução multi-categoria', () => {
  assert.deepEqual(parseFlags(['--from-cache', '--no-scorers', '--no-send']), {
    fromCache: true,
    noScorers: true,
    noSend: true,
    help: false,
  });
});

test('parseFlags: reconhece ajuda curta', () => {
  assert.equal(parseFlags(['-h']).help, true);
});
