import { betterAuth } from "better-auth";
import invariant from "tiny-invariant";

const baseURL = process.env.BETTER_AUTH_URL;
const secret = process.env.BETTER_AUTH_SECRET;

invariant(baseURL, "Must provide BETTER_AUTH_URL.");
invariant(secret, "Must provide BETTER_AUTH_SECRET.");

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

invariant(googleClientId, "Must provide GOOGLE_CLIENT_ID.");
invariant(googleClientSecret, "Must provide GOOGLE_CLIENT_SECRET.");

export const auth = betterAuth({
  baseURL,
  secret,
  session: {
    cookieCache: {
      enabled: true,
      strategy: "jwe",
      maxAge: 60 * 60 * 24,
    },
  },
  account: {
    storeStateStrategy: "cookie",
    storeAccountCookie: true,
  },
  socialProviders: {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    },
  },
});
