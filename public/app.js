'use strict';

(() => {
  const app = document.getElementById('app');
  let META = null;

  // ---------- narzędzia ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pln = (n) => `${Number(n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
  const num = (n) => Number(n || 0).toLocaleString('pl-PL');
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString('pl-PL') : '—');

  const storage = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* tryb prywatny */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* tryb prywatny */ } },
  };

  async function api(method, path, body, headers = {}) {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Błąd ${res.status}`);
    return data;
  }

  let toastTimer;
  function toast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `show${isError ? ' error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, 3500);
  }

  function formData(form) {
    const out = {};
    for (const [k, v] of new FormData(form)) out[k] = v;
    return out;
  }

  // Obsługa formularza z blokadą przycisku i komunikatem błędu.
  function onSubmit(form, handler) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      try { await handler(formData(form), form); } catch (err) { toast(err.message, true); } finally { if (btn) btn.disabled = false; }
    });
  }

  // ---------- koszyk (wybrane miejsca) ----------
  const cart = {
    ids() { return storage.get('cart', []); },
    has(id) { return this.ids().includes(id); },
    toggle(id) {
      const ids = this.ids();
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1); else if (ids.length < 25) ids.push(id); else { toast('Maks. 25 miejsc w jednym zgłoszeniu.', true); return; }
      storage.set('cart', ids);
      updateCartBadge();
    },
    clear() { storage.set('cart', []); updateCartBadge(); },
  };
  function updateCartBadge() {
    const b = document.getElementById('cartCount');
    const n = cart.ids().length;
    b.textContent = n;
    b.hidden = n === 0;
  }

  // ---------- komponenty ----------
  function modelBadge(c) {
    const label = META.models[c.model]?.label || c.model;
    let detail = '';
    if (c.model === 'commission' || c.model === 'revshare') detail = ` ${c.ratePercent}% / ${c.durationMonths} mies.`;
    if (c.model === 'fee') detail = ` ${pln(c.feePLN)}`;
    return `<span class="model model-${esc(c.model)}">${esc(label)}${esc(detail)}</span>`;
  }

  function outletCard(o) {
    const sel = cart.has(o.id);
    const st = o.stats || {};
    const match = o.match
      ? `<div class="score"><span>${o.match.score}</span><progress max="100" value="${o.match.score}"></progress></div>
         <div class="tags">${o.match.reasons.map((r) => `<span class="tag">✓ ${esc(r)}</span>`).join('')}</div>`
      : '';
    return `
      <article class="card${sel ? ' selected' : ''}">
        <div class="card-head">
          <div>
            <div class="muted small">${esc(META.types[o.type] || o.type)}</div>
            <h3><a href="#/miejsce/${esc(o.id)}">${esc(o.name)}</a></h3>
          </div>
          ${modelBadge(o.collaboration)}
        </div>
        ${match}
        <div class="meta">
          <span>👥 ${o.reach ? num(o.reach) : '—'}</span>
          <span>⏱ odp. do ${esc(o.responseDays || 7)} dni</span>
          ${st.acceptanceRate !== null && st.acceptanceRate !== undefined ? `<span>✅ ${st.acceptanceRate}% akcept.</span>` : ''}
          ${o.country ? `<span>📍 ${esc(o.country)}</span>` : ''}
        </div>
        <div class="tags">${(o.genres.length ? o.genres : ['wszystkie gatunki']).map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>
        <div>${o.verified ? '<span class="verified">✔ zweryfikowany</span>' : '<span class="muted small">niezweryfikowany</span>'} ${o.sample ? '<span class="sample">· przykład</span>' : ''}</div>
        <div class="actions">
          ${o.acceptsSubmissions
            ? `<button class="btn small ${sel ? '' : 'primary'}" data-cart="${esc(o.id)}">${sel ? '✓ Wybrane' : '+ Dodaj do zgłoszenia'}</button>`
            : '<span class="muted small">Nie przyjmuje teraz zgłoszeń</span>'}
          <a class="btn small ghost" href="#/miejsce/${esc(o.id)}">Szczegóły</a>
        </div>
      </article>`;
  }

  function bindCartButtons(root, rerender) {
    root.querySelectorAll('[data-cart]').forEach((b) => b.addEventListener('click', () => { cart.toggle(b.dataset.cart); rerender(); }));
  }

  function options(map, selected = '', empty = null) {
    const entries = Array.isArray(map) ? map.map((g) => [g, g]) : Object.entries(map).map(([k, v]) => [k, typeof v === 'string' ? v : v.label]);
    return (empty !== null ? `<option value="">${esc(empty)}</option>` : '') +
      entries.map(([k, v]) => `<option value="${esc(k)}"${k === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }

  // ---------- widoki ----------
  async function viewHome() {
    const s = await api('GET', '/api/stats');
    app.innerHTML = `
      <section class="hero">
        <h1>Twoja muzyka w <span class="grad">playlistach, radiach i kanałach</span>. Płacisz za efekt.</h1>
        <p class="lead">Promo Hub łączy artystów z kuratorami playlist, stacjami radiowymi, YouTube’em, TikTokiem, blogami, podcastami, DJ-ami i sync. Bez kupowania kredytów w ciemno: w modelu prowizyjnym kurator zarabia dopiero wtedy, gdy Twój utwór zarabia.</p>
        <div class="cta-row">
          <a class="btn primary" href="#/dopasuj">Znajdź miejsca dla swojego utworu</a>
          <a class="btn" href="#/kurator">Dodaj swoją playlistę lub radio</a>
        </div>
      </section>
      <div class="stats">
        <div class="stat"><b>${num(s.outlets)}</b><span>miejsc promocji</span></div>
        <div class="stat"><b>${num(s.totalReach)}</b><span>łączny zasięg</span></div>
        <div class="stat"><b>${num(s.submissions)}</b><span>zgłoszonych utworów</span></div>
        <div class="stat"><b>${num(s.placed)}</b><span>umieszczonych utworów</span></div>
      </div>
      <h2>Jak to działa</h2>
      <div class="steps">
        <div class="step"><h3>Dopasuj</h3><p class="muted">Wybierz gatunek, a ranking pokaże miejsca, które realnie przyjmują taką muzykę i odpowiadają w terminie.</p></div>
        <div class="step"><h3>Wyślij jednym formularzem</h3><p class="muted">Jedno zgłoszenie do nawet 25 playlist, radiów i kanałów. Warunki każdego miejsca widzisz przed wysłaniem.</p></div>
        <div class="step"><h3>Gwarancja odpowiedzi</h3><p class="muted">Kurator ma ustalony termin. Brak decyzji = zgłoszenie wygasa, a kurator spada w rankingu.</p></div>
        <div class="step"><h3>Rozliczenie od efektu</h3><p class="muted">Po umieszczeniu utworu zgłaszasz przychody, a system sam wylicza prowizję tylko za okres umowy.</p></div>
      </div>
      <h2>Dlaczego Promo Hub</h2>
      <div class="panel table-wrap">
        <table class="compare">
          <thead><tr><th></th><th>Promo Hub</th><th>Typowe serwisy płatnych zgłoszeń</th></tr></thead>
          <tbody>
            <tr><td>Koszt dla artysty z góry</td><td class="yes">0 zł w modelu prowizyjnym</td><td class="no">kredyty za każde zgłoszenie</td></tr>
            <tr><td>Kurator zarabia, gdy…</td><td class="yes">utwór przynosi przychód</td><td class="no">tylko przesłucha</td></tr>
            <tr><td>Rodzaje miejsc</td><td class="yes">playlisty, radio FM i online, YouTube, TikTok, Instagram, blogi, podcasty, DJ-e, kluby, TV, sync, wytwórnie</td><td class="no">głównie playlisty i blogi</td></tr>
            <tr><td>Termin odpowiedzi</td><td class="yes">gwarantowany, wpływa na ranking</td><td class="no">różnie</td></tr>
            <tr><td>Publiczna skuteczność kuratora</td><td class="yes">% akceptacji, % odpowiedzi, czas reakcji</td><td class="no">często ukryta</td></tr>
            <tr><td>Zamrożone warunki umowy</td><td class="yes">tak, zmiana cennika nie działa wstecz</td><td class="no">—</td></tr>
            <tr><td>Zgodność z regulaminami streamingu</td><td class="yes">bez płatnych gwarantowanych miejsc</td><td class="no">różnie</td></tr>
          </tbody>
        </table>
      </div>
      <h2>Modele współpracy</h2>
      <div class="grid">
        ${Object.entries(META.models).map(([k, m]) => `<div class="card"><span class="model model-${esc(k)}">${esc(m.label)}</span><p class="muted">${esc(m.description)}</p></div>`).join('')}
      </div>`;
  }

  async function viewCatalog() {
    const f = storage.get('filters', { q: '', type: '', genre: '', model: '', sort: 'reach', open: true });
    app.innerHTML = `
      <h1>Katalog miejsc promocji</h1>
      <p class="muted">Playlisty, radia, kanały, blogi, podcasty, DJ-e i więcej. Zaznacz miejsca i wyślij do nich utwór jednym zgłoszeniem.</p>
      <form class="filters" id="filters">
        <input name="q" placeholder="Szukaj: nazwa, opis, kraj…" value="${esc(f.q)}">
        <select name="type">${options(META.types, f.type, 'Wszystkie typy')}</select>
        <select name="genre">${options(META.genres, f.genre, 'Wszystkie gatunki')}</select>
        <select name="model">${options(META.models, f.model, 'Każdy model')}</select>
        <select name="sort">
          ${options({ reach: 'Największy zasięg', rate: 'Najniższa prowizja', new: 'Najnowsze', name: 'Nazwa A–Z' }, f.sort)}
        </select>
        <label class="check"><input type="checkbox" name="open" ${f.open ? 'checked' : ''}> tylko przyjmujące zgłoszenia</label>
      </form>
      <div id="results"></div>
      <div class="cta-row" id="cartCta"></div>`;
    const form = document.getElementById('filters');
    const results = document.getElementById('results');

    async function load() {
      const d = formData(form);
      const state = { q: d.q || '', type: d.type || '', genre: d.genre || '', model: d.model || '', sort: d.sort || 'reach', open: Boolean(d.open) };
      storage.set('filters', state);
      const qs = new URLSearchParams({ ...state, open: state.open ? '1' : '' });
      const { outlets } = await api('GET', `/api/outlets?${qs}`);
      const render = () => {
        results.innerHTML = outlets.length ? `<div class="grid">${outlets.map(outletCard).join('')}</div>` : '<div class="empty">Brak wyników – zmień filtry.</div>';
        bindCartButtons(results, render);
        const n = cart.ids().length;
        document.getElementById('cartCta').innerHTML = n ? `<a class="btn primary" href="#/wyslij">Wyślij utwór do wybranych (${n}) →</a>` : '';
      };
      render();
    }
    let t;
    form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load().catch((e) => toast(e.message, true)), 200); });
    form.addEventListener('submit', (e) => e.preventDefault());
    await load();
  }

  async function viewMatch() {
    const last = storage.get('matchGenre', '');
    app.innerHTML = `
      <h1>Dopasuj miejsca do utworu</h1>
      <p class="muted">Ranking 0–100 uwzględnia zgodność gatunku, skuteczność kuratora (% akceptacji), rzetelność (% odpowiedzi w terminie), weryfikację, zasięg i to, czy płacisz z góry.</p>
      <form class="filters" id="mf">
        <select name="genre" required>${options(META.genres, last, 'Wybierz gatunek utworu')}</select>
        <select name="type">${options(META.types, '', 'Wszystkie typy')}</select>
        <select name="model">${options(META.models, '', 'Każdy model')}</select>
        <button class="btn primary" type="submit">Pokaż najlepsze</button>
      </form>
      <div id="mres"></div>`;
    const form = document.getElementById('mf');
    const res = document.getElementById('mres');
    async function run() {
      const d = formData(form);
      storage.set('matchGenre', d.genre);
      const { outlets } = await api('GET', `/api/match?${new URLSearchParams(d)}`);
      const render = () => {
        res.innerHTML = outlets.length
          ? `<div class="cta-row"><button class="btn" id="addTop">+ Dodaj 10 najlepszych do zgłoszenia</button><a class="btn primary" href="#/wyslij">Przejdź do wysyłki →</a></div><br>
             <div class="grid">${outlets.map(outletCard).join('')}</div>`
          : '<div class="empty">Brak dopasowań – spróbuj innego gatunku lub typu.</div>';
        bindCartButtons(res, render);
        const top = document.getElementById('addTop');
        if (top) top.addEventListener('click', () => {
          const ids = cart.ids();
          for (const o of outlets.slice(0, 10)) if (!ids.includes(o.id) && ids.length < 25) ids.push(o.id);
          storage.set('cart', ids);
          updateCartBadge();
          render();
          toast('Dodano najlepsze dopasowania.');
        });
      };
      render();
    }
    onSubmit(form, run);
    if (last) await run();
  }

  async function viewOutlet(id) {
    const o = await api('GET', `/api/outlets/${encodeURIComponent(id)}`);
    const st = o.stats;
    const m = META.models[o.collaboration.model];
    app.innerHTML = `
      <p><a href="#/katalog">← Katalog</a></p>
      <div class="split">
        <div>
          <div class="muted">${esc(META.types[o.type])}</div>
          <h1>${esc(o.name)}</h1>
          <p>${o.verified ? '<span class="verified">✔ zweryfikowany</span>' : '<span class="muted">niezweryfikowany</span>'} ${o.sample ? '<span class="sample">· przykładowy wpis</span>' : ''}</p>
          <p>${esc(o.description) || '<span class="muted">Brak opisu.</span>'}</p>
          <div class="tags">${(o.genres.length ? o.genres : ['wszystkie gatunki']).map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>
          <p class="meta"><span>👥 zasięg: ${o.reach ? num(o.reach) : '—'}</span><span>📍 ${esc(o.country || '—')}</span><span>🗣 ${esc(o.language || '—')}</span></p>
          <p><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer nofollow">Otwórz profil / playlistę ↗</a></p>
        </div>
        <div>
          <div class="panel">
            <h3>Warunki współpracy</h3>
            <p>${modelBadge(o.collaboration)}</p>
            <p class="muted">${esc(m.description)}</p>
            ${o.collaboration.terms ? `<p>${esc(o.collaboration.terms)}</p>` : ''}
            <p class="muted small">Termin odpowiedzi: ${esc(o.responseDays || 7)} dni. Po tym czasie zgłoszenie wygasa automatycznie.</p>
          </div>
          <div class="stats">
            <div class="stat"><b>${st.acceptanceRate ?? '—'}${st.acceptanceRate !== null ? '%' : ''}</b><span>akceptacji</span></div>
            <div class="stat"><b>${st.responseRate ?? '—'}${st.responseRate !== null ? '%' : ''}</b><span>odpowiedzi w terminie</span></div>
            <div class="stat"><b>${st.avgResponseHours !== null ? `${st.avgResponseHours} h` : '—'}</b><span>śr. czas reakcji</span></div>
            <div class="stat"><b>${num(st.placed)}</b><span>umieszczonych</span></div>
          </div>
          ${o.acceptsSubmissions
            ? `<button class="btn primary" data-cart="${esc(o.id)}">${cart.has(o.id) ? '✓ W zgłoszeniu' : '+ Dodaj do zgłoszenia'}</button> <a class="btn" href="#/wyslij">Wyślij →</a>`
            : '<p class="muted">Obecnie nie przyjmuje zgłoszeń.</p>'}
        </div>
      </div>`;
    bindCartButtons(app, () => viewOutlet(id));
  }

  async function viewSubmit() {
    const ids = cart.ids();
    const outlets = (await Promise.all(ids.map((id) => api('GET', `/api/outlets/${encodeURIComponent(id)}`).catch(() => null)))).filter(Boolean);
    if (outlets.length !== ids.length) storage.set('cart', outlets.map((o) => o.id));
    updateCartBadge();
    const profile = storage.get('artistProfile', {});
    const hasKey = Boolean(storage.get('artistKey'));
    if (!outlets.length) {
      app.innerHTML = `<h1>Wyślij utwór</h1><div class="empty">Nie wybrano żadnych miejsc.<br><br><a class="btn primary" href="#/dopasuj">Dopasuj miejsca</a> <a class="btn" href="#/katalog">Przeglądaj katalog</a></div>`;
      return;
    }
    const fees = outlets.filter((o) => o.collaboration.model === 'fee').reduce((a, o) => a + o.collaboration.feePLN, 0);
    app.innerHTML = `
      <h1>Wyślij utwór</h1>
      <div class="panel">
        <h3>Wybrane miejsca (${outlets.length})</h3>
        ${outlets.map((o) => `
          <div class="sub-head sub">
            <div><b>${esc(o.name)}</b> <span class="muted small">${esc(META.types[o.type])}</span><br><span class="muted small">${esc(o.collaboration.terms || META.models[o.collaboration.model].description)}</span></div>
            <div>${modelBadge(o.collaboration)} <button class="btn small ghost" data-cart="${esc(o.id)}">Usuń</button></div>
          </div>`).join('')}
        <p class="muted">Koszt z góry: <b>${pln(fees)}</b>${fees ? ' (opłaty za odsłuch)' : ''}. Prowizje naliczane są wyłącznie od przychodów z utworu po jego umieszczeniu i tylko w okresie umowy.</p>
      </div>
      <form class="form" id="sf">
        <div class="row">
          <div class="field"><label>Artysta / zespół *</label><input name="artistName" required maxlength="120" value="${esc(profile.artistName)}"></div>
          <div class="field"><label>E-mail *</label><input name="artistEmail" type="email" required value="${esc(profile.artistEmail)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Tytuł utworu *</label><input name="trackTitle" required maxlength="160"></div>
          <div class="field"><label>Gatunek</label><select name="genre">${options(META.genres, storage.get('matchGenre', ''), '—')}</select></div>
        </div>
        <div class="field"><label>Link do utworu (Spotify, YouTube, SoundCloud, prywatny link) *</label><input name="trackUrl" type="url" required placeholder="https://"></div>
        <div class="field"><label>Data premiery</label><input name="releaseDate" type="date"></div>
        <div class="field"><label>Wiadomość do kuratorów</label><textarea name="message" maxlength="2000" placeholder="Kilka zdań o utworze, inspiracjach i dotychczasowych sukcesach."></textarea></div>
        <label class="check"><input type="checkbox" name="acceptTerms" required> Akceptuję warunki współpracy wybranych miejsc i zobowiązuję się rzetelnie raportować przychody w okresie umów prowizyjnych.</label>
        ${hasKey ? '<label class="check"><input type="checkbox" name="useKey" checked> Dodaj do mojego istniejącego panelu artysty</label>' : ''}
        <button class="btn primary" type="submit">Wyślij do ${outlets.length} ${outlets.length === 1 ? 'miejsca' : 'miejsc'}</button>
      </form>`;
    bindCartButtons(app, viewSubmit);
    onSubmit(document.getElementById('sf'), async (d) => {
      const body = { ...d, outletIds: outlets.map((o) => o.id), acceptTerms: d.acceptTerms === 'on' };
      if (d.useKey === 'on') body.artistKey = storage.get('artistKey');
      delete body.useKey;
      const r = await api('POST', '/api/submissions', body);
      storage.set('artistKey', r.artistKey);
      storage.set('artistProfile', { artistName: d.artistName, artistEmail: d.artistEmail });
      cart.clear();
      app.innerHTML = `
        <h1>Wysłano! 🎉</h1>
        <div class="notice ok">Utwór trafił do ${r.submissions.length} ${r.submissions.length === 1 ? 'miejsca' : 'miejsc'}.${r.skipped.length ? ` Pominięto: ${esc(r.skipped.map((s) => s.reason).join(' '))}` : ''}</div>
        <div class="notice warn"><b>Zapisz swój klucz artysty.</b> To jedyny sposób dostępu do panelu z innego urządzenia:<br><br><span class="key">${esc(r.artistKey)}</span></div>
        <a class="btn primary" href="#/artysta">Przejdź do panelu artysty</a>`;
    });
  }

  function statusBadge(s) {
    return `<span class="status st-${esc(s)}">${esc(META.statuses[s] || s)}</span>`;
  }

  function revenueTable(sub, { curatorKey } = {}) {
    if (!sub.revenue.length) return '<p class="muted small">Brak zgłoszonych przychodów.</p>';
    return `<table class="rev"><thead><tr><th>Okres</th><th>Przychód</th><th>Prowizja</th><th>Status</th></tr></thead><tbody>
      ${sub.revenue.map((r) => `<tr>
        <td>${esc(r.period)}</td><td>${pln(r.amountPLN)}</td>
        <td>${r.inAgreement ? pln(r.commissionPLN) : '<span class="muted">poza umową</span>'}</td>
        <td>${r.commissionPLN ? (r.paid ? '<span class="yes">opłacona</span>' : (curatorKey ? `<button class="btn small" data-paid="${esc(sub.id)}|${esc(r.id)}">Potwierdź wpłatę</button>` : 'do zapłaty')) : '—'}</td>
      </tr>`).join('')}
    </tbody></table>`;
  }

  async function viewArtist() {
    const key = storage.get('artistKey');
    if (!key) {
      app.innerHTML = `
        <h1>Panel artysty</h1>
        <p class="muted">Wpisz klucz artysty otrzymany po pierwszym zgłoszeniu.</p>
        <form class="form" id="kf"><div class="field"><label>Klucz artysty</label><input name="key" required minlength="16"></div><button class="btn primary" type="submit">Zaloguj</button></form>
        <p class="muted">Nie masz klucza? <a href="#/dopasuj">Wyślij pierwszy utwór</a>.</p>`;
      onSubmit(document.getElementById('kf'), async (d) => {
        await api('GET', '/api/artist/submissions', null, { 'x-artist-key': d.key.trim() });
        storage.set('artistKey', d.key.trim());
        viewArtist();
      });
      return;
    }
    let subs;
    try {
      ({ submissions: subs } = await api('GET', '/api/artist/submissions', null, { 'x-artist-key': key }));
    } catch (e) {
      storage.del('artistKey');
      toast(e.message, true);
      return viewArtist();
    }
    const h = { 'x-artist-key': key };
    const placed = subs.filter((s) => ['accepted', 'scheduled', 'published'].includes(s.status)).length;
    const decided = subs.filter((s) => ['accepted', 'scheduled', 'published', 'rejected'].includes(s.status)).length;
    const due = subs.reduce((a, s) => a + s.settlement.duePLN, 0);
    const revenue = subs.reduce((a, s) => a + s.settlement.revenuePLN, 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    app.innerHTML = `
      <div class="sub-head"><h1>Panel artysty</h1><button class="btn small ghost" id="logout">Wyloguj</button></div>
      <div class="stats">
        <div class="stat"><b>${subs.length}</b><span>zgłoszeń</span></div>
        <div class="stat"><b>${placed}</b><span>umieszczeń</span></div>
        <div class="stat"><b>${decided ? Math.round((placed / decided) * 100) : 0}%</b><span>skuteczność</span></div>
        <div class="stat"><b>${pln(revenue)}</b><span>zgłoszone przychody</span></div>
        <div class="stat"><b>${pln(due)}</b><span>prowizje do zapłaty</span></div>
      </div>
      <details><summary>Pokaż mój klucz artysty</summary><p><span class="key">${esc(key)}</span></p></details><br>
      ${subs.map((s) => `
        <div class="sub">
          <div class="sub-head">
            <div><b>${esc(s.trackTitle)}</b> → <a href="#/miejsce/${esc(s.outletId)}">${esc(s.outletName)}</a> <span class="muted small">· ${date(s.createdAt)}</span></div>
            ${statusBadge(s.status)}
          </div>
          <p class="small">${modelBadge(s.agreement)} ${s.reviewFee ? `<span class="muted">opłata za odsłuch: ${pln(s.reviewFee.amountPLN)}</span>` : ''}</p>
          ${s.curatorNote ? `<p class="notice">💬 ${esc(s.curatorNote)}</p>` : ''}
          ${s.scheduledFor ? `<p class="small">📅 Planowana emisja: ${esc(s.scheduledFor)}</p>` : ''}
          ${s.placementUrl ? `<p class="small">🔗 <a href="${esc(s.placementUrl)}" target="_blank" rel="noopener noreferrer nofollow">Zobacz umieszczenie</a></p>` : ''}
          ${['new', 'listening'].includes(s.status) ? `<button class="btn small ghost" data-withdraw="${esc(s.id)}">Wycofaj zgłoszenie</button>` : ''}
          ${s.settlement.agreementTo ? `
            <p class="muted small">Umowa prowizyjna: ${esc(s.settlement.agreementFrom)} – ${esc(s.settlement.agreementTo)} · ${s.agreement.ratePercent}% przychodów</p>
            ${revenueTable(s)}
            <form class="inline-form" data-rev="${esc(s.id)}">
              <div class="field"><label>Miesiąc</label><input name="period" type="month" required value="${thisMonth}"></div>
              <div class="field"><label>Przychód z utworu (zł)</label><input name="amountPLN" type="number" min="0" step="0.01" required></div>
              <div class="field"><label>Uwagi</label><input name="note" maxlength="500" placeholder="np. Spotify + YouTube"></div>
              <button class="btn" type="submit">Zgłoś przychód</button>
            </form>` : ''}
        </div>`).join('')}`;
    document.getElementById('logout').addEventListener('click', () => { storage.del('artistKey'); viewArtist(); });
    app.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Wycofać zgłoszenie?')) return;
      try { await api('PATCH', `/api/submissions/${b.dataset.withdraw}`, { status: 'withdrawn' }, h); viewArtist(); } catch (e) { toast(e.message, true); }
    }));
    app.querySelectorAll('form[data-rev]').forEach((f) => onSubmit(f, async (d) => {
      const r = await api('POST', `/api/submissions/${f.dataset.rev}/revenue`, d, h);
      toast(r.entry.inAgreement ? `Prowizja do zapłaty: ${pln(r.entry.commissionPLN)}` : 'Okres poza umową – bez prowizji.');
      viewArtist();
    }));
  }

  function outletFormFields(o = {}) {
    const c = o.collaboration || { model: 'commission', ratePercent: 10, durationMonths: 6 };
    return `
      <div class="row">
        <div class="field"><label>Nazwa *</label><input name="name" required maxlength="120" value="${esc(o.name)}"></div>
        <div class="field"><label>Typ *</label><select name="type" required>${options(META.types, o.type || 'playlist')}</select></div>
      </div>
      <div class="row">
        <div class="field"><label>Link (playlista, stacja, kanał) *</label><input name="url" type="url" required value="${esc(o.url)}"></div>
        <div class="field"><label>E-mail kontaktowy *</label><input name="contactEmail" type="email" required value="${esc(o.contactEmail)}"></div>
      </div>
      <div class="row">
        <div class="field"><label>Zasięg (obserwujący / słuchacze)</label><input name="reach" type="number" min="0" value="${esc(o.reach ?? '')}"></div>
        <div class="field"><label>Termin odpowiedzi (dni)</label><input name="responseDays" type="number" min="1" max="90" value="${esc(o.responseDays ?? 7)}"></div>
      </div>
      <div class="row">
        <div class="field"><label>Kraj</label><input name="country" maxlength="60" value="${esc(o.country)}"></div>
        <div class="field"><label>Język</label><input name="language" maxlength="60" value="${esc(o.language)}"></div>
      </div>
      <div class="field"><label>Gatunki (Ctrl/Cmd, aby zaznaczyć kilka; brak = wszystkie)</label>
        <select name="genres" multiple size="6">${META.genres.map((g) => `<option${(o.genres || []).includes(g) ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
      <div class="field"><label>Opis</label><textarea name="description" maxlength="2000">${esc(o.description)}</textarea></div>
      <fieldset>
        <legend>Warunki współpracy</legend>
        <div class="row">
          <div class="field"><label>Model</label><select name="model" id="modelSel">${options(META.models, c.model)}</select></div>
          <div class="field" data-for="percent"><label>Prowizja / udział (%)</label><input name="ratePercent" type="number" min="1" max="50" value="${esc(c.ratePercent || 10)}"></div>
        </div>
        <div class="row">
          <div class="field" data-for="percent"><label>Czas trwania umowy (mies.)</label><input name="durationMonths" type="number" min="1" max="36" value="${esc(c.durationMonths || 6)}"></div>
          <div class="field" data-for="fee"><label>Opłata za odsłuch (zł)</label><input name="feePLN" type="number" min="1" value="${esc(c.feePLN || 10)}"></div>
        </div>
        <div class="field"><label>Szczegółowe warunki</label><textarea name="terms" maxlength="2000">${esc(c.terms)}</textarea></div>
        <p class="hint muted small" id="modelDesc"></p>
        <p class="hint muted small">Platforma pobiera ${esc(META.platformFeePercent)}% z każdej prowizji i opłaty – resztę otrzymujesz Ty.</p>
      </fieldset>`;
  }

  function bindModelToggle(form) {
    const sel = form.querySelector('#modelSel');
    const sync = () => {
      const m = sel.value;
      form.querySelectorAll('[data-for=percent]').forEach((el) => { el.hidden = !['commission', 'revshare'].includes(m); });
      form.querySelectorAll('[data-for=fee]').forEach((el) => { el.hidden = m !== 'fee'; });
      form.querySelector('#modelDesc').textContent = META.models[m].description;
    };
    sel.addEventListener('change', sync);
    sync();
  }

  function outletPayload(form) {
    const d = formData(form);
    return {
      name: d.name, type: d.type, url: d.url, contactEmail: d.contactEmail,
      reach: d.reach || 0, responseDays: d.responseDays || 7, country: d.country, language: d.language,
      description: d.description,
      genres: [...form.querySelector('[name=genres]').selectedOptions].map((x) => x.value),
      collaboration: { model: d.model, ratePercent: d.ratePercent, durationMonths: d.durationMonths, feePLN: d.feePLN, terms: d.terms },
    };
  }

  async function viewCurator() {
    const session = storage.get('curator');
    if (session) return viewCuratorInbox(session);
    app.innerHTML = `
      <h1>Dla kuratorów, stacji i twórców</h1>
      <p class="lead muted">Masz playlistę, radio, kanał, bloga, podcast albo pulę DJ-ską? Dołącz i zarabiaj na promowaniu muzyki, którą naprawdę lubisz. Sam ustalasz model: prowizja od przychodów utworu, podział, opłata za odsłuch albo barter.</p>
      <div class="split">
        <div class="panel">
          <h2>Dodaj swoje miejsce</h2>
          <form class="form" id="of">${outletFormFields()}<button class="btn primary" type="submit">Dodaj do katalogu</button></form>
        </div>
        <div class="panel">
          <h2>Mam już konto</h2>
          <form class="form" id="lf">
            <div class="field"><label>ID miejsca</label><input name="id" required placeholder="out_…"></div>
            <div class="field"><label>Klucz kuratora</label><input name="key" required></div>
            <button class="btn" type="submit">Otwórz skrzynkę zgłoszeń</button>
          </form>
        </div>
      </div>`;
    const of = document.getElementById('of');
    bindModelToggle(of);
    onSubmit(of, async () => {
      const r = await api('POST', '/api/outlets', outletPayload(of));
      storage.set('curator', { id: r.outlet.id, key: r.manageKey });
      app.innerHTML = `
        <h1>Witamy w Promo Hub! 🎧</h1>
        <div class="notice ok">„${esc(r.outlet.name)}” jest już w katalogu. Po weryfikacji otrzyma odznakę ✔ i wyższą pozycję w rankingu.</div>
        <div class="notice warn"><b>Zapisz dane dostępowe:</b><br>ID: <span class="key">${esc(r.outlet.id)}</span><br><br>Klucz kuratora: <span class="key">${esc(r.manageKey)}</span></div>
        <a class="btn primary" href="#/kurator">Przejdź do skrzynki zgłoszeń</a>`;
    });
    onSubmit(document.getElementById('lf'), async (d) => {
      const s = { id: d.id.trim(), key: d.key.trim() };
      await api('GET', `/api/outlets/${encodeURIComponent(s.id)}/submissions`, null, { 'x-manage-key': s.key });
      storage.set('curator', s);
      viewCurator();
    });
  }

  async function viewCuratorInbox(session) {
    const h = { 'x-manage-key': session.key };
    let d;
    try {
      d = await api('GET', `/api/outlets/${encodeURIComponent(session.id)}/submissions`, null, h);
    } catch (e) {
      storage.del('curator');
      toast(e.message, true);
      return viewCurator();
    }
    const { outlet, submissions, totals } = d;
    const fee = META.platformFeePercent / 100;
    const open = submissions.filter((s) => ['new', 'listening'].includes(s.status));
    app.innerHTML = `
      <div class="sub-head"><h1>${esc(outlet.name)}</h1><span><a class="btn small" href="#/miejsce/${esc(outlet.id)}">Profil publiczny</a> <button class="btn small ghost" id="logout">Wyloguj</button></span></div>
      <div class="stats">
        <div class="stat"><b>${open.length}</b><span>czeka na decyzję</span></div>
        <div class="stat"><b>${outlet.stats.acceptanceRate ?? '—'}${outlet.stats.acceptanceRate !== null ? '%' : ''}</b><span>akceptacji</span></div>
        <div class="stat"><b>${outlet.stats.responseRate ?? '—'}${outlet.stats.responseRate !== null ? '%' : ''}</b><span>odpowiedzi w terminie</span></div>
        <div class="stat"><b>${pln(totals.commissionPLN * (1 - fee))}</b><span>Twoje zarobki (netto)</span></div>
        <div class="stat"><b>${pln(totals.duePLN * (1 - fee))}</b><span>oczekuje na wpłatę</span></div>
      </div>
      <label class="check"><input type="checkbox" id="acceptToggle" ${outlet.acceptsSubmissions ? 'checked' : ''}> Przyjmuję nowe zgłoszenia</label>
      <details><summary>Edytuj profil i warunki</summary><div class="panel"><form class="form" id="ef">${outletFormFields(outlet)}<button class="btn primary" type="submit">Zapisz</button></form></div></details>
      <br>
      <h2>Zgłoszenia</h2>
      ${submissions.length ? '' : '<div class="empty">Brak zgłoszeń. Uzupełnij gatunki i opis, aby lepiej trafiać do artystów.</div>'}
      ${submissions.map((s) => {
        const next = META.transitions[s.status] || [];
        const deadline = new Date(Date.parse(s.createdAt) + (outlet.responseDays || 7) * 864e5);
        return `
        <div class="sub">
          <div class="sub-head">
            <div><b>${esc(s.artistName)} – ${esc(s.trackTitle)}</b> <span class="muted small">${esc(s.genre)} · ${date(s.createdAt)}</span></div>
            ${statusBadge(s.status)}
          </div>
          <p><a href="${esc(s.trackUrl)}" target="_blank" rel="noopener noreferrer nofollow">▶ Odsłuchaj</a> · <a href="mailto:${esc(s.artistEmail)}">${esc(s.artistEmail)}</a>${s.releaseDate ? ` · premiera ${esc(s.releaseDate)}` : ''}</p>
          ${s.message ? `<p class="muted">${esc(s.message)}</p>` : ''}
          ${['new', 'listening'].includes(s.status) ? `<p class="small" >⏳ Odpowiedz do ${deadline.toLocaleDateString('pl-PL')}, inaczej zgłoszenie wygaśnie.</p>` : ''}
          ${next.length ? `
            <form class="inline-form" data-sub="${esc(s.id)}">
              <div class="field"><label>Decyzja</label><select name="status">${next.map((n) => `<option value="${esc(n)}">${esc(META.statuses[n])}</option>`).join('')}</select></div>
              <div class="field"><label>Termin emisji</label><input name="scheduledFor" type="date" value="${esc(s.scheduledFor)}"></div>
              <div class="field"><label>Link do umieszczenia</label><input name="placementUrl" type="url" value="${esc(s.placementUrl)}" placeholder="https://"></div>
              <div class="field"><label>Feedback dla artysty</label><input name="curatorNote" maxlength="2000" value="${esc(s.curatorNote)}"></div>
              <button class="btn primary" type="submit">Zapisz</button>
            </form>` : (s.curatorNote ? `<p class="small">💬 ${esc(s.curatorNote)}</p>` : '')}
          ${s.settlement.agreementTo ? `<p class="muted small">Umowa: ${esc(s.settlement.agreementFrom)} – ${esc(s.settlement.agreementTo)}, ${s.agreement.ratePercent}%</p>${revenueTable(s, { curatorKey: session.key })}` : ''}
        </div>`;
      }).join('')}`;

    document.getElementById('logout').addEventListener('click', () => { storage.del('curator'); viewCurator(); });
    document.getElementById('acceptToggle').addEventListener('change', async (e) => {
      try { await api('PATCH', `/api/outlets/${outlet.id}`, { acceptsSubmissions: e.target.checked }, h); toast('Zapisano.'); } catch (err) { toast(err.message, true); }
    });
    const ef = document.getElementById('ef');
    bindModelToggle(ef);
    onSubmit(ef, async () => { await api('PATCH', `/api/outlets/${outlet.id}`, outletPayload(ef), h); toast('Zapisano profil. Nowe warunki dotyczą tylko nowych zgłoszeń.'); viewCuratorInbox(session); });
    app.querySelectorAll('form[data-sub]').forEach((f) => onSubmit(f, async (d) => {
      await api('PATCH', `/api/submissions/${f.dataset.sub}`, d, h);
      toast('Zapisano decyzję.');
      viewCuratorInbox(session);
    }));
    app.querySelectorAll('[data-paid]').forEach((b) => b.addEventListener('click', async () => {
      const [sid, rid] = b.dataset.paid.split('|');
      try { await api('PATCH', `/api/submissions/${sid}/revenue/${rid}`, { paid: true }, h); viewCuratorInbox(session); } catch (e) { toast(e.message, true); }
    }));
  }

  async function viewAdmin() {
    const token = storage.get('adminToken');
    if (!token) {
      app.innerHTML = `<h1>Panel administratora</h1><form class="form" id="af"><div class="field"><label>Token administratora</label><input name="token" type="password" required></div><button class="btn primary" type="submit">Zaloguj</button></form>`;
      onSubmit(document.getElementById('af'), async (d) => {
        await api('GET', '/api/admin/summary', null, { 'x-admin-token': d.token });
        storage.set('adminToken', d.token);
        viewAdmin();
      });
      return;
    }
    const h = { 'x-admin-token': token };
    let s;
    try { s = await api('GET', '/api/admin/summary', null, h); } catch (e) { storage.del('adminToken'); toast(e.message, true); return viewAdmin(); }
    app.innerHTML = `
      <div class="sub-head"><h1>Panel administratora</h1><button class="btn small ghost" id="logout">Wyloguj</button></div>
      <h2>Twoje zarobki (prowizja platformy ${esc(s.platformFeePercent)}%)</h2>
      <div class="stats">
        <div class="stat"><b>${pln(s.earnings.totalPLN)}</b><span>łącznie naliczone</span></div>
        <div class="stat"><b>${pln(s.earnings.fromCommissionsPLN)}</b><span>z prowizji</span></div>
        <div class="stat"><b>${pln(s.earnings.fromReviewFeesPLN)}</b><span>z opłat za odsłuch</span></div>
        <div class="stat"><b>${pln(s.earnings.duePLN)}</b><span>do pobrania</span></div>
      </div>
      <h2>Do weryfikacji (${s.pendingVerification.length})</h2>
      ${s.pendingVerification.length ? s.pendingVerification.map((o) => `
        <div class="sub sub-head">
          <div><b>${esc(o.name)}</b> <span class="muted small">${esc(META.types[o.type])} · ${num(o.reach)} · ${esc(o.contactEmail)}</span><br><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(o.url)}</a></div>
          <span><button class="btn small primary" data-verify="${esc(o.id)}">Zweryfikuj</button> <button class="btn small ghost" data-del="${esc(o.id)}">Usuń</button></span>
        </div>`).join('') : '<p class="muted">Wszystko zweryfikowane.</p>'}
      <h2>Najskuteczniejsze miejsca</h2>
      <div class="panel table-wrap"><table class="compare"><thead><tr><th>Miejsce</th><th>Zgłoszenia</th><th>Umieszczenia</th><th>Akceptacja</th><th>Odpowiedzi</th></tr></thead><tbody>
        ${s.topOutlets.map((o) => `<tr><td><a href="#/miejsce/${esc(o.id)}">${esc(o.name)}</a></td><td>${o.submissions}</td><td>${o.placed}</td><td>${o.acceptanceRate ?? '—'}</td><td>${o.responseRate ?? '—'}</td></tr>`).join('')}
      </tbody></table></div>`;
    document.getElementById('logout').addEventListener('click', () => { storage.del('adminToken'); viewAdmin(); });
    app.querySelectorAll('[data-verify]').forEach((b) => b.addEventListener('click', async () => {
      try { await api('PATCH', `/api/outlets/${b.dataset.verify}`, { verified: true }, h); viewAdmin(); } catch (e) { toast(e.message, true); }
    }));
    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Usunąć to miejsce z katalogu?')) return;
      try { await api('DELETE', `/api/outlets/${b.dataset.del}`, null, h); viewAdmin(); } catch (e) { toast(e.message, true); }
    }));
  }

  // ---------- router ----------
  const routes = [
    [/^#?\/?$/, viewHome],
    [/^#\/katalog$/, viewCatalog],
    [/^#\/dopasuj$/, viewMatch],
    [/^#\/miejsce\/([\w-]+)$/, viewOutlet],
    [/^#\/wyslij$/, viewSubmit],
    [/^#\/artysta$/, viewArtist],
    [/^#\/kurator$/, viewCurator],
    [/^#\/admin$/, viewAdmin],
  ];

  async function route() {
    const hash = location.hash || '#/';
    document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', hash.startsWith(a.getAttribute('href'))));
    document.getElementById('nav').classList.remove('open');
    const match = routes.find(([re]) => re.test(hash));
    if (!match) { app.innerHTML = '<div class="empty">Nie znaleziono strony. <a href="#/">Strona główna</a></div>'; return; }
    try {
      await match[1](...hash.match(match[0]).slice(1));
      app.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } catch (e) {
      app.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  }

  document.getElementById('menuBtn').addEventListener('click', (e) => {
    const nav = document.getElementById('nav');
    nav.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', nav.classList.contains('open'));
  });

  (async () => {
    META = await api('GET', '/api/meta');
    updateCartBadge();
    window.addEventListener('hashchange', route);
    route();
  })().catch((e) => { app.innerHTML = `<div class="empty">Nie udało się połączyć z serwerem: ${esc(e.message)}</div>`; });
})();
