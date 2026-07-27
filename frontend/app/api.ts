import { SESSION_COOKIE } from "modules/api";
import HTTP from "modules/http";
import { cookies } from "next/headers";

const api = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

/**
 * Read from the backend inside a server component, as the signed-in user.
 *
 * The browser's `rb-session` is httpOnly, so a server render has to forward it
 * explicitly — the same move `getSession` makes, and the reason a page can be
 * rendered on the server at all without losing who is asking. Admin endpoints
 * answer 401 without it, which surfaces as a thrown error and so as the route's
 * error boundary rather than a page that renders empty and lies.
 *
 * Responses come back camelCased, since this is the same client the browser
 * uses.
 */
export async function read<T>(path: string): Promise<T> {
  const cookie = (await cookies()).get(SESSION_COOKIE);

  const { data } = await api.get<T>(path, {
    headers: cookie ? { Cookie: `${cookie.name}=${cookie.value}` } : {},
  });

  return data;
}
