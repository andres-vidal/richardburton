import axios from "axios";
import type { NextApiRequest, NextApiResponse } from "next";

import HTTP from "modules/http";
import { PROVIDERS, isProvider } from "modules/oauth";
import { User } from "modules/users";

const http = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

// OAuth callback: validate state, exchange the code for the provider id_token,
// run the admin gate, mint the Phoenix rb-session, and relay it to the browser.
// Phoenix stays the session authority — the id_token never reaches the client.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { provider } = req.query;

  if (typeof provider !== "string" || !isProvider(provider)) {
    return res.status(404).end();
  }

  // Always clear the handshake cookies, whatever the outcome.
  const setCookies = [
    expire("oauth_state"),
    expire("oauth_verifier"),
    expire("oauth_next"),
  ];
  const finish = (location: string) => {
    res.setHeader("Set-Cookie", setCookies);
    res.redirect(location);
  };

  const { code, state } = req.query;
  const storedState = req.cookies.oauth_state;
  const verifier = req.cookies.oauth_verifier;
  const next = safeNext(req, req.cookies.oauth_next ?? "/");

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !storedState ||
    state !== storedState ||
    !verifier
  ) {
    return finish("/auth/error?error=Verification");
  }

  let idToken: string;
  try {
    const tokens = await PROVIDERS[provider].client.validateAuthorizationCode(
      code,
      verifier,
    );
    idToken = tokens.idToken();
  } catch {
    return finish("/auth/error?error=Verification");
  }

  const email = decodeEmail(idToken);
  const authorization = { headers: { Authorization: `Bearer ${idToken}` } };

  // Admin gate: only admins may sign in.
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
    return finish("/auth/error?error=AccessDenied");
  }

  // Mint the Phoenix rb-session and relay its Set-Cookie to the browser.
  try {
    const response = await http.post("/sessions", { email }, authorization);
    const relayed = response.headers["set-cookie"];
    if (relayed) {
      setCookies.push(...(Array.isArray(relayed) ? relayed : [relayed]));
    }
  } catch {
    // Exchange failed; redirect anyway — the user just won't have a session yet.
  }

  return finish(next);
}

// Read the email claim from the id_token payload (Phoenix verifies the token).
function decodeEmail(idToken: string): string | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString(),
    );
    return typeof payload.email === "string" ? payload.email : undefined;
  } catch {
    return undefined;
  }
}

// Reduce `next` to a same-origin relative path, to prevent open redirects.
function safeNext(req: NextApiRequest, next: string): string {
  try {
    const url = new URL(next, `http://${req.headers.host}`);
    return url.host === req.headers.host ? url.pathname + url.search : "/";
  } catch {
    return "/";
  }
}

function expire(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
