/**
 * Where the field definitions come from: the CHECKOUT_FIELDS action input when set (handy for
 * CI and scripted setups), otherwise the fields managed on the Admin page (App Builder Database
 * Storage).
 */

import { listFieldsCached } from "./fields-repo.js";

function parseJson(value) {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error("CHECKOUT_FIELDS is not valid JSON", { cause: error });
  }
}

/** Fields from the CHECKOUT_FIELDS input, or null when it isn't set. */
export function fieldsFromInput(params = {}) {
  const value = params.CHECKOUT_FIELDS;
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const raw = parseJson(value);
  const fields = Array.isArray(raw) ? raw : raw?.fields;
  if (!Array.isArray(fields)) {
    throw new Error(
      "CHECKOUT_FIELDS must be an array of fields or { fields: [...] }",
    );
  }
  return fields;
}

export function loadFields(params, connect) {
  return fieldsFromInput(params) ?? listFieldsCached(params, connect);
}
