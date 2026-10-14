import { appUrl } from "modules/app-url";

/**
 * The names of the cookies that carry the OAuth handshake from its start to
 * its callback: the state, the PKCE verifier, and the address to go to next,
 * once signed in.
 */
export const HANDSHAKE = {
  state: "oauth_state",
  verifier: "oauth_verifier",
  next: "oauth_next",
} as const;

/**
 * Returns the `Set-Cookie` value of the handshake cookie `name` holding
 * `value` for `maxAge` seconds, ten minutes by default. A `maxAge` of 0
 * deletes the cookie.
 *
 * The cookie is `HttpOnly` and `SameSite=Lax`, so the browser sends it with
 * the provider's redirect back, which is a top-level GET. It is `Secure` when
 * `APP_URL` is an `https` address, so development over plain HTTP can set it
 * too.
 */
export function handshakeCookie(
  name: string,
  value: string,
  maxAge = 600,
): string {
  const secure = new URL(appUrl()).protocol === "https:" ? "; Secure" : "";

  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
