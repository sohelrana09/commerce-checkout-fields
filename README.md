# Checkout Fields for Adobe Commerce

[![CI](https://github.com/sohelrana09/commerce-checkout-fields/actions/workflows/ci.yml/badge.svg)](https://github.com/sohelrana09/commerce-checkout-fields/actions/workflows/ci.yml)
[![Adobe App Builder](https://img.shields.io/badge/Adobe-App%20Builder-eb1000)](https://developer.adobe.com/app-builder/)
[![Adobe Commerce](https://img.shields.io/badge/Adobe%20Commerce-SaaS%20%26%20PaaS-eb1000)](https://business.adobe.com/products/commerce.html)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-5fa04e)](https://nodejs.org/)
[![Edge Delivery Services](https://img.shields.io/badge/Edge%20Delivery-checkout%20kit-1473e6)](storefront/README.md)
[![React Spectrum 2](https://img.shields.io/badge/React%20Spectrum-2-5c5ce0)](https://react-spectrum.adobe.com/)
[![GitHub stars](https://img.shields.io/github/stars/sohelrana09/commerce-checkout-fields?style=social)](https://github.com/sohelrana09/commerce-checkout-fields)
[![License](https://img.shields.io/github/license/sohelrana09/commerce-checkout-fields)](LICENSE)

**Your own fields at checkout, saved on the order: an Adobe Commerce App Builder app.**

Built by [Sohel Rana](https://sohelrana.io), Adobe Certified Master Architect and Claude Certified Architect – Foundations (CCAR-F).

[Quick start](#quick-start) · [How it works](#how-it-works) · [Field format](docs/fields.md) · [Storefront guide](storefront/README.md) · [Contributing](CONTRIBUTING.md)

Checkout Fields lets merchants add extra fields to checkout: a **PO number**, **delivery notes**, a **VAT ID**, a **gift message**, a preferred **delivery date** or a **"How did you hear about us?"** dropdown.
Merchants define the fields in the Commerce Admin, with no code and no deployment. Shoppers fill them in on the Edge Delivery Services checkout, and the values are saved on the order.

It replaces the "order attributes" modules merchants used to buy for Magento, and it runs **out of process**. So it works on **Adobe Commerce as a Cloud Service (SaaS)**, where PHP modules can't be installed, as well as on Adobe Commerce on cloud infrastructure and on-premises (PaaS).

**Key features**

- **Five field types:** text, text area, dropdown, checkbox and date, placed after shipping methods, after payment methods or right before **Place order**.
- **Validation that can't be skipped:** required fields, minimum and maximum length, a pattern (regular expression) with your own error message, dropdown options, and earliest and latest dates such as `today+2`. The same rules run in the browser and again on the server when the order is placed.
- **Conditional fields:** show a field only when another one has a value, for example **Gift message** only when **This order is a gift** is ticked.
- **Scope:** limit a field to some store views or customer groups, for example a trade account number for the Wholesale group only.
- **Saved where Commerce keeps them:** values become the order's own **custom attributes**, which Commerce copies from the cart to the order. They show in an order grid column and from a **Checkout Fields** button on the order view.
- **A live preview:** the Admin editor draws the whole checkout form with the storefront's own code, so you see and test a field before shoppers do.

---

## Contents

- [Who it is for](#who-it-is-for)
- [What shoppers see](#what-shoppers-see)
- [What you manage as a merchant](#what-you-manage-as-a-merchant)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Commands](#commands)
- [Project structure](#project-structure)
- [What needs a live instance](#what-needs-a-live-instance)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

## Who it is for

- **Merchants** on Adobe Commerce who need more from checkout than an address: B2B buyers with purchase orders and VAT numbers, gift shops, stores that schedule deliveries.
- **Agencies and developers** building Edge Delivery Services storefronts who want order attributes without a PHP module, on SaaS and PaaS alike.

## What shoppers see

| Feature | What it means in practice |
|---|---|
| **Fields in the right step** | Each field sits where it belongs: delivery notes and dates after shipping methods, a VAT ID after payment methods, a PO number before **Place order**. |
| **Help and errors as they type** | Each field has a label, optional placeholder and help text. Errors appear once a field is left, and Place order jumps to the first problem. |
| **Fields that react** | A conditional field appears and disappears as other answers change. A field that's hidden is never required, and its value is cleared from the cart. |
| **Only what applies to them** | A store view or customer group sees only its own fields. |
| **Nothing lost on reload** | Values are kept for the browser tab, so a page refresh doesn't wipe a long delivery note. |
| **Checkout never breaks** | If the field definitions can't load, checkout shows no extra fields and the order still goes through. |

## What you manage as a merchant

| You want to... | Where |
|---|---|
| Add, change or remove a field | **Checkout Fields** in the Admin menu. Start from an example (PO number, delivery notes, VAT ID, gift checkbox and message, "How did you hear about us?", delivery date) or from scratch. |
| See a field before shoppers do | The editor's **Live preview**, or **Preview checkout**: the whole form for a store view and customer group, with **Check like Place order**. |
| See what a shopper entered | The **Checkout fields** column in **Sales → Orders**, or the **Checkout Fields** button on an order. |
| Stop orders with missing or invalid values | On by default. **Apps → App Management → Checkout Fields → Configure → Block orders whose checkout field values are missing or invalid**. |
| Switch every field off, or change the cache time | The same **Configure** form. |
| Keep field definitions in version control | `CHECKOUT_FIELDS` in `.env` (see [Configuration](#configuration)). |

## How it works

```
Commerce Admin ──> Checkout Fields page (Admin UI SDK, React Spectrum 2)
                     │  IMS sign-in
                     v
               App Builder (I/O Runtime) ──> App Builder Database Storage (checkout_fields)
                     │
                     │  checkout-fields/fields: public, cacheable, per store view
                     v
Browser ──> EDS checkout (commerce-checkout block + checkout drop-in)
              └─ storefront kit: renders the fields, checks them on Place order
                   │  GraphQL setCustomAttributesOnCart (cart custom attributes)
                   v
Commerce ──> placeOrder: cart custom attributes are copied to the order
              │  webhook observer.sales_order_place_before
              v
           checkout-fields/validate-order: same engine, real store view and group
              └─ success, or exception with the field errors (the order is not saved)

Admin order grid column ──> checkout-fields/order-grid ──> Commerce REST orders
Admin order view button  ──> the app's order page ──> CheckoutFieldsAdmin/order-values
```

Key design choices:

- **Commerce's own storage.** Values are cart and order **custom attributes** (`setCustomAttributesOnCart`, `CustomerOrder.custom_attributes`), the supported way to put extra data on orders on Adobe Commerce as a Cloud Service. Commerce copies them from the cart to the order, and every API and integration that reads orders sees them. The app keeps only the field definitions.
- **One engine.** [`checkout-fields-engine.js`](storefront/scripts/checkout-fields-engine.js) has no dependencies and is shared by the storefront kit, the Admin preview and the actions. A shopper sees exactly the errors the server would return.
- **The server decides.** The storefront checks are for the shopper's convenience. The place-order webhook checks the values again with the order's real store view and customer group, so a shopper who skips the browser checks or calls GraphQL directly can't place an order with missing or invalid values.
- **An outage never stops sales.** If the app itself fails (database or Commerce unreachable), the webhook lets the order through and logs the error. The webhook is registered as not required, so Commerce does the same if the app can't be reached.
- **Safe by default.** Labels, help and errors are rendered as text. Merchant patterns may not nest quantifiers or use backreferences, and values are capped at 2,000 characters, so a pattern can't be used to slow the server down. The webhook can verify Commerce's RSA signature.

More in [docs/architecture.md](docs/architecture.md), and what Adobe supports today, with sources, in [docs/accs-support.md](docs/accs-support.md).

## Quick start

**You need:** Node.js 24 (`.nvmrc` pins it), the Adobe I/O CLI (`npm install -g @adobe/aio-cli`), an App Builder project in the same Adobe organization as your Commerce instance, and an Edge Delivery Services storefront with the Commerce drop-ins.

1. **Clone and install**

   ```bash
   git clone https://github.com/sohelrana09/commerce-checkout-fields.git
   cd commerce-checkout-fields
   npm install
   npm test
   ```

2. **Try it locally (optional)**

   ```bash
   npm run demo
   ```

   Open http://localhost:4351. It is a mock checkout with the storefront kit and the example fields in `demo/fields.json`. Change the store view and customer group, fill in the fields and press **Place order** to see the errors, or the `setCustomAttributesOnCart` mutation the kit would send.

   To see the Admin pages without Commerce or an Adobe account:

   ```bash
   npm run admin:preview
   ```

   Open http://localhost:4350/preview.html. It is the real Admin page (list, editor, live preview and **Preview checkout**) and the order view page, with fields kept in your browser's local storage and seeded with the examples. **Reset to examples** starts over.

3. **Deploy**

   In the [Adobe Developer Console](https://developer.adobe.com/console), add **I/O Management API**, **App Builder Data Services** and an **OAuth Server-to-Server** credential to the workspace. Then:

   ```bash
   aio login
   aio app use --merge
   cp env.dist .env
   aio app deploy
   ```

   Note the URL it prints for `checkout-fields/fields`: it is the storefront's field-definitions feed.

4. **Install in Commerce**

   In the Commerce Admin, open **Apps → App Management** and install **Checkout Fields**. Installing registers the place-order webhook, the order grid column and the order view button, and sets up the database. Give the Checkout Fields ACL resources to the admin roles that manage fields. Open **Checkout Fields**, start from an example and switch it on.

5. **Add the storefront kit**

   Copy the three files in [`storefront/`](storefront/README.md) into your storefront, and add a few lines to `blocks/commerce-checkout/commerce-checkout.js`: a container for the fields, a check in `handleValidation`, and `saveCheckoutFields(cartId)` right before `placeOrder`. The [storefront guide](storefront/README.md) has the code.

   <details>
   <summary>Keeping field definitions in code instead</summary>

   Put the fields as a JSON array in `CHECKOUT_FIELDS` in `.env` (format: [docs/fields.md](docs/fields.md)) and run `aio app deploy`. While it is set, the feed and the webhook use those fields and ignore the Admin page.

   </details>

The full guide, with settings, signature verification and troubleshooting, is [docs/installation.md](docs/installation.md).

## Configuration

**App Management** (Apps → App Management → Checkout Fields → Configure):

| Setting | Purpose |
|---|---|
| Show checkout fields on the storefront | The master switch (on by default). Off: the feed returns no fields and orders aren't checked. |
| Block orders whose checkout field values are missing or invalid | On by default. Off: the webhook lets every order through, and only the storefront checks the values. |
| Cache seconds | How long browsers and the CDN may keep the field definitions, 0 to 86400 (default 300). A saved change reaches shoppers within this time. |

**`.env`** (deployed as action inputs):

| Variable | Purpose |
|---|---|
| `LOG_LEVEL` | `debug`, `info` (default), `warn` or `error`. |
| `CHECKOUT_FIELDS` | Optional. A JSON array of fields; when set, the feed and the webhook use these instead of the Admin page's fields. |
| `COMMERCE_WEBHOOKS_PUBLIC_KEY` | Optional. The webhook public key from **Stores → Configuration → Adobe Services → Webhooks**. When set, unsigned webhook requests are rejected. |

**Storefront kit** (`initCheckoutFields` options):

| Option | Purpose |
|---|---|
| `endpoint` | The `checkout-fields/fields` URL. Without it the kit shows no fields. |
| `storeView` | The store view code, so the feed sends only that view's fields. |
| `customerGroup` | The shopper's customer group ID (`"0"` for guests). Unknown: group-limited fields are shown to everyone, and the server applies the real group. |
| `cacheSeconds` | How long a browser tab keeps the definitions (default 300). |

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests with coverage (Vitest, happy-dom). No Adobe account needed: the database, Commerce and I/O Runtime are faked. |
| `npm run code:check` / `npm run code:fix` | Biome lint and format. |
| `npm run typecheck` | TypeScript check of the Admin page, with `checkJs` on the shared JavaScript. |
| `npm run lint:storefront` | The storefront kit and demo against the EDS boilerplate's own ESLint (Airbnb) and Stylelint. Set `EDS_STOREFRONT` to a boilerplate checkout. |
| `npm run demo` | The storefront kit in a mock checkout, at http://localhost:4351. |
| `npm run admin:preview` | The Admin pages with an in-browser store, at http://localhost:4350/preview.html. No Commerce or Adobe account needed. `PORT` changes the port. |
| `aio app dev` | The Admin page locally, against the workspace's actions. |
| `aio app build` / `aio app deploy` | Build, or build and deploy to the selected workspace. |

## Project structure

```
app.commerce.config.ts       App Management: Admin menu, order grid column, order view button,
                             settings, place-order webhook, install step
storefront/                  the storefront kit (copied into an EDS storefront)
    scripts/checkout-fields-engine.js   schema, validation and visibility, shared by everything (#engine)
    scripts/checkout-fields.js          loads the feed, renders fields, saves them on the cart
    styles/checkout-fields.css          field layout, using the drop-in design tokens
src/common/fields/           database, fields repository, settings, field sources, Commerce REST, examples
src/common/webhook.js        raw webhook bodies and signature verification
src/commerce-extensibility-1/actions/
    fields/                  the public storefront field-definitions feed
    validate-order/          the place-order validation webhook
    order-grid/              the Admin order grid column
src/commerce-backend-ui-2/
    actions/                 Admin actions: fields-list, field-save, field-delete, lookups, order-values
    web-src/                 the Admin pages (React Spectrum 2)
scripts/setup-database.js    the App Management install step
scripts/admin-preview.js     local Admin preview (Parcel)
scripts/lint-storefront.js   lints the kit with the EDS boilerplate's rules
demo/                        local mock checkout
docs/                        guides
test/                        unit tests
```

## What needs a live instance

Everything here is unit tested and checked in local previews, but it hasn't been installed on a live Adobe Commerce as a Cloud Service instance yet. These parts depend on Commerce behaviour that only a live instance can confirm; [docs/accs-support.md](docs/accs-support.md) lists each one with how to check it:

- the exact shape of `custom_attributes_serializable` in the `observer.sales_order_place_before` payload (the webhook reads every known shape);
- whether the order grid sends entity IDs or increment IDs (the grid action accepts both);
- the order view button's `path` format for the app's `/order` route;
- the Admin order view's **Custom Attributes** tab, and whether order email templates can print custom attributes;
- how to read a signed-in shopper's customer group in GraphQL on your instance.

## Roadmap

Done: field engine with five types, required, length, pattern and date limits, options, conditions and scope; public cacheable feed; place-order validation webhook with signature verification; Admin page with examples, editor, live preview and **Preview checkout**; order grid column and order view page; App Management settings; fields in code; storefront kit for the checkout drop-in; local demo and Admin preview; unit tests at 98% coverage.

Next:
- Install and check on a live Adobe Commerce as a Cloud Service instance, then submit to the Adobe Commerce Marketplace.
- Order confirmation emails: a template snippet once the variable support is confirmed, or an app-sent summary email.
- Show the values on the storefront order confirmation and the customer's order history (order drop-in).
- Translations for labels, help and errors per store view.
- Validate edits made on the Admin order view's **Custom Attributes** tab (`observer.sales_order_view_custom_attributes_update_before`).

Ideas and pull requests are welcome, see [Contributing](#contributing).

## FAQ

**Is this an official Adobe product?**
No. Checkout Fields is an independent open-source project. Adobe, Adobe Commerce and App Builder are trademarks of Adobe.

**Where are the values stored?**
On the order itself, as Commerce custom attributes. The app's database holds only the field definitions. Uninstalling the app doesn't remove values from past orders.

**Can a shopper get around a required field?**
Not while **Block orders** is on: the webhook checks every order before Commerce saves it, whatever the browser sent. Only the place-order webhook decides; the storefront checks just save the shopper a round trip.

**What happens if the app is down?**
Orders go through without the server check, and the storefront still checks the values. The error is in the app logs.

**Are the field definitions public?**
Yes, because the shopper's browser needs them. The feed sends labels, help, options, validation and scope, never email settings or timestamps. Don't put anything secret in a field definition.

**Does it work without Edge Delivery Services?**
The engine has no dependencies, so any storefront can fetch the feed, call `validateValues(fields, values)` and send `toCustomAttributes(fields, values)` with `setCustomAttributesOnCart`. The server check works for every storefront and for orders placed through the API.

**Is it production-ready?**
It is tested (unit tests, the Admin preview and the kit in a mock checkout), but it hasn't been installed on a live Commerce instance yet. Before going live:
- install it on a Stage workspace and instance and work through [What needs a live instance](#what-needs-a-live-instance);
- turn on webhook signatures and set `COMMERCE_WEBHOOKS_PUBLIC_KEY`;
- add the storefront kit on a branch and place test orders as a guest and as a signed-in customer.

## Contributing

Bug fixes, new field types, storefront improvements and better documentation are all welcome. For larger changes, open an issue first so we can agree on the approach.

1. Fork the repository and create a branch: `git checkout -b feature/your-change`.
2. Make your change, following the [project structure](#project-structure): schema and validation logic goes in the engine with unit tests, server-only code in `src/common`, and actions stay thin.
3. Run the checks: `npm run code:check`, `npm run typecheck`, `npm test` and `npm run lint:storefront`, plus `npm run demo` for anything a shopper sees and `npm run admin:preview` for anything on the Admin page.
4. Commit, push the branch and open a pull request that says what changed and how you tested it.

The full guide is in [CONTRIBUTING.md](CONTRIBUTING.md). Please report security problems privately, see [SECURITY.md](SECURITY.md), and follow the [code of conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE). You may use, change and redistribute Checkout Fields, also in commercial projects, as long as the copyright notice stays.

---

Made with Adobe App Builder and Edge Delivery Services. If Checkout Fields helps you, please give it a star.
