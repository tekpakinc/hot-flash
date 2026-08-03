document.addEventListener('DOMContentLoaded',()=>{
  if(document.body?.dataset?.page!=='vehicle'||typeof hotflashSupabase==='undefined')return;
  const button=document.querySelector('[data-gallery-upload-button]'),input=document.querySelector('[data-gallery-upload]'),status=document.querySelector('[data-gallery-upload-status]');
  if(!button||!input||button.dataset.compatReady)return;
  button.dataset.compatReady='true';
  let busy=false;
  const setStatus=(message,error=false)=>{if(!status)return;status.textContent=message;status.className=error?'small-muted error':'small-muted'};
  const extension=file=>(String(file.name||'').split('.').pop()||'').toLowerCase();
  const imageKind=file=>String(file.type||'').toLowerCase()||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',heic:'image/heic',heif:'image/heif'}[extension(file)]||'');
  const jpegFromImage=async file=>{
    const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');
    const limit=4096,scale=Math.min(1,limit/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));
    if(!blob)throw new Error('This browser could not convert the HEIC photo. Try a screenshot or Safari.');
    return new File([blob],`${String(file.name||'photo').replace(/\.(heic|heif)$/i,'')}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
  };
  const prepare=async file=>{
    const kind=imageKind(file),ext=extension(file);
    if(file.size===0)throw new Error(`${file.name||'Photo'} is empty.`);
    if(file.size>15*1024*1024)throw new Error(`${file.name||'Photo'} is larger than 15 MB.`);
    if(kind==='image/heic'||kind==='image/heif'||ext==='heic'||ext==='heif'){
      setStatus(`Preparing ${file.name||'HEIC photo'}…`);
      return jpegFromImage(file);
    }
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(kind))throw new Error(`${file.name||'Photo'} is not a supported image.`);
    return file;
  };
  const handler=async event=>{
    const clicked=event.target.closest?.('[data-gallery-upload-button]');if(!clicked||busy)return;
    event.preventDefault();event.stopImmediatePropagation();
    const selected=[...(input.files||[])];if(!selected.length){setStatus('Choose at least one photo first.',true);return}
    busy=true;button.disabled=true;input.disabled=true;let uploaded=0,storagePath='';
    try{
      const session=window.hotFlashGetStableSession?await window.hotFlashGetStableSession():(await hotflashSupabase.auth.getSession()).data.session;
      if(!session)throw new Error('Your session expired. Please log in again.');
      const params=new URLSearchParams(location.search),ref=params.get('id')||params.get('hf');
      let query=hotflashSupabase.from('vehicles').select('id,owner_id,slug,hotflash_id');query=ref?.startsWith('HF-')?query.eq('hotflash_id',ref):query.eq('id',ref);
      const{data:vehicle,error:vehicleError}=await query.maybeSingle();if(vehicleError)throw vehicleError;if(!vehicle||vehicle.owner_id!==session.user.id)throw new Error('Only the current vehicle owner can upload photos.');
      for(let i=0;i<selected.length;i++){
        const file=await prepare(selected[i]);setStatus(`Uploading ${i+1} of ${selected.length}: ${file.name}`);
        const ext=extension(file)||'jpg',unique=crypto.randomUUID?.()||`${Date.now()}-${i}`,folder=vehicle.slug||vehicle.hotflash_id||vehicle.id;
        storagePath=`${session.user.id}/${folder}/gallery-${unique}.${ext}`;
        const{error:uploadError}=await hotflashSupabase.storage.from('vehicle-images').upload(storagePath,file,{cacheControl:'3600',upsert:false,contentType:imageKind(file)||'image/jpeg'});if(uploadError)throw uploadError;
        const url=hotflashSupabase.storage.from('vehicle-images').getPublicUrl(storagePath).data.publicUrl;
        const{error:rowError}=await hotflashSupabase.from('vehicle_images').insert({vehicle_id:vehicle.id,owner_id:session.user.id,image_url:url,storage_path:storagePath,sort_order:Date.now()+i});
        if(rowError){await hotflashSupabase.storage.from('vehicle-images').remove([storagePath]);throw rowError}uploaded++;
      }
      input.value='';setStatus(`${uploaded} photo${uploaded===1?'':'s'} uploaded. Refreshing…`);setTimeout(()=>location.reload(),500);
    }catch(error){console.error('[Vehicle photo upload]',error);setStatus(error.message||'The photos could not be uploaded.',true)}finally{busy=false;button.disabled=false;input.disabled=false}
  };
  document.addEventListener('click',handler,true);
});