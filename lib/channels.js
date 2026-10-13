'use strict';

// Biblioteka oficjalnych, darmowych lub tanich kanałów promocji na świecie.
// To nie są partnerzy platformy – to kanały, z których artysta powinien skorzystać
// równolegle; planer premiery układa je w harmonogram. Weryfikuj zasady u źródła – zmieniają się.
// offsetDays: ile dni przed (ujemne) / po (dodatnie) premierze wykonać krok.
const CHANNELS = [
  // --- streaming: narzędzia oficjalne (0 zł) ---
  { id: 'spotify-pitch', group: 'Streaming – oficjalne', name: 'Spotify for Artists – pitch do redakcji', region: 'świat', cost: 'free', impact: 5,
    offsetDays: -21, url: 'https://artists.spotify.com',
    how: 'Zgłoś niewydany utwór w zakładce Music → Upcoming. Min. 7 dni przed premierą (trafia wtedy do Release Radar obserwujących); im wcześniej, tym lepiej.' },
  { id: 'apple-music', group: 'Streaming – oficjalne', name: 'Apple Music for Artists', region: 'świat', cost: 'free', impact: 3,
    offsetDays: -28, url: 'https://artists.apple.com',
    how: 'Odbierz profil, ustaw zdjęcie i statystyki (w tym Shazam). Pitch redakcyjny idzie przez dystrybutora – poproś o niego przy uploadzie.' },
  { id: 'amazon-music', group: 'Streaming – oficjalne', name: 'Amazon Music for Artists', region: 'świat', cost: 'free', impact: 2,
    offsetDays: -28, url: 'https://artists.amazonmusic.com',
    how: 'Odbierz profil, uzupełnij bio i zdjęcia; dane o słuchaczach pomogą w targetowaniu.' },
  { id: 'deezer', group: 'Streaming – oficjalne', name: 'Deezer for Creators', region: 'świat (silny we Francji)', cost: 'free', impact: 2,
    offsetDays: -28, url: 'https://creators.deezer.com',
    how: 'Odbierz profil artysty i uzupełnij materiały.' },
  { id: 'youtube-oac', group: 'Video', name: 'YouTube – Official Artist Channel', region: 'świat', cost: 'free', impact: 4,
    offsetDays: -30, url: 'https://artists.youtube',
    how: 'Połącz kanał z muzyką z dystrybutora (oficjalny kanał artysty). Przygotuj teledysk/visualizer, premierę i Shorts z hookiem.' },
  { id: 'tiktok-artists', group: 'Video', name: 'TikTok for Artists', region: 'świat', cost: 'free', impact: 5,
    offsetDays: -14, url: 'https://artists.tiktok.com',
    how: 'Odbierz profil artysty. Na 2 tygodnie przed premierą publikuj teasery 15–30 s z najmocniejszym fragmentem; po premierze dodaj dźwięk do biblioteki.' },
  { id: 'instagram-reels', group: 'Video', name: 'Instagram Reels + Stories z muzyką', region: 'świat', cost: 'free', impact: 4,
    offsetDays: -10, url: 'https://www.instagram.com',
    how: 'Teasery, kulisy, odliczanie. Utwór z dystrybucji będzie dostępny jako dźwięk w Reels.' },
  { id: 'musixmatch', group: 'Metadane i tekst', name: 'Musixmatch for Artists', region: 'świat', cost: 'free', impact: 2,
    offsetDays: -7, url: 'https://www.musixmatch.com/artists',
    how: 'Dodaj zsynchronizowany tekst – wyświetla się m.in. w aplikacjach streamingowych i Stories.' },
  { id: 'genius', group: 'Metadane i tekst', name: 'Genius – zweryfikowany artysta', region: 'świat', cost: 'free', impact: 1,
    offsetDays: 1, url: 'https://genius.com',
    how: 'Dodaj tekst i adnotacje autorskie po premierze – długoterminowy ruch z wyszukiwarek.' },
  // --- społeczności i niezależne media ---
  { id: 'soundcloud', group: 'Społeczności', name: 'SoundCloud', region: 'świat', cost: 'free', impact: 2,
    offsetDays: 0, url: 'https://soundcloud.com',
    how: 'Publikuj wersje rozszerzone, remiksy i demo; komentuj i repostuj w swojej niszy.' },
  { id: 'bandcamp', group: 'Społeczności', name: 'Bandcamp (+ redakcja Bandcamp Daily)', region: 'świat', cost: 'free', impact: 2,
    offsetDays: 0, url: 'https://bandcamp.com',
    how: 'Sprzedaż bezpośrednia fanom i merch; dobrze opisany release zwiększa szansę na wyróżnienie redakcyjne.' },
  { id: 'reddit', group: 'Społeczności', name: 'Reddit – subreddity gatunkowe', region: 'świat (anglojęzyczne)', cost: 'free', impact: 2,
    offsetDays: 2, url: 'https://www.reddit.com/r/listentothis/',
    how: 'Przeczytaj zasady każdej społeczności (wiele zakazuje autopromocji). Udzielaj się, zanim wrzucisz swój utwór.' },
  { id: 'hypem', group: 'Blogi', name: 'Hype Machine – blogi śledzone przez agregator', region: 'świat', cost: 'free', impact: 2,
    offsetDays: -21, url: 'https://hypem.com',
    how: 'Lista blogów śledzonych przez agregator to gotowa baza do pitchu prasowego; recenzja na jednym z nich trafia do agregatora.' },
  // --- radio ---
  { id: 'bbc-introducing', group: 'Radio', name: 'BBC Music Introducing – Uploader', region: 'Wielka Brytania', cost: 'free', impact: 4,
    offsetDays: -28, url: 'https://www.bbc.co.uk/introducing',
    how: 'Bezpłatny upload dla niezależnych artystów związanych z UK; utwory słuchają lokalne zespoły BBC i mogą przekazać je do stacji ogólnokrajowych.' },
  { id: 'pl-regional-radio', group: 'Radio', name: 'Regionalne rozgłośnie Polskiego Radia i radia lokalne', region: 'Polska', cost: 'free', impact: 3,
    offsetDays: -35, url: 'https://www.polskieradio.pl',
    how: 'Większość rozgłośni ma audycje z debiutami. Wyślij WAV/MP3 320, notkę prasową i zdjęcie do redaktora konkretnej audycji (nie na ogólny adres).' },
  { id: 'college-radio', group: 'Radio', name: 'Radia akademickie i studenckie', region: 'Polska / świat', cost: 'free', impact: 2,
    offsetDays: -28, url: 'https://pl.wikipedia.org/wiki/Radio_akademickie',
    how: 'Otwarte na debiuty, często mają listy przebojów i sesje na żywo.' },
  // --- live i trasy ---
  { id: 'bandsintown', group: 'Koncerty', name: 'Bandsintown for Artists', region: 'świat', cost: 'free', impact: 2,
    offsetDays: -30, url: 'https://artists.bandsintown.com',
    how: 'Dodaj koncerty – fani dostają powiadomienia, daty pokazują się m.in. w Spotify.' },
  // --- benchmark: płatne zgłoszenia (dla porównania kosztów) ---
  { id: 'paid-submission', group: 'Benchmark – płatne zgłoszenia', name: 'Serwisy płatnych zgłoszeń (np. SubmitHub, Groover)', region: 'świat', cost: 'paid', impact: 3,
    offsetDays: 3, url: 'https://www.submithub.com',
    how: 'Płatność za każde zgłoszenie (rzędu 1–2 € / zgłoszenie), bez gwarancji umieszczenia. W Promo Hub te same typy miejsc są dostępne w modelu prowizyjnym – 0 zł z góry.' },
];

// Kroki własne Promo Hub dołączane do planu premiery.
const HUB_STEPS = [
  { offsetDays: -42, name: 'Promo Hub: zgłoś utwór do radiów i podcastów', how: 'Radia planują ramówkę z wyprzedzeniem – zgłoś 4–6 tygodni przed premierą.', types: ['radio', 'webradio', 'podcast', 'college'] },
  { offsetDays: -35, name: 'Dystrybucja: wyślij utwór do dystrybutora', how: 'Bez wcześniejszego uploadu nie zrobisz pitchu redakcyjnego ani pre-save.', types: [] },
  { offsetDays: -21, name: 'Promo Hub: blogi, newslettery, prasa, YouTube', how: 'Daj mediom czas na recenzję w dniu premiery.', types: ['blog', 'newsletter', 'press', 'youtube'] },
  { offsetDays: -14, name: 'Promo Hub: twórcy TikTok / Instagram', how: 'Twórcy potrzebują czasu na nagranie treści do dnia premiery.', types: ['tiktok', 'instagram', 'twitch', 'brand'] },
  { offsetDays: 0, name: 'PREMIERA', how: 'Udostępnij wszędzie, podziękuj kuratorom, przypnij utwór na profilach.', types: [] },
  { offsetDays: 1, name: 'Promo Hub: kuratorzy playlist i DJ-e', how: 'Playlisty niezależne dodają utwory już dostępne w serwisach – zgłaszaj w pierwszym tygodniu.', types: ['playlist', 'dj', 'club', 'community'] },
  { offsetDays: 30, name: 'Promo Hub: zgłoś przychody za pierwszy miesiąc', how: 'Rozlicz prowizje – rzetelne raporty podnoszą Twoją wiarygodność u kuratorów.', types: [] },
  { offsetDays: 45, name: 'Promo Hub: sync i wytwórnie', how: 'Z danymi z pierwszego miesiąca masz mocniejszy argument dla sync i A&R.', types: ['sync', 'label', 'tv'] },
];

module.exports = { CHANNELS, HUB_STEPS };
