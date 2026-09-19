type UserRole = "reader" | "contributor" | "admin";

/** Who is signed in: what the session says about them, and no more. */
type User = {
  email: string;
  role: UserRole;
};

/** A user as the access list knows them — a row that can be addressed. */
type UserRecord = User & {
  id: number;
  insertedAt: string;
};

/**
 * The roles, least privileged first. A role admits everything the ones before
 * it admit: a contributor adds and corrects publications, an admin also decides who may.
 */
const ROLES: UserRole[] = ["reader", "contributor", "admin"];

// How a role is named to a reader, and what it admits, are in the `roles`
// catalogue under the very name the database uses. A role in the middle of a
// sentence takes an article there too, since which article it takes is a
// property of the name and so differs by language.

interface UserModule {
  /** Whether a session — possibly none at all — holds `required`, or outranks it. */
  holds(session: User | null | undefined, required: UserRole): boolean;
  /** Whether a session — possibly none at all — may decide who has access. */
  canManageAccess(session: User | null | undefined): boolean;
  /** Whether a session — possibly none at all — may add and correct publications. */
  canEditPublications(session: User | null | undefined): boolean;
}

// Pure, server-safe user helpers — usable from route handlers / Server
// Components. The client-side session context/hooks live in `modules/session`
// so this module stays free of React.
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
