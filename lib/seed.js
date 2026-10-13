'use strict';

const { newId, newSecret, hashSecret } = require('./db');

// Przykładowe (fikcyjne) miejsca promocji – pokazują wszystkie typy i modele współpracy.
// Oznaczone jako `sample: true`; usuń je w panelu admina po dodaniu prawdziwych partnerów.
const SAMPLES = [
  { name: 'Nocne Miasto – Chill & Lo-fi', type: 'playlist', genres: ['lo-fi', 'ambient', 'electronic'], country: 'Polska', reach: 48000, responseDays: 5,
    description: 'Playlista do nauki i pracy. Szukam spokojnych, instrumentalnych bitów.',
    collaboration: { model: 'commission', ratePercent: 10, durationMonths: 6, terms: '10% przychodów ze streamów utworu przez 6 miesięcy od dodania.' } },
  { name: 'Polski Rap Świeżynki', type: 'playlist', genres: ['hip-hop', 'rap', 'trap'], country: 'Polska', reach: 125000, responseDays: 3,
    description: 'Najświeższe premiery polskiego rapu, aktualizacja co piątek.',
    collaboration: { model: 'commission', ratePercent: 15, durationMonths: 3, terms: 'Utwór zostaje min. 4 tygodnie na playliście.' } },
  { name: 'Radio Fala Północ', type: 'radio', genres: ['pop', 'rock', 'indie'], country: 'Polska', reach: 210000, responseDays: 14,
    description: 'Regionalne radio FM. Audycja „Debiuty tygodnia” w każdy czwartek o 21:00.',
    collaboration: { model: 'free', terms: 'Wymagany plik WAV/MP3 320 kbps i krótka notka prasowa.' } },
  { name: 'Underground Beats Radio 24/7', creatorTypes: ['music', 'dj'], type: 'webradio', genres: ['techno', 'house', 'drum & bass'], country: 'Niemcy', reach: 35000, responseDays: 7,
    description: 'Internet radio z muzyką klubową, rotacja dzienna i nocna.',
    collaboration: { model: 'revshare', ratePercent: 20, durationMonths: 12, terms: 'Utwór w kompilacji rocznej stacji; 20% przychodów z kompilacji.' } },
  { name: 'Dźwięki Spod Podłogi – podcast', type: 'podcast', genres: [], country: 'Polska', reach: 12000, responseDays: 10,
    description: 'Podcast o niezależnych artystach: wywiad + premiera utworu.',
    collaboration: { model: 'barter', terms: 'Wywiad za udostępnienie odcinka w mediach artysty.' } },
  { name: 'SoundCheck PL', type: 'youtube', genres: ['pop', 'r&b', 'soul'], country: 'Polska', reach: 330000, responseDays: 7, minLevel: 2,
    description: 'Kanał z premierami teledysków i lyric video.',
    collaboration: { model: 'commission', ratePercent: 20, durationMonths: 12, terms: '20% przychodów z utworu przez 12 miesięcy od premiery na kanale.' } },
  { name: '@vibe.check.trendy', type: 'tiktok', genres: ['pop', 'hip-hop', 'electronic'], country: 'Polska', reach: 540000, responseDays: 4, minLevel: 2,
    description: 'Tworzę trendy taneczne i transition – szukam chwytliwych hooków.',
    collaboration: { model: 'commission', ratePercent: 12, durationMonths: 6, terms: 'Min. 1 film z utworem + udostępnienie dźwięku.' } },
  { name: 'Muzyczny Skaner', type: 'blog', genres: ['indie', 'alternative', 'folk', 'rock'], country: 'Polska', reach: 22000, responseDays: 7,
    description: 'Recenzje i wywiady z artystami niezależnymi.',
    collaboration: { model: 'fee', feePLN: 15, terms: 'Opłata za rzetelny odsłuch i pisemny feedback w 7 dni. Recenzja tylko jeśli utwór się spodoba.' } },
  { name: 'Weekend Sound – newsletter', type: 'newsletter', genres: [], country: 'Polska', reach: 9000, responseDays: 7,
    description: 'Cotygodniowy newsletter z 5 polecanymi premierami.',
    collaboration: { model: 'free', terms: 'Tylko premiery z ostatnich 30 dni.' } },
  { name: 'DJ Pool Warszawa', creatorTypes: ['music', 'dj'], type: 'dj', genres: ['house', 'techno', 'disco polo', 'pop'], country: 'Polska', reach: 1500, responseDays: 10,
    description: 'Pula 1500 DJ-ów klubowych i weselnych. Wymagany extended mix.',
    collaboration: { model: 'commission', ratePercent: 10, durationMonths: 12, terms: '10% przychodów z utworu przez 12 miesięcy od wysyłki do puli.' } },
  { name: 'Festiwal Młode Brzmienia', creatorTypes: ['music', 'dj'], type: 'club', genres: [], country: 'Polska', reach: 8000, responseDays: 21,
    description: 'Scena debiutów na letnim festiwalu – występ + promocja w mediach festiwalu.',
    collaboration: { model: 'barter', terms: 'Występ bez honorarium w zamian za promocję i nagranie live.' } },
  { name: 'SyncLab – muzyka do reklam i gier', creatorTypes: ['music', 'dj'], type: 'sync', genres: ['electronic', 'soundtrack', 'indie', 'pop'], country: 'Europa', reach: 0, responseDays: 14,
    description: 'Licencjonujemy muzykę do reklam, filmów i gier.',
    collaboration: { model: 'revshare', ratePercent: 30, durationMonths: 24, terms: '30% z opłat licencyjnych za umieszczenia, umowa niewyłączna.' } },
  // --- DJ / producenci ---
  { name: 'Nocna Zmiana – audycja z miksami', creatorTypes: ['dj'], type: 'mixseries', genres: ['house', 'deep house', 'techno', 'melodic techno'], country: 'Polska', reach: 18000, responseDays: 10,
    description: 'Cotygodniowa audycja: jeden gościnny mix 60 min + wywiad.',
    collaboration: { model: 'barter', terms: 'Premiera Twojego miksu w audycji za udostępnienie odcinka w Twoich kanałach.' } },
  { name: 'Bass Collective – promotor i booking', creatorTypes: ['dj'], type: 'promoter', genres: ['drum & bass', 'dubstep', 'techno'], country: 'Polska', reach: 25000, responseDays: 14,
    description: 'Organizujemy imprezy w 5 miastach i szukamy nowych DJ-ów do supportów.',
    collaboration: { model: 'commission', ratePercent: 10, durationMonths: 12, terms: '10% honorariów z występów pozyskanych przez nas przez 12 miesięcy.' } },
  // --- pisarze / autorzy ---
  { name: '@czytam.nocami – BookTok', creatorTypes: ['writer'], type: 'tiktok', genres: ['kryminał', 'thriller', 'fantasy', 'romans', 'young adult'], country: 'Polska', reach: 85000, responseDays: 10,
    description: 'Recenzje i polecajki w 60 sekund. Czytam e-booki i papier.',
    collaboration: { model: 'commission', ratePercent: 10, durationMonths: 6, terms: 'Film z recenzją + link; 10% przychodów autora z książki przez 6 miesięcy.' } },
  { name: 'Zakładka – blog literacki', creatorTypes: ['writer'], type: 'blog', genres: ['literatura piękna', 'obyczajowa', 'reportaż', 'poezja'], country: 'Polska', reach: 15000, responseDays: 21,
    description: 'Recenzje debiutów i wywiady z autorami.',
    collaboration: { model: 'free', terms: 'Egzemplarz recenzencki (papier lub e-book) min. 6 tygodni przed premierą.' } },
  { name: 'Kryminalna Kawa – podcast', creatorTypes: ['writer'], type: 'podcast', genres: ['kryminał', 'thriller', 'reportaż'], country: 'Polska', reach: 22000, responseDays: 14,
    description: 'Rozmowy z autorami kryminałów i reportażystami.',
    collaboration: { model: 'barter', terms: 'Wywiad za udostępnienie odcinka i egzemplarz do konkursu dla słuchaczy.' } },
  { name: 'Wers – magazyn literacki', creatorTypes: ['writer'], type: 'magazine', genres: ['poezja', 'opowiadania', 'literatura piękna'], country: 'Polska', reach: 6000, responseDays: 30,
    description: 'Kwartalnik publikujący poezję i prozę debiutantów.',
    collaboration: { model: 'free', terms: 'Do 5 wierszy lub opowiadanie do 20 tys. znaków.' } },
  { name: '@bookstagram.ania', creatorTypes: ['writer'], type: 'instagram', genres: ['romans', 'obyczajowa', 'young adult', 'fantasy'], country: 'Polska', reach: 42000, responseDays: 10,
    description: 'Estetyczne zdjęcia i rolki z książkami, recenzje w stories.',
    collaboration: { model: 'fee', feePLN: 20, terms: 'Opłata za lekturę i szczery feedback; post tylko, jeśli książka mi się spodoba.' } },
  { name: 'Głosownia – studio audiobooków', creatorTypes: ['writer'], type: 'audiobook', genres: [], country: 'Polska', reach: 0, responseDays: 21,
    description: 'Nagrywamy i dystrybuujemy audiobooki bez opłat z góry.',
    collaboration: { model: 'revshare', ratePercent: 30, durationMonths: 36, terms: '30% przychodów z audiobooka przez 36 miesięcy; nagranie i dystrybucja po naszej stronie.' } },
  { name: 'Klub Książki Na Rogu', creatorTypes: ['writer'], type: 'bookstore', genres: [], country: 'Polska', reach: 3000, responseDays: 14,
    description: 'Kameralna księgarnia z klubem dyskusyjnym i spotkaniami autorskimi.',
    collaboration: { model: 'barter', terms: 'Spotkanie autorskie + ekspozycja książki w zamian za promocję wydarzenia.' } },
  { name: 'Festiwal Debiutów Literackich', creatorTypes: ['writer'], type: 'festival', genres: [], country: 'Polska', reach: 12000, responseDays: 30, minLevel: 2,
    description: 'Scena dla debiutantów: czytania, panele, spotkania z wydawcami.',
    collaboration: { model: 'barter', terms: 'Udział bez honorarium; nagranie wystąpienia i promocja w mediach festiwalu.' } },
];

function seed(store) {
  const createdAt = new Date().toISOString();
  for (const s of SAMPLES) {
    store.data.outlets.push({
      id: newId('out'),
      language: 'polski',
      url: 'https://example.com',
      contactEmail: 'kontakt@example.com',
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
