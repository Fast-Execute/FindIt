import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clientIp,
  getPayfastConfig,
  isPayfastSource,
  itnParamString,
  parseItnBody,
  verifyItnSignature,
} from "@/lib/payfast";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reject(reason: string, status = 400) {
  // Reason is logged for us; the response gives nothing away to a prober.
  console.error(`[payfast-itn] rejected: ${reason}`);
  return new NextResponse("Rejected", { status });
}

// PayFast Instant Transaction Notification. This is the only path that can activate,
// renew or cancel a paid plan, so every check runs before any state changes.
export async function POST(request: Request) {
  const config = getPayfastConfig(process.env);
  const admin = createAdminClient();
  if (!config || !admin) return reject("billing not configured", 503);

  const raw = await request.text();
  const params = parseItnBody(raw);
  const get = (name: string) => params.find(([key]) => key === name)?.[1] ?? "";

  // 1. Source: must come from a PayFast server.
  const skipIpCheck = config.sandbox && process.env.PAYFAST_SKIP_IP_CHECK === "true";
  if (!skipIpCheck && !(await isPayfastSource(clientIp(request.headers)))) {
    return reject("source is not a PayFast server");
  }

  // 2. Merchant: must be addressed to us.
  if (get("merchant_id") !== config.merchantId) return reject("merchant mismatch");

  // 3. Signature: proves the payload was not altered.
  if (!verifyItnSignature(params, config.passphrase)) return reject("bad signature");

  // 4. Confirmation: PayFast itself must say this notification is genuine.
  try {
    const confirmation = await fetch(config.validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: itnParamString(params),
      signal: AbortSignal.timeout(10_000),
    });
    if ((await confirmation.text()).trim() !== "VALID") return reject("PayFast did not confirm");
  } catch {
    // Non-200 so PayFast retries later.
    return reject("could not reach PayFast to confirm", 502);
  }

  // 5. Apply. The database enforces the expected amount and ignores duplicates.
  const merchantPaymentId = get("m_payment_id");
  const amount = Number.parseFloat(get("amount_gross"));
  const raw_fields = Object.fromEntries(params.filter(([key]) => key !== "signature"));

  const { error } = await admin.rpc("apply_payfast_itn", {
    p_m_payment_id: UUID.test(merchantPaymentId) ? merchantPaymentId : null,
    p_pf_payment_id: get("pf_payment_id"),
    p_status: get("payment_status"),
    p_amount: Number.isFinite(amount) ? amount : null,
    p_token: get("token") || null,
    p_raw: raw_fields,
  });

  if (error) {
    const clientFault = /Amount mismatch|Unknown payment|Unknown payment status|Missing/.test(error.message);
    return reject(`apply failed: ${error.message}`, clientFault ? 400 : 500);
  }

  return new NextResponse("OK", { status: 200 });
}
