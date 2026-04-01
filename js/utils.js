export function formatValue(val, isPct = false) {
  if (val == null) return '0';
  if (isPct) return Math.round(val) + '%';
  const n = parseFloat(val);
  if (isNaN(n)) return '0';
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

export function computeDerived(row) {
  const fga = row.fga || 0;
  const fgm = row.fgm || 0;
  const tpa = row.tpa || 0;
  const tpm = row.tpm || 0;
  const fta = row.fta || 0;
  const ftm = row.ftm || 0;

  row.fgPct = fga > 0 ? (fgm / fga) * 100 : 0;
  row.tpPct = tpa > 0 ? (tpm / tpa) * 100 : 0;
  row.ftPct = fta > 0 ? (ftm / fta) * 100 : 0;

  // PPG = 2pt FG * 2 + 3PM * 3 + FTM
  row.ppg = (Math.max(0, fgm - tpm) * 2) + (tpm * 3) + ftm;
}

export function ranZ() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.max(-3, Math.min(3, z)); // Clamp extreme outliers
}

export function getThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    bgFlash: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
    bgFlashStrong: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)',
    textPrimary: isLight ? '#050505' : '#FFFFFF',
    textSecondary: isLight ? '#666666' : '#888888',
    accent: isLight ? '#050505' : '#FFFFFF'
  };
}
