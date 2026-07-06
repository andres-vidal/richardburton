import HTTP from "modules/http";
import { useEffect, useState } from "react";

type UserRole = "admin" | "reader" | "contributor";
type User = { email: string; role: UserRole };

const api = HTTP.client({ baseURL: process.env.NEXT_PUBLIC_API_URL });

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

  // Auth state lives in the httpOnly rb-session cookie, so the SPA learns it by
  // asking the backend: GET /users/me returns the user or null (never 401).
  //
  // TODO: once we move to the App Router, fetch this in an RSC (root
  // layout) and provide the session app-wide — no client fetch, store, or effect.
  useIsAuthenticated() {
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
      let active = true;

      api
        .get<User | null>("/users/me")
        .then(({ data }) => active && setAuthenticated(data != null))
        .catch(() => active && setAuthenticated(false));

      return () => {
        active = false;
      };
    }, []);

    return authenticated;
  },
};

export { User };
export type { UserRole };
