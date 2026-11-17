// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const FIELDS = [
  {
    code: "po_number",
    help: "Your PO reference.",
    label: "PO number",
    placeholder: "PO-1",
    placement: "review",
    required: true,
    type: "text",
    validation: {
      maxLength: 10,
      pattern: "PO-\\d+",
      patternMessage: "Use PO-123.",
    },
  },
  {
    code: "notes",
    label: "<b>Notes</b>",
    placement: "shipping",
    type: "textarea",
  },
  {
    code: "is_gift",
    label: "Gift",
    placement: "review",
    sortOrder: 2,
    type: "checkbox",
  },
  {
    code: "gift_message",
    conditions: [{ field: "is_gift", operator: "checked" }],
    label: "Gift message",
    placement: "review",
    required: true,
    sortOrder: 3,
    type: "textarea",
  },
  {
    code: "source",
    default: "web",
    label: "Source",
    options: [{ label: "Web", value: "web" }, { value: "tv" }],
    placement: "review",
    sortOrder: 4,
    type: "select",
  },
  { code: "date", label: "Date", placement: "payment", type: "date" },
  {
    code: "trade_ref",
    label: "Trade reference",
    placement: "review",
    required: true,
    scope: { customerGroups: ["2"] },
    sortOrder: 5,
    type: "text",
  },
];

let kit;

async function loadKit() {
  vi.resetModules();
  kit = await import("../../storefront/scripts/checkout-fields.js");
  return kit;
}

function type(control, value) {
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function tick(control) {
  control.checked = !control.checked;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(async () => {
  sessionStorage.clear();
  document.body.innerHTML = '<div id="shipping"></div><div id="review"></div>';
  await loadKit();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rendering", () => {
  test("renders a placement's fields as text, with labels and help", async () => {
    kit.initCheckoutFields({ customerGroup: "0", fields: FIELDS });
    const form = await kit.renderCheckoutFields(
      document.querySelector("#review"),
      {
        placement: "review",
        title: "Order details",
      },
    );
    expect(form.querySelector("legend").textContent).toBe("Order details");
    const codes = [...form.querySelectorAll(".checkout-fields__field")].map(
      (el) => el.dataset.field,
    );
    expect(codes).toEqual(["po_number", "is_gift", "gift_message", "source"]);
    const po = form.querySelector("#checkout-fields-po_number");
    expect(po.required).toBe(true);
    expect(po.maxLength).toBe(10);
    expect(po.placeholder).toBe("PO-1");
    expect(po.getAttribute("aria-describedby")).toBe(
      "checkout-fields-po_number-help checkout-fields-po_number-error",
    );
    expect(form.querySelector('[data-field="gift_message"]').hidden).toBe(true);
    expect(form.querySelector("select").value).toBe("web");
    expect(form.querySelectorAll("option")[2].textContent).toBe("tv");

    const shipping = await kit.renderCheckoutFields(
      document.querySelector("#shipping"),
      {
        placement: "shipping",
      },
    );
    expect(shipping.querySelector("label span").textContent).toBe(
      "<b>Notes</b>",
    );
    expect(shipping.querySelector("b")).toBeNull();
  });

  test("shows group-limited fields only to that group, or to everyone when unknown", async () => {
    kit.initCheckoutFields({ customerGroup: "1", fields: FIELDS });
    let form = await kit.renderCheckoutFields(document.body);
    expect(form.querySelector('[data-field="trade_ref"]')).toBeNull();
    await kit.setCustomerGroup("2");
    form = document.querySelector(".checkout-fields");
    expect(form.querySelector('[data-field="trade_ref"]')).not.toBeNull();

    kit.initCheckoutFields({ fields: FIELDS });
    form = await kit.renderCheckoutFields(document.body);
    expect(form.querySelector('[data-field="trade_ref"]')).not.toBeNull();
  });

  test("hides a form with no visible fields and re-renders in place", async () => {
    kit.initCheckoutFields({ fields: FIELDS });
    const container = document.querySelector("#review");
    const empty = await kit.renderCheckoutFields(container, {
      placement: "nowhere",
    });
    expect(empty.hidden).toBe(true);
    await kit.renderCheckoutFields(container, { placement: "review" });
    expect(container.querySelectorAll(".checkout-fields")).toHaveLength(1);
  });
});

describe("interaction and validation", () => {
  test("shows conditional fields and live errors once touched", async () => {
    kit.initCheckoutFields({ customerGroup: "0", fields: FIELDS });
    const form = await kit.renderCheckoutFields(document.body);
    const changes = vi.fn();
    document.addEventListener("checkout-fields/change", changes);

    tick(form.querySelector("#checkout-fields-is_gift"));
    const message = form.querySelector('[data-field="gift_message"]');
    expect(message.hidden).toBe(false);
    expect(changes).toHaveBeenCalled();

    const po = form.querySelector("#checkout-fields-po_number");
    type(po, "12");
    const wrapper = form.querySelector('[data-field="po_number"]');
    expect(wrapper.querySelector(".checkout-fields__error").textContent).toBe(
      "Use PO-123.",
    );
    expect(po.getAttribute("aria-invalid")).toBe("true");
    type(po, "PO-12");
    expect(po.hasAttribute("aria-invalid")).toBe(false);

    po.dispatchEvent(new Event("focusout", { bubbles: true }));
    form.dispatchEvent(new Event("input", { bubbles: true }));
  });

  test("validateCheckoutFields reports and focuses the first problem", async () => {
    kit.initCheckoutFields({ customerGroup: "0", fields: FIELDS });
    const form = await kit.renderCheckoutFields(document.body);
    expect(kit.validateCheckoutFields()).toBe(false);
    expect(document.activeElement?.id).toBe("checkout-fields-po_number");
    type(form.querySelector("#checkout-fields-po_number"), "PO-7");
    expect(kit.validateCheckoutFields({ focus: false })).toBe(true);
    expect(kit.getCheckoutFieldValues().values).toEqual({
      po_number: "PO-7",
      source: "web",
    });
  });

  test("keeps values in sessionStorage across page loads, until reset", async () => {
    kit.initCheckoutFields({ customerGroup: "0", fields: FIELDS });
    let form = await kit.renderCheckoutFields(document.body);
    type(form.querySelector("#checkout-fields-po_number"), "PO-9");
    await loadKit();
    kit.initCheckoutFields({ customerGroup: "0", fields: FIELDS });
    form = await kit.renderCheckoutFields(document.body);
    expect(form.querySelector("#checkout-fields-po_number").value).toBe("PO-9");
    kit.resetCheckoutFields();
    expect(kit.getCheckoutFieldValues().values.po_number).toBeUndefined();
  });
});

describe("saving on the cart", () => {
  test("sends every applicable field with setCustomAttributesOnCart", async () => {
    kit.initCheckoutFields({
      customerGroup: "0",
      fields: FIELDS,
      values: { is_gift: true, gift_message: 'Say "hi"', po_number: "PO-1" },
    });
    const fetchGraphQl = vi.fn(async () => ({ data: {} }));
    const saved = await kit.saveCheckoutFields("cart123", { fetchGraphQl });
    expect(saved).toEqual({
      gift_message: 'Say "hi"',
      is_gift: true,
      po_number: "PO-1",
      source: "web",
    });
    const [query, options] = fetchGraphQl.mock.calls[0];
    expect(options).toEqual({
      method: "POST",
      variables: { cartId: "cart123" },
    });
    expect(query).toContain("setCustomAttributesOnCart");
    expect(query).toContain(
      '{ attribute_code: "gift_message", value: "Say \\"hi\\"" }',
    );
    expect(query).toContain('{ attribute_code: "is_gift", value: "1" }');
    expect(query).toContain('{ attribute_code: "notes", value: "" }');
  });

  test("refuses invalid values and reports GraphQL errors", async () => {
    kit.initCheckoutFields({ customerGroup: "0", fields: FIELDS });
    await expect(
      kit.saveCheckoutFields("c", { fetchGraphQl: vi.fn() }),
    ).rejects.toThrow("PO number is required.");
    kit.initCheckoutFields({
      customerGroup: "0",
      fields: FIELDS,
      values: { po_number: "PO-1" },
    });
    await expect(kit.saveCheckoutFields("c")).rejects.toThrow(
      "needs the drop-in fetchGraphQl",
    );
    const failing = vi.fn(async () => ({
      errors: [{ message: "Cart not found" }],
    }));
    await expect(
      kit.saveCheckoutFields("c", { fetchGraphQl: failing }),
    ).rejects.toThrow("Cart not found");
  });

  test("does nothing without fields", async () => {
    kit.initCheckoutFields({ fields: [] });
    const fetchGraphQl = vi.fn();
    expect(await kit.saveCheckoutFields("c", { fetchGraphQl })).toEqual({});
    expect(fetchGraphQl).not.toHaveBeenCalled();
  });
});

describe("loading definitions", () => {
  test("fetches once per store view and caches in sessionStorage", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ enabled: true, fields: FIELDS }), {
        status: 200,
      }),
    );
    kit.initCheckoutFields({
      endpoint: "https://x.test/fields",
      storeView: "default",
    });
    expect(await kit.loadFieldDefinitions()).toHaveLength(FIELDS.length);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://x.test/fields?store=default",
    );
    await loadKit();
    kit.initCheckoutFields({
      endpoint: "https://x.test/fields",
      storeView: "default",
    });
    expect(await kit.loadFieldDefinitions()).toHaveLength(FIELDS.length);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("shows no fields when the feed fails, is off or isn't set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 503 }),
    );
    kit.initCheckoutFields({ endpoint: "https://x.test/fields" });
    expect(await kit.loadFieldDefinitions()).toEqual([]);
    expect(warn).toHaveBeenCalledWith("Checkout fields unavailable (503)");

    await loadKit();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ enabled: false, fields: FIELDS }), {
        status: 200,
      }),
    );
    kit.initCheckoutFields({ endpoint: "https://x.test/off" });
    expect(await kit.loadFieldDefinitions()).toEqual([]);

    await loadKit();
    kit.initCheckoutFields({});
    expect(await kit.loadFieldDefinitions()).toEqual([]);
  });

  test("decodes customer group uids", () => {
    expect(kit.customerGroupFromUid(btoa("3"))).toBe("3");
    expect(kit.customerGroupFromUid("%%%")).toBeUndefined();
    expect(kit.customerGroupFromUid(btoa("abc"))).toBeUndefined();
  });
});
