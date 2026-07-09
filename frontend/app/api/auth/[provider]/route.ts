import { generateCodeVerifier, generateState } from "arctic";
import { NextRequest, NextResponse } from "next/server";

// Starts the OAuth handshake: create state + PKCE verifier, stash them (and the
// post-login destination) in short-lived cookies, and redirect to the provider.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  // Imported at request time: `modules/oauth` asserts the OAuth secrets at load,
  // and App Router evaluates route modules during `next build` (where they're unset).
  const { PROVIDERS, isProvider } = await import("modules/oauth");
  const { provider } = await params;

  if (!isProvider(provider)) {
    return new NextResponse(null, { status: 404 });
  }

  const { client, scopes } = PROVIDERS[provider];
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = client.createAuthorizationURL(state, codeVerifier, scopes);

  const next = request.nextUrl.searchParams.get("next") ?? "/";

  const response = NextResponse.redirect(url);
  response.headers.append("Set-Cookie", tempCookie("oauth_state", state));
  response.headers.append(
    "Set-Cookie",
    tempCookie("oauth_verifier", codeVerifier),
  );
  response.headers.append("Set-Cookie", tempCookie("oauth_next", next));
  return response;
}

function tempCookie(name: string, value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // httpOnly, SameSite=Lax so it survives the top-level GET redirect back from
  // the provider; 10-minute lifetime for the handshake.
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
}
