"use client";

import HTTP from "modules/http";
import { User } from "modules/users";
import { createContext, ReactNode, useContext } from "react";

const api = HTTP.client({ baseURL: process.env.NEXT_PUBLIC_API_URL });

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

/**
 * End the session and come back as nobody: the server drops it, then a full
 * load rebuilds the app from what is left, so nothing signed-in survives in
 * memory. Failing to reach the server still returns you to the front door —
 * the cookie is what stands, and it will be refused.
 */
export async function signOut() {
  await api.delete("/sessions").catch(() => undefined);
  window.location.replace("/");
}

/** Whether the reader may decide who has access. */
export function useIsAdmin(): boolean {
  return User.administers(useSession());
}

/**
 * Whether the reader may keep the catalogue — a contributor, or an admin, who
 * is also one. What the editing affordances hang on: administering is a
 * separate question, and a narrower one.
 */
export function useCurates(): boolean {
  return User.curates(useSession());
}
