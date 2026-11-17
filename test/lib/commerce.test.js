import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  clearStoresCache,
  findOrders,
  getOrder,
  listCustomerGroups,
  listStoreViews,
  orderAttributes,
  STORES_CACHE_MS,
  storeCodeFor,
} from "../../src/common/fields/commerce.js";

function fakeCommerce(routes) {
  const get = vi.fn((path, options) => ({
    json: async () => {
      const handler = routes[path];
      if (typeof handler === "function") {
        return handler(options);
      }
      if (handler === undefined) {
        throw new Error(`no route ${path}`);
      }
      return handler;
    },
  }));
  return { get };
}

const stores = [
  { code: "admin", id: 0, name: "Admin" },
  { code: "default", id: 1, name: "Default Store View" },
  { code: "de", id: "2", name: "German" },
];

describe("commerce lookups", () => {
  beforeEach(() => clearStoresCache());

  test("lists store views without the admin store", async () => {
    const commerce = fakeCommerce({ "store/storeViews": stores });
    expect(await listStoreViews(commerce)).toEqual([
      { code: "default", id: 1, label: "Default Store View" },
      { code: "de", id: 2, label: "German" },
    ]);
    expect(
      await listStoreViews(fakeCommerce({ "store/storeViews": null })),
    ).toEqual([]);
  });

  test("lists customer groups", async () => {
    const commerce = fakeCommerce({
      "customerGroups/search": {
        items: [
          { code: "NOT LOGGED IN", id: 0 },
          { code: "Wholesale", id: 2 },
        ],
      },
    });
    expect(await listCustomerGroups(commerce)).toEqual([
      { id: "0", label: "NOT LOGGED IN" },
      { id: "2", label: "Wholesale" },
    ]);
    expect(
      await listCustomerGroups(fakeCommerce({ "customerGroups/search": {} })),
    ).toEqual([]);
  });

  test("maps store IDs to codes with a cache", async () => {
    const commerce = fakeCommerce({ "store/storeViews": stores });
    const getCommerce = vi.fn(async () => commerce);
    const now = 1000;
    expect(await storeCodeFor(2, getCommerce, { now })).toBe("de");
    expect(await storeCodeFor("1", getCommerce, { now: now + 1 })).toBe(
      "default",
    );
    expect(getCommerce).toHaveBeenCalledTimes(1);
    await storeCodeFor(1, getCommerce, { now: now + STORES_CACHE_MS + 1 });
    expect(getCommerce).toHaveBeenCalledTimes(2);
    expect(await storeCodeFor(undefined, getCommerce)).toBeUndefined();
    expect(await storeCodeFor("", getCommerce)).toBeUndefined();
  });

  test("resolves to undefined when Commerce is down", async () => {
    const logger = { warn: vi.fn() };
    const getCommerce = async () => {
      throw new Error("down");
    };
    expect(await storeCodeFor(1, getCommerce, { logger })).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith("Store views unavailable: down");
  });

  test("reads order custom attributes in REST shapes", () => {
    expect(
      orderAttributes({
        custom_attributes: [{ attribute_code: "po_number", value: "PO-1" }],
        extension_attributes: { custom_attributes: { notes: "x" } },
      }),
    ).toEqual({ notes: "x", po_number: "PO-1" });
    expect(orderAttributes(undefined)).toEqual({});
  });

  test("gets one order", async () => {
    const commerce = fakeCommerce({ "orders/5": { entity_id: 5 } });
    expect(await getOrder(commerce, 5)).toEqual({ entity_id: 5 });
  });

  test("finds orders by entity or increment ID", async () => {
    const commerce = fakeCommerce({
      orders: (options) => {
        expect(options.searchParams["searchCriteria[pageSize]"]).toBe("3");
        return {
          items: [
            { entity_id: 1, increment_id: "000000001" },
            { entity_id: 7, increment_id: "000000007" },
          ],
        };
      },
    });
    const orders = await findOrders(commerce, ["1", "000000007", "9"]);
    expect([...orders.keys()].sort()).toEqual(["000000007", "1"]);
    const none = await findOrders(fakeCommerce({ orders: {} }), ["1"]);
    expect(none.size).toBe(0);
  });
});
