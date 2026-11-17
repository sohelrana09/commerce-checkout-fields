/**
 * Reading and verifying Commerce webhook requests.
 *
 * The validate-order action runs as a raw-http web action, so the exact bytes Commerce signed
 * reach it in `__ow_body`. When a public key is configured (COMMERCE_WEBHOOKS_PUBLIC_KEY, from
 * Stores > Configuration > Adobe Services > Webhooks), every request must carry a valid
 * `x-adobe-commerce-webhook-signature` (RSA-SHA256, base64) or it is rejected.
 */

import { createVerify } from "node:crypto";

const BASE64 = /^[A-Za-z0-9+/=\s]+$/u;
const ESCAPED_NEWLINE = /\\n/gu;
const WHITESPACE = /\s+/gu;
const PEM_LINE = /.{1,64}/gu;
const PEM =
  /^(?<begin>-----BEGIN [A-Z ]+-----)\s*(?<body>[\s\S]+?)\s*(?<end>-----END [A-Z ]+-----)$/u;

/** The raw request body as text. I/O Runtime base64-encodes some raw-http bodies. */
export function rawBody(params = {}) {
  const body = params.__ow_body;
  if (typeof body !== "string" || body === "") {
    return "";
  }
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return body;
  }
  if (BASE64.test(trimmed)) {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    const [start] = decoded.trim();
    if (start === "{" || start === "[") {
      return decoded;
    }
  }
  return body;
}

/** The webhook payload, whether the platform parsed it into params or passed it raw. */
export function webhookPayload(params = {}) {
  const raw = rawBody(params);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  const {
    __ow_body: _b,
    __ow_headers: _h,
    __ow_method: _m,
    __ow_path: _p,
    __ow_query: _q,
    ...rest
  } = params;
  return rest;
}

function header(params, name) {
  const headers = params.__ow_headers ?? {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

/** Restores the PEM line breaks that environment variables often lose. */
export function normalisePublicKey(key) {
  const text = String(key ?? "")
    .replace(ESCAPED_NEWLINE, "\n")
    .trim();
  if (!text || text.includes("\n")) {
    return text;
  }
  const match = PEM.exec(text);
  if (!match?.groups) {
    return text;
  }
  const { begin, body, end } = match.groups;
  const lines = body.replace(WHITESPACE, "").match(PEM_LINE) ?? [];
  return [begin, ...lines, end].join("\n");
}

export function verifySignature(body, signature, publicKey) {
  if (!(body && signature && publicKey)) {
    return false;
  }
  try {
    const verifier = createVerify("SHA256");
    verifier.update(body);
    verifier.end();
    return verifier.verify(normalisePublicKey(publicKey), signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Whether the request may be processed: always when no public key is configured (App
 * Management's Adobe IMS check still applies), otherwise only with a valid signature.
 */
export function isTrustedWebhook(params = {}) {
  const publicKey = params.COMMERCE_WEBHOOKS_PUBLIC_KEY;
  if (!publicKey) {
    return true;
  }
  return verifySignature(
    rawBody(params),
    header(params, "x-adobe-commerce-webhook-signature"),
    publicKey,
  );
}
