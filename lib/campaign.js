'use strict';

const { CHANNELS, HUB_STEPS } = require('./channels');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OUTLETS = 25;
const DEFAULT_ACCEPTANCE = 0.3;

function addDays(isoDate, days) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// Do której fali Promo Hub trafia dany typ miejsca.
function stepForType(type) {
  return HUB_STEPS.find((s) => s.types.includes(type)) || HUB_STEPS.find((s) => s.offsetDays === 1);
}

// Optymalizator „orkiestry”: najpierw po jednym najlepszym miejscu z każdego typu
// (żeby grały wszystkie sekcje), potem kolejne rundy. Miejsca płatne tylko w ramach budżetu.
function selectOutlets(candidates, { budgetPLN = 0, max = MAX_OUTLETS } = {}) {
  const byType = new Map();
  for (const o of [...candidates].sort((a, b) => b.match.score - a.match.score)) {
    if (!byType.has(o.type)) byType.set(o.type, []);
    byType.get(o.type).push(o);
  }
  const queues = [...byType.values()];
  const picked = [];
  let spent = 0;
  while (picked.length < max && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (picked.length >= max) break;
      while (q.length) {
        const o = q.shift();
        const fee = o.collaboration.model === 'fee' ? o.collaboration.feePLN : 0;
        if (spent + fee > budgetPLN) continue;
        spent += fee;
        picked.push(o);
        break;
      }
    }
  }
  return { picked, spentPLN: Math.round(spent * 100) / 100 };
}

function forecast(outlets) {
  let placements = 0;
  let reach = 0;
  for (const o of outlets) {
    const p = o.stats && o.stats.acceptanceRate !== null && o.stats.acceptanceRate !== undefined
      ? o.stats.acceptanceRate / 100
      : DEFAULT_ACCEPTANCE;
    placements += p;
    reach += p * (o.reach || 0);
  }
  return { placements: Math.round(placements * 10) / 10, reach: Math.round(reach) };
}

// Buduje pełny plan kampanii: fale zgłoszeń Promo Hub + zadania w kanałach oficjalnych.
function buildPlan({ candidates, budgetPLN, releaseDate, today }) {
  const { picked, spentPLN } = selectOutlets(candidates, { budgetPLN });
  const waves = new Map();
  for (const o of picked) {
    const step = stepForType(o.type);
    let date = addDays(releaseDate, step.offsetDays);
    if (date < today) date = today;
    const key = `${date}|${step.name}`;
    if (!waves.has(key)) waves.set(key, { date, name: step.name, how: step.how, outletIds: [], outlets: [] });
    const w = waves.get(key);
    w.outletIds.push(o.id);
    w.outlets.push({ id: o.id, name: o.name, type: o.type, model: o.collaboration.model, score: o.match.score });
  }

  const tasks = [
    ...CHANNELS.filter((c) => c.cost !== 'paid').map((c) => ({
      id: c.id, name: c.name, group: c.group, how: c.how, url: c.url, region: c.region, impact: c.impact,
      date: addDays(releaseDate, c.offsetDays),
    })),
    ...HUB_STEPS.filter((s) => !s.types.length).map((s, i) => ({
      id: `hub-${i}`, name: s.name, group: 'Promo Hub', how: s.how, url: '', region: '', impact: 3,
      date: addDays(releaseDate, s.offsetDays),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    waves: [...waves.values()].sort((a, b) => a.date.localeCompare(b.date)),
    tasks,
    spentPLN,
    forecast: forecast(picked),
    sections: [...new Set(picked.map((o) => o.type))],
  };
}

// „Siła orkiestry” 0–100: ile sekcji gra (różnorodność typów miejsc), ile fal wyszło,
// ile zadań w kanałach oficjalnych zostało wykonanych (ważone wpływem).
function orchestraScore(campaign) {
  const totalImpact = campaign.tasks.reduce((a, t) => a + t.impact, 0) || 1;
  const doneImpact = campaign.tasks.filter((t) => t.done).reduce((a, t) => a + t.impact, 0);
  const wavesSent = campaign.waves.length ? campaign.waves.filter((w) => w.sent).length / campaign.waves.length : 0;
  const diversity = Math.min(campaign.sections.length / 6, 1);
  return Math.round(45 * (doneImpact / totalImpact) + 30 * wavesSent + 25 * diversity);
}

function personalize(message, outlet) {
  return String(message || '')
    .replaceAll('{nazwa}', outlet.name)
    .replaceAll('{gatunki}', outlet.genres.join(', ') || 'różne gatunki');
}

module.exports = { buildPlan, selectOutlets, orchestraScore, personalize, addDays, MAX_OUTLETS };
