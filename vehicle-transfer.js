document.addEventListener('DOMContentLoaded',async()=>{
  const panel=document.querySelector('[data-vehicle-transfer]');
  if(!panel||typeof hotflashSupabase==='undefined')return;
  panel.hidden=true;
  const status=panel.querySelector('[data-transfer-status]'),form=panel.querySelector('[data-transfer-form]'),outgoing=panel.querySelector('[data-transfer-outgoing]');
  const params=new URLSearchParams(location.search),ref=params.get('id')||params.get('hf');
  const setStatus=(m,e=false)=>{status.textContent=m||'';status.className=e?'small-muted error':'small-muted'};
  if(!ref)return;
  const session=window.hotFlashGetStableSession?await window.hotFlashGetStableSession():(await hotflashSupabase.auth.getSession()).data?.session;
  if(!session)return;
  let query=hotflashSupabase.from('vehicles').select('id,owner_id,hotflash_id,nickname,year,make,model');
  query=ref.startsWith('HF-')?query.eq('hotflash_id',ref):query.eq('id',ref);
  const {data:vehicle}=await query.maybeSingle();
  if(!vehicle||vehicle.owner_id!==session.user.id)return;
  panel.hidden=false;form.hidden=false;
  panel.querySelector('[data-transfer-vehicle-name]').textContent=vehicle.nickname||[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(' ')||vehicle.hotflash_id;
  const renderLink=(token,expires)=>{const url=new URL('claim-vehicle.html',location.href);url.searchParams.set('token',token);outgoing.innerHTML='<article class="transfer-request"><strong>Claim link ready</strong><input data-claim-link readonly><div class="inline-actions"><button type="button" class="secondary-button" data-copy-claim>Copy link</button><button type="button" class="secondary-button" data-share-claim>Share link</button></div><span class="small-muted">Active until '+new Date(expires).toLocaleString()+' or until you revoke it.</span></article>';outgoing.querySelector('[data-claim-link]').value=url.href;outgoing.querySelector('[data-copy-claim]').onclick=async()=>{await navigator.clipboard.writeText(url.href);setStatus('Claim link copied. Send it to the new owner.')};outgoing.querySelector('[data-share-claim]').onclick=async()=>{if(navigator.share)await navigator.share({title:'Claim your Hot Flash vehicle',text:'I transferred this vehicle to you on Hot Flash. Claim it here:',url:url.href});else{await navigator.clipboard.writeText(url.href);setStatus('Claim link copied.')}}};
  form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;setStatus('Creating secure claim link…');const data=new FormData(form);const {data:created,error}=await hotflashSupabase.rpc('create_vehicle_transfer_link',{p_vehicle_id:vehicle.id,p_transfer_mode:String(data.get('transfer_mode')||'preserve_private'),p_message:String(data.get('message')||'').trim()||null});submit.disabled=false;if(error){setStatus(error.message||'Could not create the claim link.',true);return}const row=Array.isArray(created)?created[0]:created;if(!row?.claim_token){setStatus('Claim link was created but could not be displayed.',true);return}renderLink(row.claim_token,row.expires_at);setStatus('The vehicle stays yours until the buyer claims this link.')});
});