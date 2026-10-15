"use client";

import { DetailedHTMLProps, forwardRef, OlHTMLAttributes } from "react";

type Props = Omit<
  DetailedHTMLProps<OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>,
  "className"
> & {
  /**
   * Draws the list outlined on white, to match a `bordered` `TextInput`.
   * Without it the list is the small, borderless style of dense tables.
   */
  bordered?: boolean;
};

/**
 * Renders a scrollable list of options with the `listbox` role, for
 * `MenuItem`s. Any props of an `<ol>` other than `className` pass through,
 * so a caller can replace the role or add the attributes of a combobox.
 */
export default forwardRef<HTMLOListElement, Props>(function Menu(
  { bordered = false, ...props },
  ref,
) {
  return (
    <ol
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
