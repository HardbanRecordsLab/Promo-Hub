'use strict';

const { bi } = require('./i18n');

// Library of official, free or cheap promotion channels worldwide.
// These are not platform partners – creators should use them alongside a campaign;
// the conductor places them in the release timeline. Rules change – always verify at the source.
// offsetDays: days before (negative) / after (positive) the release date.

const G = {
  streaming: bi('Streaming – official tools', 'Streaming – narzędzia oficjalne'),
  video: bi('Video', 'Video'),
  meta: bi('Metadata & lyrics', 'Metadane i tekst'),
  community: bi('Communities', 'Społeczności'),
  blogs: bi('Blogs', 'Blogi'),
  radio: bi('Radio', 'Radio'),
  live: bi('Live & touring', 'Koncerty'),
  benchmark: bi('Benchmark – paid', 'Benchmark – płatne'),
  dj: bi('DJ platforms', 'DJ – platformy'),
  book: bi('Publishing', 'Wydanie książki'),
  readers: bi('Reader communities', 'Społeczności czytelników'),
  newsletter: bi('Newsletter', 'Newsletter'),
};

const WW = bi('worldwide', 'świat');
const M = ['music', 'dj'];

const CHANNELS = [
  // --- streaming: official tools (free) ---
  { id: 'spotify-pitch', for: M, group: G.streaming, name: bi('Spotify for Artists – editorial pitch', 'Spotify for Artists – pitch do redakcji'), region: WW, cost: 'free', impact: 5,
    offsetDays: -21, url: 'https://artists.spotify.com',
    how: bi('Pitch an unreleased track under Music → Upcoming at least 7 days before release (it then reaches followers’ Release Radar); earlier is better.',
      'Zgłoś niewydany utwór w zakładce Music → Upcoming min. 7 dni przed premierą (trafia wtedy do Release Radar obserwujących); im wcześniej, tym lepiej.') },
  { id: 'apple-music', for: M, group: G.streaming, name: bi('Apple Music for Artists', 'Apple Music for Artists'), region: WW, cost: 'free', impact: 3,
    offsetDays: -28, url: 'https://artists.apple.com',
    how: bi('Claim your profile, set your photo and stats (incl. Shazam). Editorial pitching goes through your distributor – ask for it at upload.',
      'Odbierz profil, ustaw zdjęcie i statystyki (w tym Shazam). Pitch redakcyjny idzie przez dystrybutora – poproś o niego przy uploadzie.') },
  { id: 'amazon-music', for: M, group: G.streaming, name: bi('Amazon Music for Artists', 'Amazon Music for Artists'), region: WW, cost: 'free', impact: 2,
    offsetDays: -28, url: 'https://artists.amazonmusic.com',
    how: bi('Claim your profile, add bio and photos; listener data helps targeting.', 'Odbierz profil, uzupełnij bio i zdjęcia; dane o słuchaczach pomogą w targetowaniu.') },
  { id: 'deezer', for: M, group: G.streaming, name: bi('Deezer for Creators', 'Deezer for Creators'), region: bi('worldwide (strong in France)', 'świat (silny we Francji)'), cost: 'free', impact: 2,
    offsetDays: -28, url: 'https://creators.deezer.com',
    how: bi('Claim your artist profile and complete your assets.', 'Odbierz profil artysty i uzupełnij materiały.') },
  { id: 'youtube-oac', for: M, group: G.video, name: bi('YouTube – Official Artist Channel', 'YouTube – Official Artist Channel'), region: WW, cost: 'free', impact: 4,
    offsetDays: -30, url: 'https://artists.youtube',
    how: bi('Merge your channel with your distributed music (Official Artist Channel). Prepare a video/visualizer, a premiere and Shorts with the hook.',
      'Połącz kanał z muzyką z dystrybutora (oficjalny kanał artysty). Przygotuj teledysk/visualizer, premierę i Shorts z hookiem.') },
  { id: 'tiktok-artists', for: M, group: G.video, name: bi('TikTok for Artists', 'TikTok for Artists'), region: WW, cost: 'free', impact: 5,
    offsetDays: -14, url: 'https://artists.tiktok.com',
    how: bi('Claim your artist profile. Two weeks before release post 15–30 s teasers with the strongest part; after release add the sound to the library.',
      'Odbierz profil artysty. Na 2 tygodnie przed premierą publikuj teasery 15–30 s z najmocniejszym fragmentem; po premierze dodaj dźwięk do biblioteki.') },
  { id: 'instagram-reels', for: M, group: G.video, name: bi('Instagram Reels + Stories with music', 'Instagram Reels + Stories z muzyką'), region: WW, cost: 'free', impact: 4,
    offsetDays: -10, url: 'https://www.instagram.com',
    how: bi('Teasers, behind the scenes, countdown. Your distributed track becomes available as a Reels sound.', 'Teasery, kulisy, odliczanie. Utwór z dystrybucji będzie dostępny jako dźwięk w Reels.') },
  { id: 'musixmatch', for: M, group: G.meta, name: bi('Musixmatch for Artists', 'Musixmatch for Artists'), region: WW, cost: 'free', impact: 2,
    offsetDays: -7, url: 'https://www.musixmatch.com/artists',
    how: bi('Add synced lyrics – they show up in streaming apps and Stories.', 'Dodaj zsynchronizowany tekst – wyświetla się m.in. w aplikacjach streamingowych i Stories.') },
  { id: 'genius', for: M, group: G.meta, name: bi('Genius – verified artist', 'Genius – zweryfikowany artysta'), region: WW, cost: 'free', impact: 1,
    offsetDays: 1, url: 'https://genius.com',
    how: bi('Add lyrics and your own annotations after release – long-term search traffic.', 'Dodaj tekst i adnotacje autorskie po premierze – długoterminowy ruch z wyszukiwarek.') },
  // --- communities and independent media ---
  { id: 'soundcloud', for: M, group: G.community, name: bi('SoundCloud', 'SoundCloud'), region: WW, cost: 'free', impact: 2,
    offsetDays: 0, url: 'https://soundcloud.com',
    how: bi('Post extended versions, remixes and demos; comment and repost within your niche.', 'Publikuj wersje rozszerzone, remiksy i demo; komentuj i repostuj w swojej niszy.') },
  { id: 'bandcamp', for: M, group: G.community, name: bi('Bandcamp (+ Bandcamp Daily editorial)', 'Bandcamp (+ redakcja Bandcamp Daily)'), region: WW, cost: 'free', impact: 2,
    offsetDays: 0, url: 'https://bandcamp.com',
    how: bi('Direct sales to fans and merch; a well-described release improves the chance of editorial features.', 'Sprzedaż bezpośrednia fanom i merch; dobrze opisany release zwiększa szansę na wyróżnienie redakcyjne.') },
  { id: 'reddit', for: M, group: G.community, name: bi('Reddit – genre subreddits', 'Reddit – subreddity gatunkowe'), region: bi('worldwide (English)', 'świat (anglojęzyczne)'), cost: 'free', impact: 2,
    offsetDays: 2, url: 'https://www.reddit.com/r/listentothis/',
    how: bi('Read each community’s rules (many ban self-promotion). Participate before you post your own work.', 'Przeczytaj zasady każdej społeczności (wiele zakazuje autopromocji). Udzielaj się, zanim wrzucisz swój utwór.') },
  { id: 'hypem', for: M, group: G.blogs, name: bi('Hype Machine – blogs indexed by the aggregator', 'Hype Machine – blogi śledzone przez agregator'), region: WW, cost: 'free', impact: 2,
    offsetDays: -21, url: 'https://hypem.com',
    how: bi('The list of indexed blogs is a ready-made press pitch list; a review on one of them reaches the aggregator.', 'Lista blogów śledzonych przez agregator to gotowa baza do pitchu prasowego; recenzja na jednym z nich trafia do agregatora.') },
  // --- radio ---
  { id: 'bbc-introducing', for: M, group: G.radio, name: bi('BBC Music Introducing – Uploader', 'BBC Music Introducing – Uploader'), region: bi('United Kingdom', 'Wielka Brytania'), cost: 'free', impact: 4,
    offsetDays: -28, url: 'https://www.bbc.co.uk/introducing',
    how: bi('Free uploads for independent artists connected to the UK; local BBC teams listen and can pass tracks to national stations.',
      'Bezpłatny upload dla niezależnych artystów związanych z UK; lokalne zespoły BBC słuchają i mogą przekazać utwory do stacji ogólnokrajowych.') },
  { id: 'pl-regional-radio', for: M, group: G.radio, name: bi('Regional public radio and local stations (Poland)', 'Regionalne rozgłośnie Polskiego Radia i radia lokalne'), region: bi('Poland', 'Polska'), cost: 'free', impact: 3,
    offsetDays: -35, url: 'https://www.polskieradio.pl',
    how: bi('Most stations run new-music shows. Send WAV/MP3 320, a press note and a photo to the editor of a specific show (not a general inbox).',
      'Większość rozgłośni ma audycje z debiutami. Wyślij WAV/MP3 320, notkę prasową i zdjęcie do redaktora konkretnej audycji (nie na ogólny adres).') },
  { id: 'college-radio', for: M, group: G.radio, name: bi('College and student radio', 'Radia akademickie i studenckie'), region: WW, cost: 'free', impact: 2,
    offsetDays: -28, url: 'https://en.wikipedia.org/wiki/Campus_radio',
    how: bi('Open to newcomers, often with charts and live sessions.', 'Otwarte na debiuty, często mają listy przebojów i sesje na żywo.') },
  // --- live and touring ---
  { id: 'bandsintown', for: M, group: G.live, name: bi('Bandsintown for Artists', 'Bandsintown for Artists'), region: WW, cost: 'free', impact: 2,
    offsetDays: -30, url: 'https://artists.bandsintown.com',
    how: bi('Add your shows – fans get notified and dates appear on Spotify and elsewhere.', 'Dodaj koncerty – fani dostają powiadomienia, daty pokazują się m.in. w Spotify.') },
  // --- benchmark: paid submissions (for cost comparison) ---
  { id: 'paid-submission', for: M, group: G.benchmark, name: bi('Paid submission services (e.g. SubmitHub, Groover)', 'Serwisy płatnych zgłoszeń (np. SubmitHub, Groover)'), region: WW, cost: 'paid', impact: 3,
    offsetDays: 3, url: 'https://www.submithub.com',
    how: bi('You pay per submission (roughly €1–2 each) with no guaranteed placement. Promo Hub offers the same kinds of outlets on commission – €0 upfront.',
      'Płatność za każde zgłoszenie (rzędu 1–2 € / zgłoszenie), bez gwarancji umieszczenia. W Promo Hub te same typy miejsc są dostępne w modelu prowizyjnym – 0 zł z góry.') },
  // --- DJs / producers ---
  { id: 'mixcloud', for: ['dj'], group: G.dj, name: bi('Mixcloud', 'Mixcloud'), region: WW, cost: 'free', impact: 4,
    offsetDays: 0, url: 'https://www.mixcloud.com',
    how: bi('Publish full sets and shows – the platform licenses the tracks in your mixes. Genre tags and tracklists improve discovery.',
      'Publikuj pełne sety i audycje – platforma rozlicza licencje utworów w miksach. Tagi gatunków i tracklisty zwiększają odkrywalność.') },
  { id: 'resident-advisor', for: ['dj'], group: G.dj, name: bi('Resident Advisor – artist profile and events', 'Resident Advisor – profil artysty i wydarzenia'), region: WW, cost: 'free', impact: 4,
    offsetDays: -21, url: 'https://ra.co',
    how: bi('Complete your DJ profile and link the events you play – promoters check RA before booking.', 'Uzupełnij profil DJ-a i podpinaj wydarzenia, na których grasz – promotorzy sprawdzają tam artystów przed bookingiem.') },
  { id: 'beatport', for: ['dj'], group: G.dj, name: bi('Beatport / Traxsource – releases', 'Beatport / Traxsource – wydania produkcji'), region: WW, cost: 'free', impact: 3,
    offsetDays: -35, url: 'https://www.beatport.com',
    how: bi('Club productions get there through a label or distributor – include an extended version and correct genres.', 'Produkcje klubowe trafiają tam przez wytwórnię lub dystrybutora – zadbaj o wersję extended i poprawne gatunki.') },
  // --- writers / authors ---
  { id: 'isbn', for: ['writer'], group: G.book, name: bi('ISBN – your national ISBN agency', 'ISBN – e-ISBN (Biblioteka Narodowa)'), region: WW, cost: 'free', impact: 3,
    offsetDays: -90, url: 'https://www.isbn-international.org/agencies',
    how: bi('Get an ISBN for each format of a self-published book – without it most bookshops and wholesalers won’t list it. In Poland ISBNs are free via e-ISBN (National Library).',
      'Nadaj numer ISBN dla każdego formatu (wydanie własne) – bez niego książka nie trafi do większości księgarń i hurtowni. W Polsce bezpłatnie przez e-isbn.pl (Biblioteka Narodowa).') },
  { id: 'kdp', for: ['writer'], group: G.book, name: bi('Amazon KDP + Author Central', 'Amazon KDP + Author Central'), region: WW, cost: 'free', impact: 4,
    offsetDays: -45, url: 'https://kdp.amazon.com',
    how: bi('Self-publish the e-book and print-on-demand; set up your author page in Author Central (bio, photo, all books).', 'Self-publishing e-booka i druku na żądanie; w Author Central załóż stronę autora (bio, zdjęcie, wszystkie książki).') },
  { id: 'goodreads', for: ['writer'], group: G.readers, name: bi('Goodreads Author Program', 'Goodreads Author Program'), region: WW, cost: 'free', impact: 4,
    offsetDays: -60, url: 'https://www.goodreads.com/author/program',
    how: bi('Claim your author profile, add the book before release (“want to read” shelves), reply to readers.', 'Odbierz profil autora, dodaj książkę przed premierą (półki „chcę przeczytać”), odpowiadaj czytelnikom.') },
  { id: 'lubimyczytac', for: ['writer'], group: G.readers, name: bi('lubimyczytać.pl (Poland)', 'lubimyczytać.pl'), region: bi('Poland', 'Polska'), cost: 'free', impact: 4,
    offsetDays: -30, url: 'https://lubimyczytac.pl',
    how: bi('Poland’s largest reader community – complete the book page and author profile; ask reviewers to rate on release day.', 'Największa polska społeczność czytelników – zadbaj o kartę książki i profil autora, zachęcaj recenzentów do ocen w dniu premiery.') },
  { id: 'booktok', for: ['writer'], group: G.video, name: bi('BookTok (TikTok) and Bookstagram', 'BookTok (TikTok) i Bookstagram'), region: WW, cost: 'free', impact: 5,
    offsetDays: -21, url: 'https://www.tiktok.com/tag/booktok',
    how: bi('Short formats: quotes, “for fans of X”, writing behind the scenes. Send review copies to creators about 3 weeks before release.', 'Krótkie formy: cytaty, „książka dla fanów X”, kulisy pisania. Egzemplarze recenzenckie dla twórców wyślij ok. 3 tygodnie przed premierą.') },
  { id: 'wattpad', for: ['writer'], group: G.readers, name: bi('Wattpad – serialized publishing', 'Wattpad – publikacja w odcinkach'), region: WW, cost: 'free', impact: 2,
    offsetDays: -60, url: 'https://www.wattpad.com',
    how: bi('Publish excerpts or a prequel to build readers before release.', 'Opublikuj fragmenty lub prequel, aby zbudować czytelników przed premierą.') },
  { id: 'substack', for: ['writer'], group: G.newsletter, name: bi('Your own newsletter (e.g. Substack)', 'Własny newsletter (np. Substack)'), region: WW, cost: 'free', impact: 3,
    offsetDays: -45, url: 'https://substack.com',
    how: bi('A reader mailing list is the only channel you own – announcements, excerpts, pre-orders.', 'Lista mailingowa czytelników to jedyny kanał, który należy do Ciebie – zapowiedzi, fragmenty, przedsprzedaż.') },
  { id: 'audiobook', for: ['writer'], group: G.book, name: bi('Audiobook (ACX / Storytel / audio publisher)', 'Audiobook (ACX / Storytel / wydawca audio)'), region: WW, cost: 'free', impact: 3,
    offsetDays: 30, url: 'https://www.acx.com',
    how: bi('An audio edition reaches new audiences; consider a royalty share with the narrator instead of an upfront fee.', 'Wersja audio otwiera nowych odbiorców; rozważ podział przychodów z lektorem zamiast opłaty z góry.') },
  { id: 'ebook-subscriptions', for: ['writer'], group: G.book, name: bi('E-book stores and subscriptions (e.g. Kobo, Legimi, Empik Go)', 'E-book w sklepach i abonamentach (np. Kobo, Legimi, Empik Go)'), region: WW, cost: 'free', impact: 3,
    offsetDays: -14, url: 'https://www.kobo.com/writinglife',
    how: bi('Distribute via your publisher or an e-book aggregator – check that the book is available in subscriptions on release day.', 'Dystrybucja przez wydawcę lub agregatora e-booków – sprawdź, czy książka będzie dostępna w abonamentach w dniu premiery.') },
  { id: 'netgalley', for: ['writer'], group: G.benchmark, name: bi('NetGalley – review copies (paid)', 'NetGalley – egzemplarze recenzenckie (płatne)'), region: WW, cost: 'paid', impact: 3,
    offsetDays: -60, url: 'https://www.netgalley.com',
    how: bi('A paid review-copy platform for publishers. In Promo Hub you reach reviewers, BookTok and blogs on commission or barter.', 'Płatna platforma egzemplarzy recenzenckich dla wydawców. W Promo Hub recenzentów, BookTok i blogi dostajesz w modelu prowizyjnym lub barterowym.') },
];

// Promo Hub waves per creator type (types = outlet types sent in that wave).
const step = (id, offsetDays, name, how, types) => ({ id, offsetDays, name, how, types });

const MUSIC_STEPS = [
  step('m-radio', -42, bi('Promo Hub: radio and podcasts', 'Promo Hub: zgłoś utwór do radiów i podcastów'), bi('Radio plans ahead – submit 4–6 weeks before release.', 'Radia planują ramówkę z wyprzedzeniem – zgłoś 4–6 tygodni przed premierą.'), ['radio', 'webradio', 'podcast', 'college', 'mixseries']),
  step('m-distribution', -35, bi('Distribution: upload to your distributor', 'Dystrybucja: wyślij utwór do dystrybutora'), bi('Without an early upload there is no editorial pitch and no pre-save.', 'Bez wcześniejszego uploadu nie zrobisz pitchu redakcyjnego ani pre-save.'), []),
  step('m-media', -21, bi('Promo Hub: blogs, newsletters, press, YouTube', 'Promo Hub: blogi, newslettery, prasa, YouTube'), bi('Give media time to review for release day.', 'Daj mediom czas na recenzję w dniu premiery.'), ['blog', 'newsletter', 'press', 'youtube', 'magazine']),
  step('m-creators', -14, bi('Promo Hub: TikTok / Instagram creators', 'Promo Hub: twórcy TikTok / Instagram'), bi('Creators need time to film content for release day.', 'Twórcy potrzebują czasu na nagranie treści do dnia premiery.'), ['tiktok', 'instagram', 'twitch', 'brand']),
  step('m-release', 0, bi('RELEASE', 'PREMIERA'), bi('Share everywhere, thank the curators, pin the track on your profiles.', 'Udostępnij wszędzie, podziękuj kuratorom, przypnij utwór na profilach.'), []),
  step('m-playlists', 1, bi('Promo Hub: playlist curators and DJs', 'Promo Hub: kuratorzy playlist i DJ-e'), bi('Independent playlists add tracks that are already live – submit in the first week.', 'Playlisty niezależne dodają utwory już dostępne w serwisach – zgłaszaj w pierwszym tygodniu.'), ['playlist', 'dj', 'club', 'community', 'promoter', 'festival']),
  step('m-report', 30, bi('Promo Hub: report your first month’s revenue', 'Promo Hub: zgłoś przychody za pierwszy miesiąc'), bi('Settle commissions – honest reports raise your credibility with curators.', 'Rozlicz prowizje – rzetelne raporty podnoszą Twoją wiarygodność u kuratorów.'), []),
  step('m-sync', 45, bi('Promo Hub: sync and labels', 'Promo Hub: sync i wytwórnie'), bi('With first-month data you have a stronger case for sync and A&R.', 'Z danymi z pierwszego miesiąca masz mocniejszy argument dla sync i A&R.'), ['sync', 'label', 'tv']),
];

const DJ_STEPS = [
  step('d-radio', -30, bi('Promo Hub: mix series, shows and radio', 'Promo Hub: serie miksów, audycje i radia'), bi('Mix shows plan episodes in advance.', 'Audycje z miksami planują odcinki z wyprzedzeniem.'), ['mixseries', 'radio', 'webradio', 'podcast', 'college']),
  step('d-media', -21, bi('Promo Hub: club blogs and media', 'Promo Hub: blogi i media klubowe'), bi('A premiere on a blog gives you content to share.', 'Premiera utworu lub miksu na blogu daje treść do udostępnień.'), ['blog', 'newsletter', 'press', 'magazine']),
  step('d-promo', -14, bi('Promo Hub: promo to DJs and record pools', 'Promo Hub: promo do DJ-ów i pul DJ-skich'), bi('Support from other DJs before release builds hype and data for your pitch.', 'Support od innych DJ-ów przed premierą buduje „hype” i dane do pitchu.'), ['dj']),
  step('d-creators', -10, bi('Promo Hub: video creators and streamers', 'Promo Hub: twórcy video i streamerzy'), bi('Set clips and crowd reactions are the best Reels/TikTok material.', 'Fragmenty setów i reakcje parkietu to najlepszy materiał na Reels/TikTok.'), ['tiktok', 'instagram', 'youtube', 'twitch', 'brand']),
  step('d-release', 0, bi('RELEASE', 'PREMIERA'), bi('Publish the set / release, thank the DJs who supported it.', 'Publikacja setu / wydania, podziękowania dla supportujących DJ-ów.'), []),
  step('d-playlists', 1, bi('Promo Hub: playlists and communities', 'Promo Hub: playlisty i społeczności'), bi('Club playlists and genre communities.', 'Playlisty klubowe i społeczności gatunkowe.'), ['playlist', 'community']),
  step('d-booking', 14, bi('Promo Hub: clubs, promoters and festivals', 'Promo Hub: kluby, promotorzy i festiwale'), bi('Plays and DJ support give you a case for bookings.', 'Z liczbami odsłuchów i supportami masz argument do bookingu.'), ['club', 'promoter', 'festival']),
  step('d-report', 30, bi('Promo Hub: report your first month’s revenue', 'Promo Hub: zgłoś przychody za pierwszy miesiąc'), bi('Settle commissions.', 'Rozlicz prowizje.'), []),
  step('d-labels', 45, bi('Promo Hub: labels and sync', 'Promo Hub: wytwórnie i sync'), bi('Club labels look for producers with documented support.', 'Wytwórnie klubowe szukają producentów z udokumentowanym supportem.'), ['label', 'sync', 'tv']),
];

const WRITER_STEPS = [
  step('w-arc', -60, bi('Promo Hub: review copies – blogs, Bookstagram, magazines', 'Promo Hub: egzemplarze recenzenckie – blogi, Bookstagram, magazyny'), bi('Reviewers need 6–8 weeks to read and write for release day.', 'Recenzenci potrzebują 6–8 tygodni na lekturę i tekst na dzień premiery.'), ['blog', 'instagram', 'magazine', 'press', 'newsletter']),
  step('w-audio', -45, bi('Promo Hub: podcasts and radio interviews', 'Promo Hub: podcasty i radio – wywiady'), bi('Interviews are recorded in advance and aired around release.', 'Wywiady nagrywa się z wyprzedzeniem – emisja w okolicach premiery.'), ['podcast', 'radio', 'webradio', 'college']),
  step('w-video', -21, bi('Promo Hub: BookTok, YouTube and creators', 'Promo Hub: BookTok, YouTube i twórcy'), bi('Video creators need time to read and film.', 'Twórcy wideo potrzebują czasu na przeczytanie i nagranie.'), ['tiktok', 'youtube', 'twitch', 'brand']),
  step('w-shops', -14, bi('Promo Hub: bookshops, book clubs, e-book/audio platforms', 'Promo Hub: księgarnie, kluby książki, platformy e-book/audio'), bi('Bookshop and subscription features are planned before release.', 'Wyróżnienia w księgarniach i abonamentach planowane są przed premierą.'), ['bookstore', 'audiobook', 'community']),
  step('w-release', 0, bi('RELEASE', 'PREMIERA'), bi('Announce everywhere and ask readers for ratings in the first week.', 'Ogłoś premierę wszędzie, poproś czytelników o oceny w pierwszym tygodniu.'), []),
  step('w-events', 7, bi('Promo Hub: festivals, fairs and author events', 'Promo Hub: festiwale, targi i spotkania autorskie'), bi('Meeting readers after release sustains sales.', 'Spotkania z czytelnikami po premierze utrwalają sprzedaż.'), ['festival', 'club']),
  step('w-report', 30, bi('Promo Hub: report your first month’s revenue', 'Promo Hub: zgłoś przychody za pierwszy miesiąc'), bi('Settle reviewer and creator commissions.', 'Rozlicz prowizje recenzentów i twórców.'), []),
  step('w-rights', 60, bi('Promo Hub: foreign publishers, agents, screen rights', 'Promo Hub: wydawcy zagraniczni, agenci, prawa do ekranizacji'), bi('With sales and reviews you have a case for translations and adaptations.', 'Z wynikami sprzedaży i recenzjami masz argument dla tłumaczeń i adaptacji.'), ['publisher', 'sync', 'tv', 'label']),
];

const HUB_STEPS = { music: MUSIC_STEPS, dj: DJ_STEPS, writer: WRITER_STEPS };

module.exports = { CHANNELS, HUB_STEPS };
