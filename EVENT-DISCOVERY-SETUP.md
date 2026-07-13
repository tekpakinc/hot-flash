# Hot Flash Local Event Discovery Setup

## 1. Database migration
Run `supabase-event-discovery.sql` in Supabase SQL Editor.

## 2. Ticketmaster API key
Create a Ticketmaster developer account and application, then copy its Consumer Key.

## 3. Add the Edge Function secret
In Supabase Dashboard, open **Edge Functions → Secrets** and add:

- Name: `TICKETMASTER_API_KEY`
- Value: your Ticketmaster Consumer Key

The built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` variables are available to deployed Edge Functions automatically.

## 4. Deploy the function
Using the Supabase CLI from the repository root:

```bash
supabase functions deploy discover-events
```

Or create/deploy the `discover-events` function through the Supabase Dashboard using the code at `supabase/functions/discover-events/index.ts`.

## 5. Test
1. Add a city/state such as `Greensboro, NC` to a Hot Flash profile.
2. Open `events.html` while signed in.
3. Choose a radius and press **Find events near me**.
4. Imported listings should appear alongside community-created events with their source clearly identified.

## Notes
- API credentials stay server-side and are never exposed in browser JavaScript.
- Imported events are deduplicated using `source_name + external_id`.
- The adapter is intentionally modular so additional providers can be added later.
- Ticketmaster coverage will not include every informal cruise-in or club meet; community submissions and future provider adapters remain important.
