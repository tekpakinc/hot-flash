# Hot Flash Local Event Discovery Setup

1. Run `supabase-event-discovery.sql` in Supabase SQL Editor.
2. Create a Ticketmaster developer application and copy its Consumer Key.
3. In Supabase Dashboard, open **Edge Functions → Secrets** and add `TICKETMASTER_API_KEY` with that key.
4. Deploy the function from the repository root:

```bash
supabase functions deploy discover-events
```

5. Add a city/state such as `Greensboro, NC` to a Hot Flash profile.
6. Open `events.html`, choose a radius, and press **Find events near me**.

Imported listings are deduplicated by provider and external event ID, clearly attributed, and retain the original source link. Ticketmaster will not cover every informal meet, so community submissions remain part of the calendar and more provider adapters can be added later.
