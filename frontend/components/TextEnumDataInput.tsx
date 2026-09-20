"use client";

import { useCountryNaming } from "modules/country-names";
import { Publication } from "modules/publication/model";
import { useLocale } from "next-intl";
import pDebounce from "p-debounce";
import { FC, forwardRef, useCallback, useMemo } from "react";
import { ScalarDataInputProps } from "./DataInput";
import Select, { SelectOption } from "./Select";

export default forwardRef<HTMLInputElement, ScalarDataInputProps>(
  function TextEnumDataInput(
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
    function handleChange(option: SelectOption) {
      onChange?.(option.id);
    }

    const locale = useLocale();
    const country = useCountryNaming();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const getOptions = useCallback(
      pDebounce(
        (search: string) => Publication.autocomplete(search, colId, locale),
        350,
      ),
      [colId, locale],
    );

    const selectedOption = useMemo(
      () => (value ? { id: value, label: country.name(value) } : undefined),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [value, locale],
    );

    return (
      <Select
        {...props}
        ref={ref}
        value={selectedOption}
        onChange={handleChange}
        getOptions={getOptions}
      />
    );
  },
) as FC<ScalarDataInputProps>;
