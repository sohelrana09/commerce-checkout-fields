/**
 * Commerce REST calls the app makes with its own credentials: store views and customer groups
 * for the field editor, store view codes for the webhook, and orders for the Admin order view.
 *
 * Every function takes a `commerce` client (`getCommerceClient` from aio-commerce-lib-app, or a
 * fake in tests) with `get(path, options).json()`.
 */

import { parseCustomAttributes } from "#engine";

export const STORES_CACHE_MS = 10 * 60_000;

let storesCache = null;

export function clearStoresCache() {
  storesCache = null;
}

export async function listStoreViews(commerce) {
  const storeViews = await commerce.get("store/storeViews").json();
  return (storeViews ?? [])
    .filter((store) => Number(store.id) !== 0)
    .map((store) => ({
      code: store.code,
      id: Number(store.id),
      label: store.name,
    }));
}

export async function listCustomerGroups(commerce) {
  const result = await commerce
    .get("customerGroups/search", {
      searchParams: { "searchCriteria[pageSize]": "200" },
    })
    .json();
  return (result?.items ?? []).map((group) => ({
    id: String(group.id),
    label: group.code,
  }));
}

/**
 * The store view code for a store ID, cached per warm container. Resolves to undefined when
 * Commerce can't be reached, so the caller can fall back safely.
 */
export async function storeCodeFor(
  storeId,
  getCommerce,
  { logger = console, now = Date.now() } = {},
) {
  if (storeId === undefined || storeId === null || storeId === "") {
    return;
  }
  try {
    if (!storesCache || storesCache.expiresAt <= now) {
      const views = await listStoreViews(await getCommerce());
      storesCache = {
        byId: new Map(views.map((view) => [String(view.id), view.code])),
        expiresAt: now + STORES_CACHE_MS,
      };
    }
    return storesCache.byId.get(String(storeId));
  } catch (error) {
    logger.warn(`Store views unavailable: ${error.message}`);
  }
}

/** The custom attributes saved on a REST order, as a { code: value } map. */
export function orderAttributes(order) {
  return {
    ...parseCustomAttributes(order?.extension_attributes?.custom_attributes),
    ...parseCustomAttributes(order?.custom_attributes),
  };
}

export async function getOrder(commerce, orderId) {
  return await commerce.get(`orders/${encodeURIComponent(orderId)}`).json();
}

/**
 * Orders by ID for the order grid. The grid may send entity IDs or increment IDs, so both are
 * searched (filters in one group are ORed) and each order is returned under the ID it matched.
 */
export async function findOrders(commerce, ids) {
  const list = ids.map(String).join(",");
  const prefix = "searchCriteria[filter_groups][0][filters]";
  const result = await commerce
    .get("orders", {
      searchParams: {
        [`${prefix}[0][condition_type]`]: "in",
        [`${prefix}[0][field]`]: "entity_id",
        [`${prefix}[0][value]`]: list,
        [`${prefix}[1][condition_type]`]: "in",
        [`${prefix}[1][field]`]: "increment_id",
        [`${prefix}[1][value]`]: list,
        "searchCriteria[pageSize]": String(ids.length),
      },
    })
    .json();
  const wanted = new Set(ids.map(String));
  const byId = new Map();
  for (const order of result?.items ?? []) {
    for (const key of [order.entity_id, order.increment_id]) {
      if (key !== undefined && wanted.has(String(key))) {
        byId.set(String(key), order);
      }
    }
  }
  return byId;
}
