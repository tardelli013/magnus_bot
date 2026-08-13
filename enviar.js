#!/usr/bin/env node
require('dotenv').config();

const path = require('path');
const logger = require('./src/logger');
const cache = require('./src/cache');
const { CATEGORIES } = require('./src/categories');
const { scrape } = require('./scraper');
const { format, formatTelegramCaption } = require('./formatter');
const { renderReport, saveImage } = require('./image-renderer');
const telegram = require('./src/telegram');

function parseFlags(argv = process.argv.slice(2)) {
  return {
    fromCache: argv.includes('--from-cache'),
    noScorers: argv.includes('--no-scorers'),
    noSend: argv.includes('--no-send'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

function printHelp() {
  console.log(`
magnus-bot — gera imagens das categorias Sub-7, Sub-8, Sub-9 e Sub-10

Uso:
  node enviar.js                  scrape + gera + envia as quatro imagens
  node enviar.js --from-cache     usa os caches de cada categoria (sem acessar o site)
  node enviar.js --no-scorers     pula artilharia nas quatro categorias
  node enviar.js --no-send        gera as imagens mas não envia ao Telegram
  node enviar.js --help           esta ajuda

Variáveis de ambiente (.env):
  TARGET_TEAM          nome do time alvo
  TARGET_TEAM_DISPLAY  nome amigável exibido nas imagens
  ALLOW_STALE_CACHE    true para fallback por categoria com cache de até 24h
  DEBUG                true para logs DEBUG
  HTTP_TIMEOUT_MS      timeout HTTP em milissegundos
  TELEGRAM_BOT_TOKEN   token do bot (@BotFather)
  TELEGRAM_CHAT_ID     canal de destino: @canal ou id numérico -100...
`.trim());
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

async function obtainPayload(category, targetTeam, flags) {
  if (flags.fromCache) {
    const cached = cache.load(category.slug);
    if (!cached) throw new Error(`nenhum cache encontrado para ${category.label}`);
    logger.info(`${category.label}: usando cache (idade: ${cache.ageHours(cached).toFixed(1)}h)`);
    return { payload: cached, stale: false, cacheAgeHours: cache.ageHours(cached) };
  }

  try {
    const payload = await scrape({
      eventUrl: category.eventUrl,
      targetTeam,
      category: category.label,
      division: category.division,
      season: category.season,
      includeScorers: !flags.noScorers,
    });
    cache.save(category.slug, payload);
    return { payload, stale: false, cacheAgeHours: null };
  } catch (err) {
    logger.error(`${category.label}: scrape falhou: ${err.message}`);
    if (process.env.ALLOW_STALE_CACHE === 'true') {
      const cached = cache.load(category.slug);
      const age = cache.ageHours(cached);
      if (cached && age < 24) {
        logger.warn(`${category.label}: usando cache antigo como fallback (idade: ${age.toFixed(1)}h)`);
        return { payload: cached, stale: true, cacheAgeHours: age };
      }
    }
    throw err;
  }
}

async function processCategory(category, context) {
  const { targetTeam, displayName, flags, outputDir } = context;
  logger.info(`${category.label}: iniciando processamento (${category.eventUrl})`);

  let obtained;
  try {
    obtained = await obtainPayload(category, targetTeam, flags);
    const message = format(obtained.payload, { targetTeam, displayName, stale: obtained.stale });
    const buffer = await renderReport(obtained.payload, { targetTeam, displayName, stale: obtained.stale });
    const imagePath = await saveImage(buffer, outputDir, category.slug);

    console.log(`\n${message}\n`);
    logger.info(`${category.label}: imagem salva: ${imagePath}`);

    if (flags.noSend) {
      logger.info(`${category.label}: envio ao Telegram desabilitado (--no-send)`);
    } else if (!telegram.isConfigured()) {
      logger.warn(`${category.label}: Telegram não configurado; pulando envio`);
    } else {
      try {
        await telegram.sendPhoto(imagePath, { caption: formatTelegramCaption(obtained.payload) });
        logger.info(`${category.label}: imagem enviada ao Telegram`);
      } catch (err) {
        return { category, status: 'send_failed', imagePath, error: err };
      }
    }

    return {
      category,
      status: obtained.stale ? 'stale' : 'success',
      imagePath,
      cacheAgeHours: obtained.cacheAgeHours,
    };
  } catch (err) {
    return { category, status: 'failed', error: err };
  }
}

function printSummary(results) {
  console.log('\nResumo da execução:');
  for (const result of results) {
    let detail;
    if (result.status === 'success') detail = 'OK';
    else if (result.status === 'stale') detail = `OK (cache de ${result.cacheAgeHours.toFixed(1)}h)`;
    else if (result.status === 'send_failed') detail = `ERRO NO ENVIO: ${result.error.message}`;
    else detail = `ERRO: ${result.error.message}`;
    console.log(`${result.category.label.padEnd(6)} ${detail}`);
  }
}

async function main(argv = process.argv.slice(2)) {
  const flags = parseFlags(argv);
  if (flags.help) {
    printHelp();
    return [];
  }

  const targetTeam = requireEnv('TARGET_TEAM');
  const displayName = process.env.TARGET_TEAM_DISPLAY || targetTeam;
  const outputDir = path.join(__dirname, 'generated-images');
  const results = [];

  for (const category of CATEGORIES) {
    results.push(await processCategory(category, { targetTeam, displayName, flags, outputDir }));
  }

  printSummary(results);
  const failures = results.filter((result) => result.status === 'failed' || result.status === 'send_failed');
  if (failures.length) {
    throw new Error(`${failures.length} categoria(s) terminaram com erro`);
  }
  return results;
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(err.message);
    if (process.env.DEBUG === 'true') console.error(err.stack);
    process.exitCode = 1;
  });
}

module.exports = { main, parseFlags, obtainPayload, processCategory, printSummary };
