import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import axiosCaseConverter from "axios-case-converter";
import { CSRF_HEADER } from "modules/api";

type HttpClientOptions = AxiosRequestConfig;
type HttpClient = AxiosInstance;

interface HttpModule {
  client(options: HttpClientOptions): HttpClient;
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const row = document.cookie.split("; ").find((r) => r.startsWith(prefix));
  return row?.slice(prefix.length);
}

const HTTP: HttpModule = {
  client(options) {
    // withCredentials so the browser sends/receives the backend's rb-session cookie.
    // ignoreHeaders: convert JSON bodies (camelCase ↔ snake_case) but leave header
    // names alone. Otherwise the converter renames the response `set-cookie` header
    // to `setCookie`, so the OAuth callback's `headers["set-cookie"]` reads undefined
    // and Phoenix's rb-session is never relayed to the browser (sign-in appears to
    // do nothing — you land back signed-out).
    const instance = axiosCaseConverter(
      axios.create({ withCredentials: true, ...options }),
      { ignoreHeaders: true },
    );

    // Double-submit CSRF: echo the readable `csrf-token` cookie (set by the
    // backend at login) in the rb-csrf-token header. The backend enforces it on
    // state-changing admin endpoints; everything else ignores it. Server-side
    // callers (no document) skip it — they authenticate with the bearer token.
    instance.interceptors.request.use((config) => {
      const token =
        typeof document === "undefined" ? undefined : readCookie("csrf-token");
      if (token) config.headers.set(CSRF_HEADER, token);
      return config;
    });

    // A backend 401 means the rb-session is gone (expired/revoked) — send the
    // user to sign in again. (GET /users/me returns null, not 401, so polling
    // auth state won't trip this.)
    instance.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 401 &&
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/auth")
        ) {
          window.location.assign("/auth/sign-in");
        }

        return Promise.reject(error);
      },
    );

    return instance;
  },
};

export default HTTP;
