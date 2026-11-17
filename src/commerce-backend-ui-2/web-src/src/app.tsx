import {
  createExtensionApp,
  useOrderViewButtonContext,
} from "@adobe/aio-commerce-lib-admin-ui/web";
import "@react-spectrum/s2/page.css";

import config from "#app.commerce.config";

import { FieldsApiContext, useActionsApi } from "./hooks/use-fields-api.ts";
import { CheckoutFieldsPage } from "./pages/checkout-fields-page.tsx";
import { OrderValuesPage } from "./pages/order-values-page.tsx";

function AdminPage() {
  const api = useActionsApi();
  return (
    <FieldsApiContext value={api}>
      <CheckoutFieldsPage />
    </FieldsApiContext>
  );
}

/** Opened by the "Checkout Fields" button on the Admin order view. */
function OrderPage() {
  const api = useActionsApi();
  const context = useOrderViewButtonContext();
  return (
    <FieldsApiContext value={api}>
      <OrderValuesPage orderId={context.data?.orderId ?? null} />
    </FieldsApiContext>
  );
}

createExtensionApp({
  menu: <AdminPage />,
  metadata: {
    extensionId: config.metadata.id,
  },
  routes: [{ element: <OrderPage />, path: "/order" }],
});
