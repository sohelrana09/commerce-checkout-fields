# Field format

A checkout field is a JSON object. The Admin page edits the same objects, and `CHECKOUT_FIELDS` in `.env` takes a JSON array of them. The engine checks every field before it is saved (or, for `CHECKOUT_FIELDS`, when the actions load them) and reports each problem.

```json
{
  "code": "gift_message",
  "label": "Gift message",
  "type": "textarea",
  "enabled": true,
  "required": true,
  "placement": "review",
  "sortOrder": 30,
  "placeholder": "Happy birthday!",
  "help": "Printed on the gift card. We leave prices off the packing slip.",
  "validation": { "maxLength": 200 },
  "conditions": [{ "field": "is_gift", "operator": "checked" }],
  "match": "all",
  "scope": { "storeViews": [], "customerGroups": [] },
  "showInEmail": true
}
```

## Properties

| Property | Type | Default | Meaning |
|---|---|---|---|
| `code` | string | required | The order attribute code: lower case letters, digits and `_`, starting with a letter, at most 64 characters. Unique. Changing it later doesn't rename values on past orders. |
| `label` | string | required | Shown to shoppers and in the Admin, at most 120 characters. |
| `type` | `text`, `textarea`, `select`, `checkbox`, `date` | required | The control. See [Types](#types). |
| `enabled` | boolean | `true` | Only enabled fields reach the storefront and the order check. |
| `required` | boolean | `false` | The shopper must fill it in (for a checkbox: tick it). A hidden field is never required. |
| `placement` | `shipping`, `payment`, `review` | `review` | Where it's shown: after the shipping methods, after the payment methods, or right before **Place order**. |
| `sortOrder` | number | `0` | Order within a placement (then by code). |
| `placeholder` | string | | Text and text area only. |
| `help` | string | | A line under the control. |
| `default` | string or boolean | | The starting value: an option value for a dropdown, `true` for a ticked checkbox. |
| `options` | array | | Dropdown only, required: 1 to 100 `{ "value": "...", "label": "..." }` items. `label` defaults to `value`. |
| `validation` | object | | See [Validation](#validation). |
| `conditions` | array | | See [Conditions](#conditions). |
| `match` | `all`, `any` | `all` | Whether every condition or any one must be true. |
| `scope` | object | everyone | `storeViews` (store view codes) and `customerGroups` (customer group IDs, `"0"` for guests). An empty list means all. |
| `showInEmail` | boolean | `true` | Whether the value belongs in order emails and summaries (`describeValues(..., { emailOnly: true })`). |
| `updatedAt` | string | | Set by the app. |

At most 50 fields. Values are capped at 2,000 characters whatever the validation says.

## Types

| Type | Control | Value saved on the order |
|---|---|---|
| `text` | single-line input | the text, trimmed |
| `textarea` | multi-line input | the text, trimmed |
| `select` | dropdown with an empty first choice | the option `value` |
| `checkbox` | checkbox | `"1"` when ticked, `""` when not |
| `date` | date picker | `YYYY-MM-DD` |

Custom attribute values are strings. A field that applies but is hidden by its conditions is saved as `""`, so an earlier answer doesn't stay on the cart.

## Validation

| Key | Types | Meaning |
|---|---|---|
| `minLength`, `maxLength` | text, text area | Length in characters. `maxLength` at most 2,000 (255 is a sensible limit for text). |
| `pattern` | text, text area | A regular expression the whole value must match (it is anchored for you), at most 200 characters. Nested quantifiers such as `(a+)+` and backreferences are refused, so a pattern can't make the server slow. |
| `patternMessage` | text, text area | The error shown when the pattern doesn't match. Default: "*Label* is not in the expected format." |
| `minDate`, `maxDate` | date | `YYYY-MM-DD`, `today`, or `today+N` / `today-N` days (N up to 3650). For example `today+2` for "at least two days from now". `today` is the UTC date, in the browser and on the server. |

Error messages name the field, for example "Delivery date must be on or after 2026-11-19."

## Conditions

A condition shows the field only when another field's value matches. Up to 10 conditions per field, combined with `match`.

| Operator | `value` | True when the other field... |
|---|---|---|
| `eq`, `neq` | a string | equals / doesn't equal it |
| `in`, `not_in` | a list of strings | is one of / none of them |
| `filled`, `empty` | | has a value / has none |
| `checked`, `unchecked` | | (a checkbox) is ticked / isn't |

The other field must exist and conditions can't loop (`a` depends on `b` depends on `a`). A field that depends on a hidden field is hidden too. A field can't be deleted while other fields depend on it.

## Scope

`scope.storeViews` limits a field to store view codes (`default`, `de`), and `scope.customerGroups` to customer group IDs (`"0"` guests, `"1"` General, `"2"` Wholesale, `"3"` Retailer on a default install; yours may differ). The feed sends only the requested store view's fields; customer groups are applied in the browser when the kit knows the group, and always by the place-order check, with the order's real group.

## Examples

The Admin page offers seven examples to start from, all disabled until you switch them on: PO number, delivery notes, VAT ID, "This order is a gift", gift message (shown when the gift box is ticked), "How did you hear about us?" and a preferred delivery date (two to sixty days ahead). [`demo/fields.json`](../demo/fields.json) has them switched on, plus a required trade account number for the Wholesale group and a Leitweg-ID for the `de` store view.
