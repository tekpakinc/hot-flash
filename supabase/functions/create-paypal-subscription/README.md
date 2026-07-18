# create-paypal-subscription

Authenticated Supabase Edge Function used by `membership.js` to create a PayPal subscription and return the buyer approval URL.

Required Supabase secrets:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_API_BASE` (`https://api-m.sandbox.paypal.com` while testing, then `https://api-m.paypal.com`)
- `HOTFLASH_SITE_URL` (`https://hotflash.app`)

The function must:

1. Validate the signed-in Supabase user.
2. Accept only `verified`, `plus`, or `shop` as `plan_code`.
3. Read the matching `paypal_plan_id` from `membership_plans`.
4. Reject a second live or pending subscription for the same user.
5. Create the PayPal subscription with the Supabase user ID as `custom_id`.
6. Insert a local `subscriptions` row with `approval_pending` status.
7. Return only the PayPal approval URL to the browser.

Never expose PayPal secrets or the Supabase service-role key in browser JavaScript.