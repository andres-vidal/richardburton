"use client";

import { Publication } from "modules/publication/model";
import { useTranslations } from "next-intl";
import pDebounce from "p-debounce";
import { FC, forwardRef, useMemo } from "react";
import { ListDataInputProps } from "./DataInput";
import Multicombobox from "./Multicombobox";

export default forwardRef<HTMLDivElement, ListDataInputProps>(
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
    const t = useTranslations("admin");

    // Memoised rather than wrapped in `useCallback`: what is kept is the
    // debounced function itself, and a debounce only holds its timer while the
    // same instance is kept.
    const getOptions = useMemo(
      () =>
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
        value={value}
        onChange={(next) => onChange?.(next)}
        getOptions={getOptions}
        emptyMessage={t("noMatchComma")}
      />
    );
  },
) as FC<ListDataInputProps>;
