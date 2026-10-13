'use strict';

const { bi } = require('./i18n');

// Creator types supported by the platform. Adding a new type (e.g. podcaster, filmmaker)
// = a new entry here + its channels in channels.js + its steps in playbook.js / channels.js.
const CREATOR_TYPES = {
  music: {
    label: bi('Musician / band', 'Muzyk / zespół'),
    work: bi('track', 'utwór'),
    workUrlHint: bi('Spotify, YouTube, SoundCloud, private link', 'Spotify, YouTube, SoundCloud, prywatny link'),
    genres: [
      'pop', 'hip-hop', 'rap', 'trap', 'r&b', 'rock', 'metal', 'punk', 'indie', 'alternative',
      'electronic', 'house', 'techno', 'drum & bass', 'dubstep', 'ambient', 'lo-fi', 'jazz',
      'soul', 'funk', 'reggae', 'folk', 'country', 'classical', 'soundtrack', 'latin',
      'k-pop', 'afrobeats', 'disco polo', 'sung poetry', 'other',
    ],
  },
  dj: {
    label: bi('DJ / producer', 'DJ / producent'),
    work: bi('set / mix / production', 'set / mix / produkcja'),
    workUrlHint: bi('Mixcloud, SoundCloud, YouTube, Beatport, private link', 'Mixcloud, SoundCloud, YouTube, Beatport, prywatny link'),
    genres: [
      'house', 'deep house', 'tech house', 'techno', 'melodic techno', 'trance', 'drum & bass', 'dubstep',
      'afro house', 'disco', 'open format', 'hip-hop', 'electronic', 'ambient', 'other',
    ],
  },
  writer: {
    label: bi('Writer / author / poet', 'Pisarz / autor / poeta'),
    work: bi('book / text', 'książka / tekst'),
    workUrlHint: bi('book page, PDF excerpt, store link, private link', 'strona książki, fragment PDF, link do sklepu, prywatny link'),
    genres: [
      'crime', 'thriller', 'fantasy', 'science fiction', 'horror', 'romance', 'general fiction',
      'literary fiction', 'young adult', 'children', 'reportage', 'non-fiction', 'biography',
      'self-help', 'poetry', 'short stories', 'comics', 'other',
    ],
  },
};

// Display labels for genres that differ between languages (others are shown as-is).
const GENRE_LABELS = {
  'sung poetry': bi('sung poetry', 'poezja śpiewana'),
  other: bi('other', 'inne'),
  crime: bi('crime', 'kryminał'),
  romance: bi('romance', 'romans'),
  'general fiction': bi('general fiction', 'obyczajowa'),
  'literary fiction': bi('literary fiction', 'literatura piękna'),
  children: bi('children', 'dla dzieci'),
  reportage: bi('reportage', 'reportaż'),
  'non-fiction': bi('non-fiction', 'literatura faktu'),
  biography: bi('biography', 'biografia'),
  'self-help': bi('self-help', 'poradnik'),
  poetry: bi('poetry', 'poezja'),
  'short stories': bi('short stories', 'opowiadania'),
  comics: bi('comics', 'komiks'),
};

const ALL_GENRES = [...new Set(Object.values(CREATOR_TYPES).flatMap((c) => c.genres))];

module.exports = { CREATOR_TYPES, ALL_GENRES, GENRE_LABELS };
