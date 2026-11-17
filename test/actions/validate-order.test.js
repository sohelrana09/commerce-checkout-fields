import { createSign, generateKeyPairSync } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import {
  createOrderValidator,
  orderFrom,
  orderValues,
} from "../../src/commerce-extensibility-1/actions/validate-order/handler.js";
import { main } from "../../src/commerce-extensibility-1/actions/validate-order/index.js";

const po = {
  code: "po_number",
  label: "PO number",
  required: true,
  type: "text",
  validation: { pattern: "PO-\\d+" },
};
const vat = {
  code: "vat_id",
  label: "VAT ID",
  required: true,
  scope: { storeViews: ["de"] },
  type: "text",
};
const wholesale = {
  code: "account_ref",
  label: "Account reference",
  required: true,
  scope: { customerGroups: ["2"] },
  type: "text",
};
const settings = {
  blockInvalidOrders: true,
  cacheSeconds: 300,
  fieldsEnabled: true,
};

function validator(overrides = {}) {
  return createOrderValidator({
    loadFields: async () => [po, vat, wholesale],
    loadSettings: async () => settings,
    now: () => Date.UTC(2026, 10, 17),
    storeCodeFor: async (id) => ({ 1: "default", 2: "de" })[id],
    ...overrides,
  });
}

const payload = (order) => ({ data: { order } });

describe("order payloads", () => {
  test("finds the order and its values in every shape", () => {
    expect(orderFrom({ order: { a: 1 } })).toEqual({ a: 1 });
    expect(orderFrom(undefined)).toEqual({});
    expect(
      orderValues({
        custom_attributes: [{ attribute_code: "a", value: "1" }],
        custom_attributes_serializable: '{"b":"2"}',
        extension_attributes: { custom_attributes: { c: "3" } },
      }),
    ).toEqual({ a: "1", b: "2", c: "3" });
  });
});

describe("validate order", () => {
  test("lets valid orders through", async () => {
    const result = await validator()(
      payload({
        custom_attributes_serializable: { po_number: "PO-12" },
        customer_group_id: 1,
        store_id: 1,
      }),
    );
    expect(result).toEqual({ status: "valid", valid: true });
  });

  test("blocks missing and invalid values for the order's scope", async () => {
    const result = await validator()(
      payload({
        custom_attributes_serializable: { po_number: "12" },
        customer_group_id: 2,
        store_id: 2,
      }),
    );
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual([
      "account_ref",
      "po_number",
      "vat_id",
    ]);
    expect(result.message).toContain("VAT ID is required.");
  });

  test("skips store-specific fields when the store view is unknown", async () => {
    const result = await validator({ storeCodeFor: async () => undefined })(
      payload({
        custom_attributes_serializable: { po_number: "PO-1" },
        store_id: 9,
      }),
    );
    expect(result.valid).toBe(true);
  });

  test("does nothing when switched off or with no fields", async () => {
    const off = validator({
      loadSettings: async () => ({ ...settings, blockInvalidOrders: false }),
    });
    expect((await off(payload({}))).status).toBe("off");
    const none = validator({ loadFields: async () => [] });
    expect((await none(payload({}))).status).toBe("no-fields");
  });
});

describe("validate-order action", () => {
  const fields = JSON.stringify([po]);
  const body = (order) => JSON.stringify(payload(order));

  test("answers success or exception operations", async () => {
    const ok = await main({
      __ow_body: body({
        custom_attributes_serializable: { po_number: "PO-1" },
      }),
      CHECKOUT_FIELDS: fields,
      LOG_LEVEL: "error",
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toEqual([{ op: "success" }]);

    const blocked = await main({
      __ow_body: body({}),
      CHECKOUT_FIELDS: fields,
      LOG_LEVEL: "error",
    });
    expect(blocked.body).toEqual([
      expect.objectContaining({
        message: "PO number is required.",
        op: "exception",
      }),
    ]);
  });

  test("lets orders through when the app fails", async () => {
    const response = await main({
      __ow_body: body({}),
      CHECKOUT_FIELDS: "{bad",
      LOG_LEVEL: "error",
    });
    expect(response.body).toEqual([{ op: "success" }]);
  });

  test("rejects unsigned requests once a public key is set", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" },
    });
    const raw = body({ custom_attributes_serializable: { po_number: "PO-1" } });
    const bad = await main({
      __ow_body: raw,
      CHECKOUT_FIELDS: fields,
      COMMERCE_WEBHOOKS_PUBLIC_KEY: publicKey,
      LOG_LEVEL: "error",
    });
    expect(bad.statusCode).toBe(401);
    const signer = createSign("SHA256");
    signer.update(raw);
    const good = await main({
      __ow_body: raw,
      __ow_headers: {
        "x-adobe-commerce-webhook-signature": signer.sign(privateKey, "base64"),
      },
      CHECKOUT_FIELDS: fields,
      COMMERCE_WEBHOOKS_PUBLIC_KEY: publicKey,
      LOG_LEVEL: "error",
    });
    expect(good.body).toEqual([{ op: "success" }]);
  });

  test("uses the logger it is given", async () => {
    const logger = { warn: vi.fn() };
    const run = validator({
      loadSettings: async (l) => {
        l.warn("x");
        return settings;
      },
    });
    await run(
      payload({
        custom_attributes_serializable: { po_number: "PO-1" },
        store_id: 1,
      }),
      {},
      logger,
    );
    expect(logger.warn).toHaveBeenCalledWith("x");
  });
});
