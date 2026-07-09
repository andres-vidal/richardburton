"use client";

import { Publication } from "modules/publication";
import { FC, forwardRef, useCallback, useMemo } from "react";
import { DataInputProps } from "./DataInput";
import Select, { SelectOption } from "./Select";
import pDebounce from "p-debounce";

export default forwardRef<HTMLInputElement, DataInputProps>(
  function TextEnumDataInput({ colId, value, onChange, ...props }, ref) {
    function handleChange(option: SelectOption) {
      onChange?.(option.id);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const getOptions = useCallback(
      pDebounce(
        (search: string) => Publication.autocomplete(search, colId),
        350,
      ),
      [colId],
    );

    const selectedOption = useMemo(
      () =>
        value
          ? { id: value, label: Publication.describeValue(value, colId) }
          : undefined,
      [value, colId],
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
) as FC<DataInputProps>;
