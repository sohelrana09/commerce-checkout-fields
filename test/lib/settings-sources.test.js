import { describe, expect, test, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
} from "../../src/common/fields/settings.js";
import {
  fieldsFromInput,
  loadFields,
} from "../../src/common/fields/sources.js";

describe("parseSettings", () => {
  test("uses defaults for missing values", () => {
    expect(parseSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test("parses and clamps stored values", () => {
    expect(
      parseSettings([
        { name: "fieldsEnabled", value: "off" },
        { name: "blockInvalidOrders", value: "yes" },
        { name: "cacheSeconds", value: "999999" },
        { name: "ignored", value: null },
      ]),
    ).toEqual({
      blockInvalidOrders: true,
      cacheSeconds: 86_400,
      fieldsEnabled: false,
    });
    expect(
      parseSettings([
        { name: "fieldsEnabled", value: true },
        { name: "blockInvalidOrders", value: 0 },
        { name: "cacheSeconds", value: "" },
      ]),
    ).toEqual(DEFAULT_SETTINGS);
  });

  test("loadSettings gives defaults without stored configuration", async () => {
    const logger = { warn: vi.fn() };
    expect(await loadSettings(logger)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("field sources", () => {
  test("reads CHECKOUT_FIELDS in either shape", () => {
    expect(fieldsFromInput({})).toBeNull();
    expect(fieldsFromInput({ CHECKOUT_FIELDS: "  " })).toBeNull();
    expect(fieldsFromInput({ CHECKOUT_FIELDS: '[{"code":"a"}]' })).toEqual([
      { code: "a" },
    ]);
    expect(
      fieldsFromInput({ CHECKOUT_FIELDS: { fields: [{ code: "b" }] } }),
    ).toEqual([{ code: "b" }]);
    expect(() => fieldsFromInput({ CHECKOUT_FIELDS: "{nope" })).toThrow(
      "not valid JSON",
    );
    expect(() => fieldsFromInput({ CHECKOUT_FIELDS: "{}" })).toThrow(
      "must be an array",
    );
  });

  test("prefers the input over the database", async () => {
    expect(await loadFields({ CHECKOUT_FIELDS: "[]" })).toEqual([]);
  });
});
