// Run with: node --test lib/payfast.test.mjs
// Plain .mjs so it stays out of the TypeScript build; Node 22 imports the .ts helpers directly.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  apiHeaders,
  apiSignature,
  buildCheckout,
  clientIp,
  getPayfastConfig,
  isPayfastSource,
  itnParamString,
  itnSignature,
  parseItnBody,
  phpUrlEncode,
  signCheckout,
  verifyItnSignature,
} from "./payfast.ts";

const md5 = (value) => createHash("md5").update(value).digest("hex");

const env = {
  PAYFAST_MERCHANT_ID: "10000100",
  PAYFAST_MERCHANT_KEY: "46f0cd694581a",
  PAYFAST_PASSPHRASE: "secret phrase!",
  NEXT_PUBLIC_SITE_URL: "https://findit.example/",
};

test("config: missing variables disable billing", () => {
  assert.equal(getPayfastConfig({}), null);
  assert.equal(getPayfastConfig({ ...env, NEXT_PUBLIC_SITE_URL: "" }), null);
});

test("config: defaults to sandbox and only goes live when explicitly asked", () => {
  assert.equal(getPayfastConfig(env).sandbox, true);
  assert.match(getPayfastConfig(env).processUrl, /sandbox\.payfast\.co\.za/);
  assert.equal(getPayfastConfig({ ...env, PAYFAST_MODE: "production" }).sandbox, true);
  const live = getPayfastConfig({ ...env, PAYFAST_MODE: "live" });
  assert.equal(live.sandbox, false);
  assert.match(live.processUrl, /^https:\/\/www\.payfast\.co\.za\//);
  assert.equal(live.siteUrl, "https://findit.example");
});

test("phpUrlEncode matches PHP urlencode()", () => {
  assert.equal(phpUrlEncode("a b"), "a+b");
  assert.equal(phpUrlEncode("it's (ok)!*~"), "it%27s+%28ok%29%21%2A%7E");
  assert.equal(phpUrlEncode("a@b.com"), "a%40b.com");
  assert.equal(phpUrlEncode("x-y_z.1"), "x-y_z.1");
});

test("checkout signature: order kept, empties dropped, passphrase appended", () => {
  const fields = [["merchant_id", "1"], ["empty", ""], ["item_name", " Test item "]];
  assert.equal(signCheckout(fields, ""), md5("merchant_id=1&item_name=Test+item"));
  assert.equal(signCheckout(fields, "pass word"), md5("merchant_id=1&item_name=Test+item&passphrase=pass+word"));
});

test("buildCheckout: monthly, until cancelled, amount from caller, signed", () => {
  const config = getPayfastConfig(env);
  const checkout = buildCheckout(config, {
    checkoutId: "11111111-1111-1111-1111-111111111111",
    plan: "PLUS",
    planLabel: "Plus",
    amountZar: 179,
    email: "owner@example.com",
    firstName: "",
  });
  const map = Object.fromEntries(checkout.fields);
  assert.equal(map.amount, "179.00");
  assert.equal(map.recurring_amount, "179.00");
  assert.equal(map.subscription_type, "1");
  assert.equal(map.frequency, "3");
  assert.equal(map.cycles, "0");
  assert.equal(map.m_payment_id, "11111111-1111-1111-1111-111111111111");
  assert.equal(map.notify_url, "https://findit.example/api/billing/payfast/notify");
  assert.equal("name_first" in map, false, "empty fields are not sent");
  // Signature covers exactly the fields that are sent, in the order they are sent.
  const sent = checkout.fields.filter(([name]) => name !== "signature");
  assert.equal(map.signature, signCheckout(sent, config.passphrase));
  assert.equal(checkout.fields.at(-1)[0], "signature");
  // Documented PayFast order: subscription_type precedes recurring_amount, frequency, cycles.
  const names = sent.map(([name]) => name);
  assert.ok(names.indexOf("amount") < names.indexOf("item_name"));
  assert.ok(names.indexOf("subscription_type") < names.indexOf("recurring_amount"));
  assert.ok(names.indexOf("recurring_amount") < names.indexOf("frequency"));
  assert.ok(names.indexOf("frequency") < names.indexOf("cycles"));
});

function signedItn(overrides = {}, passphrase = "secret phrase!") {
  const params = Object.entries({
    m_payment_id: "11111111-1111-1111-1111-111111111111",
    pf_payment_id: "1089250",
    payment_status: "COMPLETE",
    item_name: "FindIt Plus (monthly)",
    amount_gross: "179.00",
    name_first: "",
    token: "abc-123",
    merchant_id: "10000100",
    ...overrides,
  });
  const signature = itnSignature(params, passphrase);
  return new URLSearchParams([...params, ["signature", signature]]).toString();
}

test("ITN: genuine signature verifies, including empty values and spaces", () => {
  const params = parseItnBody(signedItn());
  assert.equal(verifyItnSignature(params, "secret phrase!"), true);
});

test("ITN: tampered amount, wrong passphrase, missing signature all fail", () => {
  const tampered = parseItnBody(signedItn().replace("179.00", "1.00"));
  assert.equal(verifyItnSignature(tampered, "secret phrase!"), false);
  assert.equal(verifyItnSignature(parseItnBody(signedItn()), "other"), false);
  const unsigned = parseItnBody(signedItn()).filter(([name]) => name !== "signature");
  assert.equal(verifyItnSignature(unsigned, "secret phrase!"), false);
});

test("ITN: param string excludes the signature and keeps received order", () => {
  const string = itnParamString(parseItnBody("b=2&a=1&signature=zzz"));
  assert.equal(string, "b=2&a=1");
});

test("ITN: no passphrase configured still verifies", () => {
  assert.equal(verifyItnSignature(parseItnBody(signedItn({}, "")), ""), true);
});

test("source check: only addresses PayFast resolves to are accepted", async () => {
  const resolver = async (host) => (host === "www.payfast.co.za" ? ["197.97.145.144"] : ["41.74.179.194"]);
  assert.equal(await isPayfastSource("197.97.145.144", resolver), true);
  assert.equal(await isPayfastSource("41.74.179.194", resolver), true);
  assert.equal(await isPayfastSource("203.0.113.9", resolver), false);
  assert.equal(await isPayfastSource("", resolver), false);
});

test("source check: fails closed when DNS fails", async () => {
  const resolver = async () => {
    throw new Error("ENOTFOUND");
  };
  assert.equal(await isPayfastSource("197.97.145.144", resolver), false);
});

test("clientIp: first forwarded address, else real-ip, else empty", () => {
  const headers = (map) => ({ get: (name) => map[name] ?? null });
  assert.equal(clientIp(headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  assert.equal(clientIp(headers({ "x-real-ip": " 9.9.9.9 " })), "9.9.9.9");
  assert.equal(clientIp(headers({})), "");
});

test("API signature: sorted by name, passphrase included", () => {
  const values = { version: "v1", "merchant-id": "10000100", timestamp: "2026-10-24T04:00:00" };
  assert.equal(
    apiSignature(values, "pass"),
    md5("merchant-id=10000100&passphrase=pass&timestamp=2026-10-24T04%3A00%3A00&version=v1"),
  );
});

test("API headers: Johannesburg local time, signed", () => {
  const config = getPayfastConfig(env);
  // 02:09 UTC is 04:09 in Johannesburg.
  const headers = apiHeaders(config, new Date("2026-10-24T02:09:05Z"));
  assert.equal(headers.timestamp, "2026-10-24T04:09:05");
  assert.equal(headers["merchant-id"], "10000100");
  const { signature, ...rest } = headers;
  assert.equal(signature, apiSignature(rest, config.passphrase));
});
