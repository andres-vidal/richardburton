type UserRole = "admin" | "reader" | "contributor";
type User = { email: string; role: UserRole };

interface UserModule {
  isAdmin(role: UserRole): role is "admin";
  isReader(role: UserRole): role is "reader";
  isContributor(role: UserRole): role is "contributor";
  /** Whether a session — possibly none at all — may administer the catalogue. */
  administers(session: User | null | undefined): boolean;
}

// Pure, server-safe user helpers — usable from route handlers / Server
// Components. The client-side session context/hooks live in `modules/session`
// so this module stays free of React.
const User: UserModule = {
  isAdmin(role): role is "admin" {
    return role === "admin";
  },

  isReader(role): role is "reader" {
    return role === "reader";
  },

  isContributor(role): role is "contributor" {
    return role === "contributor";
  },

  administers(session) {
    return session != null && User.isAdmin(session.role);
  },
};

export { User };
export type { UserRole };
