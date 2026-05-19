const test = require('node:test');
const assert = require('node:assert');
const { sendToGroup } = require('../whatsapp');

function makeClient(chatOverrides = {}) {
  const chat = {
    isGroup: true,
    name: 'Grupo Teste',
    lastSent: null,
    sendMessage: async (payload) => { chat.lastSent = payload; },
    ...chatOverrides,
  };
  return {
    getChatById: async () => chat,
    getChats: async () => [],
    _chat: chat,
  };
}

test('sendToGroup: throws if groupId is missing', async () => {
  const client = makeClient();
  await assert.rejects(() => sendToGroup(client, null, 'msg'), /groupId obrigatório/);
});

test('sendToGroup: throws if message empty and no media', async () => {
  const client = makeClient();
  await assert.rejects(() => sendToGroup(client, 'g@g.us', ''), /mensagem vazia/);
});

test('sendToGroup: throws if message is null and no media', async () => {
  const client = makeClient();
  await assert.rejects(() => sendToGroup(client, 'g@g.us', null), /mensagem vazia/);
});

test('sendToGroup: sends text message when no media provided', async () => {
  const client = makeClient();
  await sendToGroup(client, 'g@g.us', 'olá grupo');
  assert.equal(client._chat.lastSent, 'olá grupo');
});

test('sendToGroup: sends media object when media is provided', async () => {
  const client = makeClient();
  const fakeMedia = { mimetype: 'image/png', data: 'base64abc' };
  await sendToGroup(client, 'g@g.us', null, fakeMedia);
  assert.equal(client._chat.lastSent, fakeMedia);
});
