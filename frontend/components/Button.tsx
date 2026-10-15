"use client";

import SpinnerIcon from "assets/spinner.svg";
import { isFunction } from "lodash";
import { FC, forwardRef, HTMLProps, ReactNode } from "react";

/**
 * The classes of a button, shared with `ButtonLink` so that a link styled as a
 * button looks the same. They read the `data-variant`, `data-size`,
 * `data-width` and `data-alignment` attributes of the element.
 */
const BUTTON_CLASS_NAME = `
  flex transition-colors items-center rounded font-base group gap-2 whitespace-nowrap
  border border-transparent focus-ring
  data-[size=small]:py-1.5 data-[size=small]:px-2 data-[size=small]:text-xs
  data-[size=field]:py-1.5 data-[size=field]:px-2.5 data-[size=field]:text-sm
  data-[size=medium]:py-2 data-[size=medium]:px-4 data-[size=medium]:text-sm
  data-[loading=false]:disabled:bg-gray-100 data-[loading=false]:disabled:text-gray-300 data-[loading=false]:disabled:border-gray-200 data-[loading=false]:disabled:hover:bg-gray-100
  data-[variant=primary]:text-white data-[variant=primary]:bg-indigo-600 data-[variant=primary]:hover:bg-indigo-700 data-[variant=primary]:loading:bg-indigo-700
  data-[variant=secondary]:text-white data-[variant=secondary]:bg-amber-700 data-[variant=secondary]:hover:bg-amber-800 data-[variant=secondary]:loading:bg-amber-800
  data-[variant=outline]:text-gray-700 data-[variant=outline]:bg-white data-[variant=outline]:border-gray-300 data-[variant=outline]:hover:bg-gray-100 data-[variant=outline]:loading:bg-gray-100
  data-[variant=outline-primary]:text-indigo-600 data-[variant=outline-primary]:bg-white data-[variant=outline-primary]:border-indigo-500 data-[variant=outline-primary]:hover:bg-indigo-50 data-[variant=outline-primary]:loading:bg-indigo-50
  data-[variant=danger]:text-white data-[variant=danger]:bg-red-600 data-[variant=danger]:hover:bg-red-700 data-[variant=danger]:loading:bg-red-700
  data-[alignment=center]:justify-center
  data-[width=full]:w-full
  data-[width=fixed]:w-36
  data-[width=fit]:w-fit
`;

type Props = Omit<HTMLProps<HTMLButtonElement>, "size"> & {
  label: string;
  variant?: "primary" | "secondary" | "outline" | "outline-primary" | "danger";
  /** Rendered before the label, hidden from assistive technology. */
  Icon?: FC<{ className: string; "aria-hidden"?: boolean }> | ReactNode;
  /** Rendered after the label, such as the chevron of a menu trigger. */
  right?: ReactNode;
  alignment?: "center" | "left";
  width?: "full" | "fixed" | "fit";
  /**
   * `small` suits dense surfaces such as toolbars and table rows, and `medium`
   * suits forms. `field` is the height of a bordered `TextInput`, for a button
   * that stands in a row of inputs.
   */
  size?: "small" | "field" | "medium";
  labelSrOnly?: boolean;
  type?: "button" | "submit" | "reset";
  /**
   * Replaces the icon with a spinner and disables the button, whatever
   * `disabled` says, while keeping the colour of its variant.
   */
  loading?: boolean;
};

/**
 * The app's button. `label` is always its accessible name, shown, or read by
 * screen readers only when `labelSrOnly` is set. The look comes from
 * `variant`, `size`, `width` and `alignment`, which the element carries as
 * `data-*` attributes for `BUTTON_CLASS_NAME` to read.
 *
 * The icon's offset is a `data-icon-offset` token. A centred button wider than
 * its content pulls the icon into its padding (`hang`), so the label reads as
 * centred. A left-aligned or fitted button pulls it in a little (`nudge`). An
 * icon-only button keeps the icon in the middle (`none`).
 */
const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    label,
    variant = "primary",
    Icon,
    right,
    alignment = "center",
    width = "full",
    size = "small",
    type = "button",
    labelSrOnly,
    loading = false,
    disabled,
    ...props
  },
  ref,
) {
  const ShownIcon = loading ? SpinnerIcon : Icon;

  const iconOffset = labelSrOnly
    ? "none"
    : alignment === "center" && width !== "fit"
      ? "hang"
      : "nudge";

  return (
    <button
      {...props}
      ref={ref}
      disabled={loading || disabled}
      data-variant={variant}
      data-width={width}
      data-alignment={alignment}
      data-icon-offset={iconOffset}
      data-size={size}
      className={BUTTON_CLASS_NAME}
      aria-busy={loading}
      data-loading={loading}
      type={type}
    >
      {ShownIcon && isFunction(ShownIcon) ? (
        <ShownIcon
          aria-hidden
          className={`
            size-4 group-disabled:text-gray-300
            group-data-[loading=true]:animate-spin
            group-data-[variant=outline]:text-indigo-700
            group-data-[icon-offset=nudge]:-ml-0.5
            group-data-[icon-offset=hang]:-ml-4
          `}
        />
      ) : (
        ShownIcon
      )}

      <span
        data-sr-only={Boolean(labelSrOnly)}
        className="data-[sr-only=true]:sr-only"
      >
        {label}
      </span>

      {right}
    </button>
  );
});

export type { Props as ButtonProps };
export { BUTTON_CLASS_NAME };

export default Button;
