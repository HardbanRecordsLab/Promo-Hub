'use strict';

const { bi } = require('./i18n');
const { CREATOR_TYPES, ALL_GENRES, GENRE_LABELS } = require('./creators');

// Domain dictionaries: outlet types and collaboration models (bilingual).

const OUTLET_TYPES = {
  playlist: bi('Playlist (Spotify / Apple Music / Deezer / Tidal)', 'Playlista (Spotify / Apple Music / Deezer / Tidal)'),
  radio: bi('FM / DAB radio', 'Radio FM / DAB'),
  webradio: bi('Online radio', 'Radio internetowe'),
  podcast: bi('Podcast', 'Podcast'),
  youtube: bi('YouTube channel', 'Kanał YouTube'),
  tiktok: bi('TikTok / Reels creator', 'Twórca TikTok / Reels'),
  instagram: bi('Instagram profile', 'Profil Instagram'),
  blog: bi('Blog / music magazine', 'Blog / magazyn muzyczny'),
  newsletter: bi('Newsletter', 'Newsletter'),
  press: bi('Press / portal / PR', 'Prasa / portal / PR'),
  community: bi('Community (Discord, Reddit, fan club)', 'Społeczność (Discord, Reddit, fanklub)'),
  college: bi('College / student radio', 'Radio akademickie / studenckie'),
  brand: bi('Brand / influencer marketing', 'Marka / influencer marketing'),
  dj: bi('DJ / record pool', 'DJ / pula DJ-ska'),
  club: bi('Club / event / live venue', 'Klub / event / scena'),
  twitch: bi('Twitch streamer', 'Streamer Twitch'),
  tv: bi('TV / VOD', 'Telewizja / VOD'),
  sync: bi('Sync (ads, film, games)', 'Sync (reklama, film, gry)'),
  mixseries: bi('Mix series / mix show', 'Seria miksów / audycja z miksami'),
  promoter: bi('Promoter / booking agency', 'Promotor / agencja bookingowa'),
  magazine: bi('Literary / culture magazine', 'Magazyn literacki / kulturalny'),
  publisher: bi('Publisher / literary agent', 'Wydawnictwo / agent literacki'),
  audiobook: bi('E-book / audiobook platform', 'Platforma e-booków / audiobooków'),
  bookstore: bi('Bookshop / book club', 'Księgarnia / klub książki'),
  festival: bi('Festival / fair / showcase', 'Festiwal / targi / showcase'),
  label: bi('Record label / A&R', 'Wytwórnia / A&R'),
  other: bi('Other', 'Inne'),
};

const COLLAB_MODELS = {
  free: {
    label: bi('Free', 'Bezpłatnie'),
    description: bi('The curator listens and features work with no fees and no commission.', 'Kurator słucha i umieszcza dzieła bez opłat i bez prowizji.'),
  },
  commission: {
    label: bi('Commission', 'Prowizja'),
    description: bi(
      'No upfront fees. The curator earns an agreed % of the creator’s revenue from the work for a set period after placement.',
      'Brak opłat z góry. Kurator otrzymuje ustalony % przychodów twórcy z dzieła przez określony czas od umieszczenia.',
    ),
  },
  revshare: {
    label: bi('Revenue share', 'Podział przychodów'),
    description: bi(
      'A joint project – revenue from the work is split by an agreed % (compilations, joint releases, sync, audiobooks).',
      'Wspólny projekt – przychody z dzieła dzielone są wg ustalonego % (kompilacje, wspólne wydania, sync, audiobooki).',
    ),
  },
  fee: {
    label: bi('Review fee', 'Opłata za odsłuch'),
    description: bi(
      'A fixed fee for an honest review and feedback. It never guarantees placement (paid playlist placements break streaming platforms’ rules).',
      'Stała opłata za rzetelny odsłuch i feedback. Nie gwarantuje umieszczenia (płatne miejsca na playlistach łamią regulaminy platform streamingowych).',
    ),
  },
  barter: {
    label: bi('Barter / exchange', 'Barter / wymiana'),
    description: bi('An exchange of services: cross-promotion, shares, a performance for promotion.', 'Wymiana usług: np. cross-promocja, udostępnienia, występ za promocję.'),
  },
};

// Models settled as a % of revenue reported by the creator.
const PERCENT_MODELS = new Set(['commission', 'revshare']);

const GENRES = ALL_GENRES;

const SUBMISSION_STATUSES = {
  new: bi('New', 'Nowe'),
  listening: bi('Under review', 'W odsłuchu'),
  accepted: bi('Accepted', 'Zaakceptowane'),
  scheduled: bi('Scheduled', 'Zaplanowana emisja'),
  published: bi('Published / on air', 'Opublikowane / w emisji'),
  rejected: bi('Declined', 'Odrzucone'),
  withdrawn: bi('Withdrawn by creator', 'Wycofane przez twórcę'),
  expired: bi('No response in time', 'Brak odpowiedzi w terminie'),
};

// Allowed status transitions for curators.
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

// Statuses that start a commission agreement.
const PLACED_STATUSES = new Set(['accepted', 'scheduled', 'published']);

module.exports = {
  CREATOR_TYPES,
  OUTLET_TYPES,
  COLLAB_MODELS,
  PERCENT_MODELS,
  GENRES,
  GENRE_LABELS,
  SUBMISSION_STATUSES,
  CURATOR_TRANSITIONS,
  PLACED_STATUSES,
};
