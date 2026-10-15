import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import axiosCaseConverter from "axios-case-converter";
import { routing } from "i18n/routing";
import { CSRF_COOKIE, CSRF_HEADER } from "modules/api";
import qs from "qs";

// Returns the value of the cookie `name` from `document.cookie`, or undefined
// when the cookie is not set.
function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const row = document.cookie.split("; ").find((r) => r.startsWith(prefix));
  return row?.slice(prefix.length);
}

/**
 * Returns the double-submit CSRF token from the readable `CSRF_COOKIE`, or
 * `undefined` on the server or when the cookie is not set.
 */
export function csrfToken(): string | undefined {
  return typeof document === "undefined" ? undefined : readCookie(CSRF_COOKIE);
}

// Returns whether `value` is a plain object rather than null or an array.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A request to the backend that failed.
 *
 * - `status` is the HTTP status of the response, or undefined when no response
 *   arrived, as on a network failure.
 * - `code` is the reason the response gives: the `error` field of a body such
 *   as `{"error": "conflict"}`.
 * - `errors` holds the field errors of a body such as
 *   `{"errors": {"title": "required"}}`, keyed by field. It is undefined for
 *   the body the backend sends for a crash or an unknown route,
 *   `{"errors": {"detail": "Not Found"}}`, which names no field.
 * - `body` is the whole response body, for an endpoint that sends more than a
 *   reason or field errors.
 *
 * The message is the code, or a description of the failure when there is no
 * code.
 */
export class ApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly errors: Record<string, unknown> | undefined;
  readonly body: unknown;

  constructor(status: number | undefined, body?: unknown, message?: string) {
    const code =
      isRecord(body) && typeof body.error === "string" ? body.error : undefined;

    super(
      code ??
        message ??
        (status === undefined
          ? "No response"
          : `Request failed with status ${status}`),
    );

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors =
      isRecord(body) && isRecord(body.errors) && !("detail" in body.errors)
        ? body.errors
        : undefined;
    this.body = body;
  }

  /** Returns the `ApiError` that describes the failed axios request `error`. */
  static from(error: AxiosError): ApiError {
    return new ApiError(
      error.response?.status,
      error.response?.data,
      error.message,
    );
  }
}

/**
 * Matches the path of a page under `/auth`, such as `/en/auth/sign-in`, with or
 * without a locale before it.
 */
const AUTH_PAGE = new RegExp(
  `^(?:/(?:${routing.locales.join("|")}))?/auth(?:/|$)`,
);

/**
 * Builds HTTP clients for the backend.
 *
 * `HTTP.client(options)` returns an axios instance configured with `options`
 * that:
 *
 * - sends and receives cookies (`withCredentials`), so the browser sends the
 *   backend's `rb-session` cookie;
 * - converts JSON bodies between camelCase and snake_case, and leaves header
 *   names as they are, so a response's `set-cookie` header keeps its name;
 * - writes array query parameters with brackets (`ids[]=1&ids[]=2`), which
 *   Plug reads back as a list;
 * - sends the token from `CSRF_COOKIE` in the `CSRF_HEADER` header when the
 *   cookie is readable, which it is only in the browser;
 * - loads the sign-in page when a response is a 401 in the browser, unless the
 *   page is already under `/auth`. A 401 means the request carried no valid
 *   session, because the session expired or was revoked. The page is loaded in
 *   full, so the state built for the old session is dropped. Every other
 *   failure, a 403 included, reaches the caller.
 */
const HTTP = {
  client(options: AxiosRequestConfig): AxiosInstance {
    const instance = axiosCaseConverter(
      axios.create({
        withCredentials: true,
        paramsSerializer: (params) =>
          qs.stringify(params, { arrayFormat: "brackets" }),
        ...options,
      }),
      { ignoreHeaders: true },
    );

    instance.interceptors.request.use((config) => {
      const token = csrfToken();
      if (token) config.headers.set(CSRF_HEADER, token);
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 401 &&
          typeof window !== "undefined" &&
          !AUTH_PAGE.test(window.location.pathname)
        ) {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/auth/sign-in");
        }

        return Promise.reject(error);
      },
    );

    return instance;
  },
};

export default HTTP;
