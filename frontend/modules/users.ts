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
 * it admit: a contributor keeps the catalogue, an admin also decides who may.
 */
const ROLES: UserRole[] = ["reader", "contributor", "admin"];

/**
 * How a role is named to a reader.
 *
 * The value in the enum is what the database calls it, and reads like it —
 * nothing else in the app shows a stored value raw, and a role should not
 * either.
 */
const ROLE_LABELS: Record<UserRole, string> = {
  reader: "Reader",
  contributor: "Contributor",
  admin: "Administrator",
};

/** What a role admits, said to whoever is handing it out. */
const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  reader: "Can browse the catalogue, like anyone else.",
  contributor: "Can add and correct publications.",
  admin: "Can do that, and decide who else may.",
};

/**
 * A role named for the middle of a sentence, article and all: "is now an
 * Administrator". Which article a role takes is a property of its name, so it
 * is decided here rather than at each place that writes one.
 */
function describeRole(role: UserRole): string {
  const label = ROLE_LABELS[role];
  return `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`;
}

interface UserModule {
  /** Whether a session — possibly none at all — holds `required`, or outranks it. */
  holds(session: User | null | undefined, required: UserRole): boolean;
  /** Whether a session — possibly none at all — may decide who has access. */
  administers(session: User | null | undefined): boolean;
  /** Whether a session — possibly none at all — may keep the catalogue. */
  curates(session: User | null | undefined): boolean;
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

  administers(session) {
    return User.holds(session, "admin");
  },

  curates(session) {
    return User.holds(session, "contributor");
  },
};

export { describeRole, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, User };
export type { UserRecord, UserRole };
