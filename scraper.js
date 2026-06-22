const fs = require('fs');
const path = require('path');
const logger = require('./src/logger');
const { fetchWithRetry } = require('./src/http');
const { parseClassification, parseScorers, parseGames } = require('./src/parser');
const { matchesTeam } = require('./src/normalize');

const DEBUG_DIR = path.join(__dirname, 'debug');

function ensureDebugDir() {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

function saveDebugHtml(label, html) {
  try {
    ensureDebugDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(DEBUG_DIR, `${stamp}-${label}.html`);
    fs.writeFileSync(file, html);
    logger.warn(`HTML salvo em debug/: ${file}`);
  } catch (e) {
    logger.error('falha ao salvar debug HTML:', e.message);
  }
}

function selectTeamWindow(classification, targetTeam, before = 3, after = 3) {
  const warnings = [];
  let idx = classification.findIndex((row) => {
    const m = matchesTeam(row.club, targetTeam);
    return m.match && !m.partial;
  });

  if (idx === -1) {
    idx = classification.findIndex((row) => matchesTeam(row.club, targetTeam).match);
    if (idx !== -1) {
      warnings.push(`time alvo encontrado por match parcial: "${classification[idx].club}"`);
    }
  }

  if (idx === -1) {
    return { found: false, slice: [], targetIndex: -1, warnings: ['time alvo não encontrado na classificação'] };
  }

  const start = Math.max(0, idx - before);
  const end = Math.min(classification.length, idx + after + 1);
  const slice = classification.slice(start, end);
  const targetIndex = idx - start;

  return { found: true, slice, targetIndex, warnings };
}

function dateKey(dateStr, season) {
  const m = String(dateStr).match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(season, 10) || new Date().getFullYear();
  return year * 10000 + month * 100 + day;
}

function positionOf(classification, name) {
  if (!classification || !classification.length) return null;
  const row = classification.find((r) => matchesTeam(r.club, name).match);
  return row ? row.position : null;
}

function selectNextGame(games, targetTeam, { season, referenceDate = new Date(), classification = [] } = {}) {
  const refKey =
    referenceDate.getFullYear() * 10000 +
    (referenceDate.getMonth() + 1) * 100 +
    referenceDate.getDate();

  const upcoming = games
    .filter((g) => matchesTeam(g.home, targetTeam).match || matchesTeam(g.away, targetTeam).match)
    .map((g) => ({ game: g, key: dateKey(g.date, season) }))
    .filter(({ game, key }) => !game.played && key != null && key >= refKey)
    .sort((a, b) => a.key - b.key);

  if (!upcoming.length) {
    return { found: false, game: null, warnings: ['nenhum jogo futuro encontrado para o time alvo'] };
  }

  const g = upcoming[0].game;
  const isHome = matchesTeam(g.home, targetTeam).match;
  const opponent = isHome ? g.away : g.home;

  return {
    found: true,
    game: {
      date: g.date,
      time: g.time,
      venue: g.venue,
      opponent,
      isHome,
      targetPosition: positionOf(classification, targetTeam),
      opponentPosition: positionOf(classification, opponent),
    },
    warnings: [],
  };
}

async function scrape({ eventUrl, targetTeam, includeScorers = true } = {}) {
  if (!eventUrl) throw new Error('scraper: eventUrl obrigatório');
  if (!targetTeam) throw new Error('scraper: targetTeam obrigatório');

  const scrapedAt = new Date().toISOString();
  const warnings = [];

  // --- Classificação ---
  logger.info(`scraping classificação: ${eventUrl}`);
  let fullClassification;
  try {
    const html = await fetchWithRetry(eventUrl);
    fullClassification = parseClassification(html);
    logger.info(`classificação OK: ${fullClassification.length} times`);
  } catch (err) {
    logger.error('falha no scrape da classificação:', err.message);
    if (err.html) saveDebugHtml('classification-parse-error', err.html);
    throw err;
  }

  const window = selectTeamWindow(fullClassification, targetTeam, 3, 3);
  warnings.push(...window.warnings);
  if (!window.found) {
    logger.warn('time alvo NÃO encontrado na classificação');
  } else {
    logger.info(`time alvo na pos ${fullClassification.findIndex((r) => matchesTeam(r.club, targetTeam).match) + 1}`);
  }

  // --- Artilharia ---
  let teamScorers = [];
  let topScorers = [];

  if (includeScorers) {
    const scorersUrl = eventUrl.replace(/\/?$/, '/artilharia');
    logger.info(`scraping artilharia: ${scorersUrl}`);
    try {
      const html = await fetchWithRetry(scorersUrl);
      const { scorers, warnings: pw } = parseScorers(html);
      warnings.push(...pw);
      topScorers = scorers.slice(0, 5);
      teamScorers = scorers
        .filter((s) => matchesTeam(s.club, targetTeam).match)
        .map((s) => ({ name: s.name, goals: s.goals }));
      logger.info(`artilharia OK: ${scorers.length} jogadores, ${teamScorers.length} do time alvo`);
    } catch (err) {
      logger.warn('falha no scrape da artilharia (segue só com classificação):', err.message);
      warnings.push(`artilharia indisponível: ${err.message}`);
    }
  } else {
    warnings.push('artilharia pulada por --no-scorers');
  }

  // --- Próximo jogo ---
  const season = '2026';
  let nextGame = null;
  const gamesUrl = eventUrl.replace(/\/?$/, '/jogos');
  logger.info(`scraping jogos: ${gamesUrl}`);
  try {
    const html = await fetchWithRetry(gamesUrl);
    const games = parseGames(html);
    const sel = selectNextGame(games, targetTeam, { season, classification: fullClassification });
    warnings.push(...sel.warnings);
    nextGame = sel.game;
    logger.info(
      nextGame
        ? `próximo jogo: ${nextGame.date} ${nextGame.time} vs ${nextGame.opponent}`
        : `jogos OK: ${games.length} jogos, nenhum futuro para o time alvo`
    );
  } catch (err) {
    logger.warn('falha no scrape dos jogos (segue sem próximo jogo):', err.message);
    warnings.push(`próximo jogo indisponível: ${err.message}`);
  }

  return {
    scrapedAt,
    source: {
      event: eventUrl,
      category: 'Sub-7',
      division: 'A1',
      season,
    },
    classification: window.slice,
    targetIndex: window.targetIndex,
    topClassification: fullClassification.slice(0, 5),
    teamScorers,
    topScorers,
    nextGame,
    warnings,
  };
}

module.exports = { scrape, selectTeamWindow, selectNextGame };
