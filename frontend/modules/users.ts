import { useSession } from "next-auth/react";

type UserRole = "admin" | "reader" | "contributor";
type User = { email: string; role: UserRole };

interface UserModule {
  isAdmin(role: UserRole): role is "admin";
  isReader(role: UserRole): role is "reader";
  isContributor(role: UserRole): role is "contributor";

  useIsAuthenticated(): boolean;
}

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

  useIsAuthenticated() {
    const session = useSession();
    return session.status === "authenticated";
  },
};

export { User };
export type { UserRole };
