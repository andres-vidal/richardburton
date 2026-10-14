import axios from "axios";
import { SESSION_COOKIE } from "modules/api";
import HTTP from "modules/http";
import { cookies } from "next/headers";

const api = HTTP.client({ baseURL: process.env.NEXT_INTERNAL_API_URL });

/**
 * Read from the backend inside a server component, as the signed-in user.
 *
 * The browser's `rb-session` cookie is httpOnly, so `get` forwards it to the
 * backend explicitly. Admin endpoints answer 401 without it, and `get` throws
 * that error, so the route's error boundary renders instead of an empty page.
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
 * Returns what `get` returns, or `null` when the backend answers 404. It throws
 * any other error.
 */
export async function getOrNull<T>(
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
