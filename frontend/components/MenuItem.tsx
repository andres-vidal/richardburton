import { DetailedHTMLProps, forwardRef, LiHTMLAttributes } from "react";

type Props = Omit<
  DetailedHTMLProps<LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>,
  "className"
> & {
  selected: boolean;
};

export default forwardRef<HTMLLIElement, Props>(function MenuItem(
  { selected, children, ...props },
  ref,
) {
  // A listbox option: keyboard navigation is virtual (the input keeps focus and
  // tracks the active index), so the item itself is not focusable — it carries
  // `role="option"` + `aria-selected` and handles pointer clicks via `...props`.
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
