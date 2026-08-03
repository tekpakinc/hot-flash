(()=>{
  if(document.body?.dataset?.page!=='vehicle'||!window.hotflashSupabase)return;
  const params=new URLSearchParams(location.search),ref=params.get('id')||params.get('hf'),thumbs=document.querySelector('[data-gallery-thumbnails]'),status=document.querySelector('[data-gallery-upload-status]');
  if(!ref||!thumbs)return;
  let vehicle=null,session=null,images=[],busy=false;
  const style=document.createElement('style');style.textContent='.gallery-thumbnails .owner-photo-thumb{position:relative}.vehicle-photo-delete{position:absolute;z-index:7;top:5px;right:5px;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(255,95,104,.85);background:rgba(5,6,7,.94);color:#ff5f68;font-size:22px;font-weight:900;line-height:1;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.55)}.vehicle-photo-delete:hover,.vehicle-photo-delete:focus{background:#ff5f68;color:#08090a;outline:none}.vehicle-photo-delete[aria-disabled="true"]{opacity:.45;pointer-events:none}';document.head.appendChild(style);
  const setStatus=(message,error=false)=>{if(!status)return;status.textContent=message||'';status.className=error?'small-muted error':'small-muted'};
  const stableSession=async()=>window.hotFlashGetStableSession?window.hotFlashGetStableSession():(await hotflashSupabase.auth.getSession()).data.session;
  async function loadContext(){
    session=await stableSession();
    if(!session)return false;
    let q=hotflashSupabase.from('vehicles').select('id,owner_id,hotflash_id,nickname');
    q=ref.startsWith('HF-')?q.eq('hotflash_id',ref):q.eq('id',ref);
    const{data,error}=await q.maybeSingle();
    if(error||!data||data.owner_id!==session.user.id)return false;
    vehicle=data;
    const result=await hotflashSupabase.from('vehicle_images').select('id,image_url,storage_path,sort_order,created_at').eq('vehicle_id',vehicle.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
    if(result.error)return false;
    images=result.data||[];
    return true;
  }
  function attachButtons(){
    if(!vehicle||!images.length)return;
    [...thumbs.querySelectorAll('button[data-thumb-index]')].forEach((thumb,index)=>{
      if(thumb.querySelector('[data-delete-vehicle-photo]'))return;
      const image=images[index];if(!image)return;
      thumb.classList.add('owner-photo-thumb');
      const remove=document.createElement('span');
      remove.className='vehicle-photo-delete';remove.dataset.deleteVehiclePhoto=image.id;remove.setAttribute('role','button');remove.setAttribute('tabindex','0');remove.setAttribute('aria-label',`Delete photo ${index+1}`);remove.title='Delete photo';remove.textContent='×';
      const activate=event=>{event.preventDefault();event.stopPropagation();deletePhoto(image,remove)};
      remove.addEventListener('click',activate);remove.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){activate(event)}});
      thumb.appendChild(remove);
    });
  }
  async function deletePhoto(image,button){
    if(busy||button.getAttribute('aria-disabled')==='true')return;
    if(!confirm('Remove this photo from the vehicle page?'))return;
    const typed=prompt('Type DELETE to permanently remove this photo.');
    if(typed!=='DELETE')return;
    busy=true;button.setAttribute('aria-disabled','true');setStatus('Deleting photo…');
    try{
      session=await stableSession();
      if(!session)throw new Error('Your session expired. Please sign in again.');
      const{data,error}=await hotflashSupabase.rpc('delete_vehicle_image_secure',{p_image_id:image.id});
      if(error)throw error;
      const deleted=Array.isArray(data)?data[0]:data;
      if(deleted?.storage_path){
        const{error:storageError}=await hotflashSupabase.storage.from('vehicle-images').remove([deleted.storage_path]);
        if(storageError)console.warn('[Vehicle photo storage cleanup]',storageError);
      }
      setStatus('Photo deleted. Refreshing gallery…');
      setTimeout(()=>location.reload(),350);
    }catch(error){
      button.setAttribute('aria-disabled','false');
      setStatus(error.message||'The photo could not be deleted. Please try again.',true);
    }finally{busy=false}
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    if(!await loadContext())return;
    const observer=new MutationObserver(attachButtons);observer.observe(thumbs,{childList:true,subtree:true});attachButtons();
  });
})();
