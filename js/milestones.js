function getTier(count, thresholds) {
  if (count >= thresholds[3]) return { tier: "hof", count, next: null };
  if (count >= thresholds[2])
    return { tier: "gold", count, next: thresholds[3] };
  if (count >= thresholds[1])
    return { tier: "silver", count, next: thresholds[2] };
  if (count >= thresholds[0])
    return { tier: "bronze", count, next: thresholds[1] };
  return { tier: "none", count, next: thresholds[0] };
}

// Inline SVG icons — no emoji, renders cleanly at any size/theme
const ICONS = {
  flame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C9.5 6 6 8.5 6 13a6 6 0 0 0 12 0c0-4.5-3.5-7-6-11z"/><path d="M12 13c-.5 1.5-2 2-2 4a2 2 0 0 0 4 0c0-2-.5-2.5-2-4z"/></svg>`,
  basketball: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 6.36 15.36M12 3A9 9 0 0 0 5.64 18.36"/><path d="M3.5 9h17M3.5 15h17"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 9.7-8 11-4.5-1.3-8-6-8-11V7l8-4z"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
  crosshair: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M2 20l3-13 7 7 3-7 3 7 3-7-1 13"/><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="4" r="1" fill="currentColor" stroke="none"/></svg>`,
};

export const MILESTONES = [
  {
    id: "triple-double",
    title: "Triple-Double",
    description: "Record triple-doubles.",
    icon: ICONS.flame,
    evaluate: (data) => {
      const count = data.filter((game) => {
        let c = 0;
        if (game.ppg >= 10) c++;
        if (game.rpg >= 10) c++;
        if (game.apg >= 10) c++;
        if (game.spg >= 10) c++;
        if (game.bpg >= 10) c++;
        return c >= 3;
      }).length;
      return getTier(count, [1, 5, 10, 25]);
    },
  },
  {
    id: "volume-scorer",
    title: "Volume Scorer",
    description: "Score 40+ points in games.",
    icon: ICONS.basketball,
    evaluate: (data) => {
      const count = data.filter((game) => game.ppg >= 40).length;
      return getTier(count, [1, 3, 10, 20]);
    },
  },
  {
    id: "club-50-40-90",
    title: "50-40-90 Club",
    // Season averages: 50% FG, 40% 3P, 90% FT across the entire dataset
    description: "Average 50/40/90 efficiency across the whole season.",
    icon: ICONS.target,
    evaluate: (data) => {
      // Accumulate totals across all games (true season efficiency)
      let sumFgm = 0,
        sumFga = 0,
        sumTpm = 0,
        sumTpa = 0,
        sumFtm = 0,
        sumFta = 0;
      data.forEach((g) => {
        sumFgm += Number(g.fgm) || 0;
        sumFga += Number(g.fga) || 0;
        sumTpm += Number(g.tpm) || 0;
        sumTpa += Number(g.tpa) || 0;
        sumFtm += Number(g.ftm) || 0;
        sumFta += Number(g.fta) || 0;
      });
      // Need meaningful attempt totals (at least 5 FGA/game equivalent)
      if (sumFga < data.length * 5)
        return { tier: "none", count: 0, next: null };
      const fgPct = sumFga > 0 ? (sumFgm / sumFga) * 100 : 0;
      const tpPct = sumTpa > 0 ? (sumTpm / sumTpa) * 100 : 0;
      const ftPct = sumFta > 0 ? (sumFtm / sumFta) * 100 : 0;
      const qualifies = fgPct >= 50 && tpPct >= 40 && ftPct >= 90;
      // Single binary achievement — season either qualifies or doesn't
      return qualifies
        ? { tier: "gold", count: 1, next: null }
        : { tier: "none", count: 0, next: null };
    },
  },
  {
    id: "lockdown",
    title: "Lock Guard",
    description: "Record 5+ steals and 5+ blocks.",
    icon: ICONS.shield,
    evaluate: (data) => {
      const count = data.filter(
        (game) => game.spg >= 5 && game.bpg >= 5,
      ).length;
      return getTier(count, [1, 2, 5, 10]);
    },
  },
  {
    id: "playmaker",
    title: "Floor General",
    description: "Record 15+ assists.",
    icon: ICONS.eye,
    evaluate: (data) => {
      const count = data.filter((game) => game.apg >= 15).length;
      return getTier(count, [1, 5, 15, 30]);
    },
  },
  {
    id: "sharpshooter",
    title: "Sharpshooter",
    description: "Make 10+ 3-pointers.",
    icon: ICONS.crosshair,
    evaluate: (data) => {
      const count = data.filter((game) => game.tpm >= 10).length;
      return getTier(count, [1, 3, 10, 20]);
    },
  },
  {
    id: "glass-cleaner",
    title: "Glass Cleaner",
    description: "Record 20+ rebounds.",
    icon: ICONS.layers,
    evaluate: (data) => {
      const count = data.filter((game) => game.rpg >= 20).length;
      return getTier(count, [1, 5, 15, 30]);
    },
  },
  {
    id: "perfect-game",
    title: "Perfect Game",
    description: "Shoot 100% from field (min 10 attempts).",
    icon: ICONS.checkCircle,
    evaluate: (data) => {
      const count = data.filter(
        (game) => game.fgm >= 10 && game.fga > 0 && game.fga === game.fgm,
      ).length;
      return getTier(count, [1, 2, 5, 10]);
    },
  },
  {
    id: "iron-man",
    title: "Iron Man",
    description: "Play 48+ minutes.",
    icon: ICONS.zap,
    evaluate: (data) => {
      const count = data.filter((game) => game.mpg >= 48).length;
      return getTier(count, [1, 5, 15, 30]);
    },
  },
  {
    id: "quadruple-double",
    title: "Quadruple-Double",
    description: "Record quadruple-doubles.",
    icon: ICONS.crown,
    evaluate: (data) => {
      const count = data.filter((game) => {
        let c = 0;
        if (game.ppg >= 10) c++;
        if (game.rpg >= 10) c++;
        if (game.apg >= 10) c++;
        if (game.spg >= 10) c++;
        if (game.bpg >= 10) c++;
        return c >= 4;
      }).length;
      return getTier(count, [1, 2, 5, 10]);
    },
  },
];
