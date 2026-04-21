function getTier(count, thresholds) {
  if (count >= thresholds[3]) return { tier: 'hof', count, next: null };
  if (count >= thresholds[2]) return { tier: 'gold', count, next: thresholds[3] };
  if (count >= thresholds[1]) return { tier: 'silver', count, next: thresholds[2] };
  if (count >= thresholds[0]) return { tier: 'bronze', count, next: thresholds[1] };
  return { tier: 'none', count, next: thresholds[0] };
}

export const MILESTONES = [
  {
    id: 'triple-double',
    title: 'Triple-Double',
    description: 'Record triple-doubles.',
    icon: '🔥',
    evaluate: (data) => {
      const count = data.filter(game => {
        let c = 0;
        if (game.ppg >= 10) c++;
        if (game.rpg >= 10) c++;
        if (game.apg >= 10) c++;
        if (game.spg >= 10) c++;
        if (game.bpg >= 10) c++;
        return c >= 3;
      }).length;
      return getTier(count, [1, 5, 10, 25]);
    }
  },
  {
    id: 'volume-scorer',
    title: 'Volume Scorer',
    description: 'Score 40+ points in games.',
    icon: '🏀',
    evaluate: (data) => {
      const count = data.filter(game => game.ppg >= 40).length;
      return getTier(count, [1, 3, 10, 20]);
    }
  },
  {
    id: 'club-50-40-90',
    title: '50-40-90 Club',
    description: 'Games meeting 50/40/90 efficiency (min 10 FGA).',
    icon: '🎯',
    evaluate: (data) => {
      const count = data.filter(game => {
        if (game.fga < 10) return false;
        const fg = game.fga > 0 ? (game.fgm / game.fga) * 100 : 0;
        const tp = game.tpa > 0 ? (game.tpm / game.tpa) * 100 : 0;
        const ft = game.fta > 0 ? (game.ftm / game.fta) * 100 : 0;
        return fg >= 50 && tp >= 40 && ft >= 90;
      }).length;
      return getTier(count, [1, 5, 15, 30]);
    }
  },
  {
    id: 'lockdown',
    title: 'Lock Guard',
    description: 'Record 5+ steals and 5+ blocks.',
    icon: '🔒',
    evaluate: (data) => {
      const count = data.filter(game => game.spg >= 5 && game.bpg >= 5).length;
      return getTier(count, [1, 2, 5, 10]);
    }
  },
  {
    id: 'playmaker',
    title: 'Floor General',
    description: 'Record 15+ assists.',
    icon: '👁️',
    evaluate: (data) => {
      const count = data.filter(game => game.apg >= 15).length;
      return getTier(count, [1, 5, 15, 30]);
    }
  },
  {
    id: 'sharpshooter',
    title: 'Sharpshooter',
    description: 'Make 10+ 3-pointers.',
    icon: '☄️',
    evaluate: (data) => {
      const count = data.filter(game => game.tpm >= 10).length;
      return getTier(count, [1, 3, 10, 20]);
    }
  },
  {
    id: 'glass-cleaner',
    title: 'Glass Cleaner',
    description: 'Record 20+ rebounds.',
    icon: '🧹',
    evaluate: (data) => {
      const count = data.filter(game => game.rpg >= 20).length;
      return getTier(count, [1, 5, 15, 30]);
    }
  },
  {
    id: 'perfect-game',
    title: 'Perfect Game',
    description: 'Shoot 100% from field (min 10 attempts).',
    icon: '💯',
    evaluate: (data) => {
      const count = data.filter(game => game.fgm >= 10 && game.fga > 0 && game.fga === game.fgm).length;
      return getTier(count, [1, 2, 5, 10]);
    }
  },
  {
    id: 'iron-man',
    title: 'Iron Man',
    description: 'Play 48+ minutes options.',
    icon: '🔋',
    evaluate: (data) => {
      const count = data.filter(game => game.mpg >= 48).length;
      return getTier(count, [1, 5, 15, 30]);
    }
  },
  {
    id: 'quadruple-double',
    title: 'Quadruple-Double',
    description: 'Record quadruple-doubles.',
    icon: '👑',
    evaluate: (data) => {
      const count = data.filter(game => {
        let c = 0;
        if (game.ppg >= 10) c++;
        if (game.rpg >= 10) c++;
        if (game.apg >= 10) c++;
        if (game.spg >= 10) c++;
        if (game.bpg >= 10) c++;
        return c >= 4;
      }).length;
      return getTier(count, [1, 2, 5, 10]);
    }
  }
];
