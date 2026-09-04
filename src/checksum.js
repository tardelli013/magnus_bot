const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const CHECKSUM_FILE = 'checksums.json';

function checksumFile(dataDir) {
  return path.join(dataDir, CHECKSUM_FILE);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .filter((key) => key !== 'scrapedAt')
    .sort()
    .reduce((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, {});
}

function calculate(payload) {
  const stablePayload = stableValue(payload);
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stablePayload))
    .digest('hex');
}

function loadAll(dataDir) {
  const file = checksumFile(dataDir);
  if (!fs.existsSync(file)) return {};

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    logger.warn(`falha ao ler checksums: ${err.message}`);
    return {};
  }
}

function saveAll(dataDir, checksums) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(checksumFile(dataDir), `${JSON.stringify(checksums, null, 2)}\n`);
}

function load(slug, dataDir) {
  return loadAll(dataDir)[slug] || null;
}

function save(slug, checksum, dataDir) {
  const checksums = loadAll(dataDir);
  checksums[slug] = checksum;
  saveAll(dataDir, checksums);
}

module.exports = { calculate, load, save, loadAll, saveAll, stableValue, checksumFile, CHECKSUM_FILE };
