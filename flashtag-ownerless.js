(()=>{
  const original=window.buildFounderSticker;
  if(typeof original!=='function')return;
  window.buildFounderSticker=async function(vehicle,profile={}){
    const canvas=await original(vehicle,profile);
    const ctx=canvas.getContext('2d');
    const nickname=vehicle.nickname||'Founder Build';

    // Replace owner-specific text with vehicle-first identity so the same
    // physical FlashTag remains valid through future ownership transfers.
    ctx.save();
    ctx.fillStyle='rgba(3,4,5,.99)';
    ctx.fillRect(255,1242,1090,135);
    ctx.textAlign='center';
    ctx.shadowBlur=0;
    ctx.fillStyle='#84ff00';
    ctx.font='900 italic 38px Inter,Arial,sans-serif';
    ctx.fillText('PERMANENT VEHICLE ID',800,1295);
    ctx.fillStyle='#a64cff';
    ctx.font=`900 italic ${window.fitText?window.fitText(ctx,nickname,820,64,36):52}px Inter,Arial,sans-serif`;
    ctx.fillText(nickname,800,1360);

    ctx.fillStyle='rgba(1,2,2,.98)';
    ctx.fillRect(470,1534,660,48);
    ctx.fillStyle='rgba(255,255,255,.82)';
    ctx.font='700 24px Inter,Arial,sans-serif';
    ctx.fillText('VEHICLE PASSPORT • TRANSFERABLE',800,1562);
    ctx.restore();
    return canvas;
  };
})();