'use strict';

const { bi } = require('./i18n');

// Creator Path: from newcomer to international recognition.
// The level is computed from hard platform data (placements, reach, countries, media types)
// plus self-reported monthly listeners/readers. Every level has clear thresholds and next steps.
const LEVELS = [
  {
    level: 1, name: bi('Newcomer', 'Debiutant'), goal: bi('First placements and a complete profile', 'Pierwsze umieszczenia i kompletny profil'),
    req: { placements: 0, reach: 0, countries: 0, types: 0, listeners: 0 },
    steps: [
      bi('Complete your profile and press kit (bio, photo, links) – curators accept complete profiles more often.', 'Uzupełnij profil i press kit (bio, zdjęcie, linki) – kuratorzy częściej akceptują kompletne profile.'),
      bi('Claim Spotify for Artists, YouTube OAC and TikTok for Artists (tasks in your campaign plan).', 'Odbierz profile Spotify for Artists, YouTube OAC i TikTok for Artists (zadania w planie kampanii).'),
      bi('Launch your first campaign with a €0 budget – commission, free and barter outlets only.', 'Uruchom pierwszą kampanię z budżetem 0 zł – same miejsca prowizyjne, bezpłatne i barterowe.'),
    ],
  },
  {
    level: 2, name: bi('Local', 'Lokalny'), goal: bi('3 placements in 2 media types', '3 umieszczenia w 2 typach mediów'),
    req: { placements: 3, reach: 20000, countries: 1, types: 2, listeners: 500 },
    steps: [
      bi('Target regional and college radio and podcasts – they build credibility for bigger curators.', 'Celuj w radia regionalne, akademickie i podcasty – budują wiarygodność dla większych kuratorów.'),
      bi('Release regularly (every 6–8 weeks) – every release is a new campaign with new waves.', 'Wydawaj regularnie (co 6–8 tygodni) – każda premiera to nowa kampania i nowe fale.'),
      bi('Report revenue honestly – commission curators come back to creators they earn with.', 'Zgłaszaj rzetelnie przychody – kuratorzy prowizyjni chętniej wracają do artystów, na których zarabiają.'),
    ],
  },
  {
    level: 3, name: bi('National', 'Krajowy'), goal: bi('10 placements, 250k reach, 4 media types', '10 umieszczeń, 250 tys. zasięgu, 4 typy mediów'),
    req: { placements: 10, reach: 250000, countries: 1, types: 4, listeners: 10000 },
    steps: [
      bi('Add YouTube, TikTok and blogs – the orchestra must play in every section at once.', 'Dołóż YouTube, TikTok i blogi – „orkiestra” musi grać we wszystkich sekcjach naraz.'),
      bi('Use campaign data (which outlets worked) in pitches to bigger playlists and national stations.', 'Wykorzystaj dane z kampanii (które miejsca działały) w pitchu do większych playlist i rozgłośni ogólnokrajowych.'),
      bi('Prepare an English bio and pitch – the next level is international.', 'Przygotuj wersję anglojęzyczną bio i pitchu – kolejny poziom to zagranica.'),
    ],
  },
  {
    level: 4, name: bi('International', 'Międzynarodowy'), goal: bi('Placements in 3 countries, 1M reach', 'Umieszczenia w 3 krajach, 1 mln zasięgu'),
    req: { placements: 25, reach: 1000000, countries: 3, types: 5, listeners: 50000 },
    steps: [
      bi('Campaigns with foreign outlets: playlists and radio in countries where your listeners grow.', 'Kampanie z miejscami zagranicznymi: playlisty i radia z krajów, w których rosną Twoi słuchacze.'),
      bi('Sync and labels: with reach data you have a case for A&R and licensing to ads, film and games.', 'Sync i wytwórnie: z danymi o zasięgu masz argument dla A&R i licencji do reklam, filmów i gier.'),
      bi('Shows and festivals: add tours to Bandsintown, apply to showcase festivals from the catalog.', 'Koncerty i festiwale: dodaj trasy do Bandsintown, zgłaszaj się do festiwali przez katalog.'),
    ],
  },
  {
    level: 5, name: bi('Global', 'Globalny'), goal: bi('Placements in 6+ countries, 5M reach', 'Umieszczenia w 6+ krajach, 5 mln zasięgu'),
    req: { placements: 60, reach: 5000000, countries: 6, types: 7, listeners: 250000 },
    steps: [
      bi('Keep your release rhythm and presence in every section – algorithms reward continuity.', 'Utrzymuj rytm wydawniczy i obecność we wszystkich sekcjach – algorytmy nagradzają ciągłość.'),
      bi('Collaborations with creators from other markets open new countries.', 'Kooperacje z artystami z innych rynków (featuringi) otwierają nowe kraje.'),
      bi('Become a curator/mentor on Promo Hub – your playlist or show is extra income and reach.', 'Zostań kuratorem/mentorem w Promo Hub – Twoja playlista lub audycja to dodatkowy przychód i zasięg.'),
    ],
  },
];

// Steps for writers (other creator types use the default steps).
const WRITER_STEPS = {
  1: [
    bi('Complete your author profile and press kit (bio, photo, book description, excerpt).', 'Uzupełnij profil autora i press kit (bio, zdjęcie, opis książki, fragment).'),
    bi('Claim Goodreads (and lubimyczytać.pl in Poland), start a reader newsletter.', 'Odbierz profile Goodreads i lubimyczytać.pl, załóż newsletter dla czytelników.'),
    bi('Launch a €0 campaign – reviewers, Bookstagram and podcasts on commission and barter.', 'Uruchom kampanię z budżetem 0 zł – recenzenci, Bookstagram i podcasty w modelu prowizyjnym i barterowym.'),
  ],
  2: [
    bi('Target literary blogs, book clubs and local libraries – they bring the first reviews.', 'Celuj w blogi literackie, kluby książki i lokalne biblioteki – budują pierwsze recenzje.'),
    bi('Publish excerpts and short stories regularly (Wattpad, newsletter) so readers wait for the next book.', 'Publikuj regularnie fragmenty i opowiadania (Wattpad, newsletter), żeby czytelnicy czekali na kolejną książkę.'),
    bi('Report revenue honestly – commission reviewers and creators come back.', 'Zgłaszaj rzetelnie przychody – recenzenci i twórcy prowizyjni chętniej wracają.'),
  ],
  3: [
    bi('BookTok and YouTube: short formats with quotes and “for fans of X”.', 'BookTok i YouTube: krótkie formy z cytatami i „książka dla fanów X”.'),
    bi('Book festivals and fairs, author events in bookshops.', 'Festiwale i targi książki, spotkania autorskie w księgarniach.'),
    bi('Prepare an English bio and synopsis – the next level is translation.', 'Przygotuj bio i opis książki po angielsku – kolejny poziom to tłumaczenia.'),
  ],
  4: [
    bi('Foreign publishers and literary agents – with results and reviews you have a case.', 'Wydawcy zagraniczni i agenci literaccy – z wynikami i recenzjami masz argument.'),
    bi('Audiobook and screen rights – new revenue streams.', 'Audiobook i prawa do ekranizacji – nowe pola eksploatacji.'),
    bi('International literary festivals and writing residencies.', 'Festiwale literackie za granicą i rezydencje pisarskie.'),
  ],
  5: [
    bi('Keep your publishing rhythm and contact with readers in every channel.', 'Utrzymuj rytm wydawniczy i kontakt z czytelnikami we wszystkich kanałach.'),
    bi('Collaborate with authors from other markets (anthologies, joint projects).', 'Współprace z autorami z innych rynków (antologie, wspólne projekty).'),
    bi('Become a reviewer or mentor on Promo Hub – your reach is extra income.', 'Zostań recenzentem lub mentorem w Promo Hub – Twój zasięg to dodatkowy przychód.'),
  ],
};

const METRIC_LABELS = {
  placements: bi('placements', 'umieszczenia'),
  reach: bi('placement reach', 'zasięg umieszczeń'),
  countries: bi('countries', 'kraje'),
  types: bi('media types', 'typy mediów'),
  listeners: bi('monthly listeners/readers', 'słuchacze/czytelnicy miesięcznie'),
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
    steps: (input.profile && input.profile.creatorType === 'writer' && WRITER_STEPS[current.level]) || current.steps,
    levels: LEVELS.map(({ level, name, goal }) => ({ level, name, goal })),
  };
}

module.exports = { careerFor, LEVELS, METRIC_LABELS };
