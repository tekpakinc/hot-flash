import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

async function paypalAccessToken(apiBase: string, clientId: string, clientSecret: string) {
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error("Could not authenticate with PayPal");
  return payload.access_token as string;
}

async function verifyWebhook(req: Request, event: unknown, token: string, apiBase: string) {
  const verification = {
    auth_algo: req.headers.get("paypal-auth-algo"),
    cert_url: req.headers.get("paypal-cert-url"),
    transmission_id: req.headers.get("paypal-transmission-id"),
    transmission_sig: req.headers.get("paypal-transmission-sig"),
    transmission_time: req.headers.get("paypal-transmission-time"),
    webhook_id: env("PAYPAL_WEBHOOK_ID"),
    webhook_event: event,
  };

  if (!verification.auth_algo || !verification.cert_url || !verification.transmission_id ||
      !verification.transmission_sig || !verification.transmission_time) return false;

  const response = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(verification),
  });
  const payload = await response.json();
  return response.ok && payload.verification_status === "SUCCESS";
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);
    if (!event?.id || !event?.event_type) return json({ error: "Invalid webhook body" }, 400);

    const apiBase = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.paypal.com";
    const token = await paypalAccessToken(apiBase, env("PAYPAL_CLIENT_ID"), env("PAYPAL_CLIENT_SECRET"));
    if (!await verifyWebhook(req, event, token, apiBase)) {
      console.warn("Rejected PayPal webhook", event.id);
      return json({ error: "Invalid PayPal signature" }, 400);
    }

    const supabaseUrl = env("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing } = await admin
      .from("paypal_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();
    if (existing) return json({ received: true, duplicate: true });

    const resource = event.resource || {};
    const subscriptionId = resource.id || resource.billing_agreement_id || resource.supplementary_data?.related_ids?.subscription_id;
    let subscription: Record<string, unknown> | null = null;

    if (subscriptionId) {
      const { data } = await admin
        .from("subscriptions")
        .select("*")
        .eq("provider_subscription_id", subscriptionId)
        .maybeSingle();
      subscription = data;
    }

    if (!subscription && resource.custom_id) {
      const { data } = await admin
        .from("subscriptions")
        .select("*")
        .eq("user_id", resource.custom_id)
        .in("status", ["approval_pending", "trialing", "active", "past_due", "suspended"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = data;
    }

    const now = new Date().toISOString();
    const nextBilling = resource.billing_info?.next_billing_time || null;
    const eventType = String(event.event_type);

    if (subscription) {
      const updates: Record<string, unknown> = {
        provider_payload: event,
        updated_at: now,
      };

      if (eventType === "BILLING.SUBSCRIPTION.CREATED") {
        updates.provider_subscription_id = resource.id || subscriptionId;
        updates.status = resource.status === "ACTIVE" ? "active" : "approval_pending";
      } else if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
        updates.provider_subscription_id = resource.id || subscriptionId;
        updates.status = "active";
        updates.started_at = resource.start_time || now;
        updates.current_period_start = now;
        updates.current_period_end = nextBilling;
        updates.grace_period_ends_at = null;
      } else if (eventType === "BILLING.SUBSCRIPTION.UPDATED") {
        const mapped = String(resource.status || "").toUpperCase();
        if (mapped === "ACTIVE") updates.status = "active";
        if (mapped === "SUSPENDED") updates.status = "suspended";
        if (mapped === "CANCELLED") updates.status = "canceled";
        if (mapped === "EXPIRED") updates.status = "expired";
        if (nextBilling) updates.current_period_end = nextBilling;
      } else if (eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
        updates.status = "past_due";
        updates.grace_period_ends_at = addDays(new Date(), 7);
      } else if (eventType === "BILLING.SUBSCRIPTION.SUSPENDED") {
        updates.status = "suspended";
        updates.ended_at = now;
      } else if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
        updates.status = "canceled";
        updates.canceled_at = now;
        updates.ended_at = now;
      } else if (eventType === "BILLING.SUBSCRIPTION.EXPIRED") {
        updates.status = "expired";
        updates.ended_at = now;
      } else if (eventType === "PAYMENT.SALE.COMPLETED") {
        updates.status = "active";
        updates.grace_period_ends_at = null;
        if (nextBilling) updates.current_period_end = nextBilling;
      }

      const { error: updateError } = await admin
        .from("subscriptions")
        .update(updates)
        .eq("id", subscription.id);
      if (updateError) throw updateError;

      if (["PAYMENT.SALE.COMPLETED", "PAYMENT.SALE.REFUNDED", "PAYMENT.SALE.REVERSED"].includes(eventType)) {
        const amount = resource.amount || resource.gross_amount || {};
        const status = eventType === "PAYMENT.SALE.COMPLETED"
          ? "completed"
          : eventType === "PAYMENT.SALE.REFUNDED" ? "refunded" : "reversed";
        const amountCents = Math.round(Number(amount.total || amount.value || 0) * 100);
        const transactionId = resource.id || event.id;
        const { error: paymentError } = await admin.from("subscription_payments").upsert({
          subscription_id: subscription.id,
          provider_transaction_id: transactionId,
          amount_cents: Number.isFinite(amountCents) ? amountCents : 0,
          currency: amount.currency || amount.currency_code || "USD",
          status,
          paid_at: resource.create_time || now,
          provider_payload: event,
        }, { onConflict: "provider_transaction_id" });
        if (paymentError) throw paymentError;
      }
    } else {
      console.warn("No local subscription matched PayPal event", event.id, subscriptionId);
    }

    const { error: eventError } = await admin.from("paypal_webhook_events").insert({
      event_id: event.id,
      event_type: eventType,
      provider_subscription_id: subscriptionId || null,
      payload: event,
      processed_at: now,
    });
    if (eventError) throw eventError;

    return json({ received: true, matched: Boolean(subscription) });
  } catch (error) {
    console.error("paypal-subscription-webhook", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected webhook error" }, 500);
  }
});
