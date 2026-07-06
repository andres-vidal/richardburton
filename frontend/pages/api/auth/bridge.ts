import axios from "axios";
import { fromNodeHeaders } from "better-auth/node";
import type { NextApiRequest, NextApiResponse } from "next";

import { auth } from "modules/auth";
import HTTP from "modules/http";
import { User } from "modules/users";

const http = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

// Reached via callbackURL right after a Better Auth social sign-in. Phoenix stays
// the session authority: this bridge pulls the provider id_token (server-side,
// never exposed to the browser), runs the admin gate, then exchanges the id_token
// at the backend for the rb-session cookie and relays it to the browser.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const headers = fromNodeHeaders(req.headers);
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return res.redirect(302, "/auth/error?error=Verification");
  }

  const { idToken } = await auth.api.getAccessToken({
    headers,
    body: { providerId: "google", userId: session.user.id },
  });

  if (!idToken) {
    return res.redirect(302, "/auth/error?error=Verification");
  }

  const authorization = { headers: { Authorization: `Bearer ${idToken}` } };
  const email = session.user.email;

  // Admin gate: only admins may access the platform. Non-admins are signed out
  // of Better Auth and sent to the error page.
  let user: User | null = null;
  try {
    const { data } = await http.post<User>("/users", { email }, authorization);
    user = data;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      user = e.response.data as User;
    } else {
      console.error(e);
    }
  }

  if (!user || !User.isAdmin(user.role)) {
    await relaySignOut(headers, res);
    return res.redirect(302, "/auth/error?error=AccessDenied");
  }

  // Bridge: mint the Phoenix rb-session cookie and relay its Set-Cookie.
  try {
    const response = await http.post("/sessions", { email }, authorization);
    const setCookie = response.headers["set-cookie"];
    if (setCookie) {
      res.setHeader("set-cookie", setCookie);
    }
  } catch {
    // Exchange failed (e.g. an expired id_token). Fall through and redirect
    // anyway — the user just won't have a backend session yet.
  }

  return res.redirect(302, safeNext(req));
}

// Clear the Better Auth session cookies so a rejected user isn't left "signed in".
async function relaySignOut(headers: Headers, res: NextApiResponse) {
  try {
    const response = await auth.api.signOut({ headers, asResponse: true });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      res.setHeader("set-cookie", setCookie);
    }
  } catch {
    // Best-effort.
  }
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
