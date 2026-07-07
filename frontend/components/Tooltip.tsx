import classNames from "classnames";
import { FC } from "react";
import TooltipProvider, { TooltipProps } from "./TooltipProvider";

import WarningIcon from "assets/warning.svg";
import ErrorIcon from "assets/error.svg";
import InfoCircleIcon from "assets/info-circle.svg";

type Props = Omit<TooltipProps, "content"> & {
  message: string;
  error?: boolean;
  warning?: boolean;
  info?: boolean;
};

const Tooltip: FC<Props> = ({
  children,
  message,
  error,
  warning,
  info,
  ...props
}) => {
  const content = (
    <div
      className={classNames(
        "flex items-center py-1.5 px-2 text-sm space-x-2 m-2 rounded shadow-sm",
        {
          "text-white bg-red-600": error,
          "bg-white ": warning || info,
        },
      )}
    >
      <span
        role="presentation"
        className={classNames("self-start", {
          "text-indigo-700": info,
          "text-amber-400": warning,
        })}
      >
        {error && <ErrorIcon className="w-5 aspect-square" />}
        {warning && <WarningIcon className="w-5 aspect-square" />}
        {info && <InfoCircleIcon className="w-5 aspect-square" />}
      </span>

      <span>{message}</span>
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
