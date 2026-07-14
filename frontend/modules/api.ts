// Custom cookie and header names on the wire with the Phoenix backend. This is a
// contract: each value must match the backend's exactly (see the owning modules
// RichardBurton.Auth.Session, RichardBurton.Auth.Csrf, and
// RichardBurton.Publication.Index). Kept dependency-free so it can be imported
// from anywhere, including the edge middleware.

/** httpOnly cookie carrying the raw session token. */
export const SESSION_COOKIE = "rb-session";

/** Request header echoing the double-submit CSRF token. */
export const CSRF_HEADER = "rb-csrf-token";

/** Response header carrying the index's total publication count. */
export const TOTAL_COUNT_HEADER = "rb-total-count";
