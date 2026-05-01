self.onmessage = function (e) {
  const { iterations, avg, variance, archetypes, ageNum, heightInches, pos, dataLength } = e.data;

  const results = {
    pts: [],
    reb: [],
    ast: [],
    stl: [],
    blk: [],
    fgm: [],
    fga: [],
    tpm: [],
    tpa: [],
    ftm: [],
    fta: [],
    topg: []
  };

  const ranZ = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Widened bounds slightly (-3.5 to 3.5) to allow for rare, realistic historic outlier games
    return Math.max(-3.5, Math.min(3.5, z));
  };

  const minRatio = 1.0; 

  const action = e.data.action || "project";
  const fullRecords = [];

  for (let i = 0; i < iterations; i++) {
    // Game-level variance to simulate realistic momentum and pace
    const gameFlow = ranZ(); // Rhythm/Hot Hand modifier
    const paceFactor = 1.0 + (ranZ() * 0.05); // Game pace ± ~17.5%

    // Phase 1: MPG
    let baseMpgAvg = avg["mpg"] !== undefined && dataLength > 0 ? avg["mpg"] : 24;
    let baseMpgVar = variance["mpg"] !== undefined && dataLength > 0 ? variance["mpg"] : 5;

    let mpgMod = 1.0;
    let mpgVarMod = 1.0;
    for (const archetype of archetypes) {
      if (archetype === "facilitator") mpgMod *= 1.1;
      else if (archetype === "workhorse") mpgMod *= 1.15;
      else if (archetype === "fringe") { mpgMod *= 0.7; mpgVarMod *= 1.2; }
    }

    baseMpgAvg *= mpgMod;
    if (archetypes.includes("facilitator")) baseMpgAvg = Math.min(baseMpgAvg, 42);
    if (archetypes.includes("workhorse")) baseMpgAvg = Math.min(baseMpgAvg, 44);
    baseMpgVar *= mpgVarMod;

    let genMpg = Math.round(baseMpgAvg + ranZ() * baseMpgVar);
    if (genMpg < 0) genMpg = 0;
    // Hard cap at 48 — overtime is vanishingly rare; never let this inflate peripheral ceilings
    if (genMpg > 48) genMpg = 48;

    // Apply paceFactor so fast-paced games yield higher stat volume per minute
    const currentMinRatio = (baseMpgAvg > 0 ? genMpg / baseMpgAvg : genMpg > 0 ? 1 : 0) * paceFactor;

    // Phase 2: Volume
    let fgaAvg = (dataLength > 0 ? avg["fga"] || 0 : 10) * currentMinRatio;
    let fgaVar = (dataLength > 0 ? variance["fga"] || 3 : 3) * Math.sqrt(currentMinRatio);
    let tpaAvg = (dataLength > 0 ? avg["tpa"] || 0 : 3) * currentMinRatio;
    let tpaVar = (dataLength > 0 ? variance["tpa"] || 1 : 1) * Math.sqrt(currentMinRatio);
    let ftaAvg = (dataLength > 0 ? avg["fta"] || 0 : 2) * currentMinRatio;
    let ftaVar = (dataLength > 0 ? variance["fta"] || 1 : 1) * Math.sqrt(currentMinRatio);
    let tovAvg = (dataLength > 0 ? avg["topg"] || 0 : 1.5) * currentMinRatio;
    let tovVar = (dataLength > 0 ? variance["topg"] || 1 : 1) * Math.sqrt(currentMinRatio);

    // Apply gameFlow: a player in rhythm shoots more and turns it over slightly less
    let mod_fga = 1.0 + (gameFlow * 0.06);
    let mod_tpa = 1.0 + (gameFlow * 0.06);
    let mod_fta = 1.0 + (gameFlow * 0.04);
    let mod_tov = 1.0 - (gameFlow * 0.03);

    for (const arch of archetypes) {
      if (arch === "scorer") { mod_fga *= 1.35; fgaVar *= 1.15; mod_fta *= 1.2; mod_tov *= 1.1; }
      else if (arch === "playmaker") { mod_fga *= 0.85; mod_tov *= 0.75; }
      else if (arch === "sharp") { mod_tpa *= 1.6; tpaVar *= 1.25; mod_fga *= 1.15; }
      else if (arch === "defender") { mod_fga *= 0.8; }
      else if (arch === "glass") { mod_tpa *= 0.4; mod_fta *= 1.2; }
      else if (arch === "slasher") { mod_fta *= 1.5; ftaVar *= 1.2; mod_fga *= 1.2; fgaVar *= 1.1; mod_tpa *= 0.6; }
      else if (arch === "erratic") { fgaVar *= 2.5; tpaVar *= 2.5; ftaVar *= 2.5; tovVar *= 2.5; }
      else if (arch === "clutch") { mod_fta *= 1.3; mod_tov *= 0.65; fgaVar *= 0.75; tovVar *= 0.75; }
      else if (arch === "fringe") { mod_fga *= 0.7; mod_tpa *= 0.7; mod_fta *= 0.7; fgaVar *= 1.2; }
    }

    if (pos === "PG") { mod_tpa *= 1.25; mod_fta *= 1.1; mod_tov *= 1.3; }
    else if (pos === "SG") { mod_tpa *= 1.3; }
    else if (pos === "G") { mod_tpa *= 1.25; mod_fta *= 1.05; mod_tov *= 1.15; }
    else if (pos === "SF") { mod_fta *= 1.1; }
    else if (pos === "F") { mod_tpa *= 0.75; mod_fta *= 1.15; }
    else if (pos === "PF") { mod_tpa *= 0.5; mod_fta *= 1.2; }
    else if (pos === "C") { mod_tpa *= 0.1; mod_fta *= 1.4; mod_tov *= 1.2; }

    fgaAvg *= mod_fga; tpaAvg *= mod_tpa; ftaAvg *= mod_fta; tovAvg *= mod_tov;

    let fga = Math.round(fgaAvg + ranZ() * fgaVar);
    let tpa = Math.round(tpaAvg + ranZ() * tpaVar);
    let fta = Math.round(ftaAvg + ranZ() * ftaVar);
    let topg = Math.round(tovAvg + ranZ() * tovVar);

    if (fga < 0) fga = 0; if (tpa < 0) tpa = 0; if (fta < 0) fta = 0; if (topg < 0) topg = 0;
    if (tpa > fga) tpa = fga;

    // Phase 3: Efficiencies
    let histFga = dataLength > 0 ? avg["fga"] || 0 : 0;
    let histFgm = dataLength > 0 ? avg["fgm"] || 0 : 0;
    const histFgPct = histFga > 0 ? histFgm / histFga : 0.45;
    
    let histTpa = dataLength > 0 ? avg["tpa"] || 0 : 0;
    let histTpm = dataLength > 0 ? avg["tpm"] || 0 : 0;
    const histTpPct = histTpa > 0 ? histTpm / histTpa : 0.35;
    
    let histFta = dataLength > 0 ? avg["fta"] || 0 : 0;
    let histFtm = dataLength > 0 ? avg["ftm"] || 0 : 0;
    const histFtPct = histFta > 0 ? histFtm / histFta : 0.75;

    let fgPctVar = 0.12, tpPctVar = 0.18, ftPctVar = 0.1;

    for (const arch of archetypes) {
      if (arch === "erratic") { fgPctVar *= 2.0; tpPctVar *= 2.0; ftPctVar *= 2.0; }
      else if (arch === "clutch") { ftPctVar *= 0.5; }
      else if (arch === "scorer") { fgPctVar *= 0.95; tpPctVar *= 0.95; ftPctVar *= 0.95; }
      else if (arch === "sharp") { tpPctVar *= 0.7; }
    }

    // Apply gameFlow: a player in rhythm shoots more accurately, creating realistic volume/efficiency correlation
    let nightlyFgPct = histFgPct + (gameFlow * 0.025) + ranZ() * fgPctVar;
    let nightlyTpPct = histTpPct + (gameFlow * 0.03) + ranZ() * tpPctVar;
    let nightlyFtPct = histFtPct + (gameFlow * 0.015) + ranZ() * ftPctVar;

    nightlyFgPct = Math.max(0.1, Math.min(1.0, nightlyFgPct));
    nightlyTpPct = Math.max(0.0, Math.min(1.0, nightlyTpPct));
    nightlyFtPct = Math.max(0.0, Math.min(1.0, nightlyFtPct));

    let fgm = Math.round(fga * nightlyFgPct);
    let tpm = Math.round(tpa * nightlyTpPct);
    let ftm = Math.round(fta * nightlyFtPct);

    if (tpm > fgm) {
      fgm = Math.min(tpm + Math.floor(Math.random() * 3), fga);
      if (tpm > fgm) tpm = fgm;
    }

    // Peripherals
    const periphKeys = ["rpg", "apg", "spg", "bpg"];
    const defaults = { rpg: 4, apg: 2, spg: 0.8, bpg: 0.4 };
    
    let rec = { mpg: genMpg, fga, tpa, fta, topg, fgm, tpm, ftm };

    periphKeys.forEach(key => {
      let baseAvg = dataLength > 0 ? avg[key] || 0 : defaults[key];
      let pAvg = baseAvg * currentMinRatio;
      // Accumulate pVar *additively* outside the loop — stacking archetypes must not
      // multiply variance on top of itself, which causes assists to snowball.
      let baseVar = (dataLength > 0 ? variance[key] || Math.max(pAvg * 0.3, 1) : Math.max(defaults[key] * 0.3, 1)) * Math.sqrt(currentMinRatio);
      let varBonus = 0;

      let modAvg = 1.0;
      for (const arch of archetypes) {
        if (arch === "playmaker" && key === "apg") { modAvg *= 1.5; varBonus += baseVar * 0.2; }
        if (arch === "defender") {
          if (["spg", "bpg"].includes(key)) { modAvg *= 1.7; varBonus += baseVar * 0.3; }
          if (key === "rpg") modAvg *= 1.15;
        }
        if (arch === "glass") {
          if (key === "rpg") { modAvg *= 1.6; varBonus += baseVar * 0.2; }
          if (key === "bpg") { modAvg *= 1.35; varBonus += baseVar * 0.1; }
        }
        if (arch === "facilitator" && key === "apg") { modAvg *= 1.6; varBonus += baseVar * 0.3; }
        if (arch === "erratic") varBonus += baseVar * 1.5;
        if (arch === "fringe") { modAvg *= 0.7; varBonus += baseVar * 0.2; }
      }

      let pVar = baseVar + varBonus;

      if (pos === "PG") {
        if (key === "apg") modAvg *= 1.4;
        if (key === "rpg") modAvg *= 0.6;
      } else if (pos === "SG") {
        if (key === "apg") modAvg *= 1.1;
        if (key === "rpg") modAvg *= 0.8;
      } else if (pos === "G") {
        if (key === "apg") modAvg *= 1.25;
        if (key === "rpg") modAvg *= 0.7;
      } else if (pos === "PF") {
        if (key === "rpg") modAvg *= 1.3;
        if (key === "bpg") modAvg *= 1.4;
        if (key === "apg") modAvg *= 0.7;
      } else if (pos === "F") {
        if (key === "rpg") modAvg *= 1.15;
        if (key === "bpg") modAvg *= 1.2;
        if (key === "apg") modAvg *= 0.85;
      } else if (pos === "C") {
        if (key === "rpg") modAvg *= 1.6;
        if (key === "bpg") modAvg *= 1.8;
        if (key === "apg") modAvg *= 0.5;
        if (key === "spg") modAvg *= 0.6;
      }

      if (ageNum < 23) pVar *= 1.15;
      else if (ageNum >= 30 && dataLength === 0) {
        const decline = ageNum >= 35 ? 0.9 : 0.95;
        if (["rpg", "spg", "bpg"].includes(key)) modAvg *= decline;
      }

      const heightDiff = heightInches - 78;
      if (["rpg", "bpg"].includes(key)) modAvg *= Math.max(0.5, 1 + heightDiff * 0.05);
      if (["apg", "spg"].includes(key)) modAvg *= Math.max(0.5, 1 - heightDiff * 0.03);

      pAvg *= modAvg;

      let pVal = Math.round(pAvg + ranZ() * pVar);
      if (pVal < 0) pVal = 0;

      if (key === "rpg" && pVal > 0.8 * genMpg) pVal = Math.floor(0.8 * genMpg);
      // Relative cap + hard absolute ceiling — prevents feedback loops when simulated
      // games get re-ingested and the next sim reads an inflated apg average.
      if (key === "apg") {
        if (pVal > 0.5 * genMpg) pVal = Math.floor(0.5 * genMpg);
        // Dynamic ceiling instead of a hard 15, allowing for realistic historic passing games for true point guards
        const dynamicCeiling = Math.max(18, Math.floor(baseAvg * 2.5));
        if (pVal > dynamicCeiling) pVal = dynamicCeiling;
      }
      if (key === "spg" && pVal > 0.25 * genMpg) pVal = Math.floor(0.25 * genMpg);
      if (key === "bpg" && pVal > 0.3 * genMpg) pVal = Math.floor(0.3 * genMpg);

      rec[key] = pVal;
    });

    if (rec.fga < rec.fgm) rec.fga = rec.fgm;
    if (rec.fta < rec.ftm) rec.fta = rec.ftm;
    if (rec.tpa < rec.tpm) rec.tpa = rec.tpm;
    if (rec.fga < rec.tpa) rec.fga = rec.tpa;
    if (rec.fgm < rec.tpm) rec.fgm = rec.tpm;
    if (rec.fgm - rec.tpm > rec.fga - rec.tpa) {
      rec.fgm = rec.tpm + (rec.fga - rec.tpa);
    }
    
    // Points
    let pts = (rec.fgm - rec.tpm) * 2 + rec.tpm * 3 + rec.ftm;

    if (action === "project") {
      results.pts.push(pts);
      results.reb.push(rec.rpg);
      results.ast.push(rec.apg);
      results.stl.push(rec.spg);
      results.blk.push(rec.bpg);
      results.fgm.push(rec.fgm);
      results.fga.push(rec.fga);
      results.tpm.push(rec.tpm);
      results.tpa.push(rec.tpa);
      results.ftm.push(rec.ftm);
      results.fta.push(rec.fta);
      results.topg.push(rec.topg);
    } else {
      fullRecords.push(rec);
    }
  }

  if (action === "project") {
    // Calculate percentiles
    const getPercentile = (arr, p) => {
      arr.sort((a, b) => a - b);
      const index = Math.max(0, Math.floor(p * arr.length) - 1);
      return arr[index];
    };

    const projections = {};
    for (const key in results) {
      projections[key] = {
        floor: getPercentile(results[key], 0.1),
        expected: getPercentile(results[key], 0.5),
        ceiling: getPercentile(results[key], 0.9),
        avg: results[key].reduce((a, b) => a + b, 0) / iterations
      };
    }

    self.postMessage({ type: "projection", projections });
  } else {
    self.postMessage({ type: "generation", records: fullRecords });
  }
};
