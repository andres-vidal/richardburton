"use client";

import { setCountryNames } from "modules/country";
import type { Country } from "modules/country";
import { FC, ReactNode } from "react";

/**
 * Hands the countries the server named to the module that turns a code into a
 * name, before anything that shows one renders.
 *
 * Said during render rather than after it: a cell asks for a country's name as
 * it renders, and a name that arrived in an effect would arrive too late and
 * show the code first.
 */
const CountryNames: FC<{
  locale: string;
  countries: Country[];
  children: ReactNode;
}> = ({ locale, countries, children }) => {
  setCountryNames(countries, locale);

  return <>{children}</>;
};

export default CountryNames;
