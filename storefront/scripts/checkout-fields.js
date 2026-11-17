/**
 * Checkout Fields storefront kit for Edge Delivery Services.
 *
 * Copy this file, checkout-fields-engine.js and ../styles/checkout-fields.css into your
 * storefront (scripts/ and styles/), then, in blocks/commerce-checkout/commerce-checkout.js:
 *
 *   import { fetchGraphQl } from '@dropins/storefront-checkout/api.js';
 *   import {
 *     initCheckoutFields, renderCheckoutFields, validateCheckoutFields, saveCheckoutFields,
 *   } from '../../scripts/checkout-fields.js';
 *
 *   initCheckoutFields({ endpoint: '<checkout-fields/fields action URL>', storeView: 'default' });
 *   renderCheckoutFields($checkoutFields, { placement: 'review' });
 *
 *   // In handleValidation:  ... && validateCheckoutFields()
 *   // In handlePlaceOrder, before orderApi.placeOrder(cartId):
 *   await saveCheckoutFields(cartId, { fetchGraphQl });
 *
 * See storefront/README.md for the full walkthrough. Field definitions are fetched once per
 * page and kept in sessionStorage for a few minutes. Values are saved on the cart with
 * Commerce's `setCustomAttributesOnCart` mutation, and Commerce copies them to the order.
 * Every label, help text and error is set with textContent, so a definition can't inject markup.
 */

import {
  defaultValue,
  fieldsFor,
  normaliseValue,
  sortFields,
  toCustomAttributes,
  validateValue,
  validateValues,
  visibleFields,
} from './checkout-fields-engine.js';

const DEFINITIONS_KEY = 'checkout-fields:definitions';
const VALUES_KEY = 'checkout-fields:values';
const DEFAULT_CACHE_SECONDS = 300;
const PLACEMENT_CLASSES = ['shipping', 'payment', 'review'];

let settings = {
  cacheSeconds: DEFAULT_CACHE_SECONDS,
  customerGroup: undefined,
  endpoint: '',
  storeView: '',
};
let definitionsPromise = null;
let definitions = [];
let values = {};
const touched = new Set();
const forms = new Set();

function readSession(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null');
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    return null;
  }
}

function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: the shopper keeps their values until the page reloads.
  }
}

function readCachedDefinitions() {
  const cached = readSession(DEFINITIONS_KEY);
  if (
    cached
    && cached.endpoint === settings.endpoint
    && cached.storeView === settings.storeView
    && cached.expiresAt > Date.now()
  ) {
    return cached.payload;
  }
  return null;
}

async function fetchDefinitions() {
  const cached = readCachedDefinitions();
  if (cached) {
    return cached;
  }
  const url = new URL(settings.endpoint, window.location.href);
  if (settings.storeView) {
    url.searchParams.set('store', settings.storeView);
  }
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Checkout fields unavailable (${response.status})`);
  }
  const body = await response.json();
  const payload = {
    enabled: body.enabled !== false,
    fields: Array.isArray(body.fields) ? body.fields : [],
  };
  writeSession(DEFINITIONS_KEY, {
    endpoint: settings.endpoint,
    expiresAt: Date.now() + settings.cacheSeconds * 1000,
    payload,
    storeView: settings.storeView,
  });
  return payload;
}

/**
 * Sets where the definitions come from and who the shopper is. Call it once, before rendering.
 * @param {object} options
 * @param {string} options.endpoint URL of the app's public `checkout-fields/fields` action
 * @param {string} [options.storeView] store view code, to load only that view's fields
 * @param {string|number} [options.customerGroup] the shopper's customer group ID; "0" for
 *   guests. Leave it out when unknown: fields limited to customer groups are then shown to
 *   everyone, and the server applies the real group when the order is placed.
 * @param {number} [options.cacheSeconds] how long to keep definitions in sessionStorage
 * @param {object[]} [options.fields] definitions to use instead of fetching (tests, demos)
 */
export function initCheckoutFields(options = {}) {
  settings = { ...settings, ...options };
  definitionsPromise = Array.isArray(options.fields)
    ? Promise.resolve({ enabled: true, fields: options.fields })
    : null;
  values = { ...(readSession(VALUES_KEY) || {}), ...(options.values || {}) };
  touched.clear();
}

/** The field definitions for this page: fetched once, then shared. No fields on error. */
export function loadFieldDefinitions() {
  if (!definitionsPromise) {
    if (!settings.endpoint) {
      definitionsPromise = Promise.resolve({ enabled: false, fields: [] });
    } else {
      definitionsPromise = fetchDefinitions().catch((error) => {
        // Extra fields must never break checkout: show none and let the order through.
        console.warn(error.message);
        return { enabled: false, fields: [] };
      });
    }
  }
  return definitionsPromise.then((payload) => {
    definitions = payload.enabled ? payload.fields : [];
    return definitions;
  });
}

function groupKnown() {
  return settings.customerGroup !== undefined && settings.customerGroup !== null;
}

/**
 * The definitions to check against. With an unknown customer group, group limits are ignored
 * here; the place-order webhook knows the real group and applies them.
 */
function effectiveDefinitions() {
  if (groupKnown()) {
    return definitions;
  }
  return definitions.map((field) => ({
    ...field,
    scope: { ...field.scope, customerGroups: [] },
  }));
}

function shopperContext() {
  return {
    customerGroup: groupKnown() ? settings.customerGroup : undefined,
    storeView: settings.storeView || undefined,
  };
}

/** The fields that apply to this shopper (store view, customer group), in display order. */
export function applicableFields() {
  return fieldsFor(effectiveDefinitions(), shopperContext());
}

/** Decodes a GraphQL customer group `uid` (base64 of the ID) into the ID. */
export function customerGroupFromUid(uid) {
  try {
    const id = atob(String(uid));
    return /^\d+$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function currentValues() {
  const result = {};
  applicableFields().forEach((field) => {
    result[field.code] = values[field.code] ?? defaultValue(field);
  });
  return result;
}

/** Validates the current values with the same engine the server uses. */
export function getCheckoutFieldValues() {
  return validateValues(effectiveDefinitions(), currentValues(), shopperContext());
}

function controlId(code) {
  return `checkout-fields-${code}`;
}

function createControl(field, value) {
  let control;
  if (field.type === 'textarea') {
    control = document.createElement('textarea');
    control.rows = 3;
  } else if (field.type === 'select') {
    control = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = field.placeholder || 'Choose…';
    control.append(empty);
    (field.options || []).forEach((option) => {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label || option.value;
      control.append(element);
    });
  } else {
    control = document.createElement('input');
    const types = { checkbox: 'checkbox', date: 'date', text: 'text' };
    control.type = types[field.type] || 'text';
  }
  control.id = controlId(field.code);
  control.name = field.code;
  control.className = `checkout-fields__control checkout-fields__control--${field.type}`;
  if (field.type === 'checkbox') {
    control.checked = value === true;
  } else {
    control.value = value ?? '';
  }
  if (field.placeholder && field.type !== 'select' && field.type !== 'checkbox') {
    control.placeholder = field.placeholder;
  }
  if (field.required) {
    control.required = true;
    control.setAttribute('aria-required', 'true');
  }
  const validation = field.validation || {};
  if ((field.type === 'text' || field.type === 'textarea') && validation.maxLength) {
    control.maxLength = validation.maxLength;
  }
  return control;
}

function renderField(field, value) {
  const wrapper = document.createElement('div');
  wrapper.className = `checkout-fields__field checkout-fields__field--${field.type}`;
  wrapper.dataset.field = field.code;

  const label = document.createElement('label');
  label.className = 'checkout-fields__label';
  label.htmlFor = controlId(field.code);
  const text = document.createElement('span');
  text.textContent = field.label;
  label.append(text);
  if (field.required) {
    const mark = document.createElement('span');
    mark.className = 'checkout-fields__required';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = ' *';
    label.append(mark);
  }

  const control = createControl(field, value);
  const described = [];
  if (field.help) {
    const help = document.createElement('p');
    help.className = 'checkout-fields__help';
    help.id = `${controlId(field.code)}-help`;
    help.textContent = field.help;
    described.push(help);
  }
  const error = document.createElement('p');
  error.className = 'checkout-fields__error';
  error.id = `${controlId(field.code)}-error`;
  error.setAttribute('aria-live', 'polite');
  described.push(error);
  control.setAttribute('aria-describedby', described.map((item) => item.id).join(' '));

  if (field.type === 'checkbox') {
    label.prepend(control);
    wrapper.append(label, ...described);
  } else {
    wrapper.append(label, control, ...described);
  }
  return wrapper;
}

function showError(wrapper, message) {
  const control = wrapper.querySelector('.checkout-fields__control');
  const error = wrapper.querySelector('.checkout-fields__error');
  error.textContent = message || '';
  wrapper.classList.toggle('checkout-fields__field--invalid', Boolean(message));
  if (message) {
    control.setAttribute('aria-invalid', 'true');
  } else {
    control.removeAttribute('aria-invalid');
  }
}

/** Shows and hides conditional fields, and refreshes errors on fields the shopper touched. */
function refresh() {
  const fields = applicableFields();
  const current = currentValues();
  const cleaned = {};
  fields.forEach((field) => {
    const value = normaliseValue(field, current[field.code]);
    if (value !== undefined) {
      cleaned[field.code] = value;
    }
  });
  const shown = new Set(visibleFields(fields, cleaned).map((field) => field.code));
  const byCode = new Map(fields.map((field) => [field.code, field]));
  forms.forEach((form) => {
    let visibleCount = 0;
    form.querySelectorAll('.checkout-fields__field').forEach((wrapper) => {
      const { field: code } = wrapper.dataset;
      const visible = shown.has(code);
      wrapper.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
      if (touched.has(code)) {
        showError(wrapper, visible ? validateValue(byCode.get(code), cleaned[code]) : null);
      }
    });
    form.hidden = visibleCount === 0;
  });
}

function onInput(event) {
  const control = event.target;
  if (!control.classList?.contains('checkout-fields__control')) {
    return;
  }
  values[control.name] = control.type === 'checkbox' ? control.checked : control.value;
  writeSession(VALUES_KEY, values);
  if (event.type === 'change' || control.type === 'checkbox') {
    touched.add(control.name);
  }
  refresh();
  document.dispatchEvent(new CustomEvent('checkout-fields/change', {
    detail: { code: control.name, values: { ...values } },
  }));
}

function onBlur(event) {
  const control = event.target;
  if (control.classList?.contains('checkout-fields__control')) {
    touched.add(control.name);
    refresh();
  }
}

/**
 * Renders the shopper's fields into `container`.
 * @param {HTMLElement} container where the fields go (a checkout slot or your own element)
 * @param {object} [options]
 * @param {'shipping'|'payment'|'review'} [options.placement] only fields with this placement;
 *   leave it out to render every field in one place
 * @param {string} [options.title] heading shown above the fields
 * @returns {Promise<HTMLElement>} the rendered form, hidden when it has no visible fields
 */
export async function renderCheckoutFields(container, options = {}) {
  await loadFieldDefinitions();
  const { placement, title } = options;
  const current = currentValues();
  const fields = sortFields(applicableFields())
    .filter((field) => !placement || (field.placement || 'review') === placement);

  const form = document.createElement('fieldset');
  form.className = 'checkout-fields';
  if (placement) {
    form.classList.add(`checkout-fields--${placement}`);
  }
  if (title) {
    const legend = document.createElement('legend');
    legend.className = 'checkout-fields__title';
    legend.textContent = title;
    form.append(legend);
  }
  fields.forEach((field) => form.append(renderField(field, current[field.code])));
  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  form.addEventListener('focusout', onBlur);

  container.querySelector(':scope > .checkout-fields')?.remove();
  container.append(form);
  forms.forEach((existing) => {
    if (!existing.isConnected) {
      forms.delete(existing);
    }
  });
  forms.add(form);
  refresh();
  return form;
}

/**
 * Changes the shopper's customer group (for example after sign-in) and re-renders the fields.
 * @param {string|number|undefined} customerGroup
 */
export async function setCustomerGroup(customerGroup) {
  settings = { ...settings, customerGroup };
  const rendered = [...forms].filter((form) => form.isConnected);
  forms.clear();
  await Promise.all(rendered.map((form) => {
    const placement = PLACEMENT_CLASSES.find((name) => form.classList.contains(`checkout-fields--${name}`));
    const title = form.querySelector('.checkout-fields__title')?.textContent;
    const container = form.parentElement;
    return renderCheckoutFields(container, { placement, title });
  }));
}

/**
 * Checks every shown field, shows the errors and focuses the first invalid one.
 * Use it in the checkout's handleValidation. Returns true when everything is valid.
 */
export function validateCheckoutFields({ focus = true } = {}) {
  const result = getCheckoutFieldValues();
  applicableFields().forEach((field) => touched.add(field.code));
  refresh();
  if (!result.valid && focus) {
    const first = applicableFields().find((field) => result.errors[field.code]);
    const control = first && document.getElementById(controlId(first.code));
    control?.focus();
    control?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }
  return result.valid;
}

const SET_ATTRIBUTES = `
  mutation SET_CHECKOUT_FIELDS($cartId: String!) {
    setCustomAttributesOnCart(input: { cart_id: $cartId, custom_attributes: [%ATTRIBUTES%] }) {
      cart { id }
    }
  }
`;

/** The GraphQL mutation that saves the values on the cart (attribute values are inlined). */
export function buildSaveMutation(attributes) {
  const list = attributes
    .map((item) => `{ attribute_code: ${JSON.stringify(item.attribute_code)}, value: ${JSON.stringify(item.value)} }`)
    .join(', ');
  return SET_ATTRIBUTES.replace('%ATTRIBUTES%', list);
}

/**
 * Saves the values on the cart as Commerce custom attributes, right before the order is placed.
 * @param {string} cartId the masked cart ID (the one GraphQL uses)
 * @param {object} options
 * @param {Function} options.fetchGraphQl the drop-in's GraphQL client
 *   (`fetchGraphQl` from '@dropins/storefront-checkout/api.js')
 * @returns {Promise<object>} the values that were saved
 * @throws when the values are invalid or Commerce rejects them
 */
export async function saveCheckoutFields(cartId, { fetchGraphQl } = {}) {
  await loadFieldDefinitions();
  const fields = applicableFields();
  if (!fields.length) {
    return {};
  }
  const result = getCheckoutFieldValues();
  if (!result.valid) {
    validateCheckoutFields();
    throw new Error(Object.values(result.errors).join(' '));
  }
  if (typeof fetchGraphQl !== 'function') {
    throw new Error('saveCheckoutFields needs the drop-in fetchGraphQl function');
  }
  const mutation = buildSaveMutation(toCustomAttributes(fields, result.values));
  const response = await fetchGraphQl(mutation, {
    method: 'POST',
    variables: { cartId },
  });
  if (response?.errors?.length) {
    throw new Error(response.errors.map((error) => error.message).join(' '));
  }
  return result.values;
}

/** Forgets the shopper's values, for example once the order is placed. */
export function resetCheckoutFields() {
  values = {};
  touched.clear();
  try {
    sessionStorage.removeItem(VALUES_KEY);
  } catch {
    // Nothing stored.
  }
  refresh();
}
