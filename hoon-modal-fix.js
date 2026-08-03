(()=>{
  const modal=document.querySelector('[data-hoon-comments-modal]');
  if(!modal)return;
  const closeButton=modal.querySelector('[data-hoon-comments-close]');
  const setOpen=open=>{
    modal.hidden=!open;
    modal.style.setProperty('display',open?'grid':'none','important');
    modal.setAttribute('aria-hidden',String(!open));
    document.body.classList.toggle('lightbox-open',open);
    document.documentElement.classList.toggle('lightbox-open',open);
  };
  const close=()=>setOpen(false);
  setOpen(false);
  const observer=new MutationObserver(()=>{
    const requestedOpen=!modal.hidden;
    modal.style.setProperty('display',requestedOpen?'grid':'none','important');
    modal.setAttribute('aria-hidden',String(!requestedOpen));
    document.body.classList.toggle('lightbox-open',requestedOpen);
    document.documentElement.classList.toggle('lightbox-open',requestedOpen);
  });
  closeButton?.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();close()});
  modal.addEventListener('click',event=>{if(event.target===modal)close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)close()});
  observer.observe(modal,{attributes:true,attributeFilter:['hidden']});
  window.HotFlashHoonCommentsModal={open:()=>setOpen(true),close};
})();