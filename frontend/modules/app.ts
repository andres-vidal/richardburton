import axios, { AxiosInstance } from "axios";
import { authClient } from "lib/auth-client";
import HTTP from "modules/http";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const GOOGLE_RECAPTCHA_SITEKEY =
  process.env.NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITEKEY!;

const http = HTTP.client({ baseURL: API_URL });

http.interceptors.request.use(async (config) => {
  try {
    const { data, error } = await authClient.token();

    if (!error && data?.token && config.headers) {
      config.headers.Authorization = `Bearer ${data.token}`;
    }
  } catch {
    // Not authenticated — proceed without token
  }

  return config;
});

async function request<T = void>(
  cb: (http: AxiosInstance) => Promise<T> | T,
): Promise<T> {
  try {
    const result = await cb(http);
    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.status === 409) {
          throw "conflict";
        } else {
          if (error.response.data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const detail = (error.response?.data as any).errors?.detail;
            if (detail) {
              throw detail;
            } else {
              throw error.response?.data;
            }
          } else {
            throw error.message;
          }
        }
      } else if (error.request) {
        // The request was made but no response was received
        throw error.message;
      } else {
        // Something happened in setting up the request that triggered an Error
        throw error.message;
      }
    } else {
      throw error;
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
