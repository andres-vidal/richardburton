import { SESSION_COOKIE } from "modules/api";
import HTTP from "modules/http";
import type { User } from "modules/users";
import { cookies } from "next/headers";
import { cache } from "react";

const api = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

// Read the httpOnly rb-session cookie server-side and ask the backend who the
// user is (GET /users/me → user or null). Asked for in several places while one
// page renders — the root layout, the admin guard, a record deciding whether to
// read its log — and answered once.
export const getSession = cache(async (): Promise<User | null> => {
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
});
