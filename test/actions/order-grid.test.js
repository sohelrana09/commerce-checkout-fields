import { describe, expect, test } from "vitest";

import {
  COLUMN,
  createOrderGrid,
  summarise,
} from "../../src/commerce-extensibility-1/actions/order-grid/handler.js";
import { main } from "../../src/commerce-extensibility-1/actions/order-grid/index.js";

const fields = [
  { code: "po_number", label: "PO number", sortOrder: 1, type: "text" },
  { code: "is_gift", label: "Gift", sortOrder: 2, type: "checkbox" },
];

describe("order grid column", () => {
  test("summarises values on one line and truncates long ones", () => {
    expect(summarise(fields, { is_gift: "1", po_number: "PO-1" })).toBe(
      "PO number: PO-1; Gift: Yes",
    );
    expect(summarise(fields, { po_number: "a\n b" })).toBe("PO number: a b");
    const long = summarise(fields, { po_number: "x".repeat(600) });
    expect(long).toHaveLength(500);
    expect(long.endsWith("…")).toBe(true);
  });

  test("returns one cell per requested order", async () => {
    const commerce = {
      get: () => ({
        json: async () => ({
          items: [
            {
              custom_attributes: [
                { attribute_code: "po_number", value: "PO-9" },
              ],
              entity_id: 9,
              increment_id: "000000009",
            },
          ],
        }),
      }),
    };
    const grid = createOrderGrid({
      getCommerce: async () => commerce,
      loadFields: async () => fields,
    });
    expect(await grid(["9", "10"], {})).toEqual({
      9: { [COLUMN]: "PO number: PO-9" },
      10: { [COLUMN]: "" },
    });
  });

  test("main rejects bad requests and hides failures", async () => {
    const bad = await main({ LOG_LEVEL: "error" });
    expect(bad.error.statusCode).toBe(400);
    const failed = await main({
      CHECKOUT_FIELDS: "{bad",
      gridType: "order",
      ids: ["1"],
      LOG_LEVEL: "error",
      requestId: "r1",
    });
    expect(failed.error.statusCode).toBe(500);
    expect(failed.error.body.message).toBe(
      "Checkout field values are unavailable.",
    );
  });
});
