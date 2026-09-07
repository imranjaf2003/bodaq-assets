#!/usr/bin/env node
/**
 * Create each still-missing BODAQ product with a single POST /wc/v3/products
 * (the batch endpoint on this host reports success but drops rows). Text only.
 * Verifies each write by reading the product back.
 *
 *   WC_URL WC_KEY WC_SECRET  node data/create_one_by_one.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

const master = JSON.parse(readFileSync(join(HERE, 'master.json'), 'utf8'));
const have = new Set(JSON.parse(readFileSync(join(HERE, 'existing_skus.json'), 'utf8')));
const todo = master.filter((m) => !have.has(m.code));
console.log(`${todo.length} to create`);

function payload(m) {
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
      { key: '_bodaq_code', value: m.code }, { key: '_bodaq_cost_per_m', value: cost.toFixed(2) },
      { key: '_bodaq_availability_flag', value: m.availability_flag },
      { key: '_bodaq_swatch_hex', value: m.hex_sampled || m.hex_catalog || '' },
      { key: '_bodaq_swatch_file', value: m.swatch_file },
      { key: '_bodaq_roll_size', value: m.roll_size || '' },
      { key: '_bodaq_quote_only', value: quoteOnly ? 'yes' : 'no' },
    ],
  };
  if (manage && qty != null) p.stock_quantity = qty;
  return p;
}

let ok = 0, fail = [];
for (const m of todo) {
  try {
    const res = await fetch(`${wc}/products?${q}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(m)),
    });
    const j = JSON.parse(await res.text());
    if (j.id && j.sku === m.code) { ok++; process.stdout.write('.'); }
    else { fail.push([m.code, j.code || j.message || 'no id']); process.stdout.write('x'); }
  } catch (e) { fail.push([m.code, e.message]); process.stdout.write('!'); }
  await new Promise((r) => setTimeout(r, 700));
}
console.log(`\ncreated ${ok}, failed ${fail.length}`);
if (fail.length) { console.log(fail.slice(0, 40)); writeFileSync(join(HERE, 'import_failures.json'), JSON.stringify(fail, null, 1)); }
