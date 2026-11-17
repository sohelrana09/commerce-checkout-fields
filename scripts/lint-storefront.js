// Lints the storefront kit and demo with the Edge Delivery Services boilerplate's own ESLint
// (Airbnb) and Stylelint setup, since that's where the files end up (npm run lint:storefront).
// Point EDS_STOREFRONT at a checked-out boilerplate with its dependencies installed; it defaults
// to ../product-labels-storefront. Nothing is installed in this repository.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const storefront = resolve(
  process.env.EDS_STOREFRONT ?? "../product-labels-storefront",
);
const bin = (name) => resolve(storefront, "node_modules/.bin", name);

if (!existsSync(bin("eslint"))) {
  console.error(
    `No ESLint in ${storefront}. Set EDS_STOREFRONT to an aem-boilerplate-commerce checkout with node_modules installed.`,
  );
  process.exit(1);
}

const run = (command, args) =>
  spawnSync(command, args, { cwd: process.cwd(), stdio: "inherit" }).status ??
  1;

const eslint = run(bin("eslint"), [
  "--no-eslintrc",
  "--config",
  resolve(storefront, ".eslintrc.js"),
  "--resolve-plugins-relative-to",
  storefront,
  "--ignore-pattern",
  "demo/serve.js",
  "--no-error-on-unmatched-pattern",
  "storefront/scripts",
  "demo",
]);
const stylelint = run(bin("stylelint"), [
  "--config",
  resolve(storefront, ".stylelintrc.json"),
  "--config-basedir",
  storefront,
  "storefront/styles/*.css",
]);
process.exit(eslint || stylelint);
