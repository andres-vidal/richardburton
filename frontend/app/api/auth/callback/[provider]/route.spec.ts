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

vi.mock("app/api", () => ({ api: { post } }));

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

const HANDSHAKE = "oauth_state=state; oauth_verifier=verifier";

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://riburton.example.org");
  vi.spyOn(console, "error").mockImplementation(() => {});
  validateAuthorizationCode.mockResolvedValue({ idToken: () => "token" });
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
    post.mockRejectedValue(new Error("403"));

    const response = await GET(callback(HANDSHAKE), google);

    expect(response.headers.get("location")).toBe(
      "https://riburton.example.org/auth/error?error=AccessDenied",
    );
  });
});

describe("a user who may edit publications", () => {
  const signedIn = (role: string) => ({
    data: { email: "editor@rb.test", role },
    headers: { "set-cookie": ["rb-session=token; Path=/; HttpOnly"] },
  });

  test("lands on the address the handshake kept, with the session", async () => {
    post.mockResolvedValue(signedIn("contributor"));

    const response = await GET(
      callback(`${HANDSHAKE}; oauth_next=%2Fadmin%3Fx%3D1`),
      google,
    );

    expect(response.headers.get("location")).toBe(
      "https://riburton.example.org/admin?x=1",
    );
    expect(response.headers.getSetCookie()).toContain(
      "rb-session=token; Path=/; HttpOnly",
    );
  });

  test("lands on the index when the kept address names another site", async () => {
    post.mockResolvedValue(signedIn("admin"));

    const response = await GET(
      callback(`${HANDSHAKE}; oauth_next=https%3A%2F%2Fevil.example`),
      google,
    );

    expect(response.headers.get("location")).toBe(
      "https://riburton.example.org/",
    );
  });

  test("a reader lands on the pending page without the session", async () => {
    post.mockResolvedValue(signedIn("reader"));

    const response = await GET(callback(HANDSHAKE), google);

    expect(response.headers.get("location")).toBe(
      "https://riburton.example.org/auth/pending",
    );
    expect(
      response.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("rb-session")),
    ).toBe(false);
  });
});

test("the callback deletes the handshake cookies", async () => {
  const response = await GET(callback(), google);

  expect(response.headers.getSetCookie()).toEqual([
    "oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure",
    "oauth_verifier=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure",
    "oauth_next=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure",
  ]);
});
