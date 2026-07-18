import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

async function paypalAccessToken(apiBase: string, clientId: string, clientSecret: string) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    console.error("PayPal token error", payload);
    throw new Error("Could not authenticate with PayPal");
  }
  return payload.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in is required" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: "Invalid or expired session" }, 401);

    const body = await req.json().catch(() => ({}));
    const planCode = String(body?.plan_code || "").toLowerCase();
    if (!new Set(["verified", "plus", "shop"]).has(planCode)) {
      return json({ error: "Invalid membership plan" }, 400);
    }

    const { data: plan, error: planError } = await admin
      .from("membership_plans")
      .select("code,name,paypal_plan_id,active")
      .eq("code", planCode)
      .eq("active", true)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan?.paypal_plan_id) return json({ error: "This plan is not connected to PayPal yet" }, 409);

    const { data: liveSubscription, error: liveError } = await admin
      .from("subscriptions")
      .select("id,status,provider_subscription_id,plan_code")
      .eq("user_id", user.id)
      .in("status", ["approval_pending", "trialing", "active", "past_due", "suspended"])
      .maybeSingle();
    if (liveError) throw liveError;
    if (liveSubscription) {
      return json({
        error: "You already have a pending or active membership",
        subscription: liveSubscription,
      }, 409);
    }

    const apiBase = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.paypal.com";
    const siteUrl = (Deno.env.get("HOTFLASH_SITE_URL") || "https://hotflash.app").replace(/\/$/, "");
    const token = await paypalAccessToken(apiBase, env("PAYPAL_CLIENT_ID"), env("PAYPAL_CLIENT_SECRET"));

    const paypalResponse = await fetch(`${apiBase}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        plan_id: plan.paypal_plan_id,
        custom_id: user.id,
        application_context: {
          brand_name: "Hot Flash",
          locale: "en-US",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${siteUrl}/membership-success.html`,
          cancel_url: `${siteUrl}/pricing.html?checkout=cancelled`,
        },
      }),
    });
    const paypal = await paypalResponse.json();
    if (!paypalResponse.ok || !paypal?.id) {
      console.error("PayPal create subscription error", paypal);
      return json({ error: paypal?.message || "PayPal could not create the subscription" }, 502);
    }

    const approvalUrl = Array.isArray(paypal.links)
      ? paypal.links.find((link: { rel?: string; href?: string }) => link.rel === "approve")?.href
      : null;
    if (!approvalUrl) return json({ error: "PayPal did not return an approval link" }, 502);

    const { error: insertError } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan_code: planCode,
      provider: "paypal",
      provider_subscription_id: paypal.id,
      status: "approval_pending",
      provider_payload: paypal,
    });
    if (insertError) throw insertError;

    return json({ approval_url: approvalUrl, subscription_id: paypal.id });
  } catch (error) {
    console.error("create-paypal-subscription", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
