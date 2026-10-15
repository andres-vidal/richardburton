"use client";

import { http } from "app";
import { User } from "modules/users";
import { createContext, ReactNode, useContext } from "react";

/**
 * The signed-in user, or null when nobody is signed in.
 *
 * The root layout reads the session on the server and provides it here, so no
 * component fetches it. Signing in, signing out and a 401 each load a whole
 * page, so the value is read again whenever it changes.
 */
const SessionContext = createContext<User | null>(null);

/** Makes `session` available to `useSession` in its children. */
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

/** Returns the signed-in user, or null when nobody is signed in. */
export function useSession(): User | null {
  return useContext(SessionContext);
}

/** Returns whether somebody is signed in. */
export function useIsAuthenticated(): boolean {
  return useSession() != null;
}

/**
 * Ends the session on the server, then loads the front page in full, so no
 * state built for the session stays in memory. The front page is loaded even
 * when the request fails.
 */
export async function signOut() {
  await http.delete("/sessions").catch(() => undefined);
  window.location.replace("/");
}

/**
 * Returns whether the signed-in user may add and correct publications, which a
 * contributor and an admin may. Deciding who has access is a separate
 * permission, held only by an admin.
 */
export function useCanEditPublications(): boolean {
  return User.canEditPublications(useSession());
}
