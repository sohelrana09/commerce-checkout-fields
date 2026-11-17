# Changelog

## v0.1.0 (2026-11-17)

The first release: extra checkout fields, saved on the order, for Adobe Commerce as a Cloud Service and PaaS, built as an App Builder app.

- **Field engine:** one dependency-free module (`storefront/scripts/checkout-fields-engine.js`) shared by the storefront kit, the Admin preview and the actions. Text, text area, dropdown, checkbox and date fields; required; minimum and maximum length; a pattern with its own message (nested quantifiers and backreferences are refused); dropdown options; earliest and latest dates such as `today+2`; conditional visibility on other fields; store view and customer group scope; three placements in the checkout ([docs/fields.md](docs/fields.md)).
- **Field definitions feed:** the public `checkout-fields/fields` action serves the enabled fields for a store view, without Admin-only data, with a `Cache-Control` the merchant sets.
- **Place-order validation:** the `checkout-fields/validate-order` webhook on `observer.sales_order_place_before` checks the order's custom attributes with its real store view and customer group, and stops the order with the field errors. It verifies Commerce's webhook signature when `COMMERCE_WEBHOOKS_PUBLIC_KEY` is set, and lets orders through if the app itself fails.
- **Values on the order:** values are saved as cart custom attributes (`setCustomAttributesOnCart`), which Commerce copies to the order. An order grid column and a **Checkout Fields** order view button show them in the Admin.
- **Admin page:** list, start from examples, edit and delete fields in the Commerce Admin (Admin UI SDK, React Spectrum 2), with a live preview drawn with the storefront kit and a **Preview checkout** view that checks values like **Place order**.
- **Settings:** a master switch, blocking invalid orders and the feed's cache time, in App Management. The install step sets up App Builder Database Storage.
- **Fields in code:** `CHECKOUT_FIELDS` serves fields from `.env` instead of the database.
- **Storefront kit:** `initCheckoutFields`, `renderCheckoutFields`, `validateCheckoutFields`, `saveCheckoutFields` and `resetCheckoutFields`, and the field stylesheet, with a guide for the checkout drop-in ([storefront/README.md](storefront/README.md)).
- **Local previews:** `npm run demo` (a mock checkout at http://localhost:4351) and `npm run admin:preview` (the Admin pages at http://localhost:4350/preview.html), with no Commerce or Adobe account.
