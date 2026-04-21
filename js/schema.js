export const METRICS_SCHEMA = Object.freeze([
  { key: 'id', label: '#' },
  { key: 'mpg', label: 'MPG' },
  { key: 'ppg', label: 'PPG', computed: true },
  { key: 'apg', label: 'APG' },
  { key: 'rpg', label: 'RPG' },
  { key: 'orb', label: 'ORB', advanced: true },
  { key: 'drb', label: 'DRB', advanced: true },
  { key: 'spg', label: 'SPG' },
  { key: 'bpg', label: 'BPG' },
  { key: 'topg', label: 'TOPG' },
  { key: 'pf', label: 'PF', advanced: true },
  { key: 'fgm', label: 'FGM' },
  { key: 'fga', label: 'FGA' },
  { key: 'fgPct', label: 'FG%', computed: true, isPct: true },
  { key: 'tpm', label: '3PM' },
  { key: 'tpa', label: '3PA' },
  { key: 'tpPct', label: '3P%', computed: true, isPct: true },
  { key: 'efgPct', label: 'eFG%', computed: true, isPct: true, advanced: true },
  { key: 'ftm', label: 'FTM' },
  { key: 'fta', label: 'FTA' },
  { key: 'ftPct', label: 'FT%', computed: true, isPct: true },
  { key: 'tsPct', label: 'TS%', computed: true, isPct: true },
  { key: 'gameScore', label: 'GmSc', computed: true, advanced: true }
]);

export const EDITABLE_KEYS = new Set(
  METRICS_SCHEMA.filter(c => !c.computed && c.key !== 'id').map(c => c.key)
);

export const COMPUTED_COLS = METRICS_SCHEMA.filter(c => c.computed);

export const SEED_DATA = [
  { id: 3, mpg: 36, apg: 8, rpg: 5, spg: 1, bpg: 0, topg: 2, fgm: 11, fga: 22, tpm: 4, tpa: 9, ftm: 6, fta: 7 },
  { id: 2, mpg: 34, apg: 9, rpg: 6, spg: 2, bpg: 1, topg: 1, fgm: 9, fga: 18, tpm: 3, tpa: 8, ftm: 7, fta: 8 },
  { id: 1, mpg: 30, apg: 10, rpg: 4, spg: 0, bpg: 0, topg: 3, fgm: 8, fga: 15, tpm: 2, tpa: 6, ftm: 4, fta: 5 }
];
