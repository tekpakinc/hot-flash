# Hot Flash Event Engine V2 Setup

## 1. Run the database migration
Open Supabase SQL Editor and run:

`sql/event-engine-v2.sql`

## 2. Add the Google Calendar API key
For public Google Calendar imports, create a Google Cloud API key with Google Calendar API enabled.

In Supabase Dashboard, open **Edge Functions → Secrets** and add:

- `GOOGLE_CALENDAR_API_KEY`

The built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` values are supplied by Supabase.

## 3. Deploy the Edge Function
Production deployments are handled automatically by `.github/workflows/deploy-supabase-functions.yml` whenever files under `supabase/functions/` change. For a manual deployment from the repository root, run:

```bash
supabase functions deploy manage-event-sources
```

The function supports:

- secure Super Admin source management
- public Google Calendar imports
- public ICS/iCal feed imports
- deduplicated event upserts
- per-source sync status and error logs
- service-role authenticated scheduled syncing

## 4. Open the source console
Visit:

`https://hotflash.app/super-admin-event-sources.html`

Your Hot Flash account must have an active `beta_testers` record with `is_admin = true`.

## 5. Add a public Google Calendar
In Google Calendar settings, make the calendar publicly readable and copy its Calendar ID. Add it in Event Source Console as a Google source.

## 6. Add an ICS feed
Choose **ICS / iCal feed** and paste the public `.ics` subscription URL.

## Current provider status

- Google Calendar: automatic sync supported
- ICS/iCal: automatic sync supported
- Ticketmaster: existing nearby discovery function remains supported
- Facebook: source records can be reserved, but Meta-authorized page integration or submitted event links are required before automatic importing
- Eventbrite and MotorsportReg: adapters planned

## Automatic scheduling
After confirming manual sync works, Supabase Cron can invoke `manage-event-sources` with a POST body of:

```json
{"action":"sync"}
```

Authenticate that server-side request with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. Service-role authentication is accepted only for the `sync` action; source listing, creation, toggling, and deletion still require an authenticated active Hot Flash Super Admin. Never expose the service-role key in browser code.
