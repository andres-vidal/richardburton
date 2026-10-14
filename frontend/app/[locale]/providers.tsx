"use client";

import Notifications from "components/Notifications";
import { Provider } from "jotai";
import { SessionProvider } from "modules/session";
import { store } from "modules/store";
import type { User } from "modules/users";
import { ReactNode } from "react";

/**
 * Renders the providers every page runs inside: `session` for `useSession`,
 * the app's Jotai `store`, and the `Notifications` stack, above `children`.
 */
export function Providers({
  session,
  children,
}: {
  session: User | null;
  children: ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <Provider store={store}>
        <Notifications />
        {children}
      </Provider>
    </SessionProvider>
  );
}
