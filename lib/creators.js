'use strict';

// Typy twórców obsługiwanych przez platformę. Dodanie nowego typu (np. podcaster, filmowiec)
// = nowy wpis tutaj + jego kanały w channels.js + przykładowe miejsca w seed.js.
const CREATOR_TYPES = {
  music: {
    label: 'Muzyk / zespół',
    work: 'utwór',
    workGen: 'utworu',
    workUrlHint: 'Spotify, YouTube, SoundCloud, prywatny link',
    genres: [
      'pop', 'hip-hop', 'rap', 'trap', 'r&b', 'rock', 'metal', 'punk', 'indie', 'alternative',
      'electronic', 'house', 'techno', 'drum & bass', 'dubstep', 'ambient', 'lo-fi', 'jazz',
      'soul', 'funk', 'reggae', 'folk', 'country', 'classical', 'soundtrack', 'latin',
      'k-pop', 'disco polo', 'poezja śpiewana', 'inne',
    ],
  },
  dj: {
    label: 'DJ / producent',
    work: 'set / mix / produkcja',
    workGen: 'setu',
    workUrlHint: 'Mixcloud, SoundCloud, YouTube, Beatport, prywatny link',
    genres: [
      'house', 'deep house', 'tech house', 'techno', 'melodic techno', 'trance', 'drum & bass', 'dubstep',
      'afro house', 'disco', 'open format', 'hip-hop', 'electronic', 'ambient', 'inne',
    ],
  },
  writer: {
    label: 'Pisarz / autor / poeta',
    work: 'książka / tekst',
    workGen: 'książki',
    workUrlHint: 'strona książki, fragment PDF, Legimi, Empik, Amazon, prywatny link',
    genres: [
      'kryminał', 'thriller', 'fantasy', 'science fiction', 'horror', 'romans', 'obyczajowa',
      'literatura piękna', 'young adult', 'dla dzieci', 'reportaż', 'literatura faktu', 'biografia',
      'poradnik', 'poezja', 'opowiadania', 'komiks', 'inne',
    ],
  },
};

const ALL_GENRES = [...new Set(Object.values(CREATOR_TYPES).flatMap((c) => c.genres))];

module.exports = { CREATOR_TYPES, ALL_GENRES };
