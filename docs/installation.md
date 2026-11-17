# Installation

Checkout Fields is an App Builder app. You deploy it to an App Builder workspace, install it on a Commerce instance through App Management (which sets up the Admin menu, the order grid column, the order view button, the settings, the place-order webhook and the database), then add the storefront kit to your Edge Delivery Services checkout.

## Requirements

- **Commerce:** Adobe Commerce as a Cloud Service, or Adobe Commerce 2.4.7+ on cloud infrastructure or on-premises with the out-of-process extensibility modules: `magento/out-of-process-custom-attributes` (custom attributes on carts and orders), Adobe Commerce Webhooks, and the Admin UI SDK.
- **Storefront:** Edge Delivery Services with the Commerce checkout drop-in. Any other storefront can use the engine directly, see the [storefront guide](../storefront/README.md#other-storefronts).
- **App Builder:** a project in the **same Adobe organization** as the Commerce instance. App Management only lists apps from the instance's own organization.
- **Tools:** Node.js 24 (`.nvmrc`) and the Adobe I/O CLI: `npm install -g @adobe/aio-cli`.

## App Builder project

In the [Adobe Developer Console](https://developer.adobe.com/console), create a project from the **App Builder** template. In each workspace you deploy to (for example Stage and Production), add:

| Service | Why |
|---|---|
| I/O Management API | App Management. |
| App Builder Data Services | App Builder Database Storage for the field definitions. |
| OAuth Server-to-Server credential | Commerce REST (store views, customer groups, orders) and database access. |

`install.yaml` lists the same APIs for the Adobe Commerce Marketplace.

## Deploy

```bash
git clone https://github.com/sohelrana09/commerce-checkout-fields.git
cd commerce-checkout-fields
npm install

aio login
aio console org select
aio console project select
aio console workspace select
aio app use --merge
cp env.dist .env

aio app deploy
```

`aio app deploy` prints the URL of each web action. Keep the one for `checkout-fields/fields`: the storefront needs it.

## Install in Commerce

1. In the Commerce Admin, open **Apps → App Management**, find **Checkout Fields** and choose **Install**. The install step creates the `checkout_fields` collection and its indexes, and App Management registers the place-order webhook, the order grid column, the order view button and the Admin menu.
2. Give the **Checkout Fields** ACL resource to the admin roles that should manage fields (**System → Permissions → User Roles**).
3. Optional: **Configure** the app to change the settings (see the [README](../README.md#configuration)).
4. Open **Checkout Fields** in the Admin menu, start from an example or add a field, check it in **Preview checkout**, and switch it on.

## Verify webhook signatures (recommended)

Commerce can sign each webhook request. When `COMMERCE_WEBHOOKS_PUBLIC_KEY` is set, `validate-order` rejects requests without a valid signature.

1. In the Commerce Admin, open **Stores → Settings → Configuration → Adobe Services → Webhooks**, turn on **Digital Signature Configuration** and **Regenerate Key Pair**.
2. Copy the public key into `.env`, on one line with `\n` for the line breaks or as a single base64 body:

   ```bash
   COMMERCE_WEBHOOKS_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----"
   ```

3. Run `aio app deploy` again.

## Storefront

Follow the [storefront guide](../storefront/README.md): copy three files, add the feed URL to your configuration, and add a few lines to the `commerce-checkout` block. Test it on a branch preview before merging.

## Checking it works

1. Add a required field for all store views and groups, and switch it on.
2. Open the feed URL with `?store=default`: the field is listed.
3. On the branch preview, start a checkout, leave the field empty and press **Place order**: the field shows its error and the order isn't placed.
4. Fill it in and place the order. In the Admin, the order grid's **Checkout fields** column and the order's **Checkout Fields** button show the value.
5. To check the server side, place an order through GraphQL without the value (or with blocking on and the storefront check removed): Commerce refuses it with the field's message.

## Troubleshooting

| Symptom | Check |
|---|---|
| No fields at checkout | The browser console for "Checkout fields unavailable"; the endpoint in the storefront config; **Show checkout fields** is on; the field is enabled and in scope for the store view. Definitions are cached for **Cache seconds**: wait, or open a new tab. |
| Orders aren't checked | **Block orders** is on; the webhook is registered (**System → Webhooks** list, or `aio app logs` for `validate-order`); the signature key, if set, matches the one Commerce uses. |
| Orders go through without the check, and `aio app logs` shows 401 for `validate-order` | The signature doesn't verify. Copy the public key again, or remove `COMMERCE_WEBHOOKS_PUBLIC_KEY` and redeploy to confirm. |
| "Field ... is required" although it was filled | The storefront didn't call `saveCheckoutFields` before `placeOrder`, or the `setCustomAttributesOnCart` call failed (browser network tab). |
| Grid column is empty | `aio app logs` for `order-grid`; the OAuth credential can read orders. |
| Store view or group pickers are empty in the editor | The OAuth credential can't reach Commerce REST. You can still type codes and IDs. |

## Updating

Pull the new version, run `npm install` and `aio app deploy`. When the CHANGELOG says the app configuration changed (menu, webhooks, settings), reinstall or update the app in App Management.

## Uninstalling

Uninstall the app in **Apps → App Management**. The values already saved on orders stay on them as custom attributes; only the field definitions go with the app's database.
