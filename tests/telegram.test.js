const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const telegram = require('../src/telegram');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-tg-'));
const pngPath = path.join(tmpDir, 'classificacao.png');
fs.writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

function clearEnv(t) {
  const prevT = process.env.TELEGRAM_BOT_TOKEN;
  const prevC = process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  t.after(() => {
    if (prevT !== undefined) process.env.TELEGRAM_BOT_TOKEN = prevT; else delete process.env.TELEGRAM_BOT_TOKEN;
    if (prevC !== undefined) process.env.TELEGRAM_CHAT_ID = prevC; else delete process.env.TELEGRAM_CHAT_ID;
  });
}

function setEnv(t, token, chatId) {
  clearEnv(t);
  process.env.TELEGRAM_BOT_TOKEN = token;
  process.env.TELEGRAM_CHAT_ID = chatId;
}

test('isConfigured: false quando faltam as env vars', (t) => {
  clearEnv(t);
  assert.equal(telegram.isConfigured(), false);
});

test('isConfigured: true quando ambas as env vars estão setadas', (t) => {
  setEnv(t, 'TESTTOKEN', '@canal');
  assert.equal(telegram.isConfigured(), true);
});

test('sendPhoto: lança quando não configurado', async (t) => {
  clearEnv(t);
  await assert.rejects(() => telegram.sendPhoto(pngPath), /não configurado/i);
});

test('sendPhoto: sucesso quando a API responde ok:true', async (t) => {
  setEnv(t, 'TESTTOKEN', '@canal');
  let captured;
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    captured = { url, opts };
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({ ok: true, result: { message_id: 42 } }) };
  });

  const result = await telegram.sendPhoto(pngPath);

  assert.equal(result.message_id, 42);
  assert.equal(captured.opts.method, 'POST');
  assert.ok(captured.url.startsWith('https://api.telegram.org/botTESTTOKEN/sendPhoto'));
  assert.ok(captured.opts.body instanceof FormData);
  assert.equal(captured.opts.body.get('chat_id'), '@canal');
});

test('sendPhoto: lança quando a API responde ok:false / HTTP 4xx', async (t) => {
  setEnv(t, 'TESTTOKEN', '@canal');
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false, status: 400, statusText: 'Bad Request',
    json: async () => ({ ok: false, description: 'chat not found' }),
  }));
  await assert.rejects(() => telegram.sendPhoto(pngPath), /400.*chat not found/);
});

test('sendPhoto: lança quando a API responde HTTP 200 com ok:false', async (t) => {
  setEnv(t, 'TESTTOKEN', '@canal');
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true, status: 200, statusText: 'OK',
    json: async () => ({ ok: false, description: 'chat not found' }),
  }));
  await assert.rejects(() => telegram.sendPhoto(pngPath), /200.*chat not found/);
});
