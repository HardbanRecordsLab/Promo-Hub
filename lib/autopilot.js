'use strict';

// Autopilot kariery: jedna uszeregowana lista „następnych najlepszych ruchów”.
// Łączy: zadania kampanii (Plan A–Z), rozliczenia Puli Efektu, luki w profilu, cele poziomu,
// sugestie miejsc z katalogu i zweryfikowane podmioty ze Światowej Bazy.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TASKS = 6;
const PLACED = new Set(['accepted', 'scheduled', 'published']);
const METRIC_HINTS = {
  placements: 'Każde umieszczenie przybliża Cię do awansu – uruchom kampanię lub wyślij falę wcześniej.',
  reach: 'Celuj w miejsca o większym zasięgu, które masz już odblokowane.',
  countries: 'Brakuje Ci kraju – zgłoś dzieło do miejsca z zagranicy.',
  types: 'Brakuje Ci sekcji orkiestry – dodaj nowy typ mediów.',
  listeners: 'Zaktualizuj liczbę słuchaczy/czytelników w profilu – to jeden z progów poziomu.',
};

function prevMonth(today) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

/**
 * ctx: { today, profile, career, campaigns, submissions, outletsById, suggestOutlets(filter), publicEntities, creatorType }
 */
function nextActions(ctx) {
  const { today, profile, career, campaigns, submissions, outletsById } = ctx;
  const actions = [];
  const add = (score, a) => actions.push({ score: Math.round(score), ...a });
  const days = (date) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);

  // 1. Profil i press kit
  if (!profile) {
    add(90, { kind: 'profile', title: 'Załóż profil i press kit', why: 'Kuratorzy częściej akceptują twórców z kompletnym profilem; bez profilu nie liczy się Twój poziom.', link: '#/artysta' });
  } else {
    const gaps = [
      [!profile.photoUrl, 30, 'Dodaj zdjęcie do press kitu'],
      [!profile.bio, 35, 'Napisz bio'],
      [!profile.bioEn, career.level >= 3 ? 45 : 18, 'Dodaj bio po angielsku – otwiera zagranicę'],
      [!Object.values(profile.links || {}).some(Boolean), 20, 'Dodaj linki do profili'],
      [!profile.achievements, 12, 'Dopisz osiągnięcia – trafią do pitchu'],
    ];
    for (const [missing, score, title] of gaps) {
      if (missing) add(score, { kind: 'profile', title, why: 'Kompletny press kit podnosi akceptację zgłoszeń.', link: '#/artysta' });
    }
  }

  // 2. Kampanie i zadania Planu A–Z
  if (!campaigns.length) {
    add(80, { kind: 'campaign', title: 'Uruchom pierwszą kampanię – budżet 0 zł wystarczy', why: 'Dyrygent dobierze miejsca, ułoży plan A–Z i sam wyśle zgłoszenia falami.', link: '#/kampania' });
  }
  // Maks. MAX_TASKS zadań, żeby na liście zostało miejsce na inne rodzaje ruchów.
  const taskActions = [];
  for (const c of campaigns) {
    for (const t of c.tasks) {
      if (t.done) continue;
      const d = days(t.date);
      const base = { kind: 'task', title: t.name, campaignId: c.id, taskId: t.id, url: t.url || '' };
      if (d < -14) {
        // Długo zaległe zadania zwykle straciły aktualność – niższy priorytet.
        taskActions.push({ score: t.impact * 4, ...base, why: `Zaległe ${-d} dni – zrób, jeśli wciąż aktualne · „${c.trackTitle}” · ${t.how}` });
      } else if (d <= 0) {
        taskActions.push({ score: t.impact * 10 + Math.min(-d, 14), ...base, why: `${d < 0 ? `Zaległe ${-d} dni` : 'Na dziś'} · „${c.trackTitle}” · ${t.how}` });
      } else if (d <= 7) {
        taskActions.push({ score: t.impact * 6 - d, ...base, why: `Za ${d} dni · „${c.trackTitle}” · ${t.how}` });
      }
    }
  }
  taskActions.sort((a, b) => b.score - a.score).slice(0, MAX_TASKS).forEach(({ score, ...a }) => add(score, a));

  // 3. Pula Efektu – brakujący raport przychodu za poprzedni miesiąc
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
      kind: 'revenue', title: `Zgłoś przychód „${s.trackTitle}” za ${period}`,
      why: 'Jeden raport rozlicza wszystkich kuratorów (Pula Efektu). Rzetelne raporty = kuratorzy wracają do Ciebie.',
      submissionId: s.id, link: '#/artysta',
    });
  }

  // 4. Feedback od kuratorów
  for (const s of submissions.filter((x) => x.status === 'rejected' && x.curatorNote).slice(0, 2)) {
    add(14, { kind: 'feedback', title: `Przeczytaj feedback: ${s.outletName}`, why: `„${s.curatorNote.slice(0, 140)}”`, link: '#/artysta' });
  }

  // 5. Cele następnego poziomu
  if (career.next) {
    for (const p of career.next.progress.filter((x) => !x.done)) {
      const gap = p.target - p.value;
      const base = 25 + Math.round((1 - Math.min(gap / (p.target || 1), 1)) * 20);
      const action = {
        kind: 'level', title: `Poziom ${career.next.level} (${career.next.name}): ${p.label} ${p.value} / ${p.target}`,
        why: METRIC_HINTS[p.metric], link: p.metric === 'listeners' ? '#/artysta' : '#/kampania',
      };
      if (p.metric === 'countries' || p.metric === 'types') {
        const usedTypes = new Set(submissions.filter((x) => PLACED.has(x.status)).map((x) => (outletsById[x.outletId] || {}).type));
        const usedCountries = new Set(submissions.filter((x) => PLACED.has(x.status)).map((x) => ((outletsById[x.outletId] || {}).country || '').toLowerCase()));
        action.suggestions = ctx.suggestOutlets((o) => (p.metric === 'types'
          ? !usedTypes.has(o.type)
          : o.country && !usedCountries.has(o.country.toLowerCase()))).slice(0, 3)
          .map((o) => ({ id: o.id, name: o.name, type: o.type, country: o.country }));
      }
      add(base, action);
    }
  }

  // 6. Światowa Baza – zweryfikowane podmioty, których jeszcze nie ma w planach kampanii
  const planned = new Set(campaigns.flatMap((c) => c.tasks.map((t) => t.id)));
  for (const e of ctx.publicEntities.filter((x) => !planned.has(`ent-${x.id}`)).slice(0, 3)) {
    add(e.submission === 'open' ? 16 : 10, {
      kind: 'entity', title: `Zgłoś się: ${e.name}`, why: [e.country, e.notes].filter(Boolean).join(' · '), url: e.url,
    });
  }

  return actions.sort((a, b) => b.score - a.score).slice(0, 12);
}

module.exports = { nextActions };
