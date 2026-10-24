// Run with: node --test lib/email.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSendRequest,
  classifyStatus,
  escapeHtml,
  flushEmailOutbox,
  getEmailConfig,
  renderEmail,
} from "./email.ts";

const env = {
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "FindIt <alerts@findit.example>",
  NEXT_PUBLIC_SITE_URL: "https://findit.example/",
};
const SITE = "https://findit.example";

test("config: needs key, sender and site url", () => {
  assert.equal(getEmailConfig({}), null);
  assert.equal(getEmailConfig({ ...env, EMAIL_FROM: "" }), null);
  assert.equal(getEmailConfig({ ...env, RESEND_API_KEY: undefined }), null);
  assert.equal(getEmailConfig(env).siteUrl, SITE);
});

test("escapeHtml covers the characters that matter", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("device names cannot inject markup into the html body", () => {
  const evil = `<img src=x onerror=alert(1)>"><script>alert(2)</script>`;
  const mail = renderEmail("DEVICE_RECONNECTED", { device_name: evil, device_id: "d-1" }, SITE);
  assert.equal(mail.html.includes("<script>"), false);
  assert.equal(mail.html.includes("<img src=x"), false);
  assert.ok(mail.html.includes("&lt;script&gt;"));
  // Plain text part is not HTML, so it keeps the literal name.
  assert.ok(mail.text.includes(evil));
});

test("device id in links is URL-encoded", () => {
  const mail = renderEmail("DEVICE_RECONNECTED", { device_name: "Phone", device_id: "a b/../c" }, SITE);
  assert.ok(mail.text.includes(`${SITE}/dashboard/devices/a%20b%2F..%2Fc`));
});

test("every kind renders a subject, text and html with a link back to the site", () => {
  const kinds = [
    "DEVICE_RECONNECTED",
    "DEVICE_WENT_OFFLINE",
    "LOST_MODE_ENABLED",
    "LOST_MODE_DISABLED",
    "PAYMENT_RECEIVED",
    "PAYMENT_FAILED",
    "SUBSCRIPTION_CANCELED",
  ];
  for (const kind of kinds) {
    const mail = renderEmail(kind, { device_name: "My Phone", device_id: "d-1", amount: 179, plan: "PLUS" }, SITE);
    assert.ok(mail.subject.length > 0, kind);
    assert.ok(mail.text.includes(SITE), `${kind} text has a link`);
    assert.ok(mail.html.includes(`href="${SITE}`), `${kind} html has a link`);
  }
});

test("device emails offer the opt-out, billing emails do not", () => {
  const device = renderEmail("DEVICE_RECONNECTED", { device_name: "Phone" }, SITE);
  assert.ok(device.text.includes(`${SITE}/dashboard/settings`));
  assert.ok(device.html.includes("Turn device emails off"));
  for (const kind of ["PAYMENT_RECEIVED", "PAYMENT_FAILED", "SUBSCRIPTION_CANCELED"]) {
    const mail = renderEmail(kind, {}, SITE);
    assert.equal(mail.text.includes("/dashboard/settings"), false, kind);
    assert.equal(mail.html.includes("Turn device emails off"), false, kind);
  }
});

test("payment receipt shows amount, plan and a Johannesburg-local date", () => {
  const mail = renderEmail(
    "PAYMENT_RECEIVED",
    { amount: 179, plan: "PLUS", period_end: "2026-11-24T22:30:00Z" },
    SITE,
  );
  assert.equal(mail.subject, "Payment received: R179.00");
  assert.ok(mail.text.includes("FindIt Plus"));
  // 22:30 UTC on the 24th is 00:30 on the 25th in South Africa.
  assert.ok(mail.text.includes("25 Nov 2026"), mail.text);
});

test("missing or malformed payload fields degrade gracefully", () => {
  const mail = renderEmail("PAYMENT_RECEIVED", { amount: "oops", period_end: "not a date" }, SITE);
  assert.equal(mail.subject, "Payment received");
  assert.equal(mail.text.includes("undefined"), false);
  assert.equal(mail.text.includes("Invalid"), false);
  assert.equal(renderEmail("DEVICE_WENT_OFFLINE", null, SITE).subject, "Your device went offline");
});

test("status classification", () => {
  assert.equal(classifyStatus(200), "sent");
  assert.equal(classifyStatus(202), "sent");
  assert.equal(classifyStatus(401), "config");
  assert.equal(classifyStatus(403), "config");
  for (const status of [408, 429, 500, 502, 503]) assert.equal(classifyStatus(status), "retry", String(status));
  for (const status of [400, 404, 422]) assert.equal(classifyStatus(status), "permanent", String(status));
});

test("send request: auth, idempotency key and body", () => {
  const config = getEmailConfig(env);
  const mail = renderEmail("DEVICE_RECONNECTED", { device_name: "Phone" }, SITE);
  const { url, init } = buildSendRequest(config, 42, "owner@example.com", mail);
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, "Bearer re_test_key");
  assert.equal(init.headers["Idempotency-Key"], "findit-outbox-42");
  const body = JSON.parse(init.body);
  assert.deepEqual(body.to, ["owner@example.com"]);
  assert.equal(body.from, "FindIt <alerts@findit.example>");
  assert.equal(body.subject, "Phone is back online");
});

// ---- outbox drain, against a fake database and a fake provider ----

function fakeAdmin(rows, { emails = {}, claimError = null } = {}) {
  const calls = [];
  const lookups = [];
  return {
    calls,
    lookups,
    rpc(fn, args) {
      calls.push([fn, args]);
      if (fn === "claim_email_outbox") {
        return Promise.resolve(claimError ? { data: null, error: { message: claimError } } : { data: rows, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      admin: {
        getUserById(id) {
          lookups.push(id);
          return Promise.resolve({ data: { user: id in emails ? { email: emails[id] } : null }, error: null });
        },
      },
    },
  };
}

const row = (id, owner = "u1", kind = "DEVICE_RECONNECTED") => ({ id, owner_id: owner, kind, payload: { device_name: "Phone", device_id: "d1" } });
const finishes = (admin) => admin.calls.filter(([fn]) => fn === "finish_email").map(([, args]) => args);
const fetchWith = (...statuses) => {
  const seen = [];
  const impl = async (url, init) => {
    seen.push({ url, init });
    const next = statuses.length > 1 ? statuses.shift() : statuses[0];
    if (next instanceof Error) throw next;
    return { status: next };
  };
  impl.seen = seen;
  return impl;
};

test("flush: nothing is sent or touched when email is not configured", async () => {
  const admin = fakeAdmin([row(1)], { emails: { u1: "a@example.com" } });
  const fetchImpl = fetchWith(200);
  const result = await flushEmailOutbox(admin, { env: {}, fetchImpl });
  assert.equal(result.configured, false);
  assert.equal(admin.calls.length, 0, "rows stay queued, not even claimed");
  assert.equal(fetchImpl.seen.length, 0);
});

test("flush: sends each row once, looks up each owner once, marks rows sent", async () => {
  const admin = fakeAdmin([row(1), row(2), row(3, "u2")], { emails: { u1: "a@example.com", u2: "b@example.com" } });
  const fetchImpl = fetchWith(200);
  const result = await flushEmailOutbox(admin, { env, fetchImpl });
  assert.deepEqual([result.claimed, result.sent, result.retrying, result.failed], [3, 3, 0, 0]);
  assert.deepEqual(admin.lookups, ["u1", "u2"]);
  assert.deepEqual(finishes(admin), [{ p_id: 1 }, { p_id: 2 }, { p_id: 3 }]);
  assert.deepEqual(fetchImpl.seen.map((s) => JSON.parse(s.init.body).to[0]), ["a@example.com", "a@example.com", "b@example.com"]);
});

test("flush: throttling and server errors are retried, bad requests are not", async () => {
  const admin = fakeAdmin([row(1), row(2), row(3)], { emails: { u1: "a@example.com" } });
  const result = await flushEmailOutbox(admin, { env, fetchImpl: fetchWith(429, 422, 503) });
  assert.deepEqual([result.sent, result.retrying, result.failed], [0, 2, 1]);
  const [a, b, c] = finishes(admin);
  assert.deepEqual(a, { p_id: 1, p_error: "HTTP 429" });
  assert.deepEqual(b, { p_id: 2, p_error: "HTTP 422", p_permanent: true });
  assert.deepEqual(c, { p_id: 3, p_error: "HTTP 503" });
});

test("flush: a network error is retried", async () => {
  const admin = fakeAdmin([row(1)], { emails: { u1: "a@example.com" } });
  const result = await flushEmailOutbox(admin, { env, fetchImpl: fetchWith(new Error("socket hang up")) });
  assert.equal(result.retrying, 1);
  assert.deepEqual(finishes(admin), [{ p_id: 1, p_error: "socket hang up" }]);
});

test("flush: rejected credentials stop the run instead of burning every email", async () => {
  const admin = fakeAdmin([row(1), row(2), row(3)], { emails: { u1: "a@example.com" } });
  const fetchImpl = fetchWith(403);
  const result = await flushEmailOutbox(admin, { env, fetchImpl });
  assert.equal(fetchImpl.seen.length, 1, "only the first send is attempted");
  assert.equal(result.retrying, 1);
  assert.match(result.stopped, /credentials or sending domain/);
  assert.equal(finishes(admin).length, 1, "the other rows are left to their lease");
});

test("flush: an owner with no email address is a permanent failure and sends nothing", async () => {
  const admin = fakeAdmin([row(1, "ghost")], { emails: {} });
  const fetchImpl = fetchWith(200);
  const result = await flushEmailOutbox(admin, { env, fetchImpl });
  assert.equal(result.failed, 1);
  assert.equal(fetchImpl.seen.length, 0);
  assert.deepEqual(finishes(admin), [{ p_id: 1, p_error: "no email address on file", p_permanent: true }]);
});

test("flush: a database error reading the outbox is reported, not thrown", async () => {
  const admin = fakeAdmin([], { claimError: "boom" });
  const result = await flushEmailOutbox(admin, { env, fetchImpl: fetchWith(200) });
  assert.equal(result.stopped, "could not read the outbox");
});
