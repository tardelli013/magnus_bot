const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'last-run.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function save(payload) {
  ensureDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
  logger.debug(`cache salvo em ${CACHE_FILE}`);
}

function load() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`falha ao ler cache: ${err.message}`);
    return null;
  }
}

function ageHours(payload) {
  if (!payload || !payload.scrapedAt) return Infinity;
  const diffMs = Date.now() - new Date(payload.scrapedAt).getTime();
  return diffMs / 1000 / 3600;
}

module.exports = { save, load, ageHours, CACHE_FILE };
