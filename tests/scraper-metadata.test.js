const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { scrape, sortClassification, sortScorers } = require('../scraper');

const samples = path.join(__dirname, '..', 'samples');
const classification = fs.readFileSync(path.join(samples, 'classification.html'), 'utf8');
const scorers = fs.readFileSync(path.join(samples, 'scorers.html'), 'utf8');
const games = fs.readFileSync(path.join(samples, 'games.html'), 'utf8');

function response(body) {
  return { ok: true, status: 200, text: async () => body };
}

test('scrape: propaga metadados da categoria recebida para o payload', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/artilharia')) return response(scorers);
    if (url.endsWith('/jogos')) return response(games);
    return response(classification);
  });

  const payload = await scrape({
    eventUrl: 'https://example.test/evento/909',
    targetTeam: 'ASSOCIAÇÃO SOROCABANA DE FUTSAL',
    category: 'Sub-8',
    division: 'A1',
    season: '2026',
  });

  assert.deepEqual(payload.source, {
    event: 'https://example.test/evento/909',
    category: 'Sub-8',
    division: 'A1',
    season: '2026',
  });
});

test('scrape: aborta quando o time alvo não pertence à categoria', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(classification));

  await assert.rejects(() => scrape({
    eventUrl: 'https://example.test/evento/909',
    targetTeam: 'TIME INEXISTENTE',
    category: 'Sub-8',
    division: 'A1',
    season: '2026',
  }), /Sub-8: time alvo não encontrado/);
});

test('sortScorers: estabiliza empates por clube e nome', () => {
  const sorted = sortScorers([
    { position: 1, name: 'PEDRO', club: 'B', goals: 10 },
    { position: 2, name: 'JOAO', club: 'A', goals: 10 },
    { position: 3, name: 'CAIO', club: 'C', goals: 11 },
  ]);

  assert.deepEqual(sorted.map((s) => `${s.position}:${s.name}`), [
    '1:CAIO',
    '2:JOAO',
    '3:PEDRO',
  ]);
});

test('sortClassification: estabiliza empate mantendo posição oficial como prioridade', () => {
  const sorted = sortClassification([
    { position: 2, club: 'TIME B', points: 10, wins: 3, goalDiff: 5, goalsFor: 9 },
    { position: 1, club: 'TIME C', points: 12, wins: 4, goalDiff: 1, goalsFor: 8 },
    { position: 2, club: 'TIME A', points: 10, wins: 3, goalDiff: 5, goalsFor: 9 },
  ]);

  assert.deepEqual(sorted.map((row) => `${row.position}:${row.club}`), [
    '1:TIME C',
    '2:TIME A',
    '2:TIME B',
  ]);
});
