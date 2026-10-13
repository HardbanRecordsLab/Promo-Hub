'use strict';

(() => {
  const app = document.getElementById('app');
  const PL = window.PH_PL || {};
  let META = null;

  // ---------- storage ----------
  const storage = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
  };

  // ---------- i18n: English keys, Polish dictionary in i18n-pl.js ----------
  let LANG = storage.get('lang', 'en') === 'pl' ? 'pl' : 'en';
  function t(key, params) {
    let s = (LANG === 'pl' && PL[key]) || key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
    return s;
  }
  const locale = () => (LANG === 'pl' ? 'pl-PL' : 'en-GB');

  // ---------- helpers ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (LANG === 'pl'
    ? `${Number(n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
    : `${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`);
  const num = (n) => Number(n || 0).toLocaleString(locale());
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString(locale()) : '—');
  const genre = (g) => (META.genreLabels[g] || g);
  let regionNames = null;
  function country(code) {
    if (!code) return '—';
    if (code === 'WW') return t('Worldwide');
    if (!/^[A-Z]{2}$/.test(code)) return code;
    try {
      if (!regionNames || regionNames.lang !== LANG) regionNames = { lang: LANG, fmt: new Intl.DisplayNames([LANG], { type: 'region' }) };
      return regionNames.fmt.of(code) || code;
    } catch { return code; }
  }

  async function api(method, path, body, headers = {}) {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-lang': LANG, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t('Error {status}', { status: res.status }));
    return data;
  }

  let toastTimer;
  function toast(msg, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `show${isError ? ' error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, 3500);
  }

  function formData(form) {
    const out = {};
    for (const [k, v] of new FormData(form)) out[k] = v;
    return out;
  }

  // Form submit with a disabled button and an error toast.
  function onSubmit(form, handler) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      try { await handler(formData(form), form); } catch (err) { toast(err.message, true); } finally { if (btn) btn.disabled = false; }
    });
  }

  function options(map, selected = '', empty = null) {
    const entries = Array.isArray(map) ? map.map((g) => [g, genre(g)]) : Object.entries(map).map(([k, v]) => [k, typeof v === 'string' ? v : v.label]);
    return (empty !== null ? `<option value="">${esc(empty)}</option>` : '') +
      entries.map(([k, v]) => `<option value="${esc(k)}"${String(k) === String(selected) ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }

  // ---------- selected outlets (cart) ----------
  const cart = {
    ids() { return storage.get('cart', []); },
    has(id) { return this.ids().includes(id); },
    toggle(id) {
      const ids = this.ids();
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1); else if (ids.length < 25) ids.push(id); else { toast(t('At most 25 outlets per submission.'), true); return; }
      storage.set('cart', ids);
      updateCartBadge();
    },
    clear() { storage.set('cart', []); updateCartBadge(); },
  };
  function updateCartBadge() {
    const b = document.getElementById('cartCount');
    if (!b) return;
    const n = cart.ids().length;
    b.textContent = n;
    b.hidden = n === 0;
  }

  // ---------- creator type (musician / DJ / writer) ----------
  const creator = {
    get() { const c = storage.get('creatorType', 'music'); return META.creators[c] ? c : 'music'; },
    set(c) { if (META.creators[c]) storage.set('creatorType', c); },
    info(c) { return META.creators[c || this.get()]; },
  };
  const creatorSelect = (selected = creator.get()) => `<select name="creatorType" data-creator>${options(META.creators, selected)}</select>`;
  const genreOptions = (ct, selected = '', empty = null) => options(META.creators[ct].genres, selected, empty);

  // ---------- components ----------
  function modelBadge(c) {
    const label = META.models[c.model]?.label || c.model;
    let detail = '';
    if ((c.model === 'commission' || c.model === 'revshare') && c.ratePercent) detail = ` ${c.ratePercent}% / ${t('{n} mo.', { n: c.durationMonths })}`;
    if (c.model === 'fee' && c.feePLN) detail = ` ${money(c.feePLN)}`;
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
            <h3><a href="#/outlet/${esc(o.id)}">${esc(o.name)}</a></h3>
          </div>
          ${modelBadge(o.collaboration)}
        </div>
        ${match}
        <div class="meta">
          <span>👥 ${o.reach ? num(o.reach) : '—'}</span>
          <span>⏱ ${esc(t('reply within {n} days', { n: o.responseDays || 7 }))}</span>
          ${st.acceptanceRate !== null && st.acceptanceRate !== undefined ? `<span>✅ ${esc(t('{n}% accepted', { n: st.acceptanceRate }))}</span>` : ''}
          ${o.country ? `<span>📍 ${esc(country(o.country))}</span>` : ''}
        </div>
        <div class="tags">${(o.genres.length ? o.genres.map(genre) : [t('all genres')]).map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>
        <div class="muted small">${esc(t('for:'))} ${o.creatorTypes.map((c) => esc(META.creators[c]?.label || c)).join(', ')}</div>
        <div>${o.verified ? `<span class="verified">✔ ${esc(t('verified'))}</span>` : `<span class="muted small">${esc(t('not verified'))}</span>`} ${o.sample ? `<span class="sample">· ${esc(t('sample'))}</span>` : ''} ${(o.minLevel || 1) > 1 ? `<span class="tag">🔒 ${esc(t('from level {n}', { n: o.minLevel }))}</span>` : ''}</div>
        <div class="actions">
          ${o.acceptsSubmissions
            ? `<button class="btn small ${sel ? '' : 'primary'}" data-cart="${esc(o.id)}">${sel ? `✓ ${esc(t('Selected'))}` : `+ ${esc(t('Add to submission'))}`}</button>`
            : `<span class="muted small">${esc(t('Not accepting submissions right now'))}</span>`}
          <a class="btn small ghost" href="#/outlet/${esc(o.id)}">${esc(t('Details'))}</a>
        </div>
      </article>`;
  }

  function bindCartButtons(root, rerender) {
    root.querySelectorAll('[data-cart]').forEach((b) => b.addEventListener('click', () => { cart.toggle(b.dataset.cart); rerender(); }));
  }

  function statusBadge(s) {
    return `<span class="status st-${esc(s)}">${esc(META.statuses[s] || s)}</span>`;
  }

  function revenueTable(sub, { curatorKey } = {}) {
    if (!sub.revenue.length) return `<p class="muted small">${esc(t('No revenue reported yet.'))}</p>`;
    return `<table class="rev"><thead><tr><th>${esc(t('Period'))}</th><th>${esc(t('Revenue'))}</th><th>${esc(t('Commission'))}</th><th>${esc(t('Status'))}</th></tr></thead><tbody>
      ${sub.revenue.map((r) => `<tr>
        <td>${esc(r.period)}</td><td>${money(r.amountPLN)}</td>
        <td>${r.inAgreement ? `${money(r.commissionPLN)}${r.poolSize > 1 ? ` <span class="muted small">(${esc(t('Pool: {rate}%, {n} curators', { rate: r.effectiveRatePercent, n: r.poolSize }))})</span>` : ''}` : `<span class="muted">${esc(t('outside the agreement'))}</span>`}</td>
        <td>${r.commissionPLN ? (r.paid ? `<span class="yes">${esc(t('paid'))}</span>` : (curatorKey ? `<button class="btn small" data-paid="${esc(sub.id)}|${esc(r.id)}">${esc(t('Confirm payment'))}</button>` : esc(t('due')))) : '—'}</td>
      </tr>`).join('')}
    </tbody></table>`;
  }

  // ---------- views ----------
  async function viewHome() {
    const s = await api('GET', '/api/stats');
    app.innerHTML = `
      <section class="hero">
        <h1>${esc(t('From unknown newcomer to'))} <span class="grad">${esc(t('a creator the world knows'))}</span>.</h1>
        <p class="lead">${esc(t('For musicians, DJs and writers. Promo Hub plays like an orchestra: playlists, radio, YouTube, TikTok and BookTok, blogs, podcasts, magazines, DJs, clubs, festivals, publishers and sync – synchronized by the Master Conductor from A to Z. You pay for results: on commission, curators earn only when your work earns.'))}</p>
        <div class="tags creators-row">${Object.values(META.creators).map((c) => `<span class="tag">${esc(c.label)}</span>`).join('')}</div>
        <div class="cta-row">
          <a class="btn primary" href="#/campaign">🎼 ${esc(t('Launch a campaign – from €0'))}</a>
          <a class="btn" href="#/creator">${esc(t('Check your level'))}</a>
          <a class="btn" href="#/curators">${esc(t('List your playlist, station or channel'))}</a>
        </div>
      </section>
      <div class="stats">
        <div class="stat"><b>${num(s.outlets)}</b><span>${esc(t('outlets'))}</span></div>
        <div class="stat"><b>${num(s.totalReach)}</b><span>${esc(t('total reach'))}</span></div>
        <div class="stat"><b>${num(s.submissions)}</b><span>${esc(t('works submitted'))}</span></div>
        <div class="stat"><b>${num(s.placed)}</b><span>${esc(t('placements'))}</span></div>
      </div>
      <h2>${esc(t('Creator Path: 5 levels'))}</h2>
      <div class="levels big">
        <div class="lvl"><b>1</b><span>${esc(t('Newcomer'))}</span><small>${esc(t('profile, press kit, first placements'))}</small></div>
        <div class="lvl"><b>2</b><span>${esc(t('Local'))}</span><small>${esc(t('regional radio, podcasts, first playlists'))}</small></div>
        <div class="lvl"><b>3</b><span>${esc(t('National'))}</span><small>${esc(t('YouTube, TikTok, blogs, big playlists'))}</small></div>
        <div class="lvl"><b>4</b><span>${esc(t('International'))}</span><small>${esc(t('foreign playlists and radio, sync, festivals'))}</small></div>
        <div class="lvl"><b>5</b><span>${esc(t('Global'))}</span><small>${esc(t('6+ countries, collaborations, your own show'))}</small></div>
      </div>
      <p class="muted">${esc(t('Every level has measurable goals computed from real placements – and a concrete plan of next steps.'))}</p>
      <h2>${esc(t('How it works'))}</h2>
      <div class="steps">
        <div class="step"><h3>${esc(t('The Conductor picks your orchestra'))}</h3><p class="muted">${esc(t('Enter your work, release date and budget (even €0). The system picks the best outlets from every section: radio, playlists, video, media, DJs.'))}</p></div>
        <div class="step"><h3>${esc(t('Waves at the perfect moment'))}</h3><p class="muted">${esc(t('Radio 6 weeks before release, media 3 weeks, creators 2 weeks, playlists on release day – sent automatically with a personal pitch for every curator.'))}</p></div>
        <div class="step"><h3>${esc(t('Guaranteed response'))}</h3><p class="muted">${esc(t('Every curator has a deadline. No decision = the submission expires and the curator drops in the ranking.'))}</p></div>
        <div class="step"><h3>${esc(t('Pay for results'))}</h3><p class="muted">${esc(t('After placement you report revenue and the system calculates commission – only for the agreement period, capped by the Effect Pool.'))}</p></div>
      </div>
      <h2>${esc(t('Why Promo Hub'))}</h2>
      <div class="panel table-wrap">
        <table class="compare">
          <thead><tr><th></th><th>Promo Hub</th><th>${esc(t('Typical paid-submission services'))}</th></tr></thead>
          <tbody>
            <tr><td>${esc(t('Master Conductor A–Z: 45–60 tasks in 9 phases, from foundation to scaling'))}</td><td class="yes">${esc(t('for musicians, DJs and writers'))}</td><td class="no">${esc(t('single services'))}</td></tr>
            <tr><td>${esc(t('Campaign Simulator (Monte Carlo) – outcome range and level-up chance before you start'))}</td><td class="yes">${esc(t('yes'))}</td><td class="no">—</td></tr>
            <tr><td>${esc(t('Career Autopilot – always know which move pays off most right now'))}</td><td class="yes">${esc(t('yes'))}</td><td class="no">—</td></tr>
            <tr><td>${esc(t('Global Database – radio, media, festivals, publishers, sync in many countries'))}</td><td class="yes">${esc(t('in your Conductor plan'))}</td><td class="no">—</td></tr>
            <tr><td>${esc(t('Domino effect: an acceptance automatically opens bigger outlets'))}</td><td class="yes">${esc(t('yes, with social proof in the pitch'))}</td><td class="no">—</td></tr>
            <tr><td>${esc(t('Effect Pool: total commission per work is capped'))}</td><td class="yes">${esc(t('max {n}% no matter how many curators', { n: META.trackCommissionCapPercent }))}</td><td class="no">—</td></tr>
            <tr><td>${esc(t('Creator Path and Access Ladder'))}</td><td class="yes">${esc(t('5 levels, measurable goals, step plan'))}</td><td class="no">—</td></tr>
            <tr><td>${esc(t('Upfront cost for creators'))}</td><td class="yes">${esc(t('€0 on commission'))}</td><td class="no">${esc(t('credits for every submission'))}</td></tr>
            <tr><td>${esc(t('Curators earn when…'))}</td><td class="yes">${esc(t('the work generates revenue'))}</td><td class="no">${esc(t('they merely listen'))}</td></tr>
            <tr><td>${esc(t('Response time'))}</td><td class="yes">${esc(t('guaranteed, affects ranking'))}</td><td class="no">${esc(t('varies'))}</td></tr>
            <tr><td>${esc(t('Public curator performance'))}</td><td class="yes">${esc(t('% accepted, % on time, reaction time'))}</td><td class="no">${esc(t('often hidden'))}</td></tr>
            <tr><td>${esc(t('Compliance with streaming rules'))}</td><td class="yes">${esc(t('no paid guaranteed placements'))}</td><td class="no">${esc(t('varies'))}</td></tr>
          </tbody>
        </table>
      </div>
      <h2>${esc(t('Collaboration models'))}</h2>
      <div class="grid">
        ${Object.entries(META.models).map(([k, m]) => `<div class="card"><span class="model model-${esc(k)}">${esc(m.label)}</span><p class="muted">${esc(m.description)}</p></div>`).join('')}
      </div>`;
  }

  async function viewCatalog() {
    const f = storage.get('filters', { q: '', type: '', genre: '', model: '', sort: 'reach', open: true });
    const ct = creator.get();
    if (f.genre && !META.creators[ct].genres.includes(f.genre)) f.genre = '';
    app.innerHTML = `
      <h1>${esc(t('Outlet catalog'))}</h1>
      <p class="muted">${esc(t('Playlists, radio, channels, blogs, magazines, podcasts, DJs, publishers and more. Select outlets and send your work to all of them in one submission.'))}</p>
      <form class="filters" id="filters">
        <input name="q" placeholder="${esc(t('Search: name, description, country…'))}" value="${esc(f.q)}">
        ${creatorSelect(ct)}
        <select name="type">${options(META.types, f.type, t('All types'))}</select>
        <select name="genre">${genreOptions(ct, f.genre, t('All genres'))}</select>
        <select name="model">${options(META.models, f.model, t('Any model'))}</select>
        <select name="sort">${options({ reach: t('Biggest reach'), rate: t('Lowest commission'), new: t('Newest'), name: t('Name A–Z') }, f.sort)}</select>
        <label class="check"><input type="checkbox" name="open" ${f.open ? 'checked' : ''}> ${esc(t('accepting submissions only'))}</label>
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
        results.innerHTML = outlets.length ? `<div class="grid">${outlets.map(outletCard).join('')}</div>` : `<div class="empty">${esc(t('No results – change the filters.'))}</div>`;
        bindCartButtons(results, render);
        const n = cart.ids().length;
        document.getElementById('cartCta').innerHTML = n ? `<a class="btn primary" href="#/send">${esc(t('Send to selected ({n}) →', { n }))}</a>` : '';
      };
      render();
    }
    let timer;
    form.addEventListener('input', (e) => {
      if (e.target.name === 'creatorType') { creator.set(e.target.value); viewCatalog(); return; }
      clearTimeout(timer);
      timer = setTimeout(() => load().catch((err) => toast(err.message, true)), 200);
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    await load();
  }

  async function viewMatch() {
    const ct = creator.get();
    const saved = storage.get('matchGenre', '');
    const last = META.creators[ct].genres.includes(saved) ? saved : '';
    app.innerHTML = `
      <h1>${esc(t('Match outlets to your work'))}</h1>
      <p class="muted">${esc(t('The 0–100 ranking combines genre fit, curator performance (% accepted), reliability (% answered on time), verification, reach and whether you pay upfront.'))}</p>
      <form class="filters" id="mf">
        ${creatorSelect(ct)}
        <select name="genre" required>${genreOptions(ct, last, t('Choose a genre'))}</select>
        <select name="type">${options(META.types, '', t('All types'))}</select>
        <select name="model">${options(META.models, '', t('Any model'))}</select>
        <button class="btn primary" type="submit">${esc(t('Show the best'))}</button>
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
          ? `<div class="cta-row"><button class="btn" id="addTop">+ ${esc(t('Add the top 10 to your submission'))}</button><a class="btn primary" href="#/send">${esc(t('Go to sending →'))}</a></div><br>
             <div class="grid">${outlets.map(outletCard).join('')}</div>`
          : `<div class="empty">${esc(t('No matches – try another genre or type.'))}</div>`;
        bindCartButtons(res, render);
        const top = document.getElementById('addTop');
        if (top) top.addEventListener('click', () => {
          const ids = cart.ids();
          for (const o of outlets.slice(0, 10)) if (!ids.includes(o.id) && ids.length < 25) ids.push(o.id);
          storage.set('cart', ids);
          updateCartBadge();
          render();
          toast(t('Top matches added.'));
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
    const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
    app.innerHTML = `
      <p><a href="#/catalog">← ${esc(t('Catalog'))}</a></p>
      <div class="split">
        <div>
          <div class="muted">${esc(META.types[o.type])}</div>
          <h1>${esc(o.name)}</h1>
          <p>${o.verified ? `<span class="verified">✔ ${esc(t('verified'))}</span>` : `<span class="muted">${esc(t('not verified'))}</span>`} ${o.sample ? `<span class="sample">· ${esc(t('sample entry'))}</span>` : ''}</p>
          <p>${o.description ? esc(o.description) : `<span class="muted">${esc(t('No description.'))}</span>`}</p>
          <div class="tags">${(o.genres.length ? o.genres.map(genre) : [t('all genres')]).map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>
          <p class="meta"><span>👥 ${esc(t('reach'))}: ${o.reach ? num(o.reach) : '—'}</span><span>📍 ${esc(country(o.country))}</span><span>🗣 ${esc(o.language || '—')}</span></p>
          <p><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(t('Open profile / playlist ↗'))}</a></p>
        </div>
        <div>
          <div class="panel">
            <h3>${esc(t('Collaboration terms'))}</h3>
            <p>${modelBadge(o.collaboration)}</p>
            <p class="muted">${esc(m.description)}</p>
            ${o.collaboration.terms ? `<p>${esc(o.collaboration.terms)}</p>` : ''}
            <p class="muted small">${esc(t('Response deadline: {n} days. After that the submission expires automatically.', { n: o.responseDays || 7 }))}</p>
          </div>
          <div class="stats">
            <div class="stat"><b>${pct(st.acceptanceRate)}</b><span>${esc(t('accepted'))}</span></div>
            <div class="stat"><b>${pct(st.responseRate)}</b><span>${esc(t('answered on time'))}</span></div>
            <div class="stat"><b>${st.avgResponseHours !== null ? `${st.avgResponseHours} h` : '—'}</b><span>${esc(t('avg. reaction time'))}</span></div>
            <div class="stat"><b>${num(st.placed)}</b><span>${esc(t('placements'))}</span></div>
          </div>
          ${o.acceptsSubmissions
            ? `<button class="btn primary" data-cart="${esc(o.id)}">${cart.has(o.id) ? `✓ ${esc(t('In submission'))}` : `+ ${esc(t('Add to submission'))}`}</button> <a class="btn" href="#/send">${esc(t('Send →'))}</a>`
            : `<p class="muted">${esc(t('Not accepting submissions right now.'))}</p>`}
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
      app.innerHTML = `<h1>${esc(t('Send your work'))}</h1><div class="empty">${esc(t('No outlets selected.'))}<br><br><a class="btn primary" href="#/match">${esc(t('Match outlets'))}</a> <a class="btn" href="#/catalog">${esc(t('Browse the catalog'))}</a></div>`;
      return;
    }
    const fees = outlets.filter((o) => o.collaboration.model === 'fee').reduce((a, o) => a + o.collaboration.feePLN, 0);
    const ct = creator.get();
    const ci = creator.info(ct);
    app.innerHTML = `
      <h1>${esc(t('Send: {work}', { work: ci.work }))}</h1>
      <div class="panel">
        <h3>${esc(t('Selected outlets ({n})', { n: outlets.length }))}</h3>
        ${outlets.map((o) => `
          <div class="sub-head sub">
            <div><b>${esc(o.name)}</b> <span class="muted small">${esc(META.types[o.type])}</span><br><span class="muted small">${esc(o.collaboration.terms || META.models[o.collaboration.model].description)}</span></div>
            <div>${modelBadge(o.collaboration)} <button class="btn small ghost" data-cart="${esc(o.id)}">${esc(t('Remove'))}</button></div>
          </div>`).join('')}
        <p class="muted">${esc(t('Upfront cost:'))} <b>${money(fees)}</b>${fees ? ` ${esc(t('(review fees)'))}` : ''}. ${esc(t('Commissions apply only to revenue from the work after placement and only during the agreement.'))}</p>
      </div>
      <form class="form" id="sf">
        <div class="row">
          <div class="field"><label>${esc(t('Creator / band name'))} *</label><input name="artistName" required maxlength="120" value="${esc(profile.artistName)}"></div>
          <div class="field"><label>${esc(t('E-mail'))} *</label><input name="artistEmail" type="email" required value="${esc(profile.artistEmail)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>${esc(t('Creator type'))}</label>${creatorSelect(ct)}</div>
          <div class="field"><label>${esc(t('Genre'))}</label><select name="genre">${genreOptions(ct, storage.get('matchGenre', ''), '—')}</select></div>
        </div>
        <div class="field"><label>${esc(t('Title ({work})', { work: ci.work }))} *</label><input name="trackTitle" required maxlength="160"></div>
        <div class="field"><label>${esc(t('Link ({hint})', { hint: ci.workUrlHint }))} *</label><input name="trackUrl" type="url" required placeholder="https://"></div>
        <div class="field"><label>${esc(t('Release date'))}</label><input name="releaseDate" type="date"></div>
        <div class="field"><label>${esc(t('Message to curators'))}</label><textarea name="message" maxlength="2000" placeholder="${esc(t('A few sentences about the work, inspirations and past successes. {name} and {genres} are replaced for each curator.'))}"></textarea></div>
        <label class="check"><input type="checkbox" name="acceptTerms" required> ${esc(t('I accept the collaboration terms of the selected outlets and will report revenue honestly during commission agreements.'))}</label>
        ${hasKey ? `<label class="check"><input type="checkbox" name="useKey" checked> ${esc(t('Add to my existing creator panel'))}</label>` : ''}
        <button class="btn primary" type="submit">${esc(t('Send to {n} outlets', { n: outlets.length }))}</button>
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
        <h1>${esc(t('Sent!'))} 🎉</h1>
        <div class="notice ok">${esc(t('Your submission reached {n} outlets.', { n: r.submissions.length }))}${r.skipped.length ? ` ${esc(t('Skipped:'))} ${esc(r.skipped.map((s) => s.reason).join(' '))}` : ''}</div>
        <div class="notice warn"><b>${esc(t('Save your creator key.'))}</b> ${esc(t('It is the only way to access your panel from another device:'))}<br><br><span class="key">${esc(r.artistKey)}</span></div>
        <a class="btn primary" href="#/creator">${esc(t('Go to your creator panel'))}</a>`;
    });
  }

  // ---------- calendar (.ics) ----------
  function downloadIcs(campaign) {
    const d = (iso) => iso.replace(/-/g, '');
    const escIcs = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
    const events = [
      ...campaign.waves.map((w, i) => ({ uid: `${campaign.id}-w${i}`, date: w.date, title: `${w.name} (${w.outlets.length})`, desc: w.how })),
      ...campaign.tasks.map((x) => ({ uid: `${campaign.id}-${x.id}`, date: x.date, title: x.name, desc: `${x.how} ${x.url || ''}` })),
    ];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Promo Hub//Campaign//EN', 'CALSCALE:GREGORIAN'];
    const stamp = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
    for (const e of events) {
      const next = new Date(Date.parse(`${e.date}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
      lines.push('BEGIN:VEVENT', `UID:${e.uid}@promohub`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d(e.date)}`,
        `DTEND;VALUE=DATE:${d(next)}`, `SUMMARY:${escIcs(`[${campaign.trackTitle}] ${e.title}`)}`, `DESCRIPTION:${escIcs(e.desc)}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
    a.download = `campaign-${campaign.trackTitle.replace(/[^\w-]+/g, '_')}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- pitch generator ----------
  function generatePitch(d, profile) {
    const params = {
      artist: d.artistName || t('[creator]'),
      title: d.trackTitle || t('[title]'),
      genre: d.genre ? genre(d.genre) : t('my genre'),
      date: d.releaseDate ? new Date(`${d.releaseDate}T00:00:00Z`).toLocaleDateString(locale()) : '',
    };
    const when = params.date ? ` ${t('Release: {date}.', params)}` : '';
    const about = profile && profile.achievements ? `\n\n${t('About me:')} ${profile.achievements}` : '';
    if (d.creatorType === 'writer') {
      return `${t('Hello {name}!')}\n\n${t('My name is {artist} and I write {genre}. I follow your reviews and recommendations ({genres}) and I think my book “{title}” could interest your audience.', params)}${when} ${t('I would be happy to send a review copy (e-book or print).')}${about}\n\n${t('Thank you for your time and best regards!')}`;
    }
    return `${t('Hi {name}!')}\n\n${t('I’m {artist} and I make {genre}. I follow your picks ({genres}) and I think “{title}” fits what you feature.', params)}${when}${about}\n\n${t('Thanks for listening – every piece of feedback means a lot!')}`;
  }

  function simulationView(sim) {
    if (!sim || !sim.runs) return '';
    return `
      <div class="panel sim">
        <h3>🎲 ${esc(t('Campaign Simulator'))} <span class="muted small">${esc(t('{n} Monte Carlo runs on real curator metrics', { n: num(sim.runs) }))}</span></h3>
        <div class="sim-grid">
          <div><span class="muted small">${esc(t('Cautious scenario (p10)'))}</span><b>${esc(t('{n} placements', { n: num(sim.placements.p10) }))}</b><span class="muted small">${esc(t('reach'))} ${num(sim.reach.p10)}</span></div>
          <div class="sim-mid"><span class="muted small">${esc(t('Most likely (p50)'))}</span><b>${esc(t('{n} placements', { n: num(sim.placements.p50) }))}</b><span class="muted small">${esc(t('reach'))} ${num(sim.reach.p50)}</span></div>
          <div><span class="muted small">${esc(t('Optimistic (p90)'))}</span><b>${esc(t('{n} placements', { n: num(sim.placements.p90) }))}</b><span class="muted small">${esc(t('reach'))} ${num(sim.reach.p90)}</span></div>
        </div>
        <div class="tags">
          <span class="tag">${esc(t('at least 1 placement: {n}%', { n: sim.chance.atLeast1 }))}</span>
          <span class="tag">${esc(t('at least 3: {n}%', { n: sim.chance.atLeast3 }))}</span>
          <span class="tag">${esc(t('at least 5: {n}%', { n: sim.chance.atLeast5 }))}</span>
          ${sim.levelUpChance !== null && sim.levelUpChance !== undefined ? `<span class="tag tag-ok">${esc(t('chance to reach “{level}”: {n}%', { level: sim.nextLevel || '', n: sim.levelUpChance }))}</span>` : ''}
        </div>
      </div>`;
  }

  function planView(plan, { forCampaign = null } = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const phases = plan.phases || [];
    const items = [
      ...plan.waves.map((w, i) => ({ kind: 'wave', i, date: w.date, phase: w.phase || 'E', w })),
      ...plan.tasks.map((x) => ({ kind: 'task', date: x.date, phase: x.phase || 'E', t: x })),
    ].sort((a, b) => a.phase.localeCompare(b.phase) || a.date.localeCompare(b.date));
    const byPhase = {};
    for (const e of items) (byPhase[e.phase] = byPhase[e.phase] || []).push(e);
    const doneCount = plan.tasks.filter((x) => x.done).length;
    const item = (e) => (e.kind === 'wave' ? `
          <div class="tl tl-wave${e.w.domino ? ' tl-domino' : ''}${e.w.sent ? ' done' : ''}">
            <div class="tl-date">${esc(e.date)}</div>
            <div>
              <b>${e.w.domino ? '🁢' : '🎼'} ${esc(e.w.name)}</b> ${e.w.sent ? `<span class="yes small">${esc(t('sent'))}</span>` : (forCampaign ? `<button class="btn small" data-send="${e.i}">${esc(t('Send now'))}</button>` : `<span class="muted small">${esc(t('sends automatically'))}</span>`)}
              <div class="muted small">${esc(e.w.how)}</div>
              <div class="tags">${e.w.outlets.map((o) => `<a class="tag" href="#/outlet/${esc(o.id)}">${esc(o.name)} · ${esc(META.models[o.model]?.label || '')}</a>`).join('')}</div>
            </div>
          </div>` : `
          <div class="tl${e.t.done ? ' done' : ''}${e.t.id.startsWith('ent-') ? ' tl-entity' : ''}${!e.t.done && e.date < today && forCampaign ? ' late' : ''}">
            <div class="tl-date">${esc(e.date)}${e.t.catchUp ? `<br><span class="small warn-text">${esc(t('catch up'))}</span>` : ''}</div>
            <div>
              ${forCampaign ? `<label class="check"><input type="checkbox" data-task="${esc(e.t.id)}" ${e.t.done ? 'checked' : ''}> <b>${esc(e.t.name)}</b></label>` : `<b>${esc(e.t.name)}</b>`}
              <span class="tag">${esc(e.t.group)}</span>${e.t.country ? ` <span class="tag">📍 ${esc(country(e.t.country))}</span>` : ''}
              <div class="muted small">${esc(e.t.how)} ${e.t.url ? `<a href="${esc(e.t.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(t('open ↗'))}</a>` : ''}</div>
            </div>
          </div>`);
    return `
      <div class="stats">
        <div class="stat"><b>${plan.waves.reduce((a, w) => a + w.outlets.length, 0)}</b><span>${esc(t('outlets in {n} waves', { n: plan.waves.length }))}</span></div>
        <div class="stat"><b>${(plan.sections || []).length}</b><span>${esc(t('orchestra sections'))}</span></div>
        <div class="stat"><b>${plan.tasks.length}</b><span>${esc(t('A–Z tasks'))}${forCampaign ? ` (${esc(t('done: {n}', { n: doneCount }))})` : ''}</span></div>
        <div class="stat"><b>~${num(plan.forecast.reach)}</b><span>${esc(t('expected reach'))}</span></div>
        <div class="stat"><b>${money(plan.spentPLN)}</b><span>${esc(t('upfront cost'))}</span></div>
      </div>
      ${simulationView(plan.simulation)}
      ${(phases.length ? phases : [{ id: 'E', name: t('Plan'), goal: '' }]).filter((ph) => byPhase[ph.id]).map((ph) => `
        <details class="phase" ${forCampaign ? '' : 'open'}>
          <summary><span class="phase-id">${esc(ph.id)}</span> <b>${esc(ph.name)}</b> <span class="muted small">${esc(ph.goal)} · ${esc(t('{n} items', { n: byPhase[ph.id].length }))}</span></summary>
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
      <h1>🎼 ${esc(t('Master Conductor'))}</h1>
      <p class="lead muted">${esc(t('One form, the whole orchestra from A to Z: the best outlets within your budget, a plan of 45–60 tasks in 9 phases (from foundation to scaling), official channels, the Global Database, an outcome simulation and automatic submission waves at the best moment.'))}</p>
      <form class="form" id="cf">
        <div class="field"><label>${esc(t('Who are you?'))}</label>${creatorSelect(ct)}</div>
        <div class="row">
          <div class="field"><label>${esc(t('Creator name'))} *</label><input name="artistName" required value="${esc(p.name || profile.artistName)}"></div>
          <div class="field"><label>${esc(t('E-mail'))} *</label><input name="artistEmail" type="email" required value="${esc(p.contactEmail || profile.artistEmail)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>${esc(t('Title ({work})', { work: ci.work }))} *</label><input name="trackTitle" required maxlength="160"></div>
          <div class="field"><label>${esc(t('Genre'))} *</label><select name="genre" required>${genreOptions(ct, ci.genres.includes(savedGenre) ? savedGenre : '', t('Choose'))}</select></div>
        </div>
        <div class="field"><label>${esc(t('Link ({hint})', { hint: ci.workUrlHint }))} *</label><input name="trackUrl" type="url" required placeholder="https://"></div>
        <div class="row">
          <div class="field"><label>${esc(t('Release date'))} *</label><input name="releaseDate" type="date" required value="${releaseDefault}"><div class="hint">${esc(ct === 'writer' ? t('Ideally 10 weeks from today – enough time for review copies.') : t('Ideally 6 weeks from today – enough time for radio and editorial pitching.'))} ${esc(t('Overdue tasks go to “catch up”.'))}</div></div>
          <div class="field"><label>${esc(t('Budget for review fees (PLN)'))}</label><input name="budgetPLN" type="number" min="0" step="1" value="0"><div class="hint">${esc(t('0 = commission, free and barter outlets only. You pay for results.'))}</div></div>
        </div>
        <div class="field"><label>${esc(t('Pitch to curators'))} <button class="btn small ghost" type="button" id="genPitch">✨ ${esc(t('Generate'))}</button></label>
          <textarea name="message" maxlength="2000" rows="7" placeholder="${esc(t('{name} and {genres} are replaced for each curator.'))}"></textarea></div>
        <div class="cta-row"><button class="btn" type="button" id="previewBtn">🎲 ${esc(t('Show the A–Z plan and simulation'))}</button></div>
        <div id="plan"></div>
        <label class="check"><input type="checkbox" name="acceptTerms" required> ${esc(t('I accept the collaboration terms of the outlets in the plan and will report revenue during commission agreements.'))}</label>
        <button class="btn primary" type="submit">🚀 ${esc(t('Launch campaign'))}</button>
      </form>`;
    const form = document.getElementById('cf');
    form.querySelector('[data-creator]').addEventListener('change', (e) => { creator.set(e.target.value); viewCampaign(); });
    document.getElementById('genPitch').addEventListener('click', () => {
      form.querySelector('[name=message]').value = generatePitch(formData(form), p);
    });
    const preview = async () => {
      const d = formData(form);
      if (!d.genre) throw new Error(t('Choose a genre.'));
      const plan = await api('POST', '/api/campaigns/preview', { creatorType: d.creatorType, genre: d.genre, releaseDate: d.releaseDate, budgetPLN: d.budgetPLN }, key ? { 'x-artist-key': key } : {});
      document.getElementById('plan').innerHTML = plan.waves.length
        ? `<div class="panel"><h2>${esc(t('A–Z campaign plan'))}</h2>${planView(plan)}</div>`
        : `<div class="notice warn">${esc(t('No matching outlets – change the genre or raise the budget.'))}</div>`;
    };
    document.getElementById('previewBtn').addEventListener('click', () => preview().catch((e) => toast(e.message, true)));
    onSubmit(form, async (d) => {
      if (!d.message) d.message = generatePitch(d, p);
      const body = { ...d, acceptTerms: d.acceptTerms === 'on' };
      if (key) body.artistKey = key;
      const r = await api('POST', '/api/campaigns', body);
      storage.set('artistKey', r.artistKey);
      storage.set('artistProfile', { artistName: d.artistName, artistEmail: d.artistEmail });
      const sent = r.campaign.results.sent;
      app.innerHTML = `
        <h1>${esc(t('Your campaign is live!'))} 🎼</h1>
        <div class="notice ok">“${esc(r.campaign.trackTitle)}”: ${esc(t('{w} waves, {o} outlets.', { w: r.campaign.waves.length, o: r.campaign.waves.reduce((a, w) => a + w.outlets.length, 0) }))} ${esc(sent ? t('The first {n} submissions are already sent.', { n: sent }) : t('The first wave goes out automatically on its date.'))}</div>
        ${key ? '' : `<div class="notice warn"><b>${esc(t('Save your creator key'))}</b> – ${esc(t('it gives access to your panel from another device:'))}<br><br><span class="key">${esc(r.artistKey)}</span></div>`}
        <div class="cta-row"><a class="btn primary" href="#/creator">${esc(t('Go to your panel'))}</a><button class="btn" id="ics">📅 ${esc(t('Add to calendar'))}</button></div>`;
      document.getElementById('ics').addEventListener('click', () => downloadIcs(r.campaign));
    });
  }

  async function viewChannels() {
    const ct = creator.get();
    const groups = {};
    for (const c of META.channels.filter((x) => x.for.includes(ct))) (groups[c.group] = groups[c.group] || []).push(c);
    const { entities } = await api('GET', `/api/entities?creator=${encodeURIComponent(ct)}`);
    const when = (c) => (c.offsetDays < 0 ? t('{n} days before release', { n: -c.offsetDays }) : c.offsetDays === 0 ? t('on release day') : t('{n} days after release', { n: c.offsetDays }));
    app.innerHTML = `
      <h1>${esc(t('Promotion channels'))}</h1>
      <p class="muted">${esc(t('Free official platform tools and verified entities from the Global Database to use alongside your campaign. The Master Conductor adds them to your A–Z plan automatically. Platform rules change – always check at the source.'))}</p>
      <div class="filters single">${creatorSelect(ct)}</div>
      ${Object.entries(groups).map(([g, list]) => `
        <h2>${esc(g)}</h2>
        <div class="grid">${list.map((c) => `
          <div class="card">
            <div class="card-head"><h3>${esc(c.name)}</h3><span class="model model-${c.cost === 'free' ? 'free' : 'fee'}">${esc(c.cost === 'free' ? t('free') : t('paid'))}</span></div>
            <div class="meta"><span>📍 ${esc(c.region)}</span><span>⚡ ${esc(t('impact'))} ${'●'.repeat(c.impact)}${'○'.repeat(5 - c.impact)}</span><span>⏱ ${esc(when(c))}</span></div>
            <p class="muted">${esc(c.how)}</p>
            <div class="actions"><a class="btn small ghost" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(t('Open ↗'))}</a></div>
          </div>`).join('')}</div>`).join('')}
      <h2>🌍 ${esc(t('Global Database – verified entities ({n})', { n: entities.length }))}</h2>
      ${entities.length ? `<div class="grid">${entities.map((e) => `
        <div class="card">
          <div class="card-head"><h3>${esc(e.name)}</h3><span class="tag">${esc(META.submissionModes[e.submission] || e.submission)}</span></div>
          <div class="meta"><span>${esc(META.entityKinds[e.kind] || e.kind)}</span><span>📍 ${esc(country(e.country))}</span><span>${esc(t('level {n}+', { n: e.tier || 1 }))}</span></div>
          <p class="muted">${esc(e.note || '')}</p>
          <div class="actions"><a class="btn small ghost" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(t('Open ↗'))}</a></div>
        </div>`).join('')}</div>` : `<p class="muted">${esc(t('The admin is verifying more entities – they will appear here and in your A–Z plan.'))}</p>`}`;
    app.querySelector('[data-creator]').addEventListener('change', (e) => { creator.set(e.target.value); viewChannels(); });
  }

  async function viewEpk(slug) {
    const d = await api('GET', `/api/artists/${encodeURIComponent(slug)}`);
    const p = d.profile;
    const linkNames = { spotify: 'Spotify', youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', soundcloud: 'SoundCloud', website: t('Website') };
    const bio = LANG === 'en' && p.bioEn ? p.bioEn : p.bio;
    app.innerHTML = `
      <div class="epk">
        ${p.photoUrl ? `<img class="epk-photo" src="${esc(p.photoUrl)}" alt="${esc(p.name)}" referrerpolicy="no-referrer">` : '<div class="epk-photo placeholder">♪</div>'}
        <div>
          <div class="muted">${esc(t('Press kit · Promo Hub'))}</div>
          <h1>${esc(p.name)}</h1>
          <p><span class="level">${esc(t('Level {n}: {name}', { n: d.level, name: d.levelName }))}</span> ${p.city || p.country ? `<span class="muted">📍 ${esc([p.city, p.country].filter(Boolean).join(', '))}</span>` : ''}</p>
          <div class="tags">${(p.genres || []).map((g) => `<span class="tag">${esc(genre(g))}</span>`).join('')}</div>
          <p class="cta-row">${Object.entries(p.links || {}).filter(([, u]) => u).map(([k, u]) => `<a class="btn small" href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${esc(linkNames[k] || k)} ↗</a>`).join('')}</p>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><b>${num(d.metrics.placements)}</b><span>${esc(t('placements'))}</span></div>
        <div class="stat"><b>${num(d.metrics.reach)}</b><span>${esc(t('placement reach'))}</span></div>
        <div class="stat"><b>${num(d.metrics.countries)}</b><span>${esc(t('countries'))}</span></div>
        <div class="stat"><b>${num(d.metrics.listeners)}</b><span>${esc(t('listeners / readers per month'))}</span></div>
      </div>
      <div class="split">
        <div class="panel"><h2>${esc(t('Bio'))}</h2><p>${bio ? esc(bio) : '<span class="muted">—</span>'}</p>${p.achievements ? `<h3>${esc(t('Achievements'))}</h3><p>${esc(p.achievements)}</p>` : ''}</div>
        <div class="panel"><h2>${esc(t('Featured by'))}</h2>${d.placements.length ? d.placements.map((x) => `<p><b>${esc(x.trackTitle)}</b> → ${esc(x.outletName)} <span class="muted small">${esc(META.types[x.outletType] || '')}${x.country ? ` · ${esc(country(x.country))}` : ''}</span>${x.placementUrl ? ` <a href="${esc(x.placementUrl)}" target="_blank" rel="noopener noreferrer nofollow">↗</a>` : ''}</p>`).join('') : `<p class="muted">${esc(t('First placements on the way.'))}</p>`}</div>
      </div>`;
  }

  // ---------- creator panel ----------
  function autopilotView(ap) {
    if (!ap || !ap.actions.length) return '';
    const icon = { profile: '👤', campaign: '🎼', task: '✅', revenue: '💰', feedback: '💬', level: '📈', entity: '🌍' };
    return `
      <div class="panel autopilot">
        <h2>🧭 ${esc(t('Autopilot – your next moves'))}</h2>
        <p class="muted small">${esc(t('Ranked by impact on your career: campaigns, A–Z plan, settlements, profile, level goals and the Global Database.'))}</p>
        <ol class="actions-list">${ap.actions.map((a) => `
          <li>
            <div class="sub-head"><b>${icon[a.kind] || '•'} ${esc(a.title)}</b>
              <span>${a.taskId ? `<button class="btn small" data-ap-done="${esc(a.campaignId)}|${esc(a.taskId)}">${esc(t('Done'))}</button>` : ''}
              ${a.url ? `<a class="btn small ghost" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(t('Open ↗'))}</a>` : ''}
              ${a.link ? `<a class="btn small ghost" href="${esc(a.link)}">${esc(t('Go →'))}</a>` : ''}</span></div>
            <div class="muted small">${esc(a.why || '')}</div>
            ${a.suggestions && a.suggestions.length ? `<div class="tags">${a.suggestions.map((o) => `<a class="tag" href="#/outlet/${esc(o.id)}">${esc(o.name)}${o.country ? ` · ${esc(country(o.country))}` : ''}</a>`).join('')}</div>` : ''}
          </li>`).join('')}</ol>
      </div>`;
  }

  function careerView(career) {
    const n = career.next;
    return `
      <div class="panel career">
        <div class="levels">${career.levels.map((l) => `<div class="lvl${l.level === career.level ? ' current' : ''}${l.level < career.level ? ' passed' : ''}"><b>${l.level}</b><span>${esc(l.name)}</span></div>`).join('')}</div>
        <h2>${esc(t('You are at level {n}: {name}', { n: career.level, name: career.name }))}</h2>
        ${n ? `
          <p class="muted">${esc(t('Goal for level {n} ({name}): {goal}', { n: n.level, name: n.name, goal: n.goal }))}</p>
          <div class="score"><span>${n.percent}%</span><progress max="100" value="${n.percent}"></progress></div>
          <div class="tags">${n.progress.map((x) => `<span class="tag${x.done ? ' tag-ok' : ''}">${x.done ? '✓' : '○'} ${esc(x.label)}: ${num(x.value)} / ${num(x.target)}</span>`).join('')}</div>`
        : `<p class="yes">${esc(t('Top level – keep the rhythm and open new markets.'))}</p>`}
        <h3>${esc(t('Next steps'))}</h3>
        <ol>${career.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <div class="cta-row"><a class="btn primary" href="#/campaign">🎼 ${esc(t('New campaign'))}</a></div>
      </div>`;
  }

  const LINK_KEYS = ['spotify', 'youtube', 'instagram', 'tiktok', 'soundcloud', 'website'];

  function profileForm(p = {}) {
    const l = p.links || {};
    return `
      <form class="form" id="pf">
        <div class="field"><label>${esc(t('Creator type'))}</label>${creatorSelect(p.creatorType || creator.get())}</div>
        <div class="row">
          <div class="field"><label>${esc(t('Creator / author name'))} *</label><input name="name" required maxlength="120" value="${esc(p.name)}"></div>
          <div class="field"><label>${esc(t('Press e-mail (not public)'))}</label><input name="contactEmail" type="email" value="${esc(p.contactEmail)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>${esc(t('Country'))}</label><input name="country" value="${esc(p.country)}"></div>
          <div class="field"><label>${esc(t('City'))}</label><input name="city" value="${esc(p.city)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>${esc(t('Photo (URL)'))}</label><input name="photoUrl" type="url" value="${esc(p.photoUrl)}"></div>
          <div class="field"><label>${esc(t('Monthly listeners / readers (total)'))}</label><input name="monthlyListeners" type="number" min="0" value="${esc(p.monthlyListeners ?? 0)}"></div>
        </div>
        <div class="field"><label>${esc(t('Genres'))}</label><select name="genres" multiple size="5">${META.genres.map((g) => `<option value="${esc(g)}"${(p.genres || []).includes(g) ? ' selected' : ''}>${esc(genre(g))}</option>`).join('')}</select></div>
        <div class="field"><label>${esc(t('Bio (your language)'))}</label><textarea name="bio" maxlength="3000">${esc(p.bio)}</textarea></div>
        <div class="field"><label>${esc(t('Bio (English) – for international outlets'))}</label><textarea name="bioEn" maxlength="3000">${esc(p.bioEn)}</textarea></div>
        <div class="field"><label>${esc(t('Achievements (used in your pitch)'))}</label><textarea name="achievements" maxlength="2000">${esc(p.achievements)}</textarea></div>
        <div class="row">${LINK_KEYS.map((k) => `<div class="field"><label>${esc(k)}</label><input name="link_${k}" type="url" value="${esc(l[k])}" placeholder="https://"></div>`).join('')}</div>
        <button class="btn primary" type="submit">${esc(t('Save profile'))}</button>
      </form>`;
  }

  async function viewCreator() {
    const key = storage.get('artistKey');
    if (!key) {
      app.innerHTML = `
        <h1>${esc(t('Creator Path'))}</h1>
        <p class="lead muted">${esc(t('From your first work to the international stage: 5 levels, measurable goals and a plan of next steps.'))}</p>
        <div class="split">
          <div class="panel"><h2>${esc(t('I’m starting'))}</h2><p class="muted">${esc(t('Create your profile and press kit – you can launch a campaign in minutes.'))}</p><button class="btn primary" id="reg">${esc(t('Create a creator profile'))}</button></div>
          <div class="panel"><h2>${esc(t('I have a key'))}</h2>
            <form class="form" id="kf"><div class="field"><label>${esc(t('Creator key'))}</label><input name="key" required minlength="16"></div><button class="btn" type="submit">${esc(t('Log in'))}</button></form></div>
        </div>`;
      onSubmit(document.getElementById('kf'), async (d) => {
        await api('GET', '/api/artist/me', null, { 'x-artist-key': d.key.trim() });
        storage.set('artistKey', d.key.trim());
        viewCreator();
      });
      document.getElementById('reg').addEventListener('click', async () => {
        try {
          const r = await api('POST', '/api/artist/register');
          storage.set('artistKey', r.artistKey);
          storage.set('newArtist', true);
          viewCreator();
        } catch (e) { toast(e.message, true); }
      });
      return;
    }
    const h = { 'x-artist-key': key };
    let me = null;
    try {
      me = await api('GET', '/api/artist/me', null, h);
    } catch (e) {
      if (!storage.get('newArtist')) { storage.del('artistKey'); toast(e.message, true); return viewCreator(); }
    }
    const [subs, camps, ap] = await Promise.all([
      api('GET', '/api/artist/submissions', null, h).then((r) => r.submissions).catch(() => []),
      api('GET', '/api/artist/campaigns', null, h).then((r) => r.campaigns).catch(() => []),
      api('GET', '/api/artist/next-actions', null, h).catch(() => null),
    ]);
    const profile = me && me.profile;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const due = subs.reduce((a, s) => a + s.settlement.duePLN, 0);
    const draft = profile || { name: storage.get('artistProfile', {}).artistName };
    app.innerHTML = `
      <div class="sub-head"><h1>${esc(profile ? profile.name : t('Creator panel'))}</h1>
        <span>${profile ? `<a class="btn small" href="#/creator/${esc(profile.slug)}">${esc(t('My press kit ↗'))}</a>` : ''} <button class="btn small ghost" id="logout">${esc(t('Log out'))}</button></span></div>
      ${storage.get('newArtist') && !profile ? `<div class="notice warn"><b>${esc(t('Save your creator key'))}</b> – ${esc(t('it is the only access to your panel:'))}<br><br><span class="key">${esc(key)}</span></div>` : ''}
      ${autopilotView(ap)}
      ${me ? careerView(me.career) : ''}
      <details ${profile ? '' : 'open'}><summary><b>${esc(profile ? t('Edit profile and press kit') : t('Step 1: complete your profile and press kit'))}</b></summary><div class="panel">${profileForm(draft)}</div></details>
      <h2>${esc(t('Campaigns'))}</h2>
      ${camps.length ? '' : `<div class="empty">${esc(t('No campaigns yet.'))} <a href="#/campaign">${esc(t('Launch your first'))}</a> – ${esc(t('a €0 budget is enough.'))}</div>`}
      ${camps.map((c) => `
        <div class="panel" data-campaign="${esc(c.id)}">
          <div class="sub-head"><h3>🎼 ${esc(c.trackTitle)} <span class="muted small">${esc(t('release {date}', { date: c.releaseDate }))}</span></h3>
            <span><span class="level">${esc(t('Orchestra strength: {n}/100', { n: c.orchestraScore }))}</span> <button class="btn small" data-ics="${esc(c.id)}">📅 .ics</button></span></div>
          <p class="muted small">${esc(t('Sent {s} submissions · placements: {p} · placement reach: {r}', { s: c.results.sent, p: c.results.placed.length, r: num(c.results.reachPlaced) }))}</p>
          <details><summary>${esc(t('A–Z plan, waves and simulation'))}</summary>${planView(c, { forCampaign: c })}</details>
        </div>`).join('')}
      <h2>${esc(t('Submissions'))} ${due ? `<span class="muted small">· ${esc(t('commissions due: {n}', { n: money(due) }))}</span>` : ''}</h2>
      ${subs.length ? '' : `<p class="muted">${esc(t('No submissions yet.'))}</p>`}
      ${subs.map((s) => `
        <div class="sub">
          <div class="sub-head">
            <div><b>${esc(s.trackTitle)}</b> → <a href="#/outlet/${esc(s.outletId)}">${esc(s.outletName)}</a> <span class="muted small">· ${date(s.createdAt)}${s.campaignId ? ` · ${esc(t('campaign'))}` : ''}</span></div>
            ${statusBadge(s.status)}
          </div>
          <p class="small">${modelBadge(s.agreement)} ${s.reviewFee ? `<span class="muted">${esc(t('review fee:'))} ${money(s.reviewFee.amountPLN)}</span>` : ''}</p>
          ${s.curatorNote ? `<p class="notice">💬 ${esc(s.curatorNote)}</p>` : ''}
          ${s.scheduledFor ? `<p class="small">📅 ${esc(t('Scheduled: {date}', { date: s.scheduledFor }))}</p>` : ''}
          ${s.placementUrl ? `<p class="small">🔗 <a href="${esc(s.placementUrl)}" target="_blank" rel="noopener noreferrer nofollow">${esc(t('See the placement'))}</a></p>` : ''}
          ${['new', 'listening'].includes(s.status) ? `<button class="btn small ghost" data-withdraw="${esc(s.id)}">${esc(t('Withdraw submission'))}</button>` : ''}
          ${s.settlement.agreementTo ? `
            <p class="muted small">${esc(t('Commission agreement: {from} – {to} · {rate}% of revenue', { from: s.settlement.agreementFrom, to: s.settlement.agreementTo, rate: s.agreement.ratePercent }))}</p>
            ${revenueTable(s)}
            <form class="inline-form" data-rev="${esc(s.id)}">
              <div class="field"><label>${esc(t('Month'))}</label><input name="period" type="month" required value="${thisMonth}"></div>
              <div class="field"><label>${esc(t('Total revenue of the work (PLN)'))}</label><input name="amountPLN" type="number" min="0" step="0.01" required></div>
              <div class="field"><label>${esc(t('Notes'))}</label><input name="note" maxlength="500" placeholder="${esc(t('e.g. Spotify + YouTube'))}"></div>
              <button class="btn" type="submit">${esc(t('Report revenue'))}</button>
            </form>` : ''}
        </div>`).join('')}`;

    document.getElementById('logout').addEventListener('click', () => { storage.del('artistKey'); storage.del('newArtist'); viewCreator(); });
    const pf = document.getElementById('pf');
    onSubmit(pf, async (d) => {
      const links = {};
      for (const k of LINK_KEYS) links[k] = d[`link_${k}`] || '';
      creator.set(d.creatorType);
      await api('PUT', '/api/artist/profile', {
        creatorType: d.creatorType, name: d.name, contactEmail: d.contactEmail, country: d.country, city: d.city, photoUrl: d.photoUrl,
        monthlyListeners: d.monthlyListeners || 0, bio: d.bio, bioEn: d.bioEn, achievements: d.achievements, links,
        genres: [...pf.querySelector('[name=genres]').selectedOptions].map((x) => x.value),
      }, h);
      storage.del('newArtist');
      toast(t('Profile saved.'));
      viewCreator();
    });
    app.querySelectorAll('[data-ap-done]').forEach((b) => b.addEventListener('click', async () => {
      const [cid, tid] = b.dataset.apDone.split('|');
      try { await api('PATCH', `/api/campaigns/${cid}/tasks/${tid}`, { done: true }, h); toast(t('Done – the next move is waiting.')); viewCreator(); } catch (e) { toast(e.message, true); }
    }));
    app.querySelectorAll('[data-ics]').forEach((b) => b.addEventListener('click', () => downloadIcs(camps.find((c) => c.id === b.dataset.ics))));
    app.querySelectorAll('[data-campaign]').forEach((el) => {
      const cid = el.dataset.campaign;
      el.querySelectorAll('[data-task]').forEach((cb) => cb.addEventListener('change', async () => {
        try { await api('PATCH', `/api/campaigns/${cid}/tasks/${cb.dataset.task}`, { done: cb.checked }, h); toast(t('Saved – orchestra strength is growing.')); } catch (e) { toast(e.message, true); }
      }));
      el.querySelectorAll('[data-send]').forEach((b) => b.addEventListener('click', async () => {
        try { await api('POST', `/api/campaigns/${cid}/waves/${b.dataset.send}/send`, null, h); toast(t('Wave sent.')); viewCreator(); } catch (e) { toast(e.message, true); }
      }));
    });
    app.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(t('Withdraw this submission?'))) return;
      try { await api('PATCH', `/api/submissions/${b.dataset.withdraw}`, { status: 'withdrawn' }, h); viewCreator(); } catch (e) { toast(e.message, true); }
    }));
    app.querySelectorAll('form[data-rev]').forEach((f) => onSubmit(f, async (d) => {
      const r = await api('POST', `/api/submissions/${f.dataset.rev}/revenue`, d, h);
      let msg;
      if (r.pool.size > 1) {
        msg = t('Effect Pool: {n} curators, {total} in total.', { n: r.pool.size, total: money(r.pool.totalCommissionPLN) });
        if (r.pool.factor < 1) msg += ` ${t('The {cap}% cap protects your revenue.', { cap: r.pool.capPercent })}`;
      } else {
        msg = r.entry.inAgreement ? t('Commission due: {n}', { n: money(r.entry.commissionPLN) }) : t('Outside the agreement period – no commission.');
      }
      toast(msg);
      viewCreator();
    }));
  }

  // ---------- curators ----------
  function outletFormFields(o = {}) {
    const c = o.collaboration || { model: 'commission', ratePercent: 10, durationMonths: 6 };
    const levels = { 1: t('1 – Newcomer (everyone)'), 2: t('2 – Local'), 3: t('3 – National'), 4: t('4 – International'), 5: t('5 – Global') };
    return `
      <div class="row">
        <div class="field"><label>${esc(t('Name'))} *</label><input name="name" required maxlength="120" value="${esc(o.name)}"></div>
        <div class="field"><label>${esc(t('Type'))} *</label><select name="type" required>${options(META.types, o.type || 'playlist')}</select></div>
      </div>
      <div class="row">
        <div class="field"><label>${esc(t('Link (playlist, station, channel)'))} *</label><input name="url" type="url" required value="${esc(o.url)}"></div>
        <div class="field"><label>${esc(t('Contact e-mail'))} *</label><input name="contactEmail" type="email" required value="${esc(o.contactEmail)}"></div>
      </div>
      <div class="row">
        <div class="field"><label>${esc(t('Reach (followers / listeners)'))}</label><input name="reach" type="number" min="0" value="${esc(o.reach ?? '')}"></div>
        <div class="field"><label>${esc(t('Response deadline (days)'))}</label><input name="responseDays" type="number" min="1" max="90" value="${esc(o.responseDays ?? 7)}"></div>
      </div>
      <div class="field"><label>${esc(t('I accept submissions from'))}</label>
        <div class="checks">${Object.entries(META.creators).map(([k, cr]) => `<label class="check"><input type="checkbox" name="ct_${esc(k)}" ${(o.creatorTypes || ['music']).includes(k) ? 'checked' : ''}> ${esc(cr.label)}</label>`).join('')}</div></div>
      <div class="field"><label>${esc(t('Minimum creator level (Access Ladder)'))}</label>
        <select name="minLevel">${options(levels, String(o.minLevel || 1))}</select>
        <div class="hint">${esc(t('Big outlets can accept only creators with documented results – fewer random submissions, and creators get a goal to work towards.'))}</div></div>
      <div class="row">
        <div class="field"><label>${esc(t('Country (e.g. PL, DE, US)'))}</label><input name="country" maxlength="60" value="${esc(o.country)}"></div>
        <div class="field"><label>${esc(t('Language'))}</label><input name="language" maxlength="60" value="${esc(o.language)}"></div>
      </div>
      <div class="field"><label>${esc(t('Genres (Ctrl/Cmd to select several; none = all)'))}</label>
        <select name="genres" multiple size="6">${META.genres.map((g) => `<option value="${esc(g)}"${(o.genres || []).includes(g) ? ' selected' : ''}>${esc(genre(g))}</option>`).join('')}</select></div>
      <div class="field"><label>${esc(t('Description'))}</label><textarea name="description" maxlength="2000">${esc(o.description)}</textarea></div>
      <fieldset>
        <legend>${esc(t('Collaboration terms'))}</legend>
        <div class="row">
          <div class="field"><label>${esc(t('Model'))}</label><select name="model" id="modelSel">${options(META.models, c.model)}</select></div>
          <div class="field" data-for="percent"><label>${esc(t('Commission / share (%)'))}</label><input name="ratePercent" type="number" min="1" max="50" value="${esc(c.ratePercent || 10)}"></div>
        </div>
        <div class="row">
          <div class="field" data-for="percent"><label>${esc(t('Agreement length (months)'))}</label><input name="durationMonths" type="number" min="1" max="36" value="${esc(c.durationMonths || 6)}"></div>
          <div class="field" data-for="fee"><label>${esc(t('Review fee (PLN)'))}</label><input name="feePLN" type="number" min="1" value="${esc(c.feePLN || 10)}"></div>
        </div>
        <div class="field"><label>${esc(t('Detailed terms'))}</label><textarea name="terms" maxlength="2000">${esc(c.terms)}</textarea></div>
        <p class="hint muted small" id="modelDesc"></p>
        <p class="hint muted small">${esc(t('The platform keeps {n}% of every commission and fee – the rest is yours.', { n: META.platformFeePercent }))}</p>
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

  async function viewCurators() {
    const session = storage.get('curator');
    if (session) return viewCuratorInbox(session);
    app.innerHTML = `
      <h1>${esc(t('For curators, stations and creators'))}</h1>
      <p class="lead muted">${esc(t('Run a playlist, radio show, channel, blog, podcast, magazine or record pool? Join and earn by promoting work you genuinely like. You choose the model: commission on the work’s revenue, revenue share, review fee or barter.'))}</p>
      <div class="split">
        <div class="panel">
          <h2>${esc(t('List your outlet'))}</h2>
          <form class="form" id="of">${outletFormFields()}<button class="btn primary" type="submit">${esc(t('Add to the catalog'))}</button></form>
        </div>
        <div class="panel">
          <h2>${esc(t('I already have an account'))}</h2>
          <form class="form" id="lf">
            <div class="field"><label>${esc(t('Outlet ID'))}</label><input name="id" required placeholder="out_…"></div>
            <div class="field"><label>${esc(t('Curator key'))}</label><input name="key" required></div>
            <button class="btn" type="submit">${esc(t('Open the submission inbox'))}</button>
          </form>
        </div>
      </div>`;
    const of = document.getElementById('of');
    bindModelToggle(of);
    onSubmit(of, async () => {
      const r = await api('POST', '/api/outlets', outletPayload(of));
      storage.set('curator', { id: r.outlet.id, key: r.manageKey });
      app.innerHTML = `
        <h1>${esc(t('Welcome to Promo Hub!'))} 🎧</h1>
        <div class="notice ok">${esc(t('“{name}” is in the catalog. After verification it gets a ✔ badge and a higher ranking.', { name: r.outlet.name }))}</div>
        <div class="notice warn"><b>${esc(t('Save your access details:'))}</b><br>ID: <span class="key">${esc(r.outlet.id)}</span><br><br>${esc(t('Curator key:'))} <span class="key">${esc(r.manageKey)}</span></div>
        <a class="btn primary" href="#/curators">${esc(t('Go to the submission inbox'))}</a>`;
    });
    onSubmit(document.getElementById('lf'), async (d) => {
      const s = { id: d.id.trim(), key: d.key.trim() };
      await api('GET', `/api/outlets/${encodeURIComponent(s.id)}/submissions`, null, { 'x-manage-key': s.key });
      storage.set('curator', s);
      viewCurators();
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
      return viewCurators();
    }
    const { outlet, submissions, totals } = d;
    const fee = META.platformFeePercent / 100;
    const open = submissions.filter((s) => ['new', 'listening'].includes(s.status));
    const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
    app.innerHTML = `
      <div class="sub-head"><h1>${esc(outlet.name)}</h1><span><a class="btn small" href="#/outlet/${esc(outlet.id)}">${esc(t('Public profile'))}</a> <button class="btn small ghost" id="logout">${esc(t('Log out'))}</button></span></div>
      <div class="stats">
        <div class="stat"><b>${open.length}</b><span>${esc(t('awaiting decision'))}</span></div>
        <div class="stat"><b>${pct(outlet.stats.acceptanceRate)}</b><span>${esc(t('accepted'))}</span></div>
        <div class="stat"><b>${pct(outlet.stats.responseRate)}</b><span>${esc(t('answered on time'))}</span></div>
        <div class="stat"><b>${money(totals.commissionPLN * (1 - fee))}</b><span>${esc(t('your earnings (net)'))}</span></div>
        <div class="stat"><b>${money(totals.duePLN * (1 - fee))}</b><span>${esc(t('awaiting payment'))}</span></div>
      </div>
      <label class="check"><input type="checkbox" id="acceptToggle" ${outlet.acceptsSubmissions ? 'checked' : ''}> ${esc(t('I accept new submissions'))}</label>
      <details><summary>${esc(t('Edit profile and terms'))}</summary><div class="panel"><form class="form" id="ef">${outletFormFields(outlet)}<button class="btn primary" type="submit">${esc(t('Save'))}</button></form></div></details>
      <br>
      <h2>${esc(t('Submissions'))}</h2>
      ${submissions.length ? '' : `<div class="empty">${esc(t('No submissions yet. Complete your genres and description to reach the right creators.'))}</div>`}
      ${submissions.map((s) => {
        const next = META.transitions[s.status] || [];
        const deadline = new Date(Date.parse(s.createdAt) + (outlet.responseDays || 7) * 864e5);
        return `
        <div class="sub">
          <div class="sub-head">
            <div><b>${esc(s.artistName)} – ${esc(s.trackTitle)}</b> <span class="muted small">${esc(s.genre ? genre(s.genre) : '')} · ${date(s.createdAt)}</span>${s.artistSlug ? ` <a class="tag" href="#/creator/${esc(s.artistSlug)}">${esc(t('press kit'))} · ${esc(s.artistLevel)}</a>` : ''}</div>
            ${statusBadge(s.status)}
          </div>
          <p><a href="${esc(s.trackUrl)}" target="_blank" rel="noopener noreferrer nofollow">▶ ${esc(t('Open the work'))}</a> · <a href="mailto:${esc(s.artistEmail)}">${esc(s.artistEmail)}</a>${s.releaseDate ? ` · ${esc(t('release {date}', { date: s.releaseDate }))}` : ''}</p>
          ${s.message ? `<p class="muted">${esc(s.message)}</p>` : ''}
          ${['new', 'listening'].includes(s.status) ? `<p class="small">⏳ ${esc(t('Reply by {date}, otherwise the submission expires.', { date: deadline.toLocaleDateString(locale()) }))}</p>` : ''}
          ${next.length ? `
            <form class="inline-form" data-sub="${esc(s.id)}">
              <div class="field"><label>${esc(t('Decision'))}</label><select name="status">${next.map((n) => `<option value="${esc(n)}">${esc(META.statuses[n])}</option>`).join('')}</select></div>
              <div class="field"><label>${esc(t('Scheduled date'))}</label><input name="scheduledFor" type="date" value="${esc(s.scheduledFor)}"></div>
              <div class="field"><label>${esc(t('Placement link'))}</label><input name="placementUrl" type="url" value="${esc(s.placementUrl)}" placeholder="https://"></div>
              <div class="field"><label>${esc(t('Feedback for the creator'))}</label><input name="curatorNote" maxlength="2000" value="${esc(s.curatorNote)}"></div>
              <button class="btn primary" type="submit">${esc(t('Save'))}</button>
            </form>` : (s.curatorNote ? `<p class="small">💬 ${esc(s.curatorNote)}</p>` : '')}
          ${s.settlement.agreementTo ? `<p class="muted small">${esc(t('Agreement: {from} – {to}, {rate}%', { from: s.settlement.agreementFrom, to: s.settlement.agreementTo, rate: s.agreement.ratePercent }))}</p>${revenueTable(s, { curatorKey: session.key })}` : ''}
        </div>`;
      }).join('')}`;

    document.getElementById('logout').addEventListener('click', () => { storage.del('curator'); viewCurators(); });
    document.getElementById('acceptToggle').addEventListener('change', async (e) => {
      try { await api('PATCH', `/api/outlets/${outlet.id}`, { acceptsSubmissions: e.target.checked }, h); toast(t('Saved.')); } catch (err) { toast(err.message, true); }
    });
    const ef = document.getElementById('ef');
    bindModelToggle(ef);
    onSubmit(ef, async () => { await api('PATCH', `/api/outlets/${outlet.id}`, outletPayload(ef), h); toast(t('Profile saved. New terms apply to new submissions only.')); viewCuratorInbox(session); });
    app.querySelectorAll('form[data-sub]').forEach((f) => onSubmit(f, async (d) => {
      await api('PATCH', `/api/submissions/${f.dataset.sub}`, d, h);
      toast(t('Decision saved.'));
      viewCuratorInbox(session);
    }));
    app.querySelectorAll('[data-paid]').forEach((b) => b.addEventListener('click', async () => {
      const [sid, rid] = b.dataset.paid.split('|');
      try { await api('PATCH', `/api/submissions/${sid}/revenue/${rid}`, { paid: true }, h); viewCuratorInbox(session); } catch (e) { toast(e.message, true); }
    }));
  }

  // ---------- admin ----------
  async function viewAdmin() {
    const token = storage.get('adminToken');
    if (!token) {
      app.innerHTML = `<h1>${esc(t('Admin panel'))}</h1><form class="form" id="af"><div class="field"><label>${esc(t('Admin token'))}</label><input name="token" type="password" required></div><button class="btn primary" type="submit">${esc(t('Log in'))}</button></form>`;
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
      <div class="sub-head"><h1>${esc(t('Admin panel'))}</h1><button class="btn small ghost" id="logout">${esc(t('Log out'))}</button></div>
      <h2>${esc(t('Your earnings (platform fee {n}%)', { n: s.platformFeePercent }))}</h2>
      <div class="stats">
        <div class="stat"><b>${money(s.earnings.totalPLN)}</b><span>${esc(t('total accrued'))}</span></div>
        <div class="stat"><b>${money(s.earnings.fromCommissionsPLN)}</b><span>${esc(t('from commissions'))}</span></div>
        <div class="stat"><b>${money(s.earnings.fromReviewFeesPLN)}</b><span>${esc(t('from review fees'))}</span></div>
        <div class="stat"><b>${money(s.earnings.duePLN)}</b><span>${esc(t('to collect'))}</span></div>
      </div>
      <div class="panel sub-head">
        <div><h2>🌍 ${esc(t('Global Entity Database'))}</h2><p class="muted">${esc(t('{n} entities · in talks: {p} · partners: {q}', { n: num(s.entities.total), p: num(s.entities.inPipeline), q: num(s.entities.partners) }))}</p></div>
        <a class="btn primary" href="#/admin/database">${esc(t('Open the database (CRM) →'))}</a>
      </div>
      <h2>${esc(t('To verify ({n})', { n: s.pendingVerification.length }))}</h2>
      ${s.pendingVerification.length ? s.pendingVerification.map((o) => `
        <div class="sub sub-head">
          <div><b>${esc(o.name)}</b> <span class="muted small">${esc(META.types[o.type])} · ${num(o.reach)} · ${esc(o.contactEmail)}</span><br><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(o.url)}</a></div>
          <span><button class="btn small primary" data-verify="${esc(o.id)}">${esc(t('Verify'))}</button> <button class="btn small ghost" data-del="${esc(o.id)}">${esc(t('Delete'))}</button></span>
        </div>`).join('') : `<p class="muted">${esc(t('Everything is verified.'))}</p>`}
      <h2>${esc(t('Top-performing outlets'))}</h2>
      <div class="panel table-wrap"><table class="compare"><thead><tr><th>${esc(t('Outlet'))}</th><th>${esc(t('Submissions'))}</th><th>${esc(t('Placements'))}</th><th>${esc(t('Accepted'))}</th><th>${esc(t('On time'))}</th></tr></thead><tbody>
        ${s.topOutlets.map((o) => `<tr><td><a href="#/outlet/${esc(o.id)}">${esc(o.name)}</a></td><td>${o.submissions}</td><td>${o.placed}</td><td>${o.acceptanceRate ?? '—'}</td><td>${o.responseRate ?? '—'}</td></tr>`).join('')}
      </tbody></table></div>`;
    document.getElementById('logout').addEventListener('click', () => { storage.del('adminToken'); viewAdmin(); });
    app.querySelectorAll('[data-verify]').forEach((b) => b.addEventListener('click', async () => {
      try { await api('PATCH', `/api/outlets/${b.dataset.verify}`, { verified: true }, h); viewAdmin(); } catch (e) { toast(e.message, true); }
    }));
    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(t('Remove this outlet from the catalog?'))) return;
      try { await api('DELETE', `/api/outlets/${b.dataset.del}`, null, h); viewAdmin(); } catch (e) { toast(e.message, true); }
    }));
  }

  // Global Entity Database (admin CRM).
  async function viewAdminEntities() {
    const token = storage.get('adminToken');
    if (!token) { location.hash = '#/admin'; return; }
    const h = { 'x-admin-token': token };
    const f = storage.get('entityFilters', { q: '', creator: '', region: '', stage: '', kind: '', submission: '' });
    app.innerHTML = `
      <div class="sub-head"><h1>🌍 ${esc(t('Global Entity Database'))}</h1><a class="btn small ghost" href="#/admin">← ${esc(t('Admin panel'))}</a></div>
      <p class="muted">${esc(t('Real entities you can work with for free, for a low fee or on commission. By default they are prospects – not partners. Verify the terms at the source, mark an entity “public” to add it to creators’ A–Z plans, or sign a deal and convert it into a catalog partner.'))}</p>
      <div id="entStats"></div>
      <form class="filters" id="ef">
        <input name="q" placeholder="${esc(t('Search: name, country, notes…'))}" value="${esc(f.q)}">
        <select name="creator">${options(META.creators, f.creator, t('All creators'))}</select>
        <select name="region">${options(META.regions, f.region, t('Any region'))}</select>
        <select name="stage">${options(META.entityStages, f.stage, t('Any stage'))}</select>
        <select name="kind">${options(META.entityKinds, f.kind, t('Any type'))}</select>
        <select name="submission">${options(META.submissionModes, f.submission, t('Any mode'))}</select>
      </form>
      <div class="cta-row">
        <button class="btn" id="exportCsv">⬇ ${esc(t('Export CSV'))}</button>
        <details class="inline"><summary class="btn">⬆ ${esc(t('Import CSV'))}</summary>
          <div class="panel"><p class="muted small">${esc(t('Columns: name, url (required), kind, creatorTypes (music|dj|writer), country (ISO code), region, submission, model, tier, reach, contactEmail, notes, notesPl, sourceUrl, evidence, confidence, lastChecked. Duplicates (same domain + name) are skipped.'))}</p>
            <input type="file" id="csvFile" accept=".csv,text/csv"><textarea id="csvText" rows="5" placeholder="${esc(t('or paste CSV'))}"></textarea><button class="btn primary" id="importCsv">${esc(t('Import'))}</button></div></details>
        <details class="inline"><summary class="btn">＋ ${esc(t('Add entity'))}</summary>
          <div class="panel"><form class="form" id="addEnt">
            <div class="row"><div class="field"><label>${esc(t('Name'))} *</label><input name="name" required></div><div class="field"><label>URL *</label><input name="url" type="url" required></div></div>
            <div class="row"><div class="field"><label>${esc(t('Type'))}</label><select name="kind">${options(META.entityKinds, 'radio')}</select></div><div class="field"><label>${esc(t('Country (ISO code, e.g. PL)'))}</label><input name="country" maxlength="2"></div></div>
            <div class="row"><div class="field"><label>${esc(t('Creators'))}</label><select name="creatorTypes">${options(META.creators, 'music')}</select></div><div class="field"><label>${esc(t('Recommended level'))}</label><select name="tier">${options({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }, '2')}</select></div></div>
            <div class="row"><div class="field"><label>${esc(t('Submission mode'))}</label><select name="submission">${options(META.submissionModes, 'contact')}</select></div><div class="field"><label>${esc(t('Proposed model'))}</label><select name="model">${options(META.models, 'free')}</select></div></div>
            <div class="row"><div class="field"><label>${esc(t('Note (EN)'))}</label><input name="notes"></div><div class="field"><label>${esc(t('Note (PL)'))}</label><input name="notesPl"></div></div>
            <button class="btn primary" type="submit">${esc(t('Add'))}</button></form></div></details>
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
          <div class="stat"><b>${num(r.total)}</b><span>${esc(t('entities in the database'))}</span></div>
          <div class="stat"><b>${num(r.countries)}</b><span>${esc(t('countries'))}</span></div>
          <div class="stat"><b>${num(st.contacted || 0)} / ${num(st.negotiation || 0)}</b><span>${esc(t('contacted / negotiating'))}</span></div>
          <div class="stat"><b>${num(st.partner || 0)}</b><span>${esc(t('partners in the catalog'))}</span></div>
          <div class="stat"><b>${num(r.facets.creatorTypes.music || 0)} · ${num(r.facets.creatorTypes.dj || 0)} · ${num(r.facets.creatorTypes.writer || 0)}</b><span>${esc(t('music · DJ · literature'))}</span></div>
        </div>`;
      list.innerHTML = `<p class="muted small">${esc(t('Results: {n}', { n: r.entities.length }))}</p>` + r.entities.map((e) => `
        <div class="sub ent" data-ent="${esc(e.id)}" data-email="${esc(e.contactEmail)}">
          <div class="sub-head">
            <div><b><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(e.name)} ↗</a></b>
              <span class="muted small">${esc(META.entityKinds[e.kind] || e.kind)} · ${esc(country(e.country))} · ${esc(META.regions[e.region] || e.region)} · ${esc(t('level {n}+', { n: e.tier || 1 }))}</span><br>
              <span class="tags">${e.creatorTypes.map((c) => `<span class="tag">${esc(META.creators[c]?.label || c)}</span>`).join('')}
                <span class="tag">${esc(META.submissionModes[e.submission])}</span><span class="model model-${esc(e.model)}">${esc(META.models[e.model]?.label || e.model)}</span></span></div>
            <div class="ent-actions">
              <select data-stage>${options(META.entityStages, e.stage)}</select>
              <label class="check small"><input type="checkbox" data-verified ${e.verified ? 'checked' : ''}> ${esc(t('verified'))}</label>
              <label class="check small"><input type="checkbox" data-public ${e.publicListing ? 'checked' : ''} ${e.verified ? '' : 'disabled'}> ${esc(t('public'))}</label>
            </div>
          </div>
          ${e.note ? `<div class="muted small">${esc(e.note)}</div>` : ''}
          <div class="cta-row">
            <button class="btn small" data-outreach="en">✉ ${esc(t('Outreach EN'))}</button>
            <button class="btn small" data-outreach="pl">✉ ${esc(t('Outreach PL'))}</button>
            ${e.outletId ? `<a class="btn small" href="#/outlet/${esc(e.outletId)}">${esc(t('In the catalog →'))}</a>` : `<button class="btn small primary" data-convert>🤝 ${esc(t('Partner → catalog'))}</button>`}
            <button class="btn small ghost" data-remove>${esc(t('Delete'))}</button>
          </div>
        </div>`).join('');
    }

    list.addEventListener('change', async (ev) => {
      const row = ev.target.closest('[data-ent]');
      if (!row) return;
      const body = {};
      if (ev.target.matches('[data-stage]')) body.stage = ev.target.value;
      if (ev.target.matches('[data-verified]')) body.verified = ev.target.checked;
      if (ev.target.matches('[data-public]')) body.publicListing = ev.target.checked;
      try {
        await api('PATCH', `/api/admin/entities/${row.dataset.ent}`, body, h);
        toast(t('Saved.'));
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
          box.innerHTML = `<div class="panel"><div class="sub-head"><h3>✉ ${esc(o.subject)}</h3><button class="btn small" id="copyOut">${esc(t('Copy'))}</button></div><textarea rows="14">${esc(o.body)}</textarea></div>`;
          document.getElementById('copyOut').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(`${o.subject}\n\n${o.body}`); toast(t('Copied.')); } catch { toast(t('Select and copy manually.'), true); }
          });
          box.scrollIntoView({ behavior: 'smooth' });
        } else if (ev.target.matches('[data-convert]')) {
          if (!confirm(t('Has this entity agreed to work with you? Create a catalog outlet?'))) return;
          const contactEmail = row.dataset.email || prompt(t('Partner contact e-mail (submissions and notifications go there):'), '');
          if (!contactEmail) return;
          const r = await api('POST', `/api/admin/entities/${id}/convert`, { contactEmail }, h);
          document.getElementById('outreach').innerHTML = `<div class="notice ok"><b>${esc(r.outlet.name)}</b> ${esc(t('is now a catalog partner. Share the curator panel access (shown only once):'))}<br><br>ID: <span class="key">${esc(r.outlet.id)}</span><br><br>${esc(t('Curator key:'))} <span class="key">${esc(r.manageKey)}</span><br><br>${esc(t('The curator sets genres, reach and exact terms in their panel.'))}</div>`;
          document.getElementById('outreach').scrollIntoView({ behavior: 'smooth' });
          load();
        } else if (ev.target.matches('[data-remove]')) {
          if (!confirm(t('Delete this entity from the database?'))) return;
          await api('DELETE', `/api/admin/entities/${id}`, null, h);
          load();
        }
      } catch (e) { toast(e.message, true); }
    });

    document.getElementById('exportCsv').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/admin/entities/export', { headers: h });
        if (!res.ok) throw new Error(t('Export failed.'));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(await res.blob());
        a.download = `global-database-${new Date().toISOString().slice(0, 10)}.csv`;
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
        toast(t('Added {a}, skipped {s}.', { a: r.added, s: r.skipped }));
        if (r.errors.length) document.getElementById('outreach').innerHTML = `<div class="notice warn">${r.errors.map(esc).join('<br>')}</div>`;
        load();
      } catch (e) { toast(e.message, true); }
    });
    onSubmit(document.getElementById('addEnt'), async (d, fm) => {
      await api('POST', '/api/admin/entities', { ...d, creatorTypes: [d.creatorTypes] }, h);
      fm.reset();
      toast(t('Entity added.'));
      load();
    });
    let timer;
    form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load().catch((e) => toast(e.message, true)), 250); });
    form.addEventListener('submit', (e) => e.preventDefault());
    await load();
  }

  // ---------- chrome: navigation, language switch, footer ----------
  const NAV = [
    ['#/campaign', () => `🎼 ${esc(t('Campaign'))}`],
    ['#/catalog', () => esc(t('Catalog'))],
    ['#/match', () => esc(t('Match'))],
    ['#/channels', () => esc(t('Channels'))],
    ['#/send', () => `${esc(t('Send'))} <span class="badge" id="cartCount" hidden>0</span>`],
    ['#/creator', () => esc(t('Creator Path'))],
    ['#/curators', () => esc(t('For curators'))],
  ];

  function renderChrome() {
    document.documentElement.lang = LANG;
    document.getElementById('nav').innerHTML = NAV.map(([href, label]) => `<a href="${href}">${label()}</a>`).join('');
    document.getElementById('langSwitch').innerHTML = ['en', 'pl'].map((l) => `<button type="button" data-lang="${l}" class="${l === LANG ? 'active' : ''}" aria-pressed="${l === LANG}">${l.toUpperCase()}</button>`).join('');
    document.getElementById('footer').innerHTML = `
      <p>${esc(t('Promo Hub · promotion built on collaboration'))} · <a href="#/admin">${esc(t('admin'))}</a></p>
      <p class="muted small">${esc(t('Paid guaranteed playlist placements break streaming platforms’ rules. On Promo Hub you pay a commission on results or a review fee – never for placement itself.'))}</p>`;
    updateCartBadge();
  }

  async function setLang(lang) {
    if (lang === LANG) return;
    LANG = lang;
    storage.set('lang', lang);
    META = await api('GET', '/api/meta');
    renderChrome();
    route();
  }

  // ---------- router ----------
  const routes = [
    [/^#?\/?$/, viewHome],
    [/^#\/(catalog|katalog)$/, viewCatalog],
    [/^#\/(match|dopasuj)$/, viewMatch],
    [/^#\/(?:outlet|miejsce)\/([\w-]+)$/, viewOutlet],
    [/^#\/(send|wyslij)$/, viewSubmit],
    [/^#\/(creator|artysta)$/, viewCreator],
    [/^#\/(?:creator|artysta)\/([\w-]+)$/, viewEpk],
    [/^#\/(campaign|kampania)$/, viewCampaign],
    [/^#\/(channels|kanaly)$/, viewChannels],
    [/^#\/(curators|kurator)$/, viewCurators],
    [/^#\/admin$/, viewAdmin],
    [/^#\/admin\/(?:database|baza)$/, viewAdminEntities],
  ];
  const ID_ROUTES = new Set([viewOutlet, viewEpk]);

  async function route() {
    const hash = location.hash || '#/';
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', hash.startsWith(a.getAttribute('href'))));
    document.getElementById('nav').classList.remove('open');
    const match = routes.find(([re]) => re.test(hash));
    if (!match) { app.innerHTML = `<div class="empty">${esc(t('Page not found.'))} <a href="#/">${esc(t('Home'))}</a></div>`; return; }
    try {
      const args = ID_ROUTES.has(match[1]) ? hash.match(match[0]).slice(1) : [];
      await match[1](...args);
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
  document.getElementById('langSwitch').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) setLang(b.dataset.lang).catch((err) => toast(err.message, true));
  });

  (async () => {
    META = await api('GET', '/api/meta');
    renderChrome();
    window.addEventListener('hashchange', route);
    route();
  })().catch((e) => { app.innerHTML = `<div class="empty">${esc(t('Could not connect to the server:'))} ${esc(e.message)}</div>`; });
})();
