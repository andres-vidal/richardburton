import { toNodeHandler } from "better-auth/node";
import { auth } from "modules/auth";

export const config = { api: { bodyParser: false } };
export default toNodeHandler(auth);
