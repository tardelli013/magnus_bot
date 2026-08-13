const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '..', 'data');
const { getCategory } = require('./categories');

function cacheFile(slug, dataDir = DATA_DIR) {
  if (!getCategory(slug)) throw new Error(`cache: categoria inválida: ${slug}`);
  return path.join(dataDir, `last-run-${slug}.json`);
}

function ensureDir(dataDir) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function save(slug, payload, { dataDir = DATA_DIR } = {}) {
  ensureDir(dataDir);
  const file = cacheFile(slug, dataDir);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  logger.debug(`cache salvo em ${file}`);
}

function load(slug, { dataDir = DATA_DIR } = {}) {
  const file = cacheFile(slug, dataDir);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const payload = JSON.parse(raw);
    const expected = getCategory(slug);
    if (payload?.source?.category !== expected.label) {
      logger.warn(`cache de ${slug} pertence a outra categoria`);
      return null;
    }
    return payload;
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

module.exports = { save, load, ageHours, cacheFile, DATA_DIR };
