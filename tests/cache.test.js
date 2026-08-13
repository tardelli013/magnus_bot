const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cache = require('../src/cache');

function payload(category, scrapedAt = new Date().toISOString()) {
  return { scrapedAt, source: { category } };
}

test('cache: categorias usam arquivos independentes', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-cache-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  cache.save('sub7', payload('Sub-7'), { dataDir });
  cache.save('sub8', payload('Sub-8'), { dataDir });

  assert.equal(cache.load('sub7', { dataDir }).source.category, 'Sub-7');
  assert.equal(cache.load('sub8', { dataDir }).source.category, 'Sub-8');
  assert.notEqual(cache.cacheFile('sub7', dataDir), cache.cacheFile('sub8', dataDir));
});

test('cache: rejeita payload pertencente a outra categoria', (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-cache-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  cache.save('sub7', payload('Sub-8'), { dataDir });
  assert.equal(cache.load('sub7', { dataDir }), null);
});

test('cache: idade é calculada por payload', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  assert.ok(cache.ageHours(payload('Sub-7', twoHoursAgo)) >= 1.99);
  assert.equal(cache.ageHours(null), Infinity);
});
