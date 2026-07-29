import { User } from "modules/users";

/**
 * Where a sign-in lands, and whether the session goes with it.
 *
 * Three outcomes: someone who may edit publications gets the session and the
 * page they asked for; someone with an account but only a reader's role is sent
 * to the pending page without one; someone with no account at all is sent to
 * the error page, since nobody invited them.
 *
 * Both the Google callback and the dev provider decide here, so the one the
 * E2E suite signs in through cannot admit more than the real handshake does.
 */
function admits(
  user: User | null | undefined,
  destination: string,
): { location: string; session: boolean } {
  return User.canEditPublications(user)
    ? { location: destination, session: true }
    : {
        location: user ? "/auth/pending" : "/auth/error?error=AccessDenied",
        session: false,
      };
}

export { admits };
