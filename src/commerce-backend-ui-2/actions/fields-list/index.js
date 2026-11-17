import { handlers } from "../handlers.js";
import { adminAction } from "../http.js";

export const main = adminAction("fields-list", handlers.fieldsList);
