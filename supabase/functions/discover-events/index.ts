import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hotflash-cron-secret',
};

const keywords = [
  'car show',
  'cars and coffee',
  'cruise in',
  'drag racing',
  'drift',
  'track day',
  'motorcycle show',
  'auto show',
];

function classify(name = '') {
  const text = name.toLowerCase();
  if (text.includes('drift')) return 'drift';
  if (text.includes('drag')) return 'drag';
  if (text.includes('track') || text.includes('race')) return 'track';
  if (text.includes('cruise')) return 'cruise';
  if (text.includes('charity')) return 'charity';
  if (text.includes('show') || text.includes('expo')) return 'show';
  return 'meet';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ticketmasterKey = Deno.env.get('TICKETMASTER_API_KEY');
    const expectedCronSecret = Deno.env.get('EVENT_CRON_SECRET');
    const suppliedCronSecret = req.headers.get('x-hotflash-cron-secret');
    const scheduledRun = Boolean(
      expectedCronSecret && suppliedCronSecret && suppliedCronSecret === expectedCronSecret,
    );

    if (!ticketmasterKey) throw new Error('Ticketmaster API key is not configured yet.');

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));

    let location = '';
    let radius = 50;

    if (scheduledRun) {
      location = String(
        body.location || Deno.env.get('EVENT_DEFAULT_LOCATION') || 'Burlington, NC',
      ).trim();
      radius = Math.min(
        Math.max(Number(body.radius || Deno.env.get('EVENT_DEFAULT_RADIUS') || 250), 10),
        250,
      );
    } else {
      const authHeader = req.headers.get('Authorization') || '';
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();

      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Sign in required.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('location,event_radius_miles,event_categories')
        .eq('id', user.id)
        .maybeSingle();

      location = String(body.location || profile?.location || '').trim();
      if (!location) throw new Error('Add your city and state to your Hot Flash profile first.');
      radius = Math.min(
        Math.max(Number(body.radius || profile?.event_radius_miles || 50), 10),
        250,
      );
    }

    const [city, region] = location.split(',').map((part: string) => part.trim());
    const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const endDateTime = new Date(Date.now() + 120 * 86400000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    const found = new Map();

    for (const keyword of keywords) {
      const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
      url.searchParams.set('apikey', ticketmasterKey);
      url.searchParams.set('keyword', keyword);
      url.searchParams.set('city', city);
      if (region) url.searchParams.set('stateCode', region.toUpperCase());
      url.searchParams.set('countryCode', 'US');
      url.searchParams.set('radius', String(radius));
      url.searchParams.set('unit', 'miles');
      url.searchParams.set('startDateTime', startDateTime);
      url.searchParams.set('endDateTime', endDateTime);
      url.searchParams.set('size', '50');
      url.searchParams.set('sort', 'date,asc');

      const response = await fetch(url);
      if (!response.ok) continue;

      const json = await response.json();
      for (const event of json?._embedded?.events || []) found.set(event.id, event);
    }

    const rows = Array.from(found.values())
      .map((event: any) => {
        const venue = event?._embedded?.venues?.[0] || {};
        const localDate = event?.dates?.start?.localDate;
        const localTime = event?.dates?.start?.localTime || '12:00:00';
        const startsAt =
          event?.dates?.start?.dateTime ||
          (localDate ? new Date(`${localDate}T${localTime}`).toISOString() : null);

        return {
          creator_id: null,
          title: event.name,
          description: event.info || event.pleaseNote || event.description || null,
          event_type: classify(event.name),
          starts_at: startsAt,
          ends_at: null,
          venue_name: venue.name || null,
          location:
            [venue.city?.name, venue.state?.stateCode].filter(Boolean).join(', ') || location,
          website_url: event.url || null,
          image_url:
            event.images?.find((img: any) => img.ratio === '16_9')?.url ||
            event.images?.[0]?.url ||
            null,
          source_type: 'external',
          source_name: 'Ticketmaster',
          external_id: event.id,
          source_url: event.url || null,
          imported_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
          latitude: venue.location?.latitude ? Number(venue.location.latitude) : null,
          longitude: venue.location?.longitude ? Number(venue.location.longitude) : null,
        };
      })
      .filter((row: any) => row.starts_at);

    if (rows.length) {
      const { error } = await admin
        .from('events')
        .upsert(rows, { onConflict: 'source_name,external_id' });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ imported: rows.length, location, radius, scheduled: scheduledRun }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Event discovery failed.',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
