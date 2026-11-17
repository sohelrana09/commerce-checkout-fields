import { Content } from "@react-spectrum/s2/Content";
import { Heading } from "@react-spectrum/s2/Heading";
import { IllustratedMessage } from "@react-spectrum/s2/IllustratedMessage";
import { InlineAlert } from "@react-spectrum/s2/InlineAlert";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import {
  Cell,
  Column,
  Row,
  TableBody,
  TableHeader,
  TableView,
} from "@react-spectrum/s2/TableView";
import { useCallback, useEffect, useState } from "react";

import { useFieldsApi } from "../hooks/use-fields-api.ts";

import type { OrderValues } from "../lib/types.ts";

export type OrderValuesPageProps = { orderId: string | null };

/**
 * The checkout field values on one order, opened from the "Checkout Fields" button on the
 * Commerce Admin order view (Admin UI SDK order view button).
 */
export function OrderValuesPage({ orderId }: OrderValuesPageProps) {
  const api = useFieldsApi();
  const [data, setData] = useState<OrderValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError(
        "No order was given. Open this page from an order in the Admin.",
      );
      return;
    }
    api
      .orderValues(orderId)
      .then(setData, (loadError: Error) => setError(loadError.message));
  }, [api, orderId]);

  const renderEmptyState = useCallback(
    () => (
      <IllustratedMessage>
        <Heading>No checkout field values</Heading>
        <Content>The shopper didn't fill in any checkout fields.</Content>
      </IllustratedMessage>
    ),
    [],
  );

  return (
    <main
      className={style({
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 24,
      })}>
      <Heading level={1} styles={style({ font: "heading-lg", margin: 0 })}>
        {data?.incrementId
          ? `Checkout fields on order #${data.incrementId}`
          : "Checkout fields on this order"}
      </Heading>
      {error && (
        <InlineAlert variant="negative">
          <Heading>Couldn't load the order</Heading>
          <Content>{error}</Content>
        </InlineAlert>
      )}
      {!(data || error) && (
        <ProgressCircle aria-label="Loading the order" isIndeterminate />
      )}
      {data && (
        <TableView
          aria-label="Checkout field values"
          styles={style({ minHeight: 160, width: "full" })}>
          <TableHeader>
            <Column isRowHeader>Field</Column>
            <Column>Value</Column>
          </TableHeader>
          <TableBody items={data.values} renderEmptyState={renderEmptyState}>
            {(row) => (
              <Row id={row.code}>
                <Cell>{row.label}</Cell>
                <Cell>{row.value}</Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      )}
    </main>
  );
}
