'use strict';

// Ścieżka artysty: od debiutanta do rozpoznawalności na świecie.
// Poziom liczony jest z twardych danych platformy (umieszczenia, zasięg, kraje, typy mediów)
// oraz deklarowanych słuchaczy miesięcznie. Każdy poziom ma jasne progi i następne kroki.
const LEVELS = [
  {
    level: 1, name: 'Debiutant', goal: 'Pierwsze umieszczenia i kompletny profil',
    req: { placements: 0, reach: 0, countries: 0, types: 0, listeners: 0 },
    steps: [
      'Uzupełnij profil artysty i press kit (bio, zdjęcie, linki) – kuratorzy częściej akceptują kompletne profile.',
      'Odbierz profile Spotify for Artists, YouTube OAC i TikTok for Artists (zadania w planie kampanii).',
      'Uruchom pierwszą kampanię z budżetem 0 zł – same miejsca prowizyjne, bezpłatne i barterowe.',
    ],
  },
  {
    level: 2, name: 'Lokalny', goal: '3 umieszczenia w 2 typach mediów',
    req: { placements: 3, reach: 20000, countries: 1, types: 2, listeners: 500 },
    steps: [
      'Celuj w radia regionalne, akademickie i podcasty – budują wiarygodność dla większych kuratorów.',
      'Wydawaj regularnie (co 6–8 tygodni) – każda premiera to nowa kampania i nowe fale.',
      'Zgłaszaj rzetelnie przychody – kuratorzy prowizyjni chętniej wracają do artystów, na których zarabiają.',
    ],
  },
  {
    level: 3, name: 'Krajowy', goal: '10 umieszczeń, 250 tys. zasięgu, 4 typy mediów',
    req: { placements: 10, reach: 250000, countries: 1, types: 4, listeners: 10000 },
    steps: [
      'Dołóż YouTube, TikTok i blogi – „orkiestra” musi grać we wszystkich sekcjach naraz.',
      'Wykorzystaj dane z kampanii (które miejsca działały) w pitchu do większych playlist i rozgłośni ogólnopolskich.',
      'Przygotuj wersję anglojęzyczną bio i pitchu – kolejny poziom to zagranica.',
    ],
  },
  {
    level: 4, name: 'Międzynarodowy', goal: 'Umieszczenia w 3 krajach, 1 mln zasięgu',
    req: { placements: 25, reach: 1000000, countries: 3, types: 5, listeners: 50000 },
    steps: [
      'Kampanie z miejscami zagranicznymi: playlisty i radia z krajów, w których rosną Twoi słuchacze.',
      'Sync i wytwórnie: z danymi o zasięgu masz argument dla A&R i licencji do reklam, filmów i gier.',
      'Koncerty i festiwale: dodaj trasy do Bandsintown, zgłaszaj się do festiwali przez katalog.',
    ],
  },
  {
    level: 5, name: 'Globalny', goal: 'Umieszczenia w 6+ krajach, 5 mln zasięgu',
    req: { placements: 60, reach: 5000000, countries: 6, types: 7, listeners: 250000 },
    steps: [
      'Utrzymuj rytm wydawniczy i obecność we wszystkich sekcjach – algorytmy nagradzają ciągłość.',
      'Kooperacje z artystami z innych rynków (featuringi) otwierają nowe kraje.',
      'Zostań kuratorem/mentorem w Promo Hub – Twoja playlista lub audycja to dodatkowy przychód i zasięg.',
    ],
  },
];

const METRIC_LABELS = {
  placements: 'umieszczenia',
  reach: 'zasięg umieszczeń',
  countries: 'kraje',
  types: 'typy mediów',
  listeners: 'słuchacze miesięcznie',
};

function metricsFor({ submissions, outlets, profile }) {
  const placed = submissions.filter((s) => ['accepted', 'scheduled', 'published'].includes(s.status));
  const placedOutlets = placed.map((s) => outlets.find((o) => o.id === s.outletId)).filter(Boolean);
  return {
    placements: placed.length,
    reach: placedOutlets.reduce((a, o) => a + (o.reach || 0), 0),
    countries: new Set(placedOutlets.map((o) => (o.country || '').toLowerCase()).filter(Boolean)).size,
    types: new Set(placedOutlets.map((o) => o.type)).size,
    listeners: (profile && profile.monthlyListeners) || 0,
  };
}

function meets(metrics, req) {
  return Object.keys(req).every((k) => metrics[k] >= req[k]);
}

function careerFor(input) {
  const metrics = metricsFor(input);
  let current = LEVELS[0];
  for (const l of LEVELS) if (meets(metrics, l.req)) current = l;
  const next = LEVELS.find((l) => l.level === current.level + 1) || null;
  const progress = next
    ? Object.keys(next.req).map((k) => ({
      metric: k,
      label: METRIC_LABELS[k],
      value: metrics[k],
      target: next.req[k],
      done: metrics[k] >= next.req[k],
    }))
    : [];
  const percent = next
    ? Math.round((progress.reduce((a, p) => a + Math.min(p.value / (p.target || 1), 1), 0) / progress.length) * 100)
    : 100;
  return {
    level: current.level,
    name: current.name,
    metrics,
    next: next ? { level: next.level, name: next.name, goal: next.goal, progress, percent } : null,
    steps: current.steps,
    levels: LEVELS.map(({ level, name, goal }) => ({ level, name, goal })),
  };
}

module.exports = { careerFor, LEVELS };
