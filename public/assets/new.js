(() => {
  const { h, $, ls, api, copy, share, remember } = P;
  let tpl = null;
  try { tpl = JSON.parse(sessionStorage.getItem('packd:tpl')); sessionStorage.removeItem('packd:tpl'); } catch {}
  if (tpl) { tpl.date = ''; }

  P.Editor($('#ed'), {
    cfg: tpl,
    isNew: true,
    label: 'Create list',
    async onSubmit(cfg, slug, extra) {
      const r = await api('POST', '/lists', { cfg, slug, pw: extra.pw });
      ls.set('packd:k:' + r.slug, r.key);
      remember(r.slug, cfg.title, true);
      if (extra.pw) ls.set('packd:pw:' + r.slug, extra.pw);
      done(r.slug, r.key, cfg.title, extra.pw);
    },
  });

  function done(slug, key, title, pw) {
    const pub = `${location.origin}/${slug}`;
    const adm = `${pub}#k=${key}`;
    const box = (label, url, note) => h('div', { class: 'card', style: 'margin-bottom:12px' },
      h('div', { class: 'sec', style: 'margin:0 0 8px' }, label),
      h('div', { style: 'font-weight:700;word-break:break-all;margin-bottom:10px' }, url.replace(/#k=.*/, '#k=...')),
      h('div', { class: 'hint', style: 'margin:0 0 10px' }, note),
      h('button', { class: 'btn sm', onclick: () => copy(url) }, 'Copy link'),
    );
    P.fill($('#app'), 
      h('div', { class: 'eyebrow' }, 'Ready'),
      h('h1', null, title),
      pw ? h('p', { class: 'mut' }, 'Locked with passcode: ' + pw + '. Share it separately from the link.') : null,
      box('Share this with the group', pub, 'Everyone who opens it sees their own checklist.'),
      box('Your admin link', adm, 'Only you should have this. Save it now, it cannot be recovered. It also opens on this device automatically.'),
      h('button', { class: 'btn pri block', style: 'margin-bottom:10px', onclick: () => share(pub, title) }, 'Share with the group'),
      h('a', { class: 'btn block', style: 'display:grid;place-items:center;text-decoration:none', href: '/' + slug }, 'Open the list'),
    );
    window.scrollTo(0, 0);
  }
})();
