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

  const key='hotflash-dashboard-theme';

  const apply=name=>{
    const selected=themes.find(theme=>theme.id===name)||themes[0];
    themes.forEach(({id})=>document.body.classList.remove(`hf-theme-${id}`));
    document.body.classList.add(`hf-theme-${selected.id}`);
    document.body.dataset.hfTheme=selected.id;
    try{localStorage.setItem(key,selected.id)}catch(_){}

    document.querySelectorAll('[data-hf-theme]').forEach(button=>{
      const active=button.dataset.hfTheme===selected.id;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });

    const description=document.querySelector('[data-hf-theme-description]');
    if(description)description.textContent=selected.description;
    window.dispatchEvent(new CustomEvent('hotflash:themechange',{detail:selected}));
  };

  function install(){
    const page=document.body?.dataset?.page;
    if(!['vehicle','dashboard'].includes(page))return;

    let current='race';
    try{current=localStorage.getItem(key)||'race'}catch(_){}
    if(!themes.some(theme=>theme.id===current))current='race';

    const panel=document.createElement('section');
    panel.className='hf-dashboard-customizer';
    panel.setAttribute('aria-label',page==='vehicle'?'Vehicle cockpit theme':'Driver console theme');
    panel.innerHTML=`
      <div class="hf-theme-heading">
        <div>
          <span class="hf-theme-kicker">Display profile</span>
          <strong>${page==='vehicle'?'Cockpit theme':'Driver Console theme'}</strong>
        </div>
        <span class="hf-theme-status"><i></i> LIVE</span>
      </div>
      <div class="hf-theme-options">
        ${themes.map(theme=>`<button type="button" data-hf-theme="${theme.id}" aria-pressed="false"><span>${theme.icon}</span><b>${theme.label}</b></button>`).join('')}
      </div>
      <p class="hf-theme-description" data-hf-theme-description></p>`;

    const shell=document.querySelector(page==='vehicle'?'.vehicle-profile-shell':'.app-shell');
    if(shell)shell.prepend(panel);

    panel.addEventListener('click',event=>{
      const button=event.target.closest('[data-hf-theme]');
      if(button)apply(button.dataset.hfTheme);
    });

    apply(current);
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install):install();
})();