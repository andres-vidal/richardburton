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
    return axiosCaseConverter(
      axios.create({ withCredentials: true, ...options }),
    );
  },
};

export default HTTP;
