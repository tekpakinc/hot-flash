(function(){
  const ENDPOINT='https://carapi.trustcar.info/getImage';
  const cache=new Map();
  function key(v){return [v?.year,v?.make,v?.model].filter(Boolean).join('|').toLowerCase()}
  function eligible(v){return Boolean(v&&!v.cover_photo&&v.make&&v.model&&String(v.vehicle_type||'automobile').toLowerCase()==='automobile')}
  async function resolve(v){
    if(!eligible(v))return null;
    const k=key(v);if(cache.has(k))return cache.get(k);
    const params=new URLSearchParams({make:v.make,model:v.model,format:'json'});
    if(v.year)params.set('year',v.year);
    const promise=fetch(ENDPOINT+'?'+params.toString(),{mode:'cors'}).then(async r=>{
      if(!r.ok)return null;const data=await r.json();if(!data?.found||!data.image_url)return null;
      return{url:data.image_url,attribution:data.attribution||'Vehicle reference image via Wikimedia Commons',license:data.license||'',source:'Wikimedia Commons'};
    }).catch(()=>null);
    cache.set(k,promise);return promise;
  }
  function applyBackground(el,result){
    if(!el||!result?.url)return;
    el.style.backgroundImage=`linear-gradient(0deg,rgba(32,34,37,.72),rgba(32,34,37,.05)),url("${String(result.url).replace(/["\\]/g,'')}")`;
    el.style.backgroundSize='cover';el.style.backgroundPosition='center';el.classList.add('has-stock-image');
    el.title=result.attribution;
    let badge=el.querySelector('.stock-image-badge');
    if(!badge){badge=document.createElement('span');badge.className='stock-image-badge';badge.textContent='Stock image';el.appendChild(badge)}
    badge.title=result.attribution;
  }
  async function hydrate(root=document){
    const nodes=[...root.querySelectorAll('[data-stock-vehicle]')];
    await Promise.all(nodes.map(async el=>{try{const v=JSON.parse(el.dataset.stockVehicle||'{}');const result=await resolve(v);if(result)applyBackground(el,result)}catch(_){}}));
  }
  window.HotFlashStockVehicleImages={resolve,applyBackground,hydrate,eligible};
})();