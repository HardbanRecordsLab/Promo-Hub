# Promo Hub – strategia: od anonimowego debiutanta do artysty, którego słucha świat

> Dokument roboczy (październik 2026). Ceny i zasady platform zewnętrznych zmieniają się – przed decyzjami biznesowymi zweryfikuj je u źródła (lista źródeł na końcu).

## 1. Wizja

Promo Hub ma być **jednym miejscem**, w którym nikomu nieznany artysta przechodzi drogę od pierwszego utworu do rozpoznawalności na świecie – przy **minimalnym koszcie z góry** i przy tym, że **wszyscy uczestnicy zarabiają na efekcie**:

- **artysta** płaci głównie wtedy, gdy utwór zaczyna zarabiać (prowizja od efektu),
- **kurator / stacja / twórca** zarabia tym więcej, im lepiej wybiera i promuje muzykę,
- **platforma** pobiera udział od każdej prowizji i opłaty (`PLATFORM_FEE_PERCENT`, domyślnie 20%).

Uczciwie: żadna platforma nie może zagwarantować sławy. Promo Hub maksymalizuje szanse – synchronizuje wszystkie kanały, mierzy postęp i kieruje artystę krok po kroku.

## 2. Mapa rynku – z kim konkurujemy (szerzej niż 2 serwisy)

| Kategoria | Przykładowi gracze | Model | Luka, którą wypełniamy |
|---|---|---|---|
| Płatne zgłoszenia do kuratorów | SubmitHub, Groover, Musosoup, SubmitLink | kredyty / opłata za zgłoszenie (rzędu 1–5 € / $ za kuratora), gwarancja odsłuchu, brak gwarancji umieszczenia | płacisz za odsłuch, nie za efekt; tylko playlisty i blogi |
| Kampanie wielokanałowe | One Submit, SoundCampaign, Playlist Push | pakiety kampanii (playlisty + TikTok), od kilkuset $ | wysoki próg wejścia, brak harmonogramu premiery, brak radia i sync |
| Kampanie z twórcami TikTok/IG | Genni (dawniej Songfluencer), Sound.me, Breakr, TikTok One | abonament lub opłata za film; Breakr – wypłata dla twórcy po potwierdzeniu efektu + prowizja platformy | drogie dla debiutanta; rozłączne z resztą promocji |
| Promocja radiowa | Play MPE (+ monitoring MTR), pluggerzy radiowi | pakiety per rynek/format | osobny świat, brak połączenia z playlistami i social |
| Narzędzia platform streamingowych | Spotify Discovery Mode (prowizja od tantiem ze streamów z rekomendacji), Marquee / Showcase (płatne reklamy), pitch redakcyjny w Spotify for Artists | prowizja lub reklama, tylko wewnątrz jednej platformy | działa w jednym serwisie; pitch redakcyjny jest darmowy, ale wymaga planu i terminów |
| Analityka | Chartmetric, Soundcharts, panele „for Artists” | abonament / darmowe | mierzą, ale nie działają za artystę |
| Strategia / AI | un:hurd i podobne | doradztwo, targetowanie | rada zamiast wykonania |

**Wniosek:** rynek jest **pocięty na silosy** (playlisty osobno, TikTok osobno, radio osobno, sync osobno) i w większości **płaci się za próbę, nie za efekt**. Pojedyncze elementy modelu „za efekt” już istnieją (Spotify Discovery Mode, wypłata po potwierdzeniu w Breakr), ale nikt nie łączy ich w jedną kampanię prowadzącą artystę przez wszystkie media.

## 3. Mechanizmy Promo Hub – co jest nowe

| Mechanizm | Co robi | Status |
|---|---|---|
| **Dyrygent kampanii** | Jeden formularz → dobór najlepszych miejsc z *każdej* sekcji w ramach budżetu (także 0 zł) → harmonogram z oficjalnymi kanałami → **automatyczna wysyłka falami** (radio T-42, dystrybucja T-35, media T-21, twórcy T-14, playlisty T+1, sync T+45) + eksport do kalendarza | ✅ zaimplementowane |
| **Efekt domina** | Akceptacja w kampanii automatycznie wysyła utwór do większych miejsc, które artysta odblokował – z dowodem społecznym w pitchu („właśnie trafiłem do X”) | ✅ |
| **Pula Efektu** | Artysta raportuje przychód utworu **raz**; system dzieli prowizję między wszystkich kuratorów, którzy go umieścili. Łączna prowizja ma limit (`TRACK_COMMISSION_CAP_PERCENT`, domyślnie 30%) – prowizje się nie piętrzą (bez tego 10 kuratorów × 15% = 150%) | ✅ |
| **Ścieżka artysty (5 poziomów)** | Debiutant → Lokalny → Krajowy → Międzynarodowy → Globalny; progi z twardych danych (umieszczenia, zasięg, kraje, typy mediów, słuchacze) + plan kolejnych kroków | ✅ |
| **Drabina dostępu** | Duże miejsca mogą wymagać min. poziomu artysty → mniej spamu dla kuratorów, jasny cel dla artystów | ✅ |
| **Gwarancja odpowiedzi** | Brak decyzji w terminie → zgłoszenie wygasa, kurator spada w rankingu | ✅ |
| **Ranking dopasowania 0–100** | gatunek, % akceptacji, % odpowiedzi, weryfikacja, zasięg, koszt z góry | ✅ |
| **Zamrożone warunki** | Zmiana cennika kuratora nie działa wstecz | ✅ |
| **Press kit (EPK)** | Publiczna karta artysty z poziomem i historią umieszczeń, dołączana do zgłoszeń | ✅ |
| **Siła orkiestry** | Wskaźnik 0–100: ile sekcji gra, ile fal wyszło, ile zadań w kanałach oficjalnych wykonano | ✅ |

## 4. Mapa partnerów do włączenia (świat), od najtańszych dla artysty

Priorytet = (efekt dla artysty × przychód platformy) / koszt dla artysty.

| # | Kategoria partnera | Jak włączyć do huba | Koszt dla artysty | Przychód platformy | Priorytet |
|---|---|---|---|---|---|
| 1 | Niezależni kuratorzy playlist (Spotify, Apple, Deezer, YouTube Music, Tidal) | katalog + model prowizyjny | 0 zł z góry | 20% prowizji | ★★★★★ |
| 2 | Twórcy TikTok / Reels / Shorts (mikro 10–100 tys.) | prowizja od przychodu utworu lub barter | 0 zł z góry | 20% prowizji | ★★★★★ |
| 3 | Radia internetowe i akademickie | bezpłatnie / barter, Pula Efektu przy kompilacjach | 0 zł | z kompilacji / revshare | ★★★★ |
| 4 | Podcasty, newslettery, blogi | bezpłatnie, barter lub niska opłata za odsłuch | 0–20 zł | 20% opłaty | ★★★★ |
| 5 | DJ-e i pule DJ-skie (kluby, wesela, eventy) | prowizja | 0 zł | 20% prowizji | ★★★★ |
| 6 | Radia FM/DAB regionalne (PL: rozgłośnie Polskiego Radia, lokalne) | lista redaktorów audycji z debiutami, zgłoszenia przez hub | 0 zł | członkostwo premium (pkt 7 rozdz. 5) | ★★★ |
| 7 | Festiwale, kluby, sceny debiutów | barter (występ za promocję) | 0 zł | prowizja od biletów przy przyszłych umowach | ★★★ |
| 8 | Sync: biblioteki muzyki, agencje reklamowe, studia gier i filmu | podział przychodów z licencji | 0 zł | 20% udziału | ★★★★ (wysokie kwoty) |
| 9 | Wytwórnie i A&R | Drabina dostępu (od poziomu 3–4) jako filtr jakości | 0 zł | success fee przy podpisaniu umowy | ★★★ |
| 10 | Streamerzy Twitch / YouTube Live | prowizja | 0 zł | 20% | ★★★ |
| 11 | Społeczności (Discord, Reddit, fankluby) | ambasadorzy, barter | 0 zł | — (zasięg i dane) | ★★ |
| 12 | Marki (influencer marketing, kampanie z muzyką) | sync/revshare | 0 zł | 20% | ★★★ |
| 13 | Zagraniczni kuratorzy i radia (poziom 4+) | katalog z filtrem kraju, bio EN | 0 zł z góry | 20% | ★★★★ |

Oficjalne darmowe kanały (Spotify for Artists, Apple Music for Artists, YouTube OAC, TikTok for Artists, Deezer for Creators, Amazon Music for Artists, Musixmatch, Bandsintown, BBC Introducing) są w hubie jako **zadania w harmonogramie**, nie partnerzy – artysta musi z nich korzystać, a Dyrygent pilnuje terminów (np. pitch w Spotify min. 7 dni przed premierą).

## 5. Model przychodów platformy

1. **Udział od prowizji kuratorów** (20%) – główne źródło, rośnie razem z sukcesem artystów.
2. **Udział od opłat za odsłuch** (20%) – dla kuratorów, którzy wolą stałą opłatę.
3. **Success fee od sync i kontraktów** – największe pojedyncze kwoty.
4. *(do wdrożenia)* **Pro dla artystów** – np. więcej kampanii równolegle, analityka porównawcza, priorytet w kolejce u kuratorów prowizyjnych.
5. *(do wdrożenia)* **Pro dla kuratorów** – wyróżnienie w katalogu, statystyki zarobków, narzędzia do zarządzania wieloma playlistami.
6. *(do wdrożenia)* **Dane rynkowe** – zagregowane, anonimowe trendy (co działa w jakim gatunku i kraju) dla wytwórni i marek.

Przykład: 1 000 aktywnych utworów × średnio 300 zł przychodu miesięcznie × 20% prowizji kuratorów × 20% udziału platformy = **12 000 zł miesięcznie**, bez opłat z góry dla artystów. Skaluje się liniowo z liczbą utworów i nieliniowo z sukcesem (utwory z poziomów 3–5 zarabiają wielokrotnie więcej).

## 6. Start rynku (problem „kury i jajka”)

- **Kuratorzy najpierw:** zaproś 100–200 kuratorów z Polski (playlisty 1–50 tys. obserwujących, radia akademickie, podcasty muzyczne). Argument: zarabiają na muzyce, którą i tak promują; zero ryzyka; zamrożone warunki; panel rozliczeń.
- **Artyści:** darmowe narzędzia jako magnes – Dyrygent z budżetem 0 zł, oficjalne kanały, Ścieżka artysty i press kit.
- **Efekt sieci:** artyści z poziomów 4–5 zostają kuratorami (playlisty, audycje) → więcej miejsc → więcej sukcesów.

## 7. Roadmapa techniczna (kolejność)

1. **Płatności i escrow** (Stripe Connect / Przelewy24): automatyczne pobieranie prowizji i opłat, wypłaty dla kuratorów, udział platformy potrącany automatycznie.
2. **Weryfikacja przez API**: zasięg playlist (Spotify Web API), kanałów (YouTube Data API); potwierdzanie umieszczeń automatycznie zamiast ręcznie.
3. **Przychody z dystrybutora** (import raportów CSV/API) zamiast samodzielnego raportowania – wiarygodność Puli Efektu.
4. **Ochrona przed sztucznymi streamami**: wykrywanie playlist z botami (nagłe skoki obserwujących, nienaturalny stosunek obserwujących do streamów) – kuratorzy z botami szkodzą artystom i są usuwani.
5. **Powiadomienia e-mail/push** (nowe zgłoszenie, decyzja, fala wysłana, domino).
6. **Wersja angielska** i katalog międzynarodowy (poziom 4+).
7. **Baza PostgreSQL**, konta z logowaniem (obok kluczy), limitowanie żądań.

## 8. Ryzyka i zasady

- **Regulaminy platform:** płatne gwarantowane miejsca na playlistach są zakazane – w Promo Hub opłata dotyczy wyłącznie odsłuchu, a prowizja liczona jest od przychodu, nie od umieszczenia.
- **Rzetelność raportów przychodów:** do czasu integracji z dystrybutorami opiera się na deklaracjach artysty – roadmapa pkt 3.
- **Jakość kuratorów:** weryfikacja przez admina, publiczne wskaźniki skuteczności, gwarancja odpowiedzi.
- **Dane osobowe (RODO):** e-mail artysty widoczny tylko dla kuratora, któremu wysłano utwór; e-mail w press kicie niepubliczny.

## Źródła

- [Spotify – Pitching music to playlist editors](https://support.spotify.com/artists/article/pitching-music-to-playlist-editors/)
- [Spotify Discovery Mode – omówienie (2026)](https://playlistsupply.com/blog/spotify-discovery-mode-explained/)
- [Spotify Marquee i Showcase – omówienie](https://playlistsupply.com/blog/spotify-marquee-and-showcase-explained/)
- [Musosoup – Groover vs SubmitHub](https://musosoup.com/blog/groover-vs-submithub)
- [Orphiq – Playlist pitching services compared](https://orphiq.com/resources/playlist-pitching-services-compared)
- [RoEx – Best music promotion services 2026](https://www.roexaudio.com/blog/the-best-music-promotion-services-for-independent-artists-(a-guide-for-2026))
- [SubmitLink – 12 best sites to promote music 2026](https://www.submitlink.io/post/the-12-best-sites-to-promote-music-for-independent-artists-in-2026)
- [Dynamoi – Top influencer marketing platforms for musicians](https://dynamoi.com/learn/music-marketing/top-10-influencer-marketing-platforms-for-musicians)
- [Passive Promotion – What artists should know about Breakr](https://passivepromotion.com/?p=6655)
- [Play MPE – promocja radiowa](https://www.plaympe.com/au/promote)
- [PRS for Music – How to get played on the radio in 2025](https://prsformusic.com/m-magazine/how-to/how-to-get-played-on-the-radio-in-2025)
