import axios from "axios";
import { SESSION_COOKIE } from "modules/api";
import HTTP from "modules/http";
import { cookies } from "next/headers";

/**
 * The HTTP client for the backend at the address the Next.js server reaches it
 * on, `NEXT_INTERNAL_API_URL`. It is built by `HTTP.client` like the browser's
 * client, so it converts bodies between camelCase and snake_case and leaves
 * header names as they are. Use it only in code that runs on the server.
 *
 * It sends no session cookie of its own. `get` and its variants forward the
 * request's `rb-session` cookie.
 */
const api = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

/**
 * Reads `path` from the backend as the signed-in user, and returns the body.
 *
 * The browser's `rb-session` cookie is httpOnly, so `get` forwards it to the
 * backend explicitly. Admin endpoints answer 401 without it, and `get` throws
 * that error, so the route's error boundary renders instead of an empty page.
 */
async function get<T>(
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return (await getWithHeaders<T>(path, params)).data;
}

/**
 * Returns what `get` returns, or `null` when the backend answers 404. It throws
 * any other error.
 */
async function getOrNull<T>(
  path: string,
  params?: Record<string, unknown>,
): Promise<T | null> {
  try {
    return await get<T>(path, params);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads `path` like `get`, and returns the body with the response headers,
 * for an answer that is partly in its headers, such as the index's total count
 * in `rb-total-count`.
 */
async function getWithHeaders<T>(
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

export { api, get, getOrNull, getWithHeaders };
