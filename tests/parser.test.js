const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { parseClassification, parseScorers } = require('../src/parser');
const { normalize, matchesTeam } = require('../src/normalize');
const { selectTeamWindow, TEAMS_ABOVE, TEAMS_BELOW } = require('../scraper');

const SAMPLES = path.join(__dirname, '..', 'samples');
const classificationHtml = fs.readFileSync(path.join(SAMPLES, 'classification.html'), 'utf8');
const scorersHtml = fs.readFileSync(path.join(SAMPLES, 'scorers.html'), 'utf8');

test('normalize: acentos e maiúsculas', () => {
  assert.equal(normalize('ASSOCIAÇÃO Sorocabana'), 'associacao sorocabana');
  assert.equal(normalize('  Multi   Espaços  '), 'multi espacos');
  assert.equal(normalize(null), '');
  assert.equal(normalize(undefined), '');
});

test('matchesTeam: match exato e parcial', () => {
  const exact = matchesTeam('ASSOCIAÇÃO SOROCABANA DE FUTSAL', 'associação sorocabana de futsal');
  assert.equal(exact.match, true);
  assert.equal(exact.partial, false);

  const partial = matchesTeam('ASSOCIAÇÃO SOROCABANA DE FUTSAL - ASF/MAGNU', 'ASSOCIAÇÃO SOROCABANA DE FUTSAL');
  assert.equal(partial.match, true);
  assert.equal(partial.partial, true);

  const noMatch = matchesTeam('SAO PAULO FC', 'palmeiras');
  assert.equal(noMatch.match, false);
});

test('parseClassification: 24 times com schema correto', () => {
  const rows = parseClassification(classificationHtml);
  assert.equal(rows.length, 24);
  const first = rows[0];
  assert.ok(first.club);
  assert.equal(typeof first.position, 'number');
  assert.equal(typeof first.points, 'number');
  assert.equal(typeof first.games, 'number');
  assert.equal(typeof first.wins, 'number');
  assert.equal(typeof first.goalsFor, 'number');
  assert.equal(typeof first.goalsAgainst, 'number');
  assert.equal(typeof first.goalDiff, 'number');
});

test('parseClassification: saldo de gols pode ser negativo', () => {
  const rows = parseClassification(classificationHtml);
  const lastPlace = rows[rows.length - 1];
  assert.ok(lastPlace.goalDiff < 0, `esperado saldo negativo no último colocado, vi ${lastPlace.goalDiff}`);
});

test('parseClassification: SOROCABANA presente', () => {
  const rows = parseClassification(classificationHtml);
  const soro = rows.find((r) => r.club.includes('SOROCABANA'));
  assert.ok(soro, 'SOROCABANA deve aparecer na classificação');
  assert.equal(soro.position, 23);
  assert.equal(soro.points, 1);
});

test('parseScorers: lista artilheiros com schema correto', () => {
  const { scorers, warnings } = parseScorers(scorersHtml);
  assert.ok(scorers.length > 100, `esperado >100 artilheiros, vi ${scorers.length}`);
  assert.equal(warnings.length, 0);
  const first = scorers[0];
  assert.equal(typeof first.position, 'number');
  assert.ok(first.name);
  assert.ok(first.club);
  assert.ok(first.goals > 0);
});

test('parseScorers: artilheiros do SOROCABANA presentes', () => {
  const { scorers } = parseScorers(scorersHtml);
  const soro = scorers.filter((s) => s.club.includes('SOROCABANA'));
  assert.ok(soro.length >= 4, `esperado ≥4 artilheiros do Sorocabana, vi ${soro.length}`);
});

test('selectTeamWindow: alvo no meio retorna janela de 7', () => {
  const fakeClass = Array.from({ length: 10 }, (_, i) => ({
    position: i + 1,
    club: i === 4 ? 'MEU TIME' : `TIME ${i + 1}`,
    points: 0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0,
  }));
  const w = selectTeamWindow(fakeClass, 'MEU TIME', 3, 3);
  assert.equal(w.found, true);
  assert.equal(w.slice.length, 7);
  assert.equal(w.targetIndex, 3);
});

test('selectTeamWindow: alvo na pos 1 não inventa linhas acima', () => {
  const fakeClass = Array.from({ length: 10 }, (_, i) => ({
    position: i + 1,
    club: i === 0 ? 'MEU TIME' : `TIME ${i + 1}`,
    points: 0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0,
  }));
  const w = selectTeamWindow(fakeClass, 'MEU TIME', 3, 3);
  assert.equal(w.found, true);
  assert.equal(w.slice.length, 4); // alvo + 3 abaixo
  assert.equal(w.targetIndex, 0);
});

test('selectTeamWindow: alvo na última pos não inventa linhas abaixo', () => {
  const fakeClass = Array.from({ length: 10 }, (_, i) => ({
    position: i + 1,
    club: i === 9 ? 'MEU TIME' : `TIME ${i + 1}`,
    points: 0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0,
  }));
  const w = selectTeamWindow(fakeClass, 'MEU TIME', 3, 3);
  assert.equal(w.found, true);
  assert.equal(w.slice.length, 4); // 3 acima + alvo
  assert.equal(w.targetIndex, 3);
});

test('janela de produção mostra 5 times acima do alvo', () => {
  assert.equal(TEAMS_ABOVE, 5);
});

test('selectTeamWindow: alvo em último (cenário Magnus) mostra 5 acima', () => {
  const fakeClass = Array.from({ length: 24 }, (_, i) => ({
    position: i + 1,
    club: i === 23 ? 'A.S.F. MAGNUS' : `TIME ${i + 1}`,
    points: 0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0,
  }));
  const w = selectTeamWindow(fakeClass, 'A.S.F. MAGNUS', TEAMS_ABOVE, TEAMS_BELOW);
  assert.equal(w.found, true);
  assert.equal(w.slice.length, 6); // 5 acima + o próprio alvo
  assert.equal(w.targetIndex, 5);
});

test('selectTeamWindow: alvo inexistente retorna found=false', () => {
  const fakeClass = [{
    position: 1, club: 'OUTRO', points: 0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0,
  }];
  const w = selectTeamWindow(fakeClass, 'INEXISTENTE', 3, 3);
  assert.equal(w.found, false);
  assert.equal(w.slice.length, 0);
});

test('selectTeamWindow: match parcial gera warning', () => {
  const fakeClass = [
    { position: 1, club: 'TIME A', points: 0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 },
    { position: 2, club: 'ASSOCIAÇÃO SOROCABANA DE FUTSAL - ASF/MAGNU', points: 0, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 },
  ];
  const w = selectTeamWindow(fakeClass, 'ASSOCIAÇÃO SOROCABANA DE FUTSAL', 3, 3);
  assert.equal(w.found, true);
  assert.ok(w.warnings.some((w) => w.includes('match parcial')), 'esperado warning de match parcial');
});

test('parseClassification: erro claro se HTML inválido', () => {
  assert.throws(() => parseClassification('<html><body>nada aqui</body></html>'), /tabela de classifica/);
});
