/**
 * App Builder Database Storage access shared by the storefront feed, the webhook and the Admin actions.
 *
 * Collections:
 *   checkout_fields  one document per field definition, keyed by `code` (unique)
 *
 * Every function takes a `connect` function so tests can pass an in-memory client.
 */

import { generateAccessToken } from "@adobe/aio-lib-core-auth";
import libDb from "@adobe/aio-lib-db";

export const FIELDS = "checkout_fields";

export const INDEXES = {
  [FIELDS]: [
    { key: { code: 1 }, options: { unique: true } },
    { key: { sortOrder: 1 }, options: {} },
  ],
};

/** Opens a database client with the action's IMS credentials (`include-ims-credentials`). */
export async function connectDb(params) {
  const token = await generateAccessToken(params);
  const dbBase = await libDb.init({ token: token.access_token });
  return dbBase.connect();
}

/** Runs `fn(client)` and always closes the client. */
export async function withDb(params, fn, connect = connectDb) {
  const client = await connect(params);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

const NOT_FOUND = /document not found/iu;

function isNotFound(error) {
  return error?.httpStatusCode === 404 || NOT_FOUND.test(error?.message ?? "");
}

/**
 * `findOne` that returns null when nothing matches. App Builder Database Storage rejects with
 * "Document not found" (HTTP 404) instead of resolving to null as MongoDB does.
 */
export async function findOneOrNull(collection, query) {
  try {
    return await collection.findOne(query);
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Strips database-only fields so a stored field round-trips as a plain definition. */
export function toField(doc) {
  if (!doc) {
    return null;
  }
  const { _id: _dbId, ...field } = doc;
  return field;
}
