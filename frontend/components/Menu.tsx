"use client";

import { DetailedHTMLProps, forwardRef, OlHTMLAttributes } from "react";

type Props = Omit<
  DetailedHTMLProps<OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>,
  "className"
>;

export default forwardRef<HTMLOListElement, Props>(function Menu(
  { ...props },
  ref,
) {
  return (
    <ol
      // Default listbox role for standalone use; MenuProvider passes the same
      // role (plus the combobox wiring) through `...props` when it owns the menu.
      role="listbox"
      className="z-30 overflow-y-scroll text-xs rounded shadow-sm max-h-48 w-max bg-gray-active scrollbar-thumb-gray-300 scrollbar-thin"
      ref={ref}
      {...props}
    />
  );
});
