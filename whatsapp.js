const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const logger = require('./src/logger');

const AUTH_DIR = path.join(__dirname, 'auth');

function createClient() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR, clientId: 'magnus-bot' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    logger.info('escaneie o QR Code abaixo no WhatsApp do celular:');
    logger.info('(WhatsApp → Configurações → Aparelhos Conectados → Conectar Aparelho)');
    qrcode.generate(qr, { small: true });
  });

  client.on('loading_screen', (percent, message) => {
    logger.info(`carregando WhatsApp: ${percent}% ${message || ''}`);
  });

  client.on('authenticated', () => {
    logger.info('autenticado ✓ (aguardando sync de mensagens)');
  });

  client.on('auth_failure', (msg) => {
    logger.error(`falha de autenticação: ${msg}`);
  });

  client.on('change_state', (state) => {
    logger.debug(`change_state: ${state}`);
  });

  client.on('disconnected', (reason) => {
    logger.warn(`desconectado: ${reason}`);
  });

  return client;
}

function waitForReady(client, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`WhatsApp não ficou pronto em ${timeoutMs}ms (sessão expirada?)`));
    }, timeoutMs);
    client.once('ready', () => {
      clearTimeout(timer);
      resolve();
    });
    client.once('auth_failure', (msg) => {
      clearTimeout(timer);
      reject(new Error(`auth_failure: ${msg}`));
    });
  });
}

async function start() {
  const timeoutMs = Number(process.env.WHATSAPP_TIMEOUT_MS || 180000);
  const client = createClient();
  logger.info(`inicializando cliente WhatsApp (timeout ${Math.round(timeoutMs / 1000)}s)...`);
  // Não fazemos `await client.initialize()` — initialize só resolve quando 'ready' já dispara em alguns casos,
  // mas precisamos escutar o evento 'ready' que pode vir antes de initialize() retornar. Disparar sem await.
  client.initialize().catch((err) => {
    logger.error(`erro em client.initialize: ${err.message}`);
  });
  await waitForReady(client, timeoutMs);
  logger.info('WhatsApp pronto ✓');
  return client;
}

async function listGroups(client) {
  const chats = await client.getChats();
  const groups = chats.filter((c) => c.isGroup);
  return groups.map((g) => ({ id: g.id._serialized, name: g.name, participants: g.participants?.length || 0 }));
}

async function sendToGroup(client, groupId, message, media = null) {
  if (!groupId) throw new Error('sendToGroup: groupId obrigatório');
  if (!media && (!message || !message.trim())) throw new Error('sendToGroup: mensagem vazia');

  let chat;
  try {
    chat = await client.getChatById(groupId);
  } catch (err) {
    const groups = await listGroups(client);
    const list = groups.map((g) => `  ${g.id} — ${g.name}`).join('\n') || '  (nenhum grupo encontrado)';
    throw new Error(`grupo "${groupId}" não encontrado. Grupos disponíveis:\n${list}`);
  }

  if (!chat.isGroup) {
    throw new Error(`o ID "${groupId}" não corresponde a um grupo (é uma DM/contato)`);
  }

  logger.info(`→ enviando para grupo "${chat.name}" (${groupId})`);
  await chat.sendMessage(media || message);
  logger.info('mensagem enviada ✓');
}

async function listenForGroupId(client, durationMs = 5 * 60 * 1000) {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('MODO ESCUTA — envie qualquer mensagem no grupo alvo');
  logger.info(`vou capturar e imprimir o ID. Timeout: ${Math.round(durationMs / 1000)}s`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const seen = new Set();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      logger.warn('timeout do modo escuta');
      resolve();
    }, durationMs);

    client.on('message_create', async (msg) => {
      try {
        const chat = await msg.getChat();
        if (!chat.isGroup) return;
        const id = chat.id._serialized;
        if (seen.has(id)) return;
        seen.add(id);
        console.log('\n┌─────────────────────────────────────────────────────');
        console.log(`│ 📥 Mensagem recebida em grupo:`);
        console.log(`│   Nome:  "${chat.name}"`);
        console.log(`│   ID:    ${id}`);
        console.log(`│   Texto: ${(msg.body || '<sem texto>').slice(0, 60)}`);
        console.log('└─────────────────────────────────────────────────────');
        console.log('Cole o ID em WHATSAPP_GROUP_ID no seu .env');
        console.log('Pressione Ctrl+C para sair, ou envie em outro grupo para capturar mais.\n');
      } catch (e) {
        logger.debug(`erro ao processar mensagem: ${e.message}`);
      }
    });
  });
}

async function shutdown(client) {
  try {
    await client.destroy();
  } catch (e) {
    logger.debug('shutdown erro (ignorado):', e.message);
  }
}

module.exports = { start, listGroups, sendToGroup, listenForGroupId, shutdown };
