// Types for checkout-fields-engine.js, used by the Admin page and the type check.
// Storefronts don't need this file.

export type FieldType = "text" | "textarea" | "select" | "checkbox" | "date";
export type Placement = "shipping" | "payment" | "review";
export type ConditionOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "filled"
  | "empty"
  | "checked"
  | "unchecked";
export type MatchMode = "all" | "any";

export type FieldOption = { value: string; label?: string };

export type FieldCondition = {
  field: string;
  operator: ConditionOperator | string;
  value?: string | number | string[];
};

export type FieldValidation = {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  minDate?: string;
  maxDate?: string;
};

export type FieldScope = {
  storeViews?: string[];
  customerGroups?: string[];
};

export type FieldDefinition = {
  code: string;
  label: string;
  type: FieldType;
  enabled?: boolean;
  required?: boolean;
  placement?: Placement;
  sortOrder?: number;
  placeholder?: string;
  help?: string;
  default?: string | boolean;
  options?: FieldOption[];
  validation?: FieldValidation;
  scope?: FieldScope;
  conditions?: FieldCondition[];
  match?: MatchMode;
  showInEmail?: boolean;
  updatedAt?: string;
};

export type FieldValue = string | boolean;
export type FieldValues = Record<string, FieldValue | undefined>;
export type ShopperContext = {
  storeView?: string;
  customerGroup?: string | number;
};
export type ValidationResult = {
  valid: boolean;
  values: Record<string, FieldValue>;
  errors: Record<string, string>;
};
export type ValueRow = { code: string; label: string; value: string };
export type CustomAttribute = { attribute_code: string; value: string };

export const FIELD_TYPES: FieldType[];
export const PLACEMENTS: Placement[];
export const CONDITION_OPERATORS: ConditionOperator[];
export const MATCH_MODES: MatchMode[];
export const CODE_PATTERN: RegExp;
export const STORE_CODE_PATTERN: RegExp;
export const GROUP_ID_PATTERN: RegExp;
export const ISO_DATE: RegExp;
export const GUEST_GROUP: string;
export const MAX_FIELDS: number;
export const MAX_VALUE_LENGTH: number;
export const MAX_LABEL_LENGTH: number;
export const MAX_TEXT_LENGTH: number;
export const MAX_OPTIONS: number;
export const MAX_CONDITIONS: number;
export const MAX_PATTERN_LENGTH: number;
export const MAX_DAYS: number;

export function toList(value: unknown): string[];
export function patternProblem(pattern: unknown): string | null;
export function compilePattern(pattern: string): RegExp | null;
export function isIsoDate(value: unknown): boolean;
export function today(now?: number, timeZone?: string): string;
export function isDateSpec(spec: unknown): boolean;
export function resolveDate(
  spec: string | undefined,
  todayDate: string,
): string | null;
export function validateField(
  field: unknown,
  options?: { codes?: Set<string> },
): string[];
export function validateDefinitions(fields: unknown): string[];
export function sortFields<T extends Partial<FieldDefinition>>(fields: T[]): T[];
export function inScope(
  field: Partial<FieldDefinition>,
  context?: ShopperContext,
): boolean;
export function fieldsFor(
  fields: FieldDefinition[] | unknown,
  context?: ShopperContext,
): FieldDefinition[];
export function publicFields(
  fields: FieldDefinition[] | unknown,
  options?: { storeView?: string },
): FieldDefinition[];
export function visibleFields(
  fields: FieldDefinition[],
  values?: FieldValues,
): FieldDefinition[];
export function normaliseValue(
  field: FieldDefinition,
  raw: unknown,
): FieldValue | undefined;
export function defaultValue(field: FieldDefinition): FieldValue;
export function validateValue(
  field: FieldDefinition,
  value: FieldValue | undefined,
  options?: { todayDate?: string },
): string | null;
export function validateValues(
  fields: FieldDefinition[],
  rawValues: unknown,
  options?: ShopperContext & { todayDate?: string },
): ValidationResult;
export function formatValue(
  field: FieldDefinition | undefined,
  value: unknown,
): string;
export function describeValues(
  fields: FieldDefinition[] | unknown,
  values: Record<string, unknown> | unknown,
  options?: { emailOnly?: boolean },
): ValueRow[];
export function toAttributeValue(value: unknown): string;
export function toCustomAttributes(
  fields: FieldDefinition[],
  values?: FieldValues,
): CustomAttribute[];
export function parseCustomAttributes(
  input: unknown,
  depth?: number,
): Record<string, string>;
