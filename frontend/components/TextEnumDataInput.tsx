import { Publication } from "modules/publication";
import { FC, forwardRef, useCallback, useMemo } from "react";
import { PublicationInputProps } from "./PublicationInput";
import Select, { SelectOption } from "./Select";
import pDebounce from "p-debounce";

export default forwardRef<HTMLInputElement, PublicationInputProps>(
  function TextEnumDataInput({ attribute, value, onChange, ...props }, ref) {
    function handleChange(option: SelectOption) {
      onChange?.(option.id);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const getOptions = useCallback(
      pDebounce(
        (search: string) => Publication.autocomplete(search, attribute),
        350,
      ),
      [attribute],
    );

    const selectedOption = useMemo(
      () =>
        value
          ? { id: value, label: Publication.describeValue(value, attribute) }
          : undefined,
      [value, attribute],
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
) as FC<PublicationInputProps>;
