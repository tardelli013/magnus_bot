const cheerio = require('cheerio');

function parseInt10(s) {
  const txt = String(s).trim();
  const match = txt.match(/-?\d+/);
  if (!match) return 0;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) ? n : 0;
}

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function parseClassification(html) {
  const $ = cheerio.load(html);
  const table = $('table.classification_table').first();
  if (!table.length) {
    throw new Error('parser: tabela de classificação não encontrada (seletor .classification_table)');
  }

  const rows = table.find('tbody tr').toArray();
  if (!rows.length) {
    throw new Error('parser: classificação sem linhas no tbody');
  }

  const classification = rows.map((tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 11) {
      throw new Error(`parser: linha com ${tds.length} td(s), esperado ≥11`);
    }
    const clubText = cleanText($(tds[2]).find('.col-8').first().text())
      || cleanText($(tds[2]).text());

    return {
      position: parseInt10($(tds[1]).text()),
      club: clubText,
      points: parseInt10($(tds[3]).text()),
      games: parseInt10($(tds[4]).text()),
      wins: parseInt10($(tds[5]).text()),
      draws: parseInt10($(tds[6]).text()),
      losses: parseInt10($(tds[7]).text()),
      goalsFor: parseInt10($(tds[8]).text()),
      goalsAgainst: parseInt10($(tds[9]).text()),
      goalDiff: parseInt10($(tds[10]).text()),
    };
  });

  return classification;
}

function parseScorers(html) {
  const $ = cheerio.load(html);
  const table = $('table.classification_table').first();
  if (!table.length) {
    return { scorers: [], warnings: ['artilharia: tabela não encontrada'] };
  }

  const rows = table.find('tbody tr').toArray();
  if (!rows.length) {
    return { scorers: [], warnings: ['artilharia: tabela vazia'] };
  }

  const warnings = [];
  const scorers = [];
  rows.forEach((tr, idx) => {
    const tds = $(tr).find('td');
    if (tds.length < 4) {
      warnings.push(`artilharia linha ${idx + 1}: ${tds.length} td(s), esperado ≥4`);
      return;
    }
    const name = cleanText($(tds[1]).text());
    const club = cleanText($(tds[2]).find('.col-8').first().text())
      || cleanText($(tds[2]).text());
    const goals = parseInt10($(tds[3]).text());
    if (!name || !club) {
      warnings.push(`artilharia linha ${idx + 1}: nome ou clube vazio`);
      return;
    }
    scorers.push({ position: idx + 1, name, club, goals });
  });

  return { scorers, warnings };
}

function parseGames(html) {
  const $ = cheerio.load(html);
  const table = $('table.classification_table').first();
  if (!table.length) {
    throw new Error('parser: tabela de jogos não encontrada (seletor .classification_table)');
  }

  const rows = table.find('tbody tr').toArray();
  const games = [];
  rows.forEach((tr) => {
    const $tr = $(tr);
    const names = $tr.find('span.nome_clube').map((_, s) => cleanText($(s).text())).get();
    const resultSpan = $tr.find('span.result').first();
    const tds = $tr.find('td');
    if (names.length < 2 || !resultSpan.length || tds.length < 4) return;

    const date = cleanText($(tds[0]).text());
    const time = cleanText($(tds[1]).text()).replace(/h$/i, '');
    const venue = cleanText($tr.find('a.show-ginasio-modal').first().text());
    const resultText = cleanText(resultSpan.text());
    const score = resultText.match(/(\d+)\s*x\s*(\d+)/i);
    const played = Boolean(score);

    games.push({
      date,
      time,
      venue,
      home: names[0],
      away: names[1],
      homeScore: played ? parseInt10(score[1]) : null,
      awayScore: played ? parseInt10(score[2]) : null,
      played,
    });
  });

  return games;
}

module.exports = { parseClassification, parseScorers, parseGames };
