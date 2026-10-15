import { Google } from "arctic";
import { appUrl } from "modules/app-url";
import invariant from "tiny-invariant";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

invariant(clientId, "Must provide GOOGLE_CLIENT_ID.");
invariant(clientSecret, "Must provide GOOGLE_CLIENT_SECRET.");

/**
 * The OAuth providers a person can sign in with, by the name the auth routes
 * take: each one's client and the scopes it asks for.
 *
 * The routes work with any provider listed here, and the backend verifies each
 * provider's id token itself, so adding a provider needs only an entry here.
 * Loading the module throws when the client's credentials or `APP_URL` are not
 * set.
 */
export const PROVIDERS = {
  google: {
    client: new Google(
      clientId,
      clientSecret,
      `${appUrl()}/api/auth/callback/google`,
    ),
    scopes: ["openid", "email", "profile"],
  },
};

/** The name of a provider in `PROVIDERS`. */
type ProviderId = keyof typeof PROVIDERS;

/** Returns whether `id` names a provider in `PROVIDERS`. */
export function isProvider(id: string): id is ProviderId {
  return id in PROVIDERS;
}
