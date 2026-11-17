// Types for checkout-fields.js, used by the Admin page's live form preview and the type check.
// Storefronts don't need this file.

import type {
  CustomAttribute,
  FieldDefinition,
  FieldValues,
  Placement,
  ValidationResult,
} from "./checkout-fields-engine.js";

export type CheckoutFieldsOptions = {
  endpoint?: string;
  storeView?: string;
  customerGroup?: string | number;
  cacheSeconds?: number;
  fields?: FieldDefinition[];
  values?: FieldValues;
};

export type GraphQlClient = (
  query: string,
  options: { method: string; variables: Record<string, unknown> },
) => Promise<{ data?: unknown; errors?: { message: string }[] }>;

export function initCheckoutFields(options?: CheckoutFieldsOptions): void;
export function loadFieldDefinitions(): Promise<FieldDefinition[]>;
export function applicableFields(): FieldDefinition[];
export function customerGroupFromUid(uid: unknown): string | undefined;
export function getCheckoutFieldValues(): ValidationResult;
export function renderCheckoutFields(
  container: HTMLElement,
  options?: { placement?: Placement; title?: string },
): Promise<HTMLElement>;
export function setCustomerGroup(
  customerGroup: string | number | undefined,
): Promise<void>;
export function validateCheckoutFields(options?: { focus?: boolean }): boolean;
export function buildSaveMutation(attributes: CustomAttribute[]): string;
export function saveCheckoutFields(
  cartId: string,
  options?: { fetchGraphQl?: GraphQlClient },
): Promise<Record<string, string | boolean>>;
export function resetCheckoutFields(): void;
