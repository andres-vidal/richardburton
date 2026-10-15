import ErrorIcon from "assets/error.svg";
import InfoCircleIcon from "assets/info-circle.svg";
import WarningIcon from "assets/warning.svg";
import { FC } from "react";
import TooltipProvider, { TooltipProps } from "./TooltipProvider";

type Props = Omit<TooltipProps, "content"> & {
  message: string;
  variant?: "error" | "warning" | "info";
};

/**
 * Shows `message` in a tooltip on its child, with the colours and icon of its
 * `variant`, while the child is hovered or focused. The message wraps at 20rem.
 * When `message` is empty, the child renders alone. Placement and boundary
 * props pass through to `TooltipProvider`.
 */
const Tooltip: FC<Props> = ({ children, message, variant, ...props }) => {
  const content = (
    <div
      data-variant={variant}
      className={`
        group flex items-center py-1.5 px-2 text-sm space-x-2 m-2 rounded shadow-sm
        data-[variant=error]:text-white data-[variant=error]:bg-red-600
        data-[variant=warning]:bg-white
        data-[variant=info]:bg-white
      `}
    >
      <span
        aria-hidden
        className={`
          self-start
          group-data-[variant=info]:text-indigo-700
          group-data-[variant=warning]:text-amber-400
        `}
      >
        {variant === "error" && <ErrorIcon className="w-5 aspect-square" />}
        {variant === "warning" && <WarningIcon className="w-5 aspect-square" />}
        {variant === "info" && <InfoCircleIcon className="w-5 aspect-square" />}
      </span>

      <span className="max-w-xs">{message}</span>
    </div>
  );

  return message ? (
    <TooltipProvider {...props} content={content}>
      {children}
    </TooltipProvider>
  ) : (
    <>{children}</>
  );
};

export default Tooltip;
