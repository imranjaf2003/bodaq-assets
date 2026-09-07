# BODAQ stock sync

`sync-stock.mjs` pulls warehouse metres from the Apps Script bridge and writes
them into WooCommerce as managed stock, every 20 minutes via
`.github/workflows/stock-sync.yml`.

**Only stock is touched** (`manage_stock` / `stock_quantity` / `stock_status`).
Price is never changed — it is owner-managed in wp-admin.

## Required GitHub repo secrets

| Secret | Value |
|---|---|
| `APPS_SCRIPT_URL` | the `/exec` URL of the stock bridge |
| `APPS_SCRIPT_TOKEN` | its token |
| `WC_URL` | `https://visionthree.ae` |
| `WC_KEY` | WooCommerce REST consumer key (Read/Write) |
| `WC_SECRET` | WooCommerce REST consumer secret |

Set them at **Settings → Secrets and variables → Actions → New repository secret**.

## Manual run / dry run

Actions tab → **BODAQ stock sync** → **Run workflow** → tick *dry_run* to see the
diff without writing.
