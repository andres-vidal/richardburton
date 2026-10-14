"use client";

import CheckIcon from "assets/check.svg";
import { forwardRef } from "react";
import Button, { ButtonProps } from "./Button";

type Props = ButtonProps & {
  label: string;
  checked: boolean;
  onClick: () => void;
  /** The icon shown while checked. Defaults to a check mark. */
  CheckedIcon?: ButtonProps["Icon"];
  /** The icon shown while unchecked. Defaults to none. */
  UncheckedIcon?: ButtonProps["Icon"];
};

/**
 * A left-aligned `Button` that switches something on or off. It is the
 * primary variant with `CheckedIcon` while `checked`, and the outline variant
 * with `UncheckedIcon` otherwise. `aria-pressed` says which, and `onClick` is
 * left to flip `checked`. It takes the other props of `Button`.
 */
const Toggle = forwardRef<HTMLButtonElement, Props>(function Toggle(
  { label, checked, onClick, CheckedIcon = CheckIcon, UncheckedIcon, ...props },
  ref,
) {
  return (
    <Button
      {...props}
      ref={ref}
      aria-pressed={checked}
      variant={checked ? "primary" : "outline"}
      Icon={checked ? CheckedIcon : UncheckedIcon}
      label={label}
      onClick={onClick}
      alignment="left"
    />
  );
});

export default Toggle;
