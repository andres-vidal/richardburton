import { Google } from "arctic";
import invariant from "tiny-invariant";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const appUrl = process.env.APP_URL;

invariant(clientId, "Must provide GOOGLE_CLIENT_ID.");
invariant(clientSecret, "Must provide GOOGLE_CLIENT_SECRET.");
invariant(appUrl, "Must provide APP_URL.");

// OAuth providers. Add more here — the start/callback routes are provider-agnostic,
// and the backend verifies each provider's id_token on its own (see POST /sessions).
export const PROVIDERS = {
  google: {
    client: new Google(
      clientId,
      clientSecret,
      `${appUrl}/api/auth/callback/google`,
    ),
    scopes: ["openid", "email", "profile"],
  },
};

export type ProviderId = keyof typeof PROVIDERS;

export function isProvider(id: string): id is ProviderId {
  return id in PROVIDERS;
}
