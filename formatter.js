function pad(s, width, align = 'left') {
  const str = String(s);
  if (str.length >= width) return str.slice(0, width);
  const space = ' '.repeat(width - str.length);
  return align === 'right' ? space + str : str + space;
}

function truncate(s, max) {
  const str = String(s);
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

function shortClub(name) {
  // Remove sufixos comuns "- ASF/MAGNU" e similares para encurtar
  return name.replace(/\s*-\s*[A-Z/]{2,}.*$/, '').trim();
}

function formatDate(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function formatClassificationTable(slice, targetIndex, displayLabel) {
  const lines = [];
  lines.push('```');
  lines.push('Pos  Clube                   Pts  J  V  E  D');
  slice.forEach((row, i) => {
    const isTarget = i === targetIndex;
    const pos = pad(String(row.position) + 'º', 4);
    const clubName = isTarget && displayLabel ? displayLabel : shortClub(row.club);
    const club = pad(truncate(clubName, 22), 22);
    const pts = pad(row.points, 3, 'right');
    const j = pad(row.games, 2, 'right');
    const v = pad(row.wins, 2, 'right');
    const e = pad(row.draws, 2, 'right');
    const d = pad(row.losses, 2, 'right');
    lines.push(`${pos}  ${club}  ${pts} ${j} ${v} ${e} ${d}`);
  });
  lines.push('```');
  return lines.join('\n');
}

function formatTeamScorers(teamScorers, teamLabel) {
  if (!teamScorers || teamScorers.length === 0) {
    return `⚽ *ARTILHEIROS — ${teamLabel}*\n_⚠️ Sem artilheiros do time no momento._`;
  }
  const lines = [`⚽ *ARTILHEIROS — ${teamLabel}*`];
  teamScorers.forEach((s, i) => {
    const golLabel = s.goals === 1 ? 'gol' : 'gols';
    lines.push(`${i + 1}. ${s.name} — ${s.goals} ${golLabel}`);
  });
  return lines.join('\n');
}

function formatTopScorers(topScorers) {
  if (!topScorers || topScorers.length === 0) {
    return '🔥 *TOP 5 ARTILHEIROS GERAIS*\n_⚠️ Artilharia indisponível._';
  }
  const lines = ['🔥 *TOP 5 ARTILHEIROS GERAIS*'];
  topScorers.forEach((s) => {
    const club = truncate(shortClub(s.club), 22);
    const golLabel = s.goals === 1 ? 'gol' : 'gols';
    lines.push(`${s.position}. ${s.name} (${club}) — ${s.goals} ${golLabel}`);
  });
  return lines.join('\n');
}

function formatTeamLabel(targetTeam) {
  return shortClub(targetTeam).toUpperCase();
}

function format(payload, opts = {}) {
  const { targetTeam = 'TIME ALVO', displayName, stale = false } = opts;
  const teamLabel = (displayName || formatTeamLabel(targetTeam)).toUpperCase();
  const { source, classification, targetIndex, topClassification, teamScorers, topScorers, scrapedAt, warnings = [] } = payload;

  const parts = [];

  if (stale) {
    parts.push(`⚠️ *Dados desatualizados* (de ${formatDate(scrapedAt)} — scrape de hoje falhou)\n`);
  }

  parts.push(`🏆 *CLASSIFICAÇÃO — ${source.category} Divisão ${source.division}*`);
  parts.push(`_Atualizado: ${formatDate(scrapedAt)}_\n`);

  if (classification && classification.length) {
    parts.push(formatClassificationTable(classification, targetIndex, teamLabel));
  } else {
    parts.push(`⚠️ Classificação indisponível.`);
  }

  parts.push('');
  parts.push(formatTeamScorers(teamScorers, teamLabel));

  parts.push('');
  parts.push('📊 *TOP 5 CLASSIFICAÇÃO GERAL*');
  if (topClassification && topClassification.length) {
    parts.push(formatClassificationTable(topClassification, -1, null));
  } else {
    parts.push('_⚠️ Classificação geral indisponível._');
  }

  parts.push('');
  parts.push(formatTopScorers(topScorers));

  if (warnings.length) {
    const userVisibleWarnings = warnings.filter((w) => !w.startsWith('time alvo encontrado por match parcial'));
    if (userVisibleWarnings.length) {
      parts.push('');
      parts.push('_⚠️ Avisos:_');
      userVisibleWarnings.forEach((w) => parts.push(`• ${w}`));
    }
  }

  return parts.join('\n');
}

module.exports = { format, shortClub, truncate, pad };
