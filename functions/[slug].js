export async function onRequest({ request, env, params }) {
  const slug = String(params.slug || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === 'api') return env.ASSETS.fetch(request);
  const u = new URL(request.url);
  u.pathname = '/l';
  u.search = '';
  let r = await env.ASSETS.fetch(new Request(u.toString(), { method: 'GET' }));
  if (r.status >= 300 && r.status < 400 && r.headers.get('location'))
    r = await env.ASSETS.fetch(new Request(new URL(r.headers.get('location'), u).toString(), { method: 'GET' }));
  return new Response(r.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });
}
