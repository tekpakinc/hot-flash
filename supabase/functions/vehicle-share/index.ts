import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char] || char));
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const ref = (url.searchParams.get('hf') || url.searchParams.get('id') || '').trim();
  const destination = new URL('https://hotflash.app/vehicle.html');
  if (ref) destination.searchParams.set(ref.startsWith('HF-') ? 'hf' : 'id', ref);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let vehicle: any = null;
  if (ref) {
    let query = supabase
      .from('vehicles')
      .select('id,hotflash_id,nickname,year,make,model,cover_photo,owner_profile:profiles!vehicles_owner_id_fkey(username,display_name)');
    query = ref.startsWith('HF-') ? query.eq('hotflash_id', ref) : query.eq('id', ref);
    const result = await query.maybeSingle();
    vehicle = result.data;
  }

  const owner = vehicle?.owner_profile?.display_name || vehicle?.owner_profile?.username || 'a Hot Flash member';
  const name = vehicle?.nickname || [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || 'this ride';
  const specs = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
  const title = `Check out ${name} on Hot Flash`;
  const description = specs ? `${owner}'s ${specs} — photos, build details, updates, and the story behind the ride.` : `${owner}'s vehicle profile, build story, photos, and updates on Hot Flash.`;
  const image = vehicle?.cover_photo || 'https://hotflash.app/assets/hot-flash-logo.png';
  const canonical = destination.toString();

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Hot Flash">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(url.toString())}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(canonical)}">
<script>window.location.replace(${JSON.stringify(canonical)});</script>
</head><body><p>Opening <a href="${escapeHtml(canonical)}">${escapeHtml(name)} on Hot Flash</a>…</p></body></html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600',
    },
  });
});
