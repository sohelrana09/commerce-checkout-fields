# Architecture

```text
 Commerce Admin                          App Builder (I/O Runtime)                    Storefront (EDS)
 ┌──────────────────────────┐            ┌───────────────────────────────┐           ┌────────────────────────────┐
 │ Checkout Fields page     │  IMS auth  │ CheckoutFieldsAdmin/*         │           │ checkout-fields.js         │
 │ (Admin UI SDK, React     ├───────────►│ fields-list, field-save,      │           │  renderCheckoutFields()    │
 │  Spectrum 2)             │            │ field-delete, lookups,        │           │  validateCheckoutFields()  │
 │  └ live preview ─────────┼──┐         │ order-values                  │           │  saveCheckoutFields()      │
 │ Order view button page ──┼──┼────────►└──────────────┬────────────────┘           └──┬──────────────┬──────────┘
 │ Order grid column ───────┼──┼──┐                     │ App Builder Database          │ GET ?store=   │ GraphQL
 └──────────────────────────┘  │  │                     ▼ (checkout_fields)             │ (cached)      │ setCustomAttributesOnCart
                               │  │      ┌───────────────────────────────┐              │               ▼
                               │  │      │ checkout-fields/fields        │◄─────────────┘     ┌────────────────────────┐
                               │  │      │ public, per store view        │                    │ Adobe Commerce         │
                               │  │      └───────────────────────────────┘                    │ cart custom attributes │
                               │  │      ┌───────────────────────────────┐  webhook (signed)  │   ── placeOrder ──►    │
                               │  │      │ checkout-fields/validate-order│◄───────────────────┤ order custom attributes│
                               │  │      │ same engine, real store/group │  success/exception │                        │
                               │  │      └───────────────────────────────┘───────────────────►│                        │
                               │  │      ┌───────────────────────────────┐  REST orders       │                        │
                               │  └─────►│ checkout-fields/order-grid    ├───────────────────►│                        │
                               │         └───────────────────────────────┘                    └────────────────────────┘
                               └── checkout-fields-engine.js  (one module, imported by all of them)
```

## Where data lives

| Data | Where | Why |
|---|---|---|
| Field definitions | App Builder Database Storage, collection `checkout_fields` (unique index on `code`), or `CHECKOUT_FIELDS` | Small, edited rarely, read through a cache. |
| Settings | App Management business configuration (`@adobe/aio-commerce-lib-config`) | Merchants change them in the Commerce Admin. |
| Shopper values | The cart, then the order, as Commerce **custom attributes** | Commerce copies them from quote to order, and every order API, export and integration sees them. The app stores no shopper data. |

## Flows

**Checkout.** The kit fetches `checkout-fields/fields?store=<view>` (public, `Cache-Control: public, max-age=<cacheSeconds>`, so the CDN and browser cache it) and keeps it in `sessionStorage`. It renders the fields for each placement, runs the engine's checks as the shopper types and on **Place order**, then calls `setCustomAttributesOnCart` with the drop-in's own `fetchGraphQl` (the shopper's cart and token) before `placeOrder`.

**Place order.** Commerce calls `checkout-fields/validate-order` on `observer.sales_order_place_before`, with the order's custom attributes, store ID and customer group. The action:

1. verifies the webhook signature when `COMMERCE_WEBHOOKS_PUBLIC_KEY` is set (otherwise relies on the action's Adobe IMS authentication);
2. answers `success` when the app is switched off, blocking is off or there are no fields;
3. resolves the store view code (Commerce REST `store/storeViews`, cached 10 minutes; if that fails, store-specific fields are skipped rather than wrongly required);
4. runs `validateValues` with the store view and customer group, and answers `exception` with the errors joined into one message, so Commerce doesn't save the order and the drop-in shows the message;
5. on an internal error, logs it and answers `success`: an app problem never stops sales.

The webhook is registered with `required: false`, a 1 second soft timeout and a 5 second timeout, so Commerce places the order if the app can't be reached.

**Admin.** The Checkout Fields page calls the `CheckoutFieldsAdmin` actions with the Admin user's IMS token. `field-save` runs `validateField` and then `validateDefinitions` on the whole set (duplicate codes, unknown condition fields, loops, the 50-field limit), so a broken set can't be saved. The live preview imports the storefront kit and its CSS directly, so it is the storefront.

**Orders.** The order grid column calls `checkout-fields/order-grid` with order IDs. It looks them up with one REST search (entity ID or increment ID) and returns a short summary per order. The order view button opens the app's `/order` page, which calls `order-values` for one order and lists every saved value with its current label (a deleted field shows its code).

## Design choices

- **One engine.** The schema, visibility and validation rules are written once, in plain ES modules with no DOM or Node APIs, and imported by the storefront, the Admin page (`#engine`) and the actions. Browser and server can't drift.
- **The server decides.** Anything the browser does can be skipped, so the order check is the only one that counts. The browser checks are for the shopper's convenience.
- **Values that don't apply are dropped.** The webhook ignores values for unknown, hidden or out-of-scope fields; the kit sends `""` for fields that apply but are hidden. Nothing the merchant didn't ask for is checked as if it were.
- **Fail open, visibly.** A failed feed shows no fields; a failed app lets orders through and logs an error. Checkout fields are never worth losing an order over.
- **Safe input.** Merchant patterns are anchored, capped at 200 characters and refused if they nest quantifiers or use backreferences; values are capped at 2,000 characters before any pattern runs. All merchant and shopper text is rendered with `textContent`.

## Tests

`npm test` runs the unit tests with coverage (thresholds 90%): the engine, the fields repository and settings against an in-memory database, the Commerce REST helpers, webhook signatures, each action through its handler, and the storefront kit in happy-dom.
