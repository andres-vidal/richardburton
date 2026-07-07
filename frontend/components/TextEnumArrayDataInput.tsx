import { Publication } from "modules/publication";
import pDebounce from "p-debounce";
import { FC, forwardRef, useCallback, useMemo } from "react";
import { DataInputProps } from "./DataInput";
import Multicombobox from "./Multicombobox";

type Enum = { id: string; label: string };

export default forwardRef<HTMLDivElement, DataInputProps>(
  function TextEnumArrayDataInput({ colId, value, onChange, ...props }, ref) {
    const toEnum = useCallback(
      (id: string): Enum => {
        return { id, label: Publication.describeValue(id, colId) };
      },
      [colId],
    );

    const items = useMemo(
      () => (value === "" ? [] : value.split(",").map(toEnum)),
      [value, toEnum],
    );

    function handleChange(value: Enum[]) {
      onChange?.(value.map(({ id }) => id).join(","));
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
) as FC<DataInputProps>;
