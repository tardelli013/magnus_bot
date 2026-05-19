function normalize(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTeam(clubName, targetTeam) {
  const a = normalize(clubName);
  const b = normalize(targetTeam);
  if (!a || !b) return { match: false, partial: false };
  if (a === b) return { match: true, partial: false };
  if (a.includes(b) || b.includes(a)) return { match: true, partial: true };
  return { match: false, partial: false };
}

module.exports = { normalize, matchesTeam };
