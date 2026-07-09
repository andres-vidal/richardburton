"use client";

import CheckIcon from "assets/check.svg";
import { forwardRef } from "react";
import Button, { ButtonProps } from "./Button";

type Props = ButtonProps & {
  label: string;
  checked: boolean;
  onClick: () => void;
  CheckedIcon?: ButtonProps["Icon"];
  UncheckedIcon?: ButtonProps["Icon"];
};

const Toggle = forwardRef<HTMLButtonElement, Props>(function Toggle(
  { label, checked, onClick, CheckedIcon = CheckIcon, UncheckedIcon, ...props },
  ref,
) {
  return (
    <Button
      {...props}
      ref={ref}
      variant={checked ? "primary" : "outline"}
      Icon={checked ? CheckedIcon : UncheckedIcon}
      label={label}
      onClick={onClick}
      alignment="left"
    />
  );
});

export default Toggle;
