import { describe, expect, test, vi } from "vitest";

import { createHandlers } from "../../src/commerce-backend-ui-2/actions/handlers.js";
import { adminAction } from "../../src/commerce-backend-ui-2/actions/http.js";
import { main as lookupsMain } from "../../src/commerce-backend-ui-2/actions/lookups/index.js";
import { FieldValidationError } from "../../src/common/fields/fields-repo.js";

const logger = { error: vi.fn(), warn: vi.fn() };

function commerceWith(routes) {
  return {
    get: (path) => ({
      json: async () => {
        if (!(path in routes)) {
          throw new Error(`no route ${path}`);
        }
        return routes[path];
      },
    }),
  };
}

describe("admin handlers", () => {
  test("fieldsList returns fields and switched-off examples", async () => {
    const handlers = createHandlers({
      listFields: async () => [{ code: "a" }],
    });
    const response = await handlers.fieldsList({}, {});
    expect(response.body.fields).toEqual([{ code: "a" }]);
    expect(response.body.examples.length).toBeGreaterThan(4);
    expect(response.body.examples.every((f) => f.enabled === false)).toBe(true);
  });

  test("fieldSave validates input and passes the previous code", async () => {
    const saveField = vi.fn(async (field) => field);
    const handlers = createHandlers({ saveField });
    await expect(handlers.fieldSave({}, {})).rejects.toBeInstanceOf(
      FieldValidationError,
    );
    const response = await handlers.fieldSave(
      { field: { code: "new" }, previousCode: "old" },
      {},
    );
    expect(response.body.field).toEqual({ code: "new" });
    expect(saveField).toHaveBeenCalledWith(
      { code: "new" },
      {},
      { previousCode: "old" },
    );
  });

  test("fieldDelete answers 404 for a missing field", async () => {
    const handlers = createHandlers({
      deleteField: async (code) => code === "a",
    });
    expect((await handlers.fieldDelete({ code: "a" }, {})).statusCode).toBe(
      200,
    );
    expect((await handlers.fieldDelete({ code: "b" }, {})).statusCode).toBe(
      404,
    );
    await expect(handlers.fieldDelete({}, {})).rejects.toBeInstanceOf(
      FieldValidationError,
    );
  });

  test("lookups loads store views and customer groups, or degrades", async () => {
    const handlers = createHandlers({
      getCommerce: async () =>
        commerceWith({
          "customerGroups/search": { items: [{ code: "General", id: 1 }] },
          "store/storeViews": [{ code: "default", id: 1, name: "Default" }],
        }),
    });
    const response = await handlers.lookups({}, {}, logger);
    expect(response.body).toEqual({
      customerGroups: [{ id: "1", label: "General" }],
      storeViews: [{ code: "default", id: 1, label: "Default" }],
    });
    const down = createHandlers({
      getCommerce: async () => {
        throw new Error("down");
      },
    });
    expect((await down.lookups({}, {}, logger)).body.unavailable).toBe(true);
  });

  test("orderValues describes an order's custom attributes", async () => {
    const handlers = createHandlers({
      getCommerce: async () =>
        commerceWith({
          "orders/12": {
            custom_attributes: [
              { attribute_code: "po_number", value: "PO-1" },
              { attribute_code: "old", value: "kept" },
            ],
            increment_id: "000000012",
          },
        }),
      listFields: async () => [
        { code: "po_number", label: "PO number", type: "text" },
      ],
    });
    const response = await handlers.orderValues({ orderId: "12" }, {});
    expect(response.body).toEqual({
      incrementId: "000000012",
      orderId: "12",
      values: [
        { code: "po_number", label: "PO number", value: "PO-1" },
        { code: "old", label: "old", value: "kept" },
      ],
    });
    await expect(
      handlers.orderValues({ orderId: "../x" }, {}),
    ).rejects.toBeInstanceOf(FieldValidationError);
  });
});

describe("adminAction", () => {
  test("maps validation errors to 400 and others to 500", async () => {
    const invalid = adminAction("x", async () => {
      throw new FieldValidationError(["bad"]);
    });
    expect((await invalid({ LOG_LEVEL: "error" })).statusCode).toBe(400);
    const broken = adminAction("x", async () => {
      throw new Error("secret detail");
    });
    const response = await broken({ LOG_LEVEL: "error" });
    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("secret detail");
    const ok = adminAction("x", async (body) => ({ body, statusCode: 200 }));
    expect((await ok({ body: '{"a":1}' })).body).toEqual({ a: 1 });
  });

  test("the lookups entry point degrades without credentials", async () => {
    const response = await lookupsMain({ LOG_LEVEL: "error" });
    expect(response.body.unavailable).toBe(true);
  });
});
