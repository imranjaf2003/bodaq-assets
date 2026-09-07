#!/usr/bin/env node
/**
 * Create every BODAQ product still missing from WooCommerce — TEXT ONLY, no
 * images (image side-load throttles on this host; images are attached in a
 * separate pass from wp-content/uploads/bodaq/ once the zip is uploaded).
 *
 *   WC_URL WC_KEY WC_SECRET  node data/import_missing.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { WC_URL, WC_KEY, WC_SECRET } = process.env;
if (!WC_URL || !WC_KEY || !WC_SECRET) { console.error('need WC_URL WC_KEY WC_SECRET'); process.exit(1); }
const HERE = dirname(fileURLToPath(import.meta.url));
const wc = `${WC_URL.replace(/\/$/, '')}/wp-json/wc/v3`;
const q = `consumer_key=${encodeURIComponent(WC_KEY)}&consumer_secret=${encodeURIComponent(WC_SECRET)}`;
const INSTALL = 40, PROFIT = 30;

const CATMAP = {
  '01 Basic|Mono Blanc': [363, 368], '01 Basic|Painted Wood': [363, 369],
  '01 Basic|Premium Painted Concrete': [363, 370], '01 Basic|Premium Painted Wood': [363, 371],
  '01 Basic|Solid': [363, 372], '01 Basic|Super Matt': [363, 373], '01 Basic|Texture': [363, 374],
  '02 Wood|Optical Grain Wood': [364, 375], '02 Wood|Origin Wood': [364, 376],
  '02 Wood|Premium Wood': [364, 377], '02 Wood|Standard Wood': [364, 378], '02 Wood|Wood Palette': [364, 379],
  '03 Natural Surface|Gold': [365, 380], '03 Natural Surface|Natural Fabric': [365, 381],
  '03 Natural Surface|Real Fabric': [365, 382], '03 Natural Surface|Real Metal': [365, 383],
  '03 Natural Surface|Soft Fabric': [365, 384], '03 Natural Surface|Soft Leather': [365, 385],
  '03 Natural Surface|UMI': [365, 386], '03 Natural Surface|Velvet Metal': [365, 387],
  '04 Stone & Marble|Premium Marble': [366, 388], '04 Stone & Marble|Stone & Marble': [366, 389],
  '05 Etc|Easy Clean Film': [367, 390], '05 Etc|Exterior Film': [367, 391],
};

async function allSkus() {
  const set = new Set();
  for (let page = 1; ; page++) {
    const r = await fetch(`${wc}/products?per_page=100&page=${page}&status=any&_fields=sku&${q}`).then((x) => x.json());
    if (!Array.isArray(r) || !r.length) break;
    r.forEach((p) => p.sku && set.add(p.sku));
    if (r.length < 100) break;
  }
  return set;
}

const master = JSON.parse(readFileSync(join(HERE, 'master.json'), 'utf8'));
const have = await allSkus();
console.log(`woo has ${have.size} skus; master has ${master.length}`);

const payloads = master.filter((m) => !have.has(m.code)).map((m) => {
  const cost = m.supplier_price_per_m || 0;
  const cats = CATMAP[`${m.category}|${m.sub_category}`];
  const manage = !!m.manage_stock;
  const qty = manage && m.available_m != null ? Math.max(0, Math.floor(m.available_m)) : null;
  const status = manage ? (qty > 0 ? 'instock' : 'outofstock')
    : (m.availability_flag === 'In Stock' ? 'instock' : 'onbackorder');
  const name = (m.name || m.code).replace(/[^\x20-\x7E]/g, '').trim() || m.code;
  const quoteOnly = !m.orderable && !(manage && (m.available_m || 0) > 0);
  const p = {
    name: `${name} (${m.code})`, type: 'simple', status: 'draft', sku: m.code,
    regular_price: (cost + INSTALL + PROFIT).toFixed(2),
    short_description: `Supply &amp; installation of Vinyl Wrapping - ${name} (${m.code}). BODAQ interior film, ${m.sub_category}. Priced per linear metre, roll width 1.22 m.`,
    manage_stock: manage, stock_status: status, sold_individually: false, tax_status: 'none',
    categories: [{ id: cats[0] }, { id: cats[1] }],
    meta_data: [
      { key: '_bodaq_code', value: m.code },
      { key: '_bodaq_cost_per_m', value: cost.toFixed(2) },
      { key: '_bodaq_availability_flag', value: m.availability_flag },
      { key: '_bodaq_swatch_hex', value: m.hex_sampled || m.hex_catalog || '' },
      { key: '_bodaq_swatch_file', value: m.swatch_file },
      { key: '_bodaq_roll_size', value: m.roll_size || '' },
      { key: '_bodaq_quote_only', value: quoteOnly ? 'yes' : 'no' },
    ],
  };
  if (manage && qty != null) p.stock_quantity = qty;
  return p;
});

console.log(`creating ${payloads.length} missing products (no images)`);
let created = 0;
for (let i = 0; i < payloads.length; i += 50) {
  const chunk = payloads.slice(i, i + 50);
  const res = await fetch(`${wc}/products/batch?${q}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ create: chunk }),
  });
  const j = JSON.parse(await res.text());
  const errs = (j.create || []).filter((c) => c.error);
  created += chunk.length - errs.length;
  console.log(`  batch ${i / 50}: +${chunk.length - errs.length}${errs.length ? ` (${errs.length} err: ${errs[0].error.code})` : ''}`);
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(`done — ${created} created`);
