const q="consumer_key=ck_a5bb8aa67009a985de153b9ec7abe9b4775a213e&consumer_secret=cs_5ac3e2cfdde78b1d17f76b81e0d964a2faf0310f";
const wc="https://visionthree.ae/wp-json/wc/v3";
const VIS="https://imranjaf2003.github.io/bodaq-assets/visualizer/visualizer.html";
import { readFileSync } from 'node:fs';
const master=JSON.parse(readFileSync(new URL('./master.json',import.meta.url),'utf8'));
const byCode=new Map(master.map(m=>[m.code,m]));

const prods=[];
for(let p=1;;p++){
  const r=await fetch(`${wc}/products?per_page=100&page=${p}&status=any&_fields=id,sku,short_description&${q}`).then(x=>x.json());
  if(!Array.isArray(r)||!r.length)break;
  for(const x of r) if(x.sku && byCode.has(x.sku)) prods.push(x);
  if(r.length<100)break;
}
console.log(`${prods.length} products`);
let ok=0,skip=0;
for(const x of prods){
  if(x.short_description && x.short_description.includes('visualizer.html')){ skip++; continue; }
  const m=byCode.get(x.sku);
  const name=(m.name||m.code).replace(/[^\x20-\x7E]/g,'').trim();
  const base=`Supply &amp; installation of Vinyl Wrapping - ${name} (${m.code}). BODAQ interior film, ${m.sub_category}. Priced per linear metre, roll width 1.22 m.`;
  const btn=`<p><a class="button" target="_blank" rel="noopener" href="${VIS}?c=${m.code}&item=wardrobe&shop=https://visionthree.ae">See ${name} on a wardrobe, door or kitchen &rarr;</a></p>`;
  const r=await fetch(`${wc}/products/${x.id}?${q}`,{method:"PUT",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({short_description:`<p>${base}</p>${btn}`})}).then(y=>y.json());
  if(r.id===x.id){ok++;process.stdout.write('.')}else process.stdout.write('x');
  await new Promise(r=>setTimeout(r,450));
}
console.log(`\nupdated ${ok}, already had it ${skip}`);
