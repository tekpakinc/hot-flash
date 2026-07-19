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
From the repository root:

```bash
supabase functions deploy manage-event-sources
```

The function supports:

- secure Super Admin source management
- public Google Calendar imports
- public ICS/iCal feed imports
- deduplicated event upserts
- per-source sync status and error logs

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
The console can sync sources immediately. For unattended syncing, schedule the function using Supabase Cron after confirming manual sync works. Keep the function protected; use a scheduled service-role invocation rather than exposing secrets in browser code.
