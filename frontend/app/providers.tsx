"use client";

import Notifications from "components/Notifications";
import { Provider } from "jotai";
import ClearSelection from "listeners/ClearSelection";
import { SessionProvider } from "modules/session";
import { store } from "modules/store";
import type { User } from "modules/users";
import { ReactNode } from "react";

// The app's client-side chrome — ports the providers from the (Pages Router)
// `_app.tsx`: the Jotai store plus the global notification/selection listeners.
// `session` is fetched server-side in the root layout (see app/layout.tsx).
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
        <ClearSelection />
        {children}
      </Provider>
    </SessionProvider>
  );
}
