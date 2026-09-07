#!/usr/bin/env python3
"""Generate WooCommerce /products/batch create payloads from master.json (minimal fields)."""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = "https://cdn.jsdelivr.net/gh/imranjaf2003/bodaq-assets@main/swatches/"
INSTALL_RATE = 40
PROFIT = 30
BATCH = 20

CATMAP = {
    ("01 Basic", "Mono Blanc"): [363, 368], ("01 Basic", "Painted Wood"): [363, 369],
    ("01 Basic", "Premium Painted Concrete"): [363, 370], ("01 Basic", "Premium Painted Wood"): [363, 371],
    ("01 Basic", "Solid"): [363, 372], ("01 Basic", "Super Matt"): [363, 373],
    ("01 Basic", "Texture"): [363, 374],
    ("02 Wood", "Optical Grain Wood"): [364, 375], ("02 Wood", "Origin Wood"): [364, 376],
    ("02 Wood", "Premium Wood"): [364, 377], ("02 Wood", "Standard Wood"): [364, 378],
    ("02 Wood", "Wood Palette"): [364, 379],
    ("03 Natural Surface", "Gold"): [365, 380], ("03 Natural Surface", "Natural Fabric"): [365, 381],
    ("03 Natural Surface", "Real Fabric"): [365, 382], ("03 Natural Surface", "Real Metal"): [365, 383],
    ("03 Natural Surface", "Soft Fabric"): [365, 384], ("03 Natural Surface", "Soft Leather"): [365, 385],
    ("03 Natural Surface", "UMI"): [365, 386], ("03 Natural Surface", "Velvet Metal"): [365, 387],
    ("04 Stone & Marble", "Premium Marble"): [366, 388], ("04 Stone & Marble", "Stone & Marble"): [366, 389],
    ("05 Etc", "Easy Clean Film"): [367, 390], ("05 Etc", "Exterior Film"): [367, 391],
}

# SKUs confirmed already created in WooCommerce (verified via _sku query)
DONE = set("""BLC01 S147 LW102
BLC02 BLC03 BLC04 BLC05 BLC06 BLC07 PTW01 PTW02 PTW04 PTW05 PTW06 PTW07 PTW08 PTW09
PTW10 PTW11 PTW12 PTW14 PTW15 PTW16 ZSW04 PNC41 PNC42 PNC43 PNC44
PNC45 PNC46 PNC47 PNC49 PNC50 PNC51 PNC52 PNC53 PNC54 PNC55 PNC56 PNC57 PNC58 PNC59
PNT01 PNT02 PNT03 PNT04 PNT05 PNT07 PNT09 PNT10
S115 S126 S127 S128 S140 S141 S143 S145 S146 S149 S150 S153 S156 S157 S158 S159 S166
S169 S173 S175 S176 S177 S178 S179 S181 S183 S185 S186
S188 S189 S194 S195 S197 S198 S200 S201 S202 S204 S208 S209 S210 S211 S212 S213 S214
S215 S216 S217 S218 S219 S230 S231 S232 S233 S234 S235 S236 S237 S238 S239 S240 S241
S242 S243 S244 S245 S246 S247 S248 S249 S250 S251 S252 S253 S254 S255 S256 S257
S258 S259 S260 S261 S262 S263 S264 S265 S266 SMT01 SMT02 SMT03 SMT04 SMT05 SMT06 SMT07
SMT10 SMT11 SMT12 SMT13 SMT14 SMT15 SMT16 SMT17 SMT18 SMT20 SMT21 SMT24 CP202 HS204
LM202 LS102 LS103 LS104 LS106 OGW02 OGW03 OGW04 OGW05
SPW01 SPW03 SPW05 SPW09 SPW10 SPW11 SPW12 SPW13 SPW14 SPW15 SPW16
SPW17 SPW18 SPW19 SPW20 SPW22 SPW23 SPW24 SPW25 SPW26 SPW27 SPW28 SPW29 SPW30 SPW38
SPW39 SPW40 SPW41 SPW42 SPW43 SPW44 SPW45 SPW46 SPW47 SPW48 SPW49 SPW50 SPW52 SPW53
SPW54 SPW55 SPW56 SPW57 SPW60 SPW61 SPW62 SPW63 SPW64 SPW65 SPW66 SPW67 SPW68 SPW69
SPW70 SPW71 SPW72 SPW73 SPW88 SPW89 SPW90 SPW91 SPW92 SPW94 SPW95 SPW96""".split())

master = [m for m in json.load(open(os.path.join(HERE, "master.json"), encoding="utf-8"))
          if m["code"] not in DONE]

def product(m):
    cost = m["supplier_price_per_m"] or 0
    retail = round(cost + INSTALL_RATE + PROFIT, 2)
    cats = CATMAP[(m["category"], m["sub_category"])]
    manage = bool(m["manage_stock"])
    qty = max(0, int(math.floor(m["available_m"]))) if (manage and m["available_m"] is not None) else None
    if manage:
        status = "instock" if (qty or 0) > 0 else "outofstock"
    else:
        status = "instock" if m["availability_flag"] == "In Stock" else "onbackorder"
    name = (m["name"] or m["code"]).encode("ascii", "ignore").decode() or m["code"]
    quote_only = (not m["orderable"]) and not (manage and (m["available_m"] or 0) > 0)
    p = {
        "name": f'{name} ({m["code"]})',
        "type": "simple",
        "status": "draft",
        "sku": m["code"],
        "regular_price": f"{retail:.2f}",
        "short_description": (
            f'Supply &amp; installation of Vinyl Wrapping - {name} ({m["code"]}). '
            f'BODAQ interior film, {m["sub_category"]}. Priced per linear metre, roll width 1.22 m.'
        ),
        "manage_stock": manage,
        "stock_status": status,
        "sold_individually": False,
        "tax_status": "none",
        "categories": [{"id": cats[0]}, {"id": cats[1]}],
        "images": [{"src": RAW + m["swatch_file"]}],
        "meta_data": [
            {"key": "_bodaq_code", "value": m["code"]},
            {"key": "_bodaq_cost_per_m", "value": f"{cost:.2f}"},
            {"key": "_bodaq_availability_flag", "value": m["availability_flag"]},
            {"key": "_bodaq_swatch_hex", "value": m["hex_sampled"] or m["hex_catalog"] or ""},
            {"key": "_bodaq_roll_size", "value": m["roll_size"] or ""},
            {"key": "_bodaq_quote_only", "value": "yes" if quote_only else "no"},
        ],
    }
    if manage and qty is not None:
        p["stock_quantity"] = qty
    return p

products = [product(m) for m in master]
os.makedirs(os.path.join(HERE, "import_batches"), exist_ok=True)
for f in os.listdir(os.path.join(HERE, "import_batches")):
    os.remove(os.path.join(HERE, "import_batches", f))
batches = [products[i:i + BATCH] for i in range(0, len(products), BATCH)]
for i, b in enumerate(batches):
    with open(os.path.join(HERE, "import_batches", f"b{i:02d}.json"), "w", encoding="utf-8") as f:
        json.dump({"create": b}, f, ensure_ascii=False, separators=(",", ":"))

print(f"{len(products)} products left -> {len(batches)} batches of {BATCH}")
for i in range(len(batches)):
    print(f"  b{i:02d}.json  {os.path.getsize(os.path.join(HERE,'import_batches',f'b{i:02d}.json'))} bytes  {len(batches[i])} products")
