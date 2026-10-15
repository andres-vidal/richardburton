/** What a user may do. See `ROLES`. */
type UserRole = "reader" | "contributor" | "admin";

/** Who is signed in: what the session says about them, and no more. */
type User = {
  email: string;
  role: UserRole;
};

/** A user as the access list holds them, with the id that addresses them. */
type UserRecord = User & {
  id: number;
  insertedAt: string;
};

/**
 * The roles, least privileged first. A role allows everything the roles before
 * it allow: a contributor adds and corrects publications, and an admin also
 * decides who has access.
 */
const ROLES: UserRole[] = ["reader", "contributor", "admin"];

/**
 * The checks of what a session allows. Each takes the session, or null or
 * undefined when nobody is signed in. The module does not import React, so it
 * runs on the server as well as in the browser.
 */
interface UserModule {
  /** Whether the session holds the role `required`, or one after it in `ROLES`. */
  holds(session: User | null | undefined, required: UserRole): boolean;
  /** Whether the session may decide who has access. */
  canManageAccess(session: User | null | undefined): boolean;
  /** Whether the session may add and correct publications. */
  canEditPublications(session: User | null | undefined): boolean;
}

const User: UserModule = {
  holds(session, required) {
    return (
      session != null && ROLES.indexOf(session.role) >= ROLES.indexOf(required)
    );
  },

  canManageAccess(session) {
    return User.holds(session, "admin");
  },

  canEditPublications(session) {
    return User.holds(session, "contributor");
  },
};

export { ROLES, User };
export type { UserRecord, UserRole };
