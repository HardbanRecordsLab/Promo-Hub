'use strict';

// Słowniki domenowe: typy miejsc promocji i modele współpracy.

const OUTLET_TYPES = {
  playlist: 'Playlista (Spotify / Apple Music / Deezer / Tidal)',
  radio: 'Radio FM / DAB',
  webradio: 'Radio internetowe',
  podcast: 'Podcast',
  youtube: 'Kanał YouTube',
  tiktok: 'Twórca TikTok / Reels',
  instagram: 'Profil Instagram',
  blog: 'Blog / magazyn muzyczny',
  newsletter: 'Newsletter',
  press: 'Prasa / portal / PR',
  community: 'Społeczność (Discord, Reddit, fanklub)',
  college: 'Radio akademickie / studenckie',
  brand: 'Marka / influencer marketing',
  dj: 'DJ / pula DJ-ska',
  club: 'Klub / event / festiwal',
  twitch: 'Streamer Twitch',
  tv: 'Telewizja / VOD',
  sync: 'Sync (reklama, film, gry)',
  mixseries: 'Seria miksów / audycja z miksami',
  promoter: 'Promotor / agencja bookingowa',
  magazine: 'Magazyn literacki / kulturalny',
  publisher: 'Wydawnictwo / agent literacki',
  audiobook: 'Platforma e-booków / audiobooków',
  bookstore: 'Księgarnia / klub książki',
  festival: 'Festiwal / targi',
  label: 'Wytwórnia / A&R',
  other: 'Inne',
};

const COLLAB_MODELS = {
  free: {
    label: 'Bezpłatnie',
    description: 'Kurator słucha i umieszcza utwory bez opłat i bez prowizji.',
  },
  commission: {
    label: 'Prowizja',
    description:
      'Brak opłat z góry. Kurator otrzymuje ustalony % przychodów artysty z utworu przez określony czas od emisji/umieszczenia.',
  },
  revshare: {
    label: 'Podział przychodów',
    description:
      'Wspólny projekt – przychody z utworu dzielone są wg ustalonego % (np. kompilacje, wspólne wydania, sync).',
  },
  fee: {
    label: 'Opłata za odsłuch',
    description:
      'Stała opłata za rzetelny odsłuch i feedback. Nie gwarantuje umieszczenia utworu (płatne miejsca na playlistach łamią regulaminy platform streamingowych).',
  },
  barter: {
    label: 'Barter / wymiana',
    description: 'Wymiana usług: np. cross-promocja, udostępnienia, występ za promocję.',
  },
};

// Modele, w których rozliczamy % od przychodów zgłaszanych przez artystę.
const PERCENT_MODELS = new Set(['commission', 'revshare']);

const { CREATOR_TYPES, ALL_GENRES } = require('./creators');

const GENRES = ALL_GENRES;

const SUBMISSION_STATUSES = {
  new: 'Nowe',
  listening: 'W odsłuchu',
  accepted: 'Zaakceptowane',
  scheduled: 'Zaplanowana emisja',
  published: 'Opublikowane / w emisji',
  rejected: 'Odrzucone',
  withdrawn: 'Wycofane przez artystę',
  expired: 'Brak odpowiedzi w terminie',
};

// Dozwolone przejścia statusów dla kuratora.
const CURATOR_TRANSITIONS = {
  new: ['listening', 'accepted', 'rejected'],
  listening: ['accepted', 'rejected'],
  accepted: ['scheduled', 'published', 'rejected'],
  scheduled: ['published', 'rejected'],
  published: [],
  rejected: [],
  withdrawn: [],
  expired: [],
};

// Statusy, od których rusza umowa prowizyjna.
const PLACED_STATUSES = new Set(['accepted', 'scheduled', 'published']);

module.exports = {
  CREATOR_TYPES,
  OUTLET_TYPES,
  COLLAB_MODELS,
  PERCENT_MODELS,
  GENRES,
  SUBMISSION_STATUSES,
  CURATOR_TRANSITIONS,
  PLACED_STATUSES,
};
