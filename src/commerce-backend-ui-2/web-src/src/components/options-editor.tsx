import { ActionButton } from "@react-spectrum/s2/ActionButton";
import { Button } from "@react-spectrum/s2/Button";
import Delete from "@react-spectrum/s2/icons/Delete";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Text } from "@react-spectrum/s2/Text";
import { TextField } from "@react-spectrum/s2/TextField";

import { MAX_OPTIONS } from "#engine";

import type { FieldOption } from "../lib/types.ts";

export type OptionsEditorProps = {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
};

const row = style({
  alignItems: "end",
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(120px, 1fr) minmax(160px, 2fr) auto",
});

/** The choices of a dropdown: the stored value and the text shoppers see. */
export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const update = (index: number, patch: Partial<FieldOption>) =>
    onChange(
      options.map((option, i) =>
        i === index ? { ...option, ...patch } : option,
      ),
    );
  return (
    <div
      className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
      <Text>
        The value is saved on the order; shoppers see the label (or the value
        when the label is empty).
      </Text>
      {options.map((option, index) => (
        <div className={row} key={index}>
          <TextField
            aria-label={`Option ${index + 1} value`}
            label={index === 0 ? "Value" : undefined}
            onChange={(value) => update(index, { value })}
            value={option.value}
          />
          <TextField
            aria-label={`Option ${index + 1} label`}
            label={index === 0 ? "Label" : undefined}
            onChange={(label) => update(index, { label })}
            value={option.label ?? ""}
          />
          <ActionButton
            aria-label={`Remove option ${index + 1}`}
            onPress={() => onChange(options.filter((_, i) => i !== index))}>
            <Delete />
          </ActionButton>
        </div>
      ))}
      <div>
        <Button
          isDisabled={options.length >= MAX_OPTIONS}
          onPress={() => onChange([...options, { label: "", value: "" }])}
          variant="secondary">
          Add option
        </Button>
      </div>
    </div>
  );
}
