## What changed

<!-- What does this pull request do, and why? Link the issue if there is one: "Closes #..." -->

## How I tested it

<!-- Unit tests, the demo or Admin preview, and if you deployed it: which workspace and Commerce instance (SaaS or PaaS, version), and which fields and orders you tried. -->

## Checklist

- [ ] `npm run code:check`, `npm run typecheck`, `npm test` and `npm run lint:storefront` pass
- [ ] New logic in the engine or `src/common` has unit tests
- [ ] The engine still runs the same in the browser and on the server (no DOM or Node APIs)
- [ ] Field labels, help and errors still render as plain text, a failed feed still shows no fields, and an app failure still lets orders through
- [ ] No secrets, tokens or shopper data in code, logs or tests
- [ ] README, `docs/` or CHANGELOG updated, if behaviour, field properties or setup changed
