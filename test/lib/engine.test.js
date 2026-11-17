import { describe, expect, it } from "vitest";

import {
  compilePattern,
  defaultValue,
  describeValues,
  fieldsFor,
  formatValue,
  inScope,
  isDateSpec,
  isIsoDate,
  normaliseValue,
  parseCustomAttributes,
  patternProblem,
  publicFields,
  resolveDate,
  sortFields,
  toAttributeValue,
  toCustomAttributes,
  today,
  toList,
  validateDefinitions,
  validateField,
  validateValue,
  validateValues,
  visibleFields,
} from "#engine";

const po = {
  code: "po_number",
  enabled: true,
  label: "PO number",
  placement: "review",
  required: true,
  type: "text",
  validation: {
    maxLength: 20,
    minLength: 3,
    pattern: "[A-Z0-9-]+",
    patternMessage: "Use capitals, digits and dashes.",
  },
};
const notes = {
  code: "delivery_notes",
  label: "Delivery notes",
  placement: "shipping",
  type: "textarea",
  validation: { maxLength: 10 },
};
const gift = { code: "is_gift", label: "This is a gift", type: "checkbox" };
const message = {
  code: "gift_message",
  conditions: [{ field: "is_gift", operator: "checked" }],
  label: "Gift message",
  required: true,
  type: "textarea",
};
const source = {
  code: "heard_from",
  default: "search",
  label: "How did you hear about us?",
  options: [
    { label: "Search engine", value: "search" },
    { label: "A friend", value: "friend" },
    { value: "other" },
  ],
  type: "select",
};
const sourceOther = {
  code: "heard_other",
  conditions: [{ field: "heard_from", operator: "eq", value: "other" }],
  label: "Tell us more",
  type: "text",
};
const delivery = {
  code: "delivery_date",
  label: "Delivery date",
  type: "date",
  validation: { maxDate: "today+30", minDate: "today+2" },
};
const vat = {
  code: "vat_id",
  label: "VAT ID",
  scope: { customerGroups: ["2"], storeViews: ["de", "fr"] },
  type: "text",
};
const ALL = [po, notes, gift, message, source, sourceOther, delivery, vat];

describe("toList", () => {
  it("splits text and arrays", () => {
    expect(toList("a, b,,c")).toEqual(["a", "b", "c"]);
    expect(toList([" x ", "", 3])).toEqual(["x", "3"]);
    expect(toList(undefined)).toEqual([]);
    expect(toList("")).toEqual([]);
  });
});

describe("patterns", () => {
  it("accepts ordinary patterns and anchors them", () => {
    expect(patternProblem("[A-Z]{2}\\d+")).toBeNull();
    const regex = compilePattern("[A-Z]{2}");
    expect(regex.test("AB")).toBe(true);
    expect(regex.test("ABC")).toBe(false);
  });

  it("rejects risky or broken patterns", () => {
    expect(patternProblem("")).toMatch(/non-empty/u);
    expect(patternProblem(42)).toMatch(/non-empty/u);
    expect(patternProblem("a".repeat(201))).toMatch(/at most/u);
    expect(patternProblem("(a+)+")).toMatch(/nest/u);
    expect(patternProblem("(\\w*)*$")).toMatch(/nest/u);
    expect(patternProblem("(a{1,3}){2,}")).toMatch(/nest/u);
    expect(patternProblem("(a)\\1")).toMatch(/backreferences/u);
    expect(patternProblem("[")).toMatch(/not a valid/u);
    expect(compilePattern("(a+)+")).toBeNull();
  });
});

describe("dates", () => {
  it("checks ISO dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-02-01")).toBe(false);
    expect(isIsoDate(20_260_101)).toBe(false);
  });

  it("checks and resolves date limits", () => {
    expect(isDateSpec("today")).toBe(true);
    expect(isDateSpec("today+3")).toBe(true);
    expect(isDateSpec("today-1")).toBe(true);
    expect(isDateSpec("today+9999")).toBe(false);
    expect(isDateSpec("2026-01-01")).toBe(true);
    expect(isDateSpec("tomorrow")).toBe(false);
    expect(isDateSpec(3)).toBe(false);
    expect(resolveDate("today", "2026-12-30")).toBe("2026-12-30");
    expect(resolveDate("today+3", "2026-12-30")).toBe("2027-01-02");
    expect(resolveDate("today-1", "2026-03-01")).toBe("2026-02-28");
    expect(resolveDate("2026-05-05", "2026-01-01")).toBe("2026-05-05");
    expect(resolveDate("soon", "2026-01-01")).toBeNull();
    expect(resolveDate(undefined, "2026-01-01")).toBeNull();
  });

  it("gives today in UTC or a time zone", () => {
    const now = Date.UTC(2026, 10, 17, 23, 30);
    expect(today(now)).toBe("2026-11-17");
    expect(today(now, "Asia/Dhaka")).toBe("2026-11-18");
    expect(today(now, "Not/AZone")).toBe("2026-11-17");
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});

describe("validateField", () => {
  it("accepts every example field", () => {
    const codes = new Set(ALL.map((field) => field.code));
    for (const field of ALL) {
      expect(validateField(field, { codes })).toEqual([]);
    }
  });

  it("rejects things that aren't fields", () => {
    expect(validateField(null)).toEqual(["field must be an object"]);
    expect(validateField([])).toEqual(["field must be an object"]);
  });

  it("checks the basics", () => {
    const errors = validateField({
      code: "1bad",
      enabled: "yes",
      help: "x".repeat(300),
      label: "",
      placement: "sidebar",
      sortOrder: "first",
      type: "radio",
    });
    expect(errors.join("\n")).toMatch(/code must start/u);
    expect(errors.join("\n")).toMatch(/label must be/u);
    expect(errors.join("\n")).toMatch(/type must be/u);
    expect(errors.join("\n")).toMatch(/placement must be/u);
    expect(errors.join("\n")).toMatch(/enabled must be true or false/u);
    expect(errors.join("\n")).toMatch(/sortOrder must be a number/u);
    expect(errors.join("\n")).toMatch(/help must be text/u);
  });

  it("checks text validation", () => {
    const base = { code: "a", label: "A", type: "text" };
    expect(validateField({ ...base, validation: "x" })).toEqual([
      "validation must be an object",
    ]);
    expect(
      validateField({ ...base, validation: { maxLength: 0, minLength: -1 } }),
    ).toHaveLength(2);
    expect(
      validateField({ ...base, validation: { maxLength: 2, minLength: 5 } }),
    ).toEqual(["minLength must not be more than maxLength"]);
    expect(
      validateField({ ...base, validation: { pattern: "(a+)+" } }),
    ).toEqual(["pattern must not nest quantifiers or use backreferences"]);
    expect(validateField({ ...base, validation: { pattern: "" } })).toEqual([]);
    expect(
      validateField({ ...base, validation: { patternMessage: 5 } }),
    ).toHaveLength(1);
  });

  it("checks date limits", () => {
    const base = { code: "d", label: "D", type: "date" };
    expect(validateField({ ...base, validation: { minDate: "soon" } })).toEqual(
      ['minDate must be YYYY-MM-DD, "today" or "today+N" / "today-N" days'],
    );
    expect(
      validateField({
        ...base,
        validation: { maxDate: "2026-01-01", minDate: "2026-02-01" },
      }),
    ).toEqual(["minDate must not be after maxDate"]);
    expect(validateField({ ...base, default: "tomorrow" })).toEqual([
      "default must be a date (YYYY-MM-DD)",
    ]);
  });

  it("checks select options and defaults", () => {
    const base = { code: "s", label: "S", type: "select" };
    expect(validateField(base)).toEqual([
      "a select field needs 1 to 100 options",
    ]);
    expect(
      validateField({
        ...base,
        options: [{ value: "a" }, { value: "a" }, { value: " " }, "x"],
      }),
    ).toHaveLength(3);
    expect(
      validateField({ ...base, options: [{ label: 7, value: "a" }] }),
    ).toHaveLength(1);
    expect(
      validateField({ ...base, default: "b", options: [{ value: "a" }] }),
    ).toEqual(["default must be one of the options"]);
    expect(
      validateField({ ...base, default: 5, options: [{ value: "a" }] }),
    ).toEqual(["default must be text"]);
    expect(
      validateField({ code: "t", label: "T", options: [{}], type: "text" }),
    ).toEqual(["only select fields have options"]);
    expect(
      validateField({ code: "t", label: "T", options: [], type: "text" }),
    ).toEqual([]);
  });

  it("checks checkbox defaults", () => {
    expect(validateField({ ...gift, default: "yes" })).toEqual([
      "default must be true or false for a checkbox",
    ]);
    expect(validateField({ ...gift, default: true })).toEqual([]);
  });

  it("checks scope", () => {
    expect(validateField({ ...po, scope: [] })).toEqual([
      "scope must be an object",
    ]);
    expect(
      validateField({
        ...po,
        scope: { customerGroups: ["x"], storeViews: ["no spaces"] },
      }),
    ).toHaveLength(2);
    expect(
      validateField({ ...po, scope: { customerGroups: [0, "1"] } }),
    ).toEqual([]);
  });

  it("checks conditions", () => {
    const codes = new Set(["a", "b"]);
    const field = (conditions, extra = {}) =>
      validateField(
        { code: "a", conditions, label: "A", type: "text", ...extra },
        {
          codes,
        },
      );
    expect(field("x")).toEqual(["conditions must be a list of at most 10"]);
    expect(field([], { match: "some" })).toEqual([
      'match must be "all" or "any"',
    ]);
    expect(field([null])).toEqual(["condition 1 must be an object"]);
    expect(field([{ field: "A!", operator: "filled" }])).toEqual([
      "condition 1 needs the code of another field",
    ]);
    expect(field([{ field: "a", operator: "filled" }])).toEqual([
      "condition 1 can't depend on the field itself",
    ]);
    expect(field([{ field: "z", operator: "filled" }])).toEqual([
      'condition 1 refers to unknown field "z"',
    ]);
    expect(field([{ field: "b", operator: "like" }])).toEqual([
      "condition 1 has an unknown operator",
    ]);
    expect(field([{ field: "b", operator: "eq" }])).toEqual([
      "condition 1 needs a value",
    ]);
    expect(field([{ field: "b", operator: "in", value: " , " }])).toEqual([
      "condition 1 needs a value",
    ]);
    expect(field([{ field: "b", operator: "eq", value: 3 }])).toEqual([]);
    expect(field([{ field: "b", operator: "in", value: ["x"] }])).toEqual([]);
  });
});

describe("validateDefinitions", () => {
  it("accepts a valid set", () => {
    expect(validateDefinitions(ALL)).toEqual([]);
  });

  it("finds duplicates, unknown references, loops and bad input", () => {
    expect(validateDefinitions("x")).toEqual(["fields must be a list"]);
    expect(validateDefinitions(Array.from({ length: 51 }, () => po))).toEqual([
      "at most 50 fields are allowed",
    ]);
    const errors = validateDefinitions([
      po,
      { ...po },
      { ...message, conditions: [{ field: "missing", operator: "checked" }] },
      {
        code: "a",
        conditions: [{ field: "b", operator: "filled" }],
        label: "A",
        type: "text",
      },
      {
        code: "b",
        conditions: [{ field: "a", operator: "filled" }],
        label: "B",
        type: "text",
      },
      { label: "No code", type: "text" },
    ]);
    expect(errors).toContain("po_number: code is used by another field");
    expect(errors).toContain(
      'gift_message: condition 1 refers to unknown field "missing"',
    );
    expect(errors).toContain(
      "a: its conditions depend on each other in a loop",
    );
    expect(errors).toContain(
      "b: its conditions depend on each other in a loop",
    );
    expect(errors.some((error) => error.startsWith("field 6:"))).toBe(true);
  });
});

describe("which fields apply", () => {
  it("sorts by placement, sort order and code", () => {
    const sorted = sortFields([
      { code: "b", placement: "review" },
      { code: "a", placement: "review" },
      { code: "c", placement: "shipping", sortOrder: 5 },
      { code: "d", placement: "shipping", sortOrder: 1 },
      { code: "e", placement: "nowhere" },
      { code: "f" },
    ]);
    expect(sorted.map((field) => field.code)).toEqual([
      "d",
      "c",
      "a",
      "b",
      "f",
      "e",
    ]);
  });

  it("applies store view and customer group scope", () => {
    expect(inScope(vat, { customerGroup: 2, storeView: "de" })).toBe(true);
    expect(inScope(vat, { customerGroup: "2", storeView: "en" })).toBe(false);
    expect(inScope(vat, { customerGroup: "1", storeView: "de" })).toBe(false);
    expect(inScope(vat, { storeView: "de" })).toBe(false);
    expect(inScope(vat, { customerGroup: "2" })).toBe(true);
    expect(inScope(po)).toBe(true);
  });

  it("keeps enabled, valid, in-scope fields", () => {
    const fields = fieldsFor(
      [
        ...ALL,
        { ...po, code: "off", enabled: false },
        { code: "broken" },
        null,
      ],
      { customerGroup: "0", storeView: "default" },
    );
    expect(fields.map((field) => field.code)).toEqual([
      "delivery_notes",
      "delivery_date",
      "gift_message",
      "heard_from",
      "heard_other",
      "is_gift",
      "po_number",
    ]);
    expect(fieldsFor("nope")).toEqual([]);
  });

  it("publishes only public keys, filtered by store view", () => {
    const stored = { ...po, _id: "x", showInEmail: false, updatedAt: "now" };
    const fields = publicFields([stored, vat, { ...notes, enabled: false }], {
      storeView: "default",
    });
    expect(fields).toHaveLength(1);
    expect(fields[0]).not.toHaveProperty("_id");
    expect(fields[0]).not.toHaveProperty("updatedAt");
    expect(fields[0]).not.toHaveProperty("showInEmail");
    expect(fields[0].validation.pattern).toBe("[A-Z0-9-]+");
    expect(publicFields([vat]).map((field) => field.code)).toEqual(["vat_id"]);
    expect(publicFields(null)).toEqual([]);
  });

  it("shows conditional fields only when their conditions match", () => {
    const fields = fieldsFor(ALL);
    const codes = (values) =>
      visibleFields(fields, values).map((field) => field.code);
    expect(codes({})).not.toContain("gift_message");
    expect(codes({ is_gift: true })).toContain("gift_message");
    expect(codes({ heard_from: "other" })).toContain("heard_other");
    expect(codes({ heard_from: "friend" })).not.toContain("heard_other");
  });

  it("supports every operator and any/all matching", () => {
    const a = { code: "a", label: "A", type: "text" };
    const check = (operator, value, current) =>
      visibleFields(
        [
          a,
          {
            code: "b",
            conditions: [{ field: "a", operator, value }],
            label: "B",
            type: "text",
          },
        ],
        { a: current },
      ).length === 2;
    expect(check("neq", "x", "y")).toBe(true);
    expect(check("neq", "x", "x")).toBe(false);
    expect(check("in", "x, y", "y")).toBe(true);
    expect(check("not_in", "x,y", "y")).toBe(false);
    expect(check("filled", undefined, "z")).toBe(true);
    expect(check("filled", undefined, "  ")).toBe(false);
    expect(check("empty", undefined, undefined)).toBe(true);
    expect(check("unchecked", undefined, false)).toBe(true);
    expect(check("eq", "", null)).toBe(true);
    expect(check("bogus", "", "x")).toBe(false);

    const any = {
      code: "c",
      conditions: [
        { field: "a", operator: "eq", value: "1" },
        { field: "a", operator: "eq", value: "2" },
      ],
      label: "C",
      match: "any",
      type: "text",
    };
    expect(visibleFields([a, any], { a: "2" })).toHaveLength(2);
    expect(
      visibleFields([a, { ...any, match: "all" }], { a: "2" }),
    ).toHaveLength(1);
  });

  it("hides fields that depend on hidden fields", () => {
    const a = { code: "a", label: "A", type: "checkbox" };
    const b = {
      code: "b",
      conditions: [{ field: "a", operator: "checked" }],
      label: "B",
      type: "text",
    };
    const c = {
      code: "c",
      conditions: [{ field: "b", operator: "filled" }],
      label: "C",
      type: "text",
    };
    const d = {
      code: "d",
      conditions: [{ field: "gone", operator: "empty" }],
      label: "D",
      type: "text",
    };
    expect(visibleFields([a, b, c, d], { b: "x" }).map((f) => f.code)).toEqual([
      "a",
      "d",
    ]);
    expect(visibleFields([a, b, c], { a: true, b: "x" })).toHaveLength(3);
  });

  it("survives condition loops", () => {
    const a = {
      code: "a",
      conditions: [{ field: "b", operator: "empty" }],
      label: "A",
      type: "text",
    };
    const b = {
      code: "b",
      conditions: [{ field: "a", operator: "empty" }],
      label: "B",
      type: "text",
    };
    expect(() => visibleFields([a, b], {})).not.toThrow();
  });
});

describe("values", () => {
  it("normalises raw values", () => {
    expect(normaliseValue(po, "  AB   12 ")).toBe("AB 12");
    expect(normaliseValue(notes, " line 1\r\nline 2 ")).toBe("line 1\nline 2");
    expect(normaliseValue(po, "   ")).toBeUndefined();
    expect(normaliseValue(po, null)).toBeUndefined();
    expect(normaliseValue(po, { a: 1 })).toBeUndefined();
    expect(normaliseValue(po, 42)).toBe("42");
    expect(normaliseValue(gift, true)).toBe(true);
    expect(normaliseValue(gift, "1")).toBe(true);
    expect(normaliseValue(gift, "Yes")).toBe(true);
    expect(normaliseValue(gift, "0")).toBe(false);
    expect(normaliseValue(gift, "")).toBe(false);
    expect(normaliseValue(gift, undefined)).toBe(false);
  });

  it("gives defaults", () => {
    expect(defaultValue(source)).toBe("search");
    expect(defaultValue(po)).toBe("");
    expect(defaultValue(gift)).toBe(false);
    expect(defaultValue({ ...gift, default: true })).toBe(true);
  });

  it("validates single values", () => {
    const todayDate = "2026-11-17";
    expect(validateValue(po, undefined)).toBe("PO number is required.");
    expect(validateValue({ ...po, required: false }, "")).toBeNull();
    expect(validateValue(po, "AB")).toBe(
      "PO number must be at least 3 characters.",
    );
    expect(validateValue(po, "A".repeat(21))).toBe(
      "PO number must be at most 20 characters.",
    );
    expect(validateValue(po, "ab-12")).toBe("Use capitals, digits and dashes.");
    expect(validateValue({ ...po, validation: { pattern: "\\d+" } }, "x")).toBe(
      "PO number is not in the expected format.",
    );
    expect(validateValue(po, "AB-12")).toBeNull();
    expect(validateValue(po, 5)).toBe("PO number is not valid.");
    expect(validateValue({ code: "x", type: "text" }, "a".repeat(2001))).toBe(
      "x must be at most 2000 characters.",
    );
    expect(validateValue(source, "tv")).toBe(
      "Choose one of the options for How did you hear about us?.",
    );
    expect(validateValue(source, "friend")).toBeNull();
    expect(validateValue(delivery, "2026-13-01", { todayDate })).toBe(
      "Enter a valid date for Delivery date.",
    );
    expect(validateValue(delivery, "2026-11-18", { todayDate })).toBe(
      "Delivery date must be on or after 2026-11-19.",
    );
    expect(validateValue(delivery, "2027-01-01", { todayDate })).toBe(
      "Delivery date must be on or before 2026-12-17.",
    );
    expect(validateValue(delivery, "2026-11-20", { todayDate })).toBeNull();
    expect(
      validateValue({ ...delivery, validation: undefined }, "2020-01-01"),
    ).toBeNull();
    expect(validateValue({ ...gift, required: true }, false)).toBe(
      'Please tick "This is a gift".',
    );
    expect(validateValue(gift, false)).toBeNull();
  });

  it("validates a whole submission", () => {
    const result = validateValues(
      ALL,
      {
        delivery_date: "2026-11-20",
        delivery_notes: "Ring twice",
        gift_message: "Ignored: not a gift",
        heard_from: "friend",
        heard_other: "Also ignored",
        is_gift: false,
        po_number: "PO-1",
        unknown: "dropped",
        vat_id: "out of scope",
      },
      { customerGroup: "1", storeView: "default", todayDate: "2026-11-17" },
    );
    expect(result).toEqual({
      errors: {},
      valid: true,
      values: {
        delivery_date: "2026-11-20",
        delivery_notes: "Ring twice",
        heard_from: "friend",
        po_number: "PO-1",
      },
    });
  });

  it("reports every error", () => {
    const result = validateValues(
      ALL,
      { is_gift: "1" },
      { todayDate: "2026-11-17" },
    );
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual([
      "gift_message",
      "po_number",
    ]);
    expect(validateValues(ALL, "nonsense").valid).toBe(false);
  });
});

describe("showing values", () => {
  it("formats values", () => {
    expect(formatValue(gift, true)).toBe("Yes");
    expect(formatValue(gift, "0")).toBe("No");
    expect(formatValue(gift, "1")).toBe("Yes");
    expect(formatValue(source, "friend")).toBe("A friend");
    expect(formatValue(source, "other")).toBe("other");
    expect(formatValue(source, "gone")).toBe("gone");
    expect(formatValue(po, "")).toBe("");
    expect(formatValue(undefined, 5)).toBe("5");
  });

  it("describes saved values in field order, keeping deleted fields", () => {
    const rows = describeValues(
      [
        ...ALL,
        { ...po, code: "secret", showInEmail: false, label: "Internal" },
      ],
      {
        heard_from: "friend",
        is_gift: "1",
        old_field: "kept",
        po_number: "PO-1",
        secret: "x",
        zzz: "",
      },
    );
    expect(rows).toEqual([
      {
        code: "heard_from",
        label: "How did you hear about us?",
        value: "A friend",
      },
      { code: "is_gift", label: "This is a gift", value: "Yes" },
      { code: "po_number", label: "PO number", value: "PO-1" },
      { code: "secret", label: "Internal", value: "x" },
      { code: "old_field", label: "old_field", value: "kept" },
    ]);
    const email = describeValues(
      ALL.concat({ ...po, code: "secret", showInEmail: false }),
      {
        old_field: "kept",
        po_number: "PO-1",
        secret: "x",
      },
      { emailOnly: true },
    );
    expect(email.map((row) => row.code)).toEqual(["po_number"]);
    expect(describeValues(null, null)).toEqual([]);
  });
});

describe("custom attributes", () => {
  it("turns values into cart attributes, clearing hidden fields", () => {
    expect(
      toCustomAttributes([po, gift, message], {
        is_gift: false,
        po_number: "PO-1",
      }),
    ).toEqual([
      { attribute_code: "po_number", value: "PO-1" },
      { attribute_code: "is_gift", value: "0" },
      { attribute_code: "gift_message", value: "" },
    ]);
    expect(toAttributeValue(true)).toBe("1");
    expect(toAttributeValue(null)).toBe("");
    expect(toAttributeValue(3)).toBe("3");
  });

  it("parses every shape Commerce uses", () => {
    expect(
      parseCustomAttributes([
        { attribute_code: "a", value: "1" },
        { code: "b", value: 2 },
        { attribute_code: "c", value: "" },
        { attribute_code: "", value: "x" },
        "junk",
      ]),
    ).toEqual({ a: "1", b: "2" });
    expect(
      parseCustomAttributes('{"a":"1","b":{"value":"2"},"c":{"x":1}}'),
    ).toEqual({
      a: "1",
      b: "2",
    });
    expect(
      parseCustomAttributes({
        custom_attributes: '[{"attribute_code":"z","value":"9"}]',
      }),
    ).toEqual({ z: "9" });
    expect(parseCustomAttributes("{bad")).toEqual({});
    expect(parseCustomAttributes(null)).toEqual({});
    expect(parseCustomAttributes(undefined)).toEqual({});
  });
});
