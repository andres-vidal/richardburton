import { admits } from "app/api/auth/gate";
import HTTP from "modules/http";
import { User } from "modules/users";
import { NextRequest, NextResponse } from "next/server";

const http = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

// Dev-only credentials provider: asks the backend to mint an rb-session (no
// Google OAuth) and relays its Set-Cookie to the browser, exactly like the OAuth
// callback — including where it sends each role afterwards, so what is exercised
// here is what a real sign-in does. `?role=` picks which role to sign in as.
// Guarded to development on both ends — 404 otherwise.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const role = request.nextUrl.searchParams.get("role") ?? "admin";

  let backend;
  try {
    backend = await http.post<User>("/dev/session", { role });
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(
      new URL("/auth/error?error=Verification", request.url),
    );
  }

  const { location, session } = admits(backend.data, "/");
  const response = NextResponse.redirect(new URL(location, request.url));

  if (session) {
    for (const cookie of [backend.headers["set-cookie"] ?? []].flat()) {
      response.headers.append("Set-Cookie", cookie);
    }
  }

  return response;
}
