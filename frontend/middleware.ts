import { NextResponse, type NextRequest } from "next/server";

// Guard protected pages behind the rb-session cookie. Presence-only (fast,
// edge-safe); the backend authorizes every request on its own.
export function middleware(request: NextRequest) {
  if (!request.cookies.get("rb-session")) {
    const url = new URL("/auth/sign-in", request.url);
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/publications/new"] };
