// Email delivery: rendering, the Resend call, retry rules, and draining the outbox.
// No imports on purpose, so it can be unit-tested directly (node --test lib/email.test.mjs).
// To change provider, replace buildSendRequest and classifyStatus; nothing else depends on Resend.

export type EmailKind =
  | "DEVICE_RECONNECTED"
  | "DEVICE_WENT_OFFLINE"
  | "LOST_MODE_ENABLED"
  | "LOST_MODE_DISABLED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_CANCELED";

export type OutboxRow = {
  id: number;
  owner_id: string;
  kind: EmailKind;
  payload: Record<string, unknown> | null;
};

export type EmailConfig = {
  apiKey: string;
  from: string;
  siteUrl: string;
};

export type RenderedEmail = { subject: string; text: string; html: string };

export function getEmailConfig(env: Record<string, string | undefined>): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  if (!apiKey || !from || !siteUrl) return null;
  return { apiKey, from, siteUrl: siteUrl.replace(/\/+$/, "") };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PLAN_NAMES: Record<string, string> = { BASIC: "Basic", PLUS: "Plus", FAMILY: "Family" };

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function formatWhen(value: unknown) {
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

function formatAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number.parseFloat(str(value));
  return Number.isFinite(amount) ? `R${amount.toFixed(2)}` : "";
}

type Content = {
  subject: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  // Device alerts can be turned off in Settings; billing emails cannot.
  optOutFooter: boolean;
};

function contentFor(kind: EmailKind, payload: Record<string, unknown>, siteUrl: string): Content {
  const device = str(payload.device_name) || "Your device";
  const deviceId = str(payload.device_id);
  const deviceUrl = deviceId ? `${siteUrl}/dashboard/devices/${encodeURIComponent(deviceId)}` : `${siteUrl}/dashboard`;
  const when = formatWhen(payload.at);
  const periodEnd = formatWhen(payload.period_end);
  const plan = PLAN_NAMES[str(payload.plan)] ?? "";
  const amount = formatAmount(payload.amount);

  switch (kind) {
    case "DEVICE_RECONNECTED":
      return {
        subject: `${device} is back online`,
        heading: `${device} is back online`,
        paragraphs: [
          `${device} reconnected${when ? ` at ${when}` : ""} and reported a fresh location.`,
          "Open FindIt to see where it is now.",
        ],
        button: { label: "See its location", url: deviceUrl },
        optOutFooter: true,
      };
    case "DEVICE_WENT_OFFLINE":
      return {
        subject: `${device} went offline`,
        heading: `${device} went offline`,
        paragraphs: [
          `We lost contact with ${device}${when ? ` at ${when}` : ""}. Lost Mode is on, so we will email you again the moment it reconnects.`,
          "Its last known location is still available in FindIt.",
        ],
        button: { label: "See last known location", url: deviceUrl },
        optOutFooter: true,
      };
    case "LOST_MODE_ENABLED":
      return {
        subject: `Lost Mode turned on for ${device}`,
        heading: `Lost Mode is on for ${device}`,
        paragraphs: [
          `Lost Mode was turned on${when ? ` at ${when}` : ""}. The device will report its location more often.`,
          "If you did not do this, sign in, turn Lost Mode off and change your password.",
        ],
        button: { label: "Open device", url: deviceUrl },
        optOutFooter: true,
      };
    case "LOST_MODE_DISABLED":
      return {
        subject: `Lost Mode turned off for ${device}`,
        heading: `Lost Mode is off for ${device}`,
        paragraphs: [
          `Lost Mode was turned off${when ? ` at ${when}` : ""}.`,
          "If you did not do this, sign in and change your password.",
        ],
        button: { label: "Open device", url: deviceUrl },
        optOutFooter: true,
      };
    case "PAYMENT_RECEIVED":
      return {
        subject: amount ? `Payment received: ${amount}` : "Payment received",
        heading: "Payment received",
        paragraphs: [
          `Thank you. We received your payment${amount ? ` of ${amount}` : ""}${plan ? ` for FindIt ${plan}` : ""}.`,
          periodEnd ? `Your plan is paid through ${periodEnd} and renews automatically.` : "Your plan renews automatically each month.",
        ],
        button: { label: "View billing", url: `${siteUrl}/dashboard/billing` },
        optOutFooter: false,
      };
    case "PAYMENT_FAILED":
      return {
        subject: "Your FindIt payment failed",
        heading: "Your payment did not go through",
        paragraphs: [
          "PayFast could not take your latest monthly payment. It will try again, and your plan stays active for a few days in the meantime.",
          "To avoid losing access, update your card using the link in your PayFast receipt email.",
        ],
        button: { label: "View billing", url: `${siteUrl}/dashboard/billing` },
        optOutFooter: false,
      };
    case "SUBSCRIPTION_CANCELED":
      return {
        subject: "Your FindIt subscription was cancelled",
        heading: "Subscription cancelled",
        paragraphs: [
          periodEnd ? `Your subscription was cancelled. You keep access until ${periodEnd}.` : "Your subscription was cancelled.",
          "You can subscribe again at any time from the billing page.",
        ],
        button: { label: "View billing", url: `${siteUrl}/dashboard/billing` },
        optOutFooter: false,
      };
  }
}

export function renderEmail(kind: EmailKind, payload: Record<string, unknown> | null, siteUrl: string): RenderedEmail {
  const content = contentFor(kind, payload ?? {}, siteUrl);
  const footer = content.optOutFooter
    ? `You are receiving this because of activity on your FindIt account. You can turn device emails off in Settings: ${siteUrl}/dashboard/settings`
    : "You are receiving this because of activity on your FindIt account.";

  const text = [
    content.heading,
    "",
    ...content.paragraphs,
    ...(content.button ? ["", `${content.button.label}: ${content.button.url}`] : []),
    "",
    "--",
    footer,
  ].join("\n");

  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2b2f36">${escapeHtml(p)}</p>`)
    .join("");
  const button = content.button
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(content.button.url)}" style="display:inline-block;background:#62e6a8;color:#06100b;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">${escapeHtml(content.button.label)}</a></p>`
    : "";
  const optOut = content.optOutFooter
    ? ` <a href="${escapeHtml(`${siteUrl}/dashboard/settings`)}" style="color:#6b7280">Turn device emails off</a>.`
    : "";

  const html =
    `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px">` +
    `<tr><td style="padding:32px">` +
    `<div style="font-size:18px;font-weight:800;color:#06100b;margin-bottom:22px">Find<span style="color:#1f9d6b">It</span></div>` +
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827">${escapeHtml(content.heading)}</h1>` +
    paragraphs +
    button +
    `<p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#6b7280">You are receiving this because of activity on your FindIt account.${optOut}</p>` +
    `</td></tr></table></td></tr></table></body></html>`;

  return { subject: content.subject, text, html };
}

// ---- Sending (Resend) ----

export type SendOutcome = "sent" | "retry" | "config" | "permanent";

// Retry on throttling, timeouts and server errors. 401/403 mean our key or sending
// domain is wrong, so the whole run should stop rather than burn every email's attempts.
// Any other 4xx means this particular email will never succeed.
export function classifyStatus(status: number): SendOutcome {
  if (status >= 200 && status < 300) return "sent";
  if (status === 401 || status === 403) return "config";
  if (status === 408 || status === 429 || status >= 500) return "retry";
  return "permanent";
}

export function buildSendRequest(config: EmailConfig, outboxId: number, to: string, mail: RenderedEmail) {
  return {
    url: "https://api.resend.com/emails",
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        // The same outbox row can never produce two emails, even if we retry after a timeout.
        "Idempotency-Key": `findit-outbox-${outboxId}`,
      },
      body: JSON.stringify({ from: config.from, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
    },
  };
}

// ---- Draining the outbox ----

type RpcResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type OutboxAdmin = {
  rpc(fn: string, args?: Record<string, unknown>): RpcResult;
  auth: {
    admin: {
      getUserById(id: string): PromiseLike<{ data: { user: { email?: string | null } | null }; error: unknown }>;
    };
  };
};

export type FlushResult = {
  configured: boolean;
  claimed: number;
  sent: number;
  retrying: number;
  failed: number;
  stopped?: string;
};

export async function flushEmailOutbox(
  admin: OutboxAdmin,
  options: {
    limit?: number;
    env?: Record<string, string | undefined>;
    fetchImpl?: (url: string, init: unknown) => Promise<{ status: number }>;
  } = {},
): Promise<FlushResult> {
  const result: FlushResult = { configured: false, claimed: 0, sent: 0, retrying: 0, failed: 0 };
  const config = getEmailConfig(options.env ?? process.env);
  // Not configured: leave everything queued so nothing is lost before email is set up.
  if (!config) return result;
  result.configured = true;

  const doFetch =
    options.fetchImpl ??
    ((url: string, init: unknown) => fetch(url, { ...(init as RequestInit), signal: AbortSignal.timeout(15_000) }));

  const claim = await admin.rpc("claim_email_outbox", { p_limit: options.limit ?? 20 });
  if (claim.error) {
    result.stopped = "could not read the outbox";
    return result;
  }

  const rows = (claim.data as OutboxRow[] | null) ?? [];
  result.claimed = rows.length;
  const addressCache = new Map<string, string | null>();

  for (const row of rows) {
    if (result.stopped) break;

    let to = addressCache.get(row.owner_id);
    if (to === undefined) {
      const lookup = await admin.auth.admin.getUserById(row.owner_id);
      to = lookup.data?.user?.email ?? null;
      addressCache.set(row.owner_id, to);
    }

    if (!to) {
      await admin.rpc("finish_email", { p_id: row.id, p_error: "no email address on file", p_permanent: true });
      result.failed++;
      continue;
    }

    const mail = renderEmail(row.kind, row.payload, config.siteUrl);
    const request = buildSendRequest(config, row.id, to, mail);

    let outcome: SendOutcome;
    let detail = "";
    try {
      const response = await doFetch(request.url, request.init);
      outcome = classifyStatus(response.status);
      detail = `HTTP ${response.status}`;
    } catch (error) {
      outcome = "retry";
      detail = error instanceof Error ? error.message : "network error";
    }

    if (outcome === "sent") {
      await admin.rpc("finish_email", { p_id: row.id });
      result.sent++;
    } else if (outcome === "permanent") {
      await admin.rpc("finish_email", { p_id: row.id, p_error: detail, p_permanent: true });
      result.failed++;
    } else {
      await admin.rpc("finish_email", { p_id: row.id, p_error: detail });
      result.retrying++;
      if (outcome === "config") result.stopped = "email provider rejected our credentials or sending domain";
    }
  }

  return result;
}
