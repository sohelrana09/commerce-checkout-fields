/**
 * Public web action for the storefront (no Adobe IMS login: shoppers call it from the browser).
 * It only reads field definitions, which every shopper sees at checkout anyway. Errors return a
 * generic message; details go to the logs.
 */

import AioLogger from "@adobe/aio-lib-core-logging";

import { json } from "../../../common/http.js";
import { createFieldsFeed } from "./handler.js";

const fieldsFeed = createFieldsFeed();

export async function main(params = {}) {
  const logger = AioLogger("checkout-fields-fields", {
    level: params.LOG_LEVEL || "info",
  });
  try {
    return await fieldsFeed(params, logger);
  } catch (error) {
    logger.error(`fields feed failed: ${error.message}`);
    return json(500, { error: "Checkout fields are unavailable right now." });
  }
}
