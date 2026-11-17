/**
 * Webhook action for `observer.sales_order_place_before`. Answers `success` to let the order
 * through or `exception` (with the field errors) to block it; see handler.js for the policy.
 *
 * It runs as raw-http so the body Commerce signed can be verified when
 * COMMERCE_WEBHOOKS_PUBLIC_KEY is set (see common/webhook.js).
 */

import {
  exceptionOperation,
  ok,
  successOperation,
} from "@adobe/aio-commerce-sdk/webhooks/responses";
import AioLogger from "@adobe/aio-lib-core-logging";

import { json } from "../../../common/http.js";
import { isTrustedWebhook, webhookPayload } from "../../../common/webhook.js";
import { createOrderValidator } from "./handler.js";

const validateOrder = createOrderValidator();

export async function main(params = {}) {
  const logger = AioLogger("checkout-fields-validate-order", {
    level: params.LOG_LEVEL || "info",
  });
  if (!isTrustedWebhook(params)) {
    logger.warn("Rejected a webhook request with a missing or bad signature");
    return json(401, { error: "Invalid webhook signature" });
  }
  try {
    const result = await validateOrder(webhookPayload(params), params, logger);
    if (result.valid) {
      return ok([successOperation()]);
    }
    logger.info(`Blocked an order: ${Object.keys(result.errors).join(", ")}`);
    return ok([exceptionOperation(result.message)]);
  } catch (error) {
    logger.error(
      `validate-order failed, letting the order through: ${error.message}`,
    );
    return ok([successOperation()]);
  }
}
