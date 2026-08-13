const CATEGORIES = Object.freeze([
  Object.freeze({
    slug: 'sub7',
    label: 'Sub-7',
    eventUrl: 'https://eventos.admfutsal.com.br/evento/908',
    division: 'A1',
    season: '2026',
  }),
  Object.freeze({
    slug: 'sub8',
    label: 'Sub-8',
    eventUrl: 'https://eventos.admfutsal.com.br/evento/909',
    division: 'A1',
    season: '2026',
  }),
  Object.freeze({
    slug: 'sub9',
    label: 'Sub-9',
    eventUrl: 'https://eventos.admfutsal.com.br/evento/910',
    division: 'A1',
    season: '2026',
  }),
  Object.freeze({
    slug: 'sub10',
    label: 'Sub-10',
    eventUrl: 'https://eventos.admfutsal.com.br/evento/911',
    division: 'A1',
    season: '2026',
  }),
]);

function getCategory(slug) {
  return CATEGORIES.find((category) => category.slug === slug) || null;
}

function imageFilename(slug) {
  if (!getCategory(slug)) throw new Error(`categoria inválida: ${slug}`);
  return `classificacao-${slug}.png`;
}

module.exports = { CATEGORIES, getCategory, imageFilename };
