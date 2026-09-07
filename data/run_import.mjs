#!/usr/bin/env node
/**
 * One-off: POST every import_batches/b*.json to WooCommerce /products/batch.
 * Uses query-param REST auth. Reports per-batch created / errors.
 *
 *   WC_URL WC_KEY WC_SECRET  node data/run_import.mjs [startIndex]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { WC_URL, WC_KEY, WC_SECRET } = process.env;
if (!WC_URL || !WC_KEY || !WC_SECRET) { console.error('need WC_URL WC_KEY WC_SECRET'); process.exit(1); }

const dir = join(dirname(fileURLToPath(import.meta.url)), 'import_batches');
const base = `${WC_URL.replace(/\/$/, '')}/wp-json/wc/v3/products/batch?consumer_key=${encodeURIComponent(WC_KEY)}&consumer_secret=${encodeURIComponent(WC_SECRET)}`;
const start = Number(process.argv[2] || 0);

const files = readdirSync(dir).filter((f) => /^b\d+\.json$/.test(f)).sort();
let created = 0, failed = 0;

for (const f of files) {
  const idx = Number(f.match(/\d+/)[0]);
  if (idx < start) continue;
  const body = readFileSync(join(dir, f), 'utf8');
  const n = JSON.parse(body).create.length;
  process.stdout.write(`${f} (${n})... `);
  try {
    const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    const text = await res.text();
    if (!res.ok) { console.log(`HTTP ${res.status}: ${text.slice(0, 300)}`); failed += n; continue; }
    const json = JSON.parse(text);
    const errs = (json.create || []).filter((c) => c.error);
    const ok = (json.create || []).length - errs.length;
    created += ok; failed += errs.length;
    console.log(`ok ${ok}${errs.length ? `, ${errs.length} errors: ${errs.slice(0, 2).map((e) => e.error.code).join(',')}` : ''}`);
    if (errs.length) console.log('   ', JSON.stringify(errs.slice(0, 3).map((e) => e.error.message)));
  } catch (e) {
    console.log(`FAIL ${e.message}`); failed += n;
  }
  await new Promise((r) => setTimeout(r, 1500)); // breathe between batches
}
console.log(`\ncreated ${created}, failed ${failed}`);
