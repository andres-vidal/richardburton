import { api } from "app/api";
import { admits } from "app/api/auth/gate";
import { appUrl } from "modules/app-url";
import type { User } from "modules/users";
import { NextRequest, NextResponse } from "next/server";

import { HANDSHAKE, handshakeCookie } from "../../handshake";

/**
 * Finishes the OAuth handshake with `provider`. It checks the state against
 * the handshake cookie, exchanges the code for the provider's id_token, and
 * signs in to the backend with it. When `admits` lets the user in, it relays
 * the backend's session cookies and redirects to the address the handshake
 * kept. Otherwise it redirects to the page `admits` names, without a session.
 * A failed check or exchange redirects to the error page. The handshake
 * cookies are deleted whatever the outcome.
 *
 * The id_token goes to the backend only, which is the authority on sessions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  // `modules/oauth` asserts the OAuth secrets when it loads, and `next build`
  // evaluates route modules without them, so it is imported per request.
  const { PROVIDERS, isProvider } = await import("modules/oauth");
  const { provider } = await params;

  if (!isProvider(provider)) {
    return new NextResponse(null, { status: 404 });
  }

  // Redirects to `location` on `APP_URL`, sets `cookies` and deletes the
  // handshake cookies. `request.url` is not the base because behind a proxy
  // it holds the address the server listens on, such as 0.0.0.0:3000.
  const finish = (location: string, cookies: string[] = []) => {
    const response = NextResponse.redirect(new URL(location, appUrl()));
    for (const name of Object.values(HANDSHAKE)) {
      response.headers.append("Set-Cookie", handshakeCookie(name, "", 0));
    }
    for (const cookie of cookies) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(HANDSHAKE.state)?.value;
  const verifier = request.cookies.get(HANDSHAKE.verifier)?.value;
  const next = safeNext(request.cookies.get(HANDSHAKE.next)?.value ?? "/");

  if (!code || !state || !storedState || state !== storedState || !verifier) {
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

  // POST /sessions finds or creates the user by the address the token
  // carries, sets the session and CSRF cookies, and returns the user with
  // their role. A refusal leaves `user` null, which `admits` sends to the
  // error page.
  let user: User | null = null;
  let cookies: string[] = [];
  try {
    const response = await api.post<User>(
      "/sessions",
      {},
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    user = response.data;
    cookies = response.headers["set-cookie"] ?? [];
  } catch (e) {
    console.error(e);
  }

  const { location, session } = admits(user, next);
  return finish(location, session ? cookies : []);
}

// Returns `next` as a path on `APP_URL`, or "/" when it names another site,
// so the sign-in cannot redirect away from the app.
function safeNext(next: string): string {
  const base = new URL(appUrl());
  try {
    const url = new URL(next, base);
    return url.origin === base.origin ? url.pathname + url.search : "/";
  } catch {
    return "/";
  }
}
