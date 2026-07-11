"use client";

import { Publication } from "modules/publication";
import pDebounce from "p-debounce";
import { FC, forwardRef, useCallback, useMemo } from "react";
import { DataInputProps } from "./DataInput";
import Multicombobox from "./Multicombobox";

export default forwardRef<HTMLDivElement, DataInputProps>(
  function TextArrayDataInput(
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
    const items = useMemo(
      () => (value === "" ? [] : value.split(",")),
      [value],
    );

    function handleChange(value: string[]) {
      onChange?.(value.join(","));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const getOptions = useCallback(
      pDebounce(
        (search: string) => Publication.autocomplete(search, colId),
        350,
      ),
      [colId],
    );

    return (
      <Multicombobox<string>
        {...props}
        forwardedRef={ref}
        value={items}
        onChange={handleChange}
        getOptions={getOptions}
      />
    );
  },
) as FC<DataInputProps>;
