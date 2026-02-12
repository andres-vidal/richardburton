import { auth } from "lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const handler = (req: NextRequest) => {
  const { GET: get, POST: post } = toNextJsHandler(auth.handler);
  if (req.method === "GET") return get(req);
  return post(req);
};

export { handler as GET, handler as POST };
