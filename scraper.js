const fs = require('fs');
const path = require('path');
const logger = require('./src/logger');
const { fetchWithRetry } = require('./src/http');
const { parseClassification, parseScorers } = require('./src/parser');
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

  return {
    scrapedAt,
    source: {
      event: eventUrl,
      category: 'Sub-7',
      division: 'A1',
      season: '2026',
    },
    classification: window.slice,
    targetIndex: window.targetIndex,
    teamScorers,
    topScorers,
    warnings,
  };
}

module.exports = { scrape, selectTeamWindow };
