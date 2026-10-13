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
        <div class="muted small">dla: ${o.creatorTypes.map((c) => esc(META.creators[c]?.label || c)).join(', ')}</div>
        <div>${o.verified ? '<span class="verified">✔ zweryfikowany</span>' : '<span class="muted small">niezweryfikowany</span>'} ${o.sample ? '<span class="sample">· przykład</span>' : ''} ${(o.minLevel || 1) > 1 ? `<span class="tag">🔒 od poziomu ${o.minLevel}</span>` : ''}</div>
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

  // ---------- typ twórcy (muzyk / DJ / pisarz) ----------
  const creator = {
    get() { const c = storage.get('creatorType', 'music'); return META.creators[c] ? c : 'music'; },
    set(c) { if (META.creators[c]) storage.set('creatorType', c); },
    info(c) { return META.creators[c || this.get()]; },
  };
  const creatorSelect = (selected = creator.get()) => `<select name="creatorType" data-creator>${options(META.creators, selected)}</select>`;
  const genreOptions = (ct, selected = '', empty = null) => options(META.creators[ct].genres, selected, empty);

  // ---------- widoki ----------
  async function viewHome() {
    const s = await api('GET', '/api/stats');
    app.innerHTML = `
      <section class="hero">
        <h1>Z anonimowego debiutanta w <span class="grad">twórcę, którego zna świat</span>.</h1>
        <p class="lead">Dla muzyków, DJ-ów i pisarzy. Promo Hub gra jak orkiestra: playlisty, radia, YouTube, TikTok i BookTok, blogi, podcasty, magazyny, DJ-e, kluby, festiwale, wydawcy i sync – zsynchronizowane przez Master Dyrygenta od A do Z. Płacisz za efekt: w modelu prowizyjnym kurator zarabia dopiero wtedy, gdy Twoje dzieło zarabia.</p>
        <div class="tags creators-row">${Object.values(META.creators).map((c) => `<span class="tag">${esc(c.label)}</span>`).join('')}</div>
        <div class="cta-row">
          <a class="btn primary" href="#/kampania">🎼 Uruchom kampanię – od 0 zł</a>
          <a class="btn" href="#/artysta">Sprawdź swój poziom</a>
          <a class="btn" href="#/kurator">Dodaj swoją playlistę lub radio</a>
        </div>
      </section>
      <div class="stats">
        <div class="stat"><b>${num(s.outlets)}</b><span>miejsc promocji</span></div>
        <div class="stat"><b>${num(s.totalReach)}</b><span>łączny zasięg</span></div>
        <div class="stat"><b>${num(s.submissions)}</b><span>zgłoszonych dzieł</span></div>
        <div class="stat"><b>${num(s.placed)}</b><span>umieszczeń</span></div>
      </div>
      <h2>Ścieżka artysty: 5 poziomów</h2>
      <div class="levels big">
        <div class="lvl"><b>1</b><span>Debiutant</span><small>profil, press kit, pierwsze umieszczenia</small></div>
        <div class="lvl"><b>2</b><span>Lokalny</span><small>radia regionalne, podcasty, pierwsze playlisty</small></div>
        <div class="lvl"><b>3</b><span>Krajowy</span><small>YouTube, TikTok, blogi, duże playlisty</small></div>
        <div class="lvl"><b>4</b><span>Międzynarodowy</span><small>zagraniczne playlisty i radia, sync, festiwale</small></div>
        <div class="lvl"><b>5</b><span>Globalny</span><small>6+ krajów, featuringi, własna audycja</small></div>
      </div>
      <p class="muted">Każdy poziom ma mierzalne cele liczone z prawdziwych umieszczeń – i konkretny plan kolejnych kroków.</p>
      <h2>Jak to działa</h2>
      <div class="steps">
        <div class="step"><h3>Dyrygent dobiera orkiestrę</h3><p class="muted">Podajesz utwór, datę premiery i budżet (także 0 zł). System wybiera najlepsze miejsca z każdej sekcji: radio, playlisty, video, media, DJ-e.</p></div>
        <div class="step"><h3>Fale w idealnym momencie</h3><p class="muted">Radio 6 tygodni przed premierą, media 3 tygodnie, twórcy 2 tygodnie, playlisty w dniu premiery – wysyłane automatycznie, z osobistym pitchem do każdego kuratora.</p></div>
        <div class="step"><h3>Gwarancja odpowiedzi</h3><p class="muted">Kurator ma ustalony termin. Brak decyzji = zgłoszenie wygasa, a kurator spada w rankingu.</p></div>
        <div class="step"><h3>Rozliczenie od efektu</h3><p class="muted">Po umieszczeniu utworu zgłaszasz przychody, a system sam wylicza prowizję tylko za okres umowy.</p></div>
      </div>
      <h2>Dlaczego Promo Hub</h2>
      <div class="panel table-wrap">
        <table class="compare">
          <thead><tr><th></th><th>Promo Hub</th><th>Typowe serwisy płatnych zgłoszeń</th></tr></thead>
          <tbody>
            <tr><td>Master Dyrygent A–Z: 45–60 zadań w 9 fazach, od fundamentu po skalowanie</td><td class="yes">dla muzyków, DJ-ów i pisarzy</td><td class="no">pojedyncze usługi</td></tr>
            <tr><td>Symulator kampanii (Monte Carlo) – rozkład wyników i szansa awansu przed startem</td><td class="yes">tak</td><td class="no">—</td></tr>
            <tr><td>Autopilot kariery – zawsze wiesz, jaki ruch da teraz najwięcej</td><td class="yes">tak</td><td class="no">—</td></tr>
            <tr><td>Światowa Baza Podmiotów – radia, media, festiwale, wydawcy, sync z wielu krajów</td><td class="yes">w planie Dyrygenta</td><td class="no">—</td></tr>
            <tr><td>Dyrygent kampanii: jedna premiera, wszystkie media, fale w optymalnym czasie</td><td class="yes">automatycznie</td><td class="no">ręcznie, zgłoszenie po zgłoszeniu</td></tr>
            <tr><td>Efekt domina: akceptacja automatycznie otwiera większe miejsca</td><td class="yes">tak, z dowodem społecznym w pitchu</td><td class="no">—</td></tr>
            <tr><td>Pula Efektu: łączna prowizja utworu ograniczona limitem</td><td class="yes">tak, maks. ${esc(META.trackCommissionCapPercent)}% niezależnie od liczby kuratorów</td><td class="no">—</td></tr>
            <tr><td>Ścieżka artysty i Drabina dostępu</td><td class="yes">5 poziomów, mierzalne cele, plan kroków</td><td class="no">—</td></tr>
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
    const ct = creator.get();
    if (f.genre && !META.creators[ct].genres.includes(f.genre)) f.genre = '';
    app.innerHTML = `
      <h1>Katalog miejsc promocji</h1>
      <p class="muted">Playlisty, radia, kanały, blogi, magazyny, podcasty, DJ-e, wydawcy i więcej. Zaznacz miejsca i wyślij do nich swoje dzieło jednym zgłoszeniem.</p>
      <form class="filters" id="filters">
        <input name="q" placeholder="Szukaj: nazwa, opis, kraj…" value="${esc(f.q)}">
        ${creatorSelect(ct)}
        <select name="type">${options(META.types, f.type, 'Wszystkie typy')}</select>
        <select name="genre">${genreOptions(ct, f.genre, 'Wszystkie gatunki')}</select>
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
      const qs = new URLSearchParams({ ...state, creator: d.creatorType, open: state.open ? '1' : '' });
      const { outlets } = await api('GET', `/api/outlets?${qs}`);
      const render = () => {
        results.innerHTML = outlets.length ? `<div class="grid">${outlets.map(outletCard).join('')}</div>` : '<div class="empty">Brak wyników – zmień filtry.</div>';
        bindCartButtons(results, render);
        const n = cart.ids().length;
        document.getElementById('cartCta').innerHTML = n ? `<a class="btn primary" href="#/wyslij">Wyślij do wybranych (${n}) →</a>` : '';
      };
      render();
    }
    let t;
    form.addEventListener('input', (e) => {
      if (e.target.name === 'creatorType') { creator.set(e.target.value); viewCatalog(); return; }
      clearTimeout(t);
      t = setTimeout(() => load().catch((err) => toast(err.message, true)), 200);
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    await load();
  }

  async function viewMatch() {
    const ct = creator.get();
    const saved = storage.get('matchGenre', '');
    const last = META.creators[ct].genres.includes(saved) ? saved : '';
    app.innerHTML = `
      <h1>Dopasuj miejsca do swojego dzieła</h1>
      <p class="muted">Ranking 0–100 uwzględnia zgodność gatunku, skuteczność kuratora (% akceptacji), rzetelność (% odpowiedzi w terminie), weryfikację, zasięg i to, czy płacisz z góry.</p>
      <form class="filters" id="mf">
        ${creatorSelect(ct)}
        <select name="genre" required>${genreOptions(ct, last, 'Wybierz gatunek')}</select>
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
      const { outlets } = await api('GET', `/api/match?${new URLSearchParams({ genre: d.genre, type: d.type, model: d.model, creator: d.creatorType })}`);
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
    form.querySelector('[data-creator]').addEventListener('change', (e) => { creator.set(e.target.value); viewMatch(); });
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
    const ct = creator.get();
    const ci = creator.info(ct);
    app.innerHTML = `
      <h1>Wyślij: ${esc(ci.work)}</h1>
      <div class="panel">
        <h3>Wybrane miejsca (${outlets.length})</h3>
        ${outlets.map((o) => `
          <div class="sub-head sub">
            <div><b>${esc(o.name)}</b> <span class="muted small">${esc(META.types[o.type])}</span><br><span class="muted small">${esc(o.collaboration.terms || META.models[o.collaboration.model].description)}</span></div>
            <div>${modelBadge(o.collaboration)} <button class="btn small ghost" data-cart="${esc(o.id)}">Usuń</button></div>
          </div>`).join('')}
        <p class="muted">Koszt z góry: <b>${pln(fees)}</b>${fees ? ' (opłaty za odsłuch)' : ''}. Prowizje naliczane są wyłącznie od przychodów z dzieła po jego umieszczeniu i tylko w okresie umowy.</p>
      </div>
      <form class="form" id="sf">
        <div class="row">
          <div class="field"><label>Artysta / zespół *</label><input name="artistName" required maxlength="120" value="${esc(profile.artistName)}"></div>
          <div class="field"><label>E-mail *</label><input name="artistEmail" type="email" required value="${esc(profile.artistEmail)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Typ twórcy</label>${creatorSelect(ct)}</div>
          <div class="field"><label>Gatunek</label><select name="genre">${genreOptions(ct, storage.get('matchGenre', ''), '—')}</select></div>
        </div>
        <div class="field"><label>Tytuł (${esc(ci.work)}) *</label><input name="trackTitle" required maxlength="160"></div>
        <div class="field"><label>Link (${esc(ci.workUrlHint)}) *</label><input name="trackUrl" type="url" required placeholder="https://"></div>
        <div class="field"><label>Data premiery</label><input name="releaseDate" type="date"></div>
        <div class="field"><label>Wiadomość do kuratorów</label><textarea name="message" maxlength="2000" placeholder="Kilka zdań o utworze, inspiracjach i dotychczasowych sukcesach."></textarea></div>
        <label class="check"><input type="checkbox" name="acceptTerms" required> Akceptuję warunki współpracy wybranych miejsc i zobowiązuję się rzetelnie raportować przychody w okresie umów prowizyjnych.</label>
        ${hasKey ? '<label class="check"><input type="checkbox" name="useKey" checked> Dodaj do mojego istniejącego panelu artysty</label>' : ''}
        <button class="btn primary" type="submit">Wyślij do ${outlets.length} ${outlets.length === 1 ? 'miejsca' : 'miejsc'}</button>
      </form>`;
    bindCartButtons(app, viewSubmit);
    app.querySelector('#sf [data-creator]').addEventListener('change', (e) => { creator.set(e.target.value); viewSubmit(); });
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
        <div class="notice ok">Zgłoszenie trafiło do ${r.submissions.length} ${r.submissions.length === 1 ? 'miejsca' : 'miejsc'}.${r.skipped.length ? ` Pominięto: ${esc(r.skipped.map((s) => s.reason).join(' '))}` : ''}</div>
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
        <td>${r.inAgreement ? `${pln(r.commissionPLN)}${r.poolSize > 1 ? ` <span class="muted small">(Pula: ${esc(r.effectiveRatePercent)}%, ${r.poolSize} kuratorów)</span>` : ''}` : '<span class="muted">poza umową</span>'}</td>
        <td>${r.commissionPLN ? (r.paid ? '<span class="yes">opłacona</span>' : (curatorKey ? `<button class="btn small" data-paid="${esc(sub.id)}|${esc(r.id)}">Potwierdź wpłatę</button>` : 'do zapłaty')) : '—'}</td>
      </tr>`).join('')}
    </tbody></table>`;
  }

  // ---------- kalendarz (.ics) ----------
  function downloadIcs(campaign) {
    const d = (iso) => iso.replace(/-/g, '');
    const escIcs = (t) => String(t).replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
    const events = [
      ...campaign.waves.map((w, i) => ({ uid: `${campaign.id}-w${i}`, date: w.date, title: `${w.name} (${w.outlets.length} miejsc)`, desc: w.how })),
      ...campaign.tasks.map((t) => ({ uid: `${campaign.id}-${t.id}`, date: t.date, title: t.name, desc: `${t.how} ${t.url}` })),
    ];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Promo Hub//Kampania//PL', 'CALSCALE:GREGORIAN'];
    const stamp = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
    for (const e of events) {
      const next = new Date(Date.parse(`${e.date}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
      lines.push('BEGIN:VEVENT', `UID:${e.uid}@promohub`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d(e.date)}`,
        `DTEND;VALUE=DATE:${d(next)}`, `SUMMARY:${escIcs(`[${campaign.trackTitle}] ${e.title}`)}`, `DESCRIPTION:${escIcs(e.desc)}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
    a.download = `kampania-${campaign.trackTitle.replace(/[^\w-]+/g, '_')}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- generator pitchu ----------
  function generatePitch(d, profile) {
    const genre = d.genre || 'mój gatunek';
    if (d.creatorType === 'writer') {
      const whenW = d.releaseDate ? ` Premiera: ${new Date(`${d.releaseDate}T00:00:00Z`).toLocaleDateString('pl-PL')}.` : '';
      const achW = profile && profile.achievements ? `\n\nO mnie: ${profile.achievements}` : '';
      return `Dzień dobry {nazwa}!\n\nNazywam się ${d.artistName || '[autor]'} i piszę (${genre}). Śledzę Państwa recenzje i polecenia ({gatunki}) i myślę, że moja książka „${d.trackTitle || '[tytuł]'}” może zainteresować Państwa odbiorców.${whenW} Chętnie prześlę egzemplarz recenzencki (e-book lub papier).${achW}\n\nDziękuję za uwagę i pozdrawiam serdecznie!`;
    }
    const when = d.releaseDate ? ` Premiera: ${new Date(`${d.releaseDate}T00:00:00Z`).toLocaleDateString('pl-PL')}.` : '';
    const ach = profile && profile.achievements ? `\n\nDotychczas: ${profile.achievements}` : '';
    return `Cześć {nazwa}!\n\nJestem ${d.artistName || '[artysta]'} i tworzę ${genre}. Śledzę Twoje wybory ({gatunki}) i myślę, że „${d.trackTitle || '[tytuł]'}” pasuje do tego, co prezentujesz.${when}${ach}\n\nDzięki za odsłuch – każdy feedback jest dla mnie cenny!`;
  }

  function simulationView(sim) {
    if (!sim || !sim.runs) return '';
    return `
      <div class="panel sim">
        <h3>🎲 Symulator kampanii <span class="muted small">${num(sim.runs)} symulacji Monte Carlo na realnych wskaźnikach kuratorów</span></h3>
        <div class="sim-grid">
          <div><span class="muted small">Scenariusz ostrożny (p10)</span><b>${num(sim.placements.p10)} umieszczeń</b><span class="muted small">zasięg ${num(sim.reach.p10)}</span></div>
          <div class="sim-mid"><span class="muted small">Najbardziej prawdopodobny (p50)</span><b>${num(sim.placements.p50)} umieszczeń</b><span class="muted small">zasięg ${num(sim.reach.p50)}</span></div>
          <div><span class="muted small">Optymistyczny (p90)</span><b>${num(sim.placements.p90)} umieszczeń</b><span class="muted small">zasięg ${num(sim.reach.p90)}</span></div>
        </div>
        <div class="tags">
          <span class="tag">min. 1 umieszczenie: ${sim.chance.atLeast1}%</span>
          <span class="tag">min. 3: ${sim.chance.atLeast3}%</span>
          <span class="tag">min. 5: ${sim.chance.atLeast5}%</span>
          ${sim.levelUpChance !== null && sim.levelUpChance !== undefined ? `<span class="tag tag-ok">szansa awansu na poziom „${esc(sim.nextLevel || '')}”: ${sim.levelUpChance}%</span>` : ''}
        </div>
      </div>`;
  }

  function planView(plan, { forCampaign = null } = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const phases = plan.phases || [];
    const items = [
      ...plan.waves.map((w, i) => ({ kind: 'wave', i, date: w.date, phase: w.phase || 'E', w })),
      ...plan.tasks.map((t) => ({ kind: 'task', date: t.date, phase: t.phase || 'E', t })),
    ].sort((a, b) => a.phase.localeCompare(b.phase) || a.date.localeCompare(b.date));
    const byPhase = {};
    for (const e of items) (byPhase[e.phase] = byPhase[e.phase] || []).push(e);
    const doneCount = plan.tasks.filter((t) => t.done).length;
    const item = (e) => (e.kind === 'wave' ? `
          <div class="tl tl-wave${e.w.domino ? ' tl-domino' : ''}${e.w.sent ? ' done' : ''}">
            <div class="tl-date">${esc(e.date)}</div>
            <div>
              <b>${e.w.domino ? '🁢' : '🎼'} ${esc(e.w.name)}</b> ${e.w.sent ? '<span class="yes small">wysłana</span>' : (forCampaign ? `<button class="btn small" data-send="${e.i}">Wyślij teraz</button>` : '<span class="muted small">wyśle się automatycznie</span>')}
              <div class="muted small">${esc(e.w.how)}</div>
              <div class="tags">${e.w.outlets.map((o) => `<a class="tag" href="#/miejsce/${esc(o.id)}">${esc(o.name)} · ${esc(META.models[o.model]?.label || '')}</a>`).join('')}</div>
            </div>
          </div>` : `
          <div class="tl${e.t.done ? ' done' : ''}${e.t.group === 'Baza światowa' ? ' tl-entity' : ''}${!e.t.done && e.date < today && forCampaign ? ' late' : ''}">
            <div class="tl-date">${esc(e.date)}${e.t.catchUp ? '<br><span class="small warn-text">do nadrobienia</span>' : ''}</div>
            <div>
              ${forCampaign ? `<label class="check"><input type="checkbox" data-task="${esc(e.t.id)}" ${e.t.done ? 'checked' : ''}> <b>${esc(e.t.name)}</b></label>` : `<b>${esc(e.t.name)}</b>`}
              <span class="tag">${esc(e.t.group)}</span>
              <div class="muted small">${esc(e.t.how)} ${e.t.url ? `<a href="${esc(e.t.url)}" target="_blank" rel="noopener noreferrer nofollow">otwórz ↗</a>` : ''}</div>
            </div>
          </div>`);
    return `
      <div class="stats">
        <div class="stat"><b>${plan.waves.reduce((a, w) => a + w.outlets.length, 0)}</b><span>miejsc w ${plan.waves.length} falach</span></div>
        <div class="stat"><b>${(plan.sections || []).length}</b><span>sekcji orkiestry</span></div>
        <div class="stat"><b>${plan.tasks.length}</b><span>zadań Planu A–Z${forCampaign ? ` (zrobione: ${doneCount})` : ''}</span></div>
        <div class="stat"><b>~${num(plan.forecast.reach)}</b><span>oczekiwany zasięg</span></div>
        <div class="stat"><b>${pln(plan.spentPLN)}</b><span>koszt z góry</span></div>
      </div>
      ${simulationView(plan.simulation)}
      ${(phases.length ? phases : [{ id: 'E', name: 'Plan', goal: '' }]).filter((ph) => byPhase[ph.id]).map((ph) => `
        <details class="phase" ${forCampaign ? '' : 'open'}>
          <summary><span class="phase-id">${esc(ph.id)}</span> <b>${esc(ph.name)}</b> <span class="muted small">${esc(ph.goal)} · ${byPhase[ph.id].length} pozycji</span></summary>
          <div class="timeline">${byPhase[ph.id].map(item).join('')}</div>
        </details>`).join('')}`;
  }

  async function viewCampaign() {
    const profile = storage.get('artistProfile', {});
    const key = storage.get('artistKey');
    let me = null;
    if (key) me = await api('GET', '/api/artist/me', null, { 'x-artist-key': key }).catch(() => null);
    const p = (me && me.profile) || {};
    const ct = storage.get('creatorType') ? creator.get() : (p.creatorType || creator.get());
    const ci = creator.info(ct);
    const releaseDefault = new Date(Date.now() + (ct === 'writer' ? 70 : 42) * 864e5).toISOString().slice(0, 10);
    const savedGenre = storage.get('matchGenre', '') || (p.genres || [])[0] || '';
    app.innerHTML = `
      <h1>🎼 Master Dyrygent</h1>
      <p class="lead muted">Jeden formularz, cała orkiestra od A do Z: dobór najlepszych miejsc w ramach budżetu, plan 45–60 zadań w 9 fazach (od fundamentu po skalowanie), oficjalne kanały, Światowa Baza Podmiotów, symulacja wyników i automatyczna wysyłka zgłoszeń falami w optymalnym momencie.</p>
      <form class="form" id="cf">
        <div class="field"><label>Kim jesteś?</label>${creatorSelect(ct)}</div>
        <div class="row">
          <div class="field"><label>Artysta *</label><input name="artistName" required value="${esc(p.name || profile.artistName)}"></div>
          <div class="field"><label>E-mail *</label><input name="artistEmail" type="email" required value="${esc(p.contactEmail || profile.artistEmail)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Tytuł (${esc(ci.work)}) *</label><input name="trackTitle" required maxlength="160"></div>
          <div class="field"><label>Gatunek *</label><select name="genre" required>${genreOptions(ct, ci.genres.includes(savedGenre) ? savedGenre : '', 'Wybierz')}</select></div>
        </div>
        <div class="field"><label>Link (${esc(ci.workUrlHint)}) *</label><input name="trackUrl" type="url" required placeholder="https://"></div>
        <div class="row">
          <div class="field"><label>Data premiery *</label><input name="releaseDate" type="date" required value="${releaseDefault}"><div class="hint">${ct === 'writer' ? 'Najlepiej 10 tygodni od dziś – zdążysz z egzemplarzami recenzenckimi.' : 'Najlepiej 6 tygodni od dziś – zdążysz z radiem i pitchem redakcyjnym.'} Zadania po terminie trafią na listę „do nadrobienia”.</div></div>
          <div class="field"><label>Budżet na opłaty za odsłuch (zł)</label><input name="budgetPLN" type="number" min="0" step="1" value="0"><div class="hint">0 zł = tylko prowizja, bezpłatne i barter. Płacisz za efekt.</div></div>
        </div>
        <div class="field"><label>Pitch do kuratorów <button class="btn small ghost" type="button" id="genPitch">✨ Wygeneruj</button></label>
          <textarea name="message" maxlength="2000" rows="7" placeholder="{nazwa} i {gatunki} zostaną podmienione dla każdego kuratora."></textarea></div>
        <div class="cta-row"><button class="btn" type="button" id="previewBtn">🎲 Pokaż plan A–Z i symulację</button></div>
        <div id="plan"></div>
        <label class="check"><input type="checkbox" name="acceptTerms" required> Akceptuję warunki współpracy miejsc z planu i zobowiązuję się raportować przychody w okresie umów prowizyjnych.</label>
        <button class="btn primary" type="submit">🚀 Uruchom kampanię</button>
      </form>`;
    const form = document.getElementById('cf');
    form.querySelector('[data-creator]').addEventListener('change', (e) => { creator.set(e.target.value); viewCampaign(); });
    document.getElementById('genPitch').addEventListener('click', () => {
      form.querySelector('[name=message]').value = generatePitch(formData(form), p);
    });
    const preview = async () => {
      const d = formData(form);
      if (!d.genre) throw new Error('Wybierz gatunek.');
      const plan = await api('POST', '/api/campaigns/preview', { creatorType: d.creatorType, genre: d.genre, releaseDate: d.releaseDate, budgetPLN: d.budgetPLN }, key ? { 'x-artist-key': key } : {});
      document.getElementById('plan').innerHTML = plan.waves.length
        ? `<div class="panel"><h2>Plan kampanii A–Z</h2>${planView(plan)}</div>`
        : '<div class="notice warn">Brak pasujących miejsc – zmień gatunek lub zwiększ budżet.</div>';
    };
    document.getElementById('previewBtn').addEventListener('click', () => preview().catch((e) => toast(e.message, true)));
    onSubmit(form, async (d) => {
      if (!d.message) d.message = generatePitch(d, p);
      const body = { ...d, acceptTerms: d.acceptTerms === 'on' };
      if (key) body.artistKey = key;
      const r = await api('POST', '/api/campaigns', body);
      storage.set('artistKey', r.artistKey);
      storage.set('artistProfile', { artistName: d.artistName, artistEmail: d.artistEmail });
      app.innerHTML = `
        <h1>Kampania wystartowała! 🎼</h1>
        <div class="notice ok">„${esc(r.campaign.trackTitle)}”: ${r.campaign.waves.length} fal, ${r.campaign.waves.reduce((a, w) => a + w.outlets.length, 0)} miejsc. ${r.campaign.results.sent ? `Pierwsze ${r.campaign.results.sent} zgłoszeń już wysłane.` : 'Pierwsza fala wyjdzie automatycznie w zaplanowanym terminie.'}</div>
        ${key ? '' : `<div class="notice warn"><b>Zapisz swój klucz artysty</b> – to dostęp do panelu z innego urządzenia:<br><br><span class="key">${esc(r.artistKey)}</span></div>`}
        <div class="cta-row"><a class="btn primary" href="#/artysta">Przejdź do panelu</a><button class="btn" id="ics">📅 Dodaj do kalendarza</button></div>`;
      document.getElementById('ics').addEventListener('click', () => downloadIcs(r.campaign));
    });
  }

  async function viewChannels() {
    const ct = creator.get();
    const groups = {};
    for (const c of META.channels.filter((x) => x.for.includes(ct))) (groups[c.group] = groups[c.group] || []).push(c);
    const { entities } = await api('GET', `/api/entities?creator=${encodeURIComponent(ct)}`);
    app.innerHTML = `
      <h1>Kanały promocji</h1>
      <p class="muted">Darmowe narzędzia platform i zweryfikowane podmioty ze Światowej Bazy, z których korzystasz równolegle z kampanią. Master Dyrygent wpisuje je automatycznie do Twojego Planu A–Z. Zasady platform się zmieniają – zawsze sprawdź u źródła.</p>
      <div class="filters single">${creatorSelect(ct)}</div>
      ${Object.entries(groups).map(([g, list]) => `
        <h2>${esc(g)}</h2>
        <div class="grid">${list.map((c) => `
          <div class="card">
            <div class="card-head"><h3>${esc(c.name)}</h3><span class="model model-${c.cost === 'free' ? 'free' : 'fee'}">${c.cost === 'free' ? '0 zł' : 'płatne'}</span></div>
            <div class="meta"><span>📍 ${esc(c.region)}</span><span>⚡ wpływ ${'●'.repeat(c.impact)}${'○'.repeat(5 - c.impact)}</span><span>⏱ ${c.offsetDays < 0 ? `${-c.offsetDays} dni przed premierą` : c.offsetDays === 0 ? 'w dniu premiery' : `${c.offsetDays} dni po premierze`}</span></div>
            <p class="muted">${esc(c.how)}</p>
            <div class="actions"><a class="btn small ghost" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Otwórz ↗</a></div>
          </div>`).join('')}</div>`).join('')}
      <h2>🌍 Światowa Baza – zweryfikowane podmioty (${entities.length})</h2>
      ${entities.length ? `<div class="grid">${entities.map((e) => `
        <div class="card">
          <div class="card-head"><h3>${esc(e.name)}</h3><span class="tag">${esc(META.submissionModes[e.submission] || e.submission)}</span></div>
          <div class="meta"><span>${esc(META.entityKinds[e.kind] || e.kind)}</span><span>📍 ${esc(e.country)}</span></div>
          <p class="muted">${esc(e.notes)}</p>
          <div class="actions"><a class="btn small ghost" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer nofollow">Otwórz ↗</a></div>
        </div>`).join('')}</div>` : '<p class="muted">Administrator weryfikuje kolejne podmioty – pojawią się tutaj i w Twoim Planie A–Z.</p>'}`;
    app.querySelector('[data-creator]').addEventListener('change', (e) => { creator.set(e.target.value); viewChannels(); });
  }

  // ---------- Autopilot kariery ----------
  function autopilotView(ap) {
    if (!ap || !ap.actions.length) return '';
    const icon = { profile: '👤', campaign: '🎼', task: '✅', revenue: '💰', feedback: '💬', level: '📈', entity: '🌍' };
    return `
      <div class="panel autopilot">
        <h2>🧭 Autopilot – Twoje następne ruchy</h2>
        <p class="muted small">Uszeregowane według wpływu na karierę: kampanie, Plan A–Z, rozliczenia, profil, cele poziomu i Światowa Baza.</p>
        <ol class="actions-list">${ap.actions.map((a) => `
          <li>
            <div class="sub-head"><b>${icon[a.kind] || '•'} ${esc(a.title)}</b>
              <span>${a.taskId ? `<button class="btn small" data-ap-done="${esc(a.campaignId)}|${esc(a.taskId)}">Zrobione</button>` : ''}
              ${a.url ? `<a class="btn small ghost" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer nofollow">Otwórz ↗</a>` : ''}
              ${a.link ? `<a class="btn small ghost" href="${esc(a.link)}">Przejdź →</a>` : ''}</span></div>
            <div class="muted small">${esc(a.why || '')}</div>
            ${a.suggestions && a.suggestions.length ? `<div class="tags">${a.suggestions.map((o) => `<a class="tag" href="#/miejsce/${esc(o.id)}">${esc(o.name)}${o.country ? ` · ${esc(o.country)}` : ''}</a>`).join('')}</div>` : ''}
          </li>`).join('')}</ol>
      </div>`;
  }

  async function viewEpk(slug) {
    const d = await api('GET', `/api/artists/${encodeURIComponent(slug)}`);
    const p = d.profile;
    const linkNames = { spotify: 'Spotify', youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', soundcloud: 'SoundCloud', website: 'Strona' };
    app.innerHTML = `
      <div class="epk">
        ${p.photoUrl ? `<img class="epk-photo" src="${esc(p.photoUrl)}" alt="${esc(p.name)}" referrerpolicy="no-referrer">` : '<div class="epk-photo placeholder">♪</div>'}
        <div>
          <div class="muted">Press kit · Promo Hub</div>
          <h1>${esc(p.name)}</h1>
          <p><span class="level">Poziom ${d.level}: ${esc(d.levelName)}</span> ${p.city || p.country ? `<span class="muted">📍 ${esc([p.city, p.country].filter(Boolean).join(', '))}</span>` : ''}</p>
          <div class="tags">${(p.genres || []).map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>
          <p class="cta-row">${Object.entries(p.links || {}).filter(([, u]) => u).map(([k, u]) => `<a class="btn small" href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${esc(linkNames[k] || k)} ↗</a>`).join('')}</p>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><b>${num(d.metrics.placements)}</b><span>umieszczeń</span></div>
        <div class="stat"><b>${num(d.metrics.reach)}</b><span>zasięg umieszczeń</span></div>
        <div class="stat"><b>${num(d.metrics.countries)}</b><span>krajów</span></div>
        <div class="stat"><b>${num(d.metrics.listeners)}</b><span>słuchaczy / mies.</span></div>
      </div>
      <div class="split">
        <div class="panel"><h2>Bio</h2><p>${esc(p.bio) || '<span class="muted">—</span>'}</p>${p.bioEn ? `<h3>English</h3><p>${esc(p.bioEn)}</p>` : ''}${p.achievements ? `<h3>Osiągnięcia</h3><p>${esc(p.achievements)}</p>` : ''}</div>
        <div class="panel"><h2>Gdzie grano</h2>${d.placements.length ? d.placements.map((x) => `<p><b>${esc(x.trackTitle)}</b> → ${esc(x.outletName)} <span class="muted small">${esc(META.types[x.outletType] || '')}${x.country ? ` · ${esc(x.country)}` : ''}</span>${x.placementUrl ? ` <a href="${esc(x.placementUrl)}" target="_blank" rel="noopener noreferrer nofollow">↗</a>` : ''}</p>`).join('') : '<p class="muted">Pierwsze umieszczenia w drodze.</p>'}</div>
      </div>`;
  }

  function careerView(career) {
    const n = career.next;
    return `
      <div class="panel career">
        <div class="levels">${career.levels.map((l) => `<div class="lvl${l.level === career.level ? ' current' : ''}${l.level < career.level ? ' passed' : ''}"><b>${l.level}</b><span>${esc(l.name)}</span></div>`).join('')}</div>
        <h2>Jesteś na poziomie ${career.level}: ${esc(career.name)}</h2>
        ${n ? `
          <p class="muted">Cel poziomu ${n.level} (${esc(n.name)}): ${esc(n.goal)}</p>
          <div class="score"><span>${n.percent}%</span><progress max="100" value="${n.percent}"></progress></div>
          <div class="tags">${n.progress.map((x) => `<span class="tag${x.done ? ' tag-ok' : ''}">${x.done ? '✓' : '○'} ${esc(x.label)}: ${num(x.value)} / ${num(x.target)}</span>`).join('')}</div>`
        : '<p class="yes">Najwyższy poziom – teraz utrzymaj rytm i otwieraj kolejne rynki.</p>'}
        <h3>Następne kroki</h3>
        <ol>${career.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <div class="cta-row"><a class="btn primary" href="#/kampania">🎼 Nowa kampania</a></div>
      </div>`;
  }

  function profileForm(p = {}) {
    const l = p.links || {};
    return `
      <form class="form" id="pf">
        <div class="field"><label>Typ twórcy</label>${creatorSelect(p.creatorType || creator.get())}</div>
        <div class="row">
          <div class="field"><label>Nazwa artysty / autora *</label><input name="name" required maxlength="120" value="${esc(p.name)}"></div>
          <div class="field"><label>E-mail do mediów (niepubliczny)</label><input name="contactEmail" type="email" value="${esc(p.contactEmail)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Kraj</label><input name="country" value="${esc(p.country)}"></div>
          <div class="field"><label>Miasto</label><input name="city" value="${esc(p.city)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Zdjęcie (URL)</label><input name="photoUrl" type="url" value="${esc(p.photoUrl)}"></div>
          <div class="field"><label>Słuchacze / czytelnicy miesięcznie (łącznie)</label><input name="monthlyListeners" type="number" min="0" value="${esc(p.monthlyListeners ?? 0)}"></div>
        </div>
        <div class="field"><label>Gatunki</label><select name="genres" multiple size="5">${META.genres.map((g) => `<option${(p.genres || []).includes(g) ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
        <div class="field"><label>Bio (PL)</label><textarea name="bio" maxlength="3000">${esc(p.bio)}</textarea></div>
        <div class="field"><label>Bio (EN) – na rynki zagraniczne</label><textarea name="bioEn" maxlength="3000">${esc(p.bioEn)}</textarea></div>
        <div class="field"><label>Osiągnięcia (trafiają do pitchu)</label><textarea name="achievements" maxlength="2000">${esc(p.achievements)}</textarea></div>
        <div class="row">${['spotify', 'youtube', 'instagram', 'tiktok', 'soundcloud', 'website'].map((k) => `<div class="field"><label>${esc(k)}</label><input name="link_${k}" type="url" value="${esc(l[k])}" placeholder="https://"></div>`).join('')}</div>
        <button class="btn primary" type="submit">Zapisz profil</button>
      </form>`;
  }

  async function viewArtist() {
    const key = storage.get('artistKey');
    if (!key) {
      app.innerHTML = `
        <h1>Ścieżka artysty</h1>
        <p class="lead muted">Od pierwszego utworu do sceny międzynarodowej: 5 poziomów, mierzalne cele i plan następnych kroków.</p>
        <div class="split">
          <div class="panel"><h2>Zaczynam</h2><p class="muted">Załóż profil i press kit – kampanię uruchomisz w kilka minut.</p><button class="btn primary" id="reg">Załóż profil artysty</button></div>
          <div class="panel"><h2>Mam klucz</h2>
            <form class="form" id="kf"><div class="field"><label>Klucz artysty</label><input name="key" required minlength="16"></div><button class="btn" type="submit">Zaloguj</button></form></div>
        </div>`;
      onSubmit(document.getElementById('kf'), async (d) => {
        await api('GET', '/api/artist/me', null, { 'x-artist-key': d.key.trim() });
        storage.set('artistKey', d.key.trim());
        viewArtist();
      });
      document.getElementById('reg').addEventListener('click', async () => {
        try {
          const r = await api('POST', '/api/artist/register');
          storage.set('artistKey', r.artistKey);
          storage.set('newArtist', true);
          viewArtist();
        } catch (e) { toast(e.message, true); }
      });
      return;
    }
    const h = { 'x-artist-key': key };
    let me = null;
    try {
      me = await api('GET', '/api/artist/me', null, h);
    } catch (e) {
      if (!storage.get('newArtist')) { storage.del('artistKey'); toast(e.message, true); return viewArtist(); }
    }
    const [subs, camps, ap] = await Promise.all([
      api('GET', '/api/artist/submissions', null, h).then((r) => r.submissions).catch(() => []),
      api('GET', '/api/artist/campaigns', null, h).then((r) => r.campaigns).catch(() => []),
      api('GET', '/api/artist/next-actions', null, h).catch(() => null),
    ]);
    const profile = me && me.profile;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const due = subs.reduce((a, s) => a + s.settlement.duePLN, 0);
    app.innerHTML = `
      <div class="sub-head"><h1>${esc(profile ? profile.name : 'Panel artysty')}</h1>
        <span>${profile ? `<a class="btn small" href="#/artysta/${esc(profile.slug)}">Mój press kit ↗</a>` : ''} <button class="btn small ghost" id="logout">Wyloguj</button></span></div>
      ${storage.get('newArtist') && !profile ? `<div class="notice warn"><b>Zapisz swój klucz artysty</b> – to jedyny dostęp do panelu:<br><br><span class="key">${esc(key)}</span></div>` : ''}
      ${autopilotView(ap)}
      ${me ? careerView(me.career) : ''}
      <details ${profile ? '' : 'open'}><summary><b>${profile ? 'Edytuj profil i press kit' : 'Krok 1: uzupełnij profil i press kit'}</b></summary><div class="panel">${profileForm(profile || storage.get('artistProfile', {}) && { name: storage.get('artistProfile', {}).artistName })}</div></details>
      <h2>Kampanie</h2>
      ${camps.length ? '' : '<div class="empty">Brak kampanii. <a href="#/kampania">Uruchom pierwszą</a> – budżet 0 zł wystarczy.</div>'}
      ${camps.map((c) => `
        <div class="panel" data-campaign="${esc(c.id)}">
          <div class="sub-head"><h3>🎼 ${esc(c.trackTitle)} <span class="muted small">premiera ${esc(c.releaseDate)}</span></h3>
            <span><span class="level">Siła orkiestry: ${c.orchestraScore}/100</span> <button class="btn small" data-ics="${esc(c.id)}">📅 .ics</button></span></div>
          <p class="muted small">Wysłano ${c.results.sent} zgłoszeń · umieszczenia: ${c.results.placed.length} · zasięg umieszczeń: ${num(c.results.reachPlaced)}</p>
          <details><summary>Plan A–Z, fale i symulacja</summary>${planView(c, { forCampaign: c })}</details>
        </div>`).join('')}
      <h2>Zgłoszenia ${due ? `<span class="muted small">· prowizje do zapłaty: ${pln(due)}</span>` : ''}</h2>
      ${subs.length ? '' : '<p class="muted">Brak zgłoszeń.</p>'}
      ${subs.map((s) => `
        <div class="sub">
          <div class="sub-head">
            <div><b>${esc(s.trackTitle)}</b> → <a href="#/miejsce/${esc(s.outletId)}">${esc(s.outletName)}</a> <span class="muted small">· ${date(s.createdAt)}${s.campaignId ? ' · kampania' : ''}</span></div>
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
              <div class="field"><label>Łączny przychód utworu (zł)</label><input name="amountPLN" type="number" min="0" step="0.01" required></div>
              <div class="field"><label>Uwagi</label><input name="note" maxlength="500" placeholder="np. Spotify + YouTube"></div>
              <button class="btn" type="submit">Zgłoś przychód</button>
            </form>` : ''}
        </div>`).join('')}`;

    document.getElementById('logout').addEventListener('click', () => { storage.del('artistKey'); storage.del('newArtist'); viewArtist(); });
    const pf = document.getElementById('pf');
    onSubmit(pf, async (d) => {
      const links = {};
      for (const k of ['spotify', 'youtube', 'instagram', 'tiktok', 'soundcloud', 'website']) links[k] = d[`link_${k}`] || '';
      creator.set(d.creatorType);
      const body = {
        creatorType: d.creatorType, name: d.name, contactEmail: d.contactEmail, country: d.country, city: d.city, photoUrl: d.photoUrl,
        monthlyListeners: d.monthlyListeners || 0, bio: d.bio, bioEn: d.bioEn, achievements: d.achievements, links,
        genres: [...pf.querySelector('[name=genres]').selectedOptions].map((x) => x.value),
      };
      await api('PUT', '/api/artist/profile', body, h);
      storage.del('newArtist');
      toast('Profil zapisany.');
      viewArtist();
    });
    app.querySelectorAll('[data-ap-done]').forEach((b) => b.addEventListener('click', async () => {
      const [cid, tid] = b.dataset.apDone.split('|');
      try { await api('PATCH', `/api/campaigns/${cid}/tasks/${tid}`, { done: true }, h); toast('Zrobione – kolejny ruch czeka.'); viewArtist(); } catch (e) { toast(e.message, true); }
    }));
    app.querySelectorAll('[data-ics]').forEach((b) => b.addEventListener('click', () => downloadIcs(camps.find((c) => c.id === b.dataset.ics))));
    app.querySelectorAll('[data-campaign]').forEach((el) => {
      const cid = el.dataset.campaign;
      el.querySelectorAll('[data-task]').forEach((cb) => cb.addEventListener('change', async () => {
        try { await api('PATCH', `/api/campaigns/${cid}/tasks/${cb.dataset.task}`, { done: cb.checked }, h); toast('Zapisano – siła orkiestry rośnie.'); } catch (e) { toast(e.message, true); }
      }));
      el.querySelectorAll('[data-send]').forEach((b) => b.addEventListener('click', async () => {
        try { await api('POST', `/api/campaigns/${cid}/waves/${b.dataset.send}/send`, null, h); toast('Fala wysłana.'); viewArtist(); } catch (e) { toast(e.message, true); }
      }));
    });
    app.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Wycofać zgłoszenie?')) return;
      try { await api('PATCH', `/api/submissions/${b.dataset.withdraw}`, { status: 'withdrawn' }, h); viewArtist(); } catch (e) { toast(e.message, true); }
    }));
    app.querySelectorAll('form[data-rev]').forEach((f) => onSubmit(f, async (d) => {
      const r = await api('POST', `/api/submissions/${f.dataset.rev}/revenue`, d, h);
      toast(r.pool.size > 1
        ? `Pula Efektu: ${r.pool.size} kuratorów, łącznie ${pln(r.pool.totalCommissionPLN)}${r.pool.factor < 1 ? ` (limit ${r.pool.capPercent}% chroni Twój przychód)` : ''}.`
        : (r.entry.inAgreement ? `Prowizja do zapłaty: ${pln(r.entry.commissionPLN)}` : 'Okres poza umową – bez prowizji.'));
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
      <div class="field"><label>Przyjmuję zgłoszenia od</label>
        <div class="checks">${Object.entries(META.creators).map(([k, c]) => `<label class="check"><input type="checkbox" name="ct_${esc(k)}" ${(o.creatorTypes || ['music']).includes(k) ? 'checked' : ''}> ${esc(c.label)}</label>`).join('')}</div></div>
      <div class="field"><label>Minimalny poziom artysty (Drabina dostępu)</label>
        <select name="minLevel">${options({ 1: '1 – Debiutant (wszyscy)', 2: '2 – Lokalny', 3: '3 – Krajowy', 4: '4 – Międzynarodowy', 5: '5 – Globalny' }, String(o.minLevel || 1))}</select>
        <div class="hint">Duże miejsca mogą przyjmować tylko artystów z udokumentowanymi wynikami – mniej przypadkowych zgłoszeń, a artyści mają cel, do którego dążą.</div></div>
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
      reach: d.reach || 0, responseDays: d.responseDays || 7, country: d.country, language: d.language, minLevel: d.minLevel || 1,
      description: d.description,
      genres: [...form.querySelector('[name=genres]').selectedOptions].map((x) => x.value),
      creatorTypes: Object.keys(META.creators).filter((k) => d[`ct_${k}`] === 'on'),
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
            <div><b>${esc(s.artistName)} – ${esc(s.trackTitle)}</b> <span class="muted small">${esc(s.genre)} · ${date(s.createdAt)}</span>${s.artistSlug ? ` <a class="tag" href="#/artysta/${esc(s.artistSlug)}">press kit · ${esc(s.artistLevel)}</a>` : ''}</div>
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
      <div class="panel sub-head">
        <div><h2>🌍 Światowa Baza Podmiotów</h2><p class="muted">${num(s.entities.total)} podmiotów · w rozmowach: ${num(s.entities.inPipeline)} · partnerzy: ${num(s.entities.partners)}</p></div>
        <a class="btn primary" href="#/admin/baza">Otwórz bazę (CRM) →</a>
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

  // ---------- Światowa Baza Podmiotów (CRM admina) ----------
  async function viewAdminEntities() {
    const token = storage.get('adminToken');
    if (!token) { location.hash = '#/admin'; return; }
    const h = { 'x-admin-token': token };
    const f = storage.get('entityFilters', { q: '', creator: '', region: '', stage: '', kind: '', submission: '' });
    app.innerHTML = `
      <div class="sub-head"><h1>🌍 Światowa Baza Podmiotów</h1><a class="btn small ghost" href="#/admin">← Panel admina</a></div>
      <p class="muted">Realne podmioty, z którymi można współpracować bezpłatnie, za niską opłatę lub na prowizję. Domyślnie to <b>prospekty</b> – nie partnerzy. Zweryfikuj warunki u źródła, oznacz „publiczny”, aby trafił do Planu A–Z twórców, albo podpisz współpracę i przekonwertuj w partnera katalogu.</p>
      <div id="entStats"></div>
      <form class="filters" id="ef">
        <input name="q" placeholder="Szukaj: nazwa, kraj, uwagi…" value="${esc(f.q)}">
        <select name="creator">${options(META.creators, f.creator, 'Wszyscy twórcy')}</select>
        <select name="region">${options(META.regions, f.region, 'Każdy region')}</select>
        <select name="stage">${options(META.entityStages, f.stage, 'Każdy etap')}</select>
        <select name="kind">${options(META.entityKinds, f.kind, 'Każdy typ')}</select>
        <select name="submission">${options(META.submissionModes, f.submission, 'Każdy tryb')}</select>
      </form>
      <div class="cta-row">
        <button class="btn" id="exportCsv">⬇ Eksport CSV</button>
        <details class="inline"><summary class="btn">⬆ Import CSV</summary>
          <div class="panel"><p class="muted small">Kolumny: name, url (wymagane), kind, creatorTypes (music|dj|writer), country, region, submission, model, stage, contactEmail, verified, publicListing, notes. Duplikaty (ta sama domena + nazwa) są pomijane.</p>
            <input type="file" id="csvFile" accept=".csv,text/csv"><textarea id="csvText" rows="5" placeholder="lub wklej CSV"></textarea><button class="btn primary" id="importCsv">Importuj</button></div></details>
        <details class="inline"><summary class="btn">＋ Dodaj podmiot</summary>
          <div class="panel"><form class="form" id="addEnt">
            <div class="row"><div class="field"><label>Nazwa *</label><input name="name" required></div><div class="field"><label>URL *</label><input name="url" type="url" required></div></div>
            <div class="row"><div class="field"><label>Typ</label><select name="kind">${options(META.entityKinds, 'radio')}</select></div><div class="field"><label>Region</label><select name="region">${options(META.regions, 'Europa')}</select></div></div>
            <div class="row"><div class="field"><label>Kraj</label><input name="country"></div><div class="field"><label>Twórcy</label><select name="creatorTypes">${options(META.creators, 'music')}</select></div></div>
            <div class="row"><div class="field"><label>Tryb zgłoszeń</label><select name="submission">${options(META.submissionModes, 'contact')}</select></div><div class="field"><label>Proponowany model</label><select name="model">${options(META.models, 'free')}</select></div></div>
            <div class="field"><label>Uwagi</label><input name="notes"></div>
            <button class="btn primary" type="submit">Dodaj</button></form></div></details>
      </div>
      <div id="outreach"></div>
      <div id="entList"></div>`;
    const form = document.getElementById('ef');
    const list = document.getElementById('entList');

    async function load() {
      const d = formData(form);
      storage.set('entityFilters', d);
      const r = await api('GET', `/api/admin/entities?${new URLSearchParams(d)}`, null, h);
      const st = r.facets.stage;
      document.getElementById('entStats').innerHTML = `
        <div class="stats">
          <div class="stat"><b>${num(r.total)}</b><span>podmiotów w bazie</span></div>
          <div class="stat"><b>${num(r.countries)}</b><span>krajów</span></div>
          <div class="stat"><b>${num(st.contacted || 0)} / ${num(st.negotiation || 0)}</b><span>kontakt / negocjacje</span></div>
          <div class="stat"><b>${num(st.partner || 0)}</b><span>partnerów w katalogu</span></div>
          <div class="stat"><b>${num(r.facets.creatorTypes.music || 0)} · ${num(r.facets.creatorTypes.dj || 0)} · ${num(r.facets.creatorTypes.writer || 0)}</b><span>muzyka · DJ · literatura</span></div>
        </div>`;
      list.innerHTML = `<p class="muted small">Wyniki: ${r.entities.length}</p>` + r.entities.map((e) => `
        <div class="sub ent" data-ent="${esc(e.id)}" data-email="${esc(e.contactEmail)}">
          <div class="sub-head">
            <div><b><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(e.name)} ↗</a></b>
              <span class="muted small">${esc(META.entityKinds[e.kind] || e.kind)} · ${esc(e.country)} · ${esc(e.region)}</span><br>
              <span class="tags">${e.creatorTypes.map((c) => `<span class="tag">${esc(META.creators[c]?.label || c)}</span>`).join('')}
                <span class="tag">${esc(META.submissionModes[e.submission])}</span><span class="model model-${esc(e.model)}">${esc(META.models[e.model]?.label || e.model)}</span></span></div>
            <div class="ent-actions">
              <select data-stage>${options(META.entityStages, e.stage)}</select>
              <label class="check small"><input type="checkbox" data-verified ${e.verified ? 'checked' : ''}> zweryfikowany</label>
              <label class="check small"><input type="checkbox" data-public ${e.publicListing ? 'checked' : ''} ${e.verified ? '' : 'disabled'}> publiczny</label>
            </div>
          </div>
          ${e.notes ? `<div class="muted small">${esc(e.notes)}</div>` : ''}
          <div class="cta-row">
            <button class="btn small" data-outreach="pl">✉ Outreach PL</button>
            <button class="btn small" data-outreach="en">✉ Outreach EN</button>
            ${e.outletId ? `<a class="btn small" href="#/miejsce/${esc(e.outletId)}">W katalogu →</a>` : '<button class="btn small primary" data-convert>🤝 Partner → katalog</button>'}
            <button class="btn small ghost" data-remove>Usuń</button>
          </div>
        </div>`).join('');
    }

    list.addEventListener('change', async (ev) => {
      const row = ev.target.closest('[data-ent]');
      if (!row) return;
      const id = row.dataset.ent;
      const body = {};
      if (ev.target.matches('[data-stage]')) body.stage = ev.target.value;
      if (ev.target.matches('[data-verified]')) body.verified = ev.target.checked;
      if (ev.target.matches('[data-public]')) body.publicListing = ev.target.checked;
      try {
        await api('PATCH', `/api/admin/entities/${id}`, body, h);
        toast('Zapisano.');
        if (body.verified !== undefined) load();
      } catch (e) { toast(e.message, true); }
    });

    list.addEventListener('click', async (ev) => {
      const row = ev.target.closest('[data-ent]');
      if (!row) return;
      const id = row.dataset.ent;
      try {
        if (ev.target.matches('[data-outreach]')) {
          const o = await api('GET', `/api/admin/entities/${id}/outreach?lang=${ev.target.dataset.outreach}`, null, h);
          const box = document.getElementById('outreach');
          box.innerHTML = `<div class="panel"><div class="sub-head"><h3>✉ ${esc(o.subject)}</h3><button class="btn small" id="copyOut">Kopiuj</button></div><textarea id="outBody" rows="14">${esc(o.body)}</textarea></div>`;
          document.getElementById('copyOut').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(`${o.subject}\n\n${o.body}`); toast('Skopiowano.'); } catch { toast('Zaznacz i skopiuj ręcznie.', true); }
          });
          box.scrollIntoView({ behavior: 'smooth' });
        } else if (ev.target.matches('[data-convert]')) {
          if (!confirm('Podmiot zgodził się na współpracę? Utworzyć miejsce w katalogu?')) return;
          const contactEmail = row.dataset.email || prompt('E-mail kontaktowy partnera (trafią na niego zgłoszenia i powiadomienia):', '');
          if (!contactEmail) return;
          const r = await api('POST', `/api/admin/entities/${id}/convert`, { contactEmail }, h);
          document.getElementById('outreach').innerHTML = `<div class="notice ok"><b>${esc(r.outlet.name)}</b> jest partnerem w katalogu. Przekaż dane dostępowe do panelu kuratora (zostaną pokazane tylko raz):<br><br>ID: <span class="key">${esc(r.outlet.id)}</span><br><br>Klucz kuratora: <span class="key">${esc(r.manageKey)}</span><br><br>Kurator ustawi gatunki, zasięg i dokładne warunki w swoim panelu.</div>`;
          document.getElementById('outreach').scrollIntoView({ behavior: 'smooth' });
          load();
        } else if (ev.target.matches('[data-remove]')) {
          if (!confirm('Usunąć podmiot z bazy?')) return;
          await api('DELETE', `/api/admin/entities/${id}`, null, h);
          load();
        }
      } catch (e) { toast(e.message, true); }
    });

    document.getElementById('exportCsv').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/admin/entities/export', { headers: h });
        if (!res.ok) throw new Error('Eksport nieudany.');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(await res.blob());
        a.download = `baza-podmiotow-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } catch (e) { toast(e.message, true); }
    });
    document.getElementById('csvFile').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (file) document.getElementById('csvText').value = await file.text();
    });
    document.getElementById('importCsv').addEventListener('click', async () => {
      try {
        const r = await api('POST', '/api/admin/entities/import', { csv: document.getElementById('csvText').value }, h);
        toast(`Dodano ${r.added}, pominięto ${r.skipped}.`);
        if (r.errors.length) document.getElementById('outreach').innerHTML = `<div class="notice warn">${r.errors.map(esc).join('<br>')}</div>`;
        load();
      } catch (e) { toast(e.message, true); }
    });
    onSubmit(document.getElementById('addEnt'), async (d, fm) => {
      await api('POST', '/api/admin/entities', { ...d, creatorTypes: [d.creatorTypes] }, h);
      fm.reset();
      toast('Dodano podmiot.');
      load();
    });
    let t;
    form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load().catch((e) => toast(e.message, true)), 250); });
    form.addEventListener('submit', (e) => e.preventDefault());
    await load();
  }

  // ---------- router ----------
  const routes = [
    [/^#?\/?$/, viewHome],
    [/^#\/katalog$/, viewCatalog],
    [/^#\/dopasuj$/, viewMatch],
    [/^#\/miejsce\/([\w-]+)$/, viewOutlet],
    [/^#\/wyslij$/, viewSubmit],
    [/^#\/artysta$/, viewArtist],
    [/^#\/artysta\/([\w-]+)$/, viewEpk],
    [/^#\/kampania$/, viewCampaign],
    [/^#\/kanaly$/, viewChannels],
    [/^#\/kurator$/, viewCurator],
    [/^#\/admin$/, viewAdmin],
    [/^#\/admin\/baza$/, viewAdminEntities],
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
