/**
 * The "Checkout fields" column of the Commerce Admin order grid (Admin UI SDK grid columns).
 * Commerce sends the IDs of the orders on screen; the column shows each order's field values
 * as "Label: value" pairs.
 */

import { getCommerceClient } from "@adobe/aio-commerce-lib-app";
import { resolveImsAuthParams } from "@adobe/aio-commerce-lib-auth";

import { describeValues } from "#engine";

import {
  findOrders,
  orderAttributes,
} from "../../../common/fields/commerce.js";
import { loadFields } from "../../../common/fields/sources.js";

export const COLUMN = "checkout_fields";
const MAX_CELL = 500;

export function summarise(fields, values) {
  const text = describeValues(fields, values)
    .map((row) => `${row.label}: ${row.value.replace(/\s+/gu, " ")}`)
    .join("; ");
  return text.length > MAX_CELL ? `${text.slice(0, MAX_CELL - 1)}…` : text;
}

export function createOrderGrid(overrides = {}) {
  const deps = {
    getCommerce: (params) => getCommerceClient(resolveImsAuthParams(params)),
    loadFields,
    ...overrides,
  };

  /** @returns {Promise<Record<string, Record<string, string>>>} cells by order ID */
  return async (ids, params) => {
    const [fields, orders] = await Promise.all([
      deps.loadFields(params),
      deps.getCommerce(params).then((commerce) => findOrders(commerce, ids)),
    ]);
    return Object.fromEntries(
      ids.map((id) => {
        const order = orders.get(String(id));
        return [
          String(id),
          { [COLUMN]: order ? summarise(fields, orderAttributes(order)) : "" },
        ];
      }),
    );
  };
}
