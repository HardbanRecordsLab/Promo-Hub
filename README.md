# Promo Hub

Platforma łącząca artystów z miejscami promocji muzyki – playlistami, radiami FM i internetowymi, kanałami YouTube, twórcami TikTok/Instagram, blogami, podcastami, newsletterami, DJ-ami, klubami i festiwalami, TV, sync i wytwórniami – na zasadach **współpracy**: prowizja od efektu, podział przychodów, opłata za odsłuch lub barter.

## Uruchomienie

```bash
ADMIN_TOKEN=twoj-sekret PLATFORM_FEE_PERCENT=20 npm start   # http://localhost:3000
npm test
```

Bez zależności zewnętrznych (Node ≥ 18). Dane trzymane są w `data/db.json` (zmienna `DB_FILE`). Przy pustej bazie ładowane są **przykładowe, fikcyjne** miejsca (`SEED=0` wyłącza).

| Zmienna | Opis |
|---|---|
| `PORT` | port HTTP (domyślnie 3000) |
| `ADMIN_TOKEN` | token panelu administratora (`#/admin`); bez niego panel jest wyłączony |
| `PLATFORM_FEE_PERCENT` | prowizja platformy od każdej prowizji kuratora i opłaty za odsłuch (domyślnie 20) |
| `DB_FILE` | ścieżka pliku bazy |

## Jak zarabia platforma

Platforma pobiera `PLATFORM_FEE_PERCENT` % z każdej prowizji kuratora (model prowizyjny i podział przychodów) oraz z każdej opłaty za odsłuch. Warunki – w tym stawka platformy – są zamrażane w chwili zgłoszenia. Zarobki widać w panelu admina.

## Role i dostęp

- **Artysta** – po pierwszym zgłoszeniu dostaje *klucz artysty* (panel: status zgłoszeń, feedback, raportowanie przychodów, wyliczanie prowizji).
- **Kurator** – po dodaniu miejsca dostaje *ID + klucz kuratora* (skrzynka zgłoszeń, decyzje, potwierdzanie wpłat, edycja warunków).
- **Admin** – `ADMIN_TOKEN` (weryfikacja miejsc, zarobki platformy, ranking skuteczności).

Klucze są przechowywane wyłącznie jako skróty SHA-256.

## Zasady

- Gwarancja odpowiedzi: zgłoszenie bez decyzji po `responseDays` wygasa i obniża ranking kuratora.
- Ranking dopasowania (0–100): gatunek, % akceptacji, % odpowiedzi w terminie, weryfikacja, zasięg, brak kosztów z góry.
- Model „opłata za odsłuch” nie gwarantuje umieszczenia – płatne gwarantowane miejsca na playlistach łamią regulaminy platform streamingowych.

## Do zrobienia przed produkcją

- Integracja płatności (np. Stripe / Przelewy24) dla opłat i prowizji – obecnie kwoty są naliczane i potwierdzane ręcznie.
- Powiadomienia e-mail, limitowanie żądań, kopie zapasowe bazy (lub migracja na PostgreSQL).
