import { Publication } from "modules/publication";
import pDebounce from "p-debounce";
import { FC, forwardRef, useCallback, useMemo } from "react";
import { PublicationInputProps } from "./PublicationInput";
import Multicombobox from "./Multicombobox";

export default forwardRef<HTMLDivElement, PublicationInputProps>(
  function TextArrayDataInput(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { attribute, value, onChange, ...props },
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
        (search: string) => Publication.autocomplete(search, attribute),
        350,
      ),
      [attribute],
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
) as FC<PublicationInputProps>;
