#!/usr/bin/env node
/**
 * Attach the swatch image to every BODAQ product that doesn't have one yet.
 * Side-loads from the site's OWN uploads folder (wp-content/uploads/bodaq/),
 * so no outbound throttle. One PUT per product, verified.
 *
 * Prereq: the swatch zip extracted into wp-content/uploads/bodaq/.
 *
 *   WC_URL WC_KEY WC_SECRET  node data/attach_images.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { WC_URL, WC_KEY, WC_SECRET } = process.env;
if (!WC_URL || !WC_KEY || !WC_SECRET) { console.error('need WC_URL WC_KEY WC_SECRET'); process.exit(1); }
const HERE = dirname(fileURLToPath(import.meta.url));
const site = WC_URL.replace(/\/$/, '');
const wc = `${site}/wp-json/wc/v3`;
const q = `consumer_key=${encodeURIComponent(WC_KEY)}&consumer_secret=${encodeURIComponent(WC_SECRET)}`;
const IMG_BASE = `${site}/wp-content/uploads/bodaq/`;

const master = JSON.parse(readFileSync(join(HERE, 'master.json'), 'utf8'));
const fileByCode = new Map(master.map((m) => [m.code, m.swatch_file]));

// products missing an image
const todo = [];
for (let page = 1; ; page++) {
  const r = await fetch(`${wc}/products?per_page=100&page=${page}&status=any&_fields=id,sku,images&${q}`).then((x) => x.json());
  if (!Array.isArray(r) || !r.length) break;
  for (const p of r) {
    if (!p.sku || !fileByCode.has(p.sku)) continue;
    const hasImg = Array.isArray(p.images) && p.images.some((i) => i.src && !/placeholder/i.test(i.src));
    if (!hasImg) todo.push({ id: p.id, sku: p.sku, file: fileByCode.get(p.sku) });
  }
  if (r.length < 100) break;
}
console.log(`${todo.length} products need an image`);

let ok = 0, fail = [];
for (const t of todo) {
  try {
    const res = await fetch(`${wc}/products/${t.id}?${q}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [{ src: IMG_BASE + t.file }] }),
    });
    const j = JSON.parse(await res.text());
    if (j.id === t.id && Array.isArray(j.images) && j.images[0] && j.images[0].id) { ok++; process.stdout.write('.'); }
    else { fail.push([t.sku, j.code || (j.images && j.images[0] && j.images[0].src) || j.message]); process.stdout.write('x'); }
  } catch (e) { fail.push([t.sku, e.message]); process.stdout.write('!'); }
  await new Promise((r) => setTimeout(r, 900));
}
console.log(`\nattached ${ok}, failed ${fail.length}`);
if (fail.length) { console.log(fail.slice(0, 40)); writeFileSync(join(HERE, 'image_failures.json'), JSON.stringify(fail, null, 1)); }
