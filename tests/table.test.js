const test = require('node:test');
const assert = require('node:assert');

const { buildTableModel, renderTableText } = require('../formatter');

const SOROCABANA_ROW = {
  position: 24,
  club: 'ASSOCIAÇÃO SOROCABANA DE FUTSAL - ASF/MAGNU',
  points: 4, games: 14, wins: 0, draws: 4, losses: 10,
  goalsFor: 17, goalsAgainst: 47, goalDiff: -30,
};

const LEADER_ROW = {
  position: 1,
  club: 'SÃO PAULO FC - A',
  points: 42, games: 14, wins: 14, draws: 0, losses: 0,
  goalsFor: 82, goalsAgainst: 7, goalDiff: 75,
};

test('buildTableModel: colunas na ordem certa incluindo SG', () => {
  const m = buildTableModel([SOROCABANA_ROW], {});
  assert.deepEqual(m.columns.map((c) => c.label), ['Pos', 'Clube', 'Pts', 'J', 'V', 'E', 'D', 'SG']);
});

test('buildTableModel: destaca a linha do índice alvo e usa o label amigável', () => {
  const m = buildTableModel([LEADER_ROW, SOROCABANA_ROW], { highlightIndex: 1, highlightLabel: 'MAGNUS' });
  assert.equal(m.rows[0].highlight, false);
  assert.equal(m.rows[1].highlight, true);
  assert.equal(m.rows[1].values[0], '24º');
  assert.equal(m.rows[1].values[1], 'MAGNUS'); // label amigável no destaque
  assert.equal(m.rows[1].values[2], '4'); // Pts
});

test('buildTableModel: SG mostra sinal (+ para positivo, - para negativo)', () => {
  const m = buildTableModel([LEADER_ROW, SOROCABANA_ROW], {});
  assert.equal(m.rows[0].values[7], '+75');
  assert.equal(m.rows[1].values[7], '-30');
});

test('buildTableModel: sem destaque encurta o clube via shortClub', () => {
  const m = buildTableModel([SOROCABANA_ROW], {});
  assert.equal(m.rows[0].values[1], 'ASSOCIAÇÃO SOROCABANA DE FUTSAL');
});

test('renderTableText: todas as linhas de conteúdo têm a mesma largura (alinhadas)', () => {
  const m = buildTableModel([LEADER_ROW, SOROCABANA_ROW], { highlightIndex: 1, highlightLabel: 'MAGNUS' });
  const lines = renderTableText(m).split('\n').filter((l) => l !== '```');
  const widths = new Set(lines.map((l) => l.length));
  assert.equal(widths.size, 1, `larguras divergentes: ${[...widths].join(',')}`);
});

test('renderTableText: marca a linha destacada com ▸', () => {
  const m = buildTableModel([LEADER_ROW, SOROCABANA_ROW], { highlightIndex: 1, highlightLabel: 'MAGNUS' });
  const lines = renderTableText(m).split('\n');
  const marked = lines.filter((l) => l.startsWith('▸'));
  assert.equal(marked.length, 1);
  assert.match(marked[0], /MAGNUS/);
});
