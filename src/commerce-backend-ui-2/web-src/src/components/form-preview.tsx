import { Button } from "@react-spectrum/s2/Button";
import { Content } from "@react-spectrum/s2/Content";
import { Heading } from "@react-spectrum/s2/Heading";
import { InlineAlert } from "@react-spectrum/s2/InlineAlert";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Text } from "@react-spectrum/s2/Text";
import { useEffect, useRef, useState } from "react";

import { PLACEMENTS, toCustomAttributes } from "#engine";

// The storefront kit itself and its stylesheet, so the preview is exactly what shoppers get.
import {
  applicableFields,
  getCheckoutFieldValues,
  initCheckoutFields,
  renderCheckoutFields,
  validateCheckoutFields,
} from "../../../../../storefront/scripts/checkout-fields.js";
import "../../../../../storefront/styles/checkout-fields.css";

import { PLACEMENT_LABELS } from "../lib/fields.ts";

import type { Key } from "react-aria-components";
import type { FieldDefinition, Lookups, Placement } from "../lib/types.ts";

export type FormPreviewProps = {
  fields: FieldDefinition[];
  lookups: Lookups | null;
  /** Shown above the form, e.g. that a draft is previewed even while switched off. */
  note?: string;
};

type Check = { valid: boolean; errors: string[]; payload: string } | null;

const ALL = "__all__";

const frame = style({
  backgroundColor: "gray-25",
  borderColor: "gray-300",
  borderRadius: "lg",
  borderStyle: "solid",
  borderWidth: 1,
  display: "flex",
  flexDirection: "column",
  gap: 24,
  maxWidth: 560,
  padding: 24,
});

const sectionTitle = style({
  color: "gray-600",
  font: "ui-sm",
  fontWeight: "bold",
  margin: 0,
  textTransform: "uppercase",
});

/**
 * A live checkout form: the fields rendered by the storefront kit for a chosen store view and
 * customer group, with conditional fields reacting as you type. "Check" runs the same
 * validation as Place order and shows the custom attributes the kit would send to Commerce.
 */
export function FormPreview({ fields, lookups, note }: FormPreviewProps) {
  const [storeView, setStoreView] = useState<string>(ALL);
  const [group, setGroup] = useState<string>("0");
  const [check, setCheck] = useState<Check>(null);
  const refs = useRef<Partial<Record<Placement, HTMLDivElement | null>>>({});

  useEffect(() => {
    initCheckoutFields({
      customerGroup: group,
      fields,
      storeView: storeView === ALL ? undefined : storeView,
    });
    setCheck(null);
    for (const placement of PLACEMENTS) {
      const container = refs.current[placement];
      if (container) {
        renderCheckoutFields(container, { placement });
      }
    }
  }, [fields, storeView, group]);

  const runCheck = () => {
    const valid = validateCheckoutFields({ focus: true });
    const result = getCheckoutFieldValues();
    setCheck({
      errors: Object.values(result.errors),
      payload: JSON.stringify(
        toCustomAttributes(applicableFields(), result.values),
        null,
        2,
      ),
      valid,
    });
  };

  const groups = lookups?.customerGroups.length
    ? lookups.customerGroups
    : [{ id: "0", label: "NOT LOGGED IN" }];

  return (
    <div
      className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
      <div
        className={style({
          alignItems: "end",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
        })}>
        <Picker
          label="Store view"
          onSelectionChange={(key: Key | null) =>
            setStoreView(String(key ?? ALL))
          }
          selectedKey={storeView}>
          {[
            <PickerItem id={ALL} key={ALL}>
              Any store view
            </PickerItem>,
            ...(lookups?.storeViews ?? []).map((view) => (
              <PickerItem id={view.code} key={view.code}>
                {view.label}
              </PickerItem>
            )),
          ]}
        </Picker>
        <Picker
          label="Customer group"
          onSelectionChange={(key: Key | null) => setGroup(String(key ?? "0"))}
          selectedKey={group}>
          {groups.map((item) => (
            <PickerItem id={item.id} key={item.id}>
              {item.label}
            </PickerItem>
          ))}
        </Picker>
        <Button onPress={runCheck} variant="secondary">
          Check like Place order
        </Button>
      </div>
      {note && <Text>{note}</Text>}

      <div className={frame} data-testid="checkout-preview">
        {PLACEMENTS.map((placement) => (
          <section
            className={style({
              display: "flex",
              flexDirection: "column",
              gap: 8,
            })}
            key={placement}>
            <p className={sectionTitle}>{PLACEMENT_LABELS[placement]}</p>
            <div
              ref={(element) => {
                refs.current[placement] = element;
              }}
            />
          </section>
        ))}
      </div>

      {check && (
        <InlineAlert variant={check.valid ? "positive" : "negative"}>
          <Heading>
            {check.valid
              ? "The order would go through"
              : "Place order would be blocked"}
          </Heading>
          <Content>
            {check.errors.map((message) => (
              <div key={message}>{message}</div>
            ))}
            <Text>
              Custom attributes sent to Commerce with setCustomAttributesOnCart:
            </Text>
            <pre
              className={style({
                font: "code-sm",
                margin: 0,
                overflow: "auto",
                whiteSpace: "pre-wrap",
              })}>
              {check.payload}
            </pre>
          </Content>
        </InlineAlert>
      )}
    </div>
  );
}
