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
  const ast = row.apg || 0;
  const stl = row.spg || 0;
  const blk = row.bpg || 0;
  const tov = row.topg || 0;
  
  // If orb and drb are provided, optionally auto-update rpg
  const orb = row.orb || 0;
  const drb = row.drb || 0;
  if(orb > 0 || drb > 0) {
     row.rpg = orb + drb;
  }
  const reb = row.rpg || 0;
  const pf = row.pf || 0;

  row.fgPct = fga > 0 ? (fgm / fga) * 100 : 0;
  row.tpPct = tpa > 0 ? (tpm / tpa) * 100 : 0;
  row.ftPct = fta > 0 ? (ftm / fta) * 100 : 0;

  // PPG = 2pt FG * 2 + 3PM * 3 + FTM
  row.ppg = (Math.max(0, fgm - tpm) * 2) + (tpm * 3) + ftm;

  const tsDenom = 2 * (fga + 0.44 * fta);
  row.tsPct = tsDenom > 0 ? (row.ppg / tsDenom) * 100 : 0;
  
  // Effective Field Goal Percentage = (FGM + 0.5 * 3PM) / FGA
  row.efgPct = fga > 0 ? ((fgm + 0.5 * tpm) / fga) * 100 : 0;
  
  // Game Score = PTS + 0.4 * FG - 0.7 * FGA - 0.4*(FTA - FT) + 0.7 * ORB + 0.3 * DRB + STL + 0.7 * AST + 0.7 * BLK - 0.4 * PF - TOV.
  // We use rpg if orb/drb are missing
  const o_reb = orb > 0 ? orb : reb * 0.25; // proxy if none provided
  const d_reb = drb > 0 ? drb : reb * 0.75;
  row.gameScore = row.ppg + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) + 0.7 * o_reb + 0.3 * d_reb + stl + 0.7 * ast + 0.7 * blk - 0.4 * pf - tov;
}

export function ranZ() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.max(-3, Math.min(3, z)); // Clamp extreme outliers
}

export function getThemeColors() {
  // Light is defualt (no attribute). Dark has data-theme="dark".
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    bgFlash: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    bgFlashStrong: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
    textPrimary: isDark ? '#F0F0F0' : '#0C0C0C',
    textSecondary: isDark ? '#888888' : '#666666',
    accent: isDark ? '#F0F0F0' : '#0C0C0C'
  };
}
