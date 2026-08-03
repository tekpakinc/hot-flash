document.addEventListener('DOMContentLoaded',async()=>{
  if(document.body?.dataset?.page!=='vehicle'||typeof hotflashSupabase==='undefined')return;
  const ownerOnly=[
    '[data-owner-gallery-tools]',
    '[data-video-owner-tools]',
    '[data-flashtag-owner-actions]',
    '[data-vehicle-transfer]'
  ];
  const lock=()=>ownerOnly.forEach(selector=>document.querySelectorAll(selector).forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true');el.querySelectorAll('button,input,select,textarea').forEach(control=>control.disabled=true)}));
  const unlock=()=>ownerOnly.forEach(selector=>document.querySelectorAll(selector).forEach(el=>{el.hidden=false;el.removeAttribute('aria-hidden');el.querySelectorAll('button,input,select,textarea').forEach(control=>control.disabled=false)}));
  lock();
  const params=new URLSearchParams(location.search),ref=params.get('id')||params.get('hf');
  if(!ref)return;
  try{
    const session=window.hotFlashGetStableSession?await window.hotFlashGetStableSession():(await hotflashSupabase.auth.getSession()).data.session;
    if(!session)return;
    let query=hotflashSupabase.from('vehicles').select('id,owner_id');
    query=ref.startsWith('HF-')?query.eq('hotflash_id',ref):query.eq('id',ref);
    const{data:vehicle,error}=await query.maybeSingle();
    if(error||!vehicle||vehicle.owner_id!==session.user.id)return;
    unlock();
  }catch(error){
    console.warn('[Vehicle permission guard]',error);
    lock();
  }
});