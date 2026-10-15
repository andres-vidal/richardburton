/**
 * The cookie and header names the frontend and the Phoenix backend share. Each
 * value must match the backend's exactly: see `RichardBurton.Auth.Session`,
 * `RichardBurton.Auth.Csrf` and `RichardBurton.Publication.Index`.
 *
 * The module imports nothing, so code that runs anywhere can read it.
 */

/** The httpOnly cookie that holds the raw session token. */
export const SESSION_COOKIE = "rb-session";

/** The readable cookie that holds the double-submit CSRF token. */
export const CSRF_COOKIE = "csrf-token";

/** The request header that echoes the CSRF token from `CSRF_COOKIE`. */
export const CSRF_HEADER = "rb-csrf-token";

/** The response header that holds the index's total publication count. */
export const TOTAL_COUNT_HEADER = "rb-total-count";
