"use client";

import { Link } from "i18n/navigation";
import { FC } from "react";
import { BUTTON_CLASS_NAME, type ButtonProps } from "./Button";

/**
 * A link that looks like a `Button`, for an action that goes to another page
 * rather than doing something on this one. It takes the button's `variant`,
 * `size` and `width`, and renders the app's localized `Link`.
 *
 * With `newTab`, the page opens in a new tab, which gets no access to this one.
 */
const ButtonLink: FC<{
  label: string;
  href: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  width?: ButtonProps["width"];
  /** The accessible name, for when the label alone does not say what it opens. */
  "aria-label"?: string;
  newTab?: boolean;
}> = ({
  label,
  href,
  variant = "primary",
  size = "small",
  width = "fit",
  "aria-label": ariaLabel,
  newTab = false,
}) => (
  <Link
    href={href}
    aria-label={ariaLabel}
    target={newTab ? "_blank" : undefined}
    rel={newTab ? "noopener noreferrer" : undefined}
    data-variant={variant}
    data-size={size}
    data-width={width}
    data-alignment="center"
    className={BUTTON_CLASS_NAME}
  >
    {label}
  </Link>
);

export default ButtonLink;
