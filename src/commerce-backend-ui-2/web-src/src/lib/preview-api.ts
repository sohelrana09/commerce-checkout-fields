import { describeValues, validateDefinitions, validateField } from "#engine";

import { DEFAULT_FIELDS } from "../../../../common/fields/default-fields.js";
import { ApiError } from "../hooks/use-fields-api.ts";

import type { FieldsApi } from "../hooks/use-fields-api.ts";
import type { FieldDefinition } from "./types.ts";

const STORAGE_KEY = "checkout-fields-preview:fields";

/** The examples, switched on, so the preview opens with something to look at. */
export function seedFields(): FieldDefinition[] {
  return (DEFAULT_FIELDS as FieldDefinition[]).map((field) => ({
    ...structuredClone(field),
    enabled: true,
  }));
}

/** Values the sample order in the preview carries, as Commerce would store them. */
export const SAMPLE_ORDER_ATTRIBUTES: Record<string, string> = {
  delivery_notes: "Leave it with the neighbour at number 12.",
  gift_message: "Happy birthday, Sam!",
  heard_from: "friend",
  is_gift: "1",
  po_number: "PO-20391",
};

function read(): FieldDefinition[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as FieldDefinition[];
    }
  } catch {
    // Storage blocked or corrupt: start from the examples.
  }
  return seedFields();
}

function write(fields: FieldDefinition[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
  } catch {
    // Storage blocked: changes last until the page reloads.
  }
}

function sorted(fields: FieldDefinition[]): FieldDefinition[] {
  return [...fields].sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code),
  );
}

const wait = () => new Promise((resolve) => setTimeout(resolve, 150));

/**
 * The Admin API without App Builder: fields live in this browser's localStorage and are checked
 * with the same engine as the field-save action. For local preview only.
 */
export function createPreviewApi(): FieldsApi {
  let fields = read();

  return {
    async deleteField(code) {
      await wait();
      const dependants = fields.filter((field) =>
        (field.conditions ?? []).some((condition) => condition.field === code),
      );
      if (dependants.length) {
        throw new ApiError("Invalid checkout field", [
          `remove the conditions on ${dependants.map((field) => `"${field.code}"`).join(", ")} first: they depend on this field`,
        ]);
      }
      const before = fields.length;
      fields = fields.filter((field) => field.code !== code);
      write(fields);
      return { deleted: fields.length < before };
    },

    async listFields() {
      await wait();
      return {
        examples: structuredClone(DEFAULT_FIELDS as FieldDefinition[]),
        fields: sorted(structuredClone(fields)),
      };
    },

    async lookups() {
      await wait();
      return {
        customerGroups: [
          { id: "0", label: "NOT LOGGED IN" },
          { id: "1", label: "General" },
          { id: "2", label: "Wholesale" },
          { id: "3", label: "Retailer" },
        ],
        storeViews: [
          { code: "default", id: 1, label: "Default Store View" },
          { code: "de", id: 2, label: "German Store View" },
        ],
      };
    },

    async orderValues(orderId) {
      await wait();
      return {
        incrementId: `0000${orderId.padStart(5, "0")}`,
        orderId,
        values: describeValues(fields, SAMPLE_ORDER_ATTRIBUTES),
      };
    },

    async saveField(field, previousCode) {
      await wait();
      const own = validateField(field);
      if (own.length) {
        throw new ApiError(`Invalid checkout field: ${own.join("; ")}`, own);
      }
      const renamed = previousCode && previousCode !== field.code;
      if (
        (renamed || !previousCode) &&
        fields.some((existing) => existing.code === field.code)
      ) {
        throw new ApiError("Invalid checkout field", [
          `a field with code "${field.code}" already exists`,
        ]);
      }
      const saved = { ...field, updatedAt: new Date().toISOString() };
      const next = [
        ...fields.filter(
          (existing) =>
            existing.code !== field.code && existing.code !== previousCode,
        ),
        saved,
      ];
      const problems = validateDefinitions(next);
      if (problems.length) {
        throw new ApiError("Invalid checkout field", problems);
      }
      fields = next;
      write(fields);
      return { field: saved };
    },
  };
}

/** Puts the examples back and forgets the preview's changes. */
export function resetPreview() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("checkout-fields:values");
  } catch {
    // Nothing stored.
  }
}
