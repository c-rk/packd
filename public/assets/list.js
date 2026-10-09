(async () => {
  const { h, $, ls, api, norm, rid, toast, copy, share, accent, daysTo, ago, remember } = P;
  const slug = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const root = $('#app');
  const km = location.hash.match(/k=([A-Za-z0-9]+)/);
  if (km) { ls.set('packd:k:' + slug, km[1]); history.replaceState(null, '', location.pathname); }
  const KEY = ls.get('packd:k:' + slug, '');
  const L = Object.assign({ tok: rid(16), ans: {}, ticks: {}, my: [], claims: {}, xmine: {} }, ls.get('packd:' + slug, {}));
  const persist = () => ls.set('packd:' + slug, L);
  const hdr = () => ({ 'x-tok': L.tok, ...(KEY ? { 'x-key': KEY } : {}) });
  const url = `${location.origin}/${slug}`;
  let D, cfg, view = 'front', claimsBy = {}, dyn = null, lastFetch = 0;

  async function fetchData() {
    const r = await fetch('/api/l/' + slug);
    if (r.status === 404) return false;
    if (!r.ok) throw new Error('load');
    D = await r.json();
    cfg = D.cfg;
    claimsBy = {};
    for (const c of D.c) (claimsBy[c[1]] = claimsBy[c[1]] || []).push(c);
    lastFetch = Date.now();
    accent(cfg.a);
    P.paper(cfg);
    document.title = cfg.title + ' · packd';
    remember(slug, cfg.title, !!KEY);
    return true;
  }

  const signedMe = () => !!L.sid && D.s.some((s) => s[0] === L.sid);
  const match = (it) => !it.w || Object.keys(it.w).every((q) => it.w[q].includes(L.ans[q]));

  function tree() {
    const roots = [];
    const stack = [];
    for (const it of cfg.items) {
      const d = it.d || 0;
      const parent = d ? stack[d - 1] : null;
      const ok = (parent ? parent.ok : true) && match(it);
      const node = { it, kids: [], ok, cfgKid: false };
      stack.length = d;
      stack[d] = node;
      if (parent) { parent.cfgKid = true; if (ok) parent.kids.push(node); }
      else if (ok) roots.push(node);
    }
    const prune = (ns) => ns.filter((n) => { n.kids = prune(n.kids); return !(n.cfgKid && !n.kids.length); });
    const out = prune(roots);
    const extra = [];
    for (const x of D.x) extra.push({ it: { id: x.id, t: x.t, n: x.d, q: 1, by: x.n, x: 1 }, kids: [] });
    for (const m of L.my) extra.push({ it: { id: m.id, t: m.t, n: 0, q: 1, by: 'you', local: 1 }, kids: [] });
    if (extra.length) out.push({ it: { id: '_x', t: 'Added' }, kids: extra });
    return out;
  }

  const leavesOf = (n) => (n.kids.length ? n.kids.flatMap(leavesOf) : [n]);

  function state(it) {
    if (!it.n) return 'own';
    const cl = claimsBy[it.id] || [];
    if (L.claims[it.id] && cl.some((c) => c[0] === L.claims[it.id])) return 'mine';
    return cl.length >= it.n ? 'full' : 'open';
  }

  const isNeeded = (n) => ['own', 'mine'].includes(state(n.it));
  const needed = () => tree().flatMap(leavesOf).filter(isNeeded).map((n) => n.it);

  async function call(method, path, body, headers) {
    try { return await api(method, `/l/${slug}${path}`, body, headers || hdr()); }
    catch (e) { toast(e.message); throw e; }
  }

  function backBtn(fn) {
    return h('button', { class: 'x', style: 'font-size:1.4rem;padding:4px 10px 4px 0', onclick: fn, 'aria-label': 'Back' }, '←');
  }

  function notFound() {
    document.title = 'Not found · packd';
    P.fill(root, 
      h('div', { class: 'eyebrow' }, 'packd'),
      h('h1', null, 'No list here'),
      h('p', { class: 'mut' }, `Nothing at /${slug}. Check the spelling, or make one.`),
      h('a', { class: 'btn pri', style: 'display:inline-grid;place-items:center;text-decoration:none', href: '/new' }, 'Create a list'),
    );
  }

  function footer() {
    return h('div', { class: 'foot mut' }, 'Made with ', h('a', { href: '/' }, 'packd'));
  }

  function front() {
    view = 'front';
    const dd = daysTo(cfg.date);
    let when = '';
    if (dd != null) when = dd > 1 ? `${dd} days to go` : dd === 1 ? 'Tomorrow' : dd === 0 ? 'Today' : '';
    let fmt = '';
    if (cfg.date) {
      const [y, m, d] = cfg.date.split('-').map(Number);
      fmt = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    }
    dyn = h('div');
    P.fill(root, 
      h('div', { class: 'fade' },
        h('div', { class: 'eyebrow' }, [when, fmt].filter(Boolean).join(' · ') || 'Packing list'),
        h('h1', null, cfg.title),
        cfg.note ? h('p', { class: 'mut', style: 'margin:0' }, cfg.note) : null,
        dyn,
        h('div', { style: 'margin-top:26px;display:flex;gap:10px' },
          h('button', { class: 'btn', style: 'flex:1', onclick: () => share(url, cfg.title) }, 'Share'),
          h('button', { class: 'btn', style: 'flex:1', onclick: () => copy(url) }, 'Copy link'),
        ),
        KEY ? adminCard() : null,
        footer(),
      ),
    );
    paintFront();
    window.scrollTo(0, 0);
  }

  function paintFront() {
    if (!dyn || view !== 'front') return;
    const n = D.s.length;
    const rk = new Set(cfg.roster.map(norm));
    const inR = D.s.filter((s) => rk.has(s[0])).length;
    const total = cfg.roster.length ? cfg.roster.length + (n - inR) : 0;
    const me = signedMe();
    let cta;
    if (!L.name) cta = h('button', { class: 'btn pri block', onclick: join }, 'Start my checklist');
    else {
      const list = needed();
      const done = list.filter((i) => L.ticks[i.id]).length;
      cta = h('button', { class: 'btn pri block', onclick: checklist }, me ? 'Signed off. View my list' : done ? `Continue (${done}/${list.length})` : 'Open my checklist');
    }
    const pending = cfg.roster.filter((r) => !D.s.some((s) => s[0] === norm(r)));
    P.fill(dyn, 
      h('div', { class: 'card', style: 'margin:24px 0 14px' },
        total
          ? [h('div', { class: 'big' }, String(n), h('span', { class: 'mut', style: 'font-size:.38em;font-weight:700;letter-spacing:0' }, ` / ${total} signed off`)),
            h('div', { class: 'bar', style: 'margin-top:14px' }, h('i', { style: `width:${Math.min(100, n / total * 100)}%` }))]
          : [h('div', { class: 'big' }, String(n)), h('div', { class: 'mut' }, n === 1 ? 'person signed off' : 'people signed off')],
      ),
      cta,
      h('div', { class: 'sec' }, 'Signed off'),
      n
        ? h('ul', { class: 'names' }, D.s.map((s) =>
            h('li', null,
              h('span', { class: 'tick' }, '✓'),
              h('span', { class: 'n' }, s[1]),
              h('span', { class: 'mut small' }, ago(s[2])),
              KEY ? h('button', { class: 'x', title: 'Remove sign off', onclick: () => removeSign(s[0]) }, '✕') : null,
            )))
        : h('p', { class: 'mut', style: 'margin:0' }, 'Nobody yet. Be the first.'),
      ...(pending.length ? [h('div', { class: 'sec' }, `Still packing (${pending.length})`), h('div', { class: 'chips' }, pending.map((r) => h('span', { class: 'chip ghost' }, r)))] : []),
    );
  }

  async function removeSign(id) {
    try { await call('DELETE', `/e/s/${encodeURIComponent(id)}`); } catch { return; }
    D.s = D.s.filter((s) => s[0] !== id);
    if (L.sid === id) { L.sid = null; persist(); }
    paintFront();
  }

  function adminCard() {
    return h('div', { class: 'card', style: 'margin-top:30px' },
      h('div', { class: 'sec', style: 'margin:0 0 12px' }, 'Admin'),
      h('div', { style: 'display:grid;gap:10px' },
        h('button', { class: 'btn', onclick: edit }, 'Edit list'),
        h('button', { class: 'btn', onclick: () => copy(`${url}#k=${KEY}`) }, 'Copy admin link'),
        h('button', { class: 'btn', onclick: () => { try { sessionStorage.setItem('packd:tpl', JSON.stringify(cfg)); } catch {} location.href = '/new'; } }, 'Use as template for a new list'),
        h('button', { class: 'btn danger', onclick: async () => {
          if (!confirm('Delete this list for everyone?')) return;
          try { await call('DELETE', ''); } catch { return; }
          ls.set('packd:lists', ls.get('packd:lists', []).filter((x) => x.s !== slug));
          location.href = '/';
        } }, 'Delete list'),
      ),
    );
  }

  function edit() {
    view = 'edit';
    const box = h('div');
    P.fill(root, 
      backBtn(front),
      h('div', { class: 'eyebrow' }, 'Admin'),
      h('h1', null, 'Edit list'),
      box,
    );
    window.scrollTo(0, 0);
    P.Editor(box, {
      cfg,
      label: 'Save changes',
      async onSubmit(c) {
        await api('PUT', '/l/' + slug, { cfg: c }, { 'x-key': KEY });
        D.cfg = cfg = c;
        accent(c.a);
        P.paper(c);
        remember(slug, c.title, true);
        toast('Saved');
        front();
      },
    });
  }

  function join() {
    view = 'join';
    const st = { name: L.name || '', ans: { ...L.ans } };
    const nameIn = h('input', { type: 'text', value: st.name, placeholder: 'Your name', maxLength: 40, oninput: (e) => { st.name = e.target.value; paintNames(); } });
    const names = h('div', { class: 'chips', style: 'margin-bottom:12px' });
    const paintNames = () => P.fill(names, ...cfg.roster.map((r) =>
      h('button', { class: 'chip' + (norm(st.name) === norm(r) ? ' on' : ''), onclick: () => { st.name = r; nameIn.value = r; paintNames(); } }, r)));
    const qBlocks = cfg.qs.map((q) => {
      const box = h('div', { class: 'chips' });
      const paint = () => P.fill(box, ...q.o.map((o) =>
        h('button', { class: 'chip' + (st.ans[q.id] === o.id ? ' on' : ''), onclick: () => { st.ans[q.id] = o.id; paint(); } }, o.n)));
      paint();
      return [h('label', { class: 'f' }, q.q), box];
    });
    const go = h('button', { class: 'btn pri block', style: 'margin-top:30px', onclick: () => {
      const name = st.name.trim();
      if (!norm(name)) return toast('Tell us your name');
      if (cfg.qs.some((q) => !st.ans[q.id])) return toast('Answer all the questions');
      L.name = name.replace(/\s+/g, ' ').slice(0, 40);
      L.ans = st.ans;
      persist();
      checklist();
    } }, 'Show my checklist');
    P.fill(root, 
      backBtn(front),
      h('div', { class: 'eyebrow' }, cfg.title),
      h('h1', null, 'Who is packing?'),
      cfg.roster.length ? [h('div', { class: 'hint', style: 'margin:0 0 10px' }, 'Tap your name'), names] : null,
      nameIn,
      qBlocks,
      go,
    );
    paintNames();
    window.scrollTo(0, 0);
  }

  const collapsed = new Set(ls.get('packd:c:' + slug, []));

  function checklist() {
    view = 'list';
    if (!L.name) return join();
    const roots = tree();
    const recs = [];
    const fill = h('i');
    const count = h('b');
    const signBtn = h('button', { class: 'btn pri block' });

    function sync(step) {
      let i = 0;
      for (const r of recs) {
        if (!r.leaf) continue;
        const d = !!L.ticks[r.node.it.id];
        if (d === r.done) continue;
        r.done = d;
        const delay = d && step ? i++ * step + 'ms' : '';
        r.strike.style.transitionDelay = delay;
        r.ck.style.transitionDelay = delay;
        r.el.classList.toggle('done', d);
      }
      for (const r of recs) {
        if (r.leaf) continue;
        const lv = leavesOf(r.node).filter(isNeeded);
        const done = lv.filter((n) => L.ticks[n.it.id]).length;
        r.cnt.textContent = lv.length ? `${done}/${lv.length}` : '';
        r.el.classList.toggle('done', lv.length > 0 && done === lv.length);
      }
      const list = roots.flatMap(leavesOf).filter(isNeeded);
      const done = list.filter((n) => L.ticks[n.it.id]).length;
      fill.style.width = (list.length ? done / list.length * 100 : 0) + '%';
      count.textContent = `${done}/${list.length}`;
      const left = list.length - done;
      const me = signedMe();
      signBtn.disabled = !me && left > 0;
      signBtn.textContent = me ? 'Signed off. Tap to undo' : left > 0 ? `${left} left to pack` : `Sign off as ${L.name}`;
    }

    signBtn.onclick = async () => {
      if (signedMe()) {
        try { await call('DELETE', `/e/s/${encodeURIComponent(L.sid)}`); } catch { return; }
        D.s = D.s.filter((s) => s[0] !== L.sid);
        L.sid = null;
        persist();
        toast('Sign off removed');
        return sync();
      }
      signBtn.disabled = true;
      try {
        const r = await api('POST', `/l/${slug}/e/s`, { name: L.name, tok: L.tok });
        L.sid = r.id;
        persist();
        if (!D.s.some((s) => s[0] === r.id)) D.s.push([r.id, L.name, Date.now()]);
        toast('Signed off. Have a great trip!');
        front();
      } catch (e) {
        sync();
        toast(e.status === 409 && e.data.error === 'taken' ? 'That name already signed off on another device. Add an initial.' : e.message);
      }
    };

    function leaf(node) {
      const it = node.it;
      const s = state(it);
      const cl = claimsBy[it.id] || [];
      const el = h('div', { class: 'row' + (s === 'full' ? ' cov' : '') });
      const bx = P.box();
      const st = h('i', { class: 'strike' });
      let sub = null;
      if (s === 'open') sub = `Group needs ${it.n}. ${cl.length} claimed`;
      else if (s === 'mine') {
        const others = cl.filter((c) => c[0] !== L.claims[it.id]).map((c) => c[2]);
        sub = others.length ? `You are bringing this, with ${others.join(', ')}` : 'You are bringing this';
      } else if (s === 'full') {
        sub = h('span', null, 'Covered by ', cl.map((c, i) => [i ? ', ' : '', KEY ? h('button', { class: 'link', style: 'font-size:inherit;padding:0', onclick: () => unclaim(c[0], it) }, c[2] + ' ✕') : c[2]]));
      } else if (it.by) sub = `Added by ${it.by}`;

      const rec = { leaf: true, node, el, strike: st, ck: bx.querySelector('.ck'), done: false };
      const tickable = s === 'own' || s === 'mine';
      if (tickable && L.ticks[it.id]) { rec.done = true; el.classList.add('done'); }
      if (tickable) {
        el.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          if (L.ticks[it.id]) delete L.ticks[it.id]; else L.ticks[it.id] = 1;
          persist();
          sync();
        });
      }
      const side = [];
      if (s === 'open') side.push(h('button', { class: 'btn sm pri', onclick: () => claim(it) }, "I'll bring"));
      if (s === 'mine') side.push(h('button', { class: 'x', title: 'Unclaim', onclick: () => unclaim(L.claims[it.id], it) }, '✕'));
      const mineItem = it.local || (it.x && (L.xmine[it.id] || KEY));
      if (mineItem) side.push(h('button', { class: 'x', title: 'Edit', onclick: () => addSheet(it) }, '✎'));
      if (it.local) side.push(h('button', { class: 'x', title: 'Remove', onclick: () => { L.my = L.my.filter((m) => m.id !== it.id); persist(); checklist(); } }, '✕'));
      if (it.x && (L.xmine[it.id] || KEY)) side.push(h('button', { class: 'x', title: 'Remove', onclick: () => removeExtra(it) }, '✕'));
      if (s === 'open') bx.style.opacity = '.4';
      el.append(
        bx,
        h('div', { class: 't' }, h('span', { class: 'w' }, it.t, st), it.q > 1 ? h('span', { class: 'q' }, '×' + it.q) : null, sub ? h('span', { class: 's' }, sub) : null),
        ...side,
      );
      recs.push(rec);
      return el;
    }

    function group(node) {
      const it = node.it;
      const bx = P.box();
      const cnt = h('span', { class: 'cnt' });
      const tickable = leavesOf(node).some(isNeeded);
      const el = h('div', { class: 'row par' + (tickable ? '' : ' plain') });
      const wrap = h('div', { class: 'grp' + (collapsed.has(it.id) ? ' shut' : '') });
      const chev = h('button', { class: 'chev', 'aria-label': 'Fold', onclick: () => {
        wrap.classList.toggle('shut');
        wrap.classList.contains('shut') ? collapsed.add(it.id) : collapsed.delete(it.id);
        ls.set('packd:c:' + slug, [...collapsed]);
      } }, '▾');
      el.append(bx, h('div', { class: 't' }, h('span', { class: 'w' }, it.t, h('i', { class: 'strike' }))), cnt, chev);
      if (tickable) {
        el.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          const lv = leavesOf(node).filter(isNeeded);
          const all = lv.every((n) => L.ticks[n.it.id]);
          for (const n of lv) { if (all) delete L.ticks[n.it.id]; else L.ticks[n.it.id] = 1; }
          persist();
          sync(all ? 0 : 140);
        });
      } else bx.style.visibility = 'hidden';
      recs.push({ leaf: false, node, el, cnt });
      wrap.append(el, h('div', { class: 'kids' }, node.kids.map(renderNode)));
      return wrap;
    }

    const renderNode = (n) => (n.kids.length ? group(n) : leaf(n));

    P.fill(root,
      h('div', { class: 'fade' },
        h('div', { class: 'top' }, backBtn(front), h('div', { class: 'bar' }, fill), count),
        h('div', { class: 'eyebrow' }, cfg.title),
        h('h1', null, `Hi ${L.name.split(' ')[0]}`),
        h('button', { class: 'link', style: 'padding-left:0', onclick: join }, 'Not you, or change answers'),
        roots.length ? h('div', { style: 'margin-top:14px' }, roots.map(renderNode)) : h('p', { class: 'mut' }, 'Nothing on your list yet.'),
        h('button', { class: 'btn block', style: 'margin-top:26px', onclick: () => addSheet() }, '+ Add something'),
        footer(),
      ),
      h('div', { class: 'sbar' }, h('div', null, signBtn)),
    );
    sync();
    window.scrollTo(0, 0);
  }

  async function claim(it) {
    try {
      const r = await api('POST', `/l/${slug}/e/c`, { item: it.id, name: L.name, tok: L.tok });
      L.claims[it.id] = r.id;
      persist();
      (claimsBy[it.id] = claimsBy[it.id] || []).push([r.id, it.id, L.name]);
      D.c.push([r.id, it.id, L.name]);
      checklist();
    } catch (e) {
      toast(e.message);
      if (e.status === 409) { try { await fetchData(); } catch {} checklist(); }
    }
  }

  async function unclaim(id, it) {
    try { await call('DELETE', `/e/c/${encodeURIComponent(id)}`); } catch { return; }
    D.c = D.c.filter((c) => c[0] !== id);
    claimsBy[it.id] = (claimsBy[it.id] || []).filter((c) => c[0] !== id);
    if (L.claims[it.id] === id) delete L.claims[it.id];
    persist();
    checklist();
  }

  async function removeExtra(it) {
    try { await call('DELETE', `/e/x/${encodeURIComponent(it.id)}`); } catch { return; }
    D.x = D.x.filter((x) => x.id !== it.id);
    D.c = D.c.filter((c) => c[1] !== it.id);
    delete claimsBy[it.id];
    checklist();
  }

  function addSheet(edit) {
    let mode = edit ? (edit.local ? 'me' : String(edit.n)) : 'me';
    const input = h('input', { type: 'text', placeholder: 'What else should be packed?', maxLength: 80, value: edit ? edit.t : '' });
    const modes = [
      ['me', 'Just me', 'Only on your own list.'],
      ['0', 'Everyone', 'Added to every list.'],
      ['1', 'One person', 'Shown to all. One person claims it.'],
      ['2', 'Two people', 'Shown to all. Two people claim it.'],
    ];
    const chips = h('div', { class: 'chips' });
    const note = h('div', { class: 'hint' });
    const paint = () => {
      P.fill(chips, ...modes.map(([k, l]) => h('button', { class: 'chip' + (mode === k ? ' on' : ''), onclick: () => { mode = k; paint(); } }, l)));
      note.textContent = modes.find((m) => m[0] === mode)[2];
    };
    const close = () => sheet.remove();

    async function createServer(t) {
      const d = +mode;
      const r = await api('POST', `/l/${slug}/e/x`, { t, d, name: L.name, tok: L.tok });
      D.x.push({ id: r.id, t, n: L.name, d, ts: Date.now() });
      L.xmine[r.id] = 1;
    }

    async function save() {
      const t = input.value.trim();
      if (!t) return input.focus();
      save_.disabled = true;
      try {
        if (!edit) {
          if (mode === 'me') L.my.push({ id: 'm' + rid(5), t });
          else await createServer(t);
        } else if (edit.local && mode === 'me') {
          const m = L.my.find((x) => x.id === edit.id);
          if (m) m.t = t;
        } else if (edit.x && mode !== 'me') {
          const d = +mode;
          await api('PUT', `/l/${slug}/e/x/${encodeURIComponent(edit.id)}`, { t, d }, hdr());
          const x = D.x.find((v) => v.id === edit.id);
          if (x) { x.t = t; x.d = d; }
        } else if (edit.local) {
          await createServer(t);
          L.my = L.my.filter((m) => m.id !== edit.id);
        } else {
          await api('DELETE', `/l/${slug}/e/x/${encodeURIComponent(edit.id)}`, null, hdr());
          D.x = D.x.filter((x) => x.id !== edit.id);
          D.c = D.c.filter((c) => c[1] !== edit.id);
          delete claimsBy[edit.id];
          L.my.push({ id: 'm' + rid(5), t });
        }
        persist();
        close();
        checklist();
      } catch (e) { toast(e.message); save_.disabled = false; }
    }

    const save_ = h('button', { class: 'btn pri block', style: 'margin-top:18px', onclick: save }, edit ? 'Save' : 'Add');
    const sheet = h('div', { class: 'sheet', onclick: (e) => e.target === sheet && close() },
      h('div', null, h('h2', null, edit ? 'Edit item' : 'Add something'), input, h('label', { class: 'f' }, 'Who needs it'), chips, note, save_));
    document.body.append(sheet);
    paint();
    input.focus();
  }

  async function refresh() {
    if (document.hidden || Date.now() - lastFetch < 20000) return;
    try { await fetchData(); } catch { return; }
    if (view === 'front') paintFront();
  }
  setInterval(() => view === 'front' && refresh(), 30000);
  document.addEventListener('visibilitychange', () => !document.hidden && view === 'front' && refresh());

  P.fill(root, h('div', { class: 'mut' }, 'Loading'));
  try {
    if (!(await fetchData())) return notFound();
  } catch {
    P.fill(root, h('p', null, 'Could not load. Check your connection.'), h('button', { class: 'btn', onclick: () => location.reload() }, 'Retry'));
    return;
  }
  front();
})();
