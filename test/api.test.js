'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Store } = require('../lib/db');
const { createApp } = require('../lib/app');
const { seed } = require('../lib/seed');
const { agreementEndPeriod } = require('../lib/settlement');

let server;
let base;
let clock = new Date('2026-03-10T12:00:00Z');
const store = new Store(null);

async function api(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  seed(store);
  server = http.createServer(createApp(store, { adminToken: 'admin-secret', platformFeePercent: 20, now: () => clock }));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const outletBody = {
  name: 'Testowa Playlista',
  type: 'playlist',
  genres: ['pop'],
  url: 'https://open.spotify.com/playlist/test',
  contactEmail: 'Kurator@Example.com',
  reach: 1000,
  responseDays: 5,
  collaboration: { model: 'commission', ratePercent: 10, durationMonths: 3 },
};

test('agreementEndPeriod liczy miesiące włącznie', () => {
  assert.equal(agreementEndPeriod('2026-03-10T00:00:00Z', 3), '2026-05');
  assert.equal(agreementEndPeriod('2026-11-01T00:00:00Z', 3), '2027-01');
});

test('katalog jest filtrowany i nie ujawnia sekretów', async () => {
  const { status, body } = await api('GET', '/api/outlets?type=radio');
  assert.equal(status, 200);
  assert.ok(body.outlets.length >= 1);
  for (const o of body.outlets) {
    assert.equal(o.type, 'radio');
    assert.equal(o.manageKeyHash, undefined);
    assert.equal(o.contactEmail, undefined);
  }
});

test('walidacja odrzuca niepoprawne miejsce', async () => {
  const { status, body } = await api('POST', '/api/outlets', { ...outletBody, url: 'javascript:alert(1)' });
  assert.equal(status, 400);
  assert.match(body.error, /http/);
  const r2 = await api('POST', '/api/outlets', { ...outletBody, collaboration: { model: 'commission', ratePercent: 90, durationMonths: 3 } });
  assert.equal(r2.status, 400);
});

test('pełny cykl: zgłoszenie → akceptacja → przychód → prowizja → wypłata', async () => {
  const created = await api('POST', '/api/outlets', outletBody);
  assert.equal(created.status, 201);
  const { outlet, manageKey } = created.body;
  assert.equal(outlet.contactEmail, 'kurator@example.com');
  assert.equal(outlet.verified, false);

  const sub = await api('POST', '/api/submissions', {
    outletIds: [outlet.id, 'out_missing'],
    artistName: 'Artysta',
    artistEmail: 'artysta@example.com',
    trackTitle: 'Singiel',
    trackUrl: 'https://open.spotify.com/track/abc',
    genre: 'pop',
    acceptTerms: true,
  });
  assert.equal(sub.status, 201);
  assert.equal(sub.body.submissions.length, 1);
  assert.equal(sub.body.skipped.length, 1);
  const { artistKey } = sub.body;
  const subId = sub.body.submissions[0].id;
  assert.equal(sub.body.submissions[0].artistEmail, undefined);

  // duplikat do tego samego miejsca jest pomijany
  const dup = await api('POST', '/api/submissions', { ...sub.body.submissions[0], outletIds: [outlet.id], artistEmail: 'a@b.pl', acceptTerms: true });
  assert.equal(dup.status, 400);

  // przychód przed akceptacją jest niedozwolony
  let r = await api('POST', `/api/submissions/${subId}/revenue`, { period: '2026-03', amountPLN: 100 }, { 'x-artist-key': artistKey });
  assert.equal(r.status, 409);

  // obcy klucz nie może zmienić statusu
  r = await api('PATCH', `/api/submissions/${subId}`, { status: 'accepted' }, { 'x-manage-key': 'zly-klucz' });
  assert.equal(r.status, 403);

  // niedozwolone przejście
  r = await api('PATCH', `/api/submissions/${subId}`, { status: 'published' }, { 'x-manage-key': manageKey });
  assert.equal(r.status, 409);

  clock = new Date('2026-03-12T12:00:00Z');
  r = await api('PATCH', `/api/submissions/${subId}`, { status: 'accepted', curatorNote: 'Super!' }, { 'x-manage-key': manageKey });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'accepted');
  assert.equal(r.body.artistEmail, 'artysta@example.com');

  r = await api('POST', `/api/submissions/${subId}/revenue`, { period: '2026-04', amountPLN: 500 }, { 'x-artist-key': artistKey });
  assert.equal(r.status, 201);
  assert.equal(r.body.entry.commissionPLN, 50);
  assert.equal(r.body.entry.platformFeePLN, 10);
  assert.equal(r.body.entry.curatorNetPLN, 40);

  // poza okresem umowy (3 mies.: 03–05) prowizja = 0
  r = await api('POST', `/api/submissions/${subId}/revenue`, { period: '2026-06', amountPLN: 500 }, { 'x-artist-key': artistKey });
  assert.equal(r.body.entry.commissionPLN, 0);
  assert.equal(r.body.entry.inAgreement, false);

  r = await api('POST', `/api/submissions/${subId}/revenue`, { period: '2026-04', amountPLN: 1 }, { 'x-artist-key': artistKey });
  assert.equal(r.status, 409);

  const inbox = await api('GET', `/api/outlets/${outlet.id}/submissions`, null, { 'x-manage-key': manageKey });
  assert.equal(inbox.status, 200);
  assert.equal(inbox.body.totals.duePLN, 50);
  const entryId = inbox.body.submissions[0].revenue[0].id;

  r = await api('PATCH', `/api/submissions/${subId}/revenue/${entryId}`, { paid: true }, { 'x-manage-key': manageKey });
  assert.equal(r.body.settlement.paidPLN, 50);
  assert.equal(r.body.settlement.duePLN, 0);

  const mine = await api('GET', '/api/artist/submissions', null, { 'x-artist-key': artistKey });
  assert.equal(mine.body.submissions.length, 1);
  assert.equal(mine.body.submissions[0].settlement.revenuePLN, 1000);

  const stats = (await api('GET', `/api/outlets/${outlet.id}`)).body.stats;
  assert.equal(stats.acceptanceRate, 100);
  assert.equal(stats.avgResponseHours, 48);

  const admin = await api('GET', '/api/admin/summary', null, { 'x-admin-token': 'admin-secret' });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.earnings.fromCommissionsPLN, 10);
  assert.ok(admin.body.pendingVerification.some((o) => o.id === outlet.id));
  assert.equal((await api('GET', '/api/admin/summary')).status, 403);
});

test('opłata za odsłuch dzieli się między kuratora i platformę', async () => {
  const blog = store.data.outlets.find((o) => o.collaboration.model === 'fee');
  const r = await api('POST', '/api/submissions', {
    outletIds: [blog.id],
    artistName: 'X', artistEmail: 'x@example.com', trackTitle: 'T', trackUrl: 'https://example.com/t', acceptTerms: true,
  });
  assert.equal(r.status, 201);
  const fee = r.body.submissions[0].reviewFee;
  assert.equal(fee.amountPLN, 15);
  assert.equal(fee.platformFeePLN, 3);
  assert.equal(fee.curatorNetPLN, 12);
});

test('brak odpowiedzi w terminie → zgłoszenie wygasa', async () => {
  clock = new Date('2026-05-01T00:00:00Z');
  const created = await api('POST', '/api/outlets', { ...outletBody, name: 'Wolny Kurator', responseDays: 2 });
  const { outlet } = created.body;
  const sub = await api('POST', '/api/submissions', {
    outletIds: [outlet.id], artistName: 'A', artistEmail: 'a@example.com', trackTitle: 'T',
    trackUrl: 'https://example.com/slow', acceptTerms: true,
  });
  const key = sub.body.artistKey;
  clock = new Date('2026-05-04T00:00:00Z');
  const mine = await api('GET', '/api/artist/submissions', null, { 'x-artist-key': key });
  assert.equal(mine.body.submissions[0].status, 'expired');
  const stats = (await api('GET', `/api/outlets/${outlet.id}`)).body.stats;
  assert.equal(stats.responseRate, 0);
});

test('dopasowanie preferuje gatunek artysty', async () => {
  const { body } = await api('GET', '/api/match?genre=lo-fi');
  assert.ok(body.outlets.length > 0);
  assert.ok(body.outlets[0].genres.includes('lo-fi'));
  assert.ok(body.outlets[0].match.score >= body.outlets.at(-1).match.score);
});

test('artysta może wycofać zgłoszenie, ale nie zaakceptować', async () => {
  const radio = store.data.outlets.find((o) => o.type === 'radio');
  const sub = await api('POST', '/api/submissions', {
    outletIds: [radio.id], artistName: 'A', artistEmail: 'a@example.com', trackTitle: 'T2',
    trackUrl: 'https://example.com/t2', acceptTerms: true,
  });
  const id = sub.body.submissions[0].id;
  const h = { 'x-artist-key': sub.body.artistKey };
  assert.equal((await api('PATCH', `/api/submissions/${id}`, { status: 'accepted' }, h)).status, 400);
  const r = await api('PATCH', `/api/submissions/${id}`, { status: 'withdrawn' }, h);
  assert.equal(r.body.status, 'withdrawn');
});

test('pliki statyczne nie wychodzą poza katalog public', async () => {
  const res = await fetch(`${base}/..%2Fserver.js`);
  assert.notEqual(res.status, 200);
});

test('dyrygent kampanii: plan, fale wg dat, budżet, personalizacja pitchu', async () => {
  clock = new Date('2026-06-01T10:00:00Z');
  const preview = await api('POST', '/api/campaigns/preview', { genre: 'pop', releaseDate: '2026-07-15', budgetPLN: 0 });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.spentPLN, 0);
  assert.ok(preview.body.waves.length >= 2);
  assert.ok(preview.body.tasks.some((t) => t.id === 'spotify-pitch' && t.date === '2026-06-24'));
  const allOutlets = preview.body.waves.flatMap((w) => w.outlets);
  assert.ok(allOutlets.every((o) => o.model !== 'fee'), 'bez budżetu brak płatnych miejsc');
  assert.ok(new Set(allOutlets.map((o) => o.type)).size >= 3, 'orkiestra: różne typy miejsc');

  const withBudget = await api('POST', '/api/campaigns/preview', { genre: 'indie', releaseDate: '2026-07-15', budgetPLN: 100 });
  assert.equal(withBudget.body.spentPLN, 15);

  const r = await api('POST', '/api/campaigns', {
    artistName: 'Orkiestra', artistEmail: 'o@example.com', trackTitle: 'Symfonia',
    trackUrl: 'https://example.com/symfonia', genre: 'pop', releaseDate: '2026-07-15', budgetPLN: 0,
    message: 'Cześć {nazwa}!', acceptTerms: true,
  });
  assert.equal(r.status, 201);
  const c = r.body.campaign;
  const key = r.body.artistKey;
  // 2026-06-01 → tylko fale z datą <= dziś zostały wysłane (radio T-42 = 2026-06-03 jeszcze nie)
  assert.equal(c.waves.filter((w) => w.sent).length, 0);
  assert.equal(c.results.sent, 0);

  clock = new Date('2026-07-16T10:00:00Z');
  const list = await api('GET', '/api/artist/campaigns', null, { 'x-artist-key': key });
  const live = list.body.campaigns[0];
  assert.ok(live.waves.every((w) => w.sent === (w.date <= '2026-07-16')), 'wysłane są dokładnie fale z terminem do dziś');
  assert.ok(live.results.sent > 0);
  const subs = (await api('GET', '/api/artist/submissions', null, { 'x-artist-key': key })).body.submissions;
  assert.ok(subs.every((x) => x.campaignId === c.id));
  assert.ok(subs.every((x) => x.message === `Cześć ${x.outletName}!`));

  const before = live.orchestraScore;
  const t = await api('PATCH', `/api/campaigns/${c.id}/tasks/spotify-pitch`, { done: true }, { 'x-artist-key': key });
  assert.ok(t.body.orchestraScore > before);
  assert.equal((await api('PATCH', `/api/campaigns/${c.id}/tasks/spotify-pitch`, { done: true }, { 'x-artist-key': 'x'.repeat(20) })).status, 403);
});

test('ścieżka artysty: profil, EPK i awans poziomu po umieszczeniach', async () => {
  const { artistKey } = (await api('POST', '/api/artist/register')).body;
  const h = { 'x-artist-key': artistKey };
  assert.equal((await api('GET', '/api/artist/me', null, h)).status, 404);
  const p = await api('PUT', '/api/artist/profile', {
    name: 'Jan Kowalski Łódź', bio: 'Debiutant', genres: ['pop'], monthlyListeners: 600,
    contactEmail: 'jan@example.com', links: { spotify: 'https://open.spotify.com/artist/x' },
  }, h);
  assert.equal(p.status, 200);
  assert.equal(p.body.profile.slug, 'jan-kowalski-lodz');
  assert.equal(p.body.career.level, 1);
  assert.equal(p.body.career.next.name, 'Lokalny');

  // 3 umieszczenia w 2 typach mediów → poziom „Lokalny”
  const targets = store.data.outlets.filter((o) => o.sample && o.creatorTypes.includes('music') && ['radio', 'podcast', 'newsletter'].includes(o.type));
  for (const [i, o] of targets.entries()) {
    const key = 'k'.repeat(10) + i;
    const manageKey = `curator-key-${i}-xxxxxxxx`;
    o.manageKeyHash = require('../lib/db').hashSecret(manageKey);
    const s = await api('POST', '/api/submissions', {
      outletIds: [o.id], artistName: 'Jan', artistEmail: 'jan@example.com', trackTitle: `T${key}`,
      trackUrl: `https://example.com/jan-${i}`, acceptTerms: true, artistKey,
    });
    const inbox = await api('GET', `/api/outlets/${o.id}/submissions`, null, { 'x-manage-key': manageKey });
    assert.equal(inbox.body.submissions.find((x) => x.id === s.body.submissions[0].id).artistSlug, 'jan-kowalski-lodz');
    await api('PATCH', `/api/submissions/${s.body.submissions[0].id}`, { status: 'accepted' }, { 'x-manage-key': manageKey });
  }
  const me = await api('GET', '/api/artist/me', null, h);
  assert.equal(me.body.career.name, 'Lokalny');
  assert.equal(me.body.career.metrics.placements, 3);

  const epk = await api('GET', '/api/artists/jan-kowalski-lodz');
  assert.equal(epk.body.placements.length, 3);
  assert.equal(epk.body.profile.contactEmail, undefined, 'e-mail nie jest publiczny');
  assert.equal(epk.body.levelName, 'Lokalny');
});

test('Pula Efektu: jeden raport przychodu, prowizje kilku kuratorów ograniczone limitem', async () => {
  clock = new Date('2026-08-01T10:00:00Z');
  const { hashSecret } = require('../lib/db');
  const outlets = [];
  for (let i = 0; i < 3; i += 1) {
    const r = await api('POST', '/api/outlets', { ...outletBody, name: `Pula ${i}`, collaboration: { model: 'commission', ratePercent: 20, durationMonths: 6 } });
    outlets.push(r.body);
  }
  const s = await api('POST', '/api/submissions', {
    outletIds: outlets.map((o) => o.outlet.id), artistName: 'P', artistEmail: 'p@example.com', trackTitle: 'Pula',
    trackUrl: 'https://example.com/pula', acceptTerms: true,
  });
  for (const [i, sub] of s.body.submissions.entries()) {
    await api('PATCH', `/api/submissions/${sub.id}`, { status: 'accepted' }, { 'x-manage-key': outlets[i].manageKey });
  }
  const h = { 'x-artist-key': s.body.artistKey };
  const r = await api('POST', `/api/submissions/${s.body.submissions[0].id}/revenue`, { period: '2026-08', amountPLN: 1000 }, h);
  assert.equal(r.status, 201);
  assert.equal(r.body.pool.size, 3);
  assert.equal(r.body.pool.sumRatesPercent, 60);
  assert.equal(r.body.pool.totalCommissionPLN, 300, '3 × 20% = 60% ograniczone do 30%');
  assert.equal(r.body.entry.commissionPLN, 100);
  // ten sam okres z innego zgłoszenia tego utworu – odrzucony (brak podwójnego raportu)
  const dup = await api('POST', `/api/submissions/${s.body.submissions[1].id}/revenue`, { period: '2026-08', amountPLN: 1000 }, h);
  assert.equal(dup.status, 409);
  void hashSecret;
});

test('Drabina dostępu i efekt domina', async () => {
  clock = new Date('2026-09-01T10:00:00Z');
  const big = store.data.outlets.find((o) => o.name === 'SoundCheck PL');
  assert.equal(big.minLevel, 2);
  const blocked = await api('POST', '/api/submissions', {
    outletIds: [big.id], artistName: 'D', artistEmail: 'd@example.com', trackTitle: 'D', trackUrl: 'https://example.com/d0', acceptTerms: true,
  });
  assert.equal(blocked.status, 400);
  assert.match(blocked.body.error, /wymaga poziomu artysty 2/);

  // Kampania; kurator małego miejsca akceptuje → domino wysyła do większego miejsca spoza kampanii
  const kpop = { ...outletBody, genres: ['k-pop'] };
  const small = await api('POST', '/api/outlets', { ...kpop, name: 'Mała playlista', reach: 50 });
  const c = await api('POST', '/api/campaigns', {
    artistName: 'Domino', artistEmail: 'dom@example.com', trackTitle: 'Domino', trackUrl: 'https://example.com/domino',
    genre: 'k-pop', releaseDate: '2026-08-25', budgetPLN: 0, message: 'Hej {nazwa}', acceptTerms: true,
  });
  const key = c.body.artistKey;
  const bigNew = await api('POST', '/api/outlets', { ...kpop, name: 'Duża playlista', reach: 100000 });
  const locked = await api('POST', '/api/outlets', { ...kpop, name: 'Elitarna playlista', reach: 900000 });
  await api('PATCH', `/api/outlets/${locked.body.outlet.id}`, { minLevel: 4 }, { 'x-manage-key': locked.body.manageKey });

  let subs = (await api('GET', '/api/artist/submissions', null, { 'x-artist-key': key })).body.submissions;
  const onSmall = subs.find((x) => x.outletId === small.body.outlet.id);
  assert.ok(onSmall, 'mała playlista jest w kampanii');
  await api('PATCH', `/api/submissions/${onSmall.id}`, { status: 'accepted' }, { 'x-manage-key': small.body.manageKey });

  subs = (await api('GET', '/api/artist/submissions', null, { 'x-artist-key': key })).body.submissions;
  const camp = (await api('GET', '/api/artist/campaigns', null, { 'x-artist-key': key })).body.campaigns[0];
  const domino = camp.waves.find((w) => w.domino);
  assert.ok(domino && domino.sent, 'powstała i wyszła fala domina');
  const fresh = subs.filter((x) => domino.submissionIds.includes(x.id));
  assert.deepEqual(fresh.map((x) => x.outletId), [bigNew.body.outlet.id], 'tylko większe, dostępne miejsce');
  assert.match(fresh[0].message, /Mała playlista/, 'pitch zawiera dowód społeczny');
});

test('typy twórców: pisarz dostaje własne miejsca, kanały i harmonogram', async () => {
  clock = new Date('2026-10-01T10:00:00Z');
  const plan = await api('POST', '/api/campaigns/preview', { creatorType: 'writer', genre: 'kryminał', releaseDate: '2026-12-15', budgetPLN: 0 });
  assert.equal(plan.status, 200);
  const outlets = plan.body.waves.flatMap((w) => w.outlets);
  assert.ok(outlets.length >= 3);
  const ids = new Set(outlets.map((o) => o.id));
  for (const o of store.data.outlets.filter((x) => ids.has(x.id))) assert.ok(o.creatorTypes.includes('writer'));
  assert.ok(plan.body.tasks.some((t) => t.id === 'goodreads'), 'kanały dla pisarzy');
  assert.ok(!plan.body.tasks.some((t) => t.id === 'spotify-pitch'), 'bez kanałów muzycznych');
  assert.ok(plan.body.waves.some((w) => w.name.includes('podcasty i radio') && w.date === '2026-10-31'));

  // muzyk nie może wysłać utworu do miejsca tylko dla pisarzy
  const blog = store.data.outlets.find((o) => o.name === 'Zakładka – blog literacki');
  const r = await api('POST', '/api/submissions', {
    outletIds: [blog.id], artistName: 'M', artistEmail: 'm@example.com', trackTitle: 'T', trackUrl: 'https://example.com/m', acceptTerms: true,
  });
  assert.equal(r.status, 400);
  const w = await api('POST', '/api/submissions', {
    creatorType: 'writer', genre: 'kryminał', outletIds: [blog.id], artistName: 'Autorka', artistEmail: 'a@example.com',
    trackTitle: 'Zbrodnia', trackUrl: 'https://example.com/ksiazka', acceptTerms: true,
  });
  assert.equal(w.status, 201);

  const list = await api('GET', '/api/outlets?creator=dj');
  assert.ok(list.body.outlets.length >= 3);
  assert.ok(list.body.outlets.every((o) => o.creatorTypes.includes('dj')));
});

test('Światowa Baza Podmiotów: seed, CRM, CSV, outreach, konwersja i Dyrygent', async () => {
  clock = new Date('2026-10-13T10:00:00Z');
  const { seedEntitiesInto } = require('../lib/entities');
  seedEntitiesInto(store, () => clock);
  const A = { 'x-admin-token': 'admin-secret' };
  assert.equal((await api('GET', '/api/admin/entities')).status, 403);

  const all = await api('GET', '/api/admin/entities', null, A);
  assert.ok(all.body.total >= 150, `seed ma ${all.body.total} podmiotów`);
  assert.ok(all.body.countries >= 15);
  assert.ok(all.body.entities.every((e) => e.stage === 'prospect' && !e.verified && !e.publicListing), 'seed = prospekty, nie partnerzy');
  assert.ok(all.body.facets.creatorTypes.writer >= 30 && all.body.facets.creatorTypes.dj >= 25);

  // publicznie nic, dopóki admin nie zweryfikuje
  assert.equal((await api('GET', '/api/entities')).body.entities.length, 0);

  const writers = await api('GET', '/api/admin/entities?creator=writer&region=Europa&q=festiwal', null, A);
  assert.ok(writers.body.entities.length > 0);
  assert.ok(writers.body.entities.every((e) => e.creatorTypes.includes('writer') && e.region === 'Europa'));

  // duplikat
  const kexp = all.body.entities.find((e) => e.name === 'KEXP');
  assert.equal((await api('POST', '/api/admin/entities', { name: 'KEXP', url: 'https://www.kexp.org', kind: 'radio' }, A)).status, 409);

  // CSV: eksport → import (z duplikatami i błędem)
  const res = await fetch(`${base}/api/admin/entities/export`, { headers: A });
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const csv = await res.text();
  assert.ok(csv.startsWith('name,kind,creatorTypes'));
  const imp = await api('POST', '/api/admin/entities/import', {
    csv: `name,url,kind,creatorTypes,country,region,submission,model\nNowe Radio,https://nowe-radio.example,radio,music|dj,Polska,Europa,open,free\nKEXP,https://www.kexp.org,radio,music,USA,Ameryka Północna,contact,free\nZły,javascript:x,radio,music,,,,\n"=SUM(A1)",https://formula.example,blog,writer,,,,`,
  }, A);
  assert.equal(imp.body.added, 2);
  assert.equal(imp.body.skipped, 2);

  // etap + weryfikacja + publiczna lista
  const p1 = await api('PATCH', `/api/admin/entities/${kexp.id}`, { stage: 'contacted', verified: true, publicListing: true, contactEmail: 'music@kexp.example' }, A);
  assert.equal(p1.body.stage, 'contacted');
  assert.equal(p1.body.stageHistory.length, 2);
  const pub = (await api('GET', '/api/entities?creator=music')).body.entities;
  assert.deepEqual(pub.map((e) => e.name), ['KEXP']);
  assert.equal(pub[0].contactEmail, undefined, 'kontakt nie jest publiczny');

  // Dyrygent dołącza zweryfikowane podmioty jako zadania
  const plan = await api('POST', '/api/campaigns/preview', { genre: 'indie', releaseDate: '2026-12-20', budgetPLN: 0 });
  assert.ok(plan.body.tasks.some((t) => t.id === `ent-${kexp.id}` && t.group === 'Baza światowa'));

  // outreach PL / EN
  const o = await api('GET', `/api/admin/entities/${kexp.id}/outreach?lang=en`, null, A);
  assert.match(o.body.subject, /KEXP/);
  assert.match(o.body.body, /capped at 30%/);

  // konwersja w partnera katalogu
  const conv = await api('POST', `/api/admin/entities/${kexp.id}/convert`, { genres: ['indie'], reach: 100000 }, A);
  assert.equal(conv.status, 201);
  assert.equal(conv.body.entity.stage, 'partner');
  assert.ok(conv.body.manageKey);
  const outlet = (await api('GET', `/api/outlets/${conv.body.outlet.id}`)).body;
  assert.equal(outlet.verified, true);
  assert.equal(outlet.entityId, kexp.id);
  assert.equal((await api('POST', `/api/admin/entities/${kexp.id}/convert`, {}, A)).status, 409);
  // partner nie jest już „zadaniem do samodzielnego zgłoszenia”
  assert.equal((await api('GET', '/api/entities')).body.entities.length, 0);
});

test('Symulator Monte Carlo: rozkład wyników i szansa awansu', async () => {
  const { simulate } = require('../lib/simulate');
  const outlets = Array.from({ length: 10 }, (_, i) => ({ type: i % 2 ? 'radio' : 'playlist', country: 'Polska', reach: 10000, stats: { acceptanceRate: 50 } }));
  const s = simulate(outlets, {
    runs: 4000,
    footprint: { placements: 0, reach: 0, types: new Set(), countries: new Set(), listeners: 1000 },
    nextReq: { placements: 3, reach: 20000, countries: 1, types: 2, listeners: 500 },
  });
  assert.ok(s.placements.p10 <= s.placements.p50 && s.placements.p50 <= s.placements.p90);
  assert.ok(s.placements.p50 >= 4 && s.placements.p50 <= 6, `mediana ~5, jest ${s.placements.p50}`);
  assert.ok(s.chance.atLeast1 >= 99);
  assert.ok(s.levelUpChance >= 90 && s.levelUpChance <= 100);
  assert.deepEqual(simulate(outlets, { seed: 1 }), simulate(outlets, { seed: 1 }), 'deterministyczny');
  assert.equal(simulate([], {}).placements.p50, 0);

  const preview = await api('POST', '/api/campaigns/preview', { genre: 'pop', releaseDate: '2026-12-20', budgetPLN: 0 });
  assert.ok(preview.body.simulation.runs > 0);
  assert.equal(preview.body.simulation.nextLevel, 'Lokalny');
});

test('Autopilot kariery: uszeregowane następne ruchy', async () => {
  clock = new Date('2026-11-05T10:00:00Z');
  const { artistKey } = (await api('POST', '/api/artist/register')).body;
  const h = { 'x-artist-key': artistKey };
  let r = await api('GET', '/api/artist/next-actions', null, h);
  assert.equal(r.body.actions[0].kind, 'profile', 'najpierw profil');
  assert.ok(r.body.actions.some((a) => a.kind === 'campaign'));

  await api('PUT', '/api/artist/profile', { name: 'Autopilot Test', genres: ['pop'], bio: 'x', photoUrl: 'https://example.com/p.jpg', links: { website: 'https://example.com' }, achievements: 'x' }, h);
  const c = await api('POST', '/api/campaigns', {
    artistName: 'Autopilot Test', artistEmail: 'ap@example.com', trackTitle: 'Lot', trackUrl: 'https://example.com/lot',
    genre: 'pop', releaseDate: '2026-11-20', budgetPLN: 0, acceptTerms: true, artistKey,
  });
  assert.equal(c.status, 201);
  assert.ok(c.body.campaign.simulation, 'kampania zapisuje symulację');
  r = await api('GET', '/api/artist/next-actions', null, h);
  const kinds = r.body.actions.map((a) => a.kind);
  assert.ok(!kinds.includes('campaign'));
  assert.ok(kinds.includes('task'), 'zadania Planu A–Z do nadrobienia');
  const top = r.body.actions[0];
  assert.ok(top.score >= r.body.actions.at(-1).score);
  const task = r.body.actions.find((a) => a.kind === 'task');
  assert.ok(task.campaignId && task.taskId);

  // akceptacja w modelu prowizyjnym → w kolejnym miesiącu Autopilot przypomina o raporcie przychodu
  clock = new Date('2026-11-21T10:00:00Z'); // fala playlist (T+1) wychodzi automatycznie
  const sub = (await api('GET', '/api/artist/submissions', null, h)).body.submissions
    .find((x) => ['commission', 'revshare'].includes(x.agreement.model));
  const outlet = store.data.outlets.find((o) => o.id === sub.outletId);
  const mk = `manage-${outlet.id}-xxxxxxxx`;
  outlet.manageKeyHash = require('../lib/db').hashSecret(mk);
  await api('PATCH', `/api/submissions/${sub.id}`, { status: 'accepted' }, { 'x-manage-key': mk });
  clock = new Date('2026-12-03T10:00:00Z');
  r = await api('GET', '/api/artist/next-actions', null, h);
  assert.ok(r.body.actions.some((a) => a.kind === 'revenue' && a.title.includes('2026-11')));
});
