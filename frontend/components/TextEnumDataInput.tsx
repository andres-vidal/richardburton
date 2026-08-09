"use client";

import { Publication } from "modules/publication/model";
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
) as FC<ScalarDataInputProps>;
