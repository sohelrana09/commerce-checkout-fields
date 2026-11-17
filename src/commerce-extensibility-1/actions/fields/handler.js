/**
 * The storefront's field-definitions feed: the enabled fields for one store view, with only the
 * keys the storefront kit needs. Responses are cacheable, since every shopper of a store view
 * gets the same definitions (customer group filtering happens in the browser and, for real, in
 * the place-order webhook).
 */

import { publicFields, STORE_CODE_PATTERN } from "#engine";

import { loadSettings } from "../../../common/fields/settings.js";
import { loadFields } from "../../../common/fields/sources.js";
import { json } from "../../../common/http.js";

export function createFieldsFeed(overrides = {}) {
  const deps = { loadFields, loadSettings, ...overrides };

  return async (params = {}, logger = console) => {
    const store =
      typeof params.store === "string" && STORE_CODE_PATTERN.test(params.store)
        ? params.store
        : undefined;
    const settings = await deps.loadSettings(logger);
    const fields = settings.fieldsEnabled ? await deps.loadFields(params) : [];
    const response = json(200, {
      enabled: settings.fieldsEnabled,
      fields: publicFields(fields, { storeView: store }),
    });
    response.headers["Cache-Control"] =
      `public, max-age=${settings.cacheSeconds}`;
    return response;
  };
}
