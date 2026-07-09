"use client";

import type { User } from "modules/users";
import { createContext, ReactNode, useContext } from "react";

// The signed-in user (or null), fetched once server-side in the root layout and
// provided app-wide — no client fetch, store, or effect. Auth transitions
// (sign in / sign out / 401) all do full page loads, so this stays fresh.
const SessionContext = createContext<User | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: User | null;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): User | null {
  return useContext(SessionContext);
}

export function useIsAuthenticated(): boolean {
  return useSession() != null;
}
