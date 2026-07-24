import { SESSION_COOKIE } from "modules/api";
import HTTP from "modules/http";
import type { User } from "modules/users";
import { cookies } from "next/headers";

const api = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

// Read the httpOnly rb-session cookie server-side and ask the backend who the
// user is (GET /users/me → user or null). Fetched in the root layout (provided
// app-wide via SessionProvider) and re-checked by the admin layout guard.
export async function getSession(): Promise<User | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE);
  if (!cookie) return null;

  try {
    const { data } = await api.get<User | null>("/users/me", {
      headers: { Cookie: `${cookie.name}=${cookie.value}` },
    });
    return data ?? null;
  } catch {
    return null;
  }
}
