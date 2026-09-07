import json
m=json.load(open('master.json'))
CAT={'01 Basic':'Basic','02 Wood':'Wood','03 Natural Surface':'Natural Surface','04 Stone & Marble':'Stone & Marble','05 Etc':'Specialty'}
rows=[]
for x in sorted(m,key=lambda r:(r['category'],r['sub_category'],r['code'])):
    name=(x['name'] or x['code']).replace("'", "\u2019")
    rows.append('  { code: %s, name: %s, category: %s, sub: %s, costPerM: %s, hex: %s },' % (
        json.dumps(x['code']), json.dumps(name), json.dumps(CAT[x['category']]),
        json.dumps(x['sub_category']), format(x['supplier_price_per_m'], '.2f'),
        json.dumps(x['hex_sampled'] or x['hex_catalog'] or '#cccccc')))
hdr='''// AUTO-GENERATED from bodaq-assets/data/master.json - do not edit by hand.
// Supplier cost per linear metre (roll width 1.22 m). Client price is
// costPerM + vinylWrapInstall + vinylWrapProfit (see rateDefs.ts).
export interface BodaqColor {
  code: string;
  name: string;
  category: 'Basic' | 'Wood' | 'Natural Surface' | 'Stone & Marble' | 'Specialty';
  sub: string;
  /** Supplier cost, AED per linear metre. */
  costPerM: number;
  /** Average colour sampled from the swatch image, for chips + the visualizer. */
  hex: string;
}

export const BODAQ_COLORS: BodaqColor[] = [
'''
out=hdr + "\n".join(rows) + "\n];\n"
open(r'C:/Users/Administrator/dev/fitout-suite/src/data/bodaqColors.ts','w',encoding='utf-8').write(out)
print('wrote', len(rows), 'colours')
