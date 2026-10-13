'use strict';

const { bi } = require('./i18n');

// Master Conductor A–Z: the full life cycle of a release, step by step, for every creator type.
// offsetDays counts from the release date. Phases are assigned automatically from offsetDays.
// Institutions’ and platforms’ rules change – tasks say WHAT to do and WHEN; check details at the source.

const PHASES = [
  { id: 'A', from: -999, to: -91, name: bi('Foundation', 'Fundament'), goal: bi('Goals, budget, identity – before you publish anything.', 'Cele, budżet, tożsamość – zanim cokolwiek opublikujesz.') },
  { id: 'B', from: -90, to: -61, name: bi('Assets', 'Materiały'), goal: bi('Everything media and curators need.', 'Wszystko, czego potrzebują media i kuratorzy.') },
  { id: 'C', from: -60, to: -46, name: bi('Rights & metadata', 'Prawa i metadane'), goal: bi('Identifiers, registrations, royalties – so the money reaches you.', 'Identyfikatory, rejestracje, tantiemy – żeby pieniądze do Ciebie trafiały.') },
  { id: 'D', from: -45, to: -29, name: bi('Distribution', 'Dystrybucja'), goal: bi('The work is in distribution systems well in advance.', 'Dzieło w systemach dystrybucji z wyprzedzeniem.') },
  { id: 'E', from: -28, to: -1, name: bi('Pre-release', 'Pre-premiera'), goal: bi('Pitches, teasers, submission waves, anticipation.', 'Pitch, teasery, fale zgłoszeń, budowanie oczekiwania.') },
  { id: 'F', from: 0, to: 0, name: bi('Release', 'Premiera'), goal: bi('Every section plays at once.', 'Wszystkie sekcje grają jednocześnie.') },
  { id: 'G', from: 1, to: 14, name: bi('Post-release', 'Po premierze'), goal: bi('Keep momentum, reactions, first data.', 'Podtrzymanie impetu, reakcje, pierwsze dane.') },
  { id: 'H', from: 15, to: 59, name: bi('Long tail', 'Długi ogon'), goal: bi('New forms of the same work, new markets, settlements.', 'Nowe formy tego samego dzieła, kolejne rynki, rozliczenia.') },
  { id: 'I', from: 60, to: 999, name: bi('Scaling', 'Skalowanie'), goal: bi('Sync, deals, international reach and the next release.', 'Sync, kontrakty, zagranica i następna premiera.') },
];

function phaseFor(offsetDays) {
  return PHASES.find((p) => offsetDays >= p.from && offsetDays <= p.to).id;
}

const ALL = ['music', 'dj', 'writer'];
const t = (id, forTypes, offsetDays, impact, name, how) => ({ id, for: forTypes, offsetDays, impact, name, how });

const PLAYBOOK = [
  // ---------- A. Foundation ----------
  t('goal-kpi', ALL, -120, 3, bi('Set campaign goals and metrics', 'Ustal cele i mierniki kampanii'),
    bi('E.g. 5 placements, 50k reach, 300 new followers, 1 review in a major outlet. Without a goal you can’t tell what worked.', 'Np. 5 umieszczeń, 50 tys. zasięgu, 300 nowych obserwujących, 1 recenzja w dużym medium. Bez celu nie ocenisz, co zadziałało.')),
  t('budget', ALL, -120, 2, bi('Plan the budget (zero is fine)', 'Zaplanuj budżet (także 0 zł)'),
    bi('Split it: assets, review fees, an ad test. Promo Hub’s commission model lets you start without cash.', 'Rozdziel: materiały, opłaty za odsłuch, test reklam. Model prowizyjny Promo Hub pozwala zacząć bez gotówki.')),
  t('identity', ALL, -110, 3, bi('Your artistic identity in one sentence', 'Tożsamość artystyczna w 1 zdaniu'),
    bi('“For fans of X and Y” + what sets you apart. It goes into your bio, pitch and descriptions – curators decide in seconds.', '„Dla fanów X i Y” + co Cię wyróżnia. To zdanie trafi do bio, pitchu i opisów – kuratorzy decydują w kilka sekund.')),
  t('audience', ALL, -100, 3, bi('Define your audience and 3 target markets', 'Określ odbiorców i 3 rynki docelowe'),
    bi('Age, cities, countries, similar creators. The conductor picks outlets in those countries once you reach level 4.', 'Wiek, miasta, kraje, podobni twórcy. Dyrygent dobierze miejsca w tych krajach, gdy osiągniesz poziom 4.')),
  t('release-rhythm', ['music', 'dj'], -95, 3, bi('Plan a release rhythm', 'Zaplanuj rytm wydawniczy'),
    bi('A single every 6–8 weeks keeps algorithms and curators engaged; this release is one link in a series.', 'Single co 6–8 tygodni utrzymują algorytmy i kuratorów w ruchu; to wydanie to jedno ogniwo serii.')),
  t('manuscript', ['writer'], -180, 5, bi('Editing and proofreading', 'Redakcja i korekta tekstu'),
    bi('Professional structural edit, copy edit and proofreading – reviewers spot every mistake.', 'Profesjonalna redakcja merytoryczna, językowa i korekta – recenzenci bezlitośnie wyłapują błędy.')),
  t('publish-path', ['writer'], -150, 4, bi('Choose your publishing path', 'Wybierz ścieżkę wydania'),
    bi('Traditional, hybrid or self-publishing – it determines rights, timelines and distribution.', 'Wydawnictwo tradycyjne, współfinansowane czy self-publishing – od tego zależą prawa, terminy i dystrybucja.')),

  // ---------- B. Assets ----------
  t('photos', ALL, -80, 3, bi('Photo session (portrait and landscape, high resolution)', 'Sesja zdjęciowa (pion i poziom, wysoka rozdzielczość)'),
    bi('At least 3 photos: portrait, wide shot, social-media crop. Consistent with the cover.', 'Min. 3 zdjęcia: portret, plan szeroki, kadr pod social media. Spójne z okładką.')),
  t('cover', ['music', 'dj'], -75, 4, bi('Cover art 3000×3000 px', 'Okładka 3000×3000 px'),
    bi('Readable as a thumbnail, no platform logos or links (distributor requirement).', 'Czytelna w miniaturze, bez logotypów platform i linków (wymóg dystrybutorów).')),
  t('master', ['music', 'dj'], -75, 5, bi('Mix and master + versions (clean, instrumental, extended)', 'Mix i mastering + wersje (clean, instrumental, extended)'),
    bi('Clean for radio, instrumental for sync, extended for DJs. 24-bit WAV files.', 'Wersja clean dla radia, instrumental dla sync, extended dla DJ-ów. Pliki WAV 24-bit.')),
  t('book-cover', ['writer'], -90, 5, bi('Cover and typesetting (print + e-book)', 'Okładka i skład (druk + e-book)'),
    bi('A cover that reads as a thumbnail; EPUB and print-ready PDF.', 'Okładka czytelna w miniaturze; skład EPUB i PDF do druku.')),
  t('blurb', ['writer'], -85, 4, bi('Blurb, downloadable excerpt and “for fans of…” line', 'Blurb, fragment do pobrania i opis „dla fanów…”'),
    bi('Back-cover and store copy, the first chapter as a free sample, comparisons to known titles.', 'Opis na okładkę i do sklepów, pierwszy rozdział jako darmowy fragment, porównania do znanych tytułów.')),
  t('video', ['music', 'dj'], -70, 4, bi('Music video / visualizer / live recording', 'Teledysk / visualizer / nagranie live'),
    bi('Even a simple visualizer helps on YouTube and with media. DJs: a 60–90 s showreel from gigs.', 'Nawet prosty visualizer zwiększa szanse na YouTube i w mediach. DJ: showreel z gigów (60–90 s).')),
  t('shorts-bank', ALL, -65, 5, bi('A bank of 10–15 short clips (15–30 s)', 'Bank 10–15 krótkich form (15–30 s)'),
    bi('Hook, behind the scenes, reactions, quotes, “for fans of X”. Fuel for TikTok/Reels/Shorts for 6 weeks.', 'Hook, kulisy, reakcje, cytaty, „dla fanów X”. To paliwo na TikTok/Reels/Shorts przez 6 tygodni.')),
  t('bio', ALL, -65, 4, bi('Short, medium and long bio (+ English version)', 'Bio krótkie, średnie i długie (+ wersja angielska)'),
    bi('50 / 150 / 400 words. An English version opens international doors. Add it to your Promo Hub profile.', '50 / 150 / 400 słów. Wersja angielska otwiera zagranicę. Uzupełnij w profilu Promo Hub.')),
  t('epk', ALL, -62, 4, bi('Press kit (EPK) on Promo Hub', 'Press kit (EPK) w Promo Hub'),
    bi('Photos, bio, achievements, links – curators see it with every submission.', 'Zdjęcia, bio, osiągnięcia, linki – kuratorzy widzą go przy każdym zgłoszeniu.')),
  t('dj-rider', ['dj'], -62, 3, bi('Tech rider, logo and fees', 'Rider techniczny, logo i stawki'),
    bi('Promoters expect a rider (gear, set length), a vector logo and clear terms.', 'Promotorzy oczekują riderów (sprzęt, czas setu), logo w wektorze i jasnych warunków.')),

  // ---------- C. Rights & metadata ----------
  t('splits', ['music', 'dj'], -60, 4, bi('Write down the split sheet', 'Spisz podział praw (split sheet)'),
    bi('Who wrote the music and lyrics, who produced, in what proportions – before any money arrives.', 'Kto jest autorem muzyki, tekstu, kto producentem i w jakich proporcjach – zanim pojawią się pieniądze.')),
  t('samples', ['music', 'dj'], -58, 4, bi('Clear samples and interpolations', 'Wyczyść sample i interpolacje'),
    bi('An uncleared sample means takedowns and blocked sync.', 'Niewyczyszczony sample to zdjęcie utworu z platform i blokada sync.')),
  t('cmo-authors', ['music', 'dj'], -55, 4, bi('Register the work with your authors’ society (PRO)', 'Rejestracja utworu w organizacji autorskiej'),
    bi('E.g. ZAiKS in Poland, PRS in the UK, ASCAP/BMI in the US, GEMA in Germany. Without registration you lose radio and live royalties.', 'W Polsce m.in. ZAiKS; za granicą np. PRS, ASCAP/BMI, GEMA. Bez rejestracji tracisz tantiemy z radia i koncertów.')),
  t('cmo-performers', ['music', 'dj'], -55, 3, bi('Performer and producer rights', 'Prawa wykonawców i producentów'),
    bi('Neighbouring-rights societies (e.g. STOART/SAWP and ZPAV in Poland, PPL in the UK). US listeners: consider SoundExchange.', 'W Polsce m.in. STOART / SAWP (wykonawcy) i ZPAV (producenci, krajowa agencja ISRC). Słuchacze w USA: rozważ SoundExchange.')),
  t('isrc', ['music', 'dj'], -50, 4, bi('ISRC codes and metadata', 'Kody ISRC i metadane'),
    bi('Your distributor or national agency issues ISRCs. Check spelling of names, features, credits, genre and language.', 'ISRC nadaje dystrybutor lub krajowa agencja. Sprawdź pisownię nazw, featuringi, autorów, gatunek i język.')),
  t('isbn-meta', ['writer'], -60, 4, bi('ISBN, Thema/BISAC categories and keywords', 'ISBN, kategorie Thema/BISAC i słowa kluczowe'),
    bi('A separate ISBN for each format. Categories and keywords drive store visibility.', 'Osobny ISBN dla każdego formatu. Kategorie i słowa kluczowe decydują o widoczności w sklepach.')),
  t('writer-cmo', ['writer'], -50, 3, bi('Author royalties – collective management', 'Tantiemy autorskie – organizacje zbiorowego zarządzania'),
    bi('Check collecting societies in your country (e.g. ZAiKS, Copyright Polska, ALCS in the UK) – lending and reprography royalties.', 'Sprawdź organizacje (np. ZAiKS, Copyright Polska) – tantiemy m.in. z użyczeń bibliotecznych i reprografii.')),
  t('legal-deposit', ['writer'], -46, 2, bi('Legal deposit copies', 'Egzemplarz obowiązkowy'),
    bi('Publishers (including self-publishers) usually must deliver legal deposit copies to national libraries – check current rules.', 'Wydawca (także self-publisher) przekazuje egzemplarze obowiązkowe do wskazanych bibliotek – sprawdź aktualne przepisy.')),

  // ---------- D. Distribution ----------
  t('distributor', ['music', 'dj'], -42, 5, bi('Upload to your distributor (4–6 weeks before release)', 'Upload do dystrybutora (min. 4–6 tygodni przed premierą)'),
    bi('Set a future release date – only then can you pitch editors, run pre-saves and enable Content ID.', 'Zaznacz datę premiery w przyszłości – tylko wtedy zrobisz pitch redakcyjny, pre-save i Content ID.')),
  t('content-id', ['music', 'dj'], -40, 3, bi('Content ID and video monetization', 'Content ID i monetyzacja wideo'),
    bi('Through your distributor: revenue from every YouTube video using your track (and from TikTok/Meta sound libraries).', 'Przez dystrybutora: przychody z każdego filmu z Twoim utworem na YouTube (i z biblioteki dźwięków TikTok/Meta).')),
  t('preorder', ['writer'], -40, 4, bi('Store pre-orders', 'Przedsprzedaż w sklepach'),
    bi('Pre-orders count on release day – better positions in store charts.', 'Zamówienia przedpremierowe kumulują się w dniu premiery – lepsze pozycje w rankingach sklepów.')),
  t('arc-copies', ['writer'], -42, 5, bi('Review copies (print + e-book)', 'Egzemplarze recenzenckie (papier + e-book)'),
    bi('Prepare a pool of copies for reviewers, BookTok and Bookstagram – Promo Hub sends them out in waves.', 'Przygotuj pulę egzemplarzy dla recenzentów, BookTok i Bookstagram – Promo Hub roześle je falami.')),

  // ---------- E. Pre-release ----------
  t('presave', ['music', 'dj'], -21, 4, bi('Pre-save / smart link', 'Pre-save / smart link'),
    bi('One link to every platform in your bio and descriptions; pre-saves feed algorithms on release day.', 'Jeden link do wszystkich platform w bio i opisach; zapisane pre-save’y zasilają algorytmy w dniu premiery.')),
  t('teasers', ALL, -14, 5, bi('Teasers 3–4× a week', 'Teasery 3–4× w tygodniu'),
    bi('Post from your clip bank; test which part travels – promote that one on release day.', 'Publikuj z banku krótkich form; testuj, który fragment niesie – ten promuj w dniu premiery.')),
  t('mailing', ALL, -10, 4, bi('Announce to your mailing list and fans', 'Zapowiedź do listy mailingowej i fanów'),
    bi('Your mailing list is the only channel you own. Ask for sign-ups, pre-orders or pre-saves.', 'Lista mailingowa to kanał, który należy tylko do Ciebie. Poproś o zapis/pre-order/pre-save.')),
  t('local-media', ALL, -10, 3, bi('Local media (city, region, university)', 'Media lokalne (miasto, region, uczelnia)'),
    bi('Local portals, papers and stations love writing about “their own” – the easiest first review.', 'Lokalne portale, gazety i rozgłośnie chętnie piszą o „swoich” – to najłatwiejsza pierwsza recenzja.')),
  t('author-events', ['writer'], -20, 3, bi('Plan author events (libraries, bookshops, cultural centres)', 'Zaplanuj spotkania autorskie (biblioteki, księgarnie, domy kultury)'),
    bi('Public libraries happily host authors – and buy copies for their networks.', 'Biblioteki publiczne chętnie goszczą autorów – to też zakupy egzemplarzy do sieci bibliotek.')),
  t('dj-promo', ['dj'], -14, 4, bi('Promo to DJ friends and collecting support', 'Promo do zaprzyjaźnionych DJ-ów i zbieranie supportów'),
    bi('A “played by…” list is social proof for labels and promoters.', 'Lista supportów („grane przez…”) to dowód społeczny do pitchu dla wytwórni i promotorów.')),

  // ---------- F. Release ----------
  t('launch-post', ALL, 0, 5, bi('Release everywhere at once', 'Premiera wszędzie naraz'),
    bi('Post, reel, stories, newsletter, pinned posts, new profile images/banners, link in bio.', 'Post, rolka, stories, newsletter, przypięte posty, zmiana zdjęć profilowych/banerów, link w bio.')),
  t('launch-live', ALL, 0, 3, bi('Live stream / live premiere', 'Live / premiera na żywo'),
    bi('A stream with a listening/reading and a chat with fans – algorithms reward release-day activity.', 'Transmisja z odsłuchem/czytaniem i rozmową z fanami – algorytmy promują aktywność w dniu premiery.')),
  t('thank-curators', ALL, 0, 3, bi('Thank curators and share their posts', 'Podziękuj kuratorom i udostępnij ich publikacje'),
    bi('Tag and share – curators return to creators who promote their channels.', 'Oznaczaj, udostępniaj – kuratorzy wracają do twórców, którzy promują ich kanały.')),

  // ---------- G. Post-release ----------
  t('ugc', ALL, 3, 4, bi('Encourage fan content', 'Zachęcaj do treści od fanów'),
    bi('A challenge, a duet, a quote to share. Repost every reaction.', 'Wyzwanie, duet, cytat do udostępnienia. Udostępniaj każdą reakcję.')),
  t('ads-test', ALL, 5, 3, bi('A small ad test (optional)', 'Mały test reklam (opcjonalnie)'),
    bi('Run your best teaser as an ad on a small daily budget for 5–7 days; stop if cost per follower rises.', 'Najlepszy teaser jako reklama z niskim budżetem dziennym przez 5–7 dni; zatrzymaj, jeśli koszt obserwującego rośnie.')),
  t('review-7', ALL, 7, 4, bi('7-day review', 'Analiza po 7 dniach'),
    bi('Which outlets, countries and formats worked? Update listeners/readers in your profile – it raises your level.', 'Które miejsca, kraje i formy zadziałały? Zaktualizuj słuchaczy/czytelników w profilu – to podnosi Twój poziom.')),
  t('reader-reviews', ['writer'], 7, 4, bi('Reader ratings in the first 2 weeks', 'Oceny czytelników w pierwszych 2 tygodniach'),
    bi('Ask your first readers to rate the book on Goodreads, lubimyczytać.pl and in stores.', 'Poproś pierwszych czytelników o ocenę na lubimyczytać.pl / Goodreads / w sklepach.')),

  // ---------- H. Long tail ----------
  t('versions', ['music', 'dj'], 21, 4, bi('New versions: acoustic, remix, sped up / slowed', 'Nowe wersje: akustyczna, remix, sped up / slowed'),
    bi('More releases of the same track mean new chances on playlists and trends.', 'Kolejne wydania tego samego utworu to nowe szanse na playlisty i trendy.')),
  t('live-session', ['music', 'dj'], 28, 3, bi('Live session / gig recording', 'Sesja live / nagranie z gigu'),
    bi('Material for session channels on YouTube and for promoters.', 'Materiał dla kanałów YouTube z sesjami i dla promotorów.')),
  t('audio-ebook', ['writer'], 30, 3, bi('Another format: audiobook / e-book / translated excerpt', 'Kolejny format: audiobook / e-book / tłumaczenie fragmentu'),
    bi('A new format means new readers and a new wave of reviews.', 'Nowy format = nowi odbiorcy i nowa fala recenzji.')),
  t('review-30', ALL, 30, 4, bi('30-day review and commission settlement', 'Analiza po 30 dniach i rozliczenie prowizji'),
    bi('Report revenue to the Effect Pool, check your level on the Creator Path, note lessons for the next campaign.', 'Zgłoś przychód w Pulę Efektu, sprawdź poziom na Ścieżce artysty, zapisz wnioski do następnej kampanii.')),
  t('new-markets', ALL, 45, 3, bi('A new market: a country where your audience grows', 'Nowy rynek: kraj, w którym rośnie publiczność'),
    bi('Submit to outlets from that country (catalog → country filter) with your English bio.', 'Zgłoś dzieło do miejsc z tego kraju (katalog → filtr kraju), użyj bio EN.')),

  // ---------- I. Scaling ----------
  t('next-release', ALL, 60, 5, bi('Plan your next release in the Conductor', 'Zaplanuj następną premierę w Dyrygencie'),
    bi('Continuity is the biggest multiplier – each campaign starts from a higher level with better data.', 'Ciągłość to największy mnożnik – każda kampania startuje z wyższego poziomu i z lepszymi danymi.')),
  t('booking', ['music', 'dj'], 75, 4, bi('Shows / booking with campaign data', 'Koncerty / booking z danymi kampanii'),
    bi('With listener numbers per city, approach clubs and promoters; add dates to Bandsintown / RA.', 'Z liczbą słuchaczy w miastach idź do klubów i promotorów; dodaj daty do Bandsintown / RA.')),
  t('rights-deals', ['writer'], 90, 4, bi('Subsidiary rights: translation, audio, screen', 'Prawa zależne: tłumaczenia, audiobook, ekranizacja'),
    bi('With results and reviews, approach agents and foreign publishers (catalog: Publisher / agent).', 'Z wynikami i recenzjami zgłoś się do agentów i wydawców zagranicznych (katalog: Wydawnictwo / agent).')),
  t('review-90', ALL, 90, 3, bi('90-day wrap-up', 'Podsumowanie po 90 dniach'),
    bi('What gave the biggest effect for the lowest cost? That knowledge is your edge in the next campaigns.', 'Co dało największy efekt za najmniejszy koszt? Ta wiedza to Twoja przewaga w kolejnych kampaniach.')),
];

module.exports = { PHASES, PLAYBOOK, phaseFor };
