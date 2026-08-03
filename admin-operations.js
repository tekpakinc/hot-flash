(()=>{
 const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 const fmt=v=>v?new Date(v).toLocaleString():'—';
 const metrics=document.querySelector('[data-admin-metrics]');
 const userForm=document.querySelector('[data-admin-user-search]');
 const userList=document.querySelector('[data-admin-user-list]');
 const catalogForm=document.querySelector('[data-catalog-form]');
 const catalogList=document.querySelector('[data-catalog-list]');
 const category=document.querySelector('[data-catalog-category]');
 const vehicleType=document.querySelector('[data-catalog-vehicle-type]');
 const catalogStatus=document.querySelector('[data-catalog-status]');
 let catalogRows=[];
 async function loadMetrics(){
  if(!metrics)return;
  metrics.innerHTML='<p class="small-muted">Loading dashboard…</p>';
  const{data,error}=await hotflashSupabase.rpc('admin_dashboard_metrics');
  if(error){metrics.innerHTML='<p class="error">Dashboard metrics need the latest Admin Console SQL.</p>';return;}
  const cards=[['Users',data.users],['Vehicles',data.vehicles],['Shops',data.shops],['Hoon clips',data.hoon_posts],['Events',data.events],['Verified',data.verified_members],['Open orders',data.open_orders],['New users today',data.new_users_today],['New vehicles today',data.new_vehicles_today],['New orders today',data.new_orders_today]];
  metrics.innerHTML=cards.map(([label,value])=>`<article class="admin-metric"><strong>${Number(value||0).toLocaleString()}</strong><span>${esc(label)}</span></article>`).join('');
 }
 async function loadUsers(query=''){
  if(!userList)return;
  userList.innerHTML='<p class="small-muted">Loading members…</p>';
  const{data,error}=await hotflashSupabase.rpc('admin_search_users',{p_query:query||null,p_limit:50});
  if(error){userList.innerHTML='<p class="error">User Management needs the latest Admin Console SQL.</p>';return;}
  if(!data?.length){userList.innerHTML='<p class="small-muted">No matching members.</p>';return;}
  userList.innerHTML=data.map(u=>`<article class="admin-user-card" data-user-id="${u.user_id}"><div class="admin-user-head"><div>${u.avatar_url?`<img src="${esc(u.avatar_url)}" alt="">`:'<span class="admin-user-avatar">HF</span>'}<div><h3>${esc(u.display_name||u.username||u.email||'Member')}</h3><p class="small-muted">${u.username?'@'+esc(u.username)+' · ':''}${esc(u.email||'No email shown')}</p></div></div><span class="admin-status-pill status-${esc(u.account_status)}">${esc(u.account_status)}</span></div><div class="admin-user-facts"><span>${u.vehicle_count||0} vehicles</span><span>${u.shop_count||0} shops</span><span>Joined ${esc(fmt(u.created_at))}</span><span>Last sign-in ${esc(fmt(u.last_sign_in_at))}</span></div><div class="admin-user-actions"><a class="secondary-button" href="member.html?u=${encodeURIComponent(u.username||'')}" target="_blank" rel="noopener">Open profile</a><select data-user-status><option value="active" ${u.account_status==='active'?'selected':''}>Active</option><option value="restricted" ${u.account_status==='restricted'?'selected':''}>Restricted</option><option value="suspended" ${u.account_status==='suspended'?'selected':''}>Suspended</option></select><input data-user-reason value="${esc(u.status_reason||'')}" placeholder="Reason / internal note"><button type="button" data-save-user-status>Save status</button></div></article>`).join('');
  userList.querySelectorAll('[data-save-user-status]').forEach(button=>button.onclick=async()=>{const card=button.closest('[data-user-id]');button.disabled=true;button.textContent='Saving…';const{error}=await hotflashSupabase.rpc('admin_set_user_status',{p_user_id:card.dataset.userId,p_status:card.querySelector('[data-user-status]').value,p_reason:card.querySelector('[data-user-reason]').value||null});if(error){alert(error.message||'Status could not be saved.');button.disabled=false;button.textContent='Save status';return;}await loadUsers(String(new FormData(userForm).get('query')||''));});
 }
 async function loadCatalog(){
  if(!catalogList)return;
  catalogList.innerHTML='<p class="small-muted">Loading dropdown options…</p>';
  const{data,error}=await hotflashSupabase.rpc('admin_list_catalog_options',{p_category:category?.value||null,p_vehicle_type:vehicleType?.value||null});
  if(error){catalogList.innerHTML='<p class="error">Dropdown Manager needs the latest Admin Console SQL.</p>';return;}
  catalogRows=data||[];
  catalogList.innerHTML=catalogRows.length?catalogRows.map(row=>`<article class="catalog-row" data-catalog-id="${row.id}"><div><strong>${esc(row.label)}</strong><span>${esc(row.category.replaceAll('_',' '))}${row.parent_label?' · '+esc(row.parent_label):''} · ${esc(row.vehicle_type)}</span></div><span class="admin-status-pill ${row.active?'status-active':'status-cancelled'}">${row.active?'Active':'Hidden'}</span><button type="button" class="secondary-button" data-edit-catalog>Edit</button><button type="button" class="danger" data-delete-catalog>Delete</button></article>`).join(''):'<p class="small-muted">No custom options in this category yet. The built-in/NHTSA catalog remains available.</p>';
  catalogList.querySelectorAll('[data-edit-catalog]').forEach(button=>button.onclick=()=>{const row=catalogRows.find(x=>x.id===button.closest('[data-catalog-id]').dataset.catalogId);if(!row)return;catalogForm.elements.id.value=row.id;catalogForm.elements.category.value=row.category;catalogForm.elements.label.value=row.label;catalogForm.elements.parent_label.value=row.parent_label||'';catalogForm.elements.vehicle_type.value=row.vehicle_type;catalogForm.elements.sort_order.value=row.sort_order||0;catalogForm.elements.active.checked=row.active;catalogForm.scrollIntoView({behavior:'smooth',block:'center'});});
  catalogList.querySelectorAll('[data-delete-catalog]').forEach(button=>button.onclick=async()=>{if(!confirm('Delete this dropdown option?'))return;button.disabled=true;const{error}=await hotflashSupabase.rpc('admin_delete_catalog_option',{p_id:button.closest('[data-catalog-id]').dataset.catalogId});if(error){alert(error.message||'Option could not be deleted.');button.disabled=false;return;}await loadCatalog();});
 }
 userForm?.addEventListener('submit',e=>{e.preventDefault();loadUsers(String(new FormData(userForm).get('query')||'').trim());});
 catalogForm?.addEventListener('submit',async e=>{e.preventDefault();const button=catalogForm.querySelector('button[type="submit"]'),fd=new FormData(catalogForm);button.disabled=true;button.textContent='Saving…';catalogStatus.textContent='Saving option…';const{error}=await hotflashSupabase.rpc('admin_upsert_catalog_option',{p_id:fd.get('id')||null,p_category:fd.get('category'),p_label:fd.get('label'),p_parent_label:fd.get('parent_label')||null,p_vehicle_type:fd.get('vehicle_type'),p_sort_order:Number(fd.get('sort_order')||0),p_active:fd.get('active')==='on'});if(error){catalogStatus.textContent=error.message||'Option could not be saved.';}else{catalogForm.reset();catalogForm.elements.active.checked=true;catalogStatus.textContent='Dropdown option saved.';await loadCatalog();}button.disabled=false;button.textContent='Save option';});
 category?.addEventListener('change',loadCatalog);vehicleType?.addEventListener('change',loadCatalog);
 document.querySelector('[data-reset-catalog-form]')?.addEventListener('click',()=>{catalogForm.reset();catalogForm.elements.id.value='';catalogForm.elements.active.checked=true;});
 document.querySelector('[data-admin-tab="overview"]')?.addEventListener('click',loadMetrics);
 document.querySelector('[data-admin-tab="users"]')?.addEventListener('click',()=>loadUsers());
 document.querySelector('[data-admin-tab="catalog"]')?.addEventListener('click',loadCatalog);
 document.addEventListener('DOMContentLoaded',()=>setTimeout(loadMetrics,300));
})();