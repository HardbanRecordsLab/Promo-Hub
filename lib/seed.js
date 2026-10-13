'use strict';

const { newId, newSecret, hashSecret } = require('./db');
const { bi } = require('./i18n');

// Sample (fictional) outlets – they demonstrate every type and collaboration model.
// Marked `sample: true`; remove them in the admin panel once real partners join.
const o = (name, type, extra, description, collaboration) => ({ name, type, ...extra, description, collaboration });
const music = (extra) => ({ creatorTypes: ['music'], country: 'PL', ...extra });

const SAMPLES = [
  o('Nocne Miasto – Chill & Lo-fi', 'playlist', music({ genres: ['lo-fi', 'ambient', 'electronic'], reach: 48000, responseDays: 5 }),
    bi('A playlist for studying and working. Looking for calm, instrumental beats.', 'Playlista do nauki i pracy. Szukam spokojnych, instrumentalnych bitów.'),
    { model: 'commission', ratePercent: 10, durationMonths: 6, terms: bi('10% of the track’s streaming revenue for 6 months after it is added.', '10% przychodów ze streamów utworu przez 6 miesięcy od dodania.') }),
  o('Polski Rap Świeżynki', 'playlist', music({ genres: ['hip-hop', 'rap', 'trap'], reach: 125000, responseDays: 3 }),
    bi('The freshest Polish rap releases, updated every Friday.', 'Najświeższe premiery polskiego rapu, aktualizacja co piątek.'),
    { model: 'commission', ratePercent: 15, durationMonths: 3, terms: bi('The track stays on the playlist for at least 4 weeks.', 'Utwór zostaje min. 4 tygodnie na playliście.') }),
  o('Radio Fala Północ', 'radio', music({ genres: ['pop', 'rock', 'indie'], reach: 210000, responseDays: 14 }),
    bi('Regional FM radio. “Debuts of the week” show every Thursday at 9 pm.', 'Regionalne radio FM. Audycja „Debiuty tygodnia” w każdy czwartek o 21:00.'),
    { model: 'free', terms: bi('WAV/MP3 320 kbps and a short press note required.', 'Wymagany plik WAV/MP3 320 kbps i krótka notka prasowa.') }),
  o('Underground Beats Radio 24/7', 'webradio', { creatorTypes: ['music', 'dj'], genres: ['techno', 'house', 'drum & bass'], country: 'DE', reach: 35000, responseDays: 7 },
    bi('Internet radio with club music, day and night rotation.', 'Radio internetowe z muzyką klubową, rotacja dzienna i nocna.'),
    { model: 'revshare', ratePercent: 20, durationMonths: 12, terms: bi('Your track on the station’s yearly compilation; 20% of compilation revenue.', 'Utwór w kompilacji rocznej stacji; 20% przychodów z kompilacji.') }),
  o('Dźwięki Spod Podłogi – podcast', 'podcast', music({ genres: [], reach: 12000, responseDays: 10 }),
    bi('A podcast about independent artists: interview + track premiere.', 'Podcast o niezależnych artystach: wywiad + premiera utworu.'),
    { model: 'barter', terms: bi('An interview in exchange for sharing the episode on the artist’s channels.', 'Wywiad za udostępnienie odcinka w mediach artysty.') }),
  o('SoundCheck PL', 'youtube', music({ genres: ['pop', 'r&b', 'soul'], reach: 330000, responseDays: 7, minLevel: 2 }),
    bi('A channel premiering music videos and lyric videos.', 'Kanał z premierami teledysków i lyric video.'),
    { model: 'commission', ratePercent: 20, durationMonths: 12, terms: bi('20% of the track’s revenue for 12 months after the premiere on the channel.', '20% przychodów z utworu przez 12 miesięcy od premiery na kanale.') }),
  o('@vibe.check.trendy', 'tiktok', music({ genres: ['pop', 'hip-hop', 'electronic'], reach: 540000, responseDays: 4, minLevel: 2 }),
    bi('I create dance and transition trends – looking for catchy hooks.', 'Tworzę trendy taneczne i transition – szukam chwytliwych hooków.'),
    { model: 'commission', ratePercent: 12, durationMonths: 6, terms: bi('At least 1 video with the track + sharing the sound.', 'Min. 1 film z utworem + udostępnienie dźwięku.') }),
  o('Muzyczny Skaner', 'blog', music({ genres: ['indie', 'alternative', 'folk', 'rock'], reach: 22000, responseDays: 7 }),
    bi('Reviews and interviews with independent artists.', 'Recenzje i wywiady z artystami niezależnymi.'),
    { model: 'fee', feePLN: 15, terms: bi('A fee for an honest listen and written feedback within 7 days. A review only if I like the track.', 'Opłata za rzetelny odsłuch i pisemny feedback w 7 dni. Recenzja tylko jeśli utwór się spodoba.') }),
  o('Weekend Sound – newsletter', 'newsletter', music({ genres: [], reach: 9000, responseDays: 7 }),
    bi('A weekly newsletter with 5 recommended releases.', 'Cotygodniowy newsletter z 5 polecanymi premierami.'),
    { model: 'free', terms: bi('Releases from the last 30 days only.', 'Tylko premiery z ostatnich 30 dni.') }),
  o('DJ Pool Warszawa', 'dj', { creatorTypes: ['music', 'dj'], genres: ['house', 'techno', 'disco polo', 'pop'], country: 'PL', reach: 1500, responseDays: 10 },
    bi('A pool of 1,500 club and wedding DJs. Extended mix required.', 'Pula 1500 DJ-ów klubowych i weselnych. Wymagany extended mix.'),
    { model: 'commission', ratePercent: 10, durationMonths: 12, terms: bi('10% of the track’s revenue for 12 months after it is sent to the pool.', '10% przychodów z utworu przez 12 miesięcy od wysyłki do puli.') }),
  o('Festiwal Młode Brzmienia', 'club', { creatorTypes: ['music', 'dj'], genres: [], country: 'PL', reach: 8000, responseDays: 21 },
    bi('A newcomers’ stage at a summer festival – a performance + promotion in the festival’s media.', 'Scena debiutów na letnim festiwalu – występ + promocja w mediach festiwalu.'),
    { model: 'barter', terms: bi('A performance without a fee in exchange for promotion and a live recording.', 'Występ bez honorarium w zamian za promocję i nagranie live.') }),
  o('SyncLab – music for ads and games', 'sync', { creatorTypes: ['music', 'dj'], genres: ['electronic', 'soundtrack', 'indie', 'pop'], country: 'WW', reach: 0, responseDays: 14 },
    bi('We license music for ads, films and games.', 'Licencjonujemy muzykę do reklam, filmów i gier.'),
    { model: 'revshare', ratePercent: 30, durationMonths: 24, terms: bi('30% of licence fees for placements, non-exclusive deal.', '30% z opłat licencyjnych za umieszczenia, umowa niewyłączna.') }),
  // --- DJs / producers ---
  o('Nocna Zmiana – mix show', 'mixseries', { creatorTypes: ['dj'], genres: ['house', 'deep house', 'techno', 'melodic techno'], country: 'PL', reach: 18000, responseDays: 10 },
    bi('A weekly show: one 60-minute guest mix + interview.', 'Cotygodniowa audycja: jeden gościnny mix 60 min + wywiad.'),
    { model: 'barter', terms: bi('Your mix premieres on the show in exchange for sharing the episode on your channels.', 'Premiera Twojego miksu w audycji za udostępnienie odcinka w Twoich kanałach.') }),
  o('Bass Collective – promoter & booking', 'promoter', { creatorTypes: ['dj'], genres: ['drum & bass', 'dubstep', 'techno'], country: 'PL', reach: 25000, responseDays: 14 },
    bi('We run parties in 5 cities and look for new support DJs.', 'Organizujemy imprezy w 5 miastach i szukamy nowych DJ-ów do supportów.'),
    { model: 'commission', ratePercent: 10, durationMonths: 12, terms: bi('10% of fees from gigs we bring in, for 12 months.', '10% honorariów z występów pozyskanych przez nas przez 12 miesięcy.') }),
  // --- writers / authors ---
  o('@czytam.nocami – BookTok', 'tiktok', { creatorTypes: ['writer'], genres: ['crime', 'thriller', 'fantasy', 'romance', 'young adult'], country: 'PL', reach: 85000, responseDays: 10 },
    bi('Reviews and recommendations in 60 seconds. I read e-books and print.', 'Recenzje i polecajki w 60 sekund. Czytam e-booki i papier.'),
    { model: 'commission', ratePercent: 10, durationMonths: 6, terms: bi('A review video + link; 10% of the author’s book revenue for 6 months.', 'Film z recenzją + link; 10% przychodów autora z książki przez 6 miesięcy.') }),
  o('Zakładka – blog literacki', 'blog', { creatorTypes: ['writer'], genres: ['literary fiction', 'general fiction', 'reportage', 'poetry'], country: 'PL', reach: 15000, responseDays: 21 },
    bi('Reviews of debuts and interviews with authors.', 'Recenzje debiutów i wywiady z autorami.'),
    { model: 'free', terms: bi('A review copy (print or e-book) at least 6 weeks before release.', 'Egzemplarz recenzencki (papier lub e-book) min. 6 tygodni przed premierą.') }),
  o('Kryminalna Kawa – podcast', 'podcast', { creatorTypes: ['writer'], genres: ['crime', 'thriller', 'reportage'], country: 'PL', reach: 22000, responseDays: 14 },
    bi('Conversations with crime writers and reporters.', 'Rozmowy z autorami kryminałów i reportażystami.'),
    { model: 'barter', terms: bi('An interview in exchange for sharing the episode and a copy for a listener giveaway.', 'Wywiad za udostępnienie odcinka i egzemplarz do konkursu dla słuchaczy.') }),
  o('Wers – magazyn literacki', 'magazine', { creatorTypes: ['writer'], genres: ['poetry', 'short stories', 'literary fiction'], country: 'PL', reach: 6000, responseDays: 30 },
    bi('A quarterly publishing poetry and prose by new authors.', 'Kwartalnik publikujący poezję i prozę debiutantów.'),
    { model: 'free', terms: bi('Up to 5 poems or a story up to 20,000 characters.', 'Do 5 wierszy lub opowiadanie do 20 tys. znaków.') }),
  o('@bookstagram.ania', 'instagram', { creatorTypes: ['writer'], genres: ['romance', 'general fiction', 'young adult', 'fantasy'], country: 'PL', reach: 42000, responseDays: 10 },
    bi('Aesthetic book photos and reels, reviews in stories.', 'Estetyczne zdjęcia i rolki z książkami, recenzje w stories.'),
    { model: 'fee', feePLN: 20, terms: bi('A fee for reading and honest feedback; a post only if I like the book.', 'Opłata za lekturę i szczery feedback; post tylko, jeśli książka mi się spodoba.') }),
  o('Głosownia – audiobook studio', 'audiobook', { creatorTypes: ['writer'], genres: [], country: 'PL', reach: 0, responseDays: 21 },
    bi('We record and distribute audiobooks with no upfront fees.', 'Nagrywamy i dystrybuujemy audiobooki bez opłat z góry.'),
    { model: 'revshare', ratePercent: 30, durationMonths: 36, terms: bi('30% of audiobook revenue for 36 months; recording and distribution on us.', '30% przychodów z audiobooka przez 36 miesięcy; nagranie i dystrybucja po naszej stronie.') }),
  o('Klub Książki Na Rogu', 'bookstore', { creatorTypes: ['writer'], genres: [], country: 'PL', reach: 3000, responseDays: 14 },
    bi('An independent bookshop with a book club and author events.', 'Kameralna księgarnia z klubem dyskusyjnym i spotkaniami autorskimi.'),
    { model: 'barter', terms: bi('An author event + book display in exchange for promoting the event.', 'Spotkanie autorskie + ekspozycja książki w zamian za promocję wydarzenia.') }),
  o('Festiwal Debiutów Literackich', 'festival', { creatorTypes: ['writer'], genres: [], country: 'PL', reach: 12000, responseDays: 30, minLevel: 2 },
    bi('A stage for debut authors: readings, panels, meetings with publishers.', 'Scena dla debiutantów: czytania, panele, spotkania z wydawcami.'),
    { model: 'barter', terms: bi('Participation without a fee; a recording of your appearance and promotion in the festival’s media.', 'Udział bez honorarium; nagranie wystąpienia i promocja w mediach festiwalu.') }),
];

function seed(store) {
  const createdAt = new Date().toISOString();
  for (const s of SAMPLES) {
    store.data.outlets.push({
      id: newId('out'),
      language: '',
      url: 'https://example.com',
      contactEmail: 'contact@example.com',
      acceptsSubmissions: true,
      minLevel: 1,
      creatorTypes: ['music'],
      ...s,
      collaboration: { ratePercent: 0, feePLN: 0, durationMonths: 0, terms: '', ...s.collaboration },
      verified: true,
      sample: true,
      createdAt,
      manageKeyHash: hashSecret(newSecret()),
    });
  }
  store.save();
}

module.exports = { seed, SAMPLES };
