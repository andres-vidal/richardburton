import { http } from "app";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { vi } from "vitest";

/** A mocked method of the API client. Its calls and results are untyped. */
type Stub = ReturnType<typeof vi.fn>;

/**
 * Returns the error axios rejects with when the server answers `status` with
 * `body`.
 */
function httpError(status: number, body?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse = {
    status,
    statusText: "",
    data: body,
    headers: {},
    config,
  };

  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    response,
  );
}

/** Returns the error axios rejects with when no response arrives. */
function networkError(): AxiosError {
  return new AxiosError("Network Error", AxiosError.ERR_NETWORK);
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/**
 * Replaces the methods of the API client that `request` passes to its callback
 * with mocks, and returns the mocks. `request` itself still runs, so a mock
 * that rejects with `httpError` makes `request` throw an `ApiError`.
 *
 * A mock that is given no result rejects with an error naming the method, so
 * no test reaches the network. The mocks are `vi.spyOn` spies, so
 * `vi.restoreAllMocks` puts the real methods back.
 */
function stubHttp(): Record<(typeof METHODS)[number], Stub> {
  return Object.fromEntries(
    METHODS.map((method) => [
      method,
      vi.spyOn(http, method).mockImplementation(async () => {
        throw new Error(`No result stubbed for http.${method}`);
      }),
    ]),
  ) as unknown as Record<(typeof METHODS)[number], Stub>;
}

export { httpError, networkError, stubHttp };
