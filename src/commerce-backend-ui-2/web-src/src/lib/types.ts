import type { FieldDefinition, ValueRow } from "#engine";

export type {
  ConditionOperator,
  FieldCondition,
  FieldDefinition,
  FieldOption,
  FieldType,
  FieldValidation,
  MatchMode,
  Placement,
  ValueRow,
} from "#engine";

export type StoreView = { code: string; id: number; label: string };
export type CustomerGroup = { id: string; label: string };

export type Lookups = {
  storeViews: StoreView[];
  customerGroups: CustomerGroup[];
  unavailable?: boolean;
};

export type FieldsList = {
  fields: FieldDefinition[];
  examples: FieldDefinition[];
};

export type OrderValues = {
  orderId: string;
  incrementId: string | null;
  values: ValueRow[];
};
