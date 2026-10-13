'use strict';

const { bi, pick } = require('./i18n');

// Career Autopilot: one ranked list of the "next best moves".
// Combines campaign tasks (A–Z plan), Effect Pool settlements, profile gaps, level goals,
// outlet suggestions from the catalog and verified entities from the Global Database.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TASKS = 6;
const PLACED = new Set(['accepted', 'scheduled', 'published']);
const METRIC_HINTS = {
  placements: bi('Every placement brings you closer to the next level – launch a campaign or send a wave early.', 'Każde umieszczenie przybliża Cię do awansu – uruchom kampanię lub wyślij falę wcześniej.'),
  reach: bi('Aim for bigger outlets you have already unlocked.', 'Celuj w miejsca o większym zasięgu, które masz już odblokowane.'),
  countries: bi('You need another country – submit to an outlet abroad.', 'Brakuje Ci kraju – zgłoś dzieło do miejsca z zagranicy.'),
  types: bi('A section of your orchestra is missing – add a new media type.', 'Brakuje Ci sekcji orkiestry – dodaj nowy typ mediów.'),
  listeners: bi('Update your monthly listeners/readers in your profile – it is one of the level thresholds.', 'Zaktualizuj liczbę słuchaczy/czytelników w profilu – to jeden z progów poziomu.'),
};

function prevMonth(today) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

// Builds "<label> · “<title>” · <details>" in both languages.
function line(en, pl, title, how) {
  return bi(`${en} · “${title}” · ${pick(how, 'en')}`, `${pl} · „${title}” · ${pick(how, 'pl')}`);
}

/**
 * ctx: { today, profile, career, campaigns, submissions, outletsById, suggestOutlets(filter), publicEntities }
 */
function nextActions(ctx) {
  const { today, profile, career, campaigns, submissions, outletsById } = ctx;
  const actions = [];
  const add = (score, a) => actions.push({ score: Math.round(score), ...a });
  const days = (date) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  const pressKit = bi('A complete press kit raises acceptance rates.', 'Kompletny press kit podnosi akceptację zgłoszeń.');

  // 1. Profile and press kit
  if (!profile) {
    add(90, {
      kind: 'profile', link: '#/creator',
      title: bi('Create your profile and press kit', 'Załóż profil i press kit'),
      why: bi('Curators accept creators with complete profiles more often; without a profile your level isn’t tracked.', 'Kuratorzy częściej akceptują twórców z kompletnym profilem; bez profilu nie liczy się Twój poziom.'),
    });
  } else {
    const gaps = [
      [!profile.photoUrl, 30, bi('Add a photo to your press kit', 'Dodaj zdjęcie do press kitu')],
      [!profile.bio, 35, bi('Write your bio', 'Napisz bio')],
      [!profile.bioEn, career.level >= 3 ? 45 : 18, bi('Add an English bio – it opens international doors', 'Dodaj bio po angielsku – otwiera zagranicę')],
      [!Object.values(profile.links || {}).some(Boolean), 20, bi('Add links to your profiles', 'Dodaj linki do profili')],
      [!profile.achievements, 12, bi('Add achievements – they go into your pitch', 'Dopisz osiągnięcia – trafią do pitchu')],
    ];
    for (const [missing, score, title] of gaps) {
      if (missing) add(score, { kind: 'profile', title, why: pressKit, link: '#/creator' });
    }
  }

  // 2. Campaigns and A–Z tasks
  if (!campaigns.length) {
    add(80, {
      kind: 'campaign', link: '#/campaign',
      title: bi('Launch your first campaign – a €0 budget is enough', 'Uruchom pierwszą kampanię – budżet 0 zł wystarczy'),
      why: bi('The Conductor picks outlets, builds your A–Z plan and sends submissions in waves.', 'Dyrygent dobierze miejsca, ułoży plan A–Z i sam wyśle zgłoszenia falami.'),
    });
  }
  // At most MAX_TASKS tasks, so other kinds of moves stay visible.
  const taskActions = [];
  for (const c of campaigns) {
    for (const t of c.tasks) {
      if (t.done) continue;
      const d = days(t.date);
      const base = { kind: 'task', title: t.name, campaignId: c.id, taskId: t.id, url: t.url || '' };
      if (d < -14) {
        // Long-overdue tasks are usually stale – lower priority.
        taskActions.push({ score: t.impact * 4, ...base, why: line(`Overdue ${-d} days – do it if still relevant`, `Zaległe ${-d} dni – zrób, jeśli wciąż aktualne`, c.trackTitle, t.how) });
      } else if (d <= 0) {
        taskActions.push({
          score: t.impact * 10 + Math.min(-d, 14), ...base,
          why: d < 0 ? line(`Overdue ${-d} days`, `Zaległe ${-d} dni`, c.trackTitle, t.how) : line('Due today', 'Na dziś', c.trackTitle, t.how),
        });
      } else if (d <= 7) {
        taskActions.push({ score: t.impact * 6 - d, ...base, why: line(`In ${d} days`, `Za ${d} dni`, c.trackTitle, t.how) });
      }
    }
  }
  taskActions.sort((a, b) => b.score - a.score).slice(0, MAX_TASKS).forEach(({ score, ...a }) => add(score, a));

  // 3. Effect Pool – missing revenue report for last month
  const period = prevMonth(today);
  const byTrack = new Map();
  for (const s of submissions) {
    const percent = s.agreement && ['commission', 'revshare'].includes(s.agreement.model);
    if (!percent || !PLACED.has(s.status) || !s.placedAt) continue;
    const from = s.placedAt.slice(0, 7);
    if (period < from || (s.settlement.agreementTo && period > s.settlement.agreementTo)) continue;
    if (s.revenue.some((r) => r.period === period)) continue;
    if (!byTrack.has(s.trackUrl)) byTrack.set(s.trackUrl, s);
  }
  for (const s of byTrack.values()) {
    add(65, {
      kind: 'revenue', submissionId: s.id, link: '#/creator',
      title: bi(`Report revenue for “${s.trackTitle}” – ${period}`, `Zgłoś przychód „${s.trackTitle}” za ${period}`),
      why: bi('One report settles every curator (Effect Pool). Honest reports = curators come back to you.', 'Jeden raport rozlicza wszystkich kuratorów (Pula Efektu). Rzetelne raporty = kuratorzy wracają do Ciebie.'),
    });
  }

  // 4. Curator feedback
  for (const s of submissions.filter((x) => x.status === 'rejected' && x.curatorNote).slice(0, 2)) {
    add(14, {
      kind: 'feedback', link: '#/creator',
      title: bi(`Read the feedback: ${s.outletName}`, `Przeczytaj feedback: ${s.outletName}`),
      why: `“${s.curatorNote.slice(0, 140)}”`,
    });
  }

  // 5. Next-level goals
  if (career.next) {
    for (const p of career.next.progress.filter((x) => !x.done)) {
      const gap = p.target - p.value;
      const base = 25 + Math.round((1 - Math.min(gap / (p.target || 1), 1)) * 20);
      const n = career.next;
      const action = {
        kind: 'level',
        title: bi(`Level ${n.level} (${pick(n.name, 'en')}): ${pick(p.label, 'en')} ${p.value} / ${p.target}`,
          `Poziom ${n.level} (${pick(n.name, 'pl')}): ${pick(p.label, 'pl')} ${p.value} / ${p.target}`),
        why: METRIC_HINTS[p.metric], link: p.metric === 'listeners' ? '#/creator' : '#/campaign',
      };
      if (p.metric === 'countries' || p.metric === 'types') {
        const placedOutlets = submissions.filter((x) => PLACED.has(x.status)).map((x) => outletsById[x.outletId] || {});
        const usedTypes = new Set(placedOutlets.map((o) => o.type));
        const usedCountries = new Set(placedOutlets.map((o) => (o.country || '').toLowerCase()));
        action.suggestions = ctx.suggestOutlets((o) => (p.metric === 'types'
          ? !usedTypes.has(o.type)
          : o.country && !usedCountries.has(o.country.toLowerCase()))).slice(0, 3)
          .map((o) => ({ id: o.id, name: o.name, type: o.type, country: o.country }));
      }
      add(base, action);
    }
  }

  // 6. Global Database – verified entities not yet in any campaign plan
  const planned = new Set(campaigns.flatMap((c) => c.tasks.map((t) => t.id)));
  for (const e of ctx.publicEntities.filter((x) => !planned.has(`ent-${x.id}`)).slice(0, 3)) {
    add(e.submission === 'open' ? 16 : 10, {
      kind: 'entity', url: e.url, country: e.country,
      title: bi(`Submit to: ${e.name}`, `Zgłoś się: ${e.name}`),
      why: e.note || '',
    });
  }

  return actions.sort((a, b) => b.score - a.score).slice(0, 12);
}

module.exports = { nextActions };
