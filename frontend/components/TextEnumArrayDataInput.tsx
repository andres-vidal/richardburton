"use client";

import { useCountryNaming } from "modules/country-names";
import { LOOKUP, type Country } from "modules/lookup";
import { useLocale } from "next-intl";
import { FC } from "react";
import { DataInputFieldProps } from "./DataInput";
import Multicombobox from "./Multicombobox";

/**
 * A field for an attribute that holds a list of country codes. Each code is
 * shown as a chip with the country's name, and typing suggests the countries
 * that `LOOKUP.countries` finds, named in the reader's locale. Only a found
 * country can be added. `onChange` receives the codes.
 */
const TextEnumArrayDataInput: FC<DataInputFieldProps<string[]>> = ({
  value,
  onChange,
  ...props
}) => {
  const locale = useLocale();
  const country = useCountryNaming();

  return (
    <Multicombobox<Country>
      {...props}
      value={value.map((id) => ({ id, label: country.name(id) }))}
      onChange={(next) => onChange?.(next.map(({ id }) => id))}
      getOptions={(term) => LOOKUP.countries(term, locale)}
    />
  );
};

export default TextEnumArrayDataInput;
