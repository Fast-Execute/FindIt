// PayFast helpers: signatures, ITN verification primitives, checkout form, API auth.
// Pure functions only (no framework imports) so they can be unit-tested directly.

import { createHash, timingSafeEqual } from "node:crypto";
import { resolve4 } from "node:dns/promises";

export type PayfastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
  processUrl: string;
  validateUrl: string;
  apiBase: string;
  siteUrl: string;
};

// Hostnames PayFast sends ITNs from. We resolve them and compare to the request source.
export const PAYFAST_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];

export function getPayfastConfig(env: Record<string, string | undefined>): PayfastConfig | null {
  const merchantId = env.PAYFAST_MERCHANT_ID;
  const merchantKey = env.PAYFAST_MERCHANT_KEY;
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  if (!merchantId || !merchantKey || !siteUrl) return null;

  // Sandbox unless explicitly set to live, so a missing variable can never charge real cards.
  const sandbox = env.PAYFAST_MODE !== "live";
  return {
    merchantId,
    merchantKey,
    passphrase: env.PAYFAST_PASSPHRASE ?? "",
    sandbox,
    processUrl:
      env.PAYFAST_PROCESS_URL ??
      (sandbox ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process"),
    validateUrl:
      env.PAYFAST_VALIDATE_URL ??
      (sandbox
        ? "https://sandbox.payfast.co.za/eng/query/validate"
        : "https://www.payfast.co.za/eng/query/validate"),
    apiBase: env.PAYFAST_API_BASE ?? "https://api.payfast.co.za",
    siteUrl: siteUrl.replace(/\/+$/, ""),
  };
}

// PHP urlencode(): only A-Z a-z 0-9 - _ . are left alone, space becomes "+".
// encodeURIComponent also leaves ! ' ( ) * ~ alone, so those are escaped here.
export function phpUrlEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

export type Field = [name: string, value: string];

// Checkout signature: fields in form order, empty values left out, values trimmed.
export function signCheckout(fields: Field[], passphrase: string) {
  const parts = fields
    .filter(([, value]) => value !== "")
    .map(([name, value]) => `${name}=${phpUrlEncode(value.trim())}`);
  let payload = parts.join("&");
  if (passphrase) payload += `&passphrase=${phpUrlEncode(passphrase.trim())}`;
  return md5(payload);
}

export type CheckoutInput = {
  checkoutId: string;
  plan: string;
  planLabel: string;
  amountZar: number;
  email: string;
  firstName: string;
};

export function buildCheckout(config: PayfastConfig, input: CheckoutInput) {
  const amount = input.amountZar.toFixed(2);
  const fields: Field[] = [
    ["merchant_id", config.merchantId],
    ["merchant_key", config.merchantKey],
    ["return_url", `${config.siteUrl}/dashboard/billing?checkout=success`],
    ["cancel_url", `${config.siteUrl}/dashboard/billing?checkout=cancelled`],
    ["notify_url", `${config.siteUrl}/api/billing/payfast/notify`],
    ["name_first", input.firstName],
    ["email_address", input.email],
    ["m_payment_id", input.checkoutId],
    ["amount", amount],
    ["item_name", `FindIt ${input.planLabel} (monthly)`],
    ["subscription_type", "1"],
    ["recurring_amount", amount],
    ["frequency", "3"], // 3 = monthly
    ["cycles", "0"], // 0 = until cancelled
  ];
  const signature = signCheckout(fields, config.passphrase);
  return {
    action: config.processUrl,
    fields: [...fields.filter(([, v]) => v !== ""), ["signature", signature] as Field],
  };
}

export function parseItnBody(raw: string): Field[] {
  return Array.from(new URLSearchParams(raw).entries());
}

// The string PayFast signs and validates: received order, every value (even empty),
// signature itself excluded.
export function itnParamString(params: Field[]) {
  return params
    .filter(([name]) => name !== "signature")
    .map(([name, value]) => `${name}=${phpUrlEncode(value)}`)
    .join("&");
}

export function itnSignature(params: Field[], passphrase: string) {
  let payload = itnParamString(params);
  if (passphrase) payload += `&passphrase=${phpUrlEncode(passphrase.trim())}`;
  return md5(payload);
}

export function verifyItnSignature(params: Field[], passphrase: string) {
  const received = params.find(([name]) => name === "signature")?.[1]?.toLowerCase() ?? "";
  const expected = itnSignature(params, passphrase);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Is the request source one of PayFast's servers? The resolver is injectable for tests.
export async function isPayfastSource(
  ip: string,
  resolver: (host: string) => Promise<string[]> = resolve4,
) {
  if (!ip) return false;
  const results = await Promise.allSettled(PAYFAST_HOSTS.map((host) => resolver(host)));
  const allowed = new Set<string>();
  for (const result of results) {
    if (result.status === "fulfilled") result.value.forEach((address) => allowed.add(address));
  }
  return allowed.has(ip);
}

// Best-effort client address from the platform's forwarding headers.
export function clientIp(headers: { get(name: string): string | null }) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() ?? "";
}

// ---- Merchant API (cancel subscription) ----

// PayFast expects an ISO-8601 timestamp; we send South African local time.
export function apiTimestamp(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return parts.replace(" ", "T");
}

// API signature: header values plus passphrase, sorted alphabetically by name.
export function apiSignature(values: Record<string, string>, passphrase: string) {
  const all: Record<string, string> = { ...values };
  if (passphrase) all.passphrase = passphrase;
  const payload = Object.keys(all)
    .sort()
    .map((key) => `${key}=${phpUrlEncode(all[key].trim())}`)
    .join("&");
  return md5(payload);
}

export function apiHeaders(config: PayfastConfig, date: Date = new Date()) {
  const timestamp = apiTimestamp(date);
  const base = { "merchant-id": config.merchantId, version: "v1", timestamp };
  return { ...base, signature: apiSignature(base, config.passphrase) };
}
