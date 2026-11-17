import { ActionButton } from "@react-spectrum/s2/ActionButton";
import { Button } from "@react-spectrum/s2/Button";
import { Content } from "@react-spectrum/s2/Content";
import { Heading } from "@react-spectrum/s2/Heading";
import { IllustratedMessage } from "@react-spectrum/s2/IllustratedMessage";
import { InlineAlert } from "@react-spectrum/s2/InlineAlert";
import Refresh from "@react-spectrum/s2/icons/Refresh";
import { Menu, MenuItem, MenuTrigger } from "@react-spectrum/s2/Menu";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { StatusLight } from "@react-spectrum/s2/StatusLight";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import {
  Cell,
  Column,
  Row,
  TableBody,
  TableHeader,
  TableView,
} from "@react-spectrum/s2/TableView";
import { useCallback } from "react";

import {
  describeConditions,
  describeScope,
  PLACEMENT_LABELS,
  TYPE_LABELS,
} from "../lib/fields.ts";

import type { Key } from "react-aria-components";
import type { FieldDefinition, Lookups } from "../lib/types.ts";

export type FieldsListProps = {
  error: string | null;
  examples: FieldDefinition[];
  fields: FieldDefinition[];
  loading: boolean;
  lookups: Lookups | null;
  onCreate: (template?: FieldDefinition) => void;
  onEdit: (code: string) => void;
  onReload: () => void;
};

export function FieldsList({
  fields,
  examples,
  loading,
  error,
  lookups,
  onReload,
  onEdit,
  onCreate,
}: FieldsListProps) {
  const handleRowAction = useCallback(
    (key: Key) => onEdit(String(key)),
    [onEdit],
  );
  const handleNew = useCallback(() => onCreate(), [onCreate]);
  const handleTemplate = useCallback(
    (key: Key) => {
      const example = examples.find((field) => field.code === key);
      if (example) {
        onCreate(example);
      }
    },
    [examples, onCreate],
  );
  const renderEmptyState = useCallback(
    () => (
      <IllustratedMessage>
        <Heading>No checkout fields yet</Heading>
        <Content>Add a field, or start from an example.</Content>
      </IllustratedMessage>
    ),
    [],
  );

  return (
    <main
      className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
      <div className={style({ alignItems: "center", display: "flex", gap: 8 })}>
        <Heading
          level={1}
          styles={style({ flexGrow: 1, font: "heading-lg", margin: 0 })}>
          Checkout fields
        </Heading>
        <ActionButton
          aria-label="Reload"
          isDisabled={loading}
          onPress={onReload}>
          <Refresh />
        </ActionButton>
        <MenuTrigger>
          <Button variant="secondary">Start from example</Button>
          <Menu items={examples} onAction={handleTemplate}>
            {(example) => (
              <MenuItem id={example.code}>{example.label}</MenuItem>
            )}
          </Menu>
        </MenuTrigger>
        <Button onPress={handleNew} variant="accent">
          Add field
        </Button>
      </div>

      {error && (
        <InlineAlert variant="negative">
          <Heading>Couldn't load checkout fields</Heading>
          <Content>{error}</Content>
        </InlineAlert>
      )}

      {loading ? (
        <div
          className={style({
            display: "flex",
            justifyContent: "center",
            marginTop: 32,
          })}>
          <ProgressCircle
            aria-label="Loading checkout fields"
            isIndeterminate
            size="L"
          />
        </div>
      ) : (
        <TableView
          aria-label="Checkout fields"
          onAction={handleRowAction}
          selectionMode="none"
          styles={style({ minHeight: 320, width: "full" })}>
          <TableHeader>
            <Column isRowHeader>Label</Column>
            <Column>Code</Column>
            <Column>Type</Column>
            <Column>Where</Column>
            <Column>Shown when</Column>
            <Column>Scope</Column>
            <Column>Status</Column>
          </TableHeader>
          <TableBody items={fields} renderEmptyState={renderEmptyState}>
            {(field) => (
              <Row id={field.code}>
                <Cell>{`${field.label}${field.required ? " *" : ""}`}</Cell>
                <Cell>{field.code}</Cell>
                <Cell>{TYPE_LABELS[field.type] ?? field.type}</Cell>
                <Cell>{PLACEMENT_LABELS[field.placement ?? "review"]}</Cell>
                <Cell>{describeConditions(field)}</Cell>
                <Cell>{describeScope(field, lookups)}</Cell>
                <Cell>
                  <StatusLight
                    size="S"
                    variant={field.enabled === false ? "neutral" : "positive"}>
                    {field.enabled === false ? "Off" : "On"}
                  </StatusLight>
                </Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      )}
    </main>
  );
}
