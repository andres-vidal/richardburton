import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";

import HTTP from "modules/http";

const http = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

// Server-side session bridge. Reached via a redirect right after sign-in: it
// reads the Google id_token from the NextAuth JWT (via getToken — it never
// reaches the browser), exchanges it at the backend for the rb-session cookie,
// relays that Set-Cookie, then redirects to a validated same-origin destination.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const token = await getToken({ req });

  if (token?.idToken) {
    try {
      const response = await http.post(
        "/sessions",
        { email: token.email },
        { headers: { Authorization: `Bearer ${token.idToken}` } },
      );

      const setCookie = response.headers["set-cookie"];
      if (setCookie) {
        res.setHeader("set-cookie", setCookie);
      }
    } catch {
      // Exchange failed (e.g. an expired id_token). Fall through and redirect
      // anyway — the user just won't have a backend session yet.
    }
  }

  return res.redirect(302, safeNext(req));
}

// Reduce ?next to a same-origin relative path, to prevent open redirects.
function safeNext(req: NextApiRequest): string {
  const next = req.query.next;

  if (typeof next !== "string") {
    return "/";
  }

  try {
    const url = new URL(next, `http://${req.headers.host}`);
    return url.host === req.headers.host ? url.pathname + url.search : "/";
  } catch {
    return "/";
  }
}
