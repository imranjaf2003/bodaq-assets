#!/usr/bin/env node
/**
 * BODAQ stock sync — pulls warehouse metres from the Apps Script bridge and
 * writes them into WooCommerce as managed stock. Runs on a schedule from
 * .github/workflows/stock-sync.yml.
 *
 * Touches ONLY stock (manage_stock / stock_quantity / stock_status).
 * Never touches price — that is owner-managed in wp-admin.
 *
 * Env:
 *   APPS_SCRIPT_URL    the /exec URL of the stock bridge
 *   APPS_SCRIPT_TOKEN  its token
 *   WC_URL             https://visionthree.ae
 *   WC_KEY             WooCommerce REST consumer key  (Read/Write)
 *   WC_SECRET          WooCommerce REST consumer secret
 *   DRY_RUN            "1" to log the diff without writing
 */

const { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN, WC_URL, WC_KEY, WC_SECRET } = process.env;
const DRY_RUN = process.env.DRY_RUN === '1';

for (const [k, v] of Object.entries({ APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN, WC_URL, WC_KEY, WC_SECRET })) {
  if (!v) { console.error(`Missing env ${k}`); process.exit(1); }
}

const wcBase = `${WC_URL.replace(/\/$/, '')}/wp-json/wc/v3`;

// Query-param auth over HTTPS — immune to Authorization-header stripping by
// security plugins / proxies (this site runs All-In-One WP Security).
function wcUrl(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${wcBase}${path}${sep}consumer_key=${encodeURIComponent(WC_KEY)}&consumer_secret=${encodeURIComponent(WC_SECRET)}`;
}

async function wc(path, opts = {}) {
  const res = await fetch(wcUrl(path), {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WC ${opts.method || 'GET'} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function normSku(s) {
  return String(s).replace(/\([^)]*\)/g, '').replace(/\s+/g, '').toUpperCase().trim();
}

async function main() {
  // 1. stock feed
  const feed = await fetch(`${APPS_SCRIPT_URL}?token=${encodeURIComponent(APPS_SCRIPT_TOKEN)}`).then((r) => r.json());
  if (feed.error) throw new Error(`stock bridge: ${feed.error}`);
  const stock = new Map(Object.entries(feed.stock).map(([k, v]) => [normSku(k), Math.max(0, Math.floor(Number(v) || 0))]));
  console.log(`stock feed: ${stock.size} codes (generated ${feed.generated})`);

  // 2. all products (paginated)
  const products = [];
  for (let page = 1; ; page++) {
    const batch = await wc(`/products?per_page=100&page=${page}&status=any&_fields=id,sku,manage_stock,stock_quantity,stock_status`);
    if (!batch.length) break;
    products.push(...batch);
    if (batch.length < 100) break;
  }
  console.log(`woo products: ${products.length}`);

  // 3. diff
  const updates = [];
  let matched = 0;
  for (const p of products) {
    if (!p.sku) continue;
    const key = normSku(p.sku);
    if (!stock.has(key)) continue;
    matched++;
    const qty = stock.get(key);
    const status = qty > 0 ? 'instock' : 'outofstock';
    const cur = Number(p.stock_quantity ?? -1);
    if (p.manage_stock === true && cur === qty && p.stock_status === status) continue;
    updates.push({ id: p.id, manage_stock: true, stock_quantity: qty, stock_status: status });
  }

  console.log(`matched ${matched} / ${stock.size} feed codes; ${updates.length} need updating`);
  if (!updates.length) { console.log('nothing to do'); return; }
  if (DRY_RUN) {
    console.log(JSON.stringify(updates.slice(0, 30), null, 1));
    console.log(`(dry run — ${updates.length} updates not written)`);
    return;
  }

  // 4. batch write (chunks of 50)
  let written = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const chunk = updates.slice(i, i + 50);
    const res = await wc('/products/batch', { method: 'POST', body: JSON.stringify({ update: chunk }) });
    const errs = (res.update || []).filter((u) => u.error);
    written += chunk.length - errs.length;
    if (errs.length) console.error(`chunk ${i / 50}: ${errs.length} errors`, errs.slice(0, 3));
  }
  console.log(`done — ${written} products updated`);
}

main().catch((e) => { console.error(e); process.exit(1); });
