// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { post, validateAuthorizationCode } = vi.hoisted(() => ({
  post: vi.fn(),
  validateAuthorizationCode: vi.fn(),
}));

vi.mock("modules/oauth", () => ({
  PROVIDERS: { google: { client: { validateAuthorizationCode }, scopes: [] } },
  isProvider: (id: string) => id === "google",
}));

vi.mock("modules/http", () => ({ default: { client: () => ({ post }) } }));

import { GET } from "./route";

const google = { params: Promise.resolve({ provider: "google" }) };

/**
 * A callback request as it reaches the server behind the proxy: addressed to
 * the port the server listens on, not to the site's public address.
 */
function callback(cookie = "") {
  return new NextRequest(
    "https://0.0.0.0:3000/api/auth/callback/google?code=code&state=state",
    { headers: { cookie } },
  );
}

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://riburton.example.org");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the OAuth callback redirects to APP_URL", () => {
  test("when the handshake cookies are missing", async () => {
    const response = await GET(callback(), google);

    expect(response.headers.get("location")).toBe(
      "https://riburton.example.org/auth/error?error=Verification",
    );
  });

  test("when the backend refuses the account", async () => {
    validateAuthorizationCode.mockResolvedValue({ idToken: () => "token" });
    post.mockRejectedValue(new Error("403"));

    const response = await GET(
      callback("oauth_state=state; oauth_verifier=verifier"),
      google,
    );

    expect(response.headers.get("location")).toBe(
      "https://riburton.example.org/auth/error?error=AccessDenied",
    );
  });
});
