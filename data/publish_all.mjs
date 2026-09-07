#!/usr/bin/env node
/**
 * Flip every BODAQ product (identified by _bodaq_code meta) from draft to
 * publish, one PUT each, verified. Run only when the owner has reviewed.
 *
 *   WC_URL WC_KEY WC_SECRET  node data/publish_all.mjs [--revert]
 */
const { WC_URL, WC_KEY, WC_SECRET } = process.env;
if (!WC_URL || !WC_KEY || !WC_SECRET) { console.error('need WC_URL WC_KEY WC_SECRET'); process.exit(1); }
const target = process.argv.includes('--revert') ? 'draft' : 'publish';
const wc = `${WC_URL.replace(/\/$/, '')}/wp-json/wc/v3`;
const q = `consumer_key=${encodeURIComponent(WC_KEY)}&consumer_secret=${encodeURIComponent(WC_SECRET)}`;

const ids = [];
for (let p = 1; ; p++) {
  const r = await fetch(`${wc}/products?per_page=100&page=${p}&status=any&_fields=id,sku,status,meta_data&${q}`).then(x => x.json());
  if (!Array.isArray(r) || !r.length) break;
  for (const x of r) {
    const isBodaq = (x.meta_data || []).some(m => m.key === '_bodaq_code');
    if (isBodaq && x.status !== target) ids.push(x.id);
  }
  if (r.length < 100) break;
}
console.log(`${ids.length} products to set ${target}`);

let ok = 0, fail = [];
for (const id of ids) {
  try {
    const r = await fetch(`${wc}/products/${id}?${q}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: target }),
    }).then(x => x.json());
    if (r.id === id && r.status === target) { ok++; process.stdout.write('.'); }
    else { fail.push([id, r.code || r.status]); process.stdout.write('x'); }
  } catch (e) { fail.push([id, e.message]); process.stdout.write('!'); }
  await new Promise(r => setTimeout(r, 400));
}
console.log(`\n${target}: ${ok} ok, ${fail.length} failed`);
if (fail.length) console.log(fail.slice(0, 40));
