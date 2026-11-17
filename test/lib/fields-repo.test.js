import { beforeEach, describe, expect, test } from "vitest";

import { FIELDS, findOneOrNull, toField } from "../../src/common/fields/db.js";
import {
  clearFieldsCache,
  deleteField,
  FIELDS_CACHE_MS,
  FieldValidationError,
  listFields,
  listFieldsCached,
  saveField,
} from "../../src/common/fields/fields-repo.js";
import { createFakeDb } from "../fixtures/fake-db.js";

const field = (overrides = {}) => ({
  code: "po_number",
  label: "PO number",
  sortOrder: 10,
  type: "text",
  ...overrides,
});

describe("fields repository", () => {
  let db;
  beforeEach(() => {
    db = createFakeDb();
    clearFieldsCache();
  });

  test("saves, lists in sort order and deletes fields", async () => {
    await saveField(
      field({ code: "b", sortOrder: 20 }),
      {},
      { connect: db.connect },
    );
    await saveField(
      field({ code: "a", sortOrder: 10, updatedAt: "old" }),
      {},
      {
        connect: db.connect,
      },
    );
    const fields = await listFields({}, db.connect);
    expect(fields.map((f) => f.code)).toEqual(["a", "b"]);
    expect(fields[0]).not.toHaveProperty("_id");
    expect(fields[0].updatedAt).not.toBe("old");
    expect(await deleteField("a", {}, db.connect)).toBe(true);
    expect(await deleteField("a", {}, db.connect)).toBe(false);
    expect(db.calls.closed).toBeGreaterThan(0);
  });

  test("rejects invalid fields and duplicate codes", async () => {
    await expect(
      saveField(field({ label: "" }), {}, { connect: db.connect }),
    ).rejects.toBeInstanceOf(FieldValidationError);
    await saveField(field(), {}, { connect: db.connect });
    await expect(
      saveField(field(), {}, { connect: db.connect }),
    ).rejects.toThrow('a field with code "po_number" already exists');
  });

  test("checks the whole set: unknown references and loops", async () => {
    await expect(
      saveField(
        field({ code: "b", conditions: [{ field: "a", operator: "filled" }] }),
        {},
        { connect: db.connect },
      ),
    ).rejects.toThrow('refers to unknown field "a"');
    await saveField(field({ code: "a" }), {}, { connect: db.connect });
    await saveField(
      field({ code: "b", conditions: [{ field: "a", operator: "filled" }] }),
      {},
      { connect: db.connect },
    );
    await expect(
      saveField(
        field({ code: "a", conditions: [{ field: "b", operator: "filled" }] }),
        {},
        { connect: db.connect, previousCode: "a" },
      ),
    ).rejects.toThrow("loop");
  });

  test("refuses to delete a field others depend on", async () => {
    await saveField(field({ code: "a" }), {}, { connect: db.connect });
    await saveField(
      field({ code: "b", conditions: [{ field: "a", operator: "filled" }] }),
      {},
      { connect: db.connect },
    );
    await expect(deleteField("a", {}, db.connect)).rejects.toThrow(
      'remove the conditions on "b" first',
    );
  });

  test("limits the number of fields", async () => {
    db.seed(
      FIELDS,
      Array.from({ length: 50 }, (_, i) => field({ code: `f${i}` })),
    );
    await expect(
      saveField(field({ code: "one_more" }), {}, { connect: db.connect }),
    ).rejects.toThrow("at most 50 fields");
  });

  test("updates in place and renames", async () => {
    await saveField(field(), {}, { connect: db.connect });
    await saveField(
      field({ label: "PO" }),
      {},
      {
        connect: db.connect,
        previousCode: "po_number",
      },
    );
    await saveField(
      field({ code: "po" }),
      {},
      {
        connect: db.connect,
        previousCode: "po_number",
      },
    );
    const fields = await listFields({}, db.connect);
    expect(fields.map((f) => f.code)).toEqual(["po"]);
  });

  test("caches fields per container until a save", async () => {
    await saveField(field(), {}, { connect: db.connect });
    const now = Date.now();
    const first = await listFieldsCached({}, db.connect, now);
    await db
      .connect()
      .then((c) => c.collection(FIELDS).deleteOne({ code: "po_number" }));
    expect(await listFieldsCached({}, db.connect, now + 1)).toBe(first);
    expect(
      await listFieldsCached({}, db.connect, now + FIELDS_CACHE_MS + 1),
    ).toEqual([]);
  });
});

describe("db helpers", () => {
  test("findOneOrNull turns not-found errors into null", async () => {
    const missing = {
      findOne: () => Promise.reject(new Error("Document not found")),
    };
    const notFound = { findOne: () => Promise.reject({ httpStatusCode: 404 }) };
    const broken = { findOne: () => Promise.reject(new Error("boom")) };
    expect(await findOneOrNull(missing, {})).toBeNull();
    expect(await findOneOrNull(notFound, {})).toBeNull();
    await expect(findOneOrNull(broken, {})).rejects.toThrow("boom");
  });

  test("toField strips the database id", () => {
    expect(toField(null)).toBeNull();
    expect(toField({ _id: 1, code: "x" })).toEqual({ code: "x" });
  });
});
