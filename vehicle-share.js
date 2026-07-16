document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('hf') || params.get('id');
  if (!ref || typeof hotflashSupabase === 'undefined') return;

  let query = hotflashSupabase
    .from('vehicles')
    .select('id,hotflash_id,nickname,year,make,model,cover_photo,owner_profile:profiles!vehicles_owner_id_fkey(username,display_name)');
  query = ref.startsWith('HF-') ? query.eq('hotflash_id', ref) : query.eq('id', ref);
  const { data: vehicle } = await query.maybeSingle();
  if (!vehicle) return;

  const owner = vehicle.owner_profile?.display_name || vehicle.owner_profile?.username || 'a Hot Flash member';
  const fallbackName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const name = vehicle.nickname || fallbackName || 'this ride';
  const specs = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const title = `Check out ${name} on Hot Flash`;
  const description = specs
    ? `${owner}'s ${specs} — see the photos, build details, updates, and story behind the ride.`
    : `${owner}'s vehicle profile, photos, build details, and updates on Hot Flash.`;

  document.title = title;
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) descriptionMeta.setAttribute('content', description);

  const projectRef = new URL(HOTFLASH_SUPABASE_URL).hostname.split('.')[0];
  const shareUrl = `https://${projectRef}.supabase.co/functions/v1/vehicle-share?${ref.startsWith('HF-') ? 'hf' : 'id'}=${encodeURIComponent(ref)}`;
  const shareButton = document.querySelector('[data-flashtag-share]');
  const copyButton = document.querySelector('[data-flashtag-copy]');

  shareButton?.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const payload = { title, text: description, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(payload);
      else {
        await navigator.clipboard.writeText(shareUrl);
        const status = document.querySelector('[data-flashtag-status]');
        if (status) status.textContent = 'Share link copied.';
      }
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('[Hot Flash vehicle share]', error);
    }
  }, true);

  copyButton?.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    await navigator.clipboard.writeText(shareUrl);
    const status = document.querySelector('[data-flashtag-status]');
    if (status) status.textContent = 'Preview-ready vehicle link copied.';
  }, true);
});
