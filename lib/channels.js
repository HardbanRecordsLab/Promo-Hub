'use strict';

// Biblioteka oficjalnych, darmowych lub tanich kanałów promocji na świecie.
// To nie są partnerzy platformy – to kanały, z których artysta powinien skorzystać
// równolegle; planer premiery układa je w harmonogram. Weryfikuj zasady u źródła – zmieniają się.
// offsetDays: ile dni przed (ujemne) / po (dodatnie) premierze wykonać krok.
const CHANNELS = [
  // --- streaming: narzędzia oficjalne (0 zł) ---
  { id: 'spotify-pitch', for: ['music', 'dj'], group: 'Streaming – oficjalne', name: 'Spotify for Artists – pitch do redakcji', region: 'świat', cost: 'free', impact: 5,
    offsetDays: -21, url: 'https://artists.spotify.com',
    how: 'Zgłoś niewydany utwór w zakładce Music → Upcoming. Min. 7 dni przed premierą (trafia wtedy do Release Radar obserwujących); im wcześniej, tym lepiej.' },
  { id: 'apple-music', for: ['music', 'dj'], group: 'Streaming – oficjalne', name: 'Apple Music for Artists', region: 'świat', cost: 'free', impact: 3,
    offsetDays: -28, url: 'https://artists.apple.com',
    how: 'Odbierz profil, ustaw zdjęcie i statystyki (w tym Shazam). Pitch redakcyjny idzie przez dystrybutora – poproś o niego przy uploadzie.' },
  { id: 'amazon-music', for: ['music', 'dj'], group: 'Streaming – oficjalne', name: 'Amazon Music for Artists', region: 'świat', cost: 'free', impact: 2,
    offsetDays: -28, url: 'https://artists.amazonmusic.com',
    how: 'Odbierz profil, uzupełnij bio i zdjęcia; dane o słuchaczach pomogą w targetowaniu.' },
  { id: 'deezer', for: ['music', 'dj'], group: 'Streaming – oficjalne', name: 'Deezer for Creators', region: 'świat (silny we Francji)', cost: 'free', impact: 2,
    offsetDays: -28, url: 'https://creators.deezer.com',
    how: 'Odbierz profil artysty i uzupełnij materiały.' },
  { id: 'youtube-oac', for: ['music', 'dj'], group: 'Video', name: 'YouTube – Official Artist Channel', region: 'świat', cost: 'free', impact: 4,
    offsetDays: -30, url: 'https://artists.youtube',
    how: 'Połącz kanał z muzyką z dystrybutora (oficjalny kanał artysty). Przygotuj teledysk/visualizer, premierę i Shorts z hookiem.' },
  { id: 'tiktok-artists', for: ['music', 'dj'], group: 'Video', name: 'TikTok for Artists', region: 'świat', cost: 'free', impact: 5,
    offsetDays: -14, url: 'https://artists.tiktok.com',
    how: 'Odbierz profil artysty. Na 2 tygodnie przed premierą publikuj teasery 15–30 s z najmocniejszym fragmentem; po premierze dodaj dźwięk do biblioteki.' },
  { id: 'instagram-reels', for: ['music', 'dj'], group: 'Video', name: 'Instagram Reels + Stories z muzyką', region: 'świat', cost: 'free', impact: 4,
    offsetDays: -10, url: 'https://www.instagram.com',
    how: 'Teasery, kulisy, odliczanie. Utwór z dystrybucji będzie dostępny jako dźwięk w Reels.' },
  { id: 'musixmatch', for: ['music', 'dj'], group: 'Metadane i tekst', name: 'Musixmatch for Artists', region: 'świat', cost: 'free', impact: 2,
    offsetDays: -7, url: 'https://www.musixmatch.com/artists',
    how: 'Dodaj zsynchronizowany tekst – wyświetla się m.in. w aplikacjach streamingowych i Stories.' },
  { id: 'genius', for: ['music', 'dj'], group: 'Metadane i tekst', name: 'Genius – zweryfikowany artysta', region: 'świat', cost: 'free', impact: 1,
    offsetDays: 1, url: 'https://genius.com',
    how: 'Dodaj tekst i adnotacje autorskie po premierze – długoterminowy ruch z wyszukiwarek.' },
  // --- społeczności i niezależne media ---
  { id: 'soundcloud', for: ['music', 'dj'], group: 'Społeczności', name: 'SoundCloud', region: 'świat', cost: 'free', impact: 2,
    offsetDays: 0, url: 'https://soundcloud.com',
    how: 'Publikuj wersje rozszerzone, remiksy i demo; komentuj i repostuj w swojej niszy.' },
  { id: 'bandcamp', for: ['music', 'dj'], group: 'Społeczności', name: 'Bandcamp (+ redakcja Bandcamp Daily)', region: 'świat', cost: 'free', impact: 2,
    offsetDays: 0, url: 'https://bandcamp.com',
    how: 'Sprzedaż bezpośrednia fanom i merch; dobrze opisany release zwiększa szansę na wyróżnienie redakcyjne.' },
  { id: 'reddit', for: ['music', 'dj'], group: 'Społeczności', name: 'Reddit – subreddity gatunkowe', region: 'świat (anglojęzyczne)', cost: 'free', impact: 2,
    offsetDays: 2, url: 'https://www.reddit.com/r/listentothis/',
    how: 'Przeczytaj zasady każdej społeczności (wiele zakazuje autopromocji). Udzielaj się, zanim wrzucisz swój utwór.' },
  { id: 'hypem', for: ['music', 'dj'], group: 'Blogi', name: 'Hype Machine – blogi śledzone przez agregator', region: 'świat', cost: 'free', impact: 2,
    offsetDays: -21, url: 'https://hypem.com',
    how: 'Lista blogów śledzonych przez agregator to gotowa baza do pitchu prasowego; recenzja na jednym z nich trafia do agregatora.' },
  // --- radio ---
  { id: 'bbc-introducing', for: ['music', 'dj'], group: 'Radio', name: 'BBC Music Introducing – Uploader', region: 'Wielka Brytania', cost: 'free', impact: 4,
    offsetDays: -28, url: 'https://www.bbc.co.uk/introducing',
    how: 'Bezpłatny upload dla niezależnych artystów związanych z UK; utwory słuchają lokalne zespoły BBC i mogą przekazać je do stacji ogólnokrajowych.' },
  { id: 'pl-regional-radio', for: ['music', 'dj'], group: 'Radio', name: 'Regionalne rozgłośnie Polskiego Radia i radia lokalne', region: 'Polska', cost: 'free', impact: 3,
    offsetDays: -35, url: 'https://www.polskieradio.pl',
    how: 'Większość rozgłośni ma audycje z debiutami. Wyślij WAV/MP3 320, notkę prasową i zdjęcie do redaktora konkretnej audycji (nie na ogólny adres).' },
  { id: 'college-radio', for: ['music', 'dj'], group: 'Radio', name: 'Radia akademickie i studenckie', region: 'Polska / świat', cost: 'free', impact: 2,
    offsetDays: -28, url: 'https://pl.wikipedia.org/wiki/Radio_akademickie',
    how: 'Otwarte na debiuty, często mają listy przebojów i sesje na żywo.' },
  // --- live i trasy ---
  { id: 'bandsintown', for: ['music', 'dj'], group: 'Koncerty', name: 'Bandsintown for Artists', region: 'świat', cost: 'free', impact: 2,
    offsetDays: -30, url: 'https://artists.bandsintown.com',
    how: 'Dodaj koncerty – fani dostają powiadomienia, daty pokazują się m.in. w Spotify.' },
  // --- benchmark: płatne zgłoszenia (dla porównania kosztów) ---
  { id: 'paid-submission', for: ['music', 'dj'], group: 'Benchmark – płatne zgłoszenia', name: 'Serwisy płatnych zgłoszeń (np. SubmitHub, Groover)', region: 'świat', cost: 'paid', impact: 3,
    offsetDays: 3, url: 'https://www.submithub.com',
    how: 'Płatność za każde zgłoszenie (rzędu 1–2 € / zgłoszenie), bez gwarancji umieszczenia. W Promo Hub te same typy miejsc są dostępne w modelu prowizyjnym – 0 zł z góry.' },
  // --- DJ / producenci ---
  { id: 'mixcloud', for: ['dj'], group: 'DJ – platformy', name: 'Mixcloud', region: 'świat', cost: 'free', impact: 4,
    offsetDays: 0, url: 'https://www.mixcloud.com',
    how: 'Publikuj pełne sety i audycje – platforma rozlicza licencje utworów w miksach. Tagi gatunków i tracklisty zwiększają odkrywalność.' },
  { id: 'resident-advisor', for: ['dj'], group: 'DJ – platformy', name: 'Resident Advisor – profil artysty i wydarzenia', region: 'świat', cost: 'free', impact: 4,
    offsetDays: -21, url: 'https://ra.co',
    how: 'Uzupełnij profil DJ-a i podpinaj wydarzenia, na których grasz – promotorzy sprawdzają tam artystów przed bookingiem.' },
  { id: 'beatport', for: ['dj'], group: 'DJ – platformy', name: 'Beatport / Traxsource – wydania produkcji', region: 'świat', cost: 'free', impact: 3,
    offsetDays: -35, url: 'https://www.beatport.com',
    how: 'Produkcje klubowe trafiają tam przez wytwórnię lub dystrybutora – zadbaj o wersję extended i poprawne gatunki.' },
  // --- pisarze / autorzy ---
  { id: 'isbn', for: ['writer'], group: 'Wydanie książki', name: 'ISBN – e-ISBN (Biblioteka Narodowa)', region: 'Polska', cost: 'free', impact: 3,
    offsetDays: -90, url: 'https://e-isbn.pl',
    how: 'Nadaj numer ISBN (dla wydania własnego) – bez niego książka nie trafi do większości księgarń i hurtowni.' },
  { id: 'kdp', for: ['writer'], group: 'Wydanie książki', name: 'Amazon KDP + Author Central', region: 'świat', cost: 'free', impact: 4,
    offsetDays: -45, url: 'https://kdp.amazon.com',
    how: 'Self-publishing e-booka i druku na żądanie; w Author Central załóż stronę autora (bio, zdjęcie, wszystkie książki).' },
  { id: 'goodreads', for: ['writer'], group: 'Społeczności czytelników', name: 'Goodreads Author Program', region: 'świat', cost: 'free', impact: 4,
    offsetDays: -60, url: 'https://www.goodreads.com/author/program',
    how: 'Odbierz profil autora, dodaj książkę przed premierą (półki „chcę przeczytać”), odpowiadaj czytelnikom.' },
  { id: 'lubimyczytac', for: ['writer'], group: 'Społeczności czytelników', name: 'lubimyczytać.pl', region: 'Polska', cost: 'free', impact: 4,
    offsetDays: -30, url: 'https://lubimyczytac.pl',
    how: 'Największa polska społeczność czytelników – zadbaj o kartę książki i profil autora, zachęcaj recenzentów do ocen w dniu premiery.' },
  { id: 'booktok', for: ['writer'], group: 'Video', name: 'BookTok (TikTok) i Bookstagram', region: 'świat', cost: 'free', impact: 5,
    offsetDays: -21, url: 'https://www.tiktok.com/tag/booktok',
    how: 'Krótkie formy: cytaty, „książka dla fanów X”, kulisy pisania. Egzemplarze recenzenckie dla twórców wyślij ok. 3 tygodnie przed premierą.' },
  { id: 'wattpad', for: ['writer'], group: 'Społeczności czytelników', name: 'Wattpad – publikacja w odcinkach', region: 'świat', cost: 'free', impact: 2,
    offsetDays: -60, url: 'https://www.wattpad.com',
    how: 'Opublikuj fragmenty lub prequel, aby zbudować czytelników przed premierą.' },
  { id: 'substack', for: ['writer'], group: 'Newsletter', name: 'Własny newsletter (np. Substack)', region: 'świat', cost: 'free', impact: 3,
    offsetDays: -45, url: 'https://substack.com',
    how: 'Lista mailingowa czytelników to jedyny kanał, który należy do Ciebie – zapowiedzi, fragmenty, przedsprzedaż.' },
  { id: 'audiobook', for: ['writer'], group: 'Wydanie książki', name: 'Audiobook (ACX / Storytel / wydawca audio)', region: 'świat', cost: 'free', impact: 3,
    offsetDays: 30, url: 'https://www.acx.com',
    how: 'Wersja audio otwiera nowych odbiorców; rozważ podział przychodów z lektorem zamiast opłaty z góry.' },
  { id: 'ebook-pl', for: ['writer'], group: 'Wydanie książki', name: 'E-book w polskich sklepach i abonamentach (np. Legimi, Empik Go)', region: 'Polska', cost: 'free', impact: 3,
    offsetDays: -14, url: 'https://www.legimi.pl',
    how: 'Dystrybucja przez wydawcę lub agregatora e-booków – sprawdź, czy książka będzie dostępna w abonamentach w dniu premiery.' },
  { id: 'netgalley', for: ['writer'], group: 'Benchmark – płatne', name: 'NetGalley – egzemplarze recenzenckie (płatne)', region: 'świat', cost: 'paid', impact: 3,
    offsetDays: -60, url: 'https://www.netgalley.com',
    how: 'Płatna platforma egzemplarzy recenzenckich dla wydawców. W Promo Hub recenzentów, BookTok i blogi dostajesz w modelu prowizyjnym lub barterowym.' },
];

// Kroki własne Promo Hub dołączane do planu premiery.
const MUSIC_STEPS = [
  { offsetDays: -42, name: 'Promo Hub: zgłoś utwór do radiów i podcastów', how: 'Radia planują ramówkę z wyprzedzeniem – zgłoś 4–6 tygodni przed premierą.', types: ['radio', 'webradio', 'podcast', 'college', 'mixseries'] },
  { offsetDays: -35, name: 'Dystrybucja: wyślij utwór do dystrybutora', how: 'Bez wcześniejszego uploadu nie zrobisz pitchu redakcyjnego ani pre-save.', types: [] },
  { offsetDays: -21, name: 'Promo Hub: blogi, newslettery, prasa, YouTube', how: 'Daj mediom czas na recenzję w dniu premiery.', types: ['blog', 'newsletter', 'press', 'youtube', 'magazine'] },
  { offsetDays: -14, name: 'Promo Hub: twórcy TikTok / Instagram', how: 'Twórcy potrzebują czasu na nagranie treści do dnia premiery.', types: ['tiktok', 'instagram', 'twitch', 'brand'] },
  { offsetDays: 0, name: 'PREMIERA', how: 'Udostępnij wszędzie, podziękuj kuratorom, przypnij utwór na profilach.', types: [] },
  { offsetDays: 1, name: 'Promo Hub: kuratorzy playlist i DJ-e', how: 'Playlisty niezależne dodają utwory już dostępne w serwisach – zgłaszaj w pierwszym tygodniu.', types: ['playlist', 'dj', 'club', 'community', 'promoter', 'festival'] },
  { offsetDays: 30, name: 'Promo Hub: zgłoś przychody za pierwszy miesiąc', how: 'Rozlicz prowizje – rzetelne raporty podnoszą Twoją wiarygodność u kuratorów.', types: [] },
  { offsetDays: 45, name: 'Promo Hub: sync i wytwórnie', how: 'Z danymi z pierwszego miesiąca masz mocniejszy argument dla sync i A&R.', types: ['sync', 'label', 'tv'] },
];

const DJ_STEPS = [
  { offsetDays: -30, name: 'Promo Hub: serie miksów, audycje i radia', how: 'Audycje z miksami planują odcinki z wyprzedzeniem.', types: ['mixseries', 'radio', 'webradio', 'podcast', 'college'] },
  { offsetDays: -21, name: 'Promo Hub: blogi i media klubowe', how: 'Premiera utworu lub miksu na blogu daje treść do udostępnień.', types: ['blog', 'newsletter', 'press', 'magazine'] },
  { offsetDays: -14, name: 'Promo Hub: promo do DJ-ów i pul DJ-skich', how: 'Support od innych DJ-ów przed premierą buduje „hype” i dane do pitchu.', types: ['dj'] },
  { offsetDays: -10, name: 'Promo Hub: twórcy video i streamerzy', how: 'Fragmenty setów i reakcje parkietu to najlepszy materiał na Reels/TikTok.', types: ['tiktok', 'instagram', 'youtube', 'twitch', 'brand'] },
  { offsetDays: 0, name: 'PREMIERA', how: 'Publikacja setu / wydania, podziękowania dla supportujących DJ-ów.', types: [] },
  { offsetDays: 1, name: 'Promo Hub: playlisty i społeczności', how: 'Playlisty klubowe i społeczności gatunkowe.', types: ['playlist', 'community'] },
  { offsetDays: 14, name: 'Promo Hub: kluby, promotorzy i festiwale', how: 'Z liczbami odsłuchów i supportami masz argument do bookingu.', types: ['club', 'promoter', 'festival'] },
  { offsetDays: 30, name: 'Promo Hub: zgłoś przychody za pierwszy miesiąc', how: 'Rozlicz prowizje.', types: [] },
  { offsetDays: 45, name: 'Promo Hub: wytwórnie i sync', how: 'Wytwórnie klubowe szukają producentów z udokumentowanym supportem.', types: ['label', 'sync', 'tv'] },
];

const WRITER_STEPS = [
  { offsetDays: -60, name: 'Promo Hub: egzemplarze recenzenckie – blogi, Bookstagram, magazyny', how: 'Recenzenci potrzebują 6–8 tygodni na lekturę i tekst na dzień premiery.', types: ['blog', 'instagram', 'magazine', 'press', 'newsletter'] },
  { offsetDays: -45, name: 'Promo Hub: podcasty i radio – wywiady', how: 'Wywiady nagrywa się z wyprzedzeniem – emisja w okolicach premiery.', types: ['podcast', 'radio', 'webradio', 'college'] },
  { offsetDays: -21, name: 'Promo Hub: BookTok, YouTube i twórcy', how: 'Twórcy wideo potrzebują czasu na przeczytanie i nagranie.', types: ['tiktok', 'youtube', 'twitch', 'brand'] },
  { offsetDays: -14, name: 'Promo Hub: księgarnie, kluby książki, platformy e-book/audio', how: 'Wyróżnienia w księgarniach i abonamentach planowane są przed premierą.', types: ['bookstore', 'audiobook', 'community'] },
  { offsetDays: 0, name: 'PREMIERA', how: 'Ogłoś premierę wszędzie, poproś czytelników o oceny w pierwszym tygodniu.', types: [] },
  { offsetDays: 7, name: 'Promo Hub: festiwale, targi i spotkania autorskie', how: 'Spotkania z czytelnikami po premierze utrwalają sprzedaż.', types: ['festival', 'club'] },
  { offsetDays: 30, name: 'Promo Hub: zgłoś przychody za pierwszy miesiąc', how: 'Rozlicz prowizje recenzentów i twórców.', types: [] },
  { offsetDays: 60, name: 'Promo Hub: wydawcy zagraniczni, agenci, prawa do ekranizacji', how: 'Z wynikami sprzedaży i recenzjami masz argument dla tłumaczeń i adaptacji.', types: ['publisher', 'sync', 'tv', 'label'] },
];

const HUB_STEPS = { music: MUSIC_STEPS, dj: DJ_STEPS, writer: WRITER_STEPS };

module.exports = { CHANNELS, HUB_STEPS };
