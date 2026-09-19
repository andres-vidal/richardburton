"use client";

import { Publication } from "modules/publication/model";
import pDebounce from "p-debounce";
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
    const toEnum = useCallback(
      (id: string): Enum => {
        return { id, label: Publication.describeValue(id, colId) };
      },
      [colId],
    );

    const items = useMemo(() => value.map(toEnum), [value, toEnum]);

    function handleChange(value: Enum[]) {
      onChange?.(value.map(({ id }) => id));
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
