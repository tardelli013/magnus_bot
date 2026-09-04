const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const CHECKSUM_FILE = 'checksums.json';

function checksumFile(dataDir) {
  return path.join(dataDir, CHECKSUM_FILE);
}

function stableScorer(scorer) {
  return stableValue({
    name: scorer.name,
    club: scorer.club,
    goals: scorer.goals,
  });
}

function stableScorers(scorers) {
  return scorers
    .map(stableScorer)
    .sort((a, b) => {
      const goals = Number(b.goals || 0) - Number(a.goals || 0);
      if (goals !== 0) return goals;
      const club = String(a.club || '').localeCompare(String(b.club || ''), 'pt-BR');
      if (club !== 0) return club;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
}

function stableValue(value, key = null) {
  if (Array.isArray(value)) {
    if (key === 'teamScorers' || key === 'topScorers') return stableScorers(value);
    return value.map((item) => stableValue(item));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .filter((key) => key !== 'scrapedAt')
    .sort()
    .reduce((acc, key) => {
      acc[key] = stableValue(value[key], key);
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
