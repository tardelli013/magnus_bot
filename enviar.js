#!/usr/bin/env node
require('dotenv').config();

const logger = require('./src/logger');
const cache = require('./src/cache');
const { scrape } = require('./scraper');
const { format } = require('./formatter');

const FLAGS = {
  dryRun: process.argv.includes('--dry-run'),
  fromCache: process.argv.includes('--from-cache'),
  listGroups: process.argv.includes('--list-groups'),
  listen: process.argv.includes('--listen'),
  noScorers: process.argv.includes('--no-scorers'),
  help: process.argv.includes('--help') || process.argv.includes('-h'),
};

function printHelp() {
  console.log(`
magnus-bot — bot WhatsApp do campeonato de futsal ADM (Sub-7 A1)

Uso:
  node enviar.js                  scrape + formata + envia
  node enviar.js --dry-run        scrape + formata + printa, NÃO envia
  node enviar.js --from-cache     usa data/last-run.json (não bate no site)
  node enviar.js --no-scorers     pula artilharia
  node enviar.js --list-groups    lista grupos disponíveis e sai
  node enviar.js --listen         escuta mensagens; imprime o ID do grupo quando você enviar uma
  node enviar.js --help           esta ajuda

Variáveis de ambiente (.env):
  WHATSAPP_GROUP_ID   ID do grupo destino (use --list-groups para descobrir)
  TARGET_TEAM         nome do time alvo
  EVENT_URL           URL base do evento
  ALLOW_STALE_CACHE   true para enviar cache antigo em caso de falha do scrape
  DEBUG               true para logs DEBUG
`.trim());
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

async function runListGroups() {
  const { start, listGroups, shutdown } = require('./whatsapp');
  const client = await start();
  try {
    const groups = await listGroups(client);
    if (!groups.length) {
      logger.warn('nenhum grupo encontrado');
      return;
    }
    console.log('\nGrupos disponíveis:');
    groups
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((g) => {
        console.log(`  ${g.id}\n    └─ "${g.name}" (${g.participants} participantes)`);
      });
    console.log(`\nCopie o ID e cole em WHATSAPP_GROUP_ID no .env`);
  } finally {
    await shutdown(client);
  }
}

async function runListen() {
  const { start, listenForGroupId, shutdown } = require('./whatsapp');
  const client = await start();
  try {
    await listenForGroupId(client);
  } finally {
    await shutdown(client);
  }
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

  if (FLAGS.listGroups) {
    await runListGroups();
    return;
  }

  if (FLAGS.listen) {
    await runListen();
    return;
  }

  const targetTeam = requireEnv('TARGET_TEAM');
  const displayName = process.env.TARGET_TEAM_DISPLAY || targetTeam;

  const { payload, stale } = await obtainPayload();
  const message = format(payload, { targetTeam, displayName, stale });

  if (FLAGS.dryRun) {
    console.log('\n=== DRY RUN — mensagem que SERIA enviada ===\n');
    console.log(message);
    console.log('\n=== fim ===');
    return;
  }

  const groupId = requireEnv('WHATSAPP_GROUP_ID');
  const { start, sendToGroup, shutdown } = require('./whatsapp');
  const client = await start();
  try {
    await sendToGroup(client, groupId, message);
  } finally {
    await shutdown(client);
  }
}

main().catch((err) => {
  logger.error(err.message);
  if (process.env.DEBUG === 'true') console.error(err.stack);
  process.exit(1);
});
