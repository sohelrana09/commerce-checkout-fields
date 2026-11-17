/**
 * Admin action handlers: manage field definitions, load the store views and customer groups the
 * field editor offers, and show the values saved on an order (the order view button). The live
 * form preview runs in the browser with the same engine as the storefront, so there's no
 * preview action. Dependencies are injectable for tests.
 */

import { getCommerceClient } from "@adobe/aio-commerce-lib-app";
import { resolveImsAuthParams } from "@adobe/aio-commerce-lib-auth";

import { describeValues } from "#engine";

import {
  getOrder,
  listCustomerGroups,
  listStoreViews,
  orderAttributes,
} from "../../common/fields/commerce.js";
import { DEFAULT_FIELDS } from "../../common/fields/default-fields.js";
import {
  deleteField,
  FieldValidationError,
  listFields,
  saveField,
} from "../../common/fields/fields-repo.js";
import { json } from "../../common/http.js";

function getCommerce(params) {
  return getCommerceClient(resolveImsAuthParams(params));
}

const realDeps = { deleteField, getCommerce, listFields, saveField };

const ORDER_ID = /^\d{1,12}$/u;

function requireCode(code) {
  if (typeof code !== "string" || !code) {
    throw new FieldValidationError(["code is required"]);
  }
  return code;
}

export function createHandlers(overrides = {}) {
  const deps = { ...realDeps, ...overrides };

  return {
    async fieldDelete(body, params) {
      const deleted = await deps.deleteField(requireCode(body.code), params);
      return deleted
        ? json(200, { deleted: true })
        : json(404, { error: "Field not found" });
    },

    async fieldSave(body, params) {
      if (!body.field || typeof body.field !== "object") {
        throw new FieldValidationError(["field is required"]);
      }
      const saved = await deps.saveField(body.field, params, {
        previousCode: body.previousCode,
      });
      return json(200, { field: saved });
    },

    async fieldsList(_body, params) {
      const fields = await deps.listFields(params);
      return json(200, { examples: DEFAULT_FIELDS, fields });
    },

    async lookups(_body, params, logger) {
      try {
        const commerce = await deps.getCommerce(params);
        const [storeViews, customerGroups] = await Promise.all([
          listStoreViews(commerce),
          listCustomerGroups(commerce),
        ]);
        return json(200, { customerGroups, storeViews });
      } catch (error) {
        // The editor still works with typed codes and IDs when Commerce can't be reached.
        logger.warn(`lookups unavailable: ${error.message}`);
        return json(200, {
          customerGroups: [],
          storeViews: [],
          unavailable: true,
        });
      }
    },

    async orderValues(body, params) {
      const orderId = String(body.orderId ?? "");
      if (!ORDER_ID.test(orderId)) {
        throw new FieldValidationError(["orderId must be an order ID"]);
      }
      const [fields, order] = await Promise.all([
        deps.listFields(params),
        deps
          .getCommerce(params)
          .then((commerce) => getOrder(commerce, orderId)),
      ]);
      return json(200, {
        incrementId: order?.increment_id ?? null,
        orderId,
        values: describeValues(fields, orderAttributes(order)),
      });
    },
  };
}

export const handlers = createHandlers();
