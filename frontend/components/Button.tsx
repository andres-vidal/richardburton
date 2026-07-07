import c from "classnames";
import { isFunction } from "lodash";
import { FC, forwardRef, HTMLProps, ReactNode } from "react";

const Spinner: FC<{ className: string }> = ({ className }) => (
  <svg
    className={c("animate-spin", className)}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

type Props = HTMLProps<HTMLButtonElement> & {
  label: string;
  variant?: "primary" | "secondary" | "outline" | "danger";
  Icon?: FC<{ className: string }> | ReactNode;
  alignment?: "center" | "left";
  width?: "full" | "fixed" | "fit";
  labelSrOnly?: boolean;
  type?: "button" | "submit" | "reset";
  loading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    label,
    onClick,
    variant = "primary",
    Icon,
    alignment = "center",
    width = "full",
    type = "button",
    labelSrOnly,
    loading,
    ...props
  },
  ref,
) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isOutline = variant === "outline";
  const isDanger = variant === "danger";
  const isTextCentered = alignment === "center";
  const isFixedWidth = width === "fixed";
  const isFullWidth = width === "full";
  const isFitWidth = width === "fit";

  if (loading) {
    Icon = Spinner;
  }

  return (
    <button
      disabled={loading}
      {...props}
      ref={ref}
      className={c(
        "flex py-1.5 px-2 transition-colors items-center rounded font-base shadow-sm text-xs group space-x-2 whitespace-nowrap",
        {
          "disabled:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-gray-100":
            !loading,
          "text-white bg-indigo-600 hover:bg-indigo-700 loading:bg-indigo-700":
            isPrimary,
          "text-gray-900 bg-yellow-500 hover:bg-yellow-600 loading:bg-yellow-600":
            isSecondary,
          "text-gray-700 bg-gray-100 hover:bg-gray-active loading:bg-gray-active":
            isOutline,
          "text-white bg-red-600 hover:bg-red-700 loading:bg-red-700": isDanger,
          "justify-center": isTextCentered,
          "w-full": isFullWidth,
          "w-36": isFixedWidth,
          "w-fit": isFitWidth,
        },
      )}
      aria-busy={loading}
      data-loading={loading}
      onClick={onClick}
      type={type}
    >
      {Icon && isFunction(Icon) ? (
        <Icon
          className={c("w-4 h-4 group-disabled:text-gray-300", {
            "text-indigo-700": isOutline,
            "-ml-0.5": !labelSrOnly && !isTextCentered,
            "-ml-4": !labelSrOnly && isTextCentered,
          })}
        />
      ) : (
        Icon
      )}

      <span className={c({ "sr-only": labelSrOnly })}>{label}</span>
    </button>
  );
});

export type { Props as ButtonProps };

export default Button;
