(()=>{
  if(document.body?.dataset?.page!=='vehicle'||!window.hotflashSupabase)return;
  const params=new URLSearchParams(location.search),ref=params.get('id')||params.get('hf');if(!ref)return;
  async function load(){
    let q=hotflashSupabase.from('vehicles').select('id,hotflash_id,engine_displacement,engine_cylinders,aspiration,drivetrain,transmission,fuel_type,body_style,factory_trim,stock_specs_source').limit(1);
    q=ref.startsWith('HF-')?q.eq('hotflash_id',ref):q.eq('id',ref);
    const{data,error}=await q.maybeSingle();if(error||!data)return;
    const root=document.querySelector('[data-specs-grid]');if(!root)return;
    const rows=[['Factory trim',data.factory_trim],['Engine displacement',data.engine_displacement],['Engine configuration',data.engine_cylinders],['Aspiration',data.aspiration],['Drivetrain',data.drivetrain],['Transmission',data.transmission],['Fuel type',data.fuel_type],['Body style',data.body_style]].filter(([,v])=>v);
    if(!rows.length)return;
    const esc=v=>String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    const render=()=>{if(!root.children.length)return false;const existing=new Set([...root.querySelectorAll('span')].map(x=>x.textContent));for(const[label,value]of rows){if(existing.has(label))continue;root.insertAdjacentHTML('beforeend',`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`)}if(data.stock_specs_source&&!existing.has('Stock data source'))root.insertAdjacentHTML('beforeend',`<div><span>Stock data source</span><strong>${esc(data.stock_specs_source)} · owner editable</strong></div>`);return true};
    if(render())return;const observer=new MutationObserver(()=>{if(render())observer.disconnect()});observer.observe(root,{childList:true,subtree:true});
  }
  document.addEventListener('DOMContentLoaded',load);
})();