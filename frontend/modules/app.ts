import axios, { AxiosInstance } from "axios";
import HTTP, { ApiError } from "modules/http";

// App-wide constants, the browser's API client and the request wrapper,
// imported through the `app` path alias.

/** The address the browser reaches the backend's API on. */
const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** The site key the reCAPTCHA widget is rendered with. */
const GOOGLE_RECAPTCHA_SITEKEY =
  process.env.NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITEKEY!;

/** The HTTP client for the backend at `API_URL`. See `HTTP.client`. */
const http = HTTP.client({ baseURL: API_URL });

/**
 * Runs `cb` with the API client and returns its result.
 *
 * When a request `cb` makes fails, `request` throws an `ApiError` that holds the
 * response's status and body. It rethrows any other error unchanged.
 */
async function request<T = void>(
  cb: (http: AxiosInstance) => Promise<T> | T,
): Promise<T> {
  try {
    return await cb(http);
  } catch (error) {
    throw axios.isAxiosError(error) ? ApiError.from(error) : error;
  }
}

/** The `KeyboardEvent.key` values the components listen for. */
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
