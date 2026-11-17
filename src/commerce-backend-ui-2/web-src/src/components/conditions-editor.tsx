import { ActionButton } from "@react-spectrum/s2/ActionButton";
import { Button } from "@react-spectrum/s2/Button";
import Delete from "@react-spectrum/s2/icons/Delete";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@react-spectrum/s2/SegmentedControl";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Text } from "@react-spectrum/s2/Text";
import { TextField } from "@react-spectrum/s2/TextField";

import { MAX_CONDITIONS } from "#engine";

import {
  needsValue,
  newCondition,
  OPERATOR_LABELS,
  operatorsFor,
} from "../lib/fields.ts";

import type { Key } from "react-aria-components";
import type {
  FieldCondition,
  FieldDefinition,
  MatchMode,
} from "../lib/types.ts";

export type ConditionsEditorProps = {
  conditions: FieldCondition[];
  match: MatchMode;
  /** The other fields a condition can look at. */
  fields: FieldDefinition[];
  onChange: (conditions: FieldCondition[]) => void;
  onMatchChange: (match: MatchMode) => void;
};

const row = style({
  alignItems: "end",
  display: "grid",
  gap: 12,
  gridTemplateColumns: {
    default: "1fr",
    md: "minmax(160px, 1fr) minmax(140px, 1fr) minmax(160px, 1fr) auto",
  },
});

function valueInput(
  condition: FieldCondition,
  target: FieldDefinition | undefined,
  index: number,
  onChange: (condition: FieldCondition) => void,
) {
  if (!needsValue(condition.operator)) {
    return <div />;
  }
  const list = condition.operator === "in" || condition.operator === "not_in";
  if (target?.type === "select" && !list) {
    return (
      <Picker
        aria-label={`Condition ${index + 1} value`}
        label={index === 0 ? "Value" : undefined}
        onSelectionChange={(key: Key | null) =>
          onChange({ ...condition, value: String(key ?? "") })
        }
        selectedKey={String(condition.value ?? "") || null}>
        {(target.options ?? []).map((option) => (
          <PickerItem id={option.value} key={option.value}>
            {option.label || option.value}
          </PickerItem>
        ))}
      </Picker>
    );
  }
  return (
    <TextField
      aria-label={`Condition ${index + 1} value`}
      description={index === 0 && list ? "Separate values with commas." : ""}
      label={index === 0 ? "Value" : undefined}
      onChange={(value) => onChange({ ...condition, value })}
      value={
        Array.isArray(condition.value)
          ? condition.value.join(", ")
          : String(condition.value ?? "")
      }
    />
  );
}

/** "Show this field only when …" conditions on other fields. */
export function ConditionsEditor({
  conditions,
  match,
  fields,
  onChange,
  onMatchChange,
}: ConditionsEditorProps) {
  const update = (index: number, condition: FieldCondition) =>
    onChange(conditions.map((item, i) => (i === index ? condition : item)));

  if (!fields.length) {
    return (
      <Text>
        Add another field first: a field can only depend on other fields.
      </Text>
    );
  }

  return (
    <div
      className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
      <Text>
        {conditions.length
          ? "Shoppers see this field only when:"
          : "Shoppers always see this field. Add a condition to show it only when another field has a certain value."}
      </Text>
      {conditions.length > 1 && (
        <SegmentedControl
          aria-label="How conditions combine"
          onSelectionChange={(key) => onMatchChange(key as MatchMode)}
          selectedKey={match}>
          <SegmentedControlItem id="all">
            All conditions match
          </SegmentedControlItem>
          <SegmentedControlItem id="any">
            Any condition matches
          </SegmentedControlItem>
        </SegmentedControl>
      )}
      {conditions.map((condition, index) => {
        const target = fields.find((field) => field.code === condition.field);
        return (
          <div className={row} key={index}>
            <Picker
              aria-label={`Condition ${index + 1} field`}
              label={index === 0 ? "Field" : undefined}
              onSelectionChange={(key: Key | null) => {
                const next = fields.find((field) => field.code === key);
                update(index, {
                  field: String(key ?? ""),
                  operator: operatorsFor(next?.type)[0],
                });
              }}
              selectedKey={condition.field || null}>
              {fields.map((field) => (
                <PickerItem id={field.code} key={field.code}>
                  {field.label || field.code}
                </PickerItem>
              ))}
            </Picker>
            <Picker
              aria-label={`Condition ${index + 1} operator`}
              label={index === 0 ? "Operator" : undefined}
              onSelectionChange={(key: Key | null) =>
                update(index, {
                  ...condition,
                  operator: String(key ?? "filled"),
                })
              }
              selectedKey={condition.operator}>
              {operatorsFor(target?.type).map((id) => (
                <PickerItem id={id} key={id}>
                  {OPERATOR_LABELS[id] ?? id}
                </PickerItem>
              ))}
            </Picker>
            {valueInput(condition, target, index, (next) =>
              update(index, next),
            )}
            <ActionButton
              aria-label={`Remove condition ${index + 1}`}
              onPress={() =>
                onChange(conditions.filter((_, i) => i !== index))
              }>
              <Delete />
            </ActionButton>
          </div>
        );
      })}
      <div>
        <Button
          isDisabled={conditions.length >= MAX_CONDITIONS}
          onPress={() => onChange([...conditions, newCondition(fields)])}
          variant="secondary">
          Add condition
        </Button>
      </div>
    </div>
  );
}
