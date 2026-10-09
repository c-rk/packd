window.P = (() => {
  const $ = (s, r = document) => r.querySelector(s);

  function h(tag, a, ...kids) {
    const e = document.createElement(tag);
    if (a) for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style' || k === 'for') e.setAttribute(k, v);
      else if (k in e) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(9)) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  }

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  async function api(method, path, body, hd) {
    const r = await fetch('/api' + path, {
      method,
      headers: { 'content-type': 'application/json', ...(hd || {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let j = {};
    try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong'), { status: r.status, data: j });
    return j;
  }

  const norm = (n) => String(n || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const rid = (n = 6) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join('');

  let tt;
  function toast(m) {
    document.querySelectorAll('.toast').forEach((e) => e.remove());
    const e = h('div', { class: 'toast' }, m);
    document.body.append(e);
    clearTimeout(tt);
    tt = setTimeout(() => e.remove(), 2400);
  }

  async function copy(t) {
    try { await navigator.clipboard.writeText(t); }
    catch {
      const a = h('textarea', { value: t });
      document.body.append(a);
      a.select();
      try { document.execCommand('copy'); } catch {}
      a.remove();
    }
    toast('Copied');
  }

  function share(url, title) {
    const text = `${title}. Tick off your packing list: ${url}`;
    if (navigator.share) navigator.share({ title, text, url }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  function onColor(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255 > 0.62 ? '#111' : '#fff';
  }

  function accent(hex) {
    const s = document.documentElement.style;
    s.setProperty('--a', hex);
    s.setProperty('--on', onColor(hex));
  }

  function daysTo(d) {
    if (!d) return null;
    const [y, m, dd] = d.split('-').map(Number);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((new Date(y, m - 1, dd) - t) / 864e5);
  }

  function ago(ts) {
    const s = (Date.now() - ts) / 1000;
    return s < 60 ? 'now' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd';
  }

  function remember(slug, title, admin) {
    const all = ls.get('packd:lists', []);
    const old = all.find((x) => x.s === slug);
    const a = all.filter((x) => x.s !== slug);
    a.unshift({ s: slug, t: title, a: admin || (old && old.a) || false });
    ls.set('packd:lists', a.slice(0, 30));
  }

  const fill = (el, ...kids) => el.replaceChildren(...kids.flat(9).filter((c) => c != null && c !== false));

  return { fill, $, h, ls, api, norm, rid, toast, copy, share, accent, daysTo, ago, remember };
})();
