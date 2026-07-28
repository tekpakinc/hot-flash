document.addEventListener('DOMContentLoaded',async()=>{
  if(document.body?.dataset?.page!=='vehicle')return;
  const ownerActions=document.querySelector('[data-flashtag-owner-actions]');
  if(!ownerActions)return;

  const button=document.createElement('button');
  button.type='button';
  button.className='flashtag-order-button';
  button.dataset.flashtagOrder='';
  button.hidden=true;
  button.textContent='Order Physical Flash Badge';
  ownerActions.appendChild(button);

  const dialog=document.createElement('dialog');
  dialog.className='flashtag-order-dialog';
  dialog.dataset.flashtagOrderDialog='';
  dialog.innerHTML=`<div class="flashtag-order-shell"><div class="flashtag-order-head"><div><p class="eyebrow">Physical FlashTag</p><h2>Order your vehicle badge</h2><p class="small-muted">Submit the shipping details now. Hot Flash will contact you with final pricing and payment instructions before production.</p></div><button type="button" class="flashtag-order-close" data-flashtag-order-close aria-label="Close">×</button></div><form class="flashtag-order-form" data-flashtag-order-form><label>Vehicle<input name="vehicle_display" readonly></label><div class="flashtag-order-grid"><label>Full name<input name="customer_name" maxlength="120" autocomplete="name" required></label><label>Email<input name="email" type="email" maxlength="200" autocomplete="email" required></label><label>Phone <span class="small-muted">Optional</span><input name="phone" type="tel" maxlength="40" autocomplete="tel"></label><label>Quantity<input name="quantity" type="number" min="1" max="20" value="1" required></label><label>Badge style<select name="badge_type"><option value="standard">Standard FlashTag</option><option value="founder">Founder Special Edition</option></select></label><label>Badge size<select name="badge_size"><option value="4-inch">4-inch</option><option value="6-inch">6-inch</option><option value="custom">Custom size — describe below</option></select></label></div><label>Street address<input name="address_line1" maxlength="180" autocomplete="address-line1" required></label><label>Apartment, suite, etc. <span class="small-muted">Optional</span><input name="address_line2" maxlength="180" autocomplete="address-line2"></label><div class="flashtag-order-grid"><label>City<input name="city" maxlength="100" autocomplete="address-level2" required></label><label>State<input name="state" maxlength="100" autocomplete="address-level1" required></label><label>ZIP / postal code<input name="postal_code" maxlength="30" autocomplete="postal-code" required></label><label>Country<input name="country" maxlength="100" autocomplete="country-name" value="United States" required></label></div><label>Order notes <span class="small-muted">Optional</span><textarea name="notes" maxlength="1000" placeholder="Placement, custom sizing, finish, or anything else we should know."></textarea></label><button type="submit" class="primary">Submit Order Request</button><p class="small-muted" data-flashtag-order-status></p></form><div class="flashtag-order-history" data-flashtag-order-history></div></div>`;
  document.body.appendChild(dialog);

  const form=dialog.querySelector('[data-flashtag-order-form]');
  const status=dialog.querySelector('[data-flashtag-order-status]');
  const history=dialog.querySelector('[data-flashtag-order-history]');
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
  const setStatus=(message,isError=false)=>{status.textContent=message;status.className=isError?'small-muted error':'small-muted'};
  const vehicleLabel=[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(' ');
  form.querySelector('[name="vehicle_display"]').value=`${vehicle.hotflash_id||''} — ${vehicle.nickname||vehicleLabel||'Vehicle'}`;
  form.querySelector('[name="email"]').value=session.user.email||'';
  const founder=/^HF-(\d{6})$/.exec(vehicle.hotflash_id||'');
  form.querySelector('[name="badge_type"]').value=founder&&Number(founder[1])<=100?'founder':'standard';

  async function loadHistory(){
    const {data,error}=await hotflashSupabase.from('flashtag_orders').select('id,status,badge_type,badge_size,quantity,created_at').eq('vehicle_id',vehicle.id).order('created_at',{ascending:false}).limit(5);
    if(error){history.innerHTML='';return}
    history.innerHTML=data?.length?`<h3>Recent orders</h3>${data.map(order=>`<article class="flashtag-order-history-item"><strong>${escapeHtml(order.quantity)} × ${escapeHtml(order.badge_size)}</strong><span>${escapeHtml(order.badge_type)} badge · ${new Date(order.created_at).toLocaleDateString()}</span><b>${escapeHtml(order.status.replaceAll('_',' '))}</b></article>`).join('')}`:'<p class="small-muted">No physical badge orders have been submitted for this vehicle yet.</p>';
  }

  button.addEventListener('click',async()=>{setStatus('');await loadHistory();dialog.showModal()});
  dialog.querySelector('[data-flashtag-order-close]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=form.querySelector('button[type="submit"]');
    const data=new FormData(form);
    submit.disabled=true;
    setStatus('Submitting your FlashTag order request…');
    const payload={user_id:session.user.id,vehicle_id:vehicle.id,hotflash_id:vehicle.hotflash_id||null,vehicle_name:vehicle.nickname||vehicleLabel||null,customer_name:String(data.get('customer_name')||'').trim(),email:String(data.get('email')||'').trim(),phone:String(data.get('phone')||'').trim()||null,address_line1:String(data.get('address_line1')||'').trim(),address_line2:String(data.get('address_line2')||'').trim()||null,city:String(data.get('city')||'').trim(),state:String(data.get('state')||'').trim(),postal_code:String(data.get('postal_code')||'').trim(),country:String(data.get('country')||'United States').trim(),badge_type:String(data.get('badge_type')||'standard'),badge_size:String(data.get('badge_size')||'4-inch'),quantity:Number(data.get('quantity')||1),notes:String(data.get('notes')||'').trim()||null};
    const {error}=await hotflashSupabase.from('flashtag_orders').insert(payload);
    if(error){console.error('[FlashTag order]',error);setStatus(error.message||'Could not submit the order request.',true);submit.disabled=false;return}
    setStatus('Order request submitted. Hot Flash will contact you with pricing and payment details.');
    form.querySelector('[name="notes"]').value='';
    await loadHistory();
    submit.disabled=false;
  });
});