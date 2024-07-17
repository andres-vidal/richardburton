import { Publication } from "modules/publication";
import pDebounce from "p-debounce";
import { FC, forwardRef, useCallback, useMemo } from "react";
import { PublicationInputProps } from "./PublicationInput";
import Multicombobox from "./Multicombobox";

type Enum = { id: string; label: string };

export default forwardRef<HTMLDivElement, PublicationInputProps>(
  function TextEnumArrayDataInput(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { attribute, value, onChange, ...props },
    ref,
  ) {
    const toEnum = useCallback(
      (id: string): Enum => {
        return { id, label: Publication.describeValue(id, attribute) };
      },
      [attribute],
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
        (search: string) => Publication.autocomplete(search, attribute),
        350,
      ),
      [attribute],
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
) as FC<PublicationInputProps>;
