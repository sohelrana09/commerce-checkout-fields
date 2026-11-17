import { AlertDialog } from "@react-spectrum/s2/AlertDialog";
import { Button } from "@react-spectrum/s2/Button";
import { ButtonGroup } from "@react-spectrum/s2/ButtonGroup";
import { Checkbox } from "@react-spectrum/s2/Checkbox";
import { Content } from "@react-spectrum/s2/Content";
import { DialogTrigger } from "@react-spectrum/s2/Dialog";
import { Heading } from "@react-spectrum/s2/Heading";
import { InlineAlert } from "@react-spectrum/s2/InlineAlert";
import { NumberField } from "@react-spectrum/s2/NumberField";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { Switch } from "@react-spectrum/s2/Switch";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Tab, TabList, TabPanel, Tabs } from "@react-spectrum/s2/Tabs";
import { Text } from "@react-spectrum/s2/Text";
import { TextField } from "@react-spectrum/s2/TextField";
import { useMemo, useState } from "react";

import {
  MAX_LABEL_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_VALUE_LENGTH,
  validateDefinitions,
} from "#engine";

import { ApiError } from "../hooks/use-fields-api.ts";
import {
  cleanField,
  PLACEMENT_LABELS,
  TYPE_LABELS,
  toCode,
} from "../lib/fields.ts";
import { ConditionsEditor } from "./conditions-editor.tsx";
import { FormPreview } from "./form-preview.tsx";
import { OptionsEditor } from "./options-editor.tsx";

import type { Key } from "react-aria-components";
import type {
  FieldDefinition,
  FieldType,
  FieldValidation,
  Lookups,
  Placement,
} from "../lib/types.ts";

export type FieldEditorProps = {
  initial: FieldDefinition;
  /** Every saved field, for conditions and the preview. */
  fields: FieldDefinition[];
  lookups: Lookups | null;
  onCancel: () => void;
  onDelete: (code: string) => Promise<void>;
  onSave: (field: FieldDefinition, previousCode?: string) => Promise<void>;
  /** The saved code when editing; undefined for a new field. */
  originalCode?: string;
};

const column = style({
  display: "flex",
  flexDirection: "column",
  gap: 16,
  paddingY: 16,
});
const grid = style({
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
});

function optionalNumber(value: number): number | undefined {
  return Number.isNaN(value) ? undefined : value;
}

function ListField({
  label,
  description,
  items,
  value,
  onChange,
}: {
  label: string;
  description: string;
  items: { id: string; label: string }[] | null;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!items?.length) {
    return (
      <TextField
        description={`${description} Separate them with commas.`}
        label={label}
        onChange={(text) =>
          onChange(
            text
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
        value={value.join(", ")}
      />
    );
  }
  return (
    <Picker
      description={description}
      items={items}
      label={label}
      onChange={(keys) => onChange([...keys].map(String))}
      selectionMode="multiple"
      value={value}>
      {(item) => (
        <PickerItem id={item.id} textValue={item.label}>
          {item.label}
        </PickerItem>
      )}
    </Picker>
  );
}

function ValidationPanel({
  field,
  setValidation,
}: {
  field: FieldDefinition;
  setValidation: (patch: Partial<FieldValidation>) => void;
}) {
  const validation = field.validation ?? {};
  if (field.type === "text" || field.type === "textarea") {
    return (
      <>
        <div className={grid}>
          <NumberField
            description="Empty: no minimum."
            label="Minimum length"
            maxValue={MAX_VALUE_LENGTH}
            minValue={0}
            onChange={(value) =>
              setValidation({ minLength: optionalNumber(value) })
            }
            value={validation.minLength ?? Number.NaN}
          />
          <NumberField
            description={`Empty: up to ${MAX_VALUE_LENGTH}.`}
            label="Maximum length"
            maxValue={MAX_VALUE_LENGTH}
            minValue={1}
            onChange={(value) =>
              setValidation({ maxLength: optionalNumber(value) })
            }
            value={validation.maxLength ?? Number.NaN}
          />
        </div>
        <TextField
          description="A regular expression the whole value must match, e.g. [A-Z]{2}[0-9]+. Nested quantifiers and backreferences aren't allowed."
          label="Pattern"
          onChange={(pattern) => setValidation({ pattern })}
          value={validation.pattern ?? ""}
        />
        <TextField
          description="Shown to shoppers when the value doesn't match the pattern."
          label="Pattern error message"
          maxLength={MAX_TEXT_LENGTH}
          onChange={(patternMessage) => setValidation({ patternMessage })}
          value={validation.patternMessage ?? ""}
        />
      </>
    );
  }
  if (field.type === "date") {
    return (
      <div className={grid}>
        <TextField
          description='YYYY-MM-DD, "today", or "today+2" for two days from now.'
          label="Earliest date"
          onChange={(minDate) => setValidation({ minDate: minDate.trim() })}
          value={validation.minDate ?? ""}
        />
        <TextField
          description='YYYY-MM-DD, "today", or "today+60".'
          label="Latest date"
          onChange={(maxDate) => setValidation({ maxDate: maxDate.trim() })}
          value={validation.maxDate ?? ""}
        />
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <Text>
        A required checkbox must be ticked to place the order, for example to
        accept extra terms.
      </Text>
    );
  }
  return (
    <Text>
      Shoppers pick one of the options; anything else is refused when the order
      is placed.
    </Text>
  );
}

const DEFAULT_HELP: Record<FieldType, string> = {
  checkbox: "",
  date: "YYYY-MM-DD, or empty.",
  select: "An option value, or empty.",
  text: "Pre-filled value, or empty.",
  textarea: "Pre-filled value, or empty.",
};

function BasicsPanel({
  field,
  isNew,
  set,
  changeType,
}: {
  field: FieldDefinition;
  isNew: boolean;
  set: (patch: Partial<FieldDefinition>) => void;
  changeType: (key: Key | null) => void;
}) {
  return (
    <div className={column}>
      <Switch
        isSelected={field.enabled !== false}
        onChange={(enabled) => set({ enabled })}>
        Show this field at checkout
      </Switch>
      <div className={grid}>
        <TextField
          description="What shoppers see above the field."
          isRequired
          label="Label"
          maxLength={MAX_LABEL_LENGTH}
          onChange={(label) =>
            set({
              code:
                isNew && (!field.code || field.code === toCode(field.label))
                  ? toCode(label)
                  : field.code,
              label,
            })
          }
          value={field.label}
        />
        <TextField
          description="The custom attribute code on the cart and order: a-z, 0-9 and _."
          isRequired
          label="Code"
          onChange={(code) => set({ code: code.toLowerCase().trim() })}
          value={field.code}
        />
        <Picker
          label="Type"
          onSelectionChange={changeType}
          selectedKey={field.type}>
          {Object.entries(TYPE_LABELS).map(([id, label]) => (
            <PickerItem id={id} key={id}>
              {label}
            </PickerItem>
          ))}
        </Picker>
        <Picker
          label="Where in checkout"
          onSelectionChange={(key: Key | null) =>
            set({ placement: String(key) as Placement })
          }
          selectedKey={field.placement ?? "review"}>
          {Object.entries(PLACEMENT_LABELS).map(([id, label]) => (
            <PickerItem id={id} key={id}>
              {label}
            </PickerItem>
          ))}
        </Picker>
        <NumberField
          description="Lower numbers come first."
          label="Sort order"
          onChange={(value) => set({ sortOrder: optionalNumber(value) })}
          value={field.sortOrder ?? 0}
        />
      </div>
      <div className={style({ display: "flex", flexWrap: "wrap", gap: 24 })}>
        <Checkbox
          isSelected={field.required === true}
          onChange={(required) => set({ required })}>
          Required
        </Checkbox>
        <Checkbox
          isSelected={field.showInEmail !== false}
          onChange={(showInEmail) => set({ showInEmail })}>
          Include in order emails
        </Checkbox>
      </div>
      <div className={grid}>
        {field.type !== "checkbox" && (
          <TextField
            label={field.type === "select" ? "Prompt" : "Placeholder"}
            maxLength={MAX_TEXT_LENGTH}
            onChange={(placeholder) => set({ placeholder })}
            value={field.placeholder ?? ""}
          />
        )}
        <TextField
          description="Shown under the field."
          label="Help text"
          maxLength={MAX_TEXT_LENGTH}
          onChange={(help) => set({ help })}
          value={field.help ?? ""}
        />
        {field.type === "checkbox" ? (
          <Checkbox
            isSelected={field.default === true}
            onChange={(checked) => set({ default: checked })}>
            Ticked by default
          </Checkbox>
        ) : (
          <TextField
            description={DEFAULT_HELP[field.type]}
            label="Default value"
            onChange={(value) => set({ default: value })}
            value={typeof field.default === "string" ? field.default : ""}
          />
        )}
      </div>
    </div>
  );
}

export function FieldEditor({
  initial,
  fields,
  originalCode,
  lookups,
  onSave,
  onDelete,
  onCancel,
}: FieldEditorProps) {
  const [field, setField] = useState<FieldDefinition>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const isNew = originalCode === undefined;
  const set = (patch: Partial<FieldDefinition>) =>
    setField((current) => ({ ...current, ...patch }));
  const setValidation = (patch: Partial<FieldValidation>) =>
    setField((current) => ({
      ...current,
      validation: { ...current.validation, ...patch },
    }));

  const others = useMemo(
    () =>
      fields.filter(
        (item) => item.code !== originalCode && item.code !== field.code,
      ),
    [fields, originalCode, field.code],
  );
  const draft = useMemo(() => cleanField(field), [field]);
  const problems = useMemo(
    () => validateDefinitions([...others, draft]),
    [others, draft],
  );
  // The whole form as shoppers would see it, with this draft switched on in place.
  const previewFields = useMemo(
    () => [...others, { ...draft, enabled: true }],
    [others, draft],
  );

  const handleSave = async () => {
    if (problems.length) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      await onSave(draft, originalCode);
    } catch (error) {
      setErrors(
        error instanceof ApiError && error.errors.length
          ? error.errors
          : [(error as Error).message],
      );
    } finally {
      setSaving(false);
    }
  };

  const changeType = (key: Key | null) => {
    const type = String(key) as FieldType;
    set({
      default: undefined,
      options:
        type === "select" && !field.options?.length
          ? [
              { label: "Option 1", value: "option_1" },
              { label: "Option 2", value: "option_2" },
            ]
          : field.options,
      type,
    });
  };

  return (
    <main
      className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
      <div className={style({ alignItems: "center", display: "flex", gap: 8 })}>
        <Heading level={1} styles={style({ flexGrow: 1 })}>
          {isNew ? "New checkout field" : field.label || originalCode}
        </Heading>
        <ButtonGroup>
          {!isNew && (
            <DialogTrigger>
              <Button variant="negative">Delete</Button>
              <AlertDialog
                onPrimaryAction={() => onDelete(originalCode)}
                primaryActionLabel="Delete"
                secondaryActionLabel="Cancel"
                title="Delete this field?"
                variant="destructive">
                “{field.label}” disappears from checkout once browsers and the
                CDN refresh the field definitions (a few minutes). Values
                already saved on orders stay on those orders.
              </AlertDialog>
            </DialogTrigger>
          )}
          <Button onPress={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button
            isDisabled={!(field.code && field.label)}
            isPending={saving}
            onPress={handleSave}
            variant="accent">
            Save
          </Button>
        </ButtonGroup>
      </div>

      {errors.length > 0 && (
        <InlineAlert variant="negative">
          <Heading>The field wasn't saved</Heading>
          <Content>
            {errors.map((message) => (
              <div key={message}>{message}</div>
            ))}
          </Content>
        </InlineAlert>
      )}

      <Tabs aria-label="Field settings">
        <TabList>
          <Tab id="field">Field</Tab>
          <Tab id="validation">
            {field.type === "select" ? "Options" : "Validation"}
          </Tab>
          <Tab id="visibility">Visibility</Tab>
        </TabList>

        <TabPanel id="field">
          <BasicsPanel
            changeType={changeType}
            field={field}
            isNew={isNew}
            set={set}
          />
        </TabPanel>

        <TabPanel id="validation">
          <div className={column}>
            {field.type === "select" ? (
              <OptionsEditor
                onChange={(options) => set({ options })}
                options={field.options ?? []}
              />
            ) : (
              <ValidationPanel field={field} setValidation={setValidation} />
            )}
          </div>
        </TabPanel>

        <TabPanel id="visibility">
          <div className={column}>
            <ConditionsEditor
              conditions={field.conditions ?? []}
              fields={others}
              match={field.match ?? "all"}
              onChange={(conditions) => set({ conditions })}
              onMatchChange={(match) => set({ match })}
            />
            <ListField
              description="Leave empty for every store view."
              items={
                lookups?.storeViews.map((view) => ({
                  id: view.code,
                  label: `${view.label} (${view.code})`,
                })) ?? null
              }
              label="Store views"
              onChange={(storeViews) =>
                set({ scope: { ...field.scope, storeViews } })
              }
              value={field.scope?.storeViews ?? []}
            />
            <ListField
              description="Leave empty for every customer, signed in or not."
              items={lookups?.customerGroups ?? null}
              label="Customer groups"
              onChange={(customerGroups) =>
                set({ scope: { ...field.scope, customerGroups } })
              }
              value={field.scope?.customerGroups ?? []}
            />
          </div>
        </TabPanel>
      </Tabs>

      <Heading level={2} styles={style({ font: "heading-sm", marginTop: 16 })}>
        Live preview
      </Heading>
      {problems.length > 0 && field.code && field.label && (
        <Text>Fix before saving: {problems.join("; ")}.</Text>
      )}
      <FormPreview
        fields={previewFields}
        lookups={lookups}
        note="The whole checkout form with this draft, shown even while it's switched off. Saved fields that are off are hidden."
      />
    </main>
  );
}
