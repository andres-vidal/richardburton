"use client";

import Notifications from "components/Notifications";
import { Provider } from "jotai";
import { setCountryNames } from "modules/country";
import type { Country } from "modules/country";
import { SessionProvider } from "modules/session";
import { store } from "modules/store";
import type { User } from "modules/users";
import { ReactNode } from "react";

// The app's client-side chrome — ports the providers from the (Pages Router)
// `_app.tsx`: the Jotai store plus the global notification/selection listeners.
// This is also where what the server read for the client is handed over, since
// it is the boundary the locale layout renders across: `session` and
// `countries` are both read there (see app/[locale]/layout.tsx).
export function Providers({
  session,
  countries,
  locale,
  children,
}: {
  session: User | null;
  /** Every country, named by the server in `locale`. */
  countries: Country[];
  locale: string;
  children: ReactNode;
}) {
  // Said before the children render, not in an effect: a cell asks for a
  // country's name as it renders, and a name that arrived after the first paint
  // would show the code first.
  setCountryNames(countries, locale);

  return (
    <SessionProvider session={session}>
      <Provider store={store}>
        <Notifications />
        {children}
      </Provider>
    </SessionProvider>
  );
}
