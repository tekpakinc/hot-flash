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
  dialog.innerHTML=`<div class="flashtag-order-shell"><div class="flashtag-order-head"><div><p class="eyebrow">Physical FlashTag</p><h2>Order your vehicle badge</h2><p class="small-muted">Submit the shipping details now. Hot Flash will contact you with final pricing and payment instructions before production.</p></div><button type="button" class="flashtag-order-close" data-flashtag-order-close aria-label="Close">×</button></div><form class="flashtag-order-form" data-flashtag-order-form><label>Vehicle<input name="vehicle_display" readonly></label><div class="flashtag-order-grid"><label>Full name<input name="customer_name" maxlength="120" autocomplete="name" required></label><label>Email<input name="email" type="email" maxlength="200" autocomplete="email" required></label><label>Phone <span class="small-muted">Optional</span><input name="phone" type="tel" maxlength="40" autocomplete="tel"></label><label>Quantity<input name="quantity" type="number" min="1" max="20" value="1" required></label><label>Badge style<select name="badge_type"><option value="standard">Standard FlashTag</option><option value="founder" data-founder-option>Founder Special Edition</option></select></label><label>Badge size<select name="badge_size"><option value="4-inch">4-inch</option><option value="6-inch">6-inch</option><option value="custom">Custom size — describe below</option></select></label></div><label>Street address<input name="address_line1" maxlength="180" autocomplete="address-line1" required></label><label>Apartment, suite, etc. <span class="small-muted">Optional</span><input name="address_line2" maxlength="180" autocomplete="address-line2"></label><div class="flashtag-order-grid"><label>City<input name="city" maxlength="100" autocomplete="address-level2" required></label><label>State<input name="state" maxlength="100" autocomplete="address-level1" required></label><label>ZIP / postal code<input name="postal_code" maxlength="30" autocomplete="postal-code" required></label><label>Country<input name="country" maxlength="100" autocomplete="country-name" value="United States" required></label></div><label>Order notes <span class="small-muted">Optional</span><textarea name="notes" maxlength="1000" placeholder="Placement, custom sizing, finish, or anything else we should know."></textarea></label><button type="submit" class="primary">Submit Order Request</button><p class="small-muted" role="status" aria-live="polite" data-flashtag-order-status></p></form><div class="flashtag-order-history" data-flashtag-order-history></div></div>`;
  document.body.appendChild(dialog);

  const form=dialog.querySelector('[data-flashtag-order-form]');
  const status=dialog.querySelector('[data-flashtag-order-status]');
  const history=dialog.querySelector('[data-flashtag-order-history]');
  const params=new URLSearchParams(location.search);
  const ref=params.get('hf')||params.get('id');
  if(!ref){dialog.remove();button.remove();return}

  let query=hotflashSupabase.from('vehicles').select('id,owner_id,hotflash_id,nickname,year,make,model');
  query=ref.startsWith('HF-')?query.eq('hotflash_id',ref):query.eq('id',ref);
  const {data:vehicle,error:vehicleError}=await query.maybeSingle();
  if(vehicleError||!vehicle){dialog.remove();button.remove();return}

  const session=window.hotFlashGetStableSession?await window.hotFlashGetStableSession():(await hotflashSupabase.auth.getSession()).data.session;
  const isOwner=session?.user?.id===vehicle.owner_id;
  button.hidden=!isOwner;
  if(!isOwner){dialog.remove();return}

  const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const setStatus=(message,isError=false)=>{status.textContent=message;status.className=isError?'small-muted error':'small-muted'};
  const vehicleLabel=[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(' ');
  const founderMatch=/^HF-(\d{6})$/.exec(vehicle.hotflash_id||'');
  const founderEligible=Boolean(founderMatch&&Number(founderMatch[1])>=1&&Number(founderMatch[1])<=100);
  if(!founderEligible)form.querySelector('[data-founder-option]')?.remove();
  form.querySelector('[name="vehicle_display"]').value=`${vehicle.hotflash_id||''} — ${vehicle.nickname||vehicleLabel||'Vehicle'}`;
  form.querySelector('[name="email"]').value=session.user.email||'';
  form.querySelector('[name="badge_type"]').value=founderEligible?'founder':'standard';

  const artifactUrl=path=>path?hotflashSupabase.storage.from('flashtag-artifacts').getPublicUrl(path).data.publicUrl:null;

  async function loadHistory(){
    const {data,error}=await hotflashSupabase.from('flashtag_orders').select('id,status,badge_type,badge_size,quantity,created_at,artifact_svg_path,artifact_png_path,artifact_error').eq('vehicle_id',vehicle.id).order('created_at',{ascending:false}).limit(5);
    if(error){history.innerHTML='<p class="small-muted">Order history is temporarily unavailable.</p>';return}
    history.innerHTML=data?.length?`<h3>Recent orders</h3>${data.map(order=>{const svg=artifactUrl(order.artifact_svg_path);const png=artifactUrl(order.artifact_png_path);const files=[svg?`<a class="secondary-button" href="${escapeHtml(svg)}" download>Download SVG</a>`:'',png?`<a class="secondary-button" href="${escapeHtml(png)}" download>Download PNG</a>`:''].join('');return `<article class="flashtag-order-history-item"><strong>${escapeHtml(order.quantity)} × ${escapeHtml(order.badge_size)}</strong><span>${escapeHtml(order.badge_type)} badge · ${new Date(order.created_at).toLocaleDateString()}</span><b>${escapeHtml(String(order.status||'submitted').replaceAll('_',' '))}</b>${files?`<div class="inline-actions">${files}</div>`:order.artifact_error?`<small class="error">Artifact generation needs attention.</small>`:'<small class="small-muted">Preparing production files…</small>'}</article>`}).join('')}`:'<p class="small-muted">No physical badge orders have been submitted for this vehicle yet.</p>';
  }

  function loadQrLibrary(){
    if(window.QRCode)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-hotflash-qrcode]');
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      script.async=true;
      script.dataset.hotflashQrcode='';
      script.onload=resolve;
      script.onerror=()=>reject(new Error('QR code library could not load'));
      document.head.appendChild(script);
    });
  }

  async function makeQrDataUrl(value){
    await loadQrLibrary();
    const holder=document.createElement('div');
    holder.style.position='fixed';
    holder.style.left='-9999px';
    document.body.appendChild(holder);
    new QRCode(holder,{text:value,width:600,height:600,colorDark:'#050607',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
    await new Promise(resolve=>setTimeout(resolve,60));
    const canvas=holder.querySelector('canvas');
    const image=holder.querySelector('img');
    const dataUrl=canvas?.toDataURL('image/png')||image?.src;
    holder.remove();
    if(!dataUrl)throw new Error('QR code could not be generated');
    return dataUrl;
  }

  const xmlEscape=(value='')=>String(value).replace(/[<>&'\"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));

  async function buildArtifacts(snapshot){
    const profileUrl=`${location.origin}/vehicle.html?hf=${encodeURIComponent(snapshot.hotflash_id)}`;
    const qrDataUrl=await makeQrDataUrl(profileUrl);
    const displayName=snapshot.nickname||snapshot.vehicle_label||'Vehicle';
    const edition=snapshot.badge_type==='founder'?'FOUNDER EDITION':'OFFICIAL FLASHTAG';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="900" viewBox="0 0 1800 900"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#06070a"/><stop offset=".55" stop-color="#171019"/><stop offset="1" stop-color="#341006"/></linearGradient><linearGradient id="flame" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#ff2818"/><stop offset=".55" stop-color="#ff5a00"/><stop offset="1" stop-color="#ffad25"/></linearGradient></defs><rect width="1800" height="900" rx="78" fill="url(#bg)"/><rect x="24" y="24" width="1752" height="852" rx="58" fill="none" stroke="url(#flame)" stroke-width="18"/><path d="M110 180h1010" stroke="url(#flame)" stroke-width="14" stroke-linecap="round"/><text x="110" y="145" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="900">HOT FLASH</text><text x="110" y="290" fill="#ff6a00" font-family="Arial,Helvetica,sans-serif" font-size="54" font-weight="900" letter-spacing="8">${xmlEscape(edition)}</text><text x="110" y="430" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="112" font-weight="900">${xmlEscape(snapshot.hotflash_id)}</text><text x="110" y="555" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="800">${xmlEscape(displayName)}</text><text x="110" y="640" fill="#b9bec7" font-family="Arial,Helvetica,sans-serif" font-size="44">${xmlEscape(snapshot.vehicle_label)}</text><text x="110" y="770" fill="#ff6a00" font-family="Arial,Helvetica,sans-serif" font-size="38" font-weight="800">SCAN TO VIEW THIS BUILD</text><image href="${qrDataUrl}" x="1240" y="170" width="440" height="440"/><text x="1460" y="665" text-anchor="middle" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="700">hotflash.app</text><text x="1460" y="718" text-anchor="middle" fill="#aeb4bb" font-family="Arial,Helvetica,sans-serif" font-size="25">Every build has a story.</text></svg>`;
    const svgBlob=new Blob([svg],{type:'image/svg+xml'});
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=URL.createObjectURL(svgBlob)});
    const canvas=document.createElement('canvas');
    canvas.width=1800;
    canvas.height=900;
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    URL.revokeObjectURL(image.src);
    const pngBlob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG could not be generated')),'image/png',1));
    return {svgBlob,pngBlob};
  }

  async function saveArtifacts(orderId,snapshot){
    const base=`${session.user.id}/${orderId}`;
    try{
      const {svgBlob,pngBlob}=await buildArtifacts(snapshot);
      const svgPath=`${base}/flashtag-${snapshot.hotflash_id}.svg`;
      const pngPath=`${base}/flashtag-${snapshot.hotflash_id}.png`;
      const svgUpload=await hotflashSupabase.storage.from('flashtag-artifacts').upload(svgPath,svgBlob,{contentType:'image/svg+xml',upsert:true});
      if(svgUpload.error)throw svgUpload.error;
      const pngUpload=await hotflashSupabase.storage.from('flashtag-artifacts').upload(pngPath,pngBlob,{contentType:'image/png',upsert:true});
      if(pngUpload.error)throw pngUpload.error;
      const {error}=await hotflashSupabase.rpc('save_flashtag_order_artifacts',{p_order_id:orderId,p_vehicle_snapshot:snapshot,p_svg_path:svgPath,p_png_path:pngPath,p_error:null});
      if(error)throw error;
      return true;
    }catch(error){
      console.error('[FlashTag artifact]',error);
      await hotflashSupabase.rpc('save_flashtag_order_artifacts',{p_order_id:orderId,p_vehicle_snapshot:snapshot,p_svg_path:null,p_png_path:null,p_error:error?.message||'Artifact generation failed'});
      return false;
    }
  }

  button.addEventListener('click',async()=>{setStatus('');await loadHistory();dialog.showModal()});
  dialog.querySelector('[data-flashtag-order-close]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=form.querySelector('button[type="submit"]');
    if(submit.disabled)return;
    const data=new FormData(form);
    const quantity=Math.trunc(Number(data.get('quantity')||1));
    const badgeType=String(data.get('badge_type')||'standard');
    const badgeSize=String(data.get('badge_size')||'4-inch');
    const notes=String(data.get('notes')||'').trim();
    if(quantity<1||quantity>20){setStatus('Quantity must be between 1 and 20.',true);return}
    if(badgeType==='founder'&&!founderEligible){setStatus('This vehicle is not eligible for a Founder Special Edition badge.',true);return}
    if(badgeSize==='custom'&&!notes){setStatus('Please describe the requested custom size in the order notes.',true);return}
    submit.disabled=true;
    setStatus('Submitting your FlashTag order request…');
    const snapshot={vehicle_id:vehicle.id,hotflash_id:vehicle.hotflash_id||'',nickname:vehicle.nickname||'',year:vehicle.year||null,make:vehicle.make||'',model:vehicle.model||'',vehicle_label:vehicleLabel,badge_type:badgeType,badge_size:badgeSize,quantity,captured_at:new Date().toISOString(),profile_url:`${location.origin}/vehicle.html?hf=${encodeURIComponent(vehicle.hotflash_id||'')}`};
    const payload={user_id:session.user.id,vehicle_id:vehicle.id,hotflash_id:vehicle.hotflash_id||null,vehicle_name:vehicle.nickname||vehicleLabel||null,customer_name:String(data.get('customer_name')||'').trim(),email:String(data.get('email')||'').trim(),phone:String(data.get('phone')||'').trim()||null,address_line1:String(data.get('address_line1')||'').trim(),address_line2:String(data.get('address_line2')||'').trim()||null,city:String(data.get('city')||'').trim(),state:String(data.get('state')||'').trim(),postal_code:String(data.get('postal_code')||'').trim(),country:String(data.get('country')||'United States').trim(),badge_type:badgeType,badge_size:badgeSize,quantity,notes:notes||null,vehicle_snapshot:snapshot};
    const {data:created,error}=await hotflashSupabase.from('flashtag_orders').insert(payload).select('id').single();
    if(error){console.error('[FlashTag order]',error);setStatus(error.message||'Could not submit the order request.',true);submit.disabled=false;return}
    setStatus('Order submitted. Generating your production files…');
    const generated=await saveArtifacts(created.id,snapshot);
    setStatus(generated?'Order submitted and downloadable FlashTag files are ready.':'Order submitted, but the production files could not be generated automatically. The order is safe and can be retried.');
    form.querySelector('[name="notes"]').value='';
    form.querySelector('[name="quantity"]').value='1';
    await loadHistory();
    submit.disabled=false;
  });
});