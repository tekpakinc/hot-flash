import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function unfoldIcs(text: string) {
  return text.replace(/\r?\n[ \t]/g, '');
}

function parseIcsDate(value = '') {
  const clean = value.trim();
  if (/^\d{8}$/.test(clean)) return new Date(`${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T12:00:00Z`).toISOString();
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${clean.endsWith('Z') ? 'Z' : ''}`).toISOString();
}

function decodeIcs(value = '') {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function classify(value = '') {
  const text = value.toLowerCase();
  if (text.includes('drift')) return 'drift';
  if (text.includes('drag')) return 'drag';
  if (text.includes('track') || text.includes('race')) return 'track';
  if (text.includes('cruise')) return 'cruise';
  if (text.includes('charity')) return 'charity';
  if (text.includes('show') || text.includes('expo')) return 'show';
  return 'meet';
}

function parseIcsEvents(text: string, source: any) {
  const blocks = unfoldIcs(text).split('BEGIN:VEVENT').slice(1).map(x => x.split('END:VEVENT')[0]);
  return blocks.map(block => {
    const lines = block.split(/\r?\n/);
    const field = (name: string) => {
      const line = lines.find(l => l.startsWith(`${name}:`) || l.startsWith(`${name};`));
      return line ? line.slice(line.indexOf(':') + 1) : '';
    };
    const title = decodeIcs(field('SUMMARY'));
    const startsAt = parseIcsDate(field('DTSTART'));
    if (!title || !startsAt) return null;
    const location = decodeIcs(field('LOCATION'));
    const uid = decodeIcs(field('UID')) || `${title}-${startsAt}`;
    const url = decodeIcs(field('URL')) || source.source_url;
    return {
      creator_id: null,
      event_source_id: source.id,
      title,
      description: decodeIcs(field('DESCRIPTION')) || null,
      event_type: classify(title),
      starts_at: startsAt,
      ends_at: parseIcsDate(field('DTEND')),
      venue_name: location || null,
      location: location || 'Location listed by organizer',
      website_url: url || null,
      source_type: 'external',
      source_name: source.name,
      external_id: uid,
      source_url: url || null,
      organizer_name: source.name,
      imported_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      approved: true,
    };
  }).filter(Boolean);
}

async function fetchSource(source: any) {
  if (source.source_type === 'google') {
    const key = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
    if (!key) throw new Error('GOOGLE_CALENDAR_API_KEY is not configured.');
    const calendarId = source.calendar_id || source.source_url;
    if (!calendarId) throw new Error('Google Calendar ID is missing.');
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('key', key);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', new Date(Date.now() - 86400000).toISOString());
    url.searchParams.set('timeMax', new Date(Date.now() + 365 * 86400000).toISOString());
    url.searchParams.set('maxResults', '2500');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Calendar returned ${response.status}.`);
    const data = await response.json();
    return (data.items || []).filter((e: any) => e.status !== 'cancelled').map((e: any) => {
      const startsAt = e.start?.dateTime || (e.start?.date ? `${e.start.date}T12:00:00Z` : null);
      if (!startsAt) return null;
      return {
        creator_id: null,
        event_source_id: source.id,
        title: e.summary || 'Untitled event',
        description: e.description || null,
        event_type: classify(e.summary || ''),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: e.end?.dateTime ? new Date(e.end.dateTime).toISOString() : (e.end?.date ? `${e.end.date}T12:00:00Z` : null),
        venue_name: e.location || null,
        location: e.location || 'Location listed by organizer',
        website_url: e.htmlLink || null,
        source_type: 'external',
        source_name: source.name,
        external_id: e.id,
        source_url: e.htmlLink || null,
        organizer_name: e.organizer?.displayName || source.name,
        imported_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        approved: true,
      };
    }).filter(Boolean);
  }

  if (source.source_type === 'ics') {
    if (!source.source_url) throw new Error('ICS URL is missing.');
    const response = await fetch(source.source_url, { headers: { 'User-Agent': 'HotFlash-EventSync/1.0' } });
    if (!response.ok) throw new Error(`ICS feed returned ${response.status}.`);
    return parseIcsEvents(await response.text(), source);
  }

  throw new Error(`${source.source_type} automatic syncing is not enabled yet.`);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth = req.headers.get('Authorization') || '';
    const serviceAuth = auth === `Bearer ${serviceKey}`;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list';

    // Scheduled jobs may authenticate with the Supabase service-role key, but
    // that privileged path is intentionally limited to syncing enabled sources.
    let user: any = null;
    if (serviceAuth) {
      if (action !== 'sync') return json({ error: 'Service authentication is limited to event syncing.' }, 403);
    } else {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
      const { data } = await userClient.auth.getUser();
      user = data.user;
      if (!user) return json({ error: 'Sign in required.' }, 401);
      const { data: access } = await admin.from('beta_testers').select('is_admin,is_active').eq('user_id', user.id).maybeSingle();
      if (!access?.is_active || !access?.is_admin) return json({ error: 'Super Admin access required.' }, 403);
    }

    if (action === 'list') {
      const { data, error } = await admin.from('event_sources').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return json({ sources: data || [] });
    }

    if (action === 'create') {
      const input = body.source || {};
      if (!input.name || !['google','ics','facebook','eventbrite','motorsportreg','ticketmaster','hotflash'].includes(input.source_type)) {
        return json({ error: 'A source name and valid type are required.' }, 400);
      }
      const row = {
        name: String(input.name).trim(),
        source_type: input.source_type,
        source_url: input.source_url ? String(input.source_url).trim() : null,
        calendar_id: input.calendar_id ? String(input.calendar_id).trim() : null,
        enabled: input.enabled !== false,
        sync_frequency_minutes: Number(input.sync_frequency_minutes || 180),
        owner_id: user.id,
        created_by: user.id,
      };
      const { data, error } = await admin.from('event_sources').insert(row).select().single();
      if (error) throw error;
      return json({ source: data });
    }

    if (action === 'toggle') {
      const { data, error } = await admin.from('event_sources').update({ enabled: Boolean(body.enabled), updated_at: new Date().toISOString() }).eq('id', body.id).select().single();
      if (error) throw error;
      return json({ source: data });
    }

    if (action === 'delete') {
      const { error } = await admin.from('event_sources').delete().eq('id', body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'sync') {
      const query = admin.from('event_sources').select('*').eq('enabled', true);
      const { data: sources, error } = body.id ? await query.eq('id', body.id) : await query;
      if (error) throw error;
      const results = [];
      for (const source of sources || []) {
        const { data: run } = await admin.from('event_sync_runs').insert({ source_id: source.id }).select().single();
        try {
          const rows: any[] = await fetchSource(source);
          if (rows.length) {
            const { error: upsertError } = await admin.from('events').upsert(rows, { onConflict: 'source_name,external_id' });
            if (upsertError) throw upsertError;
          }
          const now = new Date().toISOString();
          await admin.from('event_sources').update({ last_synced_at: now, last_sync_status: 'success', last_sync_error: null, updated_at: now }).eq('id', source.id);
          if (run) await admin.from('event_sync_runs').update({ finished_at: now, status: 'success', imported_count: rows.length }).eq('id', run.id);
          results.push({ id: source.id, name: source.name, imported: rows.length, status: 'success' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Sync failed.';
          const now = new Date().toISOString();
          await admin.from('event_sources').update({ last_synced_at: now, last_sync_status: 'failed', last_sync_error: message, updated_at: now }).eq('id', source.id);
          if (run) await admin.from('event_sync_runs').update({ finished_at: now, status: 'failed', error_message: message }).eq('id', run.id);
          results.push({ id: source.id, name: source.name, imported: 0, status: 'failed', error: message });
        }
      }
      return json({ results });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Event source request failed.' }, 400);
  }
});