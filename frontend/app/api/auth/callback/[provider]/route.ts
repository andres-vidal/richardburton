import HTTP from "modules/http";
import { User } from "modules/users";
import { NextRequest, NextResponse } from "next/server";

const http = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

// OAuth callback: validate state, exchange the code for the provider id_token,
// run the admin gate, mint the Phoenix rb-session, and relay it to the browser.
// Phoenix stays the session authority — the id_token never reaches the client.
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

  // Phoenix Set-Cookie strings to relay to the browser (rb-session), collected
  // before `finish`.
  const relayed: string[] = [];

  // Always clear the handshake cookies, whatever the outcome.
  const finish = (location: string) => {
    const response = NextResponse.redirect(new URL(location, request.url));
    for (const name of ["oauth_state", "oauth_verifier", "oauth_next"]) {
      response.headers.append("Set-Cookie", expire(name));
    }
    for (const cookie of relayed) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("oauth_state")?.value;
  const verifier = request.cookies.get("oauth_verifier")?.value;
  const next = safeNext(
    request,
    request.cookies.get("oauth_next")?.value ?? "/",
  );

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

  const email = decodeEmail(idToken);
  const authorization = { headers: { Authorization: `Bearer ${idToken}` } };

  // Exchange the id_token for the app session: POST /sessions upserts the user,
  // mints the rb-session + csrf-token cookies, and returns the user (with role).
  // Relay the cookies only once the admin gate passes.
  let user: User | null = null;
  let sessionCookies: string[] = [];
  try {
    const response = await http.post<User>(
      "/sessions",
      { email },
      authorization,
    );
    user = response.data;
    const setCookie = response.headers["set-cookie"];
    if (setCookie) {
      sessionCookies = [setCookie].flat();
    }
  } catch (e) {
    console.error(e);
  }

  // Admin gate: only admins may sign in.
  if (!user || !User.isAdmin(user.role)) {
    return finish("/auth/error?error=AccessDenied");
  }

  relayed.push(...sessionCookies);
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
function safeNext(request: NextRequest, next: string): string {
  const host = request.headers.get("host");
  try {
    const url = new URL(next, `http://${host}`);
    return url.host === host ? url.pathname + url.search : "/";
  } catch {
    return "/";
  }
}

function expire(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
