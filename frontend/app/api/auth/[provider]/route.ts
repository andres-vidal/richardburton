import { generateCodeVerifier, generateState } from "arctic";
import { NextRequest, NextResponse } from "next/server";

import { HANDSHAKE, handshakeCookie } from "../handshake";

/**
 * Starts the OAuth handshake with `provider`: creates the state and the PKCE
 * verifier, keeps them and the `?next` address in the handshake cookies, and
 * redirects to the provider. Answers 404 for a provider that is not
 * configured.
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

  const { client, scopes } = PROVIDERS[provider];
  const state = generateState();
  const verifier = generateCodeVerifier();
  const next = request.nextUrl.searchParams.get("next") ?? "/";

  const response = NextResponse.redirect(
    client.createAuthorizationURL(state, verifier, scopes),
  );
  response.headers.append(
    "Set-Cookie",
    handshakeCookie(HANDSHAKE.state, state),
  );
  response.headers.append(
    "Set-Cookie",
    handshakeCookie(HANDSHAKE.verifier, verifier),
  );
  response.headers.append("Set-Cookie", handshakeCookie(HANDSHAKE.next, next));
  return response;
}
