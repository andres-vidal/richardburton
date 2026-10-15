"use client";

import { DetailedHTMLProps, forwardRef, LiHTMLAttributes } from "react";

type Props = Omit<
  DetailedHTMLProps<LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>,
  "className"
> & {
  /** Highlights the option, as the one the arrow keys have reached. */
  selected: boolean;
};

/**
 * Renders one option of a `Menu`, with the `option` role and `aria-selected`.
 * It does not take focus, since the arrow keys move a highlight through the
 * options while focus stays on the menu's trigger. Any props of an `<li>`
 * other than `className`, such as `onClick`, pass through.
 */
export default forwardRef<HTMLLIElement, Props>(function MenuItem(
  { selected, children, ...props },
  ref,
) {
  return (
    <li
      {...props}
      role="option"
      aria-selected={selected}
      className={`
        px-2.5 py-1 text-left rounded cursor-pointer hover:bg-indigo-100
        aria-selected:bg-indigo-100
      `}
      ref={ref}
    >
      {children}
    </li>
  );
});
