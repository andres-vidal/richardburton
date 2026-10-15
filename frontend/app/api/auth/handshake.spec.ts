// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

import { handshakeCookie } from "./handshake";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a handshake cookie", () => {
  test("is Secure when the app is served over https", () => {
    vi.stubEnv("APP_URL", "https://riburton.example.org");

    expect(handshakeCookie("oauth_state", "a b")).toBe(
      "oauth_state=a%20b; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; Secure",
    );
  });

  test("is not Secure when the app is served over plain HTTP", () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");

    expect(handshakeCookie("oauth_state", "", 0)).toBe(
      "oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    );
  });
});
