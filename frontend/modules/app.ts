import axios, { AxiosInstance } from "axios";
import HTTP from "modules/http";

// App-wide constants, the API client and the request wrapper, imported through
// the `app` path alias.

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const GOOGLE_RECAPTCHA_SITEKEY =
  process.env.NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITEKEY!;

const http = HTTP.client({ baseURL: API_URL });

/**
 * Runs `cb` with the API client and returns its result. When an axios request
 * fails, `request` throws a value that describes the failure instead of the
 * axios error:
 *
 * - for a 409, the response's `error` field, or "conflict" when it has none;
 * - for any other response with a body, the body's `errors.detail`, or the
 *   whole body when it has no detail;
 * - for a response without a body, or no response at all, the error's message.
 *
 * Any other error is rethrown unchanged.
 */
async function request<T = void>(
  cb: (http: AxiosInstance) => Promise<T> | T,
): Promise<T> {
  try {
    return await cb(http);
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error;

    const { response } = error;

    if (response?.status === 409) {
      throw (
        (response.data as { error?: string } | undefined)?.error ?? "conflict"
      );
    } else if (response?.data) {
      throw (
        (response.data as { errors?: { detail?: unknown } }).errors?.detail ||
        response.data
      );
    } else {
      throw error.message;
    }
  }
}

enum Key {
  ENTER = "Enter",
  ARROW_RIGHT = "ArrowRight",
  ARROW_UP = "ArrowUp",
  ARROW_DOWN = "ArrowDown",
  BACKSPACE = "Backspace",
  COMMA = ",",
  ESCAPE = "Escape",
}

export { API_URL, GOOGLE_RECAPTCHA_SITEKEY, http, Key, request };
