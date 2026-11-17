/**
 * Place-order validation (webhook `observer.sales_order_place_before`).
 *
 * Commerce sends the order before saving it. Its custom attributes hold the checkout field
 * values the storefront set on the cart with `setCustomAttributesOnCart` (Commerce copies them
 * from the quote to the order). They are checked with the same engine the storefront uses, for
 * the order's store view and customer group, so a shopper who skips the storefront checks (or
 * calls GraphQL directly) can't place an order with missing or invalid values.
 *
 * Failure policy: an invalid order is blocked with the field errors as the message. When the
 * app itself fails (database or Commerce unreachable), the order goes through and the error is
 * logged: an outage must not stop sales.
 */

import { getCommerceClient } from "@adobe/aio-commerce-lib-app";
import { resolveImsAuthParams } from "@adobe/aio-commerce-lib-auth";

import { parseCustomAttributes, today, validateValues } from "#engine";

import { storeCodeFor } from "../../../common/fields/commerce.js";
import { loadSettings } from "../../../common/fields/settings.js";
import { loadFields } from "../../../common/fields/sources.js";

/** The order from any payload shape Commerce uses ({ data: { order } } or { order }). */
export function orderFrom(payload = {}) {
  return payload?.data?.order ?? payload?.order ?? {};
}

/** The field values on an order (custom attributes), in any shape Commerce sends them. */
export function orderValues(order) {
  return {
    ...parseCustomAttributes(order?.extension_attributes?.custom_attributes),
    ...parseCustomAttributes(order?.custom_attributes),
    ...parseCustomAttributes(order?.custom_attributes_serializable),
  };
}

function defaultStoreCode(storeId, params, logger) {
  return storeCodeFor(
    storeId,
    () => getCommerceClient(resolveImsAuthParams(params)),
    { logger },
  );
}

export function createOrderValidator(overrides = {}) {
  const deps = {
    loadFields,
    loadSettings,
    now: () => Date.now(),
    storeCodeFor: defaultStoreCode,
    ...overrides,
  };

  /** @returns {Promise<{ valid: boolean, message?: string, errors?: object, status: string }>} */
  return async (payload, params = {}, logger = console) => {
    const settings = await deps.loadSettings(logger);
    if (!(settings.fieldsEnabled && settings.blockInvalidOrders)) {
      return { status: "off", valid: true };
    }
    const fields = await deps.loadFields(params);
    if (!fields.length) {
      return { status: "no-fields", valid: true };
    }
    const order = orderFrom(payload);
    const storeView = await deps.storeCodeFor(order.store_id, params, logger);
    // Without the store view code, store-specific fields can't be checked fairly: skip them.
    const applicable =
      storeView === undefined
        ? fields.filter((field) => !field?.scope?.storeViews?.length)
        : fields;
    const result = validateValues(applicable, orderValues(order), {
      customerGroup: order.customer_group_id ?? 0,
      storeView,
      todayDate: today(deps.now()),
    });
    if (result.valid) {
      return { status: "valid", valid: true };
    }
    return {
      errors: result.errors,
      message: Object.values(result.errors).join(" "),
      status: "invalid",
      valid: false,
    };
  };
}
