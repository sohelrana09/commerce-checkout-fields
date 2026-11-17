/**
 * Local preview of the Admin pages, without Commerce or App Builder: `npm run admin:preview`.
 * The pages are the same; only their backend is swapped for fields kept in this browser.
 */
import "@react-spectrum/s2/page.css";

import { Button } from "@react-spectrum/s2/Button";
import { Content } from "@react-spectrum/s2/Content";
import { Heading } from "@react-spectrum/s2/Heading";
import { InlineAlert } from "@react-spectrum/s2/InlineAlert";
import { Provider } from "@react-spectrum/s2/Provider";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@react-spectrum/s2/SegmentedControl";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { FieldsApiContext } from "./hooks/use-fields-api.ts";
import { createPreviewApi, resetPreview } from "./lib/preview-api.ts";
import { CheckoutFieldsPage } from "./pages/checkout-fields-page.tsx";
import { OrderValuesPage } from "./pages/order-values-page.tsx";

type Screen = "menu" | "order";

function PreviewApp() {
  const api = useMemo(() => createPreviewApi(), []);
  const [screen, setScreen] = useState<Screen>(
    window.location.hash === "#/order" ? "order" : "menu",
  );
  const choose = (next: Screen) => {
    setScreen(next);
    window.location.hash = next === "order" ? "#/order" : "";
  };
  return (
    <Provider background="base" styles={style({ minHeight: "screen" })}>
      <div
        className={style({
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingTop: 24,
          paddingX: 24,
        })}>
        <InlineAlert variant="informative">
          <Heading>Local preview</Heading>
          <Content>
            <div
              className={style({
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "space-between",
              })}>
              <span>
                The Checkout Fields Admin pages running without Commerce or App
                Builder. Fields are kept in this browser only.
              </span>
              <Button
                onPress={() => {
                  resetPreview();
                  window.location.reload();
                }}
                size="S"
                variant="secondary">
                Reset to examples
              </Button>
            </div>
          </Content>
        </InlineAlert>
        <SegmentedControl
          aria-label="Admin page"
          onSelectionChange={(key) => choose(key as Screen)}
          selectedKey={screen}>
          <SegmentedControlItem id="menu">
            Checkout Fields page
          </SegmentedControlItem>
          <SegmentedControlItem id="order">
            Order view button (sample order)
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
      <FieldsApiContext value={api}>
        {screen === "menu" ? (
          <CheckoutFieldsPage />
        ) : (
          <OrderValuesPage orderId="1042" />
        )}
      </FieldsApiContext>
    </Provider>
  );
}

const root = document.querySelector("#root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <PreviewApp />
    </StrictMode>,
  );
}
