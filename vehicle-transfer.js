document.addEventListener('DOMContentLoaded',async()=>{
  const panel=document.querySelector('[data-vehicle-transfer]');
  if(!panel||typeof hotflashSupabase==='undefined')return;
  const status=panel.querySelector('[data-transfer-status]');
  const form=panel.querySelector('[data-transfer-form]');
  const incoming=panel.querySelector('[data-transfer-incoming]');
  const outgoing=panel.querySelector('[data-transfer-outgoing]');
  const params=new URLSearchParams(location.search);
  const ref=params.get('id')||params.get('hf');
  const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const setStatus=(message,error=false)=>{status.textContent=message||'';status.className=error?'small-muted error':'small-muted'};
  if(!ref)return;

  const sessionResult=await hotflashSupabase.auth.getSession();
  const session=sessionResult.data?.session;
  if(!session)return;

  let query=hotflashSupabase.from('vehicles').select('id,owner_id,hotflash_id,nickname,year,make,model');
  query=ref.startsWith('HF-')?query.eq('hotflash_id',ref):query.eq('id',ref);
  const {data:vehicle,error:vehicleError}=await query.maybeSingle();
  if(vehicleError||!vehicle)return;

  const isOwner=vehicle.owner_id===session.user.id;
  const {data:requests,error:requestError}=await hotflashSupabase
    .from('vehicle_transfers')
    .select('id,vehicle_id,from_user_id,to_user_id,transfer_mode,status,message,requested_at')
    .eq('vehicle_id',vehicle.id)
    .eq('status','pending')
    .order('requested_at',{ascending:false});

  if(requestError)console.warn('[Vehicle transfer]',requestError);
  const pending=requests||[];
  const received=pending.filter(item=>item.to_user_id===session.user.id);
  const sent=pending.filter(item=>item.from_user_id===session.user.id);
  panel.hidden=!(isOwner||received.length||sent.length);
  if(panel.hidden)return;

  form.hidden=!isOwner;
  if(isOwner)panel.querySelector('[data-transfer-vehicle-name]').textContent=vehicle.nickname||[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(' ')||vehicle.hotflash_id;

  outgoing.innerHTML=sent.length?sent.map(item=>`<article class="transfer-request"><strong>Transfer pending</strong><span>${esc(item.transfer_mode.replaceAll('_',' '))}</span><button type="button" class="secondary-button" data-cancel-transfer="${esc(item.id)}">Cancel request</button></article>`).join(''):'';
  incoming.innerHTML=received.length?received.map(item=>`<article class="transfer-request transfer-request-incoming"><strong>Ownership transfer offered</strong><span>The current owner is offering you this vehicle.</span><small>${esc(item.transfer_mode.replaceAll('_',' '))}</small>${item.message?`<p>${esc(item.message)}</p>`:''}<div class="inline-actions"><button type="button" data-accept-transfer="${esc(item.id)}">Accept transfer</button><button type="button" class="secondary-button" data-decline-transfer="${esc(item.id)}">Decline</button></div></article>`).join(''):'';

  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=form.querySelector('button[type="submit"]');
    const data=new FormData(form);
    const username=String(data.get('recipient_username')||'').trim().replace(/^@/,'');
    if(!username){setStatus('Enter the recipient’s Hot Flash username.',true);return}
    submit.disabled=true;
    setStatus('Sending transfer request…');
    const {error}=await hotflashSupabase.rpc('request_vehicle_transfer',{
      p_vehicle_id:vehicle.id,
      p_recipient_username:username,
      p_transfer_mode:String(data.get('transfer_mode')||'preserve_private'),
      p_message:String(data.get('message')||'').trim()||null
    });
    submit.disabled=false;
    if(error){setStatus(error.message||'Could not send the transfer request.',true);return}
    setStatus('Transfer request sent. The vehicle stays in your garage until the recipient accepts.');
    setTimeout(()=>location.reload(),900);
  });

  panel.addEventListener('click',async event=>{
    const accept=event.target.closest('[data-accept-transfer]');
    const decline=event.target.closest('[data-decline-transfer]');
    const cancel=event.target.closest('[data-cancel-transfer]');
    if(!accept&&!decline&&!cancel)return;
    const button=accept||decline||cancel;
    button.disabled=true;
    setStatus(accept?'Transferring the vehicle…':decline?'Declining transfer…':'Cancelling request…');
    const result=cancel
      ?await hotflashSupabase.rpc('cancel_vehicle_transfer',{p_transfer_id:cancel.dataset.cancelTransfer})
      :await hotflashSupabase.rpc('respond_to_vehicle_transfer',{p_transfer_id:(accept||decline).dataset[accept?'acceptTransfer':'declineTransfer'],p_accept:Boolean(accept)});
    if(result.error){button.disabled=false;setStatus(result.error.message||'Could not update the transfer.',true);return}
    setStatus(accept?'Transfer complete. The permanent FlashTag and vehicle history stayed with the vehicle.':'Transfer request updated.');
    setTimeout(()=>location.reload(),1000);
  });
});