import { get } from "app/api";
import { SESSION_COOKIE } from "modules/api";
import type { User } from "modules/users";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Returns the signed-in user, as the backend's `GET /users/me` reports it for
 * the request's `rb-session` cookie. Returns `null` without asking the backend
 * when there is no cookie, and `null` when the backend does not answer with a
 * user. The answer is cached for the rest of the request.
 */
export const getSession = cache(async (): Promise<User | null> => {
  if (!(await cookies()).has(SESSION_COOKIE)) return null;

  try {
    return (await get<User | null>("/users/me")) ?? null;
  } catch {
    return null;
  }
});
