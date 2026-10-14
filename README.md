# Promo Hub

A platform that takes independent **musicians, DJs/producers and writers/authors/poets** from their first release to international recognition. It connects creators with playlists, FM and online radio, YouTube channels, TikTok/Instagram/BookTok creators, blogs, magazines, podcasts, newsletters, DJs and record pools, clubs and festivals, TV, sync libraries, labels and publishers – on **collaboration terms**: commission on results, revenue share, a review fee or barter.

The UI is **English by default with a PL switcher** (EN | PL in the header). The API returns content in the language sent in the `x-lang` header (`en` / `pl`) or `?lang=`.

Strategy, market map and partner plan (PL): [docs/STRATEGIA.md](docs/STRATEGIA.md).

## Key features

- **Master Conductor A–Z** (`#/campaign`) – work + release date + budget (even 0) → outlets from every section, an **A–Z plan of 45–60 tasks in 9 phases** (Foundation → Assets → Rights & metadata → Distribution → Pre-release → Release → Post-release → Long tail → Scaling), official channels, the Global Database and **automatic submission waves**; `.ics` export; pitch generator with `{name}` / `{genres}`.
- **Campaign Simulator (Monte Carlo)** – before launch: cautious/likely/optimistic outcomes (p10/p50/p90) and the chance to reach the next level, from real curator metrics.
- **Career Autopilot** – a ranked list of “next best moves”: overdue tasks, revenue reports, profile gaps, level goals with outlet suggestions, entities from the Global Database.
- **Domino effect** – an acceptance in a campaign automatically sends the work to bigger outlets the creator has unlocked, with social proof in the pitch.
- **Effect Pool** – revenue of a work is reported once and split between curators; total commission is capped at `TRACK_COMMISSION_CAP_PERCENT` %.
- **Creator Path** (`#/creator`) – 5 levels with measurable thresholds, next steps and a public press kit (`#/creator/<slug>`).
- **Access Ladder** – outlets can require a minimum creator level.
- **Guaranteed response** – submissions without a decision expire and lower the curator’s ranking.
- **Acceptance odds before sending** (`#/match`) – a % chance per outlet from its real decisions (Beta-binomial on the outlet's history, genre and creator level) plus its most common decline reason.
- **“What to fix” report** (creator panel) – curators tick feedback tags; every curator's feedback becomes one report per work with consensus priorities and concrete advice.
- **Verified creator passport** (press kit) – Momentum score 0–1000 and a public code for every placement, checkable by labels and bookers at `#/verify/<code>`.
- **Discovery share** – the first outlet to accept a creator earns `DISCOVERY_SHARE_PERCENT` % (default 2) of the creator's reported revenue for `DISCOVERY_MONTHS` months (default 24), inside the Effect Pool cap; terms are frozen at submission.
- **Quick review for curators** (`#/curators/quick`) – queue sorted by fit, embedded player starting at 0:30, keyboard decisions (A/L/R/S) and tags (1–9).

## Global Entity Database – where to find it

**548 real organizations from 46 countries** (radio, media, live sessions, showcase festivals, labels, record pools, distributors, collecting societies, grants/export offices, publishers, literary magazines, book fairs, e-book/audio platforms). They are **prospects to approach, not partners** – submission terms are based on public information and must be verified before an entity is made public.

- **Excel:** [`database/global-database.xlsx`](database/global-database.xlsx) – “Summary” sheet (live counts) + “Database” sheet (every entity, filters, clickable links, notes EN/PL).
- **CSV:** [`database/global-database.csv`](database/global-database.csv) – same columns as the admin import; edit in a spreadsheet and import back.
- **In the app:** admin panel → Global Database (`#/admin/database`) – CRM stages, filters, outreach e-mails (EN/PL), CSV import/export, conversion into catalog partners.
- **Regenerate the files:** `npm run export:db && python3 scripts/export-database-xlsx.py`
- **Outreach contacts:** [`database/outreach-contacts.csv`](database/outreach-contacts.csv) – official role addresses found for 276 of 401 outreach targets, each with the page it was published on; process and e-mail templates in [`docs/OUTREACH.md`](docs/OUTREACH.md) (PL).
- **Grow it:** [`docs/AGENT_PROMPT_DATABASE_RESEARCH.md`](docs/AGENT_PROMPT_DATABASE_RESEARCH.md) – a step-by-step prompt for an AI research agent; its CSV output imports directly.

## Running

```bash
ADMIN_TOKEN=your-secret PLATFORM_FEE_PERCENT=20 npm start   # http://localhost:3000
npm test
```

No external dependencies (Node ≥ 18). Data is stored in `data/db.json` (`DB_FILE`). On an empty database the server loads **fictional sample outlets** and the Global Database prospects (`SEED=0` disables both).

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `ADMIN_TOKEN` | admin panel token (`#/admin`); without it the panel is disabled |
| `PLATFORM_FEE_PERCENT` | platform share of every curator commission and review fee (default 20) |
| `TRACK_COMMISSION_CAP_PERCENT` | cap on the total commission of all curators of one work (default 30) |
| `DISCOVERY_SHARE_PERCENT` | discovery share of the first outlet that accepted a creator (default 2) |
| `DISCOVERY_MONTHS` | how long the discovery share lasts (default 24) |
| `DB_FILE` | database file path |

## How the platform earns

The platform keeps `PLATFORM_FEE_PERCENT` % of every curator commission (commission and revenue-share models) and of every review fee. Terms – including the platform fee – are frozen at submission time. Earnings are shown in the admin panel.

## Roles and access

- **Creator** – gets a *creator key* after registering or the first submission (panel: Autopilot, Creator Path, campaigns, submissions, revenue reports).
- **Curator** – gets an *outlet ID + curator key* after listing an outlet (inbox, decisions, payment confirmations, terms).
- **Admin** – `ADMIN_TOKEN` (outlet verification, platform earnings, Global Database CRM).

Keys are stored only as SHA-256 hashes.

## Translations

- UI: English strings in `public/app.js` go through `t()`; Polish translations live in `public/i18n-pl.js`. `test/i18n.test.js` fails if a string has no translation or the `{placeholders}` differ.
- Server content (outlet types, models, channels, the A–Z plan, levels, Autopilot, errors) is stored as `{ en, pl }` and localized right before the response is sent (`lib/i18n.js`).

## Before production

- Payments (e.g. Stripe / Przelewy24) for fees and commissions – amounts are currently calculated and confirmed manually.
- Revenue import from distributors instead of self-reporting; e-mail notifications; rate limiting; backups (or PostgreSQL).

---

**PL:** Strona domyślnie jest po angielsku – przełącznik **EN | PL** jest w nagłówku, a wybór języka jest zapamiętywany. Baza podmiotów do pobrania: `database/global-database.xlsx` (Excel) i `database/global-database.csv`. Strategia i mapa rynku: `docs/STRATEGIA.md`.
