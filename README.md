# bodaq-assets

Static asset + data source for the BODAQ vinyl-wrap catalog (WooCommerce store on
visionthree.ae + the fitout-suite quotation app + the colour/material visualizer).

## Contents

| Path | What |
|---|---|
| `swatches/<CODE>.jpg\|png` | 468 swatch images, one per product code. Filename stem = product code (`SKU`). Flat colours are solid PNGs; wood/stone/fabric/marble are texture photos. |
| `data/master.csv` / `data/master.json` | Normalized catalog: every code joined with supplier cost price, category/sub-category, warehouse stock (metres), and the sampled true swatch colour. Rebuilt by `data/build_master.py`. |

## Image URLs

Public repo, so images are served directly by GitHub's CDN:

```
https://raw.githubusercontent.com/imranjaf2003/bodaq-assets/main/swatches/W504.jpg
```

WooCommerce side-loads these into its own media library during the product
import, so after import the store no longer depends on this repo. The repo stays
as the full-resolution source for the visualizer (WooCommerce keeps only
resized copies).

## Regenerating the data

```bash
cd data && python build_master.py
```

Needs the source spreadsheet + the 5 stock-tab CSV exports (see the script header).
