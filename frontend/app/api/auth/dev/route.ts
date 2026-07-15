import HTTP from "modules/http";
import { NextRequest, NextResponse } from "next/server";

const http = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

// Dev-only credentials provider: asks the backend to mint an admin rb-session
// (no Google OAuth) and relays its Set-Cookie to the browser, exactly like the
// OAuth callback. Guarded to development on both ends — 404 otherwise.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const response = NextResponse.redirect(new URL("/", request.url));

  try {
    const backend = await http.post("/dev/session", {});
    const setCookie = backend.headers["set-cookie"];
    if (setCookie) {
      for (const cookie of [setCookie].flat()) {
        response.headers.append("Set-Cookie", cookie);
      }
    }
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(
      new URL("/auth/error?error=Verification", request.url),
    );
  }

  return response;
}
