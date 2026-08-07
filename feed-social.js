const updates=document.querySelector('[data-social-feed]');
const esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function loadSocialFeed(){
  if(!updates)return;

  const{data,error}=await hotflashSupabase
    .from('posts')
    .select('*, profiles!posts_author_id_fkey(username,display_name,avatar_url), vehicles(hotflash_id,nickname,cover_photo), shops(name,slug,tier,verification_status)')
    .order('created_at',{ascending:false})
    .limit(40);

  if(error){
    updates.innerHTML='<p class="small-muted">Run the social database upgrade to activate community posts.</p>';
    return;
  }

  const eligible=(data||[])
    .filter(post=>!post.shop_id||(post.shops?.tier==='pro'&&post.shops?.verification_status!=='suspended'))
    .slice(0,20);

  updates.innerHTML=eligible.map(p=>{
    const isShopPost=Boolean(p.shop_id);
    const profileName=p.profiles?.display_name||p.profiles?.username||'Member';
    const profileUrl=`member.html?u=${encodeURIComponent(p.profiles?.username||'')}`;
    const shopUrl=p.shops?.slug?`shop.html?s=${encodeURIComponent(p.shops.slug)}`:'#';
    const vehicleUrl=p.vehicles?.hotflash_id?`vehicle.html?hf=${encodeURIComponent(p.vehicles.hotflash_id)}`:'';
    const sourceName=isShopPost?(p.shops?.name||'Shop Pro'):profileName;
    const sourceUrl=isShopPost?shopUrl:profileUrl;
    const context=isShopPost
      ? 'Shop Pro update'
      : `updated ${p.vehicles?.nickname?`<a href="${vehicleUrl}">${esc(p.vehicles.nickname)}</a>`:'their garage'}`;
    const actionUrl=vehicleUrl||sourceUrl;

    return `<article class="social-post${isShopPost?' shop-pro-post':''}">
      <div class="social-post-head">
        <a class="social-avatar" href="${sourceUrl}">${esc(sourceName[0]||'H')}</a>
        <div>
          <a href="${sourceUrl}"><strong>${esc(sourceName)}</strong></a>
          ${isShopPost?'<span class="small-muted"> · Shop Pro</span>':''}
          <div class="small-muted">${context} • ${new Date(p.created_at).toLocaleString()}</div>
        </div>
      </div>
      <p class="social-post-body">${esc(p.body)}</p>
      ${p.image_url?`<a href="${actionUrl}"><img class="social-post-image" src="${esc(p.image_url)}" alt="${isShopPost?'Shop update':'Build update'} photo" loading="lazy"></a>`:''}
      <div class="social-actions"><a class="secondary-button" href="${actionUrl}">${vehicleUrl?'Like or comment':'Open update'}</a></div>
    </article>`;
  }).join('')||'<p class="small-muted">No build updates yet. The first post gets bragging rights.</p>';
}

document.addEventListener('DOMContentLoaded',loadSocialFeed);
