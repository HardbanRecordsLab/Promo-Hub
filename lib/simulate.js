'use strict';

// Symulator kampanii (Monte Carlo): zamiast jednej „średniej” prognozy pokazuje rozkład wyników
// – scenariusz ostrożny (p10), typowy (p50) i optymistyczny (p90) – oraz szansę awansu na kolejny poziom.
// Prawdopodobieństwo umieszczenia = rzeczywisty % akceptacji kuratora (lub ostrożne 30%, gdy brak historii).

const DEFAULT_ACCEPTANCE = 0.3;

// Deterministyczny generator (mulberry32) – te same dane dają te same wyniki.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function probabilityOf(o) {
  const r = o.stats && o.stats.acceptanceRate;
  return r === null || r === undefined ? DEFAULT_ACCEPTANCE : r / 100;
}

/**
 * outlets: [{ type, country, reach, stats }]
 * footprint (opcjonalnie): dotychczasowy dorobek { placements, reach, types: Set, countries: Set, listeners }
 * nextReq (opcjonalnie): progi następnego poziomu { placements, reach, countries, types, listeners }
 */
function simulate(outlets, { runs = 2000, seed = 7, footprint = null, nextReq = null } = {}) {
  const rand = rng(seed);
  const placements = [];
  const reach = [];
  let levelUps = 0;
  const atLeast = { 1: 0, 3: 0, 5: 0 };
  const p = outlets.map(probabilityOf);
  for (let i = 0; i < runs; i += 1) {
    let n = 0;
    let r = 0;
    const types = new Set(footprint ? footprint.types : []);
    const countries = new Set(footprint ? footprint.countries : []);
    outlets.forEach((o, j) => {
      if (rand() < p[j]) {
        n += 1;
        r += o.reach || 0;
        types.add(o.type);
        if (o.country) countries.add(o.country.toLowerCase());
      }
    });
    placements.push(n);
    reach.push(r);
    for (const k of Object.keys(atLeast)) if (n >= Number(k)) atLeast[k] += 1;
    if (footprint && nextReq) {
      const m = {
        placements: footprint.placements + n,
        reach: footprint.reach + r,
        types: types.size,
        countries: countries.size,
        listeners: footprint.listeners,
      };
      if (Object.keys(nextReq).every((k) => m[k] >= nextReq[k])) levelUps += 1;
    }
  }
  placements.sort((a, b) => a - b);
  reach.sort((a, b) => a - b);
  const pct = (x) => Math.round((x / runs) * 100);
  return {
    runs,
    placements: { p10: quantile(placements, 0.1), p50: quantile(placements, 0.5), p90: quantile(placements, 0.9) },
    reach: { p10: quantile(reach, 0.1), p50: quantile(reach, 0.5), p90: quantile(reach, 0.9) },
    chance: { atLeast1: pct(atLeast[1]), atLeast3: pct(atLeast[3]), atLeast5: pct(atLeast[5]) },
    levelUpChance: footprint && nextReq ? pct(levelUps) : null,
  };
}

module.exports = { simulate };
