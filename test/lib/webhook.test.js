import { createSign, generateKeyPairSync } from "node:crypto";

import { describe, expect, test } from "vitest";

import {
  isTrustedWebhook,
  normalisePublicKey,
  rawBody,
  verifySignature,
  webhookPayload,
} from "../../src/common/webhook.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { format: "pem", type: "spki" },
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
});

function sign(text) {
  const signer = createSign("SHA256");
  signer.update(text);
  return signer.sign(privateKey, "base64");
}

const body = JSON.stringify({ data: { order: { store_id: 1 } } });

describe("webhook bodies", () => {
  test("reads raw, base64 and parsed bodies", () => {
    expect(rawBody({ __ow_body: body })).toBe(body);
    expect(rawBody({ __ow_body: Buffer.from(body).toString("base64") })).toBe(
      body,
    );
    expect(rawBody({ __ow_body: "plain text" })).toBe("plain text");
    expect(rawBody({ __ow_body: "abcd" })).toBe("abcd");
    expect(rawBody({})).toBe("");
    expect(webhookPayload({ __ow_body: body })).toEqual({
      data: { order: { store_id: 1 } },
    });
    expect(webhookPayload({ __ow_body: "not json" })).toEqual({});
    expect(
      webhookPayload({
        __ow_headers: {},
        __ow_method: "post",
        data: { order: {} },
      }),
    ).toEqual({ data: { order: {} } });
  });
});

describe("signatures", () => {
  test("verifies a Commerce signature", () => {
    expect(verifySignature(body, sign(body), publicKey)).toBe(true);
    expect(verifySignature(`${body} `, sign(body), publicKey)).toBe(false);
    expect(verifySignature(body, "", publicKey)).toBe(false);
    expect(verifySignature(body, sign(body), "not a key")).toBe(false);
  });

  test("restores PEM keys flattened into one line", () => {
    const flat = publicKey.replace(/\n/gu, "");
    expect(normalisePublicKey(flat)).toBe(publicKey.trim());
    expect(normalisePublicKey(publicKey.replace(/\n/gu, "\\n"))).toBe(
      publicKey.trim(),
    );
    expect(normalisePublicKey("garbage")).toBe("garbage");
    expect(normalisePublicKey(undefined)).toBe("");
    expect(verifySignature(body, sign(body), flat)).toBe(true);
  });

  test("trusts requests only with a valid signature once a key is set", () => {
    expect(isTrustedWebhook({})).toBe(true);
    const headers = { "X-Adobe-Commerce-Webhook-Signature": sign(body) };
    expect(
      isTrustedWebhook({
        __ow_body: body,
        __ow_headers: headers,
        COMMERCE_WEBHOOKS_PUBLIC_KEY: publicKey,
      }),
    ).toBe(true);
    expect(
      isTrustedWebhook({
        __ow_body: body,
        COMMERCE_WEBHOOKS_PUBLIC_KEY: publicKey,
      }),
    ).toBe(false);
  });
});
