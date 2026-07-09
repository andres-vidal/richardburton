import { isFunction } from "lodash";
import { FC, forwardRef, HTMLProps, ReactNode } from "react";

const Spinner: FC<{ className: string }> = ({ className }) => (
  <svg
    className={`animate-spin ${className}`}
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
  if (loading) {
    Icon = Spinner;
  }

  return (
    <button
      disabled={loading}
      {...props}
      ref={ref}
      data-variant={variant}
      data-width={width}
      data-alignment={alignment}
      className={`
        flex py-1.5 px-2 transition-colors items-center rounded font-base shadow-sm text-xs group space-x-2 whitespace-nowrap
        data-[loading=false]:disabled:bg-gray-100 data-[loading=false]:disabled:text-gray-300 data-[loading=false]:disabled:hover:bg-gray-100
        data-[variant=primary]:text-white data-[variant=primary]:bg-indigo-600 data-[variant=primary]:hover:bg-indigo-700 data-[variant=primary]:loading:bg-indigo-700
        data-[variant=secondary]:text-gray-900 data-[variant=secondary]:bg-yellow-500 data-[variant=secondary]:hover:bg-yellow-600 data-[variant=secondary]:loading:bg-yellow-600
        data-[variant=outline]:text-gray-700 data-[variant=outline]:bg-gray-100 data-[variant=outline]:hover:bg-gray-active data-[variant=outline]:loading:bg-gray-active
        data-[variant=danger]:text-white data-[variant=danger]:bg-red-600 data-[variant=danger]:hover:bg-red-700 data-[variant=danger]:loading:bg-red-700
        data-[alignment=center]:justify-center
        data-[width=full]:w-full
        data-[width=fixed]:w-36
        data-[width=fit]:w-fit
      `}
      aria-busy={loading}
      data-loading={Boolean(loading)}
      onClick={onClick}
      type={type}
    >
      {Icon && isFunction(Icon) ? (
        <Icon
          className={`
            w-4 h-4 group-disabled:text-gray-300
            group-data-[variant=outline]:text-indigo-700
            ${labelSrOnly ? "" : alignment === "center" ? "-ml-4" : "-ml-0.5"}
          `}
        />
      ) : (
        Icon
      )}

      <span
        data-sr-only={Boolean(labelSrOnly)}
        className="data-[sr-only=true]:sr-only"
      >
        {label}
      </span>
    </button>
  );
});

export type { Props as ButtonProps };

export default Button;
