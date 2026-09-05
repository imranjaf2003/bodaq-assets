#!/usr/bin/env python3
"""Build the BODAQ normalized master dataset: catalog x price x stock (5 tabs)."""
import csv, io, json, re, zipfile, glob, os
from collections import Counter
import openpyxl
from PIL import Image

BASE = r'D:/Backup-19-11-2024/CLIENTS/web and graphic solutions/vision three/New pages- AI/Wrapping services/bodaq'
SCRATCH = os.path.dirname(os.path.abspath(__file__))

# ---------- code normalization ----------
def norm(code):
    """Canonical code: strip all parentheticals and whitespace, uppercase."""
    c = re.sub(r'\([^)]*\)', '', str(code)).strip()
    c = c.replace(' ', '')
    return c.upper()

def code_variants(raw):
    raw = str(raw).strip()
    vs = set()
    stripped = re.sub(r'\([^)]*\)', '', raw).strip()
    # slash-separated alternates
    for part in re.split(r'\s*/\s*', stripped):
        if part.strip():
            vs.add(norm(part))
    # parenthetical aliases: "ZX126 (PZ013)" -> ZX126 and PZ013
    for m in re.findall(r'\(([A-Za-z0-9\-]+)\)', raw):
        vs.add(norm(m))
    vs.add(norm(raw))
    vs.discard('')
    return vs

def meters(expr):
    if expr is None: return 0.0
    s = str(expr).strip()
    if not s or s == '0': return 0.0
    tot = 0.0
    for p in s.split('+'):
        n = re.sub(r'[^0-9.]', '', p)
        if n:
            try: tot += float(n)
            except ValueError: pass
    return tot

# ---------- 1. catalog ----------
wb = openpyxl.load_workbook(os.path.join(BASE, 'BODAQ_Color_Catalog.xlsx'))
ws = wb['Color Catalog']
rows = list(ws.iter_rows(values_only=True))
chead = list(rows[0])
def ci(name): return chead.index(name)
catalog = {}
for r in rows[1:]:
    code = str(r[ci('Code')]).strip()
    catalog[norm(code)] = {
        'code': code,
        'category': r[ci('Category')],
        'sub_category': r[ci('Sub-Category')],
        'swatch_type': r[ci('Swatch Type')],
        'hex_approx': r[ci('Hex (approx.)')],
        'swatch_file': str(r[ci('Swatch Image File')]).strip(),
        'source_page': r[ci('Source Page')],
    }
print(f"catalog codes: {len(catalog)}")

# ---------- 2. price sheet ----------
price = {}
with open(os.path.join(SCRATCH, 'price.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f):
        code = r['Code'].strip()
        if not code: continue
        price[norm(code)] = {
            'name': r['Name'].strip(),
            'roll_size': r['Roll Size'].strip(),
            'price_sheet_category': r['Category'].strip(),
            'availability_flag': r['Stocked/ Special Order'].strip(),
            'price_per_m': float(r['Price per Meter (AED)'].replace(',', '') or 0),
            'price_per_roll': float(r['Price Per Roll (AED)'].replace(',', '') or 0),
        }
print(f"price rows: {len(price)}")

# ---------- 3. stock (5 tabs) ----------
stock = {}          # norm code -> {available_m, full_rolls, partial_m, reserved_m, raw_code, tab}
stock_orphans = []  # stock rows that match no catalog code
STOCK_FILES = glob.glob(os.path.join(SCRATCH, 'stock_*.csv'))
STOCK_FILES = [p for p in STOCK_FILES if 'painted_woods.csv' not in p]  # drop the early partial dump

for path in sorted(STOCK_FILES):
    tab = os.path.basename(path).replace('stock_', '').replace('.csv', '').replace('_', ' ')
    rows = list(csv.reader(open(path, encoding='utf-8')))
    # locate header rows
    code_col = None
    full_col = None
    reserved_col = None
    hdr_row_idx = None
    for i, row in enumerate(rows[:6]):
        for j, cell in enumerate(row):
            cl = str(cell).strip().lower()
            if cl in ('code',): code_col = j
            if 'rolls)' in cl or ('125cms' in cl): full_col = j
            if cl.startswith('reserve'): reserved_col = j
        if any('rolls)' in str(c).lower() or '125cms' in str(c).lower() for c in row):
            hdr_row_idx = i
    if code_col is None:
        # CODE is usually col 2
        code_col = 2
    partial_cols = list(range(full_col + 1, reserved_col)) if (full_col is not None and reserved_col) else []
    data_start = (hdr_row_idx or 2) + 1
    for row in rows[data_start:]:
        if len(row) <= code_col: continue
        raw = str(row[code_col]).strip()
        if not raw: continue
        if raw.lower().strip('"').startswith('regularly stocked'): continue
        if not re.search(r'[A-Za-z]', raw): continue  # section headers / junk
        full = meters(row[full_col]) if full_col is not None and len(row) > full_col else 0.0
        part = sum(meters(row[c]) for c in partial_cols if len(row) > c)
        resv = meters(row[reserved_col]) if reserved_col and len(row) > reserved_col else 0.0
        avail = full * 50 + part - resv
        rec = {'available_m': round(avail, 1), 'full_rolls': full, 'partial_m': round(part, 1),
               'reserved_m': resv, 'raw_code': raw, 'tab': tab}
        matched = False
        for v in code_variants(raw):
            if v in catalog:
                # keep the larger if duplicate
                if v not in stock or stock[v]['available_m'] < avail:
                    stock[v] = rec
                matched = True
        if not matched:
            stock_orphans.append(rec)

print(f"stock matched catalog codes: {len(stock)}  | stock orphan rows: {len(stock_orphans)}")

# ---------- 4. sample true swatch colour ----------
def avg_hex(img_bytes):
    im = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    im.thumbnail((64, 64))
    px = list(im.getdata())
    n = len(px)
    r = sum(p[0] for p in px) // n
    g = sum(p[1] for p in px) // n
    b = sum(p[2] for p in px) // n
    return f'#{r:02X}{g:02X}{b:02X}'

swatch_hex = {}
with zipfile.ZipFile(os.path.join(BASE, 'BODAQ_Swatch_Images.zip')) as z:
    for name in z.namelist():
        if name.endswith('/'): continue
        key = norm(os.path.splitext(name)[0])
        try:
            swatch_hex[key] = avg_hex(z.read(name))
        except Exception as e:
            swatch_hex[key] = None
print(f"sampled swatch colours: {sum(1 for v in swatch_hex.values() if v)}")

# ---------- 5. join ----------
master = []
for k, cat in catalog.items():
    p = price.get(k, {})
    s = stock.get(k)
    has_stock = s is not None
    flag = p.get('availability_flag', '')
    if has_stock:
        avail_m = s['available_m']
        stock_status = 'instock' if avail_m > 0 else 'outofstock'
        manage_stock = True
    else:
        avail_m = None
        manage_stock = False
        stock_status = 'instock' if flag == 'In Stock' else 'onbackorder' if flag == 'Special Order' else 'instock'
    master.append({
        'code': cat['code'],
        'norm_code': k,
        'name': p.get('name') or cat['code'],
        'category': cat['category'],
        'sub_category': cat['sub_category'],
        'swatch_type': cat['swatch_type'],
        'swatch_file': cat['swatch_file'],
        'hex_catalog': cat['hex_approx'],
        'hex_sampled': swatch_hex.get(k),
        'source_page': cat['source_page'],
        'roll_size': p.get('roll_size'),
        'supplier_price_per_m': p.get('price_per_m'),
        'supplier_price_per_roll': p.get('price_per_roll'),
        'availability_flag': flag,                 # In Stock / Special Order
        'orderable': flag != 'Special Order',      # Special Order => quote only
        'manage_stock': manage_stock,
        'available_m': avail_m,
        'stock_status': stock_status,
        'stock_tab': s['tab'] if has_stock else None,
        'stock_raw_code': s['raw_code'] if has_stock else None,
        'in_price_sheet': k in price,
    })

master.sort(key=lambda m: (str(m['category']), str(m['sub_category']), m['code']))

# ---------- 6. write ----------
with open(os.path.join(SCRATCH, 'master.json'), 'w', encoding='utf-8') as f:
    json.dump(master, f, indent=1, ensure_ascii=False)
cols = list(master[0].keys())
with open(os.path.join(SCRATCH, 'master.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
    for m in master: w.writerow(m)
with open(os.path.join(SCRATCH, 'stock_orphans.json'), 'w', encoding='utf-8') as f:
    json.dump(stock_orphans, f, indent=1)

# ---------- 7. report ----------
print("\n=== MASTER REPORT ===")
print(f"total products: {len(master)}")
print(f"missing from price sheet: {sum(1 for m in master if not m['in_price_sheet'])}")
no_price = [m['code'] for m in master if not m['supplier_price_per_m']]
print(f"no supplier price/m: {len(no_price)} {no_price[:15]}")
print(f"orderable (not Special Order): {sum(1 for m in master if m['orderable'])}")
print(f"quote-only (Special Order): {sum(1 for m in master if not m['orderable'])}")
print(f"managed numeric stock: {sum(1 for m in master if m['manage_stock'])}")
print(f"  of those, currently out of stock (0 m): {sum(1 for m in master if m['manage_stock'] and m['stock_status']=='outofstock')}")
print(f"no sampled hex: {sum(1 for m in master if not m['hex_sampled'])}")
print(f"stock orphan rows (in stock sheet, not in catalog): {len(stock_orphans)}")
print("  orphan codes:", sorted({o['raw_code'] for o in stock_orphans}))
print("\nby category:")
for cat, n in Counter(m['category'] for m in master).most_common():
    covered = sum(1 for m in master if m['category'] == cat and m['manage_stock'])
    print(f"  {cat}: {n} products, {covered} with numeric stock")
