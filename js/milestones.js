export const MILESTONES = [
  {
    id: 'triple-double',
    title: 'Triple-Double',
    description: 'Record double digits in three statistical categories in a single game.',
    icon: '🔥',
    evaluate: (data) => {
      return data.some(game => {
        let count = 0;
        if (game.ppg >= 10) count++;
        if (game.rpg >= 10) count++;
        if (game.apg >= 10) count++;
        if (game.spg >= 10) count++;
        if (game.bpg >= 10) count++;
        return count >= 3;
      });
    }
  },
  {
    id: 'volume-scorer',
    title: 'Volume Scorer',
    description: 'Score 40 or more points in a single game.',
    icon: '🏀',
    evaluate: (data) => data.some(game => game.ppg >= 40)
  },
  {
    id: 'club-50-40-90',
    title: '50-40-90 Club',
    description: 'Maintain 50% FG, 40% 3PT, and 90% FT averages over 5+ games.',
    icon: '🎯',
    evaluate: (data) => {
      if (data.length < 5) return false;
      let sumFgm=0, sumFga=0, sumTpm=0, sumTpa=0, sumFtm=0, sumFta=0;
      data.forEach(game => {
        sumFgm += Number(game.fgm) || 0;
        sumFga += Number(game.fga) || 0;
        sumTpm += Number(game.tpm) || 0;
        sumTpa += Number(game.tpa) || 0;
        sumFtm += Number(game.ftm) || 0;
        sumFta += Number(game.fta) || 0;
      });
      const fg = sumFga > 0 ? (sumFgm/sumFga)*100 : 0;
      const tp = sumTpa > 0 ? (sumTpm/sumTpa)*100 : 0;
      const ft = sumFta > 0 ? (sumFtm/sumFta)*100 : 0;
      return fg >= 50 && tp >= 40 && ft >= 90;
    }
  },
  {
    id: 'lockdown',
    title: 'Lock Guard',
    description: 'Record at least 5 steals and 5 blocks in a single game.',
    icon: '🔒',
    evaluate: (data) => data.some(game => game.spg >= 5 && game.bpg >= 5)
  },
  {
    id: 'playmaker',
    title: 'Floor General',
    description: 'Record 15 or more assists in a single game.',
    icon: '👁️',
    evaluate: (data) => data.some(game => game.apg >= 15)
  },
  {
    id: 'sharpshooter',
    title: 'Sharpshooter',
    description: 'Make 10 or more 3-pointers in a single game.',
    icon: '☄️',
    evaluate: (data) => data.some(game => game.tpm >= 10)
  },
  {
    id: 'glass-cleaner',
    title: 'Glass Cleaner',
    description: 'Record 20 or more rebounds in a single game.',
    icon: '🧹',
    evaluate: (data) => data.some(game => game.rpg >= 20)
  },
  {
    id: 'perfect-game',
    title: 'Perfect Game',
    description: 'Shoot 100% from the field with at least 10 attempts.',
    icon: '💯',
    evaluate: (data) => data.some(game => game.fgm >= 10 && game.fga > 0 && game.fga === game.fgm)
  },
  {
    id: 'iron-man',
    title: 'Iron Man',
    description: 'Play 48 or more minutes in a single game.',
    icon: '🔋',
    evaluate: (data) => data.some(game => game.mpg >= 48)
  },
  {
    id: 'quadruple-double',
    title: 'Quadruple-Double',
    description: 'Record double digits in four statistical categories in a single game.',
    icon: '👑',
    evaluate: (data) => {
      return data.some(game => {
        let count = 0;
        if (game.ppg >= 10) count++;
        if (game.rpg >= 10) count++;
        if (game.apg >= 10) count++;
        if (game.spg >= 10) count++;
        if (game.bpg >= 10) count++;
        return count >= 4;
      });
    }
  }
];
