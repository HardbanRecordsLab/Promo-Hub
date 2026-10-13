'use strict';

const { CHANNELS, HUB_STEPS } = require('./channels');
const { PHASES, PLAYBOOK, phaseFor } = require('./playbook');
const { bi } = require('./i18n');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OUTLETS = 25;
const DEFAULT_ACCEPTANCE = 0.3;

function addDays(isoDate, days) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// Which Promo Hub wave an outlet type belongs to (default: release day).
function stepForType(type, steps) {
  return steps.find((s) => s.types.includes(type)) || steps.find((s) => s.offsetDays === 0);
}

// The "orchestra" optimizer: first the best outlet of every type (so every section plays),
// then further rounds. Paid outlets only within the budget.
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

// Builds the full campaign plan: Promo Hub submission waves + the A–Z task list.
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
    const key = `${date}|${step.id}`;
    if (!waves.has(key)) waves.set(key, { date, stepId: step.id, phase: phaseFor(step.offsetDays), name: step.name, how: step.how, outletIds: [], outlets: [] });
    const w = waves.get(key);
    w.outletIds.push(o.id);
    w.outlets.push({ id: o.id, name: o.name, type: o.type, model: o.collaboration.model, score: o.match.score });
  }

  const tasks = [
    ...PLAYBOOK.filter((t) => t.for.includes(creatorType)).map((t) => ({
      id: t.id, name: t.name, group: bi('A–Z plan', 'Plan A–Z'), how: t.how, url: '', region: '', impact: t.impact, offsetDays: t.offsetDays,
    })),
    ...CHANNELS.filter((c) => c.cost !== 'paid' && c.for.includes(creatorType)).map((c) => ({
      id: c.id, name: c.name, group: c.group, how: c.how, url: c.url, region: c.region, impact: c.impact, offsetDays: c.offsetDays,
    })),
    ...steps.filter((s) => !s.types.length).map((s) => ({
      id: `hub-${s.id}`, name: s.name, group: 'Promo Hub', how: s.how, url: '', region: '', impact: 3, offsetDays: s.offsetDays,
    })),
    // Global Database: verified entities the creator submits to directly – timed with the matching wave.
    ...[...entities]
      .sort((a, b) => (SUBMISSION_PRIORITY[a.submission] ?? 9) - (SUBMISSION_PRIORITY[b.submission] ?? 9) || a.name.localeCompare(b.name))
      .slice(0, MAX_ENTITY_TASKS)
      .map((e) => ({
        id: `ent-${e.id}`, name: bi(`Submit directly: ${e.name}`, `Zgłoś samodzielnie: ${e.name}`), group: bi('Global Database', 'Baza światowa'),
        how: e.note || '', url: e.url, region: e.region, country: e.country, impact: 2,
        offsetDays: stepForType(e.kind, steps).offsetDays,
      })),
  ].map(({ offsetDays, ...t }) => {
    const planned = addDays(releaseDate, offsetDays);
    // Tasks whose date passed before the campaign started are moved to today as "catch up".
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

// "Orchestra strength" 0–100: how many sections play (outlet type diversity), how many waves went out,
// how many A–Z tasks are done (weighted by impact).
function orchestraScore(campaign) {
  const totalImpact = campaign.tasks.reduce((a, t) => a + t.impact, 0) || 1;
  const doneImpact = campaign.tasks.filter((t) => t.done).reduce((a, t) => a + t.impact, 0);
  const wavesSent = campaign.waves.length ? campaign.waves.filter((w) => w.sent).length / campaign.waves.length : 0;
  const diversity = Math.min(campaign.sections.length / 6, 1);
  return Math.round(45 * (doneImpact / totalImpact) + 30 * wavesSent + 25 * diversity);
}

// Pitch generator placeholders: {name}/{genres} (EN) and {nazwa}/{gatunki} (PL).
function personalize(message, outlet, lang = 'en') {
  const genres = outlet.genres.join(', ') || (lang === 'pl' ? 'różne gatunki' : 'various genres');
  return String(message || '')
    .replaceAll('{name}', outlet.name).replaceAll('{nazwa}', outlet.name)
    .replaceAll('{genres}', genres).replaceAll('{gatunki}', genres);
}

module.exports = { buildPlan, selectOutlets, orchestraScore, personalize, addDays, MAX_OUTLETS };
