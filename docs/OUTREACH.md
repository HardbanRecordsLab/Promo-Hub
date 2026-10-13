# Outreach do partnerów – kampania #1 (październik 2026)

Pierwsza fala zapytań o współpracę do podmiotów ze Światowej Bazy (`lib/entities-seed.js`). Nadawca: Gmail HardbanRecords Lab, podpis „Promo Hub · HardbanRecords Lab”.

## Stan

| | Liczba |
|---|---|
| Podmioty w bazie | 548 |
| Objęte kampanią (radio, media, festiwale, wydawcy, wytwórnie, playlisty, sync, DJ) | 401 |
| Znaleziony oficjalny adres → **szkic w Gmailu** | **280** (58 PL, 222 EN, 40 krajów) |
| Tylko formularz kontaktowy → **gotowy tekst do wklejenia** ([OUTREACH-FORMS.md](OUTREACH-FORMS.md)) | 22 |
| Adres wątpliwy (RODO, sklep, bilety, darowizny, tylko biuro prasowe) – bez szkicu | 20 |
| Tylko adresy imienne – pominięte | 6 |
| Wydarzenie zakończone | 2 |
| Brak adresu (ukryty na stronie, domena niedostępna dla wyszukiwarki) | 71 |

Pełna lista ze źródłami: [`database/outreach-contacts.csv`](../database/outreach-contacts.csv) (kolumny `email`, `status`, `source` – strona, na której adres jest opublikowany, `note`). Kolumna `confidence`: `high` (248) albo `check` (32) – adres ze starszej strony, skrzynka ogólna/support/reklama albo adres imienny opublikowany wprost do spraw partnerskich (Earmilk) lub adres Gmail podany jako oficjalny kontakt biznesowy (The Needle Drop); warto rzucić okiem przed wysyłką.

Pominięte w tej fali (147): platformy dystrybucyjne, organizacje zbiorowego zarządzania, granty/biura eksportowe, platformy e-book/audio – potrzebują innej oferty (integracja/partnerstwo technologiczne), nie zapytania kuratorskiego.

## Zasady

1. **Tylko adresy z oficjalnej domeny podmiotu** (lub domeny organizatora/wydawcy, oznaczone w notatce), widoczne publicznie na jego stronie. Żadnych adresów zgadywanych.
2. **Tylko adresy funkcyjne** (redakcja@, music@, partnerships@, info@). Adresy imienne pominięte (RODO) – jedyny wyjątek to adres, który organizacja spoza UE sama podaje wprost do spraw partnerskich (Earmilk, oznaczony `check`).
3. **Polska – najpierw zapytanie o zgodę.** Pierwszy e-mail nie zawiera oferty handlowej, tylko pytanie, czy możemy przesłać informację (art. 10 ustawy o świadczeniu usług drogą elektroniczną, przepisy o marketingu bezpośrednim). Szczegóły wysyłamy dopiero po odpowiedzi „tak”.
4. **Zagranica – krótki pitch** z jasną propozycją wartości i bez płatnych miejsc.
5. **Rezygnacja w każdej wiadomości.** Odpowiedź „nie” / „no” = wpis na listę wykluczeń i brak dalszego kontaktu.
6. **Wysyłka partiami ~50 dziennie** z jednego konta Gmail, żeby nie trafić do filtrów spamu i nie przekroczyć limitów.
7. **Uczciwość:** platforma dopiero startuje i szuka pierwszych partnerów – tak to komunikujemy, bez przesadzonych liczb.

## Szablony

Personalizacja: nazwa podmiotu (temat i powitanie EN), typ podmiotu (radio, media, festiwal, wydawca, wytwórnia, playlista, sync, DJ/record pool, YouTube), typ twórców (muzycy / DJ-e i producenci / autorzy i poeci) oraz to, co partner zyskuje.

**EN (przykład dla radia):**

```
Subject: Partnership inquiry: Promo Hub × {name}

Hello {name} team,

I'm writing from HardbanRecords Lab. We are launching Promo Hub, a platform that connects independent artists, DJs and producers with radio stations and shows around the world, on collaboration terms only: free submissions, a commission on results or a revenue share, and transparent review fees where they make sense. No paid placements, ever.

We are onboarding our first partners now and would like {name} to be one of them. What you would get:
- new music pre-matched to your format and shows, with broadcast-ready files and complete metadata;
- your own terms, genres and monthly volume;
- a share of the results you help create (streams, sales, bookings), reported transparently.

Would you be open to a short call, or should I send the details by e-mail? If someone else handles this, a pointer would be much appreciated.

If you would rather not hear from us, just reply "no" and we will not contact you again.

Best regards,
Promo Hub · HardbanRecords Lab
```

**PL (zapytanie o zgodę):**

```
Temat: Pytanie o współpracę: Promo Hub × {nazwa}

Dzień dobry,

piszę w imieniu HardbanRecords Lab. Uruchamiamy Promo Hub – platformę, która łączy niezależnych muzyków, DJ-ów i producentów ze stacjami radiowymi i audycjami wyłącznie na zasadach współpracy (bez płatnych miejsc w audycjach, playlistach czy publikacjach).

Czy mogę przesłać krótką informację o tym, jak mogłaby wyglądać nasza współpraca? Wystarczy odpowiedź „tak” albo wskazanie osoby lub adresu, który zajmuje się takimi sprawami.

Jeśli temat Państwa nie interesuje, proszę odpisać „nie” – nie będziemy się więcej kontaktować.

Pozdrawiam serdecznie
Promo Hub · HardbanRecords Lab
```

Dla mediów książkowych, festiwali literackich i wydawców tekst mówi o autorach i poetach, książkach, spotkaniach autorskich i prawach – nie o muzyce.

## Po wysyłce

- Odpowiedzi „tak” → w panelu admina (`#/admin/database`) etap **negotiation**, wysyłka szczegółów (model: free / prowizja / revshare / opłata za recenzję; prowizja platformy 20%).
- Zgoda na warunki → **Convert to partner** (podmiot trafia do katalogu jako zweryfikowany partner).
- „Nie” → etap **declined**, brak dalszego kontaktu.
- Brak odpowiedzi po 10 dniach → jedno krótkie przypomnienie (tylko zagranica; w PL bez zgody nie ponawiamy).
- Podmioty ze statusem `form` → tekst z [OUTREACH-FORMS.md](OUTREACH-FORMS.md) wklejony ręcznie w ich formularz kontaktowy; `not_found` → ręczne sprawdzenie strony kontaktowej (adresy często ukryte przed robotami).
