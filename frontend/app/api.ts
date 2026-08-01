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
export async function get<T>(
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return (await getWithHeaders<T>(path, params)).data;
}

/**
 * The same read, with the response headers — some answers are partly in them
 * (the index reports how many publications exist in `rb-total-count`).
 */
export async function getWithHeaders<T>(
  path: string,
  params?: Record<string, unknown>,
): Promise<{ data: T; headers: Record<string, string> }> {
  const cookie = (await cookies()).get(SESSION_COOKIE);

  const { data, headers } = await api.get<T>(path, {
    params,
    headers: cookie ? { Cookie: `${cookie.name}=${cookie.value}` } : {},
  });

  return { data, headers: headers as Record<string, string> };
}
