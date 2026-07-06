import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import axiosCaseConverter from "axios-case-converter";

type HttpClientOptions = AxiosRequestConfig;
type HttpClient = AxiosInstance;

interface HttpModule {
  client(options: HttpClientOptions): HttpClient;
}

const HTTP: HttpModule = {
  client(options) {
    // withCredentials so the browser sends/receives the backend's rb-session cookie.
    const instance = axiosCaseConverter(
      axios.create({ withCredentials: true, ...options }),
    );

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
