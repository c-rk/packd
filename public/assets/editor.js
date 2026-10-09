P.Editor = function (root, opts) {
  const { h, rid, accent, toast } = P;
  const S = JSON.parse(JSON.stringify(opts.cfg || { title: '', note: '', date: '', a: '#16a34a', ps: 'ruled', pc: '', qs: [], items: [], roster: [] }));
  S.items.forEach((it) => { it.d = it.d || 0; });
  let slug = '';
  let focus = -1;
  const open = new Set();
  const COLORS = ['#16a34a', '#2563eb', '#e11d48', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#111827'];
  S.ps = S.ps || 'ruled';
  S.pc = S.pc || '';
  accent(S.a);
  P.paper(S);

  const endOf = (i) => {
    let e = i + 1;
    while (e < S.items.length && S.items[e].d > S.items[i].d) e++;
    return e;
  };
  const depthMax = (i) => Math.max(...S.items.slice(i, endOf(i)).map((x) => x.d));
  const shift = (i, by) => S.items.slice(i, endOf(i)).forEach((x) => { x.d += by; });

  function indent(i) {
    const prev = S.items[i - 1];
    if (!prev || S.items[i].d > prev.d || depthMax(i) >= 2) return false;
    shift(i, 1);
    return true;
  }
  function outdent(i) {
    if (S.items[i].d < 1) return false;
    shift(i, -1);
    return true;
  }
  function move(i, dir) {
    const d = S.items[i].d, e = endOf(i);
    if (dir < 0) {
      let j = i - 1;
      while (j >= 0 && S.items[j].d > d) j--;
      if (j < 0 || S.items[j].d < d) return false;
      S.items.splice(j, 0, ...S.items.splice(i, e - i));
    } else {
      if (!S.items[e] || S.items[e].d !== d) return false;
      const e2 = endOf(e);
      S.items.splice(i, 0, ...S.items.splice(e, e2 - e));
    }
    return true;
  }

  const itemsBox = h('div');
  const qsBox = h('div');

  function recon(old, text) {
    const labels = [...new Set(text.split(',').map((s) => s.trim()).filter(Boolean))];
    return labels.map((n, i) => {
      let o = old.find((x) => x.n === n);
      if (!o && labels.length === old.length && !labels.includes(old[i].n)) o = old[i];
      return { id: o ? o.id : rid(6), n };
    });
  }

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
        h('div', { class: 'hint', style: 'margin:0 0 6px' }, 'Shown to: ' + q.q),
        h('div', { class: 'chips' }, q.o.map((o) =>
          h('button', {
            class: 'chip' + (sel.includes(o.id) ? ' on' : ''),
            onclick: () => {
              const next = sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id];
              if (!next.length || next.length === q.o.length) {
                if (it.w) delete it.w[q.id];
                if (it.w && !Object.keys(it.w).length) delete it.w;
              } else (it.w = it.w || {})[q.id] = next;
              drawItems();
            },
          }, o.n))),
      );
    });
  }

  function insertAfter(i) {
    const at = endOf(i);
    S.items.splice(at, 0, { id: rid(6), t: '', d: S.items[i].d, q: 1, n: 0 });
    focus = at;
    drawItems();
  }

  function itemRow(it, i) {
    const isOpen = open.has(it.id);
    const kids = S.items[i + 1] && S.items[i + 1].d > it.d;
    const tags = [kids && 'group', !kids && it.q > 1 && 'x' + it.q, !kids && it.n && 'only ' + it.n + ' needed', it.w && 'filtered'].filter(Boolean).join(' · ');
    return h('div', { class: 'item', style: `margin-left:${it.d * 22}px` },
      h('div', { class: 'r1' },
        h('input', {
          type: 'text', value: it.t, placeholder: it.d ? 'Item' : 'Item or group', maxLength: 80, id: 'it' + i,
          oninput: (e) => (it.t = e.target.value),
          onkeydown: (e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              if (e.shiftKey ? outdent(i) : indent(i)) { focus = i; drawItems(); }
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (it.t.trim()) insertAfter(i);
            } else if (e.key === 'Backspace' && !it.t && S.items.length > 1) {
              e.preventDefault();
              S.items.splice(i, 1);
              focus = Math.max(0, i - 1);
              drawItems();
            }
          },
        }),
        h('button', { class: 'x', title: 'Move out one level', onclick: () => { if (outdent(i)) drawItems(); } }, '←'),
        h('button', { class: 'x', title: 'Nest under the item above', onclick: () => { if (indent(i)) drawItems(); else toast('Nothing above to nest under'); } }, '→'),
        h('button', { class: 'x', title: 'Options', onclick: () => { isOpen ? open.delete(it.id) : open.add(it.id); drawItems(); } }, isOpen ? '▴' : '⋯'),
        h('button', { class: 'x', title: 'Remove', onclick: () => { S.items.splice(i, endOf(i) - i); drawItems(); } }, '✕'),
      ),
      !isOpen && tags ? h('div', { class: 'hint' }, tags) : null,
      isOpen ? h('div', { class: 'det' },
        h('div', { class: 'mv' },
          h('button', { class: 'btn sm', onclick: () => { if (indent(i)) drawItems(); else toast('Nothing above to nest under'); } }, '→ Nest under above'),
          h('button', { class: 'btn sm', onclick: () => { if (outdent(i)) drawItems(); else toast('Already at the top level'); } }, '← Move out'),
          h('button', { class: 'btn sm', onclick: () => { if (move(i, -1)) drawItems(); } }, '↑ Move up'),
          h('button', { class: 'btn sm', onclick: () => { if (move(i, 1)) drawItems(); } }, '↓ Move down'),
        ),
        !kids ? [
          h('div', null, h('div', { class: 'hint', style: 'margin:0 0 6px' }, 'Quantity'),
            h('input', { type: 'number', min: 1, max: 99, value: it.q || 1, onchange: (e) => (it.q = Math.max(1, +e.target.value || 1)) })),
          h('div', null, h('div', { class: 'hint', style: 'margin:0 0 6px' }, 'Who brings it'),
            h('select', { onchange: (e) => (it.n = +e.target.value) },
              [[0, 'Everyone brings their own'], [1, 'Only 1 person for the group'], [2, 'Only 2 people for the group'], [3, 'Only 3 people for the group']]
                .map(([v, l]) => h('option', { value: v, selected: (it.n || 0) === v }, l)))),
        ] : null,
        whoChips(it),
      ) : null,
    );
  }

  function drawItems() {
    P.fill(itemsBox,
      S.items.map(itemRow),
      h('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap' },
        h('button', { class: 'btn sm', onclick: () => { S.items.push({ id: rid(6), t: '', d: 0, q: 1, n: 0 }); focus = S.items.length - 1; drawItems(); } }, '+ Add item'),
      ),
      h('div', { class: 'hint' }, 'Enter adds the next item. Tab nests it under the one above, Shift+Tab pulls it back out. Ticking a group ticks everything inside it.'),
      h('label', { class: 'f' }, 'Paste many'),
      h('textarea', { id: 'bulk', placeholder: 'Clothes\n  T-shirts\n  Jacket\nDocuments\n  ID card' }),
      h('div', { class: 'hint' }, 'One item per line. Indent a line to nest it. A line starting with # is a group heading.'),
      h('button', { class: 'btn sm', style: 'margin-top:8px', onclick: bulk }, 'Add these'),
    );
    if (focus >= 0) {
      const el = document.getElementById('it' + focus);
      if (el) el.focus();
      focus = -1;
    }
  }

  function bulk() {
    const ta = itemsBox.querySelector('#bulk');
    let hdr = false, prev = S.items.length ? S.items[S.items.length - 1].d : -1;
    for (const raw of ta.value.split('\n')) {
      const ws = raw.match(/^[ \t]*/)[0];
      let line = raw.trim().replace(/^([-*•]|\[ \])\s*/, '').trim();
      if (!line) continue;
      let d = ws.split('').reduce((n, c) => n + (c === '\t' ? 2 : 1), 0) >> 1;
      if (line[0] === '#') { line = line.replace(/^#+\s*/, ''); d = 0; hdr = true; }
      else if (hdr && !d) d = 1;
      if (!line) continue;
      d = Math.min(d, prev + 1, 2);
      S.items.push({ id: rid(6), t: line.slice(0, 80), d, q: 1, n: 0 });
      prev = d;
    }
    ta.value = '';
    drawItems();
  }

  const swatches = h('div', { class: 'sw' });
  function drawSw() {
    P.fill(swatches,
      ...COLORS.map((c) => h('button', { class: c === S.a ? 'on' : '', style: 'background:' + c, onclick: () => { S.a = c; accent(c); drawSw(); }, 'aria-label': c })),
      h('input', { type: 'color', value: S.a, style: 'width:38px;height:38px;border:0;padding:0;background:none', oninput: (e) => { S.a = e.target.value; accent(S.a); } }),
    );
  }

  const STYLES = [['ruled', 'Ruled'], ['dots', 'Dotted'], ['grid', 'Grid'], ['plain', 'Plain']];
  const PAPERS = [['', 'Auto'], ['#fbf8ee', 'Cream'], ['#ffffff', 'White'], ['#fff4b8', 'Yellow'], ['#e4eefa', 'Blue'], ['#fce6ea', 'Pink'], ['#e6f3e2', 'Green'], ['#d8c3a0', 'Kraft'], ['#22302b', 'Chalkboard'], ['#141414', 'Black']];
  const paperBox = h('div');
  function drawPaper() {
    P.fill(paperBox,
      h('div', { class: 'chips', style: 'margin-bottom:12px' }, STYLES.map(([k, l]) => h('button', { class: 'chip' + (S.ps === k ? ' on' : ''), onclick: () => { S.ps = k; P.paper(S); drawPaper(); } }, l))),
      h('div', { class: 'sw' }, PAPERS.map(([c, l]) => h('button', {
        class: S.pc === c ? 'on' : '', title: l, 'aria-label': l,
        style: 'border:2px solid #8884;font-size:.6rem;font-weight:700;color:#555;background:' + (c || 'linear-gradient(135deg,#fbf8ee 50%,#1b1a17 50%)'),
        onclick: () => { S.pc = c; P.paper(S); drawPaper(); },
      }))),
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
    h('label', { class: 'f' }, 'Paper'),
    paperBox,
    opts.isNew ? [
      h('label', { class: 'f' }, 'Link name (optional)'),
      h('input', { type: 'text', placeholder: 'goa-trip, or leave blank for 3 random words', maxLength: 40, oninput: (e) => { e.target.value = slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); } }),
      h('div', { class: 'hint' }, 'Short and easy to type works best.'),
    ] : null,
    h('div', { class: 'sec' }, 'Questions'),
    h('div', { class: 'hint', style: 'margin:-4px 0 12px' }, 'Optional. Answers decide which items each person sees.'),
    qsBox,
    h('div', { class: 'sec' }, 'Items'),
    itemsBox,
    h('div', { class: 'sec' }, 'Who is going (optional)'),
    h('textarea', { placeholder: 'One name per line', value: S.roster.join('\n'), oninput: (e) => (S.roster = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)) }),
    h('div', { class: 'hint' }, 'With names, everyone can tap their own and you can see who is still packing. Anyone else can still join.'),
    h('div', { style: 'margin-top:34px' }, submit),
  ));
  drawSw();
  drawPaper();
  drawQs();
  drawItems();
};
