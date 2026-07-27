(()=>{
  if(window.__hotFlashDashboardThemes)return;
  window.__hotFlashDashboardThemes=true;

  const themes=[
    {id:'race',label:'Race Dash',icon:'🏁',description:'Carbon fiber, sharp telemetry panels, lime shift-light glow.'},
    {id:'muscle',label:'Muscle',icon:'🔥',description:'Brushed steel, squared gauges, warm analog performance styling.'},
    {id:'jdm',label:'JDM Neon',icon:'🌃',description:'Tokyo-night neon, glass panels, cyan and magenta illumination.'},
    {id:'retro',label:'Retro Digital',icon:'📟',description:'Amber CRT displays, scan lines, pixel-style instrument graphics.'},
    {id:'luxury',label:'Luxury',icon:'✦',description:'Dark leather, champagne metal, restrained executive cockpit.'}
  ];

  const dashboardKey='hotflash-dashboard-theme';

  const getTheme=name=>themes.find(theme=>theme.id===name)||themes[0];

  const apply=name=>{
    const selected=getTheme(name);
    themes.forEach(({id})=>document.body.classList.remove(`hf-theme-${id}`));
    document.body.classList.add(`hf-theme-${selected.id}`);
    document.body.dataset.hfTheme=selected.id;

    document.querySelectorAll('[data-hf-theme]').forEach(button=>{
      const active=button.dataset.hfTheme===selected.id;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });

    const description=document.querySelector('[data-hf-theme-description]');
    if(description)description.textContent=selected.description;
    window.dispatchEvent(new CustomEvent('hotflash:themechange',{detail:selected}));
    return selected;
  };

  const buildPanel=label=>{
    const panel=document.createElement('section');
    panel.className='hf-dashboard-customizer';
    panel.setAttribute('aria-label',label);
    panel.innerHTML=`
      <div class="hf-theme-heading">
        <div>
          <span class="hf-theme-kicker">Display profile</span>
          <strong>${label}</strong>
        </div>
        <span class="hf-theme-status"><i></i> LIVE</span>
      </div>
      <div class="hf-theme-options">
        ${themes.map(theme=>`<button type="button" data-hf-theme="${theme.id}" aria-pressed="false"><span>${theme.icon}</span><b>${theme.label}</b></button>`).join('')}
      </div>
      <p class="hf-theme-description" data-hf-theme-description></p>
      <p class="small-muted" data-hf-theme-save-status></p>`;
    return panel;
  };

  async function installVehicleTheme(){
    const params=new URLSearchParams(location.search);
    const ref=params.get('hf')||params.get('id');
    if(!ref||!window.hotflashSupabase)return;

    let query=hotflashSupabase.from('vehicles').select('id,owner_id,ui_theme');
    query=ref.startsWith('HF-')?query.eq('hotflash_id',ref):query.eq('id',ref);
    const [{data:vehicle,error:vehicleError},{data:sessionData}]=await Promise.all([
      query.maybeSingle(),
      hotflashSupabase.auth.getSession()
    ]);

    if(vehicleError||!vehicle){
      console.warn('[Hot Flash vehicle theme]',vehicleError);
      apply('race');
      return;
    }

    const current=getTheme(vehicle.ui_theme||'race').id;
    apply(current);

    const session=sessionData?.session||null;
    const isOwner=session?.user?.id===vehicle.owner_id;
    if(!isOwner)return;

    const panel=buildPanel('Vehicle UI theme');
    const shell=document.querySelector('.vehicle-profile-shell');
    if(!shell)return;
    shell.prepend(panel);
    apply(current);

    const status=panel.querySelector('[data-hf-theme-save-status]');
    panel.addEventListener('click',async event=>{
      const button=event.target.closest('[data-hf-theme]');
      if(!button||button.disabled)return;

      const next=getTheme(button.dataset.hfTheme).id;
      const previous=document.body.dataset.hfTheme||current;
      apply(next);
      panel.querySelectorAll('[data-hf-theme]').forEach(item=>item.disabled=true);
      if(status)status.textContent='Saving this vehicle’s theme…';

      const {error}=await hotflashSupabase
        .from('vehicles')
        .update({ui_theme:next})
        .eq('id',vehicle.id)
        .eq('owner_id',session.user.id);

      panel.querySelectorAll('[data-hf-theme]').forEach(item=>item.disabled=false);
      if(error){
        console.error('[Hot Flash vehicle theme save]',error);
        apply(previous);
        if(status)status.textContent='Theme could not be saved. Install the vehicle theme database migration and try again.';
        return;
      }

      vehicle.ui_theme=next;
      if(status)status.textContent='Saved for this vehicle.';
    });
  }

  function installDashboardTheme(){
    let current='race';
    try{current=localStorage.getItem(dashboardKey)||'race'}catch(_){}
    current=getTheme(current).id;

    const panel=buildPanel('Driver Console theme');
    const shell=document.querySelector('.app-shell');
    if(shell)shell.prepend(panel);

    panel.addEventListener('click',event=>{
      const button=event.target.closest('[data-hf-theme]');
      if(!button)return;
      const selected=apply(button.dataset.hfTheme);
      try{localStorage.setItem(dashboardKey,selected.id)}catch(_){}
      const status=panel.querySelector('[data-hf-theme-save-status]');
      if(status)status.textContent='Saved on this device.';
    });

    apply(current);
  }

  async function install(){
    const page=document.body?.dataset?.page;
    if(page==='vehicle')await installVehicleTheme();
    if(page==='dashboard')installDashboardTheme();
  }

  document.readyState==='loading'
    ?document.addEventListener('DOMContentLoaded',()=>install().catch(error=>console.error('[Hot Flash themes]',error)))
    :install().catch(error=>console.error('[Hot Flash themes]',error));
})();
