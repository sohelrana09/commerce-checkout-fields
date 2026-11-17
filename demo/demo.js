import {
  initCheckoutFields,
  renderCheckoutFields,
  saveCheckoutFields,
  setCustomerGroup,
  validateCheckoutFields,
} from '../storefront/scripts/checkout-fields.js';

const $store = document.getElementById('store');
const $group = document.getElementById('group');
const $result = document.getElementById('result');
const $request = document.getElementById('request');

const placements = {
  payment: document.getElementById('payment-fields'),
  review: document.getElementById('review-fields'),
  shipping: document.getElementById('shipping-fields'),
};

// Stands in for the checkout drop-in's fetchGraphQl: shows the request instead of sending it.
async function fetchGraphQl(query, options) {
  $request.textContent = `${query.trim()}\n\nvariables: ${JSON.stringify(options.variables)}`;
  $request.hidden = false;
  return { data: { setCustomAttributesOnCart: { cart: { id: options.variables.cartId } } } };
}

async function render() {
  const response = await fetch('/demo/fields.json');
  const { fields } = await response.json();
  initCheckoutFields({ customerGroup: $group.value, fields, storeView: $store.value });
  await Promise.all(Object.entries(placements)
    .map(([placement, container]) => renderCheckoutFields(container, { placement })));
}

$store.addEventListener('change', render);
$group.addEventListener('change', () => setCustomerGroup($group.value));

document.getElementById('place').addEventListener('click', async () => {
  $request.hidden = true;
  if (!validateCheckoutFields()) {
    $result.textContent = 'Place order stopped: fix the highlighted fields.';
    $result.className = 'result--error';
    return;
  }
  try {
    const values = await saveCheckoutFields('demo-masked-cart-id', { fetchGraphQl });
    $result.textContent = `Saved ${Object.keys(values).length} value(s) on the cart. The order would be placed next.`;
    $result.className = 'result--ok';
  } catch (error) {
    $result.textContent = error.message;
    $result.className = 'result--error';
  }
});

render();
