const test = require('node:test');
const assert = require('node:assert');

const { CATEGORIES, getCategory, imageFilename } = require('../src/categories');

test('categorias: contém as quatro categorias configuradas', () => {
  assert.deepEqual(CATEGORIES.map((category) => category.slug), ['sub7', 'sub8', 'sub9', 'sub10']);
});

test('categorias: slugs, labels e URLs são únicos', () => {
  for (const field of ['slug', 'label', 'eventUrl']) {
    assert.equal(new Set(CATEGORIES.map((category) => category[field])).size, CATEGORIES.length);
  }
});

test('categorias: metadados e URLs correspondem aos eventos aprovados', () => {
  assert.deepEqual(CATEGORIES.map(({ slug, label, eventUrl, division, season }) => ({ slug, label, eventUrl, division, season })), [
    { slug: 'sub7', label: 'Sub-7', eventUrl: 'https://eventos.admfutsal.com.br/evento/908', division: 'A1', season: '2026' },
    { slug: 'sub8', label: 'Sub-8', eventUrl: 'https://eventos.admfutsal.com.br/evento/909', division: 'A1', season: '2026' },
    { slug: 'sub9', label: 'Sub-9', eventUrl: 'https://eventos.admfutsal.com.br/evento/910', division: 'A1', season: '2026' },
    { slug: 'sub10', label: 'Sub-10', eventUrl: 'https://eventos.admfutsal.com.br/evento/911', division: 'A1', season: '2026' },
  ]);
});

test('imageFilename: produz nome estável e rejeita slug desconhecido', () => {
  for (const category of CATEGORIES) {
    assert.equal(imageFilename(category.slug), `classificacao-${category.slug}.png`);
    assert.equal(getCategory(category.slug), category);
  }
  assert.throws(() => imageFilename('sub11'), /categoria inválida/);
});
