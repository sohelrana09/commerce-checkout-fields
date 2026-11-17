/**
 * Admin UI SDK grid column action for the order grid. Called by Commerce with the App
 * Management credentials (require-adobe-auth); reads orders with the app's own credentials.
 */

import {
  errorGridResponse,
  okGridResponse,
  parseGridRequest,
} from "@adobe/aio-commerce-lib-admin-ui/grid-columns";
import AioLogger from "@adobe/aio-lib-core-logging";

import { readBody } from "../../../common/http.js";
import { COLUMN, createOrderGrid } from "./handler.js";

const orderGrid = createOrderGrid();

export async function main(params = {}) {
  const logger = AioLogger("checkout-fields-order-grid", {
    level: params.LOG_LEVEL || "info",
  });
  let request;
  try {
    request = parseGridRequest(readBody(params));
  } catch (error) {
    return errorGridResponse(400, `Invalid grid request: ${error.message}`);
  }
  try {
    const cells = await orderGrid(request.ids, params);
    return okGridResponse(cells, { [COLUMN]: "" });
  } catch (error) {
    logger.error(`order-grid failed: ${error.message}`);
    return errorGridResponse(500, "Checkout field values are unavailable.");
  }
}
