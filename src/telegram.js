const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.telegram.org';

function isConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

async function sendPhoto(
  filePath,
  { token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID } = {},
) {
  if (!token || !chatId) {
    throw new Error('Telegram não configurado: defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID');
  }

  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('photo', new Blob([buffer], { type: 'image/png' }), path.basename(filePath));

  const timeoutMs = Number(process.env.HTTP_TIMEOUT_MS || 15000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API_BASE}/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const desc = data.description || res.statusText || 'erro desconhecido';
    // não incluir a URL/token na mensagem
    throw new Error(`Telegram sendPhoto falhou: HTTP ${res.status} — ${desc}`);
  }
  return data.result;
}

module.exports = { isConfigured, sendPhoto, API_BASE };
