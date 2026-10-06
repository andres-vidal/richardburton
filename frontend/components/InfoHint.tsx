"use client";

import InfoCircleIcon from "assets/info-circle.svg";
import { FC } from "react";
import Tooltip from "./Tooltip";

/**
 * A small info icon that shows `message` in a tooltip while it is hovered or
 * focused. The icon is a button, so it can be reached with the keyboard and
 * tapped on a touch screen, and `label` is its accessible name, such as
 * "About Works".
 */
const InfoHint: FC<{ label: string; message: string }> = ({
  label,
  message,
}) => (
  <Tooltip variant="info" message={message}>
    <button
      type="button"
      aria-label={label}
      className="inline-flex rounded-full transition-colors text-gray-600 hover:text-indigo-600 focus-ring"
    >
      <InfoCircleIcon className="size-4" />
    </button>
  </Tooltip>
);

export default InfoHint;
