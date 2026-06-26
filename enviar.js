#!/usr/bin/env node
require('dotenv').config();

const logger = require('./src/logger');
const cache = require('./src/cache');
const { scrape } = require('./scraper');
const { format } = require('./formatter');
const path = require('path');
const { renderReport, saveImage } = require('./image-renderer');

const FLAGS = {
  fromCache: process.argv.includes('--from-cache'),
  noScorers: process.argv.includes('--no-scorers'),
  help: process.argv.includes('--help') || process.argv.includes('-h'),
};

function printHelp() {
  console.log(`
magnus-bot — gera a imagem da classificação do campeonato de futsal ADM (Sub-7 A1)

Uso:
  node enviar.js                  scrape + formata + gera imagem em generated-images/
  node enviar.js --from-cache     usa data/last-run.json (não bate no site)
  node enviar.js --no-scorers     pula artilharia
  node enviar.js --help           esta ajuda

Variáveis de ambiente (.env):
  TARGET_TEAM          nome do time alvo
  TARGET_TEAM_DISPLAY  nome amigável exibido na imagem
  EVENT_URL            URL base do evento
  ALLOW_STALE_CACHE    true para usar cache antigo em caso de falha do scrape
  DEBUG                true para logs DEBUG
`.trim());
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

async function obtainPayload() {
  const eventUrl = process.env.EVENT_URL || 'https://eventos.admfutsal.com.br/evento/908';
  const targetTeam = requireEnv('TARGET_TEAM');

  if (FLAGS.fromCache) {
    const cached = cache.load();
    if (!cached) throw new Error('--from-cache: nenhum cache encontrado em data/last-run.json');
    logger.info(`usando cache (idade: ${cache.ageHours(cached).toFixed(1)}h)`);
    return { payload: cached, stale: false };
  }

  try {
    const payload = await scrape({
      eventUrl,
      targetTeam,
      includeScorers: !FLAGS.noScorers,
    });
    cache.save(payload);
    return { payload, stale: false };
  } catch (err) {
    logger.error(`scrape falhou: ${err.message}`);
    if (process.env.ALLOW_STALE_CACHE === 'true') {
      const cached = cache.load();
      if (cached && cache.ageHours(cached) < 24) {
        logger.warn(`usando cache antigo como fallback (idade: ${cache.ageHours(cached).toFixed(1)}h)`);
        return { payload: cached, stale: true };
      }
    }
    throw err;
  }
}

async function main() {
  if (FLAGS.help) {
    printHelp();
    return;
  }

  const targetTeam = requireEnv('TARGET_TEAM');
  const displayName = process.env.TARGET_TEAM_DISPLAY || targetTeam;

  const { payload, stale } = await obtainPayload();
  const message = format(payload, { targetTeam, displayName, stale });
  const buffer = await renderReport(payload, { targetTeam, displayName, stale });
  const imagePath = await saveImage(buffer, path.join(__dirname, 'generated-images'));

  console.log(`\n${message}\n`);
  logger.info(`imagem salva: ${imagePath}`);
}

main().catch((err) => {
  logger.error(err.message);
  if (process.env.DEBUG === 'true') console.error(err.stack);
  process.exit(1);
});
