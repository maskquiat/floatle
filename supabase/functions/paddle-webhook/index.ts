// Floatle: Paddle webhook (a Supabase Edge Function).
// Paddle calls this whenever a subscription starts, renews, changes or ends.
// It checks the message really came from Paddle, then updates the teacher's row in the plans table.
//
// Needs one secret, set in Supabase (Edge Functions -> Secrets):
//   PADDLE_WEBHOOK_SECRET  the "secret key" Paddle shows for this notification destination
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Turn OFF "Verify JWT" for this function: Paddle can't send a Supabase login token.

import { createClient } from "npm:@supabase/supabase-js@2";

const SECRET = Deno.env.get("PADDLE_WEBHOOK_SECRET") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const DAY = 86_400_000;
const PLANS = new Set(["monthly", "yearly", "founding"]);

// Paddle-Signature: ts=1671552777;h1=<hex HMAC-SHA256 of "ts:rawBody">
export async function verifySignature(raw: string, header: string | null, secret: string, now = Date.now()): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(";").map((p) => p.split("=") as [string, string]));
  const ts = parts["ts"], h1 = parts["h1"];
  if (!ts || !h1) return false;
  if (Math.abs(now / 1000 - Number(ts)) > 300) return false; // older than 5 minutes: possible replay
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}:${raw}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== h1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ h1.charCodeAt(i);
  return diff === 0;
}

// How long Pro stays on for a subscription in this state.
export function paidUntilFor(sub: any, now = Date.now()): number {
  const ends = sub?.current_billing_period?.ends_at ? Date.parse(sub.current_billing_period.ends_at) : 0;
  switch (sub?.status) {
    case "active":
    case "trialing":
      return Math.max(ends, now) + 2 * DAY;   // a little slack so renewals never blink Pro off
    case "past_due":
      return Math.max(ends, now) + 7 * DAY;   // grace period while Paddle retries the card
    default:
      return now;                              // canceled or paused: Pro ends now
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("Paddle-Signature"), SECRET))) {
    return new Response("bad signature", { status: 401 });
  }

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  if (!String(evt.event_type || "").startsWith("subscription.")) return new Response("ignored");

  const sub = evt.data || {};
  const userId = sub.custom_data?.user_id;
  if (!userId) {
    console.error("paddle-webhook: no user_id on subscription", sub.id);
    return new Response("no user id", { status: 200 }); // nothing to retry
  }

  const price = sub.items?.[0]?.price || {};
  const plan = PLANS.has(price.custom_data?.plan) ? price.custom_data.plan
    : PLANS.has(sub.custom_data?.plan) ? sub.custom_data.plan : null;
  const occurred = evt.occurred_at ? Date.parse(evt.occurred_at) : Date.now();

  const { data: row, error: readErr } = await db.from("plans")
    .select("pro_until, source, pilot_until, last_event_at").eq("user_id", userId).maybeSingle();
  if (readErr) { console.error(readErr); return new Response("db read failed", { status: 500 }); }

  // Paddle can deliver messages out of order; keep only the newest.
  if (row?.last_event_at && Date.parse(row.last_event_at) > occurred) return new Response("stale");

  const pilotUntil = row?.pilot_until ?? (row?.source === "pilot" ? row.pro_until : null);
  const paidUntil = paidUntilFor(sub);
  const proUntil = Math.max(paidUntil, pilotUntil ? Date.parse(pilotUntil) : 0);

  const { error } = await db.from("plans").upsert({
    user_id: userId,
    pro_until: new Date(proUntil).toISOString(),
    source: "paddle",
    plan,
    status: sub.status ?? null,
    paid_until: new Date(paidUntil).toISOString(),
    pilot_until: pilotUntil,
    paddle_customer_id: sub.customer_id ?? null,
    paddle_subscription_id: sub.id ?? null,
    last_event_at: new Date(occurred).toISOString(),
  }, { onConflict: "user_id" });
  if (error) { console.error(error); return new Response("db write failed", { status: 500 }); }

  return new Response("ok");
});
