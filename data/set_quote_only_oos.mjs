const q="consumer_key=ck_a5bb8aa67009a985de153b9ec7abe9b4775a213e&consumer_secret=cs_5ac3e2cfdde78b1d17f76b81e0d964a2faf0310f";
const wc="https://visionthree.ae/wp-json/wc/v3";
// products flagged quote-only
const targets=[];
for(let p=1;;p++){
  const r=await fetch(`${wc}/products?per_page=100&page=${p}&status=any&_fields=id,sku,stock_status,meta_data&${q}`).then(x=>x.json());
  if(!Array.isArray(r)||!r.length)break;
  for(const x of r){
    const qo=(x.meta_data||[]).find(m=>m.key==='_bodaq_quote_only');
    if(qo&&qo.value==='yes'&&x.stock_status!=='outofstock') targets.push(x.id);
  }
  if(r.length<100)break;
}
console.log(`${targets.length} quote-only products to set outofstock`);
let ok=0;
for(const id of targets){
  const r=await fetch(`${wc}/products/${id}?${q}`,{method:"PUT",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({manage_stock:false,stock_status:"outofstock",backorders:"no"})}).then(x=>x.json());
  if(r.id===id){ok++;process.stdout.write('.')}else process.stdout.write('x');
  await new Promise(r=>setTimeout(r,450));
}
console.log(`\ndone ${ok}/${targets.length}`);
