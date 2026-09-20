"use client";

import { knowsCountries, rememberCountries } from "modules/country";
import type { NamedCountry } from "modules/country";
import { FC, ReactNode } from "react";

/**
 * Hands the countries the server named to the module that turns a code into a
 * name, before anything that shows one renders.
 *
 * Said during render rather than after it: a cell asks for a country's name as
 * it renders, and a name that arrived in an effect would arrive too late and
 * show the code first. The names for a language never change while the app is
 * running, so taking them in once is enough.
 */
const CountryNames: FC<{
  locale: string;
  countries: NamedCountry[];
  children: ReactNode;
}> = ({ locale, countries, children }) => {
  if (!knowsCountries(locale)) rememberCountries(locale, countries);

  return <>{children}</>;
};

export default CountryNames;
