import axios, { AxiosInstance } from "axios";
import Notifications from "components/Notifications";
import { Provider } from "jotai";
import ClearSelection from "listeners/ClearSelection";
import HTTP from "modules/http";
import { store } from "modules/store";
import type { AppProps } from "next/app";
import Head from "next/head";
import { FC } from "react";
import "styles/globals.css";

const APP_NAME = "Richard & Isabel Burton Platform";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const GOOGLE_RECAPTCHA_SITEKEY =
  process.env.NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITEKEY!;

const http = HTTP.client({ baseURL: API_URL });

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
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
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

const App: FC<AppProps> = ({ Component, pageProps }) => {
  return (
    <Provider store={store}>
      <Head>
        <title>{APP_NAME}</title>
      </Head>
      <Notifications />
      <ClearSelection />
      <Component {...pageProps} />
    </Provider>
  );
};

export default App;
export { API_URL, GOOGLE_RECAPTCHA_SITEKEY, http, Key, request };
