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
  // Remove sufixos comuns "- ASF/MAGNU" ou "| ATIVO" e similares para encurtar.
  // Exige 2+ caracteres após o separador para preservar variantes "- A"/"- B".
  return String(name).replace(/\s*[-|]\s*[A-Z/]{2,}.*$/, '').trim();
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

const CLASSIFICATION_COLUMNS = [
  { label: 'Pos', align: 'left', value: (r) => `${r.position}º` },
  { label: 'Clube', align: 'left', value: (r, ctx) => ctx.label || shortClub(r.club) },
  { label: 'Pts', align: 'right', value: (r) => String(r.points) },
  { label: 'J', align: 'right', value: (r) => String(r.games) },
  { label: 'V', align: 'right', value: (r) => String(r.wins) },
  { label: 'E', align: 'right', value: (r) => String(r.draws) },
  { label: 'D', align: 'right', value: (r) => String(r.losses) },
  { label: 'SG', align: 'right', value: (r) => (r.goalDiff > 0 ? `+${r.goalDiff}` : String(r.goalDiff)) },
];

function buildTableModel(rows, { highlightIndex = -1, highlightLabel = null } = {}) {
  return {
    columns: CLASSIFICATION_COLUMNS.map((c) => ({ label: c.label, align: c.align })),
    rows: rows.map((r, i) => {
      const ctx = { label: i === highlightIndex ? highlightLabel : null };
      return {
        values: CLASSIFICATION_COLUMNS.map((c) => c.value(r, ctx)),
        highlight: i === highlightIndex,
      };
    }),
  };
}

function renderTableText(model) {
  const widths = model.columns.map((c, ci) =>
    Math.max(c.label.length, ...model.rows.map((r) => r.values[ci].length)));
  const row = (cells, gutter) =>
    gutter + cells.map((v, ci) => pad(v, widths[ci], model.columns[ci].align)).join(' ');
  const lines = [];
  if (model.title) lines.push(model.title);
  lines.push('```');
  lines.push(row(model.columns.map((c) => c.label), '  '));
  model.rows.forEach((r) => lines.push(row(r.values, r.highlight ? '▸ ' : '  ')));
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

function withPosition(name, position) {
  return position != null ? `${name} (${position}º)` : name;
}

function formatNextGame(nextGame, teamLabel) {
  if (!nextGame) {
    return '📅 *PRÓXIMO JOGO*\n_⚠️ Sem próximo jogo agendado._';
  }
  const opponent = withPosition(truncate(shortClub(nextGame.opponent), 34), nextGame.opponentPosition);
  const team = withPosition(teamLabel, nextGame.targetPosition);
  const matchup = nextGame.isHome
    ? `${team} x ${opponent}`
    : `${opponent} x ${team}`;
  const mando = nextGame.isHome ? 'mandante' : 'visitante';
  const lines = ['📅 *PRÓXIMO JOGO*'];
  lines.push(`${nextGame.date} às ${nextGame.time} (${mando})`);
  lines.push(matchup);
  if (nextGame.venue) lines.push(`📍 ${truncate(nextGame.venue, 40)}`);
  return lines.join('\n');
}

function formatTeamLabel(targetTeam) {
  return shortClub(targetTeam).toUpperCase();
}

function buildReportParts(payload, opts = {}) {
  const { targetTeam = 'TIME ALVO', displayName, stale = false } = opts;
  const teamLabel = (displayName || formatTeamLabel(targetTeam)).toUpperCase();
  const { source, classification, targetIndex, topClassification, teamScorers, topScorers, nextGame, scrapedAt, warnings = [] } = payload;

  const parts = [];

  if (stale) {
    parts.push({ type: 'text', text: `⚠️ *Dados desatualizados* (de ${formatDate(scrapedAt)} — scrape de hoje falhou)` });
  }

  parts.push({
    type: 'text',
    text: `🏆 *CLASSIFICAÇÃO — ${source.category} Divisão ${source.division}*\n_Atualizado: ${formatDate(scrapedAt)}_`,
  });

  if (classification && classification.length) {
    parts.push({
      type: 'grid',
      model: buildTableModel(classification, { highlightIndex: targetIndex, highlightLabel: teamLabel }),
    });
  } else {
    parts.push({ type: 'text', text: '⚠️ Classificação indisponível.' });
  }

  parts.push({ type: 'text', text: formatNextGame(nextGame, teamLabel) });
  parts.push({ type: 'text', text: formatTeamScorers(teamScorers, teamLabel) });

  if (topClassification && topClassification.length) {
    const model = buildTableModel(topClassification, {});
    model.title = '📊 *TOP 5 CLASSIFICAÇÃO GERAL*';
    parts.push({ type: 'grid', model });
  } else {
    parts.push({ type: 'text', text: '📊 *TOP 5 CLASSIFICAÇÃO GERAL*\n_⚠️ Classificação geral indisponível._' });
  }

  parts.push({ type: 'text', text: formatTopScorers(topScorers) });

  if (warnings.length) {
    const userVisibleWarnings = warnings.filter((w) => !w.startsWith('time alvo encontrado por match parcial'));
    if (userVisibleWarnings.length) {
      parts.push({ type: 'text', text: ['_⚠️ Avisos:_', ...userVisibleWarnings.map((w) => `• ${w}`)].join('\n') });
    }
  }

  return parts;
}

function format(payload, opts = {}) {
  return buildReportParts(payload, opts)
    .map((p) => (p.type === 'grid' ? renderTableText(p.model) : p.text))
    .join('\n\n');
}

module.exports = { format, buildReportParts, buildTableModel, renderTableText, formatNextGame, shortClub, truncate, pad };
