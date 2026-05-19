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
  slice.forEach((row, i) => {
    const isTarget = i === targetIndex;
    const clubName = isTarget && displayLabel ? displayLabel : shortClub(row.club);
    const club = truncate(clubName, 20);
    const ptsLabel = row.points === 1 ? 'pt' : 'pts';
    const record = `${row.wins}V ${row.draws}E ${row.losses}D`;
    const core = `${row.position}º ${club} — ${row.points} ${ptsLabel} (${record})`;
    if (isTarget) {
      lines.push(`▶ *${core}* ◀`);
    } else {
      lines.push(core);
    }
  });
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
    const club = truncate(shortClub(s.club), 28);
    const golLabel = s.goals === 1 ? 'gol' : 'gols';
    lines.push(`${s.position}. ${s.name}`);
    lines.push(`   _${s.goals} ${golLabel} · ${club}_`);
  });
  return lines.join('\n');
}

function formatTeamLabel(targetTeam) {
  return shortClub(targetTeam).toUpperCase();
}

function format(payload, opts = {}) {
  const { targetTeam = 'TIME ALVO', displayName, stale = false } = opts;
  const teamLabel = (displayName || formatTeamLabel(targetTeam)).toUpperCase();
  const { source, classification, targetIndex, teamScorers, topScorers, scrapedAt, warnings = [] } = payload;

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
