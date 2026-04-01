export const METRICS_SCHEMA = Object.freeze([
  { key: 'id', label: '#' },
  { key: 'mpg', label: 'MPG' },
  { key: 'ppg', label: 'PPG', computed: true },
  { key: 'apg', label: 'APG' },
  { key: 'rpg', label: 'RPG' },
  { key: 'spg', label: 'SPG' },
  { key: 'bpg', label: 'BPG' },
  { key: 'topg', label: 'TOPG' },
  { key: 'fgm', label: 'FGM' },
  { key: 'fga', label: 'FGA' },
  { key: 'fgPct', label: 'FG%', computed: true, isPct: true },
  { key: 'tpm', label: '3PM' },
  { key: 'tpa', label: '3PA' },
  { key: 'tpPct', label: '3P%', computed: true, isPct: true },
  { key: 'ftm', label: 'FTM' },
  { key: 'fta', label: 'FTA' },
  { key: 'ftPct', label: 'FT%', computed: true, isPct: true }
]);

export const EDITABLE_KEYS = new Set(
  METRICS_SCHEMA.filter(c => !c.computed && c.key !== 'id').map(c => c.key)
);

export const COMPUTED_COLS = METRICS_SCHEMA.filter(c => c.computed);

export const SEED_DATA = [
  { id: 3, mpg: 36.5, apg: 8.2, rpg: 5.4, spg: 1.2, bpg: 0.8, topg: 2.1, fgm: 11, fga: 22, tpm: 4, tpa: 9, ftm: 6.5, fta: 7 },
  { id: 2, mpg: 34.0, apg: 9.0, rpg: 6.0, spg: 2.0, bpg: 1.0, topg: 1.8, fgm: 9, fga: 18, tpm: 3, tpa: 8, ftm: 7, fta: 8 },
  { id: 1, mpg: 30.0, apg: 10.5, rpg: 4.2, spg: 0.8, bpg: 0.2, topg: 3.5, fgm: 8, fga: 15, tpm: 2, tpa: 6, ftm: 4, fta: 5 }
];
