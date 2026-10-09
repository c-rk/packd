# packd

Group packing lists. Plain static frontend, Cloudflare Pages Functions, one D1 database.

## Deploy

1. Create the database: `npx wrangler d1 create packd`, then paste the id into `wrangler.toml`.
2. Create the tables: `npm run db:remote`.
3. Cloudflare Pages: connect this repo, build command empty, output directory `public`.
4. Pages settings, Functions, D1 binding: variable `DB` to the `packd` database (already set if `wrangler.toml` is used).
5. Custom domain: `packd.tentkotta.org`.

## Local

`npm install`, `npm run db:local`, `npm run dev`, open http://localhost:8788.

## Notes

- List pages are `/<slug>`. Admin link is the list link plus `#k=<key>`; only a hash of the key is stored.
- Ticking items is stored on the device only. D1 is written for list create or edit, sign offs, claims and member added items.
- Reads are edge cached for 10 seconds per list.
