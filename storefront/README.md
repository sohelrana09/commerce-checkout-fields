# Storefront kit: Edge Delivery Services checkout

The kit adds the merchant's checkout fields to the `commerce-checkout` block of an Edge Delivery Services storefront (the [AEM boilerplate with Commerce drop-ins](https://github.com/hlxsites/aem-boilerplate-commerce), checkout drop-in 3.x). It has no dependencies and no build step.

| File | What it does |
|---|---|
| `scripts/checkout-fields-engine.js` | Field schema, visibility and validation. The same file runs in the App Builder actions, so the browser and the server always agree. |
| `scripts/checkout-fields.js` | Loads the field definitions, renders the fields, checks them and saves them on the cart. |
| `styles/checkout-fields.css` | Field layout, using the drop-in design tokens (`--color-*`, `--spacing-*`, `--type-*`) with fallbacks. |

The checkout drop-in has no slot for custom fields, so the kit renders into containers you add to the block's layout, and you call it from the block's existing **Place order** handlers. It takes about 30 lines.

## 1. Copy the files

```text
storefront/scripts/checkout-fields-engine.js  →  scripts/checkout-fields-engine.js
storefront/scripts/checkout-fields.js         →  scripts/checkout-fields.js
storefront/styles/checkout-fields.css         →  styles/checkout-fields.css
```

The `.d.ts` files are only for this repository's type check; storefronts don't need them. The scripts follow the boilerplate's ESLint (Airbnb) and Stylelint rules.

## 2. Configure the feed URL

Add the `checkout-fields/fields` URL that `aio app deploy` printed to your storefront configuration (`config.json`, or the configuration service), for example:

```json
"commerce-checkout-fields-endpoint": "https://<namespace>.adobeio-static.net/api/v1/web/checkout-fields/fields"
```

Without an endpoint the kit shows no fields, and checkout works as before.

## 3. Add containers to the checkout layout

In `blocks/commerce-checkout/fragments.js`, add a container for each placement you use, and their selectors:

```js
// selectors.checkout
fieldsShipping: '.checkout__fields-shipping',
fieldsPayment: '.checkout__fields-payment',
fieldsReview: '.checkout__fields-review',
```

```html
<div class="checkout__delivery ${CHECKOUT_BLOCK}"></div>
<div class="checkout__fields-shipping ${CHECKOUT_BLOCK}"></div>
<div class="checkout__payment-methods ${CHECKOUT_BLOCK}"></div>
<div class="checkout__fields-payment ${CHECKOUT_BLOCK}"></div>
<div class="checkout__billing-form ${CHECKOUT_BLOCK}"></div>
<div class="checkout__terms-and-conditions ${CHECKOUT_BLOCK}"></div>
<div class="checkout__fields-review ${CHECKOUT_BLOCK}"></div>
<div class="checkout__place-order ${CHECKOUT_BLOCK}"></div>
```

| Placement | Shown | Container |
|---|---|---|
| `shipping` | after the shipping methods | `.checkout__fields-shipping` |
| `payment` | after the payment methods | `.checkout__fields-payment` |
| `review` | right before **Place order** | `.checkout__fields-review` |

## 4. Render, check and save the fields

In `blocks/commerce-checkout/commerce-checkout.js`:

```js
import { fetchGraphQl } from '@dropins/storefront-checkout/api.js';
import { getConfigValue, getHeaders } from '@dropins/tools/lib/aem/configs.js';
import {
  initCheckoutFields,
  renderCheckoutFields,
  resetCheckoutFields,
  saveCheckoutFields,
  validateCheckoutFields,
} from '../../scripts/checkout-fields.js';
import { loadCSS } from '../../scripts/aem.js';

// near the top of decorate()
loadCSS(`${window.hlx.codeBasePath}/styles/checkout-fields.css`);
initCheckoutFields({
  endpoint: getConfigValue('commerce-checkout-fields-endpoint'),
  storeView: getHeaders('cs')?.['Magento-Store-View-Code'],
  // customerGroup: see "Customer groups" below
});
```

Add the kit's check to `handleValidation`, and save the values on the cart right before the order is placed:

```js
const handleValidation = () => validateForms([
  // ...the existing forms
]) && validateCheckoutFields();

const handlePlaceOrder = async ({ cartId, code }) => {
  await displayOverlaySpinner(loaderRef, $loader, $loaderStatus);
  try {
    // ...the existing Payment Services code
    await saveCheckoutFields(cartId, { fetchGraphQl });
    await orderApi.placeOrder(cartId);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    removeOverlaySpinner(loaderRef, $loader, $loaderStatus);
  }
};
```

Render the fields alongside the other containers, and clear the saved values once the order is placed:

```js
await Promise.all([
  renderCheckoutFields(getElement(selectors.checkout.fieldsShipping), { placement: 'shipping' }),
  renderCheckoutFields(getElement(selectors.checkout.fieldsPayment), { placement: 'payment' }),
  renderCheckoutFields(getElement(selectors.checkout.fieldsReview), {
    placement: 'review',
    title: 'Order details',
  }),
]);

events.on('order/placed', () => resetCheckoutFields());
```

`validateCheckoutFields()` shows each field's error and moves focus to the first problem. `saveCheckoutFields` sends every field that applies to the shopper with `setCustomAttributesOnCart` (hidden fields as an empty value, so an old answer can't stay on the cart). It throws if a value is invalid or GraphQL returns an error, and the drop-in then shows the error instead of placing the order.

## Customer groups

Fields limited to customer groups need the shopper's group. If you don't pass one, the kit shows group-limited fields to everyone, and the place-order check applies the real group: a value for a field the shopper's group doesn't have is dropped, and a missing required value for their own group stops the order.

To show the right fields from the start, pass the group:

- guests: `customerGroup: '0'`;
- signed-in shoppers: read it after sign-in and call `setCustomerGroup(id)`, which re-renders the fields. Where your instance exposes the group in GraphQL (for example `customer { group { uid } }`), `customerGroupFromUid(uid)` turns the base64 `uid` into the numeric ID.

```js
import { setCustomerGroup, customerGroupFromUid } from '../../scripts/checkout-fields.js';

events.on('authenticated', async (signedIn) => {
  if (!signedIn) { await setCustomerGroup('0'); return; }
  const { data } = await fetchGraphQl('query { customer { group { uid } } }', { method: 'GET' });
  await setCustomerGroup(customerGroupFromUid(data?.customer?.group?.uid));
}, { eager: true });
```

Check that query on your instance first, see [What needs a live instance](../README.md#what-needs-a-live-instance).

## Behaviour

- **Caching:** definitions are kept in `sessionStorage` for `cacheSeconds` (default 300), per store view. Values are kept for the browser tab, so a reload doesn't lose them, until `resetCheckoutFields()`.
- **Failures:** if the feed can't be loaded, the kit logs a warning and renders nothing. Checkout works as before, and the server check still applies.
- **Events:** each change dispatches `checkout-fields/change` on `document` with `{ detail: { code, values } }`: the code of the field that changed and all current values.
- **Accessibility:** each control has a `<label>`, and its help and error are linked with `aria-describedby`. Invalid controls get `aria-invalid`. Hidden conditional fields use the `hidden` attribute, so they leave the tab order and the accessibility tree.
- **Security:** labels, help, options and errors are set with `textContent`, never as HTML.

## Styling

`checkout-fields.css` uses the drop-in tokens, so the fields match the rest of checkout. Each form is a `fieldset.checkout-fields` with a modifier for its placement (`checkout-fields--review`), and each field is a `.checkout-fields__field` with a `data-field` attribute holding its code, so you can style one field, for example:

```css
.checkout-fields__field[data-field="gift_message"] textarea { min-height: 8rem; }
```

## Other storefronts

The engine has no dependencies and works anywhere:

```js
import { validateValues, toCustomAttributes } from './checkout-fields-engine.js';

const { fields } = await (await fetch(`${endpoint}?store=default`)).json();
const { valid, errors, values } = validateValues(fields, formValues, { storeView: 'default', customerGroup: '0' });
if (valid) {
  // send toCustomAttributes(fields, values) with setCustomAttributesOnCart
}
```

## Trying it

`npm run demo` in this repository runs the kit in a mock checkout at http://localhost:4351, with a fake `fetchGraphQl` that shows the mutation it would send.
