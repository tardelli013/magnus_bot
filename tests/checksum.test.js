const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const checksum = require('../src/checksum');

test('checksum: ignora scrapedAt para comparar apenas dados relevantes', () => {
  const a = checksum.calculate({
    scrapedAt: '2026-09-04T10:00:00.000Z',
    source: { category: 'Sub-7' },
    classification: [{ club: 'A.S.F. Magnus', points: 10 }],
  });
  const b = checksum.calculate({
    scrapedAt: '2026-09-04T11:00:00.000Z',
    source: { category: 'Sub-7' },
    classification: [{ club: 'A.S.F. Magnus', points: 10 }],
  });

  assert.equal(a, b);
});

test('checksum: muda quando o resultado relevante muda', () => {
  const a = checksum.calculate({ classification: [{ club: 'A', points: 10 }] });
  const b = checksum.calculate({ classification: [{ club: 'A', points: 11 }] });

  assert.notEqual(a, b);
});

test('checksum: ignora ordem instável de artilheiros empatados', () => {
  const a = checksum.calculate({
    topScorers: [
      { position: 1, name: 'JOAO', club: 'A', goals: 10 },
      { position: 2, name: 'PEDRO', club: 'B', goals: 10 },
    ],
    teamScorers: [
      { name: 'CARLOS', goals: 3 },
      { name: 'ANDRE', goals: 3 },
    ],
  });
  const b = checksum.calculate({
    topScorers: [
      { position: 1, name: 'PEDRO', club: 'B', goals: 10 },
      { position: 2, name: 'JOAO', club: 'A', goals: 10 },
    ],
    teamScorers: [
      { name: 'ANDRE', goals: 3 },
      { name: 'CARLOS', goals: 3 },
    ],
  });

  assert.equal(a, b);
});

test('checksum: ignora ordem instável de classificação com mesma posição', () => {
  const a = checksum.calculate({
    classification: [
      { position: 2, club: 'TIME A', points: 10, wins: 3, goalDiff: 5, goalsFor: 9 },
      { position: 2, club: 'TIME B', points: 10, wins: 3, goalDiff: 5, goalsFor: 9 },
    ],
  });
  const b = checksum.calculate({
    classification: [
      { position: 2, club: 'TIME B', points: 10, wins: 3, goalDiff: 5, goalsFor: 9 },
      { position: 2, club: 'TIME A', points: 10, wins: 3, goalDiff: 5, goalsFor: 9 },
    ],
  });

  assert.equal(a, b);
});

test('checksum: salva checksums por categoria no mesmo arquivo', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-checksum-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  checksum.save('sub7', 'abc', dataDir);
  checksum.save('sub8', 'def', dataDir);

  assert.equal(checksum.load('sub7', dataDir), 'abc');
  assert.equal(checksum.load('sub8', dataDir), 'def');
  assert.deepEqual(checksum.loadAll(dataDir), { sub7: 'abc', sub8: 'def' });
});
