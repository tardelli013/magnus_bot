const test = require('node:test');
const assert = require('node:assert');

const { shortClub } = require('../formatter');

test('shortClub: remove sufixo " - XXX"', () => {
  assert.equal(shortClub('ASSOCIAÇÃO SOROCABANA DE FUTSAL - ASF/MAGNU'), 'ASSOCIAÇÃO SOROCABANA DE FUTSAL');
});

test('shortClub: remove sufixo " | XXX"', () => {
  assert.equal(shortClub('ASSOCIAÇÃO DESPORTIVA OLIMPIK | ATIVO'), 'ASSOCIAÇÃO DESPORTIVA OLIMPIK');
});

test('shortClub: preserva variante de letra única " - A"', () => {
  assert.equal(shortClub('SÃO PAULO FC - A'), 'SÃO PAULO FC - A');
});

test('shortClub: nome sem sufixo permanece igual', () => {
  assert.equal(shortClub('A.D. INDAIATUBA'), 'A.D. INDAIATUBA');
});
