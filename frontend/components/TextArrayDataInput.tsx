"use client";

import { LOOKUP } from "modules/lookup";
import { useTranslations } from "next-intl";
import { FC } from "react";
import { DataInputFieldProps } from "./DataInput";
import Multicombobox from "./Multicombobox";

type Props = DataInputFieldProps<string[]> & {
  /** The search in `LOOKUP` that suggests the names. */
  lookup: "authors" | "publishers";
};

/**
 * A field for an attribute that holds a list of names, each shown as a chip.
 * Typing suggests the names that the search `lookup` finds, and a name it
 * does not find can be added as typed.
 */
const TextArrayDataInput: FC<Props> = ({ lookup, onChange, ...props }) => {
  const t = useTranslations("admin");

  return (
    <Multicombobox<string>
      {...props}
      onChange={(next) => onChange?.(next)}
      getOptions={(term) => LOOKUP[lookup](term)}
      emptyMessage={t("noMatchComma")}
      freeText
    />
  );
};

export default TextArrayDataInput;
