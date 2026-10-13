'use strict';

const { CHANNELS, HUB_STEPS } = require('./channels');
const { PHASES, PLAYBOOK, phaseFor } = require('./playbook');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OUTLETS = 25;
const DEFAULT_ACCEPTANCE = 0.3;

function addDays(isoDate, days) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// Do której fali Promo Hub trafia dany typ miejsca (domyślnie: dzień premiery).
function stepForType(type, steps) {
  return steps.find((s) => s.types.includes(type)) || steps.find((s) => s.offsetDays === 0);
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
const MAX_ENTITY_TASKS = 15;
const SUBMISSION_PRIORITY = { open: 0, platform: 1, contact: 2, invite: 3, paid: 4 };

function buildPlan({ candidates, budgetPLN, releaseDate, today, creatorType = 'music', entities = [] }) {
  const steps = HUB_STEPS[creatorType] || HUB_STEPS.music;
  const { picked, spentPLN } = selectOutlets(candidates, { budgetPLN });
  const waves = new Map();
  for (const o of picked) {
    const step = stepForType(o.type, steps);
    let date = addDays(releaseDate, step.offsetDays);
    if (date < today) date = today;
    const key = `${date}|${step.name}`;
    if (!waves.has(key)) waves.set(key, { date, phase: phaseFor(step.offsetDays), name: step.name, how: step.how, outletIds: [], outlets: [] });
    const w = waves.get(key);
    w.outletIds.push(o.id);
    w.outlets.push({ id: o.id, name: o.name, type: o.type, model: o.collaboration.model, score: o.match.score });
  }

  const tasks = [
    ...PLAYBOOK.filter((t) => t.for.includes(creatorType)).map((t) => ({
      id: t.id, name: t.name, group: 'Plan A–Z', how: t.how, url: '', region: '', impact: t.impact, offsetDays: t.offsetDays,
    })),
    ...CHANNELS.filter((c) => c.cost !== 'paid' && c.for.includes(creatorType)).map((c) => ({
      id: c.id, name: c.name, group: c.group, how: c.how, url: c.url, region: c.region, impact: c.impact, offsetDays: c.offsetDays,
    })),
    ...steps.filter((s) => !s.types.length).map((s, i) => ({
      id: `hub-${i}`, name: s.name, group: 'Promo Hub', how: s.how, url: '', region: '', impact: 3, offsetDays: s.offsetDays,
    })),
    // Światowa Baza: zweryfikowane podmioty, do których artysta zgłasza się sam – w terminie właściwej fali.
    ...[...entities]
      .sort((a, b) => (SUBMISSION_PRIORITY[a.submission] ?? 9) - (SUBMISSION_PRIORITY[b.submission] ?? 9) || a.name.localeCompare(b.name))
      .slice(0, MAX_ENTITY_TASKS)
      .map((e) => ({
        id: `ent-${e.id}`, name: `Zgłoś samodzielnie: ${e.name}`, group: 'Baza światowa',
        how: [e.country, e.notes].filter(Boolean).join(' · '), url: e.url, region: e.region, impact: 2,
        offsetDays: stepForType(e.kind, steps).offsetDays,
      })),
  ].map(({ offsetDays, ...t }) => {
    const planned = addDays(releaseDate, offsetDays);
    // Zadania, których termin minął przed startem kampanii, trafiają na dziś jako „do nadrobienia”.
    return { ...t, phase: phaseFor(offsetDays), date: planned < today ? today : planned, catchUp: planned < today };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.phase.localeCompare(b.phase));

  return {
    phases: PHASES,
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
