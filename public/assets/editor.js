P.Editor = function (root, opts) {
  const { h, rid, accent, toast } = P;
  const S = JSON.parse(JSON.stringify(opts.cfg || { title: '', note: '', date: '', a: '#16a34a', qs: [], cats: [], items: [], roster: [] }));
  let slug = '';
  const open = new Set();
  const COLORS = ['#16a34a', '#2563eb', '#e11d48', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#111827'];
  accent(S.a);

  function recon(old, text) {
    const labels = [...new Set(text.split(',').map((s) => s.trim()).filter(Boolean))];
    return labels.map((n, i) => {
      let o = old.find((x) => x.n === n);
      if (!o && labels.length === old.length && !labels.includes(old[i].n)) o = old[i];
      return { id: o ? o.id : rid(6), n };
    });
  }

  const itemsBox = h('div');
  const qsBox = h('div');

  function drawQs() {
    P.fill(qsBox, 
      ...S.qs.map((q, i) =>
        h('div', { class: 'card', style: 'margin-bottom:10px' },
          h('input', { type: 'text', value: q.q, placeholder: 'Question, e.g. Gender', maxLength: 60, oninput: (e) => (q.q = e.target.value) }),
          h('input', {
            type: 'text', style: 'margin-top:8px', value: q.o.map((o) => o.n).join(', '),
            placeholder: 'Options, comma separated: Guy, Girl, Other',
            onchange: (e) => { q.o = recon(q.o, e.target.value); e.target.value = q.o.map((o) => o.n).join(', '); drawItems(); },
          }),
          h('button', { class: 'link', onclick: () => { S.qs.splice(i, 1); drawQs(); drawItems(); } }, 'Remove question'),
        ),
      ),
      S.qs.length < 5 ? h('button', { class: 'btn sm', onclick: () => { S.qs.push({ id: rid(6), q: '', o: [] }); drawQs(); } }, '+ Add a question') : null,
    );
  }

  function whoChips(it) {
    return S.qs.filter((q) => q.o.length >= 2).map((q) => {
      const sel = (it.w && it.w[q.id]) || q.o.map((o) => o.id);
      return h('div', null,
        h('div', { class: 'hint', style: 'margin:0 0 6px' }, 'For: ' + q.q),
        h('div', { class: 'chips' }, q.o.map((o) =>
          h('button', {
            class: 'chip' + (sel.includes(o.id) ? ' on' : ''),
            onclick: () => {
              let next = sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id];
              if (!next.length || next.length === q.o.length) { if (it.w) delete it.w[q.id]; if (it.w && !Object.keys(it.w).length) delete it.w; }
              else (it.w = it.w || {})[q.id] = next;
              drawItems();
            },
          }, o.n))),
      );
    });
  }

  function itemRow(it, i) {
    const isOpen = open.has(it.id);
    const cat = S.cats.find((c) => c.id === it.c);
    const tags = [cat && cat.n, it.q > 1 && 'x' + it.q, it.n && 'only ' + it.n + ' needed', it.w && 'filtered'].filter(Boolean).join(' · ');
    return h('div', { class: 'item' },
      h('div', { class: 'r1' },
        h('input', { type: 'text', value: it.t, placeholder: 'Item', maxLength: 80, oninput: (e) => (it.t = e.target.value) }),
        h('button', { class: 'x', title: 'Options', onclick: () => { isOpen ? open.delete(it.id) : open.add(it.id); drawItems(); } }, isOpen ? '▴' : '⋯'),
        h('button', { class: 'x', title: 'Remove', onclick: () => { S.items.splice(i, 1); drawItems(); } }, '✕'),
      ),
      !isOpen && tags ? h('div', { class: 'hint' }, tags) : null,
      isOpen ? h('div', { class: 'det' },
        h('div', null, h('div', { class: 'hint', style: 'margin:0 0 6px' }, 'Category'),
          h('select', { onchange: (e) => (it.c = e.target.value) },
            h('option', { value: '' }, 'None'),
            S.cats.map((c) => h('option', { value: c.id, selected: c.id === it.c }, c.n)))),
        h('div', null, h('div', { class: 'hint', style: 'margin:0 0 6px' }, 'Quantity'),
          h('input', { type: 'number', min: 1, max: 99, value: it.q || 1, onchange: (e) => (it.q = Math.max(1, +e.target.value || 1)) })),
        h('div', null, h('div', { class: 'hint', style: 'margin:0 0 6px' }, 'Who brings it'),
          h('select', { onchange: (e) => (it.n = +e.target.value) },
            [[0, 'Everyone brings their own'], [1, 'Only 1 person for the group'], [2, 'Only 2 people for the group'], [3, 'Only 3 people for the group']]
              .map(([v, l]) => h('option', { value: v, selected: (it.n || 0) === v }, l)))),
        whoChips(it),
      ) : null,
    );
  }

  function drawItems() {
    P.fill(itemsBox, 
      S.items.map(itemRow),
      h('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap' },
        h('button', { class: 'btn sm', onclick: () => { const it = { id: rid(6), t: '', c: '', q: 1, n: 0 }; S.items.push(it); drawItems(); itemsBox.querySelectorAll('input[type=text]')[S.items.length - 1].focus(); } }, '+ Add item'),
      ),
      h('label', { class: 'f' }, 'Paste many'),
      h('textarea', { id: 'bulk', placeholder: '#Clothes\nT-shirts\nJacket\n#Documents\nID card' }),
      h('div', { class: 'hint' }, 'One item per line. A line starting with # starts a category.'),
      h('button', { class: 'btn sm', style: 'margin-top:8px', onclick: bulk }, 'Add these'),
    );
  }

  function bulk() {
    const ta = itemsBox.querySelector('#bulk');
    let cur = '';
    for (let line of ta.value.split('\n')) {
      line = line.replace(/^\s*([-*•]|\[ \])\s*/, '').trim();
      if (!line) continue;
      if (line[0] === '#') {
        const n = line.replace(/^#+\s*/, '').slice(0, 30);
        if (!n) continue;
        let c = S.cats.find((c) => c.n.toLowerCase() === n.toLowerCase());
        if (!c && S.cats.length < 20) S.cats.push((c = { id: rid(6), n }));
        cur = c ? c.id : '';
        continue;
      }
      S.items.push({ id: rid(6), t: line.slice(0, 80), c: cur, q: 1, n: 0 });
    }
    catInput.value = S.cats.map((c) => c.n).join(', ');
    drawItems();
  }

  const catInput = h('input', {
    type: 'text', value: S.cats.map((c) => c.n).join(', '), placeholder: 'Clothes, Documents, Toiletries',
    onchange: (e) => { S.cats = recon(S.cats, e.target.value).slice(0, 20); e.target.value = S.cats.map((c) => c.n).join(', '); drawItems(); },
  });

  const swatches = h('div', { class: 'sw' });
  function drawSw() {
    P.fill(swatches, 
      ...COLORS.map((c) => h('button', { class: c === S.a ? 'on' : '', style: 'background:' + c, onclick: () => { S.a = c; accent(c); drawSw(); }, 'aria-label': c })),
      h('input', { type: 'color', value: S.a, style: 'width:38px;height:38px;border:0;padding:0;background:none', oninput: (e) => { S.a = e.target.value; accent(S.a); } }),
    );
  }

  const submit = h('button', { class: 'btn pri block', onclick: async () => {
    if (!S.title.trim()) { toast('Give the list a name'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    submit.disabled = true;
    const cfg = JSON.parse(JSON.stringify(S));
    cfg.items = cfg.items.filter((i) => i.t.trim());
    cfg.qs = cfg.qs.filter((q) => q.q.trim() && q.o.length >= 2);
    try { await opts.onSubmit(cfg, slug); } catch (e) { toast(e.message); }
    submit.disabled = false;
  } }, opts.label);

  P.fill(root, h('div', { class: 'ed' },
    h('label', { class: 'f' }, 'Trip or list name'),
    h('input', { type: 'text', value: S.title, maxLength: 60, placeholder: 'Goa trip', oninput: (e) => (S.title = e.target.value) }),
    h('label', { class: 'f' }, 'Date (optional)'),
    h('input', { type: 'date', value: S.date, oninput: (e) => (S.date = e.target.value) }),
    h('label', { class: 'f' }, 'Note for everyone (optional)'),
    h('textarea', { maxLength: 300, value: S.note, placeholder: 'Meet at 6am at the station', oninput: (e) => (S.note = e.target.value) }),
    h('label', { class: 'f' }, 'Accent colour'),
    swatches,
    opts.isNew ? [
      h('label', { class: 'f' }, 'Link name (optional)'),
      h('input', { type: 'text', placeholder: 'goa-trip, or leave blank for 3 random words', maxLength: 40, oninput: (e) => { e.target.value = slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); } }),
      h('div', { class: 'hint' }, 'Short and easy to type works best.'),
    ] : null,
    h('div', { class: 'sec' }, 'Questions'),
    h('div', { class: 'hint', style: 'margin:-4px 0 12px' }, 'Optional. Answers decide which items each person sees.'),
    qsBox,
    h('div', { class: 'sec' }, 'Categories'),
    catInput,
    h('div', { class: 'sec' }, 'Items'),
    itemsBox,
    h('div', { class: 'sec' }, 'Who is going (optional)'),
    h('textarea', { placeholder: 'One name per line', value: S.roster.join('\n'), oninput: (e) => (S.roster = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)) }),
    h('div', { class: 'hint' }, 'With names, everyone can tap their own and you can see who is still packing. Anyone else can still join.'),
    h('div', { style: 'margin-top:34px' }, submit),
  ));
  drawSw();
  drawQs();
  drawItems();
};
