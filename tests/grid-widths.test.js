const test = require('node:test');
const assert = require('node:assert');

const { buildTableModel } = require('../formatter');
const { gridColumnWidths, GRID_PAD_X } = require('../image-renderer');

const WIDTH = 720;
const PADDING = 32;

// Bug real: a linha do time alvo é destacada e desenhada em BOLD (drawGrid),
// mas as larguras das colunas eram medidas só em fonte normal. Em ambientes
// onde o bold é mais largo que o normal (ex.: fonte do CI Linux), valores de
// 2-3 dígitos na linha destacada estouravam a célula e eram abreviados com "…".
//
// ctx falso e determinístico: bold ocupa mais largura por caractere que normal,
// como acontece no CI. Assim o teste prova a lógica independente da fonte local
// (no macOS o node-canvas mede bold == normal e o bug não se manifesta).
function makeCtx() {
  return {
    font: '',
    measureText(s) {
      const perChar = this.font.includes('bold') ? 11 : 9;
      return { width: String(s).length * perChar };
    },
  };
}

const ROWS = [
  { position: 23, club: 'A.D. INDAIATUBA', points: 4, games: 14, wins: 1, draws: 1, losses: 12, goalsFor: 15, goalsAgainst: 62, goalDiff: -47 },
  { position: 24, club: 'A.S.F. MAGNUS', points: 4, games: 14, wins: 0, draws: 4, losses: 10, goalsFor: 17, goalsAgainst: 47, goalDiff: -39 },
];

test('gridColumnWidths: colunas comportam os valores da linha destacada renderizados em bold', () => {
  const model = buildTableModel(ROWS, { highlightIndex: 1, highlightLabel: 'A.S.F. MAGNUS' });
  const ctx = makeCtx();
  const widths = gridColumnWidths(ctx, model, WIDTH - PADDING * 2);

  const highlighted = model.rows[1];
  model.columns.forEach((c, ci) => {
    // a linha destacada é desenhada em bold no render real
    ctx.font = 'bold 14px sans-serif';
    const drawnWidth = ctx.measureText(highlighted.values[ci]).width;
    const cellWidth = widths[ci] - GRID_PAD_X * 2;
    assert.ok(
      cellWidth >= drawnWidth,
      `coluna ${c.label}: valor "${highlighted.values[ci]}" (bold=${drawnWidth}px) não cabe em ${cellWidth}px — seria abreviado com "…"`,
    );
  });
});
