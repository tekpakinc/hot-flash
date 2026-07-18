# paypal-subscription-webhook

Public Supabase Edge Function that receives PayPal subscription webhooks and updates Hot Flash access.

Configure PayPal to send these events:

- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`
- `PAYMENT.SALE.REVERSED`

Required Supabase secrets:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_API_BASE`

Processing rules:

- Verify every webhook signature with PayPal before trusting it.
- Use `resource.id` or the sale billing-agreement reference to find `subscriptions.provider_subscription_id`.
- Activation sets `status=active`, saves the period dates, and unlocks entitlements.
- Successful renewal inserts an idempotent `subscription_payments` record and extends the current period.
- Payment failure sets `status=past_due` and `grace_period_ends_at=now()+7 days`.
- Cancellation prevents renewal but keeps access until the paid period ends.
- Suspension, expiration, reversal, or the end of grace removes paid entitlements by setting the corresponding status and end date.
- Preserve the raw provider payload for audit and support.
- Return HTTP 200 for duplicate events after confirming they were already processed.

The SQL trigger in `supabase-subscriptions-v2.sql` keeps legacy profile membership fields synchronized for existing pages.