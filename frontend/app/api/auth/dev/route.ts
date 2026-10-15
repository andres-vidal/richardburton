import { api } from "app/api";
import { admits } from "app/api/auth/gate";
import { User } from "modules/users";
import { NextRequest, NextResponse } from "next/server";

/**
 * Signs in without Google, in development only, and answers 404 otherwise.
 * It asks the backend for a session as the `?role` it names, an admin by
 * default, and then redirects and relays the session cookies as the OAuth
 * callback does, through `admits`. A failed request redirects to the error
 * page.
 *
 * The backend offers its side of this in development only too.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const role = request.nextUrl.searchParams.get("role") ?? "admin";

  let backend;
  try {
    backend = await api.post<User>("/dev/session", { role });
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(
      new URL("/auth/error?error=Verification", request.url),
    );
  }

  const { location, session } = admits(backend.data, "/");
  const response = NextResponse.redirect(new URL(location, request.url));

  if (session) {
    for (const cookie of backend.headers["set-cookie"] ?? []) {
      response.headers.append("Set-Cookie", cookie);
    }
  }

  return response;
}
