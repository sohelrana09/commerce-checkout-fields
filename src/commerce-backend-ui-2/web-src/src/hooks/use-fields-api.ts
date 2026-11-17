import { useIms } from "@adobe/aio-commerce-lib-admin-ui/web";
import { createContext, useCallback, useContext, useMemo } from "react";

import actionUrls from "../config.json";

import type {
  FieldDefinition,
  FieldsList,
  Lookups,
  OrderValues,
} from "../lib/types.ts";

const PACKAGE = "CheckoutFieldsAdmin";

export class ApiError extends Error {
  public readonly errors: string[];

  public constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.errors = errors;
  }
}

/** What the Admin page needs from the backend. The preview supplies an in-browser version. */
export type FieldsApi = {
  deleteField: (code: string) => Promise<{ deleted: boolean }>;
  listFields: () => Promise<FieldsList>;
  lookups: () => Promise<Lookups>;
  orderValues: (orderId: string) => Promise<OrderValues>;
  saveField: (
    field: FieldDefinition,
    previousCode?: string,
  ) => Promise<{ field: FieldDefinition }>;
};

/**
 * Calls the app's Admin web actions with the signed-in admin's IMS token. Action URLs come from
 * `config.json`, which the App Builder CLI writes at build and dev time.
 */
export function useActionsApi(): FieldsApi {
  const ims = useIms();
  if (ims.error) {
    throw ims.error;
  }
  const { imsToken, imsOrgId } = ims.data;

  const invoke = useCallback(
    async <T>(action: string, payload: object = {}): Promise<T> => {
      const url = (actionUrls as Record<string, string>)[
        `${PACKAGE}/${action}`
      ];
      const response = await fetch(url, {
        body: JSON.stringify(payload),
        headers: {
          authorization: `Bearer ${imsToken}`,
          "Content-Type": "application/json",
          "x-gw-ims-org-id": imsOrgId,
        },
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new ApiError(
          body?.error ?? `Request failed (${response.status})`,
          body?.errors ?? [],
        );
      }
      return body as T;
    },
    [imsOrgId, imsToken],
  );

  return useMemo(
    () => ({
      deleteField: (code: string) =>
        invoke<{ deleted: boolean }>("field-delete", { code }),
      listFields: () => invoke<FieldsList>("fields-list"),
      lookups: () => invoke<Lookups>("lookups"),
      orderValues: (orderId: string) =>
        invoke<OrderValues>("order-values", { orderId }),
      saveField: (field: FieldDefinition, previousCode?: string) =>
        invoke<{ field: FieldDefinition }>("field-save", {
          field,
          previousCode,
        }),
    }),
    [invoke],
  );
}

export const FieldsApiContext = createContext<FieldsApi | null>(null);

/** The backend the page talks to: the App Builder actions, or the preview's in-browser store. */
export function useFieldsApi(): FieldsApi {
  const api = useContext(FieldsApiContext);
  if (!api) {
    throw new Error("FieldsApiContext is missing");
  }
  return api;
}
