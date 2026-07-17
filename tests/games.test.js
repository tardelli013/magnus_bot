const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { parseGames } = require('../src/parser');
const { selectNextGame, selectLastGame } = require('../scraper');
const { formatNextGame, formatLastGame, buildReportParts } = require('../formatter');

const SAMPLES = path.join(__dirname, '..', 'samples');
const gamesHtml = fs.readFileSync(path.join(SAMPLES, 'games.html'), 'utf8');

test('parseGames: 192 jogos com schema correto', () => {
  const games = parseGames(gamesHtml);
  assert.equal(games.length, 192);
  const first = games[0];
  assert.match(first.date, /^\d{2}\/\d{2}$/);
  assert.match(first.time, /^\d{2}:\d{2}$/);
  assert.ok(first.home);
  assert.ok(first.away);
  assert.equal(typeof first.played, 'boolean');
});

test('parseGames: jogo disputado tem placar numérico', () => {
  const games = parseGames(gamesHtml);
  // primeiro jogo da amostra: A.D. INDAIATUBA 0 x 10 SE PALMEIRAS em 21/03
  const g = games[0];
  assert.equal(g.date, '21/03');
  assert.match(g.home, /INDAIATUBA/);
  assert.match(g.away, /PALMEIRAS/);
  assert.equal(g.played, true);
  assert.equal(g.homeScore, 0);
  assert.equal(g.awayScore, 10);
});

test('parseGames: jogo futuro (result "x") não tem placar', () => {
  const games = parseGames(gamesHtml);
  const future = games.filter((g) => !g.played);
  assert.equal(future.length, 26);
  future.forEach((g) => {
    assert.equal(g.homeScore, null);
    assert.equal(g.awayScore, null);
  });
});

test('parseGames: extrai ginásio (venue)', () => {
  const games = parseGames(gamesHtml);
  assert.ok(games[0].venue);
  assert.match(games[0].venue, /MORADA DO SOL/);
});

test('parseGames: erro claro se HTML inválido', () => {
  assert.throws(() => parseGames('<html><body>nada</body></html>'), /tabela de jogos/);
});

const SOROCABANA = 'ASSOCIAÇÃO SOROCABANA DE FUTSAL';

test('selectNextGame: escolhe próximo jogo não disputado a partir de hoje (fixture real)', () => {
  const games = parseGames(gamesHtml);
  const sel = selectNextGame(games, SOROCABANA, {
    season: '2026',
    referenceDate: new Date(2026, 5, 22), // 22/06/2026
  });
  assert.equal(sel.found, true);
  assert.equal(sel.game.date, '27/06');
  assert.equal(sel.game.time, '08:30');
  assert.match(sel.game.opponent, /OLIMPIK/);
  assert.equal(sel.game.isHome, false); // SOROCABANA é visitante em 27/06
  assert.match(sel.game.venue, /CIEF/);
});

function fakeGame(date, home, away) {
  return { date, time: '10:00', venue: 'GINÁSIO X', home, away, homeScore: null, awayScore: null, played: false };
}

function fakePlayedGame(date, home, away, homeScore, awayScore) {
  return { date, time: '10:00', venue: 'GINÁSIO X', home, away, homeScore, awayScore, played: true };
}

test('selectNextGame: ignora jogos passados ainda não disputados', () => {
  const games = [
    fakeGame('10/06', SOROCABANA, 'TIME A'), // passado
    fakeGame('25/06', 'TIME B', SOROCABANA), // futuro
  ];
  const sel = selectNextGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22) });
  assert.equal(sel.found, true);
  assert.equal(sel.game.date, '25/06');
});

test('selectNextGame: jogo no dia de hoje conta como próximo', () => {
  const games = [fakeGame('22/06', SOROCABANA, 'TIME A')];
  const sel = selectNextGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22) });
  assert.equal(sel.found, true);
  assert.equal(sel.game.date, '22/06');
});

test('selectNextGame: identifica mando quando o time é mandante', () => {
  const games = [fakeGame('25/06', SOROCABANA, 'TIME A')];
  const sel = selectNextGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22) });
  assert.equal(sel.game.isHome, true);
  assert.equal(sel.game.opponent, 'TIME A');
});

test('selectNextGame: inclui posição do time e do adversário quando há classificação', () => {
  const games = [fakeGame('25/06', 'TIME A', SOROCABANA)]; // SOROCABANA visitante, adversário = TIME A
  const classification = [
    { position: 14, club: 'TIME A' },
    { position: 24, club: `${SOROCABANA} - ASF/MAGNU` },
  ];
  const sel = selectNextGame(games, SOROCABANA, {
    season: '2026',
    referenceDate: new Date(2026, 5, 22),
    classification,
  });
  assert.equal(sel.game.targetPosition, 24);
  assert.equal(sel.game.opponentPosition, 14);
});

test('selectNextGame: posições ficam null quando não há classificação', () => {
  const games = [fakeGame('25/06', SOROCABANA, 'TIME A')];
  const sel = selectNextGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22) });
  assert.equal(sel.game.targetPosition, null);
  assert.equal(sel.game.opponentPosition, null);
});

test('selectNextGame: sem jogos futuros retorna found=false', () => {
  const games = [fakeGame('10/06', SOROCABANA, 'TIME A')];
  const sel = selectNextGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22) });
  assert.equal(sel.found, false);
  assert.equal(sel.game, null);
});

test('formatNextGame: sem jogo mostra aviso', () => {
  const out = formatNextGame(null, 'MAGNUS');
  assert.match(out, /PRÓXIMO JOGO/);
  assert.match(out, /Sem próximo jogo/i);
});

test('formatNextGame: visitante mostra "OPONENTE x MAGNUS" com ginásio', () => {
  const out = formatNextGame(
    { date: '27/06', time: '08:30', venue: 'GINÁSIO CIEF - ITAPEVI', opponent: 'OLIMPIK', isHome: false },
    'MAGNUS'
  );
  assert.match(out, /PRÓXIMO JOGO/);
  assert.match(out, /27\/06/);
  assert.match(out, /08:30/);
  assert.match(out, /OLIMPIK x MAGNUS/);
  assert.match(out, /CIEF/);
});

test('formatNextGame: nome do adversário aparece completo após shortClub', () => {
  const out = formatNextGame(
    { date: '27/06', time: '08:30', venue: 'GINÁSIO CIEF - ITAPEVI', opponent: 'ASSOCIAÇÃO DESPORTIVA OLIMPIK | ATIVO', isHome: false },
    'MAGNUS'
  );
  assert.match(out, /ASSOCIAÇÃO DESPORTIVA OLIMPIK x MAGNUS/);
  assert.doesNotMatch(out, /…/);
});

test('formatNextGame: mostra a posição de cada time entre parênteses', () => {
  const out = formatNextGame(
    { date: '27/06', time: '08:30', venue: 'GINÁSIO CIEF - ITAPEVI', opponent: 'OLIMPIK', isHome: false, opponentPosition: 14, targetPosition: 24 },
    'MAGNUS'
  );
  assert.match(out, /OLIMPIK \(14º\) x MAGNUS \(24º\)/);
});

test('formatNextGame: omite parênteses quando a posição está ausente', () => {
  const out = formatNextGame(
    { date: '04/07', time: '09:00', venue: 'GINÁSIO ARENA SOROCABA', opponent: 'PORTUGUESA', isHome: true },
    'MAGNUS'
  );
  assert.match(out, /MAGNUS x PORTUGUESA/);
  assert.doesNotMatch(out, /\(\d+º\)/); // sem marcador de posição (o "(mandante)" é esperado)
});

test('formatNextGame: mandante mostra "MAGNUS x OPONENTE"', () => {
  const out = formatNextGame(
    { date: '04/07', time: '09:00', venue: 'GINÁSIO ARENA SOROCABA', opponent: 'PORTUGUESA', isHome: true },
    'MAGNUS'
  );
  assert.match(out, /MAGNUS x PORTUGUESA/);
});

test('selectLastGame: escolhe o jogo disputado mais recente (fixture real)', () => {
  const games = parseGames(gamesHtml);
  const sel = selectLastGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 11, 31) });
  assert.equal(sel.found, true);
  assert.equal(sel.game.date, '21/06');
  assert.match(sel.game.opponent, /OSASCO/);
  assert.equal(sel.game.isHome, true);
  assert.equal(sel.game.targetScore, 1);
  assert.equal(sel.game.opponentScore, 1);
});

test('selectLastGame: ignora jogos futuros e pega o disputado mais recente', () => {
  const games = [
    fakePlayedGame('10/06', SOROCABANA, 'TIME A', 2, 1),
    fakePlayedGame('18/06', 'TIME B', SOROCABANA, 4, 0),
    fakeGame('25/06', SOROCABANA, 'TIME C'), // futuro, não disputado
  ];
  const sel = selectLastGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22) });
  assert.equal(sel.found, true);
  assert.equal(sel.game.date, '18/06');
});

test('selectLastGame: mapeia placar e mando quando o time é visitante', () => {
  const games = [fakePlayedGame('18/06', 'TIME B', SOROCABANA, 1, 3)];
  const sel = selectLastGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22) });
  assert.equal(sel.game.isHome, false);
  assert.equal(sel.game.opponent, 'TIME B');
  assert.equal(sel.game.targetScore, 3);   // placar do visitante (away)
  assert.equal(sel.game.opponentScore, 1); // placar do mandante (home)
});

test('selectLastGame: mapeia placar quando o time é mandante', () => {
  const games = [fakePlayedGame('18/06', SOROCABANA, 'TIME A', 5, 2)];
  const sel = selectLastGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22) });
  assert.equal(sel.game.isHome, true);
  assert.equal(sel.game.opponent, 'TIME A');
  assert.equal(sel.game.targetScore, 5);
  assert.equal(sel.game.opponentScore, 2);
});

test('selectLastGame: inclui posições do time e do adversário', () => {
  const games = [fakePlayedGame('18/06', 'TIME A', SOROCABANA, 1, 3)];
  const classification = [
    { position: 12, club: 'TIME A' },
    { position: 24, club: `${SOROCABANA} - ASF/MAGNU` },
  ];
  const sel = selectLastGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22), classification });
  assert.equal(sel.game.targetPosition, 24);
  assert.equal(sel.game.opponentPosition, 12);
});

test('selectLastGame: sem jogo disputado retorna found=false', () => {
  const games = [fakeGame('25/06', SOROCABANA, 'TIME A')]; // futuro, não disputado
  const sel = selectLastGame(games, SOROCABANA, { season: '2026', referenceDate: new Date(2026, 5, 22) });
  assert.equal(sel.found, false);
  assert.equal(sel.game, null);
});

test('formatLastGame: sem jogo mostra aviso', () => {
  const out = formatLastGame(null, 'MAGNUS');
  assert.match(out, /ÚLTIMO JOGO/);
  assert.match(out, /Sem jogo anterior/i);
});

test('formatLastGame: visitante — adversário à esquerda, placar mapeado, data e mando', () => {
  const out = formatLastGame(
    { date: '05/07', opponent: 'JUVENTUS', isHome: false, targetScore: 3, opponentScore: 1, opponentPosition: 12, targetPosition: 24 },
    'A.S.F. MAGNUS'
  );
  assert.match(out, /ÚLTIMO JOGO/);
  assert.match(out, /05\/07 \(visitante\)/);
  assert.match(out, /JUVENTUS \(12º\)  1x3  A\.S\.F\. MAGNUS \(24º\)/);
  assert.match(out, /✅/); // MAGNUS venceu 3x1
});

test('formatLastGame: mandante — time à esquerda com placar mapeado', () => {
  const out = formatLastGame(
    { date: '05/07', opponent: 'JUVENTUS', isHome: true, targetScore: 3, opponentScore: 1, opponentPosition: 12, targetPosition: 24 },
    'A.S.F. MAGNUS'
  );
  assert.match(out, /05\/07 \(mandante\)/);
  assert.match(out, /A\.S\.F\. MAGNUS \(24º\)  3x1  JUVENTUS \(12º\)/);
  assert.match(out, /✅/);
});

test('formatLastGame: derrota mostra ❌', () => {
  const out = formatLastGame(
    { date: '05/07', opponent: 'TIME A', isHome: true, targetScore: 0, opponentScore: 2 },
    'MAGNUS'
  );
  assert.match(out, /❌/);
});

test('formatLastGame: empate mostra ➖', () => {
  const out = formatLastGame(
    { date: '05/07', opponent: 'TIME A', isHome: false, targetScore: 2, opponentScore: 2 },
    'MAGNUS'
  );
  assert.match(out, /➖/);
});

test('formatLastGame: omite parênteses de posição quando ausente', () => {
  const out = formatLastGame(
    { date: '05/07', opponent: 'TIME A', isHome: true, targetScore: 1, opponentScore: 0 },
    'MAGNUS'
  );
  assert.doesNotMatch(out, /\(\d+º\)/);
});

test('buildReportParts: seção ÚLTIMO JOGO deve vir antes de PRÓXIMO JOGO', () => {
  const payload = {
    source: { category: 'Sub-7', division: 'A1', season: '2026' },
    scrapedAt: '2026-07-05T12:00:00Z',
    classification: [],
    topClassification: [],
    teamScorers: [],
    topScorers: [],
    warnings: [],
    lastGame: { date: '05/07', opponent: 'TIME A', isHome: true, targetScore: 2, opponentScore: 1, targetPosition: 24, opponentPosition: 12 },
    nextGame: { date: '12/07', time: '10:00', venue: 'GINÁSIO X', opponent: 'TIME B', isHome: false, targetPosition: 24, opponentPosition: 10 },
  };
  const opts = { targetTeam: 'MAGNUS', displayName: 'MAGNUS' };
  const parts = buildReportParts(payload, opts);

  const idxLast = parts.findIndex((p) => p.type === 'text' && /ÚLTIMO JOGO/.test(p.text));
  const idxNext = parts.findIndex((p) => p.type === 'text' && /PRÓXIMO JOGO/.test(p.text));
  assert.ok(idxLast !== -1 && idxNext !== -1, 'ambas as seções presentes');
  assert.ok(idxLast < idxNext, 'último jogo deve vir antes do próximo jogo');
});
