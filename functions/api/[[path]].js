import { WORDS } from '../../lib/words.js';


const RESERVED = new Set(['api', 'new', 'l', 'assets', 'admin', 'index', 'favicon', 'robots', 'static']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CAP = 500;
const TTL = 10;

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const str = (v, max) =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = (v) =>
  String(v ?? '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
const int = (v, lo, hi, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const rand = (n, alpha = 'abcdefghijklmnopqrstuvwxyz0123456789') => {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => alpha[x % alpha.length]).join('');
};
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

function cleanCfg(c) {
  if (!c || typeof c !== 'object') return null;
  const title = str(c.title, 60);
  if (!title) return null;
  const out = {
    title,
    note: str(c.note, 300),
    date: /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : '',
    a: /^#[0-9a-f]{6}$/i.test(c.a) ? c.a.toLowerCase() : '#16a34a',
    ps: ['ruled', 'dots', 'grid', 'plain'].includes(c.ps) ? c.ps : 'ruled',
    pc: /^#[0-9a-f]{6}$/i.test(c.pc) ? c.pc.toLowerCase() : '',
    qs: [], items: [], roster: [],
  };
  const ids = (set) => (v) => {
    let id = typeof v === 'string' && /^[a-z0-9]{1,12}$/.test(v) && !set.has(v) ? v : null;
    while (!id || set.has(id)) id = rand(6);
    set.add(id);
    return id;
  };
  const qid = ids(new Set()), oid = ids(new Set()), iid = ids(new Set());
  for (const q of (Array.isArray(c.qs) ? c.qs : []).slice(0, 5)) {
    const text = str(q?.q, 60);
    const o = (Array.isArray(q?.o) ? q.o : []).slice(0, 8)
      .map((x) => ({ id: oid(x?.id), n: str(x?.n, 30) })).filter((x) => x.n);
    if (text && o.length >= 2) out.qs.push({ id: qid(q.id), q: text, o });
  }
  let prev = -1;
  for (const it of (Array.isArray(c.items) ? c.items : []).slice(0, 300)) {
    const t = str(it?.t, 80);
    if (!t) continue;
    const item = {
      id: iid(it.id), t,
      d: Math.min(int(it.d, 0, 2, 0), prev + 1),
      q: int(it.q, 1, 99, 1),
      n: int(it.n, 0, 9, 0),
    };
    if (it.w && typeof it.w === 'object') {
      const w = {};
      for (const q of out.qs) {
        const sel = Array.isArray(it.w[q.id]) ? it.w[q.id].filter((o) => q.o.some((x) => x.id === o)) : null;
        if (sel && sel.length && sel.length < q.o.length) w[q.id] = sel;
      }
      if (Object.keys(w).length) item.w = w;
    }
    prev = item.d;
    out.items.push(item);
  }
  out.items.forEach((it, i) => {
    if (out.items[i + 1] && out.items[i + 1].d > it.d) { it.n = 0; it.q = 1; }
  });
  const seen = new Set();
  for (const r of (Array.isArray(c.roster) ? c.roster : []).slice(0, 200)) {
    const n = str(r, 40), k = norm(n);
    if (n && k && !seen.has(k)) { seen.add(k); out.roster.push(n); }
  }
  return out;
}

async function body(request, max = 70000) {
  const raw = await request.text();
  if (raw.length > max) throw new Response('too big', { status: 413 });
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

const cacheKey = (request, slug) => new Request(new URL('/__c/' + slug, request.url).toString());

export async function onRequest(ctx) {
  const { request, params } = ctx;
  const p = [].concat(params.path || []).map(dec);
  const m = request.method;
  try {
    if (p[0] === 'lists' && p.length === 1 && m === 'POST') return await create(ctx);
    if (p[0] === 'l' && p[1]) {
      const slug = p[1];
      if (p.length === 2) {
        if (m === 'GET') return await read(ctx, slug);
        if (m === 'PUT') return await save(ctx, slug);
        if (m === 'DELETE') return await drop(ctx, slug);
      }
      if (p[2] === 'e' && ['s', 'c', 'x'].includes(p[3])) {
        if (p.length === 4 && m === 'POST') return await add(ctx, slug, p[3]);
        if (p.length === 5 && m === 'DELETE') return await del(ctx, slug, p[3], p[4]);
        if (p.length === 5 && m === 'PUT' && p[3] === 'x') return await upd(ctx, slug, p[4]);
      }
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return json({ error: 'server error' }, 500);
  }
}

async function create({ request, env }) {
  const b = await body(request);
  const cfg = cleanCfg(b.cfg);
  if (!cfg) return json({ error: 'Title needed' }, 400);
  const custom = str(b.slug, 40).toLowerCase().replace(/\s+/g, '-');
  if (custom && (custom.length < 2 || !SLUG.test(custom) || RESERVED.has(custom)))
    return json({ error: 'Bad link name (letters, numbers, dashes)' }, 400);
  const key = rand(20);
  const akey = await sha(key);
  const data = JSON.stringify(cfg);
  for (let i = 0; i < 6; i++) {
    const slug = custom || [0, 1, 2].map(() => WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % WORDS.length]).join('-');
    const r = await env.DB.prepare('INSERT OR IGNORE INTO lists(slug,akey,data,created) VALUES(?,?,?,?)')
      .bind(slug, akey, data, Date.now()).run();
    if (r.meta.changes > 0) return json({ slug, key });
    if (custom) return json({ error: 'That link name is taken' }, 409);
  }
  return json({ error: 'Try again' }, 503);
}

async function read(ctx, slug) {
  const { request, env } = ctx;
  const cache = caches.default;
  const ck = cacheKey(request, slug);
  const hit = await cache.match(ck);
  if (hit) return new Response(hit.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

  const [l, e] = await env.DB.batch([
    env.DB.prepare('SELECT data FROM lists WHERE slug=?').bind(slug),
    env.DB.prepare('SELECT kind,id,data FROM entries WHERE slug=?').bind(slug),
  ]);
  const row = l.results[0];
  if (!row) return json({ error: 'not found' }, 404);
  const out = { cfg: JSON.parse(row.data), s: [], c: [], x: [] };
  const ss = [];
  for (const r of e.results) {
    const d = JSON.parse(r.data);
    if (r.kind === 's') ss.push([r.id, d.n, d.t]);
    else if (r.kind === 'c') out.c.push([r.id, d.i, d.n]);
    else out.x.push({ id: r.id, t: d.t, n: d.n, d: d.d, ts: d.ts });
  }
  ss.sort((a, b) => a[2] - b[2]);
  out.s = ss;
  out.x.sort((a, b) => a.ts - b.ts);
  const res = new Response(JSON.stringify(out), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, s-maxage=${TTL}` },
  });
  ctx.waitUntil(cache.put(ck, res.clone()));
  return new Response(res.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

const bust = (ctx, slug) => ctx.waitUntil(caches.default.delete(cacheKey(ctx.request, slug)));

async function save(ctx, slug) {
  const { request, env } = ctx;
  const key = request.headers.get('x-key') || '';
  const b = await body(request);
  const cfg = cleanCfg(b.cfg);
  if (!cfg) return json({ error: 'Title needed' }, 400);
  const r = await env.DB.prepare('UPDATE lists SET data=? WHERE slug=? AND akey=?')
    .bind(JSON.stringify(cfg), slug, await sha(key || '-')).run();
  if (!r.meta.changes) return json({ error: 'Not allowed' }, 403);
  bust(ctx, slug);
  return json({ ok: 1 });
}

async function drop(ctx, slug) {
  const { request, env } = ctx;
  const key = request.headers.get('x-key') || '';
  const r = await env.DB.prepare('DELETE FROM lists WHERE slug=? AND akey=?').bind(slug, await sha(key || '-')).run();
  if (!r.meta.changes) return json({ error: 'Not allowed' }, 403);
  await env.DB.prepare('DELETE FROM entries WHERE slug=?').bind(slug).run();
  bust(ctx, slug);
  return json({ ok: 1 });
}

async function put(env, slug, kind, id, data, tok) {
  const r = await env.DB.prepare(
    `INSERT OR IGNORE INTO entries(slug,kind,id,data)
     SELECT ?1,?2,?3,?4
     WHERE EXISTS(SELECT 1 FROM lists WHERE slug=?1) AND (SELECT count(*) FROM entries WHERE slug=?1)<?5`
  ).bind(slug, kind, id, JSON.stringify(data), CAP).run();
  if (r.meta.changes > 0) return 'ok';
  const ex = await env.DB.prepare('SELECT data FROM entries WHERE slug=?1 AND kind=?2 AND id=?3').bind(slug, kind, id).first();
  if (ex) return JSON.parse(ex.data).k === tok ? 'ok' : 'taken';
  const l = await env.DB.prepare('SELECT 1 AS o FROM lists WHERE slug=?').bind(slug).first();
  return l ? 'full' : 'nolist';
}

async function add(ctx, slug, kind) {
  const { request, env } = ctx;
  const b = await body(request, 4000);
  const tok = str(b.tok, 40);
  const name = str(b.name, 40), nk = norm(name);
  if (tok.length < 8 || !nk) return json({ error: 'Name needed' }, 400);
  let id, data, res;

  if (kind === 's') {
    id = nk;
    res = await put(env, slug, 's', id, { n: name, t: Date.now(), k: tok }, tok);
  } else if (kind === 'x') {
    const t = str(b.t, 80);
    if (!t) return json({ error: 'Item needed' }, 400);
    id = 'x' + rand(7);
    res = await put(env, slug, 'x', id, { t, n: name, d: int(b.d, 0, 9, 0), k: tok, ts: Date.now() }, tok);
  } else {
    const item = str(b.item, 14);
    if (!/^[a-z0-9]{1,14}$/.test(item)) return json({ error: 'bad item' }, 400);
    const l = await env.DB.prepare('SELECT data FROM lists WHERE slug=?').bind(slug).first();
    if (!l) return json({ error: 'not found' }, 404);
    let need = JSON.parse(l.data).items.find((i) => i.id === item)?.n;
    if (need == null) {
      const x = await env.DB.prepare("SELECT data FROM entries WHERE slug=? AND kind='x' AND id=?").bind(slug, item).first();
      need = x ? JSON.parse(x.data).d : 0;
    }
    if (!need) return json({ error: 'not shared' }, 400);
    id = item + '~' + nk;
    const r = await env.DB.prepare(
      `INSERT OR IGNORE INTO entries(slug,kind,id,data)
       SELECT ?1,'c',?2,?3
       WHERE (SELECT count(*) FROM entries WHERE slug=?1 AND kind='c' AND id>=?4 AND id<?5)<?6`
    ).bind(slug, id, JSON.stringify({ i: item, n: name, k: tok, t: Date.now() }), item + '~', item + '\x7f', need).run();
    if (r.meta.changes > 0) res = 'ok';
    else {
      const ex = await env.DB.prepare("SELECT data FROM entries WHERE slug=?1 AND kind='c' AND id=?2").bind(slug, id).first();
      res = ex ? (JSON.parse(ex.data).k === tok ? 'ok' : 'taken') : 'full';
    }
  }
  if (res === 'ok') { bust(ctx, slug); return json({ ok: 1, id }); }
  if (res === 'nolist') return json({ error: 'not found' }, 404);
  if (res === 'full') return json({ error: kind === 'c' ? 'Already covered' : 'List is full', full: 1 }, 409);
  return json({ error: 'taken' }, 409);
}

async function del(ctx, slug, kind, id) {
  const { request, env } = ctx;
  const tok = request.headers.get('x-tok') || '';
  const key = request.headers.get('x-key') || '';
  const r = await env.DB.prepare(
    `DELETE FROM entries WHERE slug=?1 AND kind=?2 AND id=?3
     AND (json_extract(data,'$.k')=?4 OR EXISTS(SELECT 1 FROM lists WHERE slug=?1 AND akey=?5))`
  ).bind(slug, kind, id, tok.length >= 8 ? tok : '-', key ? await sha(key) : '-').run();
  if (!r.meta.changes) return json({ error: 'Not allowed' }, 403);
  if (kind === 'x')
    await env.DB.prepare("DELETE FROM entries WHERE slug=? AND kind='c' AND id>=? AND id<?")
      .bind(slug, id + '~', id + '\x7f').run();
  bust(ctx, slug);
  return json({ ok: 1 });
}

async function upd(ctx, slug, id) {
  const { request, env } = ctx;
  const b = await body(request, 4000);
  const t = str(b.t, 80);
  if (!t) return json({ error: 'Item needed' }, 400);
  const tok = request.headers.get('x-tok') || '';
  const key = request.headers.get('x-key') || '';
  const r = await env.DB.prepare(
    `UPDATE entries SET data=json_set(data,'$.t',?4,'$.d',?5) WHERE slug=?1 AND kind='x' AND id=?2
     AND (json_extract(data,'$.k')=?3 OR EXISTS(SELECT 1 FROM lists WHERE slug=?1 AND akey=?6))`
  ).bind(slug, id, tok.length >= 8 ? tok : '-', t, int(b.d, 0, 9, 0), key ? await sha(key) : '-').run();
  if (!r.meta.changes) return json({ error: 'Not allowed' }, 403);
  bust(ctx, slug);
  return json({ ok: 1 });
}
