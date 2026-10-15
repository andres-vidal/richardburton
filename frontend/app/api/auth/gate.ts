import { User } from "modules/users";

/**
 * Returns where a sign-in of `user` lands, and whether the session cookies go
 * with it:
 *
 * - a user who may edit publications gets the session, and lands on
 *   `destination`;
 * - a user with only the reader's role lands on the pending page, without a
 *   session;
 * - no user, because the backend refused the account, lands on the error page
 *   with `AccessDenied`, without a session.
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
