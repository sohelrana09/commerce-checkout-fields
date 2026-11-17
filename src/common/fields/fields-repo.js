/**
 * Checkout field definitions stored in App Builder Database Storage. Reads for the storefront
 * feed and the place-order webhook are cached per warm action container for FIELDS_CACHE_MS.
 */

import { MAX_FIELDS, validateDefinitions, validateField } from "#engine";

import { FIELDS, findOneOrNull, toField, withDb } from "./db.js";

export const FIELDS_CACHE_MS = 30_000;

let cache = null;

export function clearFieldsCache() {
  cache = null;
}

export class FieldValidationError extends Error {
  // biome-ignore lint/style/useConsistentMemberAccessibility: plain JavaScript has no access modifiers
  constructor(errors) {
    super(`Invalid checkout field: ${errors.join("; ")}`);
    this.name = "FieldValidationError";
    this.errors = errors;
  }
}

async function readAll(client) {
  const docs = await client
    .collection(FIELDS)
    .find({})
    .sort({ sortOrder: 1, code: 1 })
    .toArray();
  return docs.map(toField);
}

export function listFields(params, connect) {
  return withDb(params, readAll, connect);
}

/** Definitions for the storefront feed and the webhook: cached per warm container. */
export async function listFieldsCached(params, connect, now = Date.now()) {
  if (cache && cache.expiresAt > now) {
    return cache.fields;
  }
  const fields = await listFields(params, connect);
  cache = { expiresAt: now + FIELDS_CACHE_MS, fields };
  return fields;
}

/**
 * Creates or replaces a field. When `previousCode` differs from `field.code` (a rename), the
 * old document is removed. The whole set is checked after the change, so a save can't leave a
 * condition pointing at a missing field or two fields depending on each other.
 */
// Async so validation failures reject like database failures do.
// biome-ignore lint/suspicious/useAwait: see comment above
export async function saveField(field, params, { previousCode, connect } = {}) {
  const own = validateField(field);
  if (own.length) {
    throw new FieldValidationError(own);
  }
  const { _id: _ignored, updatedAt: _old, ...clean } = field;
  const doc = { ...clean, updatedAt: new Date().toISOString() };

  return withDb(
    params,
    async (client) => {
      const fields = client.collection(FIELDS);
      const renamed = previousCode && previousCode !== field.code;
      if (renamed || !previousCode) {
        const clash = await findOneOrNull(fields, { code: field.code });
        if (clash) {
          throw new FieldValidationError([
            `a field with code "${field.code}" already exists`,
          ]);
        }
      }
      const others = (await readAll(client)).filter(
        (existing) =>
          existing.code !== field.code && existing.code !== previousCode,
      );
      if (others.length + 1 > MAX_FIELDS) {
        throw new FieldValidationError([
          `at most ${MAX_FIELDS} fields are allowed`,
        ]);
      }
      const problems = validateDefinitions([...others, doc]);
      if (problems.length) {
        throw new FieldValidationError(problems);
      }
      if (renamed) {
        await fields.deleteOne({ code: previousCode });
      }
      await fields.replaceOne({ code: field.code }, doc, { upsert: true });
      clearFieldsCache();
      return doc;
    },
    connect,
  );
}

/** Deletes a field. Refuses while other fields' conditions still depend on it. */
export function deleteField(code, params, connect) {
  return withDb(
    params,
    async (client) => {
      const dependants = (await readAll(client)).filter((field) =>
        (field.conditions ?? []).some((condition) => condition.field === code),
      );
      if (dependants.length) {
        throw new FieldValidationError([
          `remove the conditions on ${dependants.map((field) => `"${field.code}"`).join(", ")} first: they depend on this field`,
        ]);
      }
      const result = await client.collection(FIELDS).deleteOne({ code });
      clearFieldsCache();
      return (result?.deletedCount ?? 0) > 0;
    },
    connect,
  );
}
