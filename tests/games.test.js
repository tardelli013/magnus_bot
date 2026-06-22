const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { parseGames } = require('../src/parser');
const { selectNextGame } = require('../scraper');
const { formatNextGame } = require('../formatter');

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
