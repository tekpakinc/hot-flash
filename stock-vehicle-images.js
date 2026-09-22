(function(){
  const ENDPOINT='https://carapi.trustcar.info/getImage';
  const cache=new Map();
  function key(v){return [v?.year,v?.make,v?.model].filter(Boolean).join('|').toLowerCase()}
  function eligible(v){return Boolean(v&&!v.cover_photo&&v.make&&v.model&&String(v.vehicle_type||'automobile').toLowerCase()==='automobile')}
  function directUrl(v,withYear=true){
    const p=new URLSearchParams({make:v.make,model:v.model});
    if(withYear&&v.year)p.set('year',v.year);
    return ENDPOINT+'?'+p.toString();
  }
  function preload(url){return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(url);img.onerror=()=>resolve(null);img.referrerPolicy='no-referrer';img.src=url})}
  async function resolve(v){
    if(!eligible(v))return null;
    const k=key(v);if(cache.has(k))return cache.get(k);
    const promise=(async()=>{
      let url=await preload(directUrl(v,true));
      if(!url&&v.year)url=await preload(directUrl(v,false));
      return url?{url,attribution:'Reference vehicle image via Wikimedia Commons',source:'Wikimedia Commons'}:null;
    })();
    cache.set(k,promise);return promise;
  }
  function applyBackground(el,result){
    if(!el||!result?.url)return;
    el.style.backgroundImage=`linear-gradient(0deg,rgba(32,34,37,.72),rgba(32,34,37,.05)),url("${String(result.url).replace(/["\\]/g,'')}")`;
    el.style.backgroundSize='cover';el.style.backgroundPosition='center';el.classList.add('has-stock-image');
    el.title=result.attribution;
    let badge=el.querySelector('.stock-image-badge');
    if(!badge){badge=document.createElement('span');badge.className='stock-image-badge';badge.textContent='Reference image';el.appendChild(badge)}
    badge.title=result.attribution;
  }
  async function hydrate(root=document){
    const nodes=[...root.querySelectorAll('[data-stock-vehicle]')];
    await Promise.all(nodes.map(async el=>{try{const v=JSON.parse(el.dataset.stockVehicle||'{}');const result=await resolve(v);if(result)applyBackground(el,result)}catch(error){console.warn('[Hot Flash stock image]',error)}}));
  }
  window.HotFlashStockVehicleImages={resolve,applyBackground,hydrate,eligible};
})();