(()=>{
  const modal=document.querySelector('[data-hoon-comments-modal]');
  if(!modal)return;
  const closeButton=modal.querySelector('[data-hoon-comments-close]');
  const close=()=>{
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('lightbox-open');
    document.documentElement.classList.remove('lightbox-open');
  };
  const openObserver=new MutationObserver(()=>{
    const open=!modal.hidden;
    modal.setAttribute('aria-hidden',String(!open));
    if(!open){
      document.body.classList.remove('lightbox-open');
      document.documentElement.classList.remove('lightbox-open');
    }
  });
  modal.hidden=true;
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('lightbox-open');
  document.documentElement.classList.remove('lightbox-open');
  closeButton?.addEventListener('click',close);
  modal.addEventListener('click',event=>{if(event.target===modal)close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)close()});
  openObserver.observe(modal,{attributes:true,attributeFilter:['hidden']});
})();