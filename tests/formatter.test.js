const test = require('node:test');
const assert = require('node:assert');

const { shortClub, formatTelegramCaption } = require('../formatter');

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

test('formatTelegramCaption: inclui categoria, divisão e atualização', () => {
  const caption = formatTelegramCaption({
    source: { category: 'Sub-7', division: 'A1' },
    scrapedAt: '2026-08-12T23:56:00',
  });
  assert.equal(caption, 'Sub-7 Divisão A1, atualizado em 12/08/2026 23:56');
});
