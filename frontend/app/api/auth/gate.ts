import { User } from "modules/users";

/**
 * Where a sign-in lands, and whether the session goes with it.
 *
 * Nobody invited them, so there is no account and nothing pending — the sign-in
 * worked and this platform still does not know them. Someone who *is* known but
 * holds no role yet is a different thing, and told so.
 *
 * One decision, so the dev provider cannot be kinder than the real handshake:
 * the E2E suite signs in through the stand-in, and a stand-in that admits more
 * than the thing it stands in for tests nothing.
 */
function admits(
  user: User | null | undefined,
  destination: string,
): { location: string; session: boolean } {
  return User.curates(user)
    ? { location: destination, session: true }
    : {
        location: user ? "/auth/pending" : "/auth/error?error=AccessDenied",
        session: false,
      };
}

export { admits };
