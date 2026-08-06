(()=>{
  function prepareLightbox(){
    const modal=document.querySelector('[data-photo-lightbox]');
    const figure=modal?.querySelector('figure');
    const image=figure?.querySelector('[data-lightbox-image]');
    if(!modal||!figure||!image||figure.querySelector('.lightbox-image-stage'))return;

    const stage=document.createElement('div');
    stage.className='lightbox-image-stage';
    image.before(stage);
    stage.appendChild(image);

    const controls=[
      modal.querySelector('[data-lightbox-close]'),
      modal.querySelector('[data-lightbox-prev]'),
      modal.querySelector('[data-lightbox-next]'),
      modal.querySelector('[data-lightbox-counter]')
    ];
    controls.filter(Boolean).forEach(control=>stage.appendChild(control));

    modal.addEventListener('click',event=>{
      if(event.target===modal)modal.querySelector('[data-lightbox-close]')?.click();
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',prepareLightbox);
  else prepareLightbox();
})();
