"use client";

import { DetailedHTMLProps, forwardRef, OlHTMLAttributes } from "react";

type Props = Omit<
  DetailedHTMLProps<OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>,
  "className"
> & {
  /** Outlined style to match a `bordered` TextInput; defaults to the subtle
   * dense style used in the workspace table. */
  bordered?: boolean;
};

export default forwardRef<HTMLOListElement, Props>(function Menu(
  { bordered = false, ...props },
  ref,
) {
  return (
    <ol
      // Default listbox role for standalone use; MenuProvider passes the same
      // role (plus the combobox wiring) through `...props` when it owns the menu.
      role="listbox"
      data-bordered={bordered}
      className={`
        z-60 overflow-y-auto rounded max-h-48 w-max scrollbar-thumb-gray-300 scrollbar-thin
        data-[bordered=false]:text-xs data-[bordered=false]:shadow-sm data-[bordered=false]:bg-gray-active
        data-[bordered=true]:text-sm data-[bordered=true]:p-1 data-[bordered=true]:space-y-0.5 data-[bordered=true]:bg-white data-[bordered=true]:border data-[bordered=true]:border-gray-200 data-[bordered=true]:shadow-md
      `}
      ref={ref}
      {...props}
    />
  );
});
