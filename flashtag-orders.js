document.addEventListener('DOMContentLoaded',async()=>{
  const button=document.querySelector('[data-flashtag-order]');
  const dialog=document.querySelector('[data-flashtag-order-dialog]');
  const form=document.querySelector('[data-flashtag-order-form]');
  const status=document.querySelector('[data-flashtag-order-status]');
  const history=document.querySelector('[data-flashtag-order-history]');
  if(!button||!dialog||!form)return;

  const params=new URLSearchParams(location.search);
  const ref=params.get('hf')||params.get('id');
  if(!ref)return;

  let query=hotflashSupabase.from('vehicles').select('id,owner_id,hotflash_id,nickname,year,make,model');
  query=ref.startsWith('HF-')?query.eq('hotflash_id',ref):query.eq('id',ref);
  const {data:vehicle,error:vehicleError}=await query.maybeSingle();
  if(vehicleError||!vehicle)return;

  const session=window.hotFlashGetStableSession?await window.hotFlashGetStableSession():(await hotflashSupabase.auth.getSession()).data.session;
  const isOwner=session?.user?.id===vehicle.owner_id;
  button.hidden=!isOwner;
  if(!isOwner)return;

  const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const setStatus=(message,isError=false)=>{if(!status)return;status.textContent=message;status.className=isError?'small-muted error':'small-muted'};

  const vehicleLabel=[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(' ');
  form.querySelector('[name="vehicle_display"]').value=`${vehicle.hotflash_id||''} — ${vehicle.nickname||vehicleLabel||'Vehicle'}`;
  form.querySelector('[name="email"]').value=session.user.email||'';
  form.querySelector('[name="badge_type"]').value=/^HF-\d{6}$/.test(vehicle.hotflash_id||'')&&Number((vehicle.hotflash_id||'').slice(3))<=100?'founder':'standard';

  async function loadHistory(){
    const {data,error}=await hotflashSupabase.from('flashtag_orders').select('id,status,badge_type,badge_size,quantity,created_at').eq('vehicle_id',vehicle.id).order('created_at',{ascending:false}).limit(5);
    if(error){history.innerHTML='';return}
    history.innerHTML=data?.length?`<h3>Recent orders</h3>${data.map(order=>`<article class="flashtag-order-history-item"><strong>${escapeHtml(order.quantity)} × ${escapeHtml(order.badge_size)}</strong><span>${escapeHtml(order.badge_type)} badge · ${new Date(order.created_at).toLocaleDateString()}</span><b>${escapeHtml(order.status.replaceAll('_',' '))}</b></article>`).join('')}`:'<p class="small-muted">No physical badge orders have been submitted for this vehicle yet.</p>';
  }

  button.addEventListener('click',async()=>{
    setStatus('');
    await loadHistory();
    dialog.showModal();
  });

  dialog.querySelector('[data-flashtag-order-close]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=form.querySelector('button[type="submit"]');
    const data=new FormData(form);
    submit.disabled=true;
    setStatus('Submitting your FlashTag order request…');
    const payload={
      user_id:session.user.id,
      vehicle_id:vehicle.id,
      hotflash_id:vehicle.hotflash_id||null,
      vehicle_name:vehicle.nickname||vehicleLabel||null,
      customer_name:String(data.get('customer_name')||'').trim(),
      email:String(data.get('email')||'').trim(),
      phone:String(data.get('phone')||'').trim()||null,
      address_line1:String(data.get('address_line1')||'').trim(),
      address_line2:String(data.get('address_line2')||'').trim()||null,
      city:String(data.get('city')||'').trim(),
      state:String(data.get('state')||'').trim(),
      postal_code:String(data.get('postal_code')||'').trim(),
      country:String(data.get('country')||'United States').trim(),
      badge_type:String(data.get('badge_type')||'standard'),
      badge_size:String(data.get('badge_size')||'4-inch'),
      quantity:Number(data.get('quantity')||1),
      notes:String(data.get('notes')||'').trim()||null
    };
    const {error}=await hotflashSupabase.from('flashtag_orders').insert(payload);
    if(error){console.error('[FlashTag order]',error);setStatus(error.message||'Could not submit the order request.',true);submit.disabled=false;return}
    setStatus('Order request submitted. Hot Flash will contact you with pricing and payment details.');
    form.querySelector('[name="notes"]').value='';
    await loadHistory();
    submit.disabled=false;
  });
});