"use client";

import { useCountryNaming } from "modules/country-names";
import { Publication } from "modules/publication/model";
import pDebounce from "p-debounce";
import { useLocale } from "next-intl";
import { FC, forwardRef, useCallback, useMemo } from "react";
import { ListDataInputProps } from "./DataInput";
import Multicombobox from "./Multicombobox";

type Enum = { id: string; label: string };

export default forwardRef<HTMLDivElement, ListDataInputProps>(
  function TextEnumArrayDataInput(
    {
      rowId: _rowId,
      autoValidated: _autoValidated,
      colId,
      value,
      onChange,
      ...props
    },
    ref,
  ) {
    const locale = useLocale();
    const country = useCountryNaming();

    const toEnum = useCallback(
      (id: string): Enum => ({ id, label: country.name(id) }),
      [country],
    );

    const items = useMemo(() => value.map(toEnum), [value, toEnum]);

    function handleChange(value: Enum[]) {
      onChange?.(value.map(({ id }) => id));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const getOptions = useCallback(
      pDebounce(
        (search: string) => Publication.autocomplete(search, colId, locale),
        350,
      ),
      [colId, locale],
    );

    return (
      <Multicombobox<Enum>
        {...props}
        forwardedRef={ref}
        value={items}
        onChange={handleChange}
        getOptions={getOptions}
      />
    );
  },
) as FC<ListDataInputProps>;
