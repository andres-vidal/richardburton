import { generateCodeVerifier, generateState } from "arctic";
import type { NextApiRequest, NextApiResponse } from "next";

import { PROVIDERS, isProvider } from "modules/oauth";

// Starts the OAuth handshake: create state + PKCE verifier, stash them (and the
// post-login destination) in short-lived cookies, and redirect to the provider.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { provider } = req.query;

  if (typeof provider !== "string" || !isProvider(provider)) {
    return res.status(404).end();
  }

  const { client, scopes } = PROVIDERS[provider];
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = client.createAuthorizationURL(state, codeVerifier, scopes);

  const next = typeof req.query.next === "string" ? req.query.next : "/";

  res.setHeader("Set-Cookie", [
    tempCookie("oauth_state", state),
    tempCookie("oauth_verifier", codeVerifier),
    tempCookie("oauth_next", next),
  ]);

  res.redirect(url.toString());
}

function tempCookie(name: string, value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // httpOnly, SameSite=Lax so it survives the top-level GET redirect back from
  // the provider; 10-minute lifetime for the handshake.
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
}
