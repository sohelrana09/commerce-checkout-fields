import { describe, expect, test, vi } from "vitest";

import { createFieldsFeed } from "../../src/commerce-extensibility-1/actions/fields/handler.js";
import { main } from "../../src/commerce-extensibility-1/actions/fields/index.js";

const po = { code: "po_number", label: "PO number", type: "text" };
const de = { ...po, code: "vat_id", scope: { storeViews: ["de"] } };
const settings = {
  blockInvalidOrders: true,
  cacheSeconds: 120,
  fieldsEnabled: true,
};

describe("fields feed", () => {
  test("returns public fields for a store view with cache headers", async () => {
    const feed = createFieldsFeed({
      loadFields: async () => [po, de, { ...po, code: "off", enabled: false }],
      loadSettings: async () => settings,
    });
    const response = await feed({ store: "default" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("public, max-age=120");
    expect(response.body.fields.map((f) => f.code)).toEqual(["po_number"]);
    const all = await feed({ store: "bad store!" });
    expect(all.body.fields.map((f) => f.code)).toEqual(["po_number", "vat_id"]);
  });

  test("returns no fields when switched off", async () => {
    const loadFields = vi.fn();
    const feed = createFieldsFeed({
      loadFields,
      loadSettings: async () => ({ ...settings, fieldsEnabled: false }),
    });
    const response = await feed({});
    expect(response.body).toEqual({ enabled: false, fields: [] });
    expect(loadFields).not.toHaveBeenCalled();
  });

  test("main serves CHECKOUT_FIELDS and hides errors", async () => {
    const ok = await main({
      CHECKOUT_FIELDS: JSON.stringify([po]),
      LOG_LEVEL: "error",
    });
    expect(ok.body.fields).toHaveLength(1);
    const failed = await main({ CHECKOUT_FIELDS: "{bad", LOG_LEVEL: "error" });
    expect(failed.statusCode).toBe(500);
    expect(failed.body.error).toBe(
      "Checkout fields are unavailable right now.",
    );
  });
});
