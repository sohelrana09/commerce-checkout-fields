# Contributing to Checkout Fields

Bug fixes, new field types, storefront improvements and better documentation are all welcome. For larger changes, open an issue first so we can agree on the approach.

## Getting set up

Follow the [Quick start](README.md#quick-start): you need Node.js 24. The unit tests need no Adobe account, because the database, Commerce and I/O Runtime are faked:

```bash
git clone https://github.com/sohelrana09/commerce-checkout-fields.git
cd commerce-checkout-fields
npm install
npm test
```

`npm run demo` runs the storefront kit in a mock checkout at http://localhost:4351, and `npm run admin:preview` runs the Admin pages at http://localhost:4350/preview.html with fields kept in the browser. To deploy your copy, follow [docs/installation.md](docs/installation.md): you need an App Builder project, and a Commerce instance in the same Adobe organization to install it on.

## Making a change

1. Fork the repository and create a branch: `git checkout -b feature/your-change`.
2. Follow the [project structure](README.md#project-structure):
   - the field engine is `storefront/scripts/checkout-fields-engine.js`: one dependency-free module, with unit tests, that the storefront kit, the Admin preview and the actions all import (the actions and Admin as `#engine`). Keep it free of DOM and Node APIs, so the browser and the server always agree;
   - server-only logic goes in `src/common`; actions stay thin: read the request, call `src/common`, answer;
   - checkout must never break: a failed feed shows no fields, an app failure lets the order through, and labels, help and errors are always rendered as text, never HTML;
   - storefront code in `storefront/` and `demo/` follows the Edge Delivery Services boilerplate's ESLint (Airbnb) and Stylelint rules, not Biome.
3. Keep secrets on the server: never log credentials, tokens or shopper values, and never commit `.env` or `.aio`.
4. Run the checks:

   ```bash
   npm run code:check
   npm run typecheck
   npm test
   npm run lint:storefront
   ```

   `lint:storefront` needs a checkout of the EDS boilerplate with its dependencies installed; set `EDS_STOREFRONT` to its path (default `../product-labels-storefront`). Then `npm run demo` for anything a shopper sees, and `npm run admin:preview` for anything on the Admin page.

5. Update the README, the guides in `docs/` and the [CHANGELOG](CHANGELOG.md) when behaviour, field properties or setup change.
6. Commit, push the branch and open a pull request that says what changed and how you tested it. If you tried it on a Commerce instance, say which (SaaS or PaaS, and the version).

## Adding a field type or validation rule

1. Add it to `FIELD_TYPES` and to `validateField`, `normaliseValue` and `validateValue` in `storefront/scripts/checkout-fields-engine.js`, with tests in `test/lib/engine.test.js`.
2. Render it in `storefront/scripts/checkout-fields.js` (and style it in `checkout-fields.css`), with tests in `test/storefront/checkout-fields.test.js`.
3. Add it to the type declarations in `checkout-fields-engine.d.ts`, and to `TYPE_LABELS` and the editor in the Admin (`src/commerce-backend-ui-2/web-src/src/lib/fields.ts`).
4. Document it in [docs/fields.md](docs/fields.md).

## Reporting bugs and security issues

- Bugs and ideas: [open an issue](https://github.com/sohelrana09/commerce-checkout-fields/issues/new/choose).
- Security problems: report them privately, see [SECURITY.md](SECURITY.md).

By contributing you agree to follow the [code of conduct](CODE_OF_CONDUCT.md), and that your contribution is licensed under the [MIT License](LICENSE).
