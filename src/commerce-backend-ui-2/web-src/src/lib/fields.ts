import { CODE_PATTERN } from "#engine";

import type {
  FieldCondition,
  FieldDefinition,
  FieldType,
  FieldValidation,
  Lookups,
  Placement,
} from "./types.ts";

export const TYPE_LABELS: Record<FieldType, string> = {
  checkbox: "Checkbox",
  date: "Date",
  select: "Dropdown (select)",
  text: "Text",
  textarea: "Text area",
};

export const PLACEMENT_LABELS: Record<Placement, string> = {
  payment: "After payment methods",
  review: "Before Place order",
  shipping: "After shipping methods",
};

export const OPERATOR_LABELS: Record<string, string> = {
  checked: "is ticked",
  empty: "is empty",
  eq: "is",
  filled: "is filled in",
  in: "is one of",
  neq: "is not",
  not_in: "is not one of",
  unchecked: "is not ticked",
};

const NO_VALUE = new Set(["filled", "empty", "checked", "unchecked"]);

export function needsValue(operator: string): boolean {
  return !NO_VALUE.has(operator);
}

/** Operators that make sense for a field of this type. */
export function operatorsFor(type: FieldType | undefined): string[] {
  if (type === "checkbox") {
    return ["checked", "unchecked"];
  }
  if (type === "select") {
    return ["eq", "neq", "in", "not_in", "filled", "empty"];
  }
  return ["filled", "empty", "eq", "neq", "in", "not_in"];
}

export function toCode(text: string): string {
  const code = text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/gu, "_")
    .replace(/^[^a-z]+|_+$/gu, "")
    .slice(0, 64);
  return CODE_PATTERN.test(code) ? code : "";
}

export function emptyField(): FieldDefinition {
  return {
    code: "",
    conditions: [],
    enabled: false,
    label: "",
    match: "all",
    placement: "review",
    required: false,
    scope: { customerGroups: [], storeViews: [] },
    showInEmail: true,
    sortOrder: 10,
    type: "text",
    validation: {},
  };
}

/** A deep copy the editor can change without touching the list's copy. */
export function editableCopy(field: FieldDefinition): FieldDefinition {
  const { updatedAt: _updatedAt, ...rest } = structuredClone(field);
  return {
    ...emptyField(),
    ...rest,
    scope: { customerGroups: [], storeViews: [], ...rest.scope },
    validation: { ...rest.validation },
  };
}

function compact<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== undefined && item !== "" && item !== null,
    ),
  ) as Partial<T>;
}

function keptValidation(
  type: FieldType,
  validation: FieldValidation,
): FieldValidation {
  if (type === "text" || type === "textarea") {
    return compact({
      maxLength: validation.maxLength,
      minLength: validation.minLength,
      pattern: validation.pattern?.trim(),
      patternMessage: validation.patternMessage?.trim(),
    });
  }
  if (type === "date") {
    return compact({
      maxDate: validation.maxDate?.trim(),
      minDate: validation.minDate?.trim(),
    });
  }
  return {};
}

/**
 * Drops settings that don't apply to the field's type, and empty optional values, before
 * saving or previewing, so stored definitions stay tidy and valid.
 */
export function cleanField(field: FieldDefinition): FieldDefinition {
  const { type } = field;
  const kept = keptValidation(type, field.validation ?? {});
  const conditions: FieldCondition[] = (field.conditions ?? [])
    .filter((condition) => condition.field)
    .map((condition) =>
      needsValue(condition.operator)
        ? condition
        : { field: condition.field, operator: condition.operator },
    );
  const { options, ...rest } = field;
  const result: FieldDefinition = {
    ...rest,
    conditions,
    help: field.help?.trim() || undefined,
    label: field.label.trim(),
    placeholder:
      type === "checkbox" ? undefined : field.placeholder?.trim() || undefined,
    validation: kept,
  };
  if (type === "select") {
    result.options = (options ?? [])
      .map((option) => ({
        ...(option.label?.trim() ? { label: option.label.trim() } : {}),
        value: option.value.trim(),
      }))
      .filter((option) => option.value);
  }
  if (type === "checkbox") {
    result.default = field.default === true ? true : undefined;
  } else if (typeof field.default !== "string" || field.default === "") {
    result.default = undefined;
  }
  return compact(result) as FieldDefinition;
}

export function describeConditions(field: FieldDefinition): string {
  const conditions = field.conditions ?? [];
  if (!conditions.length) {
    return "Always";
  }
  const parts = conditions.map((condition) => {
    const operator = OPERATOR_LABELS[condition.operator] ?? condition.operator;
    return needsValue(condition.operator)
      ? `${condition.field} ${operator} ${String(condition.value ?? "")}`
      : `${condition.field} ${operator}`;
  });
  return parts.join(field.match === "any" ? " or " : " and ");
}

export function describeScope(
  field: FieldDefinition,
  lookups: Lookups | null,
): string {
  const stores = field.scope?.storeViews ?? [];
  const groups = field.scope?.customerGroups ?? [];
  const groupName = (id: string) =>
    lookups?.customerGroups.find((group) => group.id === String(id))?.label ??
    `group ${id}`;
  const parts = [
    stores.length ? stores.join(", ") : "All store views",
    groups.length ? groups.map(groupName).join(", ") : "all customers",
  ];
  return parts.join(" · ");
}

export function newCondition(fields: FieldDefinition[]): FieldCondition {
  const [target] = fields;
  const [operator] = operatorsFor(target?.type);
  return { field: target?.code ?? "", operator };
}
