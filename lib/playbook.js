'use strict';

// Master Dyrygent A–Z: pełny cykl życia premiery, krok po kroku, dla każdego typu twórcy.
// offsetDays liczone od dnia premiery. Fazy przypisywane są automatycznie po offsetDays.
// Zasady instytucji i platform się zmieniają – zadania wskazują, CO zrobić i KIEDY; szczegóły sprawdź u źródła.

const PHASES = [
  { id: 'A', name: 'Fundament', from: -999, to: -91, goal: 'Cele, budżet, tożsamość – zanim cokolwiek opublikujesz.' },
  { id: 'B', name: 'Materiały', from: -90, to: -61, goal: 'Wszystko, czego potrzebują media i kuratorzy.' },
  { id: 'C', name: 'Prawa i metadane', from: -60, to: -46, goal: 'Identyfikatory, rejestracje, tantiemy – żeby pieniądze do Ciebie trafiały.' },
  { id: 'D', name: 'Dystrybucja', from: -45, to: -29, goal: 'Dzieło w systemach dystrybucji z wyprzedzeniem.' },
  { id: 'E', name: 'Pre-premiera', from: -28, to: -1, goal: 'Pitch, teasery, fale zgłoszeń, budowanie oczekiwania.' },
  { id: 'F', name: 'Premiera', from: 0, to: 0, goal: 'Wszystkie sekcje grają jednocześnie.' },
  { id: 'G', name: 'Po premierze', from: 1, to: 14, goal: 'Podtrzymanie impetu, reakcje, pierwsze dane.' },
  { id: 'H', name: 'Długi ogon', from: 15, to: 59, goal: 'Nowe formy tego samego dzieła, kolejne rynki, rozliczenia.' },
  { id: 'I', name: 'Skalowanie', from: 60, to: 999, goal: 'Sync, kontrakty, zagranica i następna premiera.' },
];

function phaseFor(offsetDays) {
  return PHASES.find((p) => offsetDays >= p.from && offsetDays <= p.to).id;
}

const ALL = ['music', 'dj', 'writer'];

const PLAYBOOK = [
  // ---------- A. Fundament ----------
  { id: 'goal-kpi', for: ALL, offsetDays: -120, impact: 3, name: 'Ustal cele i mierniki kampanii',
    how: 'Np. 5 umieszczeń, 50 tys. zasięgu, 300 nowych obserwujących, 1 recenzja w dużym medium. Bez celu nie ocenisz, co zadziałało.' },
  { id: 'budget', for: ALL, offsetDays: -120, impact: 2, name: 'Zaplanuj budżet (także 0 zł)',
    how: 'Rozdziel: materiały, opłaty za odsłuch, test reklam. Model prowizyjny Promo Hub pozwala zacząć bez gotówki.' },
  { id: 'identity', for: ALL, offsetDays: -110, impact: 3, name: 'Tożsamość artystyczna w 1 zdaniu',
    how: '„Dla fanów X i Y” + co Cię wyróżnia. To zdanie trafi do bio, pitchu i opisów – kuratorzy decydują w kilka sekund.' },
  { id: 'audience', for: ALL, offsetDays: -100, impact: 3, name: 'Określ odbiorców i 3 rynki docelowe',
    how: 'Wiek, miasta, kraje, podobni twórcy. Dyrygent dobierze miejsca w tych krajach, gdy osiągniesz poziom 4.' },
  { id: 'release-rhythm', for: ['music', 'dj'], offsetDays: -95, impact: 3, name: 'Zaplanuj rytm wydawniczy',
    how: 'Single co 6–8 tygodni utrzymują algorytmy i kuratorów w ruchu; to wydanie to jedno ogniwo serii.' },
  { id: 'manuscript', for: ['writer'], offsetDays: -180, impact: 5, name: 'Redakcja i korekta tekstu',
    how: 'Profesjonalna redakcja merytoryczna, językowa i korekta – recenzenci bezlitośnie wyłapują błędy.' },
  { id: 'publish-path', for: ['writer'], offsetDays: -150, impact: 4, name: 'Wybierz ścieżkę wydania',
    how: 'Wydawnictwo tradycyjne, współfinansowane czy self-publishing – od tego zależą prawa, terminy i dystrybucja.' },

  // ---------- B. Materiały ----------
  { id: 'photos', for: ALL, offsetDays: -80, impact: 3, name: 'Sesja zdjęciowa (pion i poziom, wysoka rozdzielczość)',
    how: 'Min. 3 zdjęcia: portret, plan szeroki, kadr pod social media. Spójne z okładką.' },
  { id: 'cover', for: ['music', 'dj'], offsetDays: -75, impact: 4, name: 'Okładka 3000×3000 px',
    how: 'Czytelna w miniaturze, bez logotypów platform i linków (wymóg dystrybutorów).' },
  { id: 'master', for: ['music', 'dj'], offsetDays: -75, impact: 5, name: 'Mix i mastering + wersje (clean, instrumental, extended)',
    how: 'Wersja clean dla radia, instrumental dla sync, extended dla DJ-ów. Pliki WAV 24-bit.' },
  { id: 'book-cover', for: ['writer'], offsetDays: -90, impact: 5, name: 'Okładka i skład (druk + e-book)',
    how: 'Okładka czytelna w miniaturze; skład EPUB/MOBI i PDF do druku.' },
  { id: 'blurb', for: ['writer'], offsetDays: -85, impact: 4, name: 'Blurb, fragment do pobrania i opis „dla fanów…”',
    how: 'Opis na okładkę i do sklepów, pierwszy rozdział jako darmowy fragment, porównania do znanych tytułów.' },
  { id: 'video', for: ['music', 'dj'], offsetDays: -70, impact: 4, name: 'Teledysk / visualizer / nagranie live',
    how: 'Nawet prosty visualizer zwiększa szanse na YouTube i w mediach. DJ: showreel z gigów (60–90 s).' },
  { id: 'shorts-bank', for: ALL, offsetDays: -65, impact: 5, name: 'Bank 10–15 krótkich form (15–30 s)',
    how: 'Hook, kulisy, reakcje, cytaty, „dla fanów X”. To paliwo na TikTok/Reels/Shorts przez 6 tygodni.' },
  { id: 'bio', for: ALL, offsetDays: -65, impact: 4, name: 'Bio krótkie, średnie i długie (PL + EN)',
    how: '50 / 150 / 400 słów. Wersja EN otwiera zagranicę. Uzupełnij w profilu Promo Hub.' },
  { id: 'epk', for: ALL, offsetDays: -62, impact: 4, name: 'Press kit (EPK) w Promo Hub',
    how: 'Zdjęcia, bio, osiągnięcia, linki – kuratorzy widzą go przy każdym zgłoszeniu.' },
  { id: 'dj-rider', for: ['dj'], offsetDays: -62, impact: 3, name: 'Rider techniczny, logo i stawki',
    how: 'Promotorzy oczekują riderów (sprzęt, czas setu), logo w wektorze i jasnych warunków.' },

  // ---------- C. Prawa i metadane ----------
  { id: 'splits', for: ['music', 'dj'], offsetDays: -60, impact: 4, name: 'Spisz podział praw (split sheet)',
    how: 'Kto jest autorem muzyki, tekstu, kto producentem i w jakich proporcjach – zanim pojawią się pieniądze.' },
  { id: 'samples', for: ['music', 'dj'], offsetDays: -58, impact: 4, name: 'Wyczyść sample i interpolacje',
    how: 'Niewyczyszczony sample to zdjęcie utworu z platform i blokada sync.' },
  { id: 'cmo-authors', for: ['music', 'dj'], offsetDays: -55, impact: 4, name: 'Rejestracja utworu w organizacji autorskiej',
    how: 'W Polsce m.in. ZAiKS (autorzy muzyki i tekstu); za granicą odpowiednik w Twoim kraju. Bez rejestracji tracisz tantiemy z radia i koncertów.' },
  { id: 'cmo-performers', for: ['music', 'dj'], offsetDays: -55, impact: 3, name: 'Prawa wykonawców i producentów',
    how: 'W Polsce m.in. STOART / SAWP (wykonawcy) i ZPAV (producenci, krajowa agencja ISRC). Słuchacze w USA: rozważ SoundExchange.' },
  { id: 'isrc', for: ['music', 'dj'], offsetDays: -50, impact: 4, name: 'Kody ISRC i metadane',
    how: 'ISRC nadaje dystrybutor lub krajowa agencja. Sprawdź pisownię nazw, featuringi, autorów, gatunek i język.' },
  { id: 'isbn-meta', for: ['writer'], offsetDays: -60, impact: 4, name: 'ISBN, kategorie Thema/BISAC i słowa kluczowe',
    how: 'Osobny ISBN dla każdego formatu. Kategorie i słowa kluczowe decydują o widoczności w sklepach.' },
  { id: 'writer-cmo', for: ['writer'], offsetDays: -50, impact: 3, name: 'Tantiemy autorskie – organizacje zbiorowego zarządzania',
    how: 'Sprawdź organizacje (np. ZAiKS, Copyright Polska) – tantiemy m.in. z użyczeń bibliotecznych i reprografii.' },
  { id: 'legal-deposit', for: ['writer'], offsetDays: -46, impact: 2, name: 'Egzemplarz obowiązkowy',
    how: 'Wydawca (także self-publisher) przekazuje egzemplarze obowiązkowe do wskazanych bibliotek – sprawdź aktualne przepisy.' },

  // ---------- D. Dystrybucja ----------
  { id: 'distributor', for: ['music', 'dj'], offsetDays: -42, impact: 5, name: 'Upload do dystrybutora (min. 4–6 tygodni przed premierą)',
    how: 'Zaznacz datę premiery w przyszłości – tylko wtedy zrobisz pitch redakcyjny, pre-save i Content ID.' },
  { id: 'content-id', for: ['music', 'dj'], offsetDays: -40, impact: 3, name: 'Content ID i monetyzacja wideo',
    how: 'Przez dystrybutora: przychody z każdego filmu z Twoim utworem na YouTube (i z biblioteki dźwięków TikTok/Meta).' },
  { id: 'preorder', for: ['writer'], offsetDays: -40, impact: 4, name: 'Przedsprzedaż w sklepach',
    how: 'Zamówienia przedpremierowe kumulują się w dniu premiery – lepsze pozycje w rankingach sklepów.' },
  { id: 'arc-copies', for: ['writer'], offsetDays: -42, impact: 5, name: 'Egzemplarze recenzenckie (papier + e-book)',
    how: 'Przygotuj pulę egzemplarzy dla recenzentów, BookTok i Bookstagram – Promo Hub roześle je falami.' },

  // ---------- E. Pre-premiera ----------
  { id: 'presave', for: ['music', 'dj'], offsetDays: -21, impact: 4, name: 'Pre-save / smart link',
    how: 'Jeden link do wszystkich platform w bio i opisach; zapisane pre-save’y zasilają algorytmy w dniu premiery.' },
  { id: 'teasers', for: ALL, offsetDays: -14, impact: 5, name: 'Teasery 3–4× w tygodniu',
    how: 'Publikuj z banku krótkich form; testuj, który fragment niesie – ten promuj w dniu premiery.' },
  { id: 'mailing', for: ALL, offsetDays: -10, impact: 4, name: 'Zapowiedź do listy mailingowej i fanów',
    how: 'Lista mailingowa to kanał, który należy tylko do Ciebie. Poproś o zapis/pre-order/pre-save.' },
  { id: 'local-media', for: ALL, offsetDays: -10, impact: 3, name: 'Media lokalne (miasto, region, uczelnia)',
    how: 'Lokalne portale, gazety i rozgłośnie chętnie piszą o „swoich” – to najłatwiejsza pierwsza recenzja.' },
  { id: 'author-events', for: ['writer'], offsetDays: -20, impact: 3, name: 'Zaplanuj spotkania autorskie (biblioteki, księgarnie, domy kultury)',
    how: 'Biblioteki publiczne chętnie goszczą autorów – to też zakupy egzemplarzy do sieci bibliotek.' },
  { id: 'dj-promo', for: ['dj'], offsetDays: -14, impact: 4, name: 'Promo do zaprzyjaźnionych DJ-ów i zbieranie supportów',
    how: 'Lista supportów („grane przez…”) to dowód społeczny do pitchu dla wytwórni i promotorów.' },

  // ---------- F. Premiera ----------
  { id: 'launch-post', for: ALL, offsetDays: 0, impact: 5, name: 'Premiera wszędzie naraz',
    how: 'Post, rolka, stories, newsletter, przypięte posty, zmiana zdjęć profilowych/banerów, link w bio.' },
  { id: 'launch-live', for: ALL, offsetDays: 0, impact: 3, name: 'Live / premiera na żywo',
    how: 'Transmisja z odsłuchem/czytaniem i rozmową z fanami – algorytmy promują aktywność w dniu premiery.' },
  { id: 'thank-curators', for: ALL, offsetDays: 0, impact: 3, name: 'Podziękuj kuratorom i udostępnij ich publikacje',
    how: 'Oznaczaj, udostępniaj – kuratorzy wracają do twórców, którzy promują ich kanały.' },

  // ---------- G. Po premierze ----------
  { id: 'ugc', for: ALL, offsetDays: 3, impact: 4, name: 'Zachęcaj do treści od fanów',
    how: 'Wyzwanie, duet, cytat do udostępnienia. Udostępniaj każdą reakcję.' },
  { id: 'ads-test', for: ALL, offsetDays: 5, impact: 3, name: 'Mały test reklam (opcjonalnie)',
    how: 'Najlepszy teaser jako reklama z niskim budżetem dziennym przez 5–7 dni; zatrzymaj, jeśli koszt obserwującego rośnie.' },
  { id: 'review-7', for: ALL, offsetDays: 7, impact: 4, name: 'Analiza po 7 dniach',
    how: 'Które miejsca, kraje i formy zadziałały? Zaktualizuj słuchaczy/czytelników w profilu – to podnosi Twój poziom.' },
  { id: 'reader-reviews', for: ['writer'], offsetDays: 7, impact: 4, name: 'Oceny czytelników w pierwszych 2 tygodniach',
    how: 'Poproś pierwszych czytelników o ocenę na lubimyczytać.pl / Goodreads / w sklepach.' },

  // ---------- H. Długi ogon ----------
  { id: 'versions', for: ['music', 'dj'], offsetDays: 21, impact: 4, name: 'Nowe wersje: akustyczna, remix, sped up / slowed',
    how: 'Kolejne wydania tego samego utworu to nowe szanse na playlisty i trendy.' },
  { id: 'live-session', for: ['music', 'dj'], offsetDays: 28, impact: 3, name: 'Sesja live / nagranie z gigu',
    how: 'Materiał dla kanałów YouTube z sesjami i dla promotorów.' },
  { id: 'audio-ebook', for: ['writer'], offsetDays: 30, impact: 3, name: 'Kolejny format: audiobook / e-book / tłumaczenie fragmentu',
    how: 'Nowy format = nowi odbiorcy i nowa fala recenzji.' },
  { id: 'review-30', for: ALL, offsetDays: 30, impact: 4, name: 'Analiza po 30 dniach i rozliczenie prowizji',
    how: 'Zgłoś przychód w Pulę Efektu, sprawdź poziom na Ścieżce artysty, zapisz wnioski do następnej kampanii.' },
  { id: 'new-markets', for: ALL, offsetDays: 45, impact: 3, name: 'Nowy rynek: kraj, w którym rośnie publiczność',
    how: 'Zgłoś dzieło do miejsc z tego kraju (katalog → filtr kraju), użyj bio EN.' },

  // ---------- I. Skalowanie ----------
  { id: 'next-release', for: ALL, offsetDays: 60, impact: 5, name: 'Zaplanuj następną premierę w Dyrygencie',
    how: 'Ciągłość to największy mnożnik – każda kampania startuje z wyższego poziomu i z lepszymi danymi.' },
  { id: 'booking', for: ['music', 'dj'], offsetDays: 75, impact: 4, name: 'Koncerty / booking z danymi kampanii',
    how: 'Z liczbą słuchaczy w miastach idź do klubów i promotorów; dodaj daty do Bandsintown / RA.' },
  { id: 'rights-deals', for: ['writer'], offsetDays: 90, impact: 4, name: 'Prawa zależne: tłumaczenia, audiobook, ekranizacja',
    how: 'Z wynikami i recenzjami zgłoś się do agentów i wydawców zagranicznych (katalog: Wydawnictwo / agent).' },
  { id: 'review-90', for: ALL, offsetDays: 90, impact: 3, name: 'Podsumowanie po 90 dniach',
    how: 'Co dało największy efekt za najmniejszy koszt? Ta wiedza to Twoja przewaga w kolejnych kampaniach.' },
];

module.exports = { PHASES, PLAYBOOK, phaseFor };
